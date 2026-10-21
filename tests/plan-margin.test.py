"""영업기획 프로젝트 마진 — 서버 마진 집계(marginAct)를 버튼을 눌렀을 때만 부르는지 실제 크로미움·실제 화면 코드로 시험한다.
core/firebase.js 만 가짜로 바꾸고 서버 호출을 이름·인자와 함께 기록해 몇 번 나갔는지 확인한다. 공개 저장소이므로 가짜 데이터만 쓴다. 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
httpd = socketserver.TCPServer(('127.0.0.1', 0), H); port = httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % port
VER = open(os.path.join(ROOT, 'modules', 'plan', 'index.js'), encoding='utf-8').read().split('firebase.js?v=')[1].split("'")[0]
DATA = {
  'gihoek_projects': {'pA': {'name': '프로젝트A', 'code': 'C1', 'status': 'run', 'targetMargin': 12}, 'pB': {'name': '프로젝트B', 'code': 'C2', 'status': 'run', 'targetMargin': 10}},
  'gihoek_estimates': {},
  'gihoek_settlements': {
    's1': {'docType': 'invoice', 'pjtIds': ['pA'], 'amount': 1000000, 'supply': 1000000, 'status': 'done', 'issueDate': '2026-07-01'},
    's2': {'docType': 'payment', 'pjtIds': ['pA'], 'amount': 700000, 'supply': 700000, 'status': 'done', 'issueDate': '2026-07-02'},
    's3': {'docType': 'invoice', 'pjtIds': ['pB'], 'amount': 500000, 'supply': 500000, 'status': 'done', 'issueDate': '2026-07-03'},
    's4': {'docType': 'payment', 'pjtIds': ['pB'], 'amount': 300000, 'supply': 300000, 'status': 'done', 'issueDate': '2026-07-04'}},
  'pjt_registry': {},
}
FAKE_FB = """
const DATA = %s; window.__calls = [];
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({}); export const documentId = () => '__name__';
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]);
export const getDoc = async (r) => { const v = (DATA[r.__col] || {})[r.__id]; return { exists: () => v !== undefined, data: () => v === undefined ? undefined : JSON.parse(JSON.stringify(v)), id: r.__id }; };
export const addDoc = async () => ({ id: 'x' }); export const updateDoc = async () => {}; export const setDoc = async () => {}; export const deleteDoc = async () => {}; export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const serverTimestamp = () => 0; export const deleteField = () => null; export const onAuthStateChanged = () => {};
export const httpsCallable = (f, name) => async (p) => {
  window.__calls.push({ fn: name, p: JSON.parse(JSON.stringify(p || {})) });
  const delay = window.__delay || 0; if (delay) await new Promise((r) => setTimeout(r, delay));
  const mode = window.__mode || 'ok'; if (name === 'marginAct') {
    if (mode === 'denied') throw Object.assign(new Error('재무회계 권한이 있는 계정만 사용할 수 있습니다.'), { code: window.__prefix === false ? 'permission-denied' : 'functions/permission-denied' });
    if (mode === 'error' || (mode === 'flaky' && (window.__calls.filter((c) => c.fn === 'marginAct').length < 2))) throw Object.assign(new Error('서버 점검 중'), { code: 'functions/unavailable' });
    return { data: window.__report };
  }
  return { data: { ok: true } };
};
""" % json.dumps(DATA)
PAGE = """<!doctype html><meta charset=utf-8><link rel=stylesheet href="%(b)s/theme/tokens.css"><link rel=stylesheet href="%(b)s/theme/base.css"><link rel=stylesheet href="%(b)s/theme/components.css"><link rel=stylesheet href="%(b)s/theme/plan.css"><div id=root></div>
<script type=module>import { mountProjects } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountProjects; window.__ready = true;</script>""" % {'b': BASE, 'v': VER}
REPORT = {'ok': True, 'upTo': '', 'projects': [{'pjt': 'pA', 'overhead': 360000, 'laborWage': 4500000, 'laborInsurance': 450000, 'ownLabor': 4950000}, {'pjt': 'pB', 'overhead': 40000, 'laborWage': 3000000, 'laborInsurance': 300000, 'ownLabor': 3300000}],
  'common': {'wage': 1500000, 'insurance': 150000, 'labor': 1650000}, 'unmarked': {'count': 3, 'amount': 1200000}, 'unallocatedLabor': [], 'payslipCheck': [], 'unlinked': {'count': 0, 'amount': 0}, 'participation': {'days': 4, 'ignoredDays': 0}, 'warnings': {}, 'estimated': True, 'employerRate': 0.1}
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK   ' + m)
    else: fail_n += 1; print('FAIL ' + m)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        def fresh(segs=None, mode='ok', delay=0, prefix=True):
            pg = b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
            pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
            pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true', timeout=20000)
            pg.evaluate("([m, d, pr, rp]) => { window.__mode = m; window.__delay = d; window.__prefix = pr; window.__report = rp; }", [mode, delay, prefix, REPORT])
            pg.evaluate("(r) => window.__mount(document.getElementById('root'), r, { me: { uid: 'u1', name: '가짜', admin: true } })", {'segs': segs or [], 'q': {}})
            return pg, errs
        mcalls = lambda pg: [c for c in pg.evaluate('window.__calls') if c['fn'] == 'marginAct']
        btn = lambda pg: pg.locator('[data-pj-act="margin-load"]')
        def open_detail(pg): pg.wait_for_selector('.jh-plan__sum', timeout=15000); pg.wait_for_timeout(250)
        print('── 자동으로 부르지 않는다')
        pg, errs = fresh(['pA']); open_detail(pg)
        ok(len(mcalls(pg)) == 0, '★ 프로젝트 상세를 열어도 서버 마진 집계 호출이 0건이다(장부·급여명세서를 읽지 않음)')
        ok('잠정' in pg.inner_text('#pj-body') and btn(pg).count() == 1 and btn(pg).is_enabled() and '반영해서 보기' in btn(pg).inner_text(), '★ 지급 기준 "잠정"과 활성 [반영해서 보기] 버튼이 보인다')
        pg.wait_for_timeout(500); ok(len(mcalls(pg)) == 0, '시간이 지나도 호출이 없다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh(); pg.wait_for_selector('#pj-body', timeout=15000); pg.wait_for_timeout(500)
        ok(len(mcalls(pg)) == 0 and btn(pg).count() == 0, '★ 목록 화면에서는 호출도 버튼도 없다'); pg.close()
        print('── 버튼을 눌렀을 때만')
        pg, errs = fresh(['pA']); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
        cs = mcalls(pg); ok(len(cs) == 1 and cs[0]['p'] == {'action': 'report'}, '★ 버튼을 누르면 marginAct 가 정확히 1건({action: report})으로 나간다 (실제: %s)' % cs)
        txt = pg.inner_text('#pj-body'); ok('잠정' not in txt and '360,000원' in txt and '4,950,000원' in txt and '3줄' in txt and '4대보험 10% 추정' in txt, '★ 성공하면 "잠정"이 사라지고 현장경비 360,000원·자체 직접노무비 4,950,000원·미표시 3줄·추정 안내가 보인다')
        ok('다시 불러오기' in btn(pg).inner_text() and btn(pg).is_enabled(), '성공 뒤에는 [다시 불러오기]가 보인다')
        btn(pg).click(); pg.wait_for_timeout(600); ok(len(mcalls(pg)) == 2, '★ [다시 불러오기]를 누르면 두 번째 호출이 나간다(데이터가 바뀌었을 때 사용자가 원할 때만)')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 중복 호출 방지')
        pg, errs = fresh(['pA'], delay=900); open_detail(pg)
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-load\"]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(250)
        ok(btn(pg).count() == 1 and not btn(pg).is_enabled() and '불러오는 중' in btn(pg).inner_text() and '잠정' in pg.inner_text('#pj-body'), '★ 부르는 중에는 버튼이 비활성 "불러오는 중…"이고 값은 아직 비어 있다(잠정 유지)')
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-load\"]'); if (b) { b.disabled = false; b.click(); b.click(); } }"); pg.wait_for_timeout(1300)
        ok(len(mcalls(pg)) == 1, '★ 세 번 연속 눌러도, 비활성을 억지로 풀어 눌러도 서버 호출은 1건이다 — 실제 %d건' % len(mcalls(pg))); pg.close()
        print('── 권한 없음')
        for pref in (True, False):
            pg, errs = fresh(['pA'], mode='denied', prefix=pref); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
            txt = pg.inner_text('#pj-body'); ok('재무회계 권한이 있는 계정만' in txt and '잠정' in txt and btn(pg).count() == 0 and '불러오지 못했습니다' not in txt, '★ 권한이 없으면(오류 코드 %s) 권한 안내와 "잠정"만 보이고 버튼도 "불러오지 못했습니다"도 없다' % ('functions/permission-denied' if pref else 'permission-denied'))
            ok(not [e for e in errs if 'favicon' not in e and 'permission' not in e.lower() and '403' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 실패 후 다시 시도')
        pg, errs = fresh(['pA'], mode='flaky'); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
        txt = pg.inner_text('#pj-body'); ok('불러오지 못했습니다' in txt and '잠정' in txt and '다시 불러오기' in btn(pg).inner_text() and '360,000원' not in txt, '★ 서버가 실패하면 안내와 "잠정"이 보이고 값은 비어 있으며 [다시 불러오기]가 있다')
        btn(pg).click(); pg.wait_for_timeout(600); txt = pg.inner_text('#pj-body'); ok(len(mcalls(pg)) == 2 and '잠정' not in txt and '360,000원' in txt, '★ 다시 누르면 성공해서 값이 채워진다(호출 2건)')
        ok(not [e for e in errs if 'favicon' not in e and 'unavailable' not in e.lower() and '서버 점검' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 프로젝트를 바꿔도')
        pg, errs = fresh(['pA']); open_detail(pg); btn(pg).click(); pg.wait_for_timeout(700)
        pg.locator('[data-pj-act="list"]').click(); pg.wait_for_timeout(300); pg.locator('[data-pj-open="pB"]').click(); pg.wait_for_timeout(400)
        txt = pg.inner_text('#pj-body'); ok(len(mcalls(pg)) == 1 and '40,000원' in txt and '3,300,000원' in txt and '잠정' not in txt, '★ 목록으로 나갔다가 다른 프로젝트(B)를 열어도 서버를 다시 부르지 않고 이미 받은 값(B 현장경비 40,000원·자체 직접노무비 3,300,000원)이 보인다')
        pg.close()
        ok(pass_n + fail_n >= 20, '시험이 끝까지 실행됨')
        b.close()
    print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
except Exception as e:
    import traceback; fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %s' % repr(e)[:300]); traceback.print_exc(); print('\n실패 %d건 / 통과 %d' % (fail_n, pass_n)); sys.exit(1)
