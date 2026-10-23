"""공사일보 "이력으로 올리기" — 실제 크로미움·실제 컨트롤러(pjt/index.js mountReport)·실제 화면 코드로 시험한다.
서버 접근(core/firebase.js)만 가짜이고, 서버 함수(pjtLogAct)는 시험이 응답 시점·내용을 직접 정한다. 화면 문자열·순수 규칙은 tests/pjt-report-tolog-view.test.mjs·pjt-log-report.test.mjs 가 본다.
(컨트롤러의 클릭 → 확인창 → 서버 호출 → 화면 갱신이 실제로 이어지는지 — 이 연결은 문자열 시험으로는 못 잡는다.) 공개 저장소이므로 가짜 값만 쓴다. 크로미움이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json, re
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
httpd = socketserver.TCPServer(('127.0.0.1', 0), H); BASE = 'http://127.0.0.1:%d' % httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
VER = open(os.path.join(ROOT, 'modules', 'pjt', 'index.js'), encoding='utf-8').read().split('ui.js?v=')[1].split("'")[0]
DATA = {
    'pjt_registry': {'p1': {'name': '현장1', 'status': 'run', 'createdAt': {'seconds': 1}}, 'p2': {'name': '현장2', 'status': 'run', 'createdAt': {'seconds': 2}, 'participants': {'teams': [], 'members': ['u2']}}},   # p2 = 참여자로 지정된 일반 직원(u2, PJT 권한 없음)만 열 수 있다 → 조회 전용 화면
    'pjt_registry/p2/reports': {'2026-10-16': {'fmt': 2, 'author': '작성자', 'content': '작업', 'headcount': 1, 'manday': 1, 'equip': '', 'note': '조회 전용 계정이 보는 특이사항'}},
    'pjt_registry/p1/reports': {
        '2026-10-16': {'fmt': 2, 'author': '작성자', 'content': '덕트 설치', 'tomorrow': '5층', 'headcount': 3, 'manday': 1, 'equip': '', 'note': '3층 덕트 간섭 발견'},
        '2026-10-15': {'today': '배관 설치', 'count': 2, 'remarks': '4층 개구부 누락', 'author': '옛 작성자'},     # 옛 양식(fmt 없음)
        '2026-10-14': {'fmt': 2, 'author': '작성자', 'content': '작업', 'headcount': 1, 'manday': 1, 'equip': '', 'note': ''},   # 특이사항 없음
    },
}
FAKE_FB = """
const DATA = %s; window.__saved = [];
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, ...p) => ({ __col: p.join('/') }); export const doc = (d, ...p) => ({ __col: p.slice(0, -1).join('/'), __id: p[p.length - 1] });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({}); export const documentId = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]);
export const getDoc = async (r) => { const v = (DATA[r.__col] || {})[r.__id]; return { exists: () => v !== undefined, id: r.__id, data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))) }; };
export const setDoc = async (r, v) => { window.__saved.push({ col: r.__col, id: r.__id }); }; export const addDoc = async () => ({ id: 'n1' }); export const updateDoc = async () => {}; export const deleteDoc = async () => {};
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const serverTimestamp = () => 0; export const deleteField = () => ({}); export const Timestamp = {}; export const arrayUnion = () => ({}); export const arrayRemove = () => ({});
export const httpsCallable = () => async () => ({ data: { ok: true } }); export const onAuthStateChanged = () => {};
export const EmailAuthProvider = {}; export const deleteObject = async () => {}; export const getBlob = async () => new Blob([]); export const getDownloadURL = async () => ''; export const reauthenticateWithCredential = async () => {}; export const sendPasswordResetEmail = async () => {};
export const signInWithEmailAndPassword = async () => {}; export const signInWithCustomToken = async () => {}; export const signOut = async () => {}; export const storageRef = () => ({}); export const updatePassword = async () => {}; export const uploadBytesResumable = () => ({});
""" % json.dumps(DATA)
# 가짜 모듈이 실제 core/firebase.js 의 내보내기와 어긋나면(실제에 이름이 늘었는데 가짜에 없음) 시험이 모듈 로딩 단계에서 조용히 죽는다 — 먼저 대조해 이유를 바로 알린다
_real = open(os.path.join(ROOT, 'core', 'firebase.js'), encoding='utf-8').read()
_names = set(re.findall(r'export (?:const|function|async function) (\w+)', _real))
for _m in re.finditer(r'export\s*\{([^}]*)\}', _real): _names |= {x.strip().split(' as ')[-1].strip() for x in _m.group(1).split(',') if x.strip()}
_missing = sorted(n for n in _names if not re.search(r'export (?:const|function|async function) %s\b' % n, FAKE_FB))
if _missing: print('FAIL 가짜 firebase 모듈에 실제 내보내기가 빠져 있음: %s' % _missing); sys.exit(1)
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
CSS = ''.join('<link rel=stylesheet href="%s/' + x + '">' for x in re.findall(r'href="(theme/[a-z]+\.css)[^"]*"', idx))
PAGE = ("""<!doctype html><meta charset=utf-8>%(css)s<div id=root></div>
<script type=module>import { mountReport } from "%(b)s/modules/pjt/index.js?v=%(v)s"; window.__mount = mountReport; window.__ready = true;</script>""") % {'css': CSS % tuple([BASE] * CSS.count('%s')), 'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
CALLM = """() => { window.__srv = { calls: [], res: [], rej: [] }; window.__callLog = (payload) => new Promise((resolve, reject) => { const i = window.__srv.calls.length; window.__srv.calls.push(JSON.parse(JSON.stringify(payload))); window.__srv.res[i] = resolve; window.__srv.rej[i] = reject; }); }"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        def fresh(date='2026-10-16', me=None, proj='p1'):
            pg = b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); bad404 = []
            pg.on('response', lambda r: bad404.append(r.status) if r.status >= 400 and not r.url.endswith('/holidays.js') else None)   # 공휴일 데이터는 가짜 서버에 없다 — 앱이 try/catch 로 흡수하는 알려진 환경 차이라 이것만 허용(다른 요청 실패는 그대로 실패)
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            pg.__dict__.setdefault('_bad', bad404)
            pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
            pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
            pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true'); pg.evaluate(CALLM)
            who = me or {'admin': True, 'uid': 'u1', 'name': '테스터'}
            pg.evaluate("([w, d, pj]) => { window.__mount(document.getElementById('root'), { segs: [pj, d], q: {} }, { me: w, callLog: window.__callLog }); }", [who, date, proj])
            pg.wait_for_function("document.querySelector('#rp-body') && !document.querySelector('#rp-body').hasAttribute('aria-busy') && document.querySelector('.jh-pjt__paper, .jh-pjt__sform, .jh-pjt__doc')", timeout=6000)
            return pg, errs
        def dialog(pg): return pg.query_selector('.jh-dialog')
        def btn_text(pg):
            e = pg.query_selector('[data-rp-act="tolog"]'); return e.inner_text().strip() if e else None
        def srv(pg): return pg.evaluate('() => window.__srv.calls')

        # ── 1) 새 양식 일보
        pg, errs = fresh()
        ok(btn_text(pg) == '이력으로 올리기' and pg.query_selector('[data-rp-logcat]') is not None, '★ 저장된 일보(특이사항 있음)를 열면 버튼과 분류 선택이 보인다')
        ok(pg.eval_on_selector('[data-rp-logcat]', 'e => e.value') == '현장 이슈', '분류 기본값은 "현장 이슈"')
        pg.click('[data-rp-act="tolog"]'); pg.wait_for_timeout(150)
        d = dialog(pg); ok(d is not None and '현장 이슈' in d.inner_text() and '이력' in d.inner_text(), '★ 버튼을 누르면 확인창이 뜨고 문구에 분류가 보인다')
        ok(len(srv(pg)) == 0, '★ 확인창이 떠 있는 동안 서버 호출은 0건(확인 전에 올리지 않음)')
        pg.click('.jh-dialog button[data-cancel]'); pg.wait_for_timeout(150)
        ok(dialog(pg) is None and len(srv(pg)) == 0 and btn_text(pg) == '이력으로 올리기', '★ 확인창에서 취소하면 서버 호출 0건·버튼 그대로')
        pg.click('[data-rp-act="tolog"]'); pg.wait_for_timeout(100); pg.click('.jh-dialog button[data-ok]'); pg.wait_for_timeout(200)
        c = srv(pg); ok(c == [{'action': 'fromReport', 'pjtId': 'p1', 'date': '2026-10-16', 'category': '현장 이슈'}], '★ "올리기"를 누르면 서버에 정확히 이 요청 1건만 간다 (실제: %s)' % c)
        ok(btn_text(pg) == '올리는 중…' and pg.eval_on_selector('[data-rp-act="tolog"]', 'e => e.disabled'), '★ 응답을 기다리는 동안 "올리는 중…"·비활성')
        pg.evaluate("() => { const b = document.querySelector('[data-rp-act=\"tolog\"]'); b.disabled = false; b.click(); }"); pg.wait_for_timeout(200)
        ok(len(srv(pg)) == 1 and dialog(pg) is None, '★ 올리는 중에 억지로 다시 눌러도 서버 호출은 늘지 않고 확인창도 안 뜬다(두 번 눌림 방지)')
        pg.evaluate("() => window.__srv.res[0]({ ok: true, id: 'rpt_2026-10-16' })"); pg.wait_for_timeout(250)
        ok(btn_text(pg) == '이력에 올림 ✓' and pg.eval_on_selector('[data-rp-act="tolog"]', 'e => e.disabled'), '★ 응답이 오면 "이력에 올림 ✓"·비활성')
        ok(pg.query_selector('[data-rp-logcat]') is None, '올린 뒤에는 분류 선택이 사라진다')
        ok('이력에 올렸습니다' in pg.inner_text('body'), '안내 문구("이력에 올렸습니다.")가 화면에 뜬다')
        # 다른 날짜로 갔다 오면 표시가 초기화(이미 올렸는지는 서버가 안다)
        pg.click('[data-rp-day="2026-10-15"]'); pg.wait_for_timeout(300); pg.click('[data-rp-day="2026-10-16"]'); pg.wait_for_timeout(300)
        ok(btn_text(pg) == '이력으로 올리기', '★ 날짜를 옮겼다 돌아오면 "이력에 올림" 표시가 초기화된다(두 번 눌러도 서버가 1건으로 막음)')
        ok(not errs and not pg._bad, '화면 오류 없음·holidays.js 외 요청 실패 없음 (%s %s)' % (errs[:2], pg._bad[:2])); pg.close()

        # ── 2) 서버 거절
        pg, errs = fresh()
        pg.click('[data-rp-act="tolog"]'); pg.wait_for_timeout(100); pg.click('.jh-dialog button[data-ok]'); pg.wait_for_timeout(150)
        pg.evaluate("() => window.__srv.rej[0](Object.assign(new Error('금액·단가는 이력에 적지 않습니다.'), { code: 'invalid-argument' }))"); pg.wait_for_timeout(250)
        ok(btn_text(pg) == '이력으로 올리기' and not pg.eval_on_selector('[data-rp-act="tolog"]', 'e => e.disabled'), '★ 서버가 거절하면 버튼이 다시 활성으로 돌아온다')
        ok('금액·단가는 이력에 적지 않습니다' in pg.inner_text('body') and '이력에 올림 ✓' not in pg.inner_text('body'), '★ 거절 이유가 화면에 뜨고 "올림" 표시는 없다')
        pg.click('[data-rp-act="tolog"]'); pg.wait_for_timeout(100); pg.click('.jh-dialog button[data-ok]'); pg.wait_for_timeout(150)
        ok(len(srv(pg)) == 2, '거절 뒤에는 다시 시도할 수 있다(서버 호출 2번째)'); pg.close()

        # ── 3) 분류 선택
        pg, errs = fresh()
        pg.select_option('[data-rp-logcat]', '일정 변경'); pg.click('[data-rp-act="tolog"]'); pg.wait_for_timeout(100)
        ok('일정 변경' in dialog(pg).inner_text(), '고른 분류가 확인창 문구에 보인다')
        pg.click('.jh-dialog button[data-ok]'); pg.wait_for_timeout(200)
        ok(srv(pg)[0]['category'] == '일정 변경', '★ 고른 분류("일정 변경")가 서버 요청에 담긴다'); pg.close()

        # ── 4) 옛 양식 일보
        pg, errs = fresh('2026-10-15')
        ok('옛 양식' in pg.inner_text('body') and btn_text(pg) == '이력으로 올리기', '★ 옛 양식 일보 화면에도 버튼이 나온다')
        pg.click('[data-rp-act="tolog"]'); pg.wait_for_timeout(100); pg.click('.jh-dialog button[data-ok]'); pg.wait_for_timeout(200)
        ok(srv(pg) == [{'action': 'fromReport', 'pjtId': 'p1', 'date': '2026-10-15', 'category': '현장 이슈'}], '★ 옛 양식 일보도 같은 요청(날짜만 다름) — 서버가 remarks 를 읽는다'); pg.close()

        # ── 5) 버튼이 없어야 하는 경우
        pg, errs = fresh('2026-10-14'); ok(btn_text(pg) is None, '★ 특이사항이 없는 일보에는 버튼이 없다'); pg.close()
        pg, errs = fresh('2026-10-16', {'uid': 'u2', 'name': '일반', 'perms': {}}, 'p2')
        ok('조회만 할 수 있습니다' in pg.inner_text('body') and pg.query_selector('[data-rp-act="edit"]') is None, '전제: 이 계정은 조회 전용 화면이다(수정 버튼 없음)')
        ok('조회 전용 계정이 보는 특이사항' in pg.inner_text('body') and btn_text(pg) is None, '★ 조회 전용 계정(참여자로 지정된 일반 직원)에는 특이사항이 있어도 버튼이 없다'); pg.close()
        pg, errs = fresh(); pg.click('[data-rp-act="edit"]'); pg.wait_for_timeout(200)
        ok(btn_text(pg) is None and pg.query_selector('[data-rp-f="note"]') is not None, '★ [수정] 화면(작성 폼)에는 버튼이 없다 — 서버는 저장된 일보를 읽기 때문'); pg.close()
        b.close()

except Exception as _e:
    import traceback; fail_n += 1; print('FAIL 시험이 예외로 중단됨 → ' + type(_e).__name__ + ': ' + str(_e).split('\n')[0][:200]); print(traceback.format_exc()[-600:])
if pass_n + fail_n < 22: print('FAIL 시험이 끝까지 실행되지 않음(%d건)' % (pass_n + fail_n)); fail_n += 1
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
