/* 24시간 시각 입력 — 루트 time24.js(옛 화면 공용)를 새 플랫폼에서도 한 번 불러온다.
 * 이유: <input type="time"> 은 오전/오후(12시간제)로 보일 수 있고 코드로 바꿀 수 없다. time24.js 는 모든 time 입력칸을 24시간(HH:MM) 입력칸으로 바꾸고,
 * 이후 그려지는 칸도 자동으로 바꾼다. 값(.value)은 항상 'HH:MM' 이라 기존 코드는 그대로 동작한다. 못 불러와도 화면은 그대로(기본 time 입력). */
let loaded = false;
export function ensureTime24() {
  if (loaded || typeof document === 'undefined') return; loaded = true;
  const s = document.createElement('script'); s.src = new URL('../../time24.js', import.meta.url).href; s.async = true; s.onerror = () => { loaded = false; console.warn('time24.js 를 불러오지 못했습니다(기본 시각 입력 사용)'); };
  document.head.appendChild(s);
}
