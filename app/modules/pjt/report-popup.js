/* 공사일보 팝업(폰 폭) — 대표님 2026-10-19: 폰에서는 달력만 보이고, 날짜를 누르면 그날 공사일보가 팝업으로 뜨고, 닫기를 누르면 다시 달력만 보인다.
 * 넓은 화면(폭 600px 이상)에서는 팝업이 아니라 원래대로 달력 옆(또는 아래)에 일보가 놓이고 이 상태값은 화면에 영향이 없다(스타일의 폭 분기점이 결정).
 * 순수 함수 — 화면·네트워크 없이 시험한다. */

/** 작성 폼이 화면에 떠 있는가 — 작성 전인 날이거나 [수정] 중이고, 미리보기·옛 양식(읽기 전용)이 아닐 때 */
export function formShown(st) {
  return !!st && !st.preview && !!st.form && !st.form.legacy && (!st.exists || st.editing === true);
}

/** 입력 중인 내용이 있는가 — 폼이 떠 있고, 하루를 읽은 직후의 폼(st.snap)과 달라졌을 때만. 기준이 없으면(읽기 전) 입력 중으로 보지 않는다 */
export function isDirty(st) {
  return formShown(st) && typeof st.snap === 'string' && stable(st.form) !== stable(JSON.parse(st.snap));
}
/** 비교용 문자열 — 앞에 _ 가 붙은 키는 컨트롤러 readForm 이 시·분 칸을 읽을 때 덧붙이는 임시값(_ciH·_ciM·_coH·_coM)이지 입력한 내용이 아니라서 뺀다.
 *  이걸 안 빼면 폼을 열기만 해도 "바뀌었다"로 판정돼 닫을 때마다 확인창이 뜬다(2026-10-19 실제 앱에서 확인). 키 순서가 달라도 같은 값이면 같게 본다 */
/** 입력값이 아니라 다른 입력에서 다시 계산되는 파생값 — readForm 이 읽을 때마다 shift 를 비우고(f.shift = '') 저장할 때 출·퇴근 시각에서 구분을 만든다. 비교에서 뺀다(안 빼면 출·퇴근 시각이 있는 일보는 폼을 열기만 해도 "바뀐 것"으로 보인다) */
const DERIVED = ['shift'];
function stable(f) {
  const o = {}; Object.keys(f || {}).filter((k) => k.charAt(0) !== '_' && DERIVED.indexOf(k) === -1).sort().forEach((k) => { o[k] = f[k]; });
  return JSON.stringify(o);
}

/** 날짜 칸을 눌렀을 때 — 팝업을 연다(넓은 화면에서는 스타일이 무시하므로 상태만 바뀐다) */
export function openPopup(st) { st.popup = true; }

/** 닫기를 눌렀을 때 */
export function closePopup(st) { st.popup = false; }

/** 뒤로 가기 처리 — 폰에서 팝업이 열린 채 뒤로 가기를 누르면 이전 화면(프로젝트 홈)이 아니라 팝업만 닫는다(대표님 2026-10-19 폰 확인).
 *  이 화면의 pushHash 는 history.replaceState 라 날짜를 눌러도 기록이 쌓이지 않아, 그대로면 뒤로 가기가 공사일보 탭을 건너뛰고 프로젝트 홈으로 간다.
 *  그래서 폰 폭에서 팝업을 열 때 같은 주소로 기록을 한 단계 쌓고, 뒤로 가기(popstate)가 오면 팝업만 닫는다. 쌓은 기록은 같은 주소라서 라우터(core/router.js)가 주소가 같다고 보고 무시한다.
 *  넓은 화면은 팝업이 아니므로 기록을 쌓지 않는다(데스크톱 동작 그대로).
 *  hooks = { narrow(): 지금 폰 폭인가, close(): 확인 없이 닫고 다시 그리기, requestClose(cancel): 입력 중이면 확인창을 띄워 닫거나, 취소되면 cancel() 호출 } */
export function createPopupHistory(win, hooks) {
  const MARK = { jhRpPopup: 1 };
  let active = false, skip = false;
  const push = () => { win.history.pushState(MARK, '', win.location.href); active = true; };
  const onPop = () => {
    if (!active) return;                       // 팝업이 열려 있지 않을 때의 뒤로·앞으로 가기는 라우터에 맡긴다
    active = false;
    if (skip) { skip = false; hooks.close(); return; }          // 닫기 버튼이 되돌린 것 — 이미 확인했으므로 바로 닫는다
    hooks.requestClose(() => push());          // 뒤로 가기 — 입력 중이면 확인, 취소하면 기록을 다시 쌓아 팝업 유지
  };
  return {
    attach() { win.addEventListener('popstate', onPop); },
    detach() { win.removeEventListener('popstate', onPop); active = false; skip = false; },
    isActive() { return active; },
    open() { if (active || !hooks.narrow()) return; push(); },
    /** 닫기 버튼 — 쌓아 둔 기록이 있으면 한 단계 되돌리고(true, 닫기는 popstate 가 처리) 없으면 false(직접 닫는다) */
    closeByButton() { if (!active) return false; skip = true; win.history.back(); return true; }
  };
}
