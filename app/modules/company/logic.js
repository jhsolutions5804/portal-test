/* 회사 영역(조직도·규정)의 순수 규칙 — 화면·네트워크 없이 시험한다. 조직 구조·직원 정렬 규칙은 shared/org.js */
export * from '../../shared/org.js?v=20261008j';
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

/* ── 조직도 다이어그램: 대표 → 본부 → 팀 → 사람 ── */
