/* 공용 사이드 내비게이션 — 상세 메뉴를 상단 탭이 아니라 왼쪽 세로 메뉴로 보여 주는 부품(HTML 문자열만 만든다, 화면·네트워크 없음).
 * 인사총무·재무회계가 같이 쓴다. 넓은 화면에서는 왼쪽 세로 메뉴, 좁은 화면(899px 이하)에서는 위쪽 가로 스크롤 메뉴로 바뀐다(스타일은 theme/components.css).
 * cfg: { label(스크린리더용 이름), title(맨 위 제목, 선택), sections: [{ title, items:[{key,label,href,hint?}], clusters:[{label, items:[…]}] }], current(현재 항목 key) }
 * 항목 key 는 메뉴 전체에서 겹치지 않게 둔다. 현재 항목에는 aria-current="page" 를 붙인다. */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const sideItemHtml = (it, current) => '<a class="jh-sidenav__item" href="' + esc(it.href) + '" data-key="' + esc(it.key) + '"' + (it.hint ? ' title="' + esc(it.hint) + '"' : '') + (it.key === current ? ' aria-current="page"' : '') + (it.active ? ' data-active="1"' : '') + '>' + esc(it.label) + '</a>';   // active: 지금 보고 있는 항목의 상위(예: 보는 프로젝트) — 현재 화면 표시(aria-current)와 별개로 연하게 강조
export function sidenavHtml(cfg, extraClass) {
  const c = cfg || {}; const cur = c.current;
  const secs = (c.sections || []).map((s) => '<div class="jh-sidenav__sec">' + (s.title ? '<div class="jh-sidenav__head"' + (s.kind ? ' data-kind="' + esc(s.kind) + '"' : '') + '>' + esc(s.title) + '</div>' : '') + (s.items || []).map((it) => sideItemHtml(it, cur)).join('') + (s.clusters || []).map((cl) => '<div class="jh-sidenav__sub">' + esc(cl.label) + '</div>' + (cl.items || []).map((it) => sideItemHtml(it, cur)).join('')).join('') + '</div>').join('');
  return '<nav class="jh-sidenav' + (extraClass ? ' ' + extraClass : '') + '" aria-label="' + esc(c.label || '메뉴') + '">' + (c.title ? '<div class="jh-sidenav__title">' + esc(c.title) + '</div>' : '') + secs + '</nav>';
}
/** 화면 이동 때 메뉴를 다시 그리지 않고 현재 표시만 옮긴다(긴 메뉴의 스크롤 위치가 유지됨). 바뀐 항목이 있으면 true */
export function setSideCurrent(navEl, key) {
  if (!navEl) return false; let hit = false; navEl.querySelectorAll('.jh-sidenav__item').forEach((a) => { const on = a.getAttribute('data-key') === key; if (on) { a.setAttribute('aria-current', 'page'); hit = true; } else a.removeAttribute('aria-current'); }); return hit;
}
/** 메뉴 항목 key 전체 목록(중복·누락 점검용) */
export const sideKeys = (cfg) => { const out = []; ((cfg || {}).sections || []).forEach((s) => { (s.items || []).forEach((i) => out.push(i.key)); (s.clusters || []).forEach((cl) => (cl.items || []).forEach((i) => out.push(i.key))); }); return out; };
