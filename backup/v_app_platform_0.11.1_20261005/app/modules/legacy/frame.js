import { LEGACY_BASE } from '../../core/config.js?v=20261005c';
import { db, collection, doc, getDoc, getDocs, query, orderBy } from '../../core/firebase.js?v=20261005c';
import { esc } from '../../core/ui.js?v=20261005c';
import { itemsFor, firstKey, resolveItem, buildUrl, navHtml } from './list.js?v=20261005c';

const base = () => new URL(LEGACY_BASE, location.href).href;
let state = null;            // 지금 화면에 올라간 옛 모듈 { def, root, frame, key, me, dyn }
let listening = false;

/** 경량 PJT 목록·고정 PJT 종료 여부 — 읽기에 실패하면 고정 메뉴만 보인다 */
async function loadPjtDyn() {
  const dyn = { ended: {}, registry: [] };
  for (const k of ['p4ph2', 'p4ph4']) {
    try { const s = await getDoc(doc(db, 'pjt_settings', k)); dyn.ended[k] = s.exists() && s.data().status === 'ended'; } catch (e) { /* 권한 없음 — 종료 아님으로 본다 */ }
  }
  try {
    const s = await getDocs(query(collection(db, 'pjt_registry'), orderBy('createdAt', 'asc')));
    s.forEach((d) => { const x = d.data(); if (x.status !== 'ended') dyn.registry.push({ id: d.id, name: x.name || 'PJT', client: x.client || '', content: x.content || '', site: x.site || '', url: x.url || '' }); });
  } catch (e) { /* 권한 없음 */ }
  return dyn;
}
function highlight() {
  if (!state) return;
  state.root.querySelectorAll('.jh-legacy__chip').forEach((a) => { if (a.getAttribute('data-key') === state.key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
function listen() {
  if (listening) return; listening = true;
  window.addEventListener('message', (e) => {
    const d = e.data; if (!state || !d || d.source !== 'jh-embed' || e.source !== state.frame.contentWindow) return;
    if (d.action === 'navigate') {   // 옛 페이지가 "다른 화면으로 이동"을 요청(예: PJT 홈의 프로젝트 카드) — 허용된 형식의 플랫폼 주소만 따른다
      if (typeof d.hash === 'string' && /^#\/[a-z0-9_]+(\/[A-Za-z0-9_%.\-]+)*$/.test(d.hash)) location.hash = d.hash;
      return;
    }
    if (d.action === 'openNewTab') { window.open(buildUrl(state.def, resolveItem(state.def, d.key, state.me, state.dyn), state.me, base(), Date.now()), '_blank', 'noopener'); return; }
    if (d.key && state.def.tabbed && d.key !== state.key) {   // 옛 모듈 안에서 탭을 옮김 → 주소·강조만 맞춘다(다시 불러오지 않음)
      state.key = d.key; highlight(); history.replaceState(history.state, '', '#/' + state.def.id + '/' + d.key);
    }
  });
}
function paintNav() {
  const old = state.root.querySelector('.jh-legacy__nav'); const html = navHtml(state.def, itemsFor(state.def, state.me, state.dyn), state.key, esc);
  if (old) { old.outerHTML = html || ''; } else if (html) state.root.querySelector('.jh-legacy').insertAdjacentHTML('afterbegin', html);
}

export async function mountLegacy(def, root, route, ctx) {
  const me = ctx.me; listen();
  const same = state && state.def.id === def.id && state.root === root && root.contains(state.frame);
  if (!same) state = { def, root, frame: null, key: null, me, dyn: null };
  const want = route.segs[0];
  if (def.dynamicNav && !state.dyn) {
    state.dyn = { ended: {}, registry: [] };   // 먼저 고정 메뉴로 그리고, 목록은 불러오는 대로 채운다
    loadPjtDyn().then((dyn) => { if (state && state.def.id === def.id) { state.dyn = dyn; paintNav(); } });
  }
  const item = resolveItem(def, want, me, state.dyn) || resolveItem(def, firstKey(def, me, state.dyn), me, state.dyn);
  if (!item) { root.innerHTML = '<div class="jh-card"><div class="jh-empty">열 수 있는 화면이 없습니다.</div></div>'; return; }
  if (same) {   // 같은 모듈 안에서 세부 메뉴만 바뀜
    if (state.key === item.key) { highlight(); return; }
    state.key = item.key; highlight();
    if (def.tabbed) { try { state.frame.contentWindow.postMessage({ source: 'jh-portal', action: 'goTab', key: item.key }, '*'); } catch (e) { state.frame.src = buildUrl(def, item, me, base(), Date.now()); } }
    else state.frame.src = buildUrl(def, item, me, base(), Date.now());
    return;
  }
  state.key = item.key; root.className = 'jh-main jh-main--legacy';
  const app = root.closest('.jh-app'); if (app) app.setAttribute('data-legacy', '1');   // 폰: 하단 막대 높이에 맞춰 여백을 줄인다(boot.js 가 다른 모듈로 가면 지움)
  root.innerHTML = '<div class="jh-legacy">' + navHtml(def, itemsFor(def, me, state.dyn), item.key, esc) +
    '<iframe class="jh-legacy__frame" title="' + esc(def.title) + '" data-legacy-frame="' + esc(def.id) + '" src="' + esc(buildUrl(def, item, me, base(), Date.now())) + '"></iframe></div>';
  state.frame = root.querySelector('iframe');
}
