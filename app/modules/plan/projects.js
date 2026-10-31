/* 영업기획 프로젝트 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 금액 집계·저장 규칙을 그대로 옮겼다.
 * 청구·지급·손익: 청구 누계 = 청구서(invoice, 폐기 제외), 지급 누계 = 지급예정서(payment, 폐기 제외), 손익(구포털 "실현 손익") = 청구 − 지급, 미수금 = 청구 − 완결된 청구.
 * 여러 프로젝트를 합산한 정산서는 perPjtAmount(프로젝트별 몫)가 있으면 그 값, 없으면 pjtIds 가 둘 이상일 때 균등 분배. */
import { pagerSizeGet } from '../../shared/pager.js?v=20261031h';
export const TYPE_LABEL = { fcu: '자동정산', general: '일반(품목)' };
export const PD_PAGE_SIZE = 10;
import { itemAmt, estSupply, estTotal, isEstActive, setActive, settleAmountForPjt, settleBelongsToPjt, pjtSummary, pjtMargin } from '../../shared/pjt-summary.js?v=20261031h';
export { itemAmt, estSupply, estTotal, isEstActive, setActive, settleAmountForPjt, settleBelongsToPjt, pjtSummary, pjtMargin };   // 영업기획 안에서는 예전 경로 그대로 쓴다(함수는 shared/pjt-summary.js 하나)
/** 등록 순서(오래된 것부터): createdAt(Timestamp·ISO 문자열) → 없으면 문서 번호 pjt_<시각> */
export function pjtCreatedKey(p) {
  const x = p || {}; const c = x.createdAt; if (c && c.seconds) return c.seconds * 1000; if (typeof c === 'string' && !Number.isNaN(Date.parse(c))) return Date.parse(c);
  const m = /^pjt_(\d+)$/.exec(x.id || ''); return m ? parseInt(m[1], 10) : 0;
}
export const sortProjects = (list) => (list || []).slice().sort((a, b) => pjtCreatedKey(a) - pjtCreatedKey(b));
export function filterProjects(list, f) {
  const o = f || {}; const q = String(o.q || '').trim().toLowerCase();
  return (list || []).filter((p) => (!o.status || o.status === 'all' || (o.status === 'done' ? p.status === 'done' : p.status !== 'done')) && (!q || [p.code, p.name, p.site, p.client, p.contractor, p.partner].some((v) => String(v || '').toLowerCase().includes(q))));
}
export function paginate(list, page, size) {
  const n = pagerSizeGet('plan', size || PD_PAGE_SIZE); const total = (list || []).length; const pages = Math.max(1, Math.ceil(total / n)); const pg = Math.min(Math.max(1, Number(page) || 1), pages); const from = (pg - 1) * n;
  return { items: (list || []).slice(from, from + n), page: pg, pages, total, from: total ? from + 1 : 0, to: Math.min(from + n, total) };
}
/** 프로젝트의 견적(날짜 최신순 → 같은 날은 만든 순서 최신순) */
export function pjtEstimates(estimates, pid) {
  const sec = (e) => (e && e.createdAt && e.createdAt.seconds) || 0;
  return (estimates || []).filter((e) => e.pjtId === pid).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || sec(b) - sec(a));
}
/** 프로젝트의 정산서(발행일 최신순 → 같은 날은 번호 큰 순). kind: 'invoice'(청구서) | 'payment'(지급예정서) | 'all' */
export function pjtSettlements(settlements, pid, kind) {
  return (settlements || []).filter((s) => settleBelongsToPjt(s, pid) && (!kind || kind === 'all' || s.docType === kind)).sort((a, b) => String(b.issueDate || '').localeCompare(String(a.issueDate || '')) || String(b.no || '').localeCompare(String(a.no || '')));
}
export const estTag = (e) => (e.status === 'void' ? { text: '폐기', tone: 'gray' } : e.status === 'closed' ? { text: '종결', tone: 'blue' } : (e.rev || 1) > 1 ? { text: '개정 r' + e.rev, tone: 'amber' } : null);
export const settleState = (s) => (s.status === 'void' ? { text: '폐기', tone: 'gray' } : s.status === 'done' ? { text: '완결', tone: 'green' } : { text: '유효', tone: 'blue' });
export const SETTLE_TYPE_LABEL = { invoice: '대금청구서', payment: '지급예정서' };

/** 연동 PJT(구포털 getLinkPjt): 새 프로젝트는 자동 생성(auto), 그 밖에는 연결된 PJT관리 프로젝트의 id(모든 프로젝트 같은 규칙 — p4ph2·p4ph4 도 등록 id 다), 연결이 없으면 none */
export function getLinkPjt(p) { if (!p) return 'auto'; return p.linkPjt || 'none'; }
export function linkOptions(registry) {
  return [{ value: 'auto', label: '🆕 새 PJT관리 항목 자동 생성' }].concat((registry || []).map((r) => ({ value: r.id, label: (r.name || '(이름없음)') + ' — PJT관리 항목에 연결' }))).concat([{ value: 'none', label: '(연동 없음 / 직접 입력)' }]);
}
export const projNew = () => ({ code: '', name: '', site: '', client: '', contractor: '', partner: '', type: 'general', status: 'run', link: 'auto', targetMargin: '' });
export const projToForm = (p) => { const x = p || {}; return { code: x.code || '', name: x.name || '', site: x.site || '', client: x.client || '', contractor: x.contractor || '', partner: x.partner || '', type: x.type === 'fcu' ? 'fcu' : 'general', status: x.status === 'done' ? 'done' : 'run', link: getLinkPjt(p), targetMargin: x.targetMargin == null ? '' : String(x.targetMargin) }; };
/** 저장 계획(구포털 savePjt): PJT 코드 필수. 연동이 "자동 생성"이면 PJT관리(pjt_registry)에 같은 이름의 프로젝트를 새로 만들고(registry), 이미 연동된 프로젝트면
 *  기본정보 6항목(PJT 코드·내용·현장명·발주처·시공사·협력사)을 그대로 반영한다(syncPatch). 새 프로젝트 번호는 pjt_<시각>. 호출한 쪽이 순서대로 쓴다. */
export function projectBuild(form, opt) {
  const f = form || {}; const o = opt || {}; const errors = []; const T = (v, max, label) => { const s = String(v == null ? '' : v).trim(); if (s.length > max) errors.push(label + '은(는) ' + max + '자 이내로 입력해 주세요.'); return s; };
  const code = T(f.code, 80, 'PJT 코드'); if (!code) errors.push('PJT 코드를 입력하세요.');
  const data = { code, name: T(f.name, 120, '내용'), site: T(f.site, 120, '현장명'), client: T(f.client, 80, '발주처'), contractor: T(f.contractor, 80, '시공사'), partner: T(f.partner, 80, '협력사'), type: f.type === 'fcu' ? 'fcu' : 'general', status: f.status === 'done' ? 'done' : 'run' };
  if (errors.length) return { ok: false, errors };
  // 목표 마진율(%): 프로젝트마다 입력(견적 시점의 목표). 비우면 저장하지 않는다(인사평가의 프로젝트 성과 점수에서 "목표 미입력")
  const tm = String(f.targetMargin == null ? '' : f.targetMargin).trim(); if (tm === '') data.clearTarget = true; else { const n = Number(tm); if (!isFinite(n) || n < -100 || n > 100) return { ok: false, errors: ['목표 마진율은 -100~100 사이의 숫자(%)로 입력해 주세요.'] }; data.targetMargin = Math.round(n * 10) / 10; }
  const link = String(f.link || 'auto'); const valid = link === 'auto' || link === 'none' || /^[A-Za-z0-9_-]{1,64}$/.test(link); if (!valid) return { ok: false, errors: ['연동 PJT 값이 올바르지 않습니다.'] };
  const registry = link === 'auto' ? { name: data.code || data.name, site: data.site || '', client: data.client || '', contractor: data.contractor || '', partner: data.partner || '', content: data.name || '', item: '', qty: 0, startDate: '', progress: 0, status: 'active' } : null;
  const syncPatch = link !== 'auto' && link !== 'none' ? { name: data.code, content: data.name, site: data.site, client: data.client, contractor: data.contractor, partner: data.partner } : null;
  const isNew = !o.id;
  return { ok: true, errors: [], isNew, id: o.id || ('pjt_' + (o.now || Date.now())), link, data: Object.assign({}, data), registry, syncPatch, message: isNew ? (link === 'auto' ? '프로젝트를 등록했습니다. (PJT관리에도 자동 생성됨)' : '프로젝트를 등록했습니다.') : (link === 'auto' ? '수정했습니다. (PJT관리에 신규 항목 생성됨)' : '수정했습니다.') };
}
