/* PJT 자료 패널 — SharePoint 파일 패널(1단계: 읽기 전용 폴더 목록 + 웹/앱에서 열기). 서버 함수 filesAct(portal-functions)가 Graph 로 읽어 준 목록만 그린다.
 *  · 셸(core/shell.js)의 오른쪽 도킹 영역에 고정되고, 상단 바의 📁 버튼으로 숨기고 보인다(선택은 localStorage 에 기억). 1500px 이상에서는 본문이 비켜 고정 열처럼, 좁으면 위에 덮는다. 900px 미만(모바일)에서는 쓰지 않는다.
 *  · 화면(작업 탭)에 붙이지 않는다: 작업 탭은 화면을 지우지 않고 숨겼다 다시 보여 주므로 화면 안에 붙은 패널은 다시 붙지 않아 사라졌다. 이 모듈이 hashchange 를 직접 듣고 프로젝트 주소(#/pjt/<프로젝트>/<탭>)일 때만 켠다.
 *  · 이 파일은 Firebase 를 가져오지 않는다(서버 호출은 deps.callFiles 로 받음 — 시험 가능). 서버가 준 값은 모두 이스케이프하고, 웹/앱 열기 주소는 https 일 때만 쓴다. */
import { esc } from '../../core/ui.js?v=20261031a';

const TABS = ['home', 'schedule', 'progress', 'attend', 'report', 'settings'];
const RESERVED = TABS.concat(['ended', 'roster']);
/** 주소 해시 → 프로젝트 키(프로젝트 화면이 아니면 ''). 전체 홈·종료·연명부·탭 이름만 있는 주소는 프로젝트가 아니다 */
export function projectKeyFromHash(hash) {
  const m = /^#\/pjt\/([^/?#]+)(?:\/([^/?#]+))?/.exec(String(hash || '')); if (!m) return '';
  let k; try { k = decodeURIComponent(m[1]); } catch (e) { return ''; }
  if (RESERVED.indexOf(k) !== -1) return ''; if (m[2] && TABS.indexOf(m[2]) === -1) return '';
  return /^[A-Za-z0-9_-]{1,80}$/.test(k) ? k : '';
}
/** 주소의 첫 칸(모듈 번호) → 폴더 패널이 있는 다른 모듈. 서버 filesAct listModule 의 moduleId 와 이름표. 총무(general)는 인사총무와 같은 폴더를 쓴다 */
const MODULE_PANELS = { plan: ['plan', '영업기획'], hr: ['hr', '인사총무'], general: ['hr', '인사총무'], finance: ['finance', '재무회계'], edoc: ['edoc', '전자결재'], company: ['company', '회사'], eval: ['eval', '평가'] };
/** 주소 → 패널이 보여 줄 대상: PJT 프로젝트({kind:'pjt'}) 또는 다른 모듈({kind:'module'}, 관리자만). 대상이 아니면 null. title·rootLabel 은 패널 머리글과 경로 표시에 쓴다 */
export function dockTargetFromHash(hash) {
  const proj = projectKeyFromHash(hash); if (proj) return { kind: 'pjt', key: proj, title: 'PJT 자료', rootLabel: '프로젝트 폴더' };
  const m = /^#\/([a-z]+)(?:[/?#]|$)/.exec(String(hash || '')); const mod = m && MODULE_PANELS[m[1]]; if (!mod) return null;
  return { kind: 'module', key: mod[0], title: mod[1] + ' 자료', rootLabel: mod[1] + ' 폴더' };
}
/** 이 계정에게 패널을 켤지(화면용 — 최종 판단은 서버): 모듈 패널은 관리자만, PJT 패널은 관리자·PJT 권한자·이 프로젝트 참여자로 지정된 사람(pjtKeys) */
export function canSeeDock(me, tg) {
  const m = me || {}; if (!tg) return false; if (tg.kind === 'module') return m.admin === true;
  return m.admin === true || !!(m.perms && m.perms.pjt) || (Array.isArray(m.pjtKeys) && m.pjtKeys.indexOf(tg.key) !== -1);
}
const OFFICE = { doc: 'ms-word', docx: 'ms-word', docm: 'ms-word', xls: 'ms-excel', xlsx: 'ms-excel', xlsm: 'ms-excel', ppt: 'ms-powerpoint', pptx: 'ms-powerpoint', vsd: 'ms-visio', vsdx: 'ms-visio' };
/** 오피스 문서의 "앱에서 열기" 주소(데스크톱 앱이 웹 주소를 받아 편집으로 연다). 오피스 문서가 아니거나 https 가 아니면 '' */
export function officeAppUrl(name, webUrl) { const m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); const proto = m && OFFICE[m[1].toLowerCase()]; if (!proto || !/^https:\/\//.test(String(webUrl || ''))) return ''; return proto + ':ofe|u|' + webUrl; }
export function fmtSize(n) { if (n === null || n === undefined || !isFinite(Number(n))) return ''; const v = Number(n); if (v < 1024) return v + ' B'; const kb = v / 1024; if (kb < 1024) return (kb >= 10 ? String(Math.round(kb)) : kb.toFixed(1)) + ' KB'; const mb = kb / 1024; if (mb < 1024) return (mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1)) + ' MB'; const gb = mb / 1024; return (gb >= 10 ? String(Math.round(gb)) : gb.toFixed(1)) + ' GB'; }
export function fmtDate(iso) { const t = Date.parse(String(iso || '')); if (!isFinite(t)) return ''; return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10); }   // 한국 시간 기준 날짜

function crumbsHtml(path, rootLabel) {
  const parts = path.map((p, i) => ' / ' + (i === path.length - 1 ? '<strong>' + esc(p) + '</strong>' : '<button type="button" class="jh-fp__crumb" data-fp-crumb="' + (i + 1) + '">' + esc(p) + '</button>')).join('');
  return '<nav class="jh-fp__crumbs" aria-label="폴더 경로">' + (path.length ? '<button type="button" class="jh-fp__crumb" data-fp-crumb="0">' + esc(rootLabel || '프로젝트 폴더') + '</button>' : '<strong>' + esc(rootLabel || '프로젝트 폴더') + '</strong>') + parts + '</nav>';
}
function rowHtml(x, i, st) {
  if (x.isFolder) return '<li class="jh-fp__row"><button type="button" class="jh-fp__dir" data-fp-open="' + i + '">📁 ' + esc(x.name) + '</button><span class="jh-fp__meta">' + (x.childCount !== null && x.childCount !== undefined ? esc(x.childCount) + '개' : '') + '</span></li>';
  const app = officeAppUrl(x.name, x.webUrl); const meta = [fmtSize(x.size), fmtDate(x.modified)].filter(Boolean).map(esc).join(' · ');
  const portal = !!st && st.kind === 'pjt';   // PJT 파일은 포털이 창구("열기" = 서버가 만든 임시 링크) — SharePoint 사이트 접근권이 없는 참여자도 열 수 있다
  const sp = !portal || (st && st.isAdmin);   // SharePoint 웹/앱 열기는 사이트 구성원(관리자·모듈 패널)에게만
  const open = portal ? '<button type="button" class="jh-btn" data-variant="secondary" data-fp-link="' + i + '"' + (st.linking === x.id ? ' disabled' : '') + '>' + (st.linking === x.id ? '여는 중…' : '열기') + '</button>' : '';
  const web = sp && x.webUrl && /^https:\/\//.test(x.webUrl) ? '<a class="jh-btn" data-variant="secondary" href="' + esc(x.webUrl) + '" target="_blank" rel="noopener noreferrer">웹에서 열기</a>' : '';
  const ap = sp && app ? '<a class="jh-btn" data-variant="secondary" href="' + esc(app) + '" rel="noopener noreferrer">앱에서 열기</a>' : '';
  return '<li class="jh-fp__row"><span class="jh-fp__name">' + esc(x.name) + '</span><span class="jh-fp__meta">' + meta + '</span><span class="jh-fp__acts">' + open + web + ap + '</span></li>';
}
function bodyHtml(st) {
  switch (st.status) {
    case 'idle': case 'loading': return '<div class="jh-field__hint" role="status">불러오는 중…</div>';
    case 'notConfigured': return '<div class="jh-field__hint">SharePoint 연결이 아직 설정되지 않았습니다. 관리자가 연결을 마치면 이 서랍에서 PJT 자료를 볼 수 있습니다.</div>';
    case 'unmapped': return '<div class="jh-field__hint">' + (st.kind === 'module' ? '이 모듈에 연결된 SharePoint 폴더가 없습니다.' : '이 프로젝트에 연결된 SharePoint 폴더가 없습니다.') + ' 관리자에게 폴더 연결을 요청해 주세요.</div>';
    case 'missing': return (st.path.length ? crumbsHtml(st.path, st.rootLabel) : '') + '<div class="jh-field__hint">연결된 SharePoint 폴더를 찾을 수 없습니다(이름이 바뀌었거나 삭제됐을 수 있습니다).</div>';
    case 'error': return '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.error || '불러오지 못했습니다.') + '</div>';
    default: return (st.notice ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.notice) + '</div>' : '') + crumbsHtml(st.path, st.rootLabel) + (st.items.length ? '<ul class="jh-fp__list">' + st.items.map((x, i) => rowHtml(x, i, st)).join('') + '</ul>' : '<div class="jh-field__hint">이 폴더는 비어 있습니다.</div>')
      + (st.truncated ? '<div class="jh-field__hint">항목이 많아 일부만 표시합니다. SharePoint 에서 전체를 확인해 주세요.</div>' : '')
      + (st.folderUrl && /^https:\/\//.test(st.folderUrl) && (st.kind !== 'pjt' || st.isAdmin) ? '<div class="jh-fp__foot"><a class="jh-btn" data-variant="secondary" href="' + esc(st.folderUrl) + '" target="_blank" rel="noopener noreferrer">SharePoint에서 폴더 열기</a></div>' : '');
  }
}
export function drawerHtml(st) {
  return '<div class="jh-fp__head"><strong>📁 ' + esc(st.title || 'PJT 자료') + '</strong><span class="jh-fp__headbtns"><button type="button" class="jh-btn" data-variant="secondary" data-fp="refresh" aria-label="새로고침">↻</button><button type="button" class="jh-btn" data-variant="secondary" data-fp="close" aria-label="패널 숨기기" title="패널 숨기기">»</button></span></div><div class="jh-fp__body">' + bodyHtml(st) + '</div>';
}
/** 오류 문구: 서버가 한글로 준 메시지(권한 없음·설정 확인 등)는 그대로, SDK 가 만든 일반 코드(함수가 아직 배포되지 않았거나 닿지 않음 등)는 실제 상황에 맞는 안내로 바꾼다 */
const errText = (e) => { const m = e && e.message ? String(e.message) : ''; if (/알 수 없는 요청/.test(m)) return '서버 함수가 아직 최신 버전이 아닙니다(배포 필요). 관리자에게 알려 주세요.'; if (/[가-힣]/.test(m)) return m.slice(0, 200); const code = String((e && e.code) || '').replace(/^functions\//, ''); if (code === 'unauthenticated') return '로그인이 만료됐습니다. 다시 로그인해 주세요.'; return '서버의 SharePoint 연결 기능에 닿지 못했습니다(아직 배포되지 않았거나 일시적인 문제입니다). 관리자에게 알려 주세요.'; };

/** 셸 도킹 패널을 설치한다. host = { el(우측 패널 자리), toggle(상단 바 버튼), app(.jh-app) } — core/shell.js 의 renderShell 이 돌려준 dock. 돌려주는 객체의 dispose() 로 정리(다시 로그인할 때).
 *  PJT 권한자·관리자만 보이고, 프로젝트 주소일 때만 버튼이 나타난다. 열림/숨김은 사용자가 정한 값을 기억하고(없으면 1500px 이상에서 열림), 900px 미만에서는 모두 숨긴다. deps.callFiles(payload) → 서버 filesAct 결과 */
const PREF_KEY = 'jh.filesDock.open';
export function installFilesDock(host, me, deps) {
  const call = deps && deps.callFiles; if (typeof call !== 'function' || !host || !host.el || !host.toggle || !host.app) return null;
  const doc = host.el.ownerDocument, win = doc.defaultView; const m = me || {}; const isAdmin = m.admin === true;   // 패널을 켤지는 canSeeDock(PJT 패널: 관리자·PJT 권한자·참여자 지정 / 다른 모듈 패널: 관리자만) — 최종 판단은 서버
  const width = () => (deps.width ? deps.width() : win.innerWidth); const store = deps.storage || (() => { try { return win.localStorage; } catch (e) { return null; } })();
  const readPref = () => { try { const v = store && store.getItem(PREF_KEY); return v === '1' ? true : v === '0' ? false : null; } catch (e) { return null; } };
  const savePref = (v) => { try { if (store) store.setItem(PREF_KEY, v ? '1' : '0'); } catch (e) { /* 저장 못 해도 이번 화면에서는 동작 */ } };
  let pref = readPref(), seq = 0, disposed = false; const st = { isAdmin, linking: '', notice: '', kind: 'pjt', proj: '', title: 'PJT 자료', rootLabel: '프로젝트 폴더', open: false, status: 'idle', path: [], items: [], folderUrl: '', truncated: false, error: '' };
  const render = () => { host.el.innerHTML = drawerHtml(st); };
  const apply = (r) => { if (!r || r.ok !== true) { st.status = 'error'; st.error = '불러오지 못했습니다.'; return; } if (r.configured === false) st.status = 'notConfigured'; else if (r.mapped === false) st.status = 'unmapped'; else if (r.missing) st.status = 'missing'; else { st.status = 'ok'; st.items = Array.isArray(r.items) ? r.items : []; st.folderUrl = typeof r.folderUrl === 'string' ? r.folderUrl : ''; st.truncated = !!r.truncated; } };
  async function load() { const my = ++seq; st.status = 'loading'; st.error = ''; st.notice = ''; st.linking = ''; render(); try { const r = await call(st.kind === 'module' ? { action: 'listModule', moduleId: st.proj, path: st.path.join('/') } : { action: 'list', pjtId: st.proj, path: st.path.join('/') }); if (my !== seq || disposed) return; apply(r); } catch (e) { if (my !== seq || disposed) return; st.status = 'error'; st.error = errText(e); } render(); }
  const off = () => { host.toggle.hidden = true; host.el.hidden = true; host.app.removeAttribute('data-dock-open'); doc.body.classList.remove('jh-files-open'); };
  function paint() { host.toggle.setAttribute('aria-pressed', String(st.open)); host.el.hidden = !st.open; if (st.open) { host.app.setAttribute('data-dock-open', ''); doc.body.classList.add('jh-files-open'); if (st.status === 'idle') load(); else render(); } else { host.app.removeAttribute('data-dock-open'); doc.body.classList.remove('jh-files-open'); } }
  /** 주소·폭·권한을 보고 버튼과 패널의 보임/숨김을 맞춘다 — 주소가 바뀔 때마다(화면이 다시 만들어지든 아니든) 부른다 */
  function sync() {
    if (disposed) return; const tg = width() >= 900 ? dockTargetFromHash(win.location.hash) : null; const proj = tg && canSeeDock(m, tg) ? tg.key : '';
    if (!proj) { off(); return; }   // 대상 화면이 아니거나 권한이 없음: 숨기기만 한다(상태는 그대로 — 같은 대상으로 돌아오면 이어서 쓴다)
    host.toggle.hidden = false;
    if (proj !== st.proj || tg.kind !== st.kind) { st.kind = tg.kind; st.title = tg.title; st.rootLabel = tg.rootLabel; st.proj = proj; st.path = []; st.items = []; st.status = 'idle'; st.folderUrl = ''; st.truncated = false; st.error = ''; seq++; }   // 다른 프로젝트: 맨 위 폴더부터, 진행 중이던 응답은 무효
    st.open = pref === null ? width() >= 1500 : pref; paint();
  }
  const setOpen = (v) => { pref = !!v; savePref(pref); sync(); const f = pref ? host.el.querySelector('[data-fp="close"]') : host.toggle; if (f && f.focus) f.focus(); };
  /** 파일 "열기": 서버가 참여자 확인 후 만든 임시 다운로드 주소를 새 창으로 연다(주소는 https 일 때만). 같은 파일은 진행 중에 다시 요청하지 않는다 */
  async function openLink(it) {
    if (!it || it.isFolder || st.linking) return; const my = seq; st.linking = it.id; st.notice = ''; render();
    try { const r = await call({ action: 'link', pjtId: st.proj, itemId: it.id }); if (my !== seq || disposed) return;
      if (r && r.ok && typeof r.url === 'string' && /^https:\/\//.test(r.url)) (deps.open || ((u) => win.open(u, '_blank', 'noopener')))(r.url); else st.notice = r && r.missing ? '파일을 찾을 수 없습니다. 새로고침해 주세요.' : '파일 링크를 열 수 없습니다. 잠시 후 다시 시도해 주세요.';
    } catch (e) { if (my !== seq || disposed) return; st.notice = errText(e); }
    st.linking = ''; render();
  }
  const onToggle = () => setOpen(!st.open);
  const onPanel = (ev) => { const t = ev.target; if (!t || !t.closest) return; const b = t.closest('[data-fp],[data-fp-open],[data-fp-crumb],[data-fp-link]'); if (!b || !host.el.contains(b)) return;
    if (b.hasAttribute('data-fp-open')) { const it = st.items[Number(b.getAttribute('data-fp-open'))]; if (it && it.isFolder) { st.path = st.path.concat(it.name); load(); } return; }
    if (b.hasAttribute('data-fp-link')) { openLink(st.items[Number(b.getAttribute('data-fp-link'))]); return; }
    if (b.hasAttribute('data-fp-crumb')) { const n = Number(b.getAttribute('data-fp-crumb')); if (n >= 0 && n <= st.path.length) { st.path = st.path.slice(0, n); load(); } return; }
    const a = b.getAttribute('data-fp'); if (a === 'close') setOpen(false); else if (a === 'refresh') load(); };
  const onKey = (ev) => { if (ev.key === 'Escape' && st.open) setOpen(false); };
  host.toggle.addEventListener('click', onToggle); host.el.addEventListener('click', onPanel); host.el.addEventListener('keydown', onKey); win.addEventListener('hashchange', sync); win.addEventListener('resize', sync);
  function dispose() { if (disposed) return; disposed = true; host.toggle.removeEventListener('click', onToggle); host.el.removeEventListener('click', onPanel); host.el.removeEventListener('keydown', onKey); win.removeEventListener('hashchange', sync); win.removeEventListener('resize', sync); off(); host.el.innerHTML = ''; }
  sync(); return { st, sync, setOpen, dispose };
}
