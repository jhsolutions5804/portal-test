/* 직원 목록 정렬 기준 — 사번순(2026-11-04 대표님 「직원 배치는 무조건 사번 순으로」).
 * 사번(empNo)은 문자열 그대로 비교한다(본섭 사번은 5자리 0 채움이라 문자열 순서가 곧 사번 순서 — 급여대장과 같은 방식).
 * 사번이 없는 사람은 맨 뒤, 같은 사번이면 이름순. 원본 배열은 바꾸지 않는다. 직원을 고르는 목록·표를 새로 만들 때는 이 함수를 쓴다. */
export const empNoOf = (w) => String((w && w.empNo) == null ? '' : w.empNo).trim();
export function sortByEmpNo(list) {
  return (list || []).slice().sort((a, b) => {
    const ea = empNoOf(a), eb = empNoOf(b);
    if (!ea !== !eb) return ea ? -1 : 1;
    if (ea !== eb) return ea < eb ? -1 : 1;
    return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'ko');
  });
}
