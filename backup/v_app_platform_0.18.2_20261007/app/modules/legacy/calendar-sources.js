/* 임시 연결부 — 아직 새 모듈로 바뀌지 않은 PJT·인사가 일정을 내놓는 방법(옛 컬렉션 읽기).
 * PJT·인사가 새 모듈이 되면 그 모듈의 manifest.calendar 로 옮기고 이 파일을 지운다. 공개 범위는 컬렉션의 보안 규칙이 정한다. */
import { db, collection, getDocs, query, where, orderBy } from '../../core/firebase.js?v=20261007b';
import { addDays, fromLegacyDoc, makeEvent, TAG_LABEL } from '../../shared/calendar-event.js?v=20261007b';
import { buildExpiryEvents } from '../../shared/expiry-events.js?v=20261007b';

const overlaps = (sd, ed, range) => !!sd && (ed || sd) >= range.from && sd <= range.to;
async function rows(path, range) {            // 시작일 기준 범위 조회(여러 날 일정이 앞 달에서 시작했을 수 있어 45일 앞까지) 후 겹치는 것만
  const s = await getDocs(query(collection(db, ...path), where('sdate', '>=', addDays(range.from, -45)), where('sdate', '<=', range.to)));
  const out = []; s.forEach((d) => { const x = d.data(); if (overlaps(x.sdate, x.edate, range)) out.push({ id: d.id, d: x }); }); return out;
}
export const pjtProvider = { id: 'pjt', label: 'PJT 일정', order: 30, defaultOn: true,
  async load(range) {
    const out = []; const jobs = [];
    jobs.push(rows(['user_schedules'], range).then((r) => r.forEach((x) => out.push(fromLegacyDoc('fab_' + x.id, x.d, 'pjt', 'P4 Ph2 (FAB)', { link: '#/pjt/p4ph2' })))));
    jobs.push(rows(['ph4_schedules'], range).then((r) => r.forEach((x) => out.push(fromLegacyDoc('sup_' + x.id, x.d, 'pjt', 'P4 Ph4 (SUP)', { link: '#/pjt/p4ph4' })))));
    jobs.push(getDocs(query(collection(db, 'pjt_registry'), orderBy('createdAt', 'asc'))).then(async (reg) => {
      const subs = []; reg.forEach((d) => { if (d.data().status !== 'ended') subs.push({ id: d.id, name: d.data().name || 'PJT' }); });
      await Promise.all(subs.map((p) => rows(['pjt_registry', p.id, 'schedules'], range).then((r) => r.forEach((x) => out.push(fromLegacyDoc('reg_' + p.id + '_' + x.id, x.d, 'pjt', p.name, { link: '#/pjt/reg_' + encodeURIComponent(p.id) })))).catch(() => { /* 한 프로젝트가 막혀도 나머지는 표시 */ })));
    }));
    const res = await Promise.allSettled(jobs); if (res.every((r) => r.status === 'rejected') && res.length) throw res[0].reason;   // 전부 실패했을 때만 제공자 실패로 알림
    return out;
  } };
/** 자격·교육·건강검진 만료 — 연명부 실무자 문서(master_worker_info)와 근로자 기본 문서(master_workers)에서 직접 계산한다.
 *  읽을 수 있는 계정은 보안 규칙이 정한다(실무자 = PJT 권한자·관리자). 권한이 없으면 거부되어 이 일정은 조용히 빠진다(GUEST 포함) */
let expCache = null;
async function loadExpiryBase() {
  if (expCache && Date.now() - expCache.t < 60000) return expCache.p;
  const p = Promise.all([getDocs(collection(db, 'master_workers')), getDocs(collection(db, 'master_worker_info'))]).then(([ms, is]) => { const masters = {}; const infos = {}; ms.forEach((d) => { masters[d.id] = d.data(); }); is.forEach((d) => { infos[d.id] = d.data(); }); return { masters, infos }; });
  expCache = { t: Date.now(), p }; p.catch(() => { expCache = null; }); return p;
}
export const expiryProvider = { id: 'expiry', label: '만료 일정', order: 40, defaultOn: true,
  perm: (me) => !!(me && (me.admin || (me.perms && me.perms.pjt))),
  async load(range) {
    const { masters, infos } = await loadExpiryBase(); const today = new Date(); const t = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return buildExpiryEvents(masters, infos, t).filter((x) => x.expiry >= range.from && x.expiry <= range.to).map((x) => makeEvent({ id: 'expiry:' + x.id, source: 'expiry', title: x.name + ' · ' + x.label, start: x.expiry, end: x.expiry, tag: 'expiry', tagLabel: TAG_LABEL.expiry, project: x.company || '', link: '' }));
  } };
const HR_TYPE = { interview: '면접', offerreply: '연봉제안서 회신', salarynego: '연봉협상', eval: '인사평가', resign: '퇴사', etc: '기타' };   // 보안 규칙(validHrEvent)이 허용하는 type 값과 같게
/** 인사 일정 — 지정 담당자 4명만 읽을 수 있다(보안 규칙). 그 외 계정은 UI 힌트(관리자)로 먼저 걸러 불필요한 조회를 하지 않고, 거부되면 조용히 빠진다 */
export const hrProvider = { id: 'hr', label: '인사 일정', order: 50, defaultOn: true, perm: (me) => !!(me && me.admin),
  async load(range) {
    const s = await getDocs(query(collection(db, 'hr_calendar_events'), where('date', '>=', range.from), where('date', '<=', range.to)));
    const out = []; s.forEach((d) => { const x = d.data(); out.push(makeEvent({ id: 'hr:' + d.id, source: 'hr', title: x.title || x.person || '인사 일정', start: x.date, end: x.date, startTime: x.time, endTime: x.endTime, tag: 'hr', tagLabel: HR_TYPE[x.type] || '인사', place: '', extra: '', link: '#/hr/hrcal' })); }); return out;
  } };
export const CAL_SOURCES = { pjt: [pjtProvider, expiryProvider], hr: [hrProvider] };
