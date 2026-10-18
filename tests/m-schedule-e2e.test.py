"""모바일 통합 일정(m/schedule.html) 종단 시험 — 폰 화면 크기(iPhone 13)로 저장소의 실제 페이지를 열고 Firebase 만 가짜로 바꿔 확인한다. 로그인·실제 DB 가 필요 없다.
배경(2026-10-19, 결정7): 모바일이 FAB·SUP 일정을 옛 컬렉션(user_schedules·ph4_schedules)에서 읽고 써서 PC·이력과 어긋났고, 등록 프로젝트 구독과 겹쳐 같은 일정이 두 번 보였다.
수정 전 코드(커밋 50555c4)에 같은 시험을 돌리면 5건 실패(옛 컬렉션 읽기·쓰기, FAB·SUP 일정 2번 표시)해 이 시험이 차이를 가려냄을 확인했다. 크로미움(playwright)이 없으면 건너뛴다."""
import sys, json, datetime, os, threading, socketserver, http.server
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
class _H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
_srv = socketserver.TCPServer(('127.0.0.1', 0), _H); threading.Thread(target=_srv.serve_forever, daemon=True).start()
LIVE = 'http://127.0.0.1:%d/m/schedule.html' % _srv.server_address[1]; mode = 'local'; old_html = None
CORS = {'access-control-allow-origin': '*'}
STUB_APP = "export const initializeApp = () => ({});"
STUB_AUTH = "export const getAuth = () => ({}); export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(null), 0); return () => {}; };"
STUB_FS = """
const S = () => window.__fs;
const P = (segs) => segs.join('/');
export const getFirestore = () => ({});
export const collection = (_d, ...s) => ({ path: P(s), kind: 'col' });
export const doc = (_d, ...s) => ({ path: P(s), id: s[s.length - 1], col: P(s.slice(0, -1)), kind: 'doc' });
export const query = (c) => c; export const where = () => ({});
export const serverTimestamp = () => '__TS__';
const snapOf = (ref) => { if (ref.kind === 'doc') { const arr = S().data[ref.col] || []; const d = arr.find((x) => x.id === ref.id); return { id: ref.id, exists: () => !!d, data: () => (d ? d.data : undefined) }; }
  const docs = (S().data[ref.path] || []).map((x) => ({ id: x.id, data: () => x.data })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f) }; };
export const onSnapshot = (ref, cb) => { S().subs.push(ref.path); const l = { ref, cb }; S().listeners.push(l); setTimeout(() => cb(snapOf(ref)), 0); return () => {}; };
const notify = (path) => S().listeners.filter((l) => l.ref.path === path || (l.ref.kind === 'doc' && l.ref.col === path)).forEach((l) => l.cb(snapOf(l.ref)));
export const addDoc = async (ref, data) => { const id = 'n' + (++S().seq); (S().data[ref.path] = S().data[ref.path] || []).push({ id, data }); S().writes.push({ op: 'add', path: ref.path, data }); notify(ref.path); return { id }; };
export const setDoc = async (ref, data, o) => { const arr = (S().data[ref.col] = S().data[ref.col] || []); const i = arr.findIndex((x) => x.id === ref.id); if (i >= 0) arr[i].data = Object.assign({}, arr[i].data, data); else arr.push({ id: ref.id, data }); S().writes.push({ op: 'set', path: ref.path, data }); notify(ref.col); };
export const deleteDoc = async (ref) => { const arr = S().data[ref.col] || []; const i = arr.findIndex((x) => x.id === ref.id); if (i >= 0) arr.splice(i, 1); S().writes.push({ op: 'delete', path: ref.path }); notify(ref.col); };
"""
today = datetime.date.today().isoformat()
INIT = """
(() => { const t = %r; const mk = (id, text, extra) => ({ id, data: Object.assign({ text, sdate: t, edate: t, stime: '09:00', etime: '10:00', tag: 'meeting', tagLabel: '회의', isTodo: false, reg: '시험', place: '', att: '' }, extra || {}) });
  window.__fs = { seq: 0, writes: [], subs: [], listeners: [], data: {
    'pjt_registry/p4ph2/schedules': [mk('a1', 'FAB시험일정')], 'pjt_registry/p4ph4/schedules': [mk('b1', 'SUP시험일정')], 'pjt_registry/abc/schedules': [mk('c1', '경량시험일정')],
    'pjt_registry': [{ id: 'p4ph2', data: { name: 'P4 Ph2 (FAB)', status: 'run' } }, { id: 'p4ph4', data: { name: 'P4 Ph4 (SUP)', status: 'run' } }, { id: 'abc', data: { name: '경량프로젝트', status: 'run' } }],
    'company_schedules': [], 'user_schedules': [mk('a1', 'FAB시험일정'), mk('OLD-A', '옛FAB컬렉션일정')], 'ph4_schedules': [mk('b1', 'SUP시험일정'), mk('OLD-B', '옛SUP컬렉션일정')], 'pjt_settings': [] } };
  localStorage.setItem('jh_login_perms', JSON.stringify({ name: '시험관리자', admin: true, perms: { pjt: true } })); localStorage.setItem('jh_login_name', '시험'); localStorage.setItem('jh_login_full', '시험관리자'); localStorage.setItem('jh_last_active', String(Date.now())); })();
""" % today
res = []
def ok(c, m): res.append((bool(c), m)); print(('OK   ' if c else 'FAIL ') + m)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(**p.devices['iPhone 13']); ctx.add_init_script(INIT)
    for name, body in (('firebase-app.js', STUB_APP), ('firebase-auth.js', STUB_AUTH), ('firebase-firestore.js', STUB_FS)):
        def _h(route, request, body=body): route.fulfill(status=200, content_type='text/javascript', headers=CORS, body=body)  # Playwright 는 (route, request) 두 인자로 부른다 — 기본값 인자가 요청 객체로 덮이지 않게 이름을 분리
        ctx.route('https://www.gstatic.com/firebasejs/10.12.0/' + name, _h)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    if old_html is not None: pg.route(LIVE, lambda route, request: route.fulfill(status=200, content_type='text/html; charset=utf-8', body=old_html))
    pg.on('console', lambda m: print('  [콘솔]', m.type, m.text[:140]) if m.type in ('error', 'warning') else None)
    pg.goto(LIVE, wait_until='commit', timeout=15000)
    try: pg.wait_for_function("!document.querySelector('#app .loading')", timeout=15000)
    except Exception as e: print('  [대기 실패]', str(e)[:80], '| 현재 주소:', pg.url[-40:], '| 본문:', pg.evaluate("document.body ? document.body.innerText.slice(0,80) : '(없음)'")); raise
    pg.wait_for_timeout(600)
    subs = pg.evaluate('window.__fs.subs'); txt = pg.inner_text('#app')
    cnt = lambda s: txt.count(s)
    print('구독한 경로:', sorted(set(subs)), '| 화면 오류:', errs or '없음')
    ok(not errs, '페이지 오류 없음')
    ok('pjt_registry/p4ph2/schedules' in subs and 'pjt_registry/p4ph4/schedules' in subs, '★ FAB·SUP 일정을 새 구조(pjt_registry/<id>/schedules)에서 읽는다')
    ok('user_schedules' not in subs and 'ph4_schedules' not in subs, '★ 옛 컬렉션(user_schedules·ph4_schedules)은 읽지 않는다')
    ok(subs.count('pjt_registry/p4ph2/schedules') == 1 and subs.count('pjt_registry/p4ph4/schedules') == 1, '★ 같은 경로를 두 번 구독하지 않는다(p4ph2 %d회·p4ph4 %d회)' % (subs.count('pjt_registry/p4ph2/schedules'), subs.count('pjt_registry/p4ph4/schedules')))
    ok(cnt('FAB시험일정') == 1 and cnt('SUP시험일정') == 1 and cnt('경량시험일정') == 1, '★ 오늘 일정이 각각 한 번씩만 보인다(FAB %d·SUP %d·경량 %d)' % (cnt('FAB시험일정'), cnt('SUP시험일정'), cnt('경량시험일정')))
    ok(cnt('옛FAB컬렉션일정') == 0 and cnt('옛SUP컬렉션일정') == 0, '옛 컬렉션에만 있는 일정은 보이지 않는다')
    def add(src_key, text):
        pg.click('.add-btn'); pg.wait_for_selector('#f-text'); pg.select_option('#f-pjt', src_key); pg.fill('#f-text', text); pg.click('#f-save'); pg.wait_for_timeout(500)
    for key, text, want in (('fab', '폰저장FAB', 'pjt_registry/p4ph2/schedules'), ('sup', '폰저장SUP', 'pjt_registry/p4ph4/schedules'), ('reg_abc', '폰저장경량', 'pjt_registry/abc/schedules')):
        n0 = len(pg.evaluate('window.__fs.writes')); add(key, text); w = pg.evaluate('window.__fs.writes')[n0:]
        ok(len(w) == 1 and w[0]['op'] == 'add' and w[0]['path'] == want and w[0]['data'].get('text') == text, '★ %s 에서 일정 저장 → 쓰는 곳 = %s  (실제: %s)' % (key, want, [x['path'] for x in w]))
    wr = pg.evaluate('window.__fs.writes'); d = wr[0]['data'] if wr else {}
    ok(all(k in d for k in ('reg', 'text', 'tag', 'tagLabel', 'sdate', 'edate', 'isTodo')) and d.get('savedAt') == '__TS__', '저장된 일정 문서가 PC 와 같은 필드를 갖는다(reg·text·tag·tagLabel·sdate·edate·isTodo·savedAt)')
    pg.wait_for_timeout(300); txt2 = pg.inner_text('#app'); ok(txt2.count('폰저장FAB') == 1, '저장한 일정이 화면에 한 번만 나타난다(FAB %d)' % txt2.count('폰저장FAB'))
    pg.screenshot(path='/tmp/m_%s.png' % mode)
    b.close()
bad = [m for c, m in res if not c]; print('\n' + (('%d건 실패' % len(bad)) if bad else '전부 통과') + ' (%d건)' % len(res)); sys.exit(1 if bad else 0)
