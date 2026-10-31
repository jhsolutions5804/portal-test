import { LEGACY_BASE } from '../../core/config.js?v=20261031h';
import { db, collection, doc, getDoc, getDocs, query, orderBy } from '../../core/firebase.js?v=20261031h';
import { esc } from '../../core/ui.js?v=20261031h';
import { attachActivity } from '../../core/idle.js?v=20261031h';
import { itemsFor, firstKey, resolveItem, buildUrl, navHtml, attendTargets, PJT_TABS, sideCurrentKey, isProjectKey, PJT_SUB_LABELS, nativeViewKey } from './list.js?v=20261031h';
import { workTabs } from '../../core/worktabs.js?v=20261031h';
import { setSideCurrent } from '../../shared/sidenav.js?v=20261031h';

const base = () => new URL(LEGACY_BASE, location.href).href;
const NATIVE = new Map();   // '모듈id/구역' → 그 구역을 새 모듈이 그리는 함수(modules/index.js 가 hostNative 로 등록)
export const hostNative = (defId, key, fn) => { NATIVE.set(defId + '/' + key, fn); };
const isNativeKey = (def, key) => !!((def.sections && def.sections.some((s) => s.native && s.key === key)) || (def.nativeKeys && def.nativeKeys.indexOf(key) !== -1));   // 인사·영업기획은 sections 가 새 화면. PJT 는 프로젝트 아래의 탭(nativeSubs, 예: #/pjt/p4ph2/attend)이 새 화면
const states = new Map();   // 모듈 id → { def, wrap, frame, key, tab, me, dyn }  — 작업탭 유지: 떠나도 지우지 않고 숨긴다
let keepRoot = null; let listening = false;

/** 프로젝트 목록(종료되지 않은 것, 등록 순) — 모든 프로젝트가 pjt_registry 문서 하나씩이다. 읽기에 실패하면 프로젝트 칩 없이 PJT 홈·종료 PJT 만 보인다 */
async function loadPjtDyn() {
  const dyn = { registry: [], loaded: true };
  try {
    const s = await getDocs(query(collection(db, 'pjt_registry'), orderBy('createdAt', 'asc')));
    s.forEach((d) => { const x = d.data(); if (x.status !== 'ended') dyn.registry.push({ id: d.id, name: x.name || 'PJT', client: x.client || '', content: x.content || '', site: x.site || '', participants: x.participants || null }); });
  } catch (e) { /* 권한 없음 */ }
  return dyn;
}
/** 프로젝트가 바뀌었다는 알림('jh:pjt-changed')을 받으면 칩을 다시 읽는다 — 알린 쪽이 칩이 바뀐 뒤에 이동하도록 읽기가 끝날 때까지의 약속(detail.waits)을 넘겨받는다 */
/** 회사: 규정 문서 목록을 읽으면(회사 화면이 알려 준다) 사이드바의 "규정" 묶음을 문서마다 한 항목으로 다시 그린다 */
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('jh:company-policies', (ev) => { const st = states.get('company'); if (!st || !st.def) return; const list = (ev.detail && ev.detail.policies) || []; if (JSON.stringify(list) === JSON.stringify((st.dyn && st.dyn.policies) || [])) return; st.dyn = { policies: list, loaded: true }; if (st.wrap) paintNav(st); });
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('jh:pjt-changed', (ev) => { const st = states.get('pjt'); if (!st || !st.def || !st.def.dynamicNav) return; const p = loadPjtDyn().then((dyn) => { if (states.get('pjt') === st) { st.dyn = dyn; if (st.wrap) paintNav(st); } }); if (ev && ev.detail && Array.isArray(ev.detail.waits)) ev.detail.waits.push(p); });
function highlight(st) {
  const q = st.wrap.querySelector('.jh-legacy__quick'); if (q) q.setAttribute('data-show', String(st.key === 'home'));   // 폰 바로가기는 PJT 홈에서만
  if (st.def.dynamicNav) { st.wrap.setAttribute('data-side', ''); paintNav(st); const cu = st.wrap.querySelector('.jh-legacy__nav [aria-current="page"]'); if (cu && cu.scrollIntoView) cu.scrollIntoView({ block: 'nearest', inline: 'center' }); }   // PJT 관리: 사이드 내비게이션 — 프로젝트·화면에 따라 내용이 달라져 현재 상태로 다시 그린다
  else if (st.def.groups) { st.wrap.setAttribute('data-side', ''); const nv = st.wrap.querySelector('.jh-legacy__nav'); setSideCurrent(nv, sideCurrentKey(st.def, st.key, st.sub)); const cu = nv && nv.querySelector('[aria-current="page"]'); if (cu && cu.scrollIntoView) cu.scrollIntoView({ block: 'nearest', inline: 'center' }); }   // 인사총무: 왼쪽 사이드바 — 다시 그리지 않고 현재 표시만 옮겨 긴 메뉴의 스크롤 위치를 유지
  else st.wrap.querySelectorAll('.jh-legacy__chip').forEach((a) => { const cur = a.hasAttribute('data-home') ? !isNativeKey(st.def, st.key) : a.getAttribute('data-key') === st.key; if (cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (st.native && st.frame) { const nat = isNativeKey(st.def, st.key) || !!st.nativeSub; st.native.hidden = !nat; st.frame.hidden = nat; if (st.natives) st.natives.forEach((v) => { if (v.el !== st.native || !nat) v.el.hidden = true; }); }   // 살려 둔 다른 화면 영역은 숨긴다
  paintSubnav(st);
}
const stateOfSource = (src) => { for (const st of states.values()) { if (st.frame && st.frame.contentWindow === src) return st; } return null; };
function listen() {
  if (listening) return; listening = true;
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.source !== 'jh-embed') return; const st = stateOfSource(e.source); if (!st) return;
    if (d.action === 'navigate') {   // 옛 페이지가 "다른 화면으로 이동"을 요청(예: PJT 홈의 프로젝트 카드) — 허용된 형식의 플랫폼 주소만 따른다
      if (typeof d.hash === 'string' && /^#\/[a-z0-9_]+(\/[A-Za-z0-9_%.\-]+)*$/.test(d.hash)) location.hash = d.hash;
      return;
    }
    if (d.action === 'openNewTab') { window.open(buildUrl(st.def, resolveItem(st.def, d.key, st.me, st.dyn), st.me, base(), Date.now()), '_blank', 'noopener'); return; }
    if (isNativeKey(st.def, st.key)) return;   // 총무 구역을 보는 중이면 숨은 옛 화면의 알림은 무시
    if (d.key && st.def.tabbed && d.key !== st.key && !st.wrap.hidden) {   // 옛 모듈 안에서 탭을 옮김 → 주소·강조만 맞춘다(다시 불러오지 않음). 숨겨진 화면의 알림은 무시
      st.key = d.key; highlight(st); history.replaceState(history.state, '', '#/' + st.def.id + '/' + d.key);
    } else if (d.key && st.def.tabbed && d.key !== st.key) { st.key = d.key; highlight(st); }
  });
}
/** 폰 PJT 바로가기: 출역·공수 체크할 프로젝트를 골라 그 프로젝트의 근태 탭으로 바로 간다 */
function openAttendPicker(st) {
  const items = attendTargets(st && st.dyn, st && st.me); const wrap = document.createElement('div'); wrap.className = 'jh-sheet'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', '출역·공수 체크할 프로젝트');
  wrap.innerHTML = '<div class="jh-sheet__backdrop" data-sheet-close></div><div class="jh-sheet__panel"><div class="jh-sheet__item" aria-hidden="true"><strong>👷 출역·공수 체크할 프로젝트</strong></div>' +
    (items.length ? items.map((t) => '<a class="jh-sheet__item" href="' + esc(t.hash) + '" data-sheet-link>' + esc(t.label) + '</a>').join('') : '<div class="jh-empty">열 수 있는 프로젝트가 없습니다.</div>') + '</div>';
  const prev = document.body.style.overflow; const close = () => { document.removeEventListener('keydown', onKey, true); wrap.remove(); document.body.style.overflow = prev; };
  function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); close(); } }
  wrap.addEventListener('click', (ev) => { if (ev.target.closest('[data-sheet-close]') || ev.target.closest('[data-sheet-link]')) close(); });
  document.body.appendChild(wrap); document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKey, true); const first = wrap.querySelector('a'); if (first) first.focus();
}
/** 프로젝트 아래의 탭 줄: 프로젝트를 고른 뒤 홈·일정·공정·출역·공수·공사일보·설정 중에서 고른다. 프로젝트는 위 메뉴에서 이미 정해져 있어 새 화면 안에서 프로젝트를 다시 고르지 않는다(팀장이 다른 프로젝트에 입력하는 실수 방지) */
const subnavHtml = (st) => {
  if (st.def.dynamicNav) return '';   // 프로젝트 아래 화면은 사이드 내비게이션에 함께 나온다(칩 줄 없음)
  if (!st.def.nativeSubs || !isProjectKey(st.key)) return ''; const k = encodeURIComponent(st.key);
  const subs = st.def.nativeSubs.filter((s) => s !== 'settings' || (st.me && st.me.admin)).map((s) => '<a class="jh-legacy__chip" href="#/pjt/' + k + '/' + s + '" data-sub="' + s + '"' + (st.nativeSub && st.sub === s ? ' aria-current="page"' : '') + '>' + (PJT_SUB_LABELS[s] || s) + '</a>').join('');
  return '<nav class="jh-legacy__subnav" aria-label="프로젝트 화면">' + subs + '</nav>';
};
function paintSubnav(st) {
  if (!st.wrap) return; const old = st.wrap.querySelector('.jh-legacy__subnav'); const html = subnavHtml(st);
  if (old) { if (html) old.outerHTML = html; else old.remove(); } else if (html) { const nv = st.wrap.querySelector('.jh-legacy__nav'); if (nv) nv.insertAdjacentHTML('afterend', html); else st.wrap.insertAdjacentHTML('afterbegin', html); }
}
function paintNav(st) {
  const old = st.wrap.querySelector('.jh-legacy__nav'); const html = navHtml(st.def, itemsFor(st.def, st.me, st.dyn), st.key, esc, st.sub, st.me, st.dyn);
  if (old) { old.outerHTML = html || ''; } else if (html) st.wrap.insertAdjacentHTML('afterbegin', html);
  paintSubnav(st);
}
const canonical = (st) => { const h = '#/' + st.def.id + '/' + st.key + (st.tab ? '?tab=' + st.tab : ''); if (location.hash !== h) history.replaceState(history.state, '', h); };

/** 옛 모듈을 플랫폼 틀 안에 연다. 모듈마다 틀(wrap)을 하나씩 만들어 keep 층에 두고, 다른 화면으로 가면 숨기기만 한다 — 입력 중이던 내용·열려 있던 탭이 그대로 남는다. */
export async function mountLegacy(def, keep, route, ctx) {
  const me = ctx.me; listen();
  if (keepRoot !== keep) { states.clear(); keepRoot = keep; }   // 셸이 다시 그려졌다(다른 사용자·재로그인) — 옛 틀은 이미 사라졌다
  states.forEach((s) => { s.wrap.hidden = (s.def.id !== def.id); });
  let st = states.get(def.id); const want = route.segs[0]; const tabQ = route.query && PJT_TABS.indexOf(route.query.tab) !== -1 ? route.query.tab : '';
  const fresh = !st; if (!st) { st = { def, wrap: null, frame: null, key: null, tab: '', me, dyn: null }; states.set(def.id, st); }
  if (def.dynamicNav && !st.dyn) {
    st.dyn = { ended: {}, settings: {}, registry: [], loaded: false };   // 프로젝트 정보를 읽는 동안은 프로젝트 칩을 숨기고(참여자 지정 확인 전), 읽은 뒤에 채운다
    loadPjtDyn().then((dyn) => { if (states.get(def.id) === st) { st.dyn = dyn; if (st.wrap) { paintNav(st); st.wrap.setAttribute('data-dyn', 'ready'); } } });   // data-dyn=ready: 프로젝트 정보(참여자 지정 포함)를 읽어 칩을 다 그렸다는 표시(시험이 기다리는 기준)
  }
  // 주소에 칸이 없으면(#/hr) 마지막으로 보던 칸을 그대로 이어서 보여 준다 — 사이드바·하단 메뉴로 돌아왔을 때 보던 자리
  const item = (want ? resolveItem(def, want, me, st.dyn) : null) || (!want && st.key ? resolveItem(def, st.key, me, st.dyn) : null) || resolveItem(def, firstKey(def, me, st.dyn), me, st.dyn);
  if (!item) { keep.insertAdjacentHTML('beforeend', '<div class="jh-card"><div class="jh-empty">열 수 있는 화면이 없습니다.</div></div>'); return; }
  st.me = me;   // 프로젝트 아래 탭 중 설정은 관리자에게만 보인다
  const rawSub = (route.segs || [])[1] || ''; const sub = isProjectKey(item.key) && def.nativeSubs && def.nativeSubs.indexOf(rawSub) === -1 ? def.defaultSub : rawSub; const nativeSub = !!(def.nativeSubs && def.nativeSubs.indexOf(sub) !== -1 && isProjectKey(item.key));   // 프로젝트 아래의 새 화면 탭(#/pjt/<프로젝트>/attend) — 탭 이름이 없거나 모르는 값이면 프로젝트 홈
  const nat = isNativeKey(def, item.key) || nativeSub;
  if (nat) {   // 새 모듈이 그리는 구역(총무) — 옛 화면 틀(칩 메뉴)은 그대로 두고 안쪽만 바꾼다. 옛 화면(iframe)은 숨겨서 살려 둔다
    if (fresh || !st.wrap || !keep.contains(st.wrap)) {
      const w = document.createElement('div'); w.className = 'jh-legacy'; w.setAttribute('data-legacy-mod', def.id); if (def.groups || def.dynamicNav) w.setAttribute('data-side', '');
      w.innerHTML = navHtml(def, itemsFor(def, me, st.dyn), item.key, esc, (route.segs || [])[1] || '', me, st.dyn) + '<iframe class="jh-legacy__frame" title="' + esc(def.title) + '" data-legacy-frame="' + esc(def.id) + '" data-lazy="1" hidden></iframe><div class="jh-legacy__native"></div>';
      keep.appendChild(w); st.wrap = w; st.frame = w.querySelector('iframe'); st.native = w.querySelector('.jh-legacy__native'); st.natives = null; st.native0 = null; st.nv = null;
      st.frame.addEventListener('load', () => { try { attachActivity(st.frame.contentDocument); } catch (e) { /* 같은 출처가 아니면 센 수 없다 */ } });
    }
    if (!st.native && st.wrap) { const nd = document.createElement('div'); nd.className = 'jh-legacy__native'; st.wrap.appendChild(nd); st.native = nd; if (!st.frame) st.frame = st.wrap.querySelector('iframe'); }   // 옛 화면으로 먼저 열린 틀에는 새 화면 자리가 없다 — 만든다
    // 화면별 영역 살리기(데스크톱): 다른 메뉴에 다녀와도 입력 중이던 내용·스크롤이 그대로 — 같은 화면·같은 주소로 돌아오면 다시 그리지 않는다. 폰은 지금까지처럼 매번 새로 그린다
    let nv = null; const keepViews = !!(window.matchMedia && window.matchMedia('(min-width: 900px)').matches);
    if (keepViews) {
      if (st.nv && st.nv.el) st.nv.scroll = st.nv.el.scrollTop;   // 떠나는 화면의 스크롤 위치
      st.natives = st.natives || new Map(); if (!st.native0) st.native0 = st.native; const nk = nativeViewKey(def.id, item.key, nativeSub ? sub : '', (route.segs || [])[1] || '');
      nv = st.natives.get(nk);
      if (!nv) { let el = st.natives.size === 0 ? st.native0 : null; if (!el) { el = document.createElement('div'); el.className = 'jh-legacy__native'; st.wrap.appendChild(el); } nv = { el, key: nk, hash: null, scroll: 0, route: null }; st.natives.set(nk, nv); }
      st.native = nv.el; st.nv = nv;
    }
    st.key = item.key; st.tab = ''; st.sub = sub; st.nativeSub = nativeSub; highlight(st); const fn = NATIVE.get(def.id + '/' + (nativeSub ? sub : item.key));
    if (nv) {
      // 실제로 열리는 화면(메뉴·하위 화면·나머지 값·쿼리)으로 같은 화면인지 본다 — 사이드바로 돌아오면 주소가 '#/plan' 처럼 화면 이름 없이 올 수 있다
      const restSegs = (route.segs || []).slice(nativeSub ? 2 : 1); const qs = route.query && Object.keys(route.query).length ? '?' + new URLSearchParams(route.query).toString() : '';
      const full = '#/' + def.id + '/' + (nativeSub ? [item.key, sub] : [item.key]).concat(restSegs).map((x) => encodeURIComponent(x)).join('/') + qs;
      if (typeof location !== 'undefined' && location.hash.indexOf('#/' + def.id) === 0 && location.hash !== full) { try { history.replaceState(history.state, '', full); } catch (e) { /* 주소 표시만 못 고친다 */ } }   // 주소창도 실제 화면을 가리키게
      nv.el.hidden = false; st.natives.forEach((v) => { if (v !== nv) v.el.hidden = true; });
      workTabs.note({ key: nv.key, hash: full, label: def.title, mod: def.id }, {
        drop: () => { const cur = st.nv === nv; if (nv.el.parentNode) { if (nv.el === st.native0) { nv.el.innerHTML = ''; nv.el.hidden = true; } else nv.el.remove(); } st.natives.delete(nv.key); if (cur) st.nv = null; },   // 첫 영역은 비워 두고 나머지는 지운다
        reload: () => { nv.hash = null; if (workTabs.currentKey() === nv.key && nv.route) mountLegacy(def, keep, nv.route, ctx); }   // 처음 상태로 다시 불러오기(보는 중이면 지금, 아니면 다음에 열 때)
      });
      if (nv.hash === full) { nv.el.scrollTop = nv.scroll || 0; return; }   // 같은 화면·같은 주소: 그대로 보여 준다
      nv.hash = full; nv.route = route;
    }
    if (fn) await fn(st.native, { segs: nativeSub ? [item.key].concat((route.segs || []).slice(2)) : (route.segs || []).slice(1), query: route.query || {} }, ctx); return;
  }
  st.nativeSub = false; workTabs.leave();   // 옛 화면(iframe)은 작업 탭이 아니다(iframe 자체가 살아 있다)
  if (!fresh && st.wrap && keep.contains(st.wrap)) {   // 이미 열려 있는 모듈 — 보이기만 하고, 칸이 다를 때만 이동
    if (st.native && st.frame) { st.native.hidden = true; st.frame.hidden = false; }   // 총무에서 인사로 돌아옴
    if (st.frame && st.frame.hasAttribute('data-lazy')) { st.frame.removeAttribute('data-lazy'); st.key = item.key; st.tab = tabQ; highlight(st); canonical(st); st.frame.src = buildUrl(def, item, me, base(), Date.now(), tabQ); return; }   // 새 화면으로 먼저 열려 옛 화면을 아직 안 불러온 틀 — 이제 불러온다
    if (st.key === item.key && (st.tab || '') === tabQ) { highlight(st); canonical(st); return; }
    const was = st.key; st.key = item.key; st.tab = tabQ; highlight(st); canonical(st);
    if (st.frame.hasAttribute('data-lazy')) { st.frame.removeAttribute('data-lazy'); st.frame.src = buildUrl(def, item, me, base(), Date.now(), tabQ); return; }   // 옛 화면은 처음 열 때 비로소 불러온다(새 화면만 쓰는 동안은 옛 인사 화면과 그 자동 동기화가 돌지 않는다)
    if (!def.tabbed && was === item.key && !tabQ) return;   // 같은 화면, 탭 값만 사라진 경우는 다시 불러오지 않음
    if (def.tabbed) { try { st.frame.contentWindow.postMessage({ source: 'jh-portal', action: 'goTab', key: item.key }, '*'); } catch (e) { st.frame.src = buildUrl(def, item, me, base(), Date.now()); } }
    else st.frame.src = buildUrl(def, item, me, base(), Date.now(), tabQ);
    return;
  }
  st.key = item.key; st.tab = tabQ;
  const quick = def.dynamicNav ? '<div class="jh-legacy__quick" data-show="' + (item.key === 'home') + '"><button type="button" class="jh-btn" data-variant="primary" data-pjt-pick>👷 출역·공수 체크</button><a class="jh-btn" data-variant="secondary" href="#/calendar/month">📅 일정 확인</a></div>' : '';
  const wrap = document.createElement('div'); wrap.className = 'jh-legacy'; wrap.setAttribute('data-legacy-mod', def.id);
  wrap.innerHTML = quick + navHtml(def, itemsFor(def, me, st.dyn), item.key, esc, '', me) + '<iframe class="jh-legacy__frame" title="' + esc(def.title) + '" data-legacy-frame="' + esc(def.id) + '" src="' + esc(buildUrl(def, item, me, base(), Date.now(), tabQ)) + '"></iframe>' + (def.sections || def.nativeKeys ? '<div class="jh-legacy__native" hidden></div>' : '');
  keep.appendChild(wrap); st.wrap = wrap; st.frame = wrap.querySelector('iframe'); st.native = wrap.querySelector('.jh-legacy__native'); if (st.dyn && st.dyn.loaded) wrap.setAttribute('data-dyn', 'ready'); if (def.groups || def.dynamicNav) wrap.setAttribute('data-side', ''); canonical(st); paintSubnav(st);
  st.frame.addEventListener('load', () => { try { attachActivity(st.frame.contentDocument); } catch (e) { /* 같은 출처가 아니면 센 수 없다 */ } });   // 옛 화면 안에서 일하는 것도 "활동"(자동 로그아웃)
  const pick = wrap.querySelector('[data-pjt-pick]'); if (pick) pick.addEventListener('click', () => openAttendPicker(st));
}
