/* 최근 사용 메뉴 — 화면 우측 floating 패널. 일하다가 다른 메뉴로 넘어갔을 때 이전에 보던 화면으로 한 번에 돌아가게 한다.
 * 사용자별로 이 기기(localStorage)에만 저장한다(서버에 올리지 않음). 순수 규칙(pushRecent·timeAgo·labelOf)은 화면 없이 시험한다. */
export const MAX_KEEP = 12;   // 저장은 조금 더 많이(현재 화면이 목록에 끼어 있어도 10개를 채우도록)
export const MAX_SHOW = 10;
/** 기록 목록 맨 앞에 넣는다: 같은 주소는 하나로(맨 앞으로), 이름이 비어 있으면 기존 이름을 유지, 최대 MAX_KEEP 개 */
export function pushRecent(list, entry, now) {
  const hash = String((entry && entry.hash) || ''); if (!/^#\/[^\s]+/.test(hash) || hash === '#/home') return (list || []).slice(0, MAX_KEEP);
  const prev = (list || []).find((x) => x.hash === hash); const label = (entry.label && String(entry.label).trim()) || (prev && prev.label) || hash;
  return [{ hash, label, ts: now || Date.now() }].concat((list || []).filter((x) => x.hash !== hash)).slice(0, MAX_KEEP);
}
/** 이름만 고친다(화면이 다 그려진 뒤 더 정확한 이름을 알았을 때). 순서·시각은 그대로 */
export const relabel = (list, hash, label) => (list || []).map((x) => (x.hash === hash && label ? Object.assign({}, x, { label }) : x));
/** 보여 줄 목록: 지금 보는 화면은 빼고 최근 순 MAX_SHOW 개 */
export const visibleRecent = (list, currentHash) => (list || []).filter((x) => x.hash !== currentHash).slice(0, MAX_SHOW);
/** "방금 / 3분 전 / 2시간 전 / 어제 / 5일 전" */
export function timeAgo(ts, now) {
  const d = Math.max(0, ((now || Date.now()) - ts) / 1000); if (d < 45) return '방금'; if (d < 3600) return Math.round(d / 60) + '분 전'; if (d < 86400) return Math.round(d / 3600) + '시간 전'; if (d < 172800) return '어제'; return Math.floor(d / 86400) + '일 전';
}
/** 메뉴 이름: 모듈 › 프로젝트(있으면) › 현재 메뉴 — 같은 말이 겹치면 한 번만 */
export function labelOf(parts) { const out = []; (parts || []).forEach((p) => { const t = String(p || '').replace(/^📍\s*/, '').trim(); if (t && out[out.length - 1] !== t) out.push(t); }); return out.join(' › '); }
/** 저장된 값을 안전하게 읽는다(깨졌거나 형식이 다르면 빈 목록) */
export function parseStored(raw) { try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a.filter((x) => x && typeof x.hash === 'string' && /^#\//.test(x.hash) && typeof x.label === 'string').slice(0, MAX_KEEP) : []; } catch (e) { return []; } }
const KEY = (uid) => 'jh_recent_v1_' + (uid || 'anon');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const visible = (el) => !!el && el.offsetParent !== null;
/** 지금 화면에서 메뉴 이름을 읽는다: 상단 제목(모듈) + 사이드 내비게이션의 보는 프로젝트 묶음(머리글 data-kind=project)·현재 항목 */
export function describeNow(doc) {
  const d = doc || document; const title = (d.querySelector('#jh-title') || {}).textContent || '';
  const navs = [...d.querySelectorAll('.jh-sidenav')].filter(visible); const nav = navs[0]; let proj = '', cur = '';
  if (nav) { const c = nav.querySelector('[aria-current="page"]'); cur = c ? c.textContent : ''; const heads = [...nav.querySelectorAll('.jh-sidenav__head[data-kind="project"]')]; proj = heads[0] ? heads[0].textContent : ''; }
  return labelOf([title, proj, cur]);
}
/** 셸에 floating 패널을 붙인다. 이미 붙어 있으면 새 사용자로 갈아 끼운다. 반환: { touch(hash, modTitle) } */
export function installRecent(me) {
  const uid = (me && me.uid) || 'anon'; let list = parseStored((() => { try { return localStorage.getItem(KEY(uid)); } catch (e) { return ''; } })());
  const save = () => { try { localStorage.setItem(KEY(uid), JSON.stringify(list)); } catch (e) { /* 저장 공간이 없어도 화면은 동작 */ } };
  let host = document.getElementById('jh-recent'); if (host) host.remove();
  host = document.createElement('div'); host.id = 'jh-recent'; host.className = 'jh-recent'; host.setAttribute('data-open', 'false');
  host.innerHTML = '<button type="button" class="jh-recent__tab" aria-expanded="false" aria-controls="jh-recent-panel" title="최근 사용 메뉴">🕘 최근</button><aside class="jh-recent__panel" id="jh-recent-panel" role="dialog" aria-label="최근 사용 메뉴" hidden></aside>';
  document.body.appendChild(host); const tab = host.querySelector('.jh-recent__tab'); const panel = host.querySelector('.jh-recent__panel');
  const draw = () => { const items = visibleRecent(list, location.hash); panel.innerHTML = '<div class="jh-recent__head"><strong>🕘 최근 사용 메뉴</strong>' + (items.length ? '<button type="button" class="jh-recent__clear" data-recent-clear>비우기</button>' : '') + '</div>' + (items.length ? '<ol class="jh-recent__list">' + items.map((x) => '<li><a href="' + esc(x.hash) + '" data-recent-link><span class="jh-recent__label">' + esc(x.label) + '</span><small>' + esc(timeAgo(x.ts)) + '</small></a></li>').join('') + '</ol>' : '<div class="jh-recent__empty">아직 다른 메뉴 기록이 없습니다. 메뉴를 옮겨 다니면 여기에 쌓입니다.</div>'); };
  const open = (on) => { host.setAttribute('data-open', String(on)); tab.setAttribute('aria-expanded', String(on)); panel.hidden = !on; if (on) draw(); };
  tab.addEventListener('click', () => open(panel.hidden));
  panel.addEventListener('click', (ev) => { if (ev.target.closest('[data-recent-clear]')) { list = list.filter((x) => x.hash === location.hash); save(); draw(); return; } if (ev.target.closest('[data-recent-link]')) open(false); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !panel.hidden) { open(false); tab.focus(); } });
  document.addEventListener('click', (ev) => { if (!panel.hidden && !host.contains(ev.target)) open(false); });
  const timers = [];
  return {
    /** 화면을 옮길 때마다 부른다: 바로 기록하고, 화면이 다 그려진 뒤(여러 번) 더 정확한 이름으로 고친다 */
    touch(hash, modTitle) {
      list = pushRecent(list, { hash, label: modTitle || '' }, Date.now()); save(); timers.forEach(clearTimeout); timers.length = 0;
      [900, 2600, 6000].forEach((ms) => timers.push(setTimeout(() => { if (location.hash !== hash) return; const l = describeNow(document); if (l) { list = relabel(list, hash, l); save(); if (!panel.hidden) draw(); } }, ms)));
      if (!panel.hidden) draw();
    }
  };
}
