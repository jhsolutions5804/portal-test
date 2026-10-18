/* 공사일보 팝업(폰 폭) — 대표님 2026-10-19: 폰에서는 달력만 보이고, 날짜를 누르면 그날 공사일보가 팝업으로 뜨고, 닫기를 누르면 다시 달력만 보인다.
 * 넓은 화면(폭 600px 이상)에서는 팝업이 아니라 원래대로 달력 옆(또는 아래)에 일보가 놓이고 이 상태값은 화면에 영향이 없다(스타일의 폭 분기점이 결정).
 * 순수 함수 — 화면·네트워크 없이 시험한다. */

/** 작성 폼이 화면에 떠 있는가 — 작성 전인 날이거나 [수정] 중이고, 미리보기·옛 양식(읽기 전용)이 아닐 때 */
export function formShown(st) {
  return !!st && !st.preview && !!st.form && !st.form.legacy && (!st.exists || st.editing === true);
}

/** 입력 중인 내용이 있는가 — 폼이 떠 있고, 하루를 읽은 직후의 폼(st.snap)과 달라졌을 때만. 기준이 없으면(읽기 전) 입력 중으로 보지 않는다 */
export function isDirty(st) {
  return formShown(st) && typeof st.snap === 'string' && JSON.stringify(st.form) !== st.snap;
}

/** 날짜 칸을 눌렀을 때 — 팝업을 연다(넓은 화면에서는 스타일이 무시하므로 상태만 바뀐다) */
export function openPopup(st) { st.popup = true; }

/** 닫기를 눌렀을 때 */
export function closePopup(st) { st.popup = false; }
