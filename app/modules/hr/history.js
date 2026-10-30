/* 인사 이력(인사기록카드) — 직원 1명의 계약·인사 변동·면담·평가·연차·퇴직·급여명세서 발행·서류 발송을 날짜순 타임라인으로 모은다.
 * 있는 자료를 모아 보여 줄 뿐 새로 저장하지 않는다. 금액(시급·연봉·퇴직금)은 secret 으로 따로 두어 화면에서 기본 가림 + [보기], 인쇄본에서는 뺀다.
 * 면담·평가 의견은 앞 60자만 보이고 전문은 각 화면에서 본다. 순수 함수 — 시험: tests/hr-history.test.mjs. 설계: app-docs/hr-additions-design.md §6 */
import { historyText, RRQ_STATUS } from './logic.js?v=20261030a';
import { DS_REASON } from './dismissal.js?v=20261030a';

export const HIST_KINDS = {
  join: { label: '입사', mark: '🟢' }, exit: { label: '퇴직', mark: '⚫' }, contract: { label: '계약', mark: '📝' }, change: { label: '인사 변동', mark: '🔀' }, interview: { label: '면담', mark: '💬' }, eval: { label: '평가', mark: '⭐' },
  leave: { label: '연차·휴가', mark: '🌴' }, promo: { label: '연차촉진', mark: '📣' }, resign: { label: '퇴직원서', mark: '📄' }, retire: { label: '퇴직 정산', mark: '🧾' }, dismissal: { label: '해고예고', mark: '⚠️' }, payslip: { label: '급여명세서', mark: '💳' }, send: { label: '서류 발송', mark: '✉️' }
};
export const HIST_ORDER = ['join', 'change', 'contract', 'interview', 'eval', 'leave', 'promo', 'resign', 'retire', 'dismissal', 'exit', 'payslip', 'send'];
export const HIST_GROUPS = [['all', '전체', null], ['person', '인사·평가', ['join', 'change', 'interview', 'eval']], ['contract', '계약', ['contract']], ['leave', '연차', ['leave', 'promo']], ['doc', '서류', ['payslip', 'send']], ['exit', '퇴직', ['exit', 'resign', 'retire', 'dismissal']]];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const won = (n) => Math.round(N(n)).toLocaleString('ko-KR') + '원';
const cut = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
/** 서버 시각(Timestamp)·날짜 글자·Date → YYYY-MM-DD (한국 시간 기준, 이상하면 빈 글자) */
export function tsDate(v) {
  if (!v) return ''; if (typeof v === 'string') return isDate(v.slice(0, 10)) ? v.slice(0, 10) : '';
  const d = typeof v.toDate === 'function' ? v.toDate() : (v instanceof Date ? v : null); if (!d || isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
const dayOf = (...c) => { for (const x of c) { const d = tsDate(x); if (d) return d; } return ''; };

/** inp: { worker, annual, labor, changes, interviews, evals, leaves, promos, resigns, severance, dismissals, payslips, sends } — 각 배열은 문서 데이터(id 포함 권장).
 *  돌려주는 값: { items(최신순), skipped(날짜를 알 수 없어 뺀 건수) } */
export function buildHistory(inp) {
  const x = inp || {}; const w = x.worker || {}; const wid = w.id || ''; const items = []; let skipped = 0;
  const add = (it) => { if (!isDate(it.date)) { skipped++; return; } items.push(it); };
  if (isDate(w.hireDate)) add({ key: 'join', kind: 'join', date: w.hireDate, title: '입사', detail: [w.dept, w.rank].filter(Boolean).join(' · '), link: '' });
  if (isDate(w.resignDate)) add({ key: 'exit', kind: 'exit', date: w.resignDate, title: '퇴직', detail: '', link: '' });
  const money = (c) => { const p = []; if (N(c.hourly) > 0) p.push('시급 ' + won(c.hourly)); if (N(c.salary) > 0) p.push('연봉 ' + won(c.salary)); return p.join(' · '); };
  [['annual', x.annual, '연봉계약서', 'annualc'], ['labor', x.labor, '근로계약서', 'laborc']].forEach(([k, list, label, route]) => (list || []).forEach((c, i) => { if (!c) return; add({ key: k + ':' + (c.id || i), kind: 'contract', date: dayOf(c.contractDate, c.startDate), title: label, detail: (c.startDate || '?') + ' ~ ' + (c.endDate || '기간 정함 없음'), link: '#/hr/' + route + '/' + encodeURIComponent(wid), secret: money(c) }); }));
  (x.changes || []).forEach((h, i) => { if (!h) return; const t = historyText(h); const kind = h.type === 'both' ? '직급·소속' : h.type === 'rank' ? '직급' : h.type === 'dept' ? '소속' : ''; add({ key: 'change:' + (h.id || i), kind: 'change', date: dayOf(h.effectiveDate, h.changedAt), title: '인사 변동' + (kind ? ' — ' + kind : ''), detail: [t, h.reason ? cut(h.reason, 60) : ''].filter(Boolean).join(' · '), link: '#/hr/change' }); });
  (x.interviews || []).forEach((r, i) => { if (!r) return; add({ key: 'interview:' + (r.id || i), kind: 'interview', date: dayOf(r.date, r.createdAt), title: '면담', detail: [cut(r.memo, 60), r.followUp ? '후속 조치 필요' : ''].filter(Boolean).join(' · '), link: '#/hr/interviews' }); });
  (x.evals || []).forEach((r, i) => { if (!r) return; const adhoc = r.type === 'adhoc'; add({ key: 'eval:' + (r.id || i), kind: 'eval', date: dayOf(r.confirmedAt, r.createdAt, r.year ? r.year + '-12-31' : ''), title: adhoc ? '수시 평가' + (r.pjtName ? ' · ' + r.pjtName : '') : (r.year || '') + ' 정기 평가', detail: ['등급 ' + (r.grade || '-'), r.status === 'confirmed' ? '확정' : '초안', cut(r.comment, 60)].filter(Boolean).join(' · '), link: '#/hr/evals' }); });
  (x.leaves || []).forEach((l, i) => { if (!l || !['approved', 'posted'].includes(l.status)) return; const days = N(l.days || l.totalDays); add({ key: 'leave:' + (l.id || i), kind: 'leave', date: dayOf(l.startDate, l.date), title: l.leaveType || '휴가', detail: (l.startDate || '?') + ' ~ ' + (l.endDate || l.startDate || '?') + (days > 0 ? ' · ' + days + '일' : ''), link: '#/hr/leaves' }); });
  (x.promos || []).forEach((p, i) => { if (!p) return; add({ key: 'promo:' + (p.id || i), kind: 'promo', date: dayOf(p.noticeDate), title: p.stage === 'p2' ? '연차사용촉진 2차(시기 지정) 통보' : '연차사용촉진 1차 통보', detail: (p.periodStart || '?') + ' ~ ' + (p.periodEnd || '?') + ' · 미사용 ' + N(p.unusedDays) + '일', link: '#/hr/leavepromo' }); });
  (x.resigns || []).forEach((r, i) => { if (!r) return; add({ key: 'resign:' + (r.id || i), kind: 'resign', date: dayOf(r.lastDate, r.createdAt), title: '휴직/퇴직 원서', detail: [r.leaveKind ? String(r.leaveKind) : '', '마지막 근무일 ' + (r.lastDate || '?'), r.status ? '상태 ' + (RRQ_STATUS[r.status] || r.status) : ''].filter(Boolean).join(' · '), link: '#/hr/resignreqs' }); });
  (x.severance || []).forEach((r, i) => { if (!r) return; add({ key: 'retire:' + (r.id || i), kind: 'retire', date: dayOf(r.retireDate, r.createdAt), title: '퇴직 정산', detail: '근속 ' + N(r.serviceDays) + '일', link: '#/hr/retire', secret: N(r.severance) > 0 ? '퇴직금 ' + won(r.severance) : '' }); });
  (x.dismissals || []).forEach((d, i) => { if (!d) return; add({ key: 'dismissal:' + (d.id || i), kind: 'dismissal', date: dayOf(d.noticeDate, d.createdAt), title: '해고예고통지서', detail: '해고일 ' + (d.dismissalDate || '?') + (d.reasonType ? ' · ' + (DS_REASON[d.reasonType] || d.reasonType) : ''), link: '#/hr/dismissal' }); });
  // 급여명세서는 해마다 한 줄로 묶는다(월마다 한 줄이면 타임라인이 묻힌다) — 금액은 넣지 않는다
  const byYear = {}; (x.payslips || []).forEach((p) => { const m = String((p && (p.month || p.id)) || ''); if (/^\d{4}-\d{2}$/.test(m)) (byYear[m.slice(0, 4)] = byYear[m.slice(0, 4)] || []).push(m); });
  Object.keys(byYear).forEach((y) => { const ms = byYear[y].slice().sort(); add({ key: 'payslip:' + y, kind: 'payslip', date: ms[ms.length - 1] + '-01', title: '급여명세서 ' + y + '년 ' + ms.length + '건', detail: ms.map((m) => m.slice(5)).join('·') + '월', link: '#/hr/payslips' }); });
  (x.sends || []).forEach((s, i) => { if (!s) return; add({ key: 'send:' + (s.id || i), kind: 'send', date: dayOf(s.sentAt), title: '서류 발송' + (s.docLabel ? ' — ' + s.docLabel : ''), detail: [s.channel === 'email' ? '이메일' : (s.channel || ''), s.toMasked || ''].filter(Boolean).join(' '), link: '' }); });
  items.sort((a, b) => (a.date === b.date ? HIST_ORDER.indexOf(a.kind) - HIST_ORDER.indexOf(b.kind) : a.date < b.date ? 1 : -1));
  return { items, skipped };
}
/** 종류 묶음으로 거르기 — group 은 'all'·'person'·'contract'·'leave'·'doc'·'exit' */
export function filterItems(items, group) { const g = HIST_GROUPS.find((x) => x[0] === group); return !g || !g[2] ? (items || []).slice() : (items || []).filter((i) => g[2].includes(i.kind)); }
export const groupCounts = (items) => HIST_GROUPS.map(([k]) => [k, filterItems(items, k).length]);
