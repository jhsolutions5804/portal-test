/* 회사 영역(조직도·규정)의 순수 규칙 — 화면·네트워크 없이 시험한다 */
export const DEPT_ORDER = ['사업본부', '현장관리팀', '인력배치팀', '경영지원본부', '경영총무팀', '영업기획팀'];   // 옛 포털 순서 그대로(미지정은 맨 앞)
export const NO_DEPT = '(미지정)';
const num = (u) => (u && u.createdAt && typeof u.createdAt.toMillis === 'function' ? u.createdAt.toMillis() : (u && +u.createdAt) || 0);
/** 사번이 있는 사람이 먼저(숫자 순서), 없으면 등록 순 */
export function byEmpNo(a, b) {
  const ea = a.empNo || '', eb = b.empNo || '';
  if (ea && eb) return ea.localeCompare(eb, 'ko', { numeric: true });
  if (ea) return -1; if (eb) return 1; return num(a) - num(b);
}
/** 승인 직원을 부서별로 묶는다. 순서: 미지정 → 정해진 부서 순서 → 목록에 없는 부서(가나다 순, 옛 화면은 이들을 "미지정"에 숨겼다) */
export function groupOrg(users, query) {
  const q = String(query || '').trim().toLowerCase();
  const list = (users || []).filter((u) => !u.status || u.status === 'approved').filter((u) => !q || [u.name, u.dept, u.rank, u.phone, u.email, u.empNo].some((v) => String(v || '').toLowerCase().indexOf(q) !== -1));
  const map = new Map();
  list.forEach((u) => { const d = (u.dept && String(u.dept).trim()) || NO_DEPT; if (!map.has(d)) map.set(d, []); map.get(d).push(u); });
  const rest = [...map.keys()].filter((d) => d !== NO_DEPT && DEPT_ORDER.indexOf(d) === -1).sort((a, b) => a.localeCompare(b, 'ko'));
  const order = [NO_DEPT].concat(DEPT_ORDER, rest).filter((d) => map.has(d));
  return order.map((d) => ({ dept: d, people: map.get(d).slice().sort(byEmpNo) }));
}
/** 전화번호 표시용(숫자만 → 010-1234-5678). 해석 못 하면 그대로 */
export function fmtTel(v) {
  const d = String(v || '').replace(/\D/g, ''); if (!d) return '';
  if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return String(v);
}
export const telHref = (v) => { const d = String(v || '').replace(/[^0-9+]/g, ''); return d.length >= 8 ? 'tel:' + d : ''; };
export const mailHref = (v) => (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(v || '')) ? 'mailto:' + v : '');
/** 규정 문서 목록: order 순(없으면 맨 뒤), 같으면 제목 */
export function sortPolicies(list) { return (list || []).slice().sort((a, b) => ((a.order == null ? 999 : a.order) - (b.order == null ? 999 : b.order)) || String(a.title || '').localeCompare(String(b.title || ''), 'ko')); }
