/* 작업 탭 — 하단 탭 바. 작업하던 화면을 살려 두고(다른 메뉴에 다녀와도 입력 중이던 내용·스크롤이 그대로), 탭으로 한 번에 돌아간다.
 * 화면을 실제로 살려 두는 것은 셸(본문별 요소)과 옛 모듈 틀(frame.js)이 하고, 여기는 "무엇이 열려 있는가"를 기록하고 탭 바를 그린다.
 * 순수 규칙(noteTab·overflowKeys·nextAfterClose·relabelTab)은 화면 없이 시험한다. */
export const MAX_TABS = 8;
const valid = (e) => !!e && typeof e.key === 'string' && e.key && /^#\//.test(String(e.hash || ''));
/** 탭 기록: 같은 key 는 하나로(맨 앞으로, 주소·시각 갱신), 이름이 비어 오면 기존 이름 유지 */
export function noteTab(list, entry, now) {
  if (!valid(entry)) return (list || []).slice(); const prev = (list || []).find((x) => x.key === entry.key); const label = (entry.label && String(entry.label).trim()) || (prev && prev.label) || entry.key;
  return [{ key: entry.key, hash: entry.hash, label, mod: entry.mod || (prev && prev.mod) || '', ts: now || Date.now() }].concat((list || []).filter((x) => x.key !== entry.key));
}
/** 최대 개수를 넘으면 닫을 탭(현재 탭은 빼고 가장 오래 안 쓴 것부터) */
export function overflowKeys(list, current, max) {
  const m = max || MAX_TABS; const extra = (list || []).length - m; if (extra <= 0) return [];
  return (list || []).filter((x) => x.key !== current).sort((a, b) => a.ts - b.ts).slice(0, extra).map((x) => x.key);
}
export const dropTab = (list, key) => (list || []).filter((x) => x.key !== key);
/** 현재 탭을 닫았을 때 이어서 열 탭: 가장 최근에 쓴 다른 탭(없으면 null) */
export function nextAfterClose(list, closedKey) { const o = (list || []).filter((x) => x.key !== closedKey).sort((a, b) => b.ts - a.ts); return o[0] || null; }
export const relabelTab = (list, key, label) => (list || []).map((x) => (x.key === key && label ? Object.assign({}, x, { label }) : x));
/** 사이드바에서 모듈을 눌렀을 때 돌아갈 곳: 그 모듈에서 가장 최근에 쓴 탭의 주소. 이미 그 모듈 안에 있으면 null(모듈 홈으로 간다) */
export function resumeHash(list, currentKey, mod) {
  const cur = (list || []).find((x) => x.key === currentKey); if (cur && cur.mod === mod) return null;
  const last = (list || []).filter((x) => x.mod === mod).sort((a, b) => b.ts - a.ts)[0]; return last ? last.hash : null;
}
/** 탭 바를 보여 줄 조건: 탭이 둘 이상일 때(하나뿐이면 군더더기) */
export const showBar = (list) => (list || []).length >= 2;
/** 화면 순서가 흔들리지 않게, 탭 바는 처음 연 순서(키 등장 순)로 그린다 */
export function barOrder(order, list) { const keys = (list || []).map((x) => x.key); const kept = (order || []).filter((k) => keys.indexOf(k) !== -1); keys.forEach((k) => { if (kept.indexOf(k) === -1) kept.push(k); }); return kept; }
/** 탭에 보이는 짧은 이름: 길게 저장된 이름("모듈 › 프로젝트 › 화면")을 줄여 "P4 Ph2 · 공정", "인사 · 출퇴근·초과근로", "결재 · 홈" 처럼 — 전체 이름은 마우스를 올리면(title) 나온다 */
const MOD_SHORT = { 'PJT 관리': 'PJT', '영업기획': '영업', '인사총무': '인사', '재무회계': '재무', '전자결재': '결재', '내 팀 공수표': '팀 공수' };
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
export function shortLabel(label) {
  const parts = String(label || '').split(' › ').map((x) => x.trim()).filter(Boolean); if (!parts.length) return '';
  const mod = parts[0], ms = MOD_SHORT[mod] || cut(mod, 6); if (parts.length === 1) return ms;
  let screen = parts[parts.length - 1]; const proj = parts.length >= 3 ? parts[1] : '';
  [mod, ms].forEach((p) => { if (screen !== p && screen.indexOf(p + ' ') === 0) screen = screen.slice(p.length + 1); });   // "전자결재 홈" → "홈", "인사 홈" → "홈"
  screen = cut(screen.replace(/\s*\(새\)\s*$/, ''), 12);
  if (proj) { const name = cut(proj.replace(/\s*\([^)]*\)\s*/g, ' ').trim().split(/\s+/).slice(0, 2).join(' '), 10); return name + ' · ' + screen; }   // 프로젝트: 괄호 설명을 빼고 앞 두 단어("P4 Ph2 (FAB)" → "P4 Ph2")
  return ms + ' · ' + screen;
}
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 싱글톤: 셸과 옛 모듈 틀이 같은 것을 쓴다. 닫기·새로고침은 등록한 쪽(화면을 살려 둔 쪽)이 처리한다 */
function create() {
  let list = [], order = [], current = '', host = null; const handlers = new Map(); let opts = { navigate: (h) => { location.hash = h; } };
  const paint = () => {
    const app = host && host.closest('.jh-app'); const on = !!host && showBar(list);
    if (app) app.toggleAttribute('data-worktabs', on); if (!host) return; host.hidden = !on; if (!on) { host.innerHTML = ''; return; }
    const ord = (order = barOrder(order, list)); const byKey = {}; list.forEach((x) => { byKey[x.key] = x; });
    host.innerHTML = '<ol class="jh-worktabs__list">' + ord.map((k) => { const t = byKey[k]; return '<li class="jh-worktabs__item"' + (t.key === current ? ' data-current="1"' : '') + '><a class="jh-worktabs__tab" href="' + esc(t.hash) + '" data-wt-key="' + esc(t.key) + '"' + (t.key === current ? ' aria-current="page"' : '') + ' title="' + esc(t.label) + '">' + esc(shortLabel(t.label)) + '</a><button type="button" class="jh-worktabs__btn" data-wt-reload="' + esc(t.key) + '" aria-label="새로고침" title="새로고침(처음 상태로 다시 불러오기)">↻</button><button type="button" class="jh-worktabs__btn" data-wt-close="' + esc(t.key) + '" aria-label="탭 닫기" title="탭 닫기">✕</button></li>'; }).join('') + '</ol>';
  };
  const close = (key) => { const wasCurrent = key === current; const next = wasCurrent ? nextAfterClose(list, key) : null; const h = handlers.get(key); handlers.delete(key); list = dropTab(list, key); order = order.filter((k) => k !== key); if (h && h.drop) { try { h.drop(); } catch (e) { /* 이미 없는 화면 */ } } if (wasCurrent) { current = ''; opts.navigate(next ? next.hash : '#/home'); } paint(); };
  return {
    /** 탭 바 붙이기: hostEl 은 셸이 만든 <nav id="jh-worktabs"> */
    attach(hostEl, o) { host = hostEl; if (o) opts = Object.assign(opts, o); if (host && !host.__wt) { host.__wt = true; host.addEventListener('click', (ev) => { const c = ev.target.closest('[data-wt-close]'); if (c) { ev.preventDefault(); close(c.getAttribute('data-wt-close')); return; } const r = ev.target.closest('[data-wt-reload]'); if (r) { ev.preventDefault(); const h = handlers.get(r.getAttribute('data-wt-reload')); if (h && h.reload) h.reload(); } }); } paint(); },
    /** 화면이 열렸다/다시 보인다: 현재 탭으로 기록. handlers = { drop(), reload() } */
    note(entry, hs) { if (!valid(entry)) return; list = noteTab(list, entry, Date.now()); current = entry.key; if (hs) handlers.set(entry.key, hs); if (order.indexOf(entry.key) === -1) order.push(entry.key); overflowKeys(list, current, MAX_TABS).forEach((k) => { const h = handlers.get(k); handlers.delete(k); list = dropTab(list, k); order = order.filter((x) => x !== k); if (h && h.drop) { try { h.drop(); } catch (e) { /* 무시 */ } } }); paint(); },
    /** 화면이 다 그려진 뒤 더 정확한 이름으로 */
    relabel(key, label) { list = relabelTab(list, key, label); paint(); },
    /** 지금 탭을 벗어난다(홈 등 탭이 아닌 화면으로 감): 현재 표시를 끈다 */
    leave() { current = ''; paint(); },
    close, currentKey: () => current, has: (key) => list.some((x) => x.key === key), list: () => list.slice(),
    /** 로그아웃·사용자 변경: 모두 닫는다 */
    reset() { handlers.forEach((h) => { try { if (h.drop) h.drop(); } catch (e) { /* 무시 */ } }); handlers.clear(); list = []; order = []; current = ''; paint(); }
  };
}
export const workTabs = create();
