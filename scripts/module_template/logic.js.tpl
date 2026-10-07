/* __TITLE__ 의 순수 규칙 — 화면·네트워크 없이 시험할 수 있게 계산은 여기에 모은다(tests/__ID__.test.mjs 가 이 파일을 시험한다) */

/** 예시: 목록을 한 줄 요약으로. 실제 규칙으로 바꾸세요. */
export function sampleSummary(items) {
  const n = (items || []).length;
  return n ? '항목 ' + n + '건' : '항목이 없습니다.';
}
