import { widgetsFor } from './registry.js?v=20261008i';
import { esc } from './ui.js?v=20261008i';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
/** 플랫폼 홈 — 모듈이 등록한 위젯을 순서대로 모아 보여 준다(모듈이 늘어도 이 파일은 그대로) */
export function mountPlatformHome(root, ctx) {
  const { me } = ctx; const now = new Date();
  root.onclick = null; root.onchange = null; root.oninput = null;
  root.innerHTML = '<div class="jh-dashboard"><header class="jh-form__head"><h2 class="jh-form__title">안녕하세요, ' + esc(me.name || '') + '님</h2>' +
    '<p class="jh-form__sub">' + now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + WD[now.getDay()] + '요일</p></header>' +
    '<div class="jh-dashboard__grid" data-widgets></div></div>';
  const grid = root.querySelector('[data-widgets]'); const ws = widgetsFor(me);
  if (!ws.length) { grid.innerHTML = '<div class="jh-empty">표시할 항목이 없습니다.</div>'; return; }
  ws.forEach((w) => {
    const slot = document.createElement('div'); slot.className = 'jh-widget'; slot.setAttribute('data-widget', w.module + '/' + w.id); if (w.wide) slot.setAttribute('data-wide', 'true'); if (w.reserve) slot.setAttribute('data-reserve', w.reserve); if (w.mobileOrder != null) slot.style.setProperty('--m-order', String(w.mobileOrder)); if (w.mobileHide) slot.setAttribute('data-mobile-hide', 'true'); grid.appendChild(slot);   // data-reserve: 불러오기 전에 자리를 잡아 둔다 · --m-order: 폰에서만 보이는 순서(CSS order)
    try { const p = w.mount(slot, ctx); if (p && p.catch) p.catch((e) => fail(slot, e)); } catch (e) { fail(slot, e); }   // 위젯 하나가 실패해도 홈 전체는 보인다
  });
}
function fail(slot, e) { console.error('위젯 오류', e); slot.innerHTML = '<div class="jh-panel jh-card"><div class="jh-form"><div class="jh-alert" data-tone="danger" role="alert">이 항목을 불러오지 못했습니다.</div></div></div>'; }
