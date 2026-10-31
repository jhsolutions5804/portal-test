/* 프로젝트 마감 체크리스트(시공검측 이후 프로젝트 완성도, 설계 monthly-report-design.md §3-4) 화면의 순수 도우미 — 서버(monthlyReportAct closeoutSave)와 같은 규칙을 저장 전에 미리 알려 준다(서버가 끝내 다시 막는다).
 * 항목 이름은 코드에 없다(프로젝트마다 직접 입력). 현장 층이라 금액·연락처는 적지 않는다. 시험: tests/pjt-closeout.test.mjs */
import { hasMoney, hasPersonal } from '../../shared/pjt-log.js?v=20261031c';
export const CK_MAX = 30, CK_NAME = 40, CK_ASSIGNEE = 20, CK_MEMO = 200;
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const sp = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); // 공백 정리 — 서버와 같은 방식
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/** 한 줄에 하나씩 적은 이름 → 이름 목록(빈 줄·공백 정리, 같은 이름은 처음 것만, 30개까지) */
export function ckParseNames(text) {
  if (typeof text !== 'string') return []; const out = [];
  text.split(/\r?\n/).forEach((l) => { const n = sp(l); if (n && out.indexOf(n) === -1 && out.length < CK_MAX) out.push(n); });
  return out;
}
/** 저장된 항목 → 편집 행(정해진 필드만 복사 — uid·금액 같은 모르는 필드는 버림) */
export function ckRowsFrom(items) {
  return (Array.isArray(items) ? items : []).filter(isO).map((i) => ({ id: typeof i.id === 'string' ? i.id : '', name: typeof i.name === 'string' ? i.name : '', doneDate: typeof i.doneDate === 'string' ? i.doneDate : '', assignee: typeof i.assignee === 'string' ? i.assignee : '', memo: typeof i.memo === 'string' ? i.memo : '' }));
}
/** 서버에 보낼 모양 — 이름·담당·메모는 공백 정리, 정해진 필드만. 새 항목은 id 빈 글자(서버가 번호를 붙인다) */
export function ckPayload(rows) {
  return (Array.isArray(rows) ? rows : []).filter(isO).map((r) => ({ id: typeof r.id === 'string' ? r.id : '', name: sp(r.name), doneDate: typeof r.doneDate === 'string' ? r.doneDate : '', assignee: sp(r.assignee), memo: sp(r.memo) }));
}
/** 저장 전 미리 알림 — 서버와 같은 규칙, 첫 오류 한 줄(없으면 빈 글자) */
export function ckCheck(rows, today) {
  if (!Array.isArray(rows)) return '체크리스트 항목이 올바르지 않습니다.'; if (rows.length > CK_MAX) return '항목은 ' + CK_MAX + '개까지 둘 수 있습니다.';
  const seen = []; const bad = (v, label, max) => { const x = sp(v); if (x.length > max) return label + '은(는) ' + max + '자 이내로 적어 주세요.'; if (hasMoney(x)) return label + '에는 금액·단가를 적지 않습니다.'; if (hasPersonal(x)) return label + '에는 전화번호·메일 주소를 적지 않습니다.'; return ''; };
  for (const raw of rows) {
    const r = isO(raw) ? raw : {}; if (typeof r.name !== 'string' || !sp(r.name)) return '항목 이름을 입력해 주세요.';
    let e = bad(r.name, '항목 이름', CK_NAME) || (seen.indexOf(sp(r.name)) !== -1 ? '같은 이름의 항목이 있습니다: ' + sp(r.name) : '') || bad(r.assignee, '담당', CK_ASSIGNEE) || bad(r.memo, '메모', CK_MEMO); if (e) return e; seen.push(sp(r.name));
    if (r.doneDate != null && r.doneDate !== '') { if (!isDay(r.doneDate)) return '완료일은 날짜(YYYY-MM-DD)로 입력해 주세요.'; if (isDay(today) && r.doneDate > today) return '완료일은 오늘 이후로 정할 수 없습니다.'; }
  }
  return '';
}
/** 항목 순서 바꾸기 — 새 배열을 돌려준다(번호는 항목을 따라간다). 범위 밖·이상한 값은 그대로 */
export function ckMove(rows, i, d) {
  const a = Array.isArray(rows) ? rows.slice() : []; if (!Number.isInteger(i) || (d !== -1 && d !== 1)) return a; const j = i + d; if (i < 0 || i >= a.length || j < 0 || j >= a.length) return a;
  const t = a[i]; a[i] = a[j]; a[j] = t; return a;
}
/** 편집 초안이 저장된 항목과 다른가(초안이 없으면 false). 공백 정리 뒤 비교 */
export function ckDirty(rows, items) {
  if (!Array.isArray(rows)) return false; return JSON.stringify(ckPayload(rows)) !== JSON.stringify(ckPayload(ckRowsFrom(items)));
}
