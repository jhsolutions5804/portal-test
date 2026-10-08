import { LEGACY_BASE } from '../../core/config.js?v=20261008a';
import { db, collection, doc, getDoc, getDocs, query, orderBy } from '../../core/firebase.js?v=20261008a';
import { esc } from '../../core/ui.js?v=20261008a';
import { attachActivity } from '../../core/idle.js?v=20261008a';
import { itemsFor, firstKey, resolveItem, buildUrl, navHtml, attendTargets, PJT_TABS } from './list.js?v=20261008a';

const base = () => new URL(LEGACY_BASE, location.href).href;
const states = new Map();   // 모듈 id → { def, wrap, frame, key, tab, me, dyn }  — 작업탭 유지: 떠나도 지우지 않고 숨긴다
let keepRoot = null; let listening = false;

/** 경량 PJT 목록·고정 PJT 종료 여부 — 읽기에 실패하면 고정 메뉴만 보인다 */
async function loadPjtDyn() {
  const dyn = { ended: {}, settings: {}, registry: [], loaded: true };
  for (const k of ['p4ph2', 'p4ph4']) {
    try { const s = await getDoc(doc(db, 'pjt_settings', k)); dyn.ended[k] = s.exists() && s.data().status === 'ended'; dyn.settings[k] = { participants: s.exists() ? (s.data().participants || null) : null }; } catch (e) { /* 권한 없음 — 종료 아님·지정 없음으로 본다 */ }
  }
  try {
    const s = await getDocs(query(collection(db, 'pjt_registry'), orderBy('createdAt', 'asc')));
    s.forEach((d) => { const x = d.data(); if (x.status !== 'ended') dyn.registry.push({ id: d.id, name: x.name || 'PJT', client: x.client || '', content: x.content || '', site: x.site || '', url: x.url || '', participants: x.participants || null }); });
  } catch (e) { /* 권한 없음 */ }
  return dyn;
}
function highlight(st) {
  const q = st.wrap.querySelector('.jh-legacy__quick'); if (q) q.setAttribute('data-show', String(st.key === 'home'));   // 폰 바로가기는 PJT 홈에서만
  st.wrap.querySelectorAll('.jh-legacy__chip').forEach((a) => { if (a.getAttribute('data-key') === st.key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
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
function paintNav(st) {
  const old = st.wrap.querySelector('.jh-legacy__nav'); const html = navHtml(st.def, itemsFor(st.def, st.me, st.dyn), st.key, esc);
  if (old) { old.outerHTML = html || ''; } else if (html) st.wrap.insertAdjacentHTML('afterbegin', html);
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
  if (!fresh && st.wrap && keep.contains(st.wrap)) {   // 이미 열려 있는 모듈 — 보이기만 하고, 칸이 다를 때만 이동
    if (st.key === item.key && (st.tab || '') === tabQ) { highlight(st); canonical(st); return; }
    const was = st.key; st.key = item.key; st.tab = tabQ; highlight(st); canonical(st);
    if (!def.tabbed && was === item.key && !tabQ) return;   // 같은 화면, 탭 값만 사라진 경우는 다시 불러오지 않음
    if (def.tabbed) { try { st.frame.contentWindow.postMessage({ source: 'jh-portal', action: 'goTab', key: item.key }, '*'); } catch (e) { st.frame.src = buildUrl(def, item, me, base(), Date.now()); } }
    else st.frame.src = buildUrl(def, item, me, base(), Date.now(), tabQ);
    return;
  }
  st.key = item.key; st.tab = tabQ;
  const quick = def.dynamicNav ? '<div class="jh-legacy__quick" data-show="' + (item.key === 'home') + '"><button type="button" class="jh-btn" data-variant="primary" data-pjt-pick>👷 출역·공수 체크</button><a class="jh-btn" data-variant="secondary" href="#/calendar/month">📅 일정 확인</a></div>' : '';
  const wrap = document.createElement('div'); wrap.className = 'jh-legacy'; wrap.setAttribute('data-legacy-mod', def.id);
  wrap.innerHTML = quick + navHtml(def, itemsFor(def, me, st.dyn), item.key, esc) + '<iframe class="jh-legacy__frame" title="' + esc(def.title) + '" data-legacy-frame="' + esc(def.id) + '" src="' + esc(buildUrl(def, item, me, base(), Date.now(), tabQ)) + '"></iframe>';
  keep.appendChild(wrap); st.wrap = wrap; st.frame = wrap.querySelector('iframe'); if (st.dyn && st.dyn.loaded) wrap.setAttribute('data-dyn', 'ready'); canonical(st);
  st.frame.addEventListener('load', () => { try { attachActivity(st.frame.contentDocument); } catch (e) { /* 같은 출처가 아니면 센 수 없다 */ } });   // 옛 화면 안에서 일하는 것도 "활동"(자동 로그아웃)
  const pick = wrap.querySelector('[data-pjt-pick]'); if (pick) pick.addEventListener('click', () => openAttendPicker(st));
}
