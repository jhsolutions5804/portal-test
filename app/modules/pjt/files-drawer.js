/* PJT 자료 서랍 — SharePoint 파일 패널(1단계: 읽기 전용 폴더 목록 + 웹/앱에서 열기). 서버 함수 filesAct(portal-functions)가 Graph 로 읽어 준 목록만 그린다.
 *  · 평소에는 접혀 있고 오른쪽 "자료" 탭을 누르면 열린다(1500px 이상에서는 본문이 비켜 고정 열처럼, 좁으면 덮는 서랍). 900px 미만(모바일)에서는 쓰지 않는다(CSS).
 *  · PJT 탭마다 따로 마운트되므로 공통 훅(pjt/index.js attachFiles)으로 붙인다 — 프로젝트 주소(#/pjt/<프로젝트>/<탭>)일 때만 붙고, 다른 프로젝트·다른 메뉴로 가면 스스로 정리한다.
 *  · 이 파일은 Firebase 를 가져오지 않는다(서버 호출은 deps.callFiles 로 받음 — 시험 가능). 서버가 준 값은 모두 이스케이프하고, 웹/앱 열기 주소는 https 일 때만 쓴다. */
import { esc } from '../../core/ui.js?v=20261016d';

const TABS = ['home', 'schedule', 'progress', 'attend', 'report', 'settings'];
const RESERVED = TABS.concat(['ended', 'roster']);
/** 주소 해시 → 프로젝트 키(프로젝트 화면이 아니면 ''). 전체 홈·종료·연명부·탭 이름만 있는 주소는 프로젝트가 아니다 */
export function projectKeyFromHash(hash) {
  const m = /^#\/pjt\/([^/?#]+)(?:\/([^/?#]+))?/.exec(String(hash || '')); if (!m) return '';
  let k; try { k = decodeURIComponent(m[1]); } catch (e) { return ''; }
  if (RESERVED.indexOf(k) !== -1) return ''; if (m[2] && TABS.indexOf(m[2]) === -1) return '';
  return /^[A-Za-z0-9_-]{1,80}$/.test(k) ? k : '';
}
const OFFICE = { doc: 'ms-word', docx: 'ms-word', docm: 'ms-word', xls: 'ms-excel', xlsx: 'ms-excel', xlsm: 'ms-excel', ppt: 'ms-powerpoint', pptx: 'ms-powerpoint', vsd: 'ms-visio', vsdx: 'ms-visio' };
/** 오피스 문서의 "앱에서 열기" 주소(데스크톱 앱이 웹 주소를 받아 편집으로 연다). 오피스 문서가 아니거나 https 가 아니면 '' */
export function officeAppUrl(name, webUrl) { const m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); const proto = m && OFFICE[m[1].toLowerCase()]; if (!proto || !/^https:\/\//.test(String(webUrl || ''))) return ''; return proto + ':ofe|u|' + webUrl; }
export function fmtSize(n) { if (n === null || n === undefined || !isFinite(Number(n))) return ''; const v = Number(n); if (v < 1024) return v + ' B'; const kb = v / 1024; if (kb < 1024) return (kb >= 10 ? String(Math.round(kb)) : kb.toFixed(1)) + ' KB'; const mb = kb / 1024; if (mb < 1024) return (mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1)) + ' MB'; const gb = mb / 1024; return (gb >= 10 ? String(Math.round(gb)) : gb.toFixed(1)) + ' GB'; }
export function fmtDate(iso) { const t = Date.parse(String(iso || '')); if (!isFinite(t)) return ''; return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10); }   // 한국 시간 기준 날짜

function crumbsHtml(path) {
  const parts = path.map((p, i) => ' / ' + (i === path.length - 1 ? '<strong>' + esc(p) + '</strong>' : '<button type="button" class="jh-fp__crumb" data-fp-crumb="' + (i + 1) + '">' + esc(p) + '</button>')).join('');
  return '<nav class="jh-fp__crumbs" aria-label="폴더 경로">' + (path.length ? '<button type="button" class="jh-fp__crumb" data-fp-crumb="0">프로젝트 폴더</button>' : '<strong>프로젝트 폴더</strong>') + parts + '</nav>';
}
function rowHtml(x, i) {
  if (x.isFolder) return '<li class="jh-fp__row"><button type="button" class="jh-fp__dir" data-fp-open="' + i + '">📁 ' + esc(x.name) + '</button><span class="jh-fp__meta">' + (x.childCount !== null && x.childCount !== undefined ? esc(x.childCount) + '개' : '') + '</span></li>';
  const app = officeAppUrl(x.name, x.webUrl); const meta = [fmtSize(x.size), fmtDate(x.modified)].filter(Boolean).map(esc).join(' · ');
  const web = x.webUrl && /^https:\/\//.test(x.webUrl) ? '<a class="jh-btn" data-variant="secondary" href="' + esc(x.webUrl) + '" target="_blank" rel="noopener noreferrer">웹에서 열기</a>' : '';
  const ap = app ? '<a class="jh-btn" data-variant="secondary" href="' + esc(app) + '" rel="noopener noreferrer">앱에서 열기</a>' : '';
  return '<li class="jh-fp__row"><span class="jh-fp__name">' + esc(x.name) + '</span><span class="jh-fp__meta">' + meta + '</span><span class="jh-fp__acts">' + web + ap + '</span></li>';
}
function bodyHtml(st) {
  switch (st.status) {
    case 'idle': case 'loading': return '<div class="jh-field__hint" role="status">불러오는 중…</div>';
    case 'notConfigured': return '<div class="jh-field__hint">SharePoint 연결이 아직 설정되지 않았습니다. 관리자가 연결을 마치면 이 서랍에서 PJT 자료를 볼 수 있습니다.</div>';
    case 'unmapped': return '<div class="jh-field__hint">이 프로젝트에 연결된 SharePoint 폴더가 없습니다. 관리자에게 폴더 연결을 요청해 주세요.</div>';
    case 'missing': return (st.path.length ? crumbsHtml(st.path) : '') + '<div class="jh-field__hint">연결된 SharePoint 폴더를 찾을 수 없습니다(이름이 바뀌었거나 삭제됐을 수 있습니다).</div>';
    case 'error': return '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.error || '불러오지 못했습니다.') + '</div>';
    default: return crumbsHtml(st.path) + (st.items.length ? '<ul class="jh-fp__list">' + st.items.map(rowHtml).join('') + '</ul>' : '<div class="jh-field__hint">이 폴더는 비어 있습니다.</div>')
      + (st.truncated ? '<div class="jh-field__hint">항목이 많아 일부만 표시합니다. SharePoint 에서 전체를 확인해 주세요.</div>' : '')
      + (st.folderUrl && /^https:\/\//.test(st.folderUrl) ? '<div class="jh-fp__foot"><a class="jh-btn" data-variant="secondary" href="' + esc(st.folderUrl) + '" target="_blank" rel="noopener noreferrer">SharePoint에서 폴더 열기</a></div>' : '');
  }
}
export function drawerHtml(st) {
  return '<div class="jh-fp__head"><strong>📁 PJT 자료</strong><span class="jh-fp__headbtns"><button type="button" class="jh-btn" data-variant="secondary" data-fp="refresh" aria-label="새로고침">↻</button><button type="button" class="jh-btn" data-variant="secondary" data-fp="close" aria-label="닫기">✕</button></span></div><div class="jh-fp__body">' + bodyHtml(st) + '</div>';
}
/** 오류 문구: 서버가 한글로 준 메시지(권한 없음·설정 확인 등)는 그대로, SDK 가 만든 일반 코드(함수가 아직 배포되지 않았거나 닿지 않음 등)는 실제 상황에 맞는 안내로 바꾼다 */
const errText = (e) => { const m = e && e.message ? String(e.message) : ''; if (/[가-힣]/.test(m)) return m.slice(0, 200); const code = String((e && e.code) || '').replace(/^functions\//, ''); if (code === 'unauthenticated') return '로그인이 만료됐습니다. 다시 로그인해 주세요.'; return '서버의 SharePoint 연결 기능에 닿지 못했습니다(아직 배포되지 않았거나 일시적인 문제입니다). 관리자에게 알려 주세요.'; };

/** 서랍을 root(PJT 탭 본문)에 붙인다. 프로젝트 화면이 아니거나 PJT 권한이 없으면 붙이지 않고 null.
 *  같은 프로젝트에서 다시 부르면(탭 이동) 새로 만들지 않고 상태(열림·폴더 경로)를 유지한다. deps.callFiles(payload) → 서버 filesAct 결과 */
export function attachFilesDrawer(root, ctx, deps) {
  const call = deps && deps.callFiles; if (typeof call !== 'function' || !root) return null;
  const doc = root.ownerDocument, win = doc.defaultView; const me = (ctx && ctx.me) || {}; const proj = projectKeyFromHash(win.location.hash); const allowed = !!(me.admin || (me.perms && me.perms.pjt));
  const prev = root.__filesDrawer; if (prev && !prev.disposed && prev.proj === proj && allowed) { prev.ensure(); return prev; } if (prev) prev.dispose(); if (!proj || !allowed) return null;
  const st = { proj, open: false, status: 'idle', path: [], items: [], folderUrl: '', truncated: false, error: '' }; let seq = 0, disposed = false;
  const el = doc.createElement('div'); el.className = 'jh-fp'; el.innerHTML = '<button type="button" class="jh-fp__tab" data-fp="toggle" aria-expanded="false" aria-controls="jh-fp-drawer">📁 자료</button><aside class="jh-fp__drawer" id="jh-fp-drawer" role="complementary" aria-label="PJT 자료" hidden></aside>';
  const tab = el.querySelector('[data-fp="toggle"]'), drawer = el.querySelector('aside');
  const render = () => { drawer.innerHTML = drawerHtml(st); drawer.hidden = !st.open; tab.setAttribute('aria-expanded', String(st.open)); if (st.open) el.setAttribute('data-open', ''); else el.removeAttribute('data-open'); doc.body.classList.toggle('jh-files-open', st.open); root.classList.toggle('jh-fp-host', st.open); };   // jh-fp-host: 서랍이 붙은 본문 컨테이너를 줄여 넓은 화면에서 서랍과 겹치지 않게(CSS)
  const apply = (r) => { if (!r || r.ok !== true) { st.status = 'error'; st.error = '불러오지 못했습니다.'; return; } if (r.configured === false) st.status = 'notConfigured'; else if (r.mapped === false) st.status = 'unmapped'; else if (r.missing) st.status = 'missing'; else { st.status = 'ok'; st.items = Array.isArray(r.items) ? r.items : []; st.folderUrl = typeof r.folderUrl === 'string' ? r.folderUrl : ''; st.truncated = !!r.truncated; } };
  async function load() { const my = ++seq; st.status = 'loading'; st.error = ''; render(); try { const r = await call({ action: 'list', pjtId: proj, path: st.path.join('/') }); if (my !== seq || disposed) return; apply(r); } catch (e) { if (my !== seq || disposed) return; st.status = 'error'; st.error = errText(e); } render(); }
  function setOpen(v) { st.open = !!v; if (st.open && st.status === 'idle') load(); else render(); const f = st.open ? drawer.querySelector('[data-fp="close"]') : tab; if (f && f.focus) f.focus(); }
  el.addEventListener('click', (ev) => { const t = ev.target; if (!t || !t.closest) return; const b = t.closest('[data-fp],[data-fp-open],[data-fp-crumb]'); if (!b || !el.contains(b)) return;
    if (b.hasAttribute('data-fp-open')) { const it = st.items[Number(b.getAttribute('data-fp-open'))]; if (it && it.isFolder) { st.path = st.path.concat(it.name); load(); } return; }
    if (b.hasAttribute('data-fp-crumb')) { const n = Number(b.getAttribute('data-fp-crumb')); if (n >= 0 && n <= st.path.length) { st.path = st.path.slice(0, n); load(); } return; }
    const a = b.getAttribute('data-fp'); if (a === 'toggle') setOpen(!st.open); else if (a === 'close') setOpen(false); else if (a === 'refresh') load(); });
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && st.open) setOpen(false); });
  root.appendChild(el); render();
  const mo = new win.MutationObserver(() => { if (disposed || root.contains(el)) return; if (projectKeyFromHash(win.location.hash) === proj) root.appendChild(el); else dispose(); });   // 탭이 본문을 새로 그리면 다시 붙이고, 다른 화면이면 정리
  mo.observe(root, { childList: true });
  const onHash = () => { if (projectKeyFromHash(win.location.hash) !== proj) dispose(); }; win.addEventListener('hashchange', onHash);
  function dispose() { if (disposed) return; disposed = true; mo.disconnect(); win.removeEventListener('hashchange', onHash); if (el.parentNode) el.parentNode.removeChild(el); doc.body.classList.remove('jh-files-open'); root.classList.remove('jh-fp-host'); if (root.__filesDrawer === api) root.__filesDrawer = null; }
  const api = { proj, el, st, setOpen, load, dispose, ensure() { if (!disposed && !root.contains(el)) root.appendChild(el); }, get disposed() { return disposed; } }; root.__filesDrawer = api; return api;
}
