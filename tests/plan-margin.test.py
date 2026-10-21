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
  'gihoek_projects': {'pjt_1000001': {'name': '프로젝트A', 'linkPjt': 'p4ph2', 'code': 'C1', 'status': 'run', 'targetMargin': 12}, 'pjt_1000002': {'name': '프로젝트B', 'linkPjt': 'p4ph4', 'code': 'C2', 'status': 'run', 'targetMargin': 10}, 'pjt_1000003': {'name': '프로젝트C', 'linkPjt': 'past_m15x_ph4', 'code': 'C3', 'status': 'run', 'targetMargin': 30}, 'pjt_1000004': {'name': '프로젝트D', 'linkPjt': 'past_m15x_ph3', 'code': 'C4', 'status': 'run', 'targetMargin': 30}, 'pjt_1000005': {'name': '프로젝트E', 'linkPjt': 'none', 'code': 'C5', 'status': 'run', 'targetMargin': 30}},
  'gihoek_estimates': {},
  'gihoek_settlements': {
    's1': {'docType': 'invoice', 'pjtIds': ['pjt_1000001'], 'amount': 1000000, 'supply': 1000000, 'status': 'done', 'issueDate': '2026-07-01'},
    's2': {'docType': 'payment', 'pjtIds': ['pjt_1000001'], 'amount': 700000, 'supply': 700000, 'status': 'done', 'issueDate': '2026-07-02'},
    's3': {'docType': 'invoice', 'pjtIds': ['pjt_1000002'], 'amount': 500000, 'supply': 500000, 'status': 'done', 'issueDate': '2026-07-03'},
    's4': {'docType': 'payment', 'pjtIds': ['pjt_1000002'], 'amount': 300000, 'supply': 300000, 'status': 'done', 'issueDate': '2026-07-04'},
    's5': {'docType': 'invoice', 'pjtIds': ['pjt_1000003'], 'amount': 600000, 'supply': 600000, 'status': 'done', 'issueDate': '2026-08-01'},
    's6': {'docType': 'invoice', 'pjtIds': ['pjt_1000003'], 'amount': 400000, 'supply': 400000, 'status': 'active', 'issueDate': '2026-08-02'},
    's7': {'docType': 'payment', 'pjtIds': ['pjt_1000003'], 'amount': 400000, 'supply': 400000, 'status': 'done', 'issueDate': '2026-08-03'},
    's8': {'docType': 'invoice', 'pjtIds': ['pjt_1000004'], 'amount': 800000, 'supply': 800000, 'status': 'active', 'issueDate': '2026-08-04'},
    's9': {'docType': 'invoice', 'pjtIds': ['pjt_1000005'], 'amount': 900000, 'supply': 900000, 'status': 'done', 'issueDate': '2026-08-05'}},
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
  if (name === 'marginAct' && p.action === 'allocate') {
    const ad = window.__allocDelay || 0; if (ad) await new Promise((r) => setTimeout(r, ad));
    const am = window.__allocMode || 'ok'; const flaky = am === 'flaky' && window.__calls.filter((c) => c.fn === 'marginAct' && c.p.action === 'allocate').length < 2;
    if (am === 'err' || flaky) throw Object.assign(new Error('internal'), { code: 'functions/internal' });
    if (am === 'perm') throw Object.assign(new Error('x'), { code: 'functions/permission-denied' });
    if (am === 'bad') return { data: { ok: true } };
    return { data: { ok: true, upTo: '', months: [{ month: '2026-07', pool: 400000, mandayTotal: 40, basis: 'manday', shares: [{ pjt: 'p4ph2', manday: 30, amount: 150000 }, { pjt: 'p4ph4', manday: 10, amount: 250000 }] }, { month: '2026-08', pool: 600000, mandayTotal: 0, basis: 'none', shares: [] }], projects: [{ pjt: 'p4ph2', allocated: 150000, manday: 30 }, { pjt: 'p4ph4', allocated: 250000, manday: 10 }], total: { pool: 1000000, allocated: 400000, unallocated: 600000 }, unmarked: { count: 12, amount: 700000 }, basisSummary: { daily: 40, own: 0 } } };
  }
  if (name === 'marginAct' && p.action === 'saveEval') {
    const ed = window.__evalDelay || 0; if (ed) await new Promise((r) => setTimeout(r, ed));
    const em = window.__evalMode || 'ok'; const flaky = em === 'flaky' && window.__calls.filter((c) => c.fn === 'marginAct' && c.p.action === 'saveEval').length < 2;
    if (em === 'pre' || flaky) throw Object.assign(new Error('완결 처리한 청구서가 없어 저장할 마진이 없습니다. 청구서를 완결 처리한 뒤 다시 저장해 주세요.'), { code: 'functions/failed-precondition' });
    if (em === 'perm') throw Object.assign(new Error('재무회계 권한이 있는 계정만 사용할 수 있습니다.'), { code: 'functions/permission-denied' });
    return { data: { ok: true, pjtId: 'p4ph2', actual: em === 'mismatch' ? 4.8 : -501, asOf: '2026-10-21', estimated: true } };
  }
  const mode = window.__mode || 'ok'; if (name === 'marginAct' && p.action === 'check') {
    const cd = window.__checkDelay || 0; if (cd) await new Promise((r) => setTimeout(r, cd));
    const cm = window.__checkMode || 'ok'; if (cm === 'error' || (cm === 'flaky' && (window.__calls.filter((c) => c.fn === 'marginAct' && c.p.action === 'check').length < 2))) throw Object.assign(new Error('대조 점검 중'), { code: 'functions/unavailable' });
    return { data: window.__check };
  }
  if (name === 'marginAct') {
    if (mode === 'denied') throw Object.assign(new Error('재무회계 권한이 있는 계정만 사용할 수 있습니다.'), { code: window.__prefix === false ? 'permission-denied' : 'functions/permission-denied' });
    if (mode === 'error' || (mode === 'flaky' && (window.__calls.filter((c) => c.fn === 'marginAct').length < 2))) throw Object.assign(new Error('서버 점검 중'), { code: 'functions/unavailable' });
    return { data: window.__report };
  }
  return { data: { ok: true } };
};
""" % json.dumps(DATA)
PAGE = """<!doctype html><meta charset=utf-8><link rel=stylesheet href="%(b)s/theme/tokens.css"><link rel=stylesheet href="%(b)s/theme/base.css"><link rel=stylesheet href="%(b)s/theme/components.css"><link rel=stylesheet href="%(b)s/theme/plan.css"><div id=root></div>
<script type=module>import { mountProjects } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountProjects; window.__ready = true;</script>""" % {'b': BASE, 'v': VER}
REPORT = {'ok': True, 'upTo': '', 'projects': [{'pjt': 'p4ph2', 'overhead': 360000, 'laborWage': 4500000, 'laborInsurance': 450000, 'ownLabor': 4950000}, {'pjt': 'p4ph4', 'overhead': 40000, 'laborWage': 3000000, 'laborInsurance': 300000, 'ownLabor': 3300000}],
  'common': {'wage': 1500000, 'insurance': 150000, 'labor': 1650000}, 'unallocatedLabor': [], 'unlinked': {'count': 0, 'amount': 0}, 'participation': {'days': 4, 'ignoredDays': 0}, 'warnings': {}, 'estimated': True, 'employerRate': 0.1}
CHECK = {'ok': True, 'upTo': '', 'unmarked': {'count': 3, 'amount': 1200000}, 'payslipCheck': [{'month': '2026-07', 'ledger': 8000000, 'payslips': 9000000}], 'unlinked': {'count': 0, 'amount': 0}}
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
            pg.evaluate("([m, d, pr, rp, ck]) => { window.__mode = m; window.__delay = d; window.__prefix = pr; window.__report = rp; window.__check = ck; window.__checkMode = 'ok'; window.__checkDelay = 0; window.__evalMode = 'ok'; window.__evalDelay = 0; window.__allocMode = 'ok'; window.__allocDelay = 0; }", [mode, delay, prefix, REPORT, CHECK])
            pg.evaluate("(r) => window.__mount(document.getElementById('root'), r, { me: { uid: 'u1', name: '가짜', admin: true } })", {'segs': segs or [], 'q': {}})
            return pg, errs
        mcalls = lambda pg: [c for c in pg.evaluate('window.__calls') if c['fn'] == 'marginAct']
        btn = lambda pg: pg.locator('[data-pj-act="margin-load"]')
        def open_detail(pg): pg.wait_for_selector('.jh-plan__sum', timeout=15000); pg.wait_for_timeout(250)
        print('── 자동으로 부르지 않는다')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg)
        ok(len(mcalls(pg)) == 0, '★ 프로젝트 상세를 열어도 서버 마진 집계 호출이 0건이다(장부·급여명세서를 읽지 않음)')
        ok('잠정' in pg.inner_text('#pj-body') and btn(pg).count() == 1 and btn(pg).is_enabled() and '반영해서 보기' in btn(pg).inner_text(), '★ 지급 기준 "잠정"과 활성 [반영해서 보기] 버튼이 보인다')
        pg.wait_for_timeout(500); ok(len(mcalls(pg)) == 0, '시간이 지나도 호출이 없다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh(); pg.wait_for_selector('#pj-body', timeout=15000); pg.wait_for_timeout(500)
        ok(len(mcalls(pg)) == 0 and btn(pg).count() == 0, '★ 목록 화면에서는 호출도 버튼도 없다'); pg.close()
        print('── 버튼을 눌렀을 때만')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
        cs = mcalls(pg); ok(len(cs) == 1 and cs[0]['p'] == {'action': 'report'}, '★ 버튼을 누르면 marginAct 가 정확히 1건({action: report})으로 나간다 (실제: %s)' % cs)
        txt = pg.inner_text('#pj-body'); ok('잠정' not in txt and '360,000원' in txt and '4,950,000원' in txt and '월 마감 점검' in txt and '3줄' not in txt and '4대보험 10% 추정' in txt, '★ 성공하면 "잠정"이 사라지고 현장경비 360,000원·자체 직접노무비 4,950,000원·미표시 3줄·추정 안내가 보인다')
        ok('다시 불러오기' in btn(pg).inner_text() and btn(pg).is_enabled(), '성공 뒤에는 [다시 불러오기]가 보인다')
        btn(pg).click(); pg.wait_for_timeout(600); ok(len(mcalls(pg)) == 2, '★ [다시 불러오기]를 누르면 두 번째 호출이 나간다(데이터가 바뀌었을 때 사용자가 원할 때만)')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 중복 호출 방지')
        pg, errs = fresh(['pjt_1000001'], delay=900); open_detail(pg)
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-load\"]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(250)
        ok(btn(pg).count() == 1 and not btn(pg).is_enabled() and '불러오는 중' in btn(pg).inner_text() and '잠정' in pg.inner_text('#pj-body'), '★ 부르는 중에는 버튼이 비활성 "불러오는 중…"이고 값은 아직 비어 있다(잠정 유지)')
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-load\"]'); if (b) { b.disabled = false; b.click(); b.click(); } }"); pg.wait_for_timeout(1300)
        ok(len(mcalls(pg)) == 1, '★ 세 번 연속 눌러도, 비활성을 억지로 풀어 눌러도 서버 호출은 1건이다 — 실제 %d건' % len(mcalls(pg))); pg.close()
        print('── 권한 없음')
        for pref in (True, False):
            pg, errs = fresh(['pjt_1000001'], mode='denied', prefix=pref); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
            txt = pg.inner_text('#pj-body'); ok('재무회계 권한이 있는 계정만' in txt and '잠정' in txt and btn(pg).count() == 0 and '불러오지 못했습니다' not in txt, '★ 권한이 없으면(오류 코드 %s) 권한 안내와 "잠정"만 보이고 버튼도 "불러오지 못했습니다"도 없다' % ('functions/permission-denied' if pref else 'permission-denied'))
            ok(not [e for e in errs if 'favicon' not in e and 'permission' not in e.lower() and '403' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 실패 후 다시 시도')
        pg, errs = fresh(['pjt_1000001'], mode='flaky'); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
        txt = pg.inner_text('#pj-body'); ok('불러오지 못했습니다' in txt and '잠정' in txt and '다시 불러오기' in btn(pg).inner_text() and '360,000원' not in txt, '★ 서버가 실패하면 안내와 "잠정"이 보이고 값은 비어 있으며 [다시 불러오기]가 있다')
        btn(pg).click(); pg.wait_for_timeout(600); txt = pg.inner_text('#pj-body'); ok(len(mcalls(pg)) == 2 and '잠정' not in txt and '360,000원' in txt, '★ 다시 누르면 성공해서 값이 채워진다(호출 2건)')
        ok(not [e for e in errs if 'favicon' not in e and 'unavailable' not in e.lower() and '서버 점검' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 프로젝트를 바꿔도')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); btn(pg).click(); pg.wait_for_timeout(700)
        pg.locator('[data-pj-act="list"]').click(); pg.wait_for_timeout(300); pg.locator('[data-pj-open="pjt_1000002"]').click(); pg.wait_for_timeout(400)
        txt = pg.inner_text('#pj-body'); ok(len(mcalls(pg)) == 1 and '40,000원' in txt and '3,300,000원' in txt and '잠정' not in txt, '★ 목록으로 나갔다가 다른 프로젝트(B)를 열어도 서버를 다시 부르지 않고 이미 받은 값(B 현장경비 40,000원·자체 직접노무비 3,300,000원)이 보인다')
        pg.close()
        print('── 장부 대조(check): 누를 때만, 가장 무겁다')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg)
        ck = lambda pg: pg.locator('[data-pj-act="margin-check"]'); ccalls = lambda pg: [c for c in mcalls(pg) if c['p'].get('action') == 'check']
        ok(ck(pg).count() == 0, '★ 마진 보고가 성공하기 전에는 [장부 대조 확인] 버튼이 없다')
        btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500)
        ok(len(ccalls(pg)) == 0 and ck(pg).count() == 1 and ck(pg).is_enabled() and '장부 대조 확인' in ck(pg).inner_text() and '월 마감 점검' in pg.inner_text('#pj-body'), '★ 마진 보고가 성공해도 대조 호출은 0건(자동 호출 없음)이고 활성 [장부 대조 확인] 버튼과 항상 보이는 안내가 있다')
        ck(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "check")', timeout=5000); pg.wait_for_timeout(500)
        cc = ccalls(pg); txt = pg.inner_text('#pj-body')
        ok(len(cc) == 1 and cc[0]['p'] == {'action': 'check'}, '★ 버튼을 누르면 marginAct 가 정확히 1건({action: check})으로 나간다 (실제: %s)' % cc)
        ok('3줄' in txt and '1,200,000원' in txt and '2026-07' in txt and '5110' in txt and '월 마감 점검이나' not in txt, '★ 대조 결과(미표시 3줄·1,200,000원·장부 5110 불일치 2026-07)가 보이고 항상 보이는 안내는 사라진다')
        ok('다시 대조' in ck(pg).inner_text() and '360,000원' in txt, '대조 뒤에도 마진 값은 그대로이고 [다시 대조]가 보인다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 대조 중복 호출 방지·실패 후 재시도')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(400)
        pg.evaluate("() => { window.__checkDelay = 900; }"); pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-check\"]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(250)
        ok(not ck(pg).is_enabled() and '대조하는 중' in ck(pg).inner_text(), '★ 대조 중에는 버튼이 비활성 "대조하는 중…"이다')
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-check\"]'); if (b) { b.disabled = false; b.click(); b.click(); } }"); pg.wait_for_timeout(1300)
        ok(len(ccalls(pg)) == 1, '★ 세 번 연속·비활성을 억지로 풀어 눌러도 대조 호출은 1건이다 — 실제 %d건' % len(ccalls(pg))); pg.close()
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(400)
        pg.evaluate("() => { window.__checkMode = 'flaky'; }"); ck(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "check")', timeout=5000); pg.wait_for_timeout(500)
        txt = pg.inner_text('#pj-body'); ok('장부 대조를 불러오지 못했습니다' in txt and '월 마감 점검' in txt and '이상 없음' not in txt and '다시 대조' in ck(pg).inner_text() and '360,000원' in txt, '★ 대조가 실패하면 안내와 [다시 대조]가 보이고 항상 보이는 안내는 유지되며 마진 값은 그대로다')
        ck(pg).click(); pg.wait_for_timeout(600); txt = pg.inner_text('#pj-body'); ok(len(ccalls(pg)) == 2 and '3줄' in txt and '장부 대조를 불러오지 못했습니다' not in txt, '★ 다시 누르면 성공해서 결과가 보인다(호출 2건)')
        ok(not [e for e in errs if 'favicon' not in e and 'unavailable' not in e.lower() and '대조 점검' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 대조 후 프로젝트를 바꿔도')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(400); ck(pg).click(); pg.wait_for_timeout(600)
        pg.locator('[data-pj-act="list"]').click(); pg.wait_for_timeout(300); pg.locator('[data-pj-open="pjt_1000002"]').click(); pg.wait_for_timeout(400)
        txt = pg.inner_text('#pj-body'); ok(len(mcalls(pg)) == 2 and len(ccalls(pg)) == 1 and '3줄' in txt and '40,000원' in txt, '★ 다른 프로젝트(B)를 열어도 보고·대조를 다시 부르지 않고(총 2건: 보고 1·대조 1) 이미 받은 값(대조 결과 3줄, B 현장경비 40,000원)이 보인다'); pg.close()
        print('── 완결한 청구서만 매출(대표님 2026-10-21): 미완결 안내')
        pg, errs = fresh(['pjt_1000003']); open_detail(pg); txt = pg.inner_text('#pj-body')
        ok('확정 매출(완결) 600,000원' in txt and '완결 전 청구 400,000원은 아직 매출에 포함되지 않았습니다' in txt and '완결한 청구서가 없어' not in txt, '★ 청구서가 완결 600,000·유효 400,000이면 "확정 매출(완결) 600,000원"과 "완결 전 청구 400,000원은 아직 매출에 포함되지 않았습니다"가 보인다')
        ok('청구 누계' in txt and '1,000,000' in txt, '청구 누계(발행 기준) 1,000,000원은 그대로 보인다(발행 현황이라 유지)')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh(['pjt_1000004']); open_detail(pg); txt = pg.inner_text('#pj-body')
        ok('완결한 청구서가 없어 마진율을 계산하지 않습니다' in txt and '완결 전 청구 800,000원' in txt and '확정 매출(완결)' not in txt, '★ 청구서가 전부 유효(완결 없음)이면 "완결한 청구서가 없어 마진율을 계산하지 않습니다"와 완결 전 청구 800,000원이 보이고 확정 매출 줄은 없다'); pg.close()
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); txt = pg.inner_text('#pj-body')
        ok('확정 매출(완결) 1,000,000원' in txt and '완결 전 청구' not in txt, '★ 전부 완결된 프로젝트는 "확정 매출(완결) 1,000,000원"만 보이고 미완결 안내는 없다'); pg.close()
        print('── 영업기획 id ≠ PJT id(실제 형식): 서버 응답의 현장경비가 보이고, 연결 없는 프로젝트는 0원이 아니라 안내(대기열 1-2-2-④)')
        pg, errs = fresh(['pjt_1000001']); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('현장경비 360,000원' in txt and '자체 직접노무비 4,950,000원' in txt and '현장경비 0원' not in txt, '★ 영업기획 id(pjt_1000001)와 서버 응답 id(p4ph2)가 다른 실제 형식에서도 서버 응답의 현장경비 360,000원·자체 직접노무비 4,950,000원이 화면에 보인다 — 수정 전에는 항상 0원으로 채워졌다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh(['pjt_1000005']); open_detail(pg); txt = pg.inner_text('#pj-body')
        ok('PJT 관리 항목에 연결되지 않아' in txt and '잠정' in txt and btn(pg).count() == 0 and ck(pg).count() == 0 and len(mcalls(pg)) == 0 and '현장경비 0원' not in txt, '★ 연결 없는 프로젝트(linkPjt none)는 "PJT 관리 항목에 연결되지 않아" 안내와 잠정이 보이고 [반영해서 보기]·[장부 대조] 버튼과 서버 호출이 없으며 0원으로 완결 처리하지 않는다')
        pg.close()
        print('── 평가용으로 저장(대기열 1-2-2-②): 누를 때만 서버가 계산해 저장, 결과·오류·중복 방지')
        ev = lambda pg: pg.locator('[data-pj-act="margin-eval"]'); ecalls = lambda pg: [c for c in mcalls(pg) if c['p'].get('action') == 'saveEval']
        def loaded(pid, **kw):
            pg, errs = fresh([pid], **kw); open_detail(pg); btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(450); return pg, errs
        pg, errs = fresh(['pjt_1000001']); open_detail(pg)
        ok(ev(pg).count() == 0, '★ 마진을 불러오기 전에는 [평가용으로 저장] 버튼이 없다')
        btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(450)
        ok(len(ecalls(pg)) == 0 and ev(pg).count() == 1 and ev(pg).is_enabled() and '평가용으로 저장' in ev(pg).inner_text() and '인사평가 점수에 쓰이는 값' in pg.inner_text('#pj-body'), '★ 마진 보고가 성공해도 저장 호출은 0건(자동 저장 없음)이고 활성 [평가용으로 저장] 버튼과 안내가 보인다')
        ev(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "saveEval")', timeout=5000); pg.wait_for_timeout(500); ec = ecalls(pg); txt = pg.inner_text('#pj-body')
        ok(len(ec) == 1 and ec[0]['p'] == {'action': 'saveEval', 'planId': 'pjt_1000001'}, '★ 버튼을 누르면 marginAct 가 정확히 1건({action: saveEval, planId: 영업기획 id})으로 나간다 — 서버가 이 id 로 PJT 연결 id 를 찾아 직접 계산한다 (실제: %s)' % ec)
        ok('평가용으로 저장됨' in txt and '-501%' in txt and '확인일 2026-10-21' in txt and '4대보험' in txt and '다릅니다' not in txt and '다시 저장' in ev(pg).inner_text(), '★ 저장되면 "평가용으로 저장됨 — 실현 마진율 -501% · 확인일 2026-10-21 · 4대보험 추정 포함"이 보이고 화면 값과 같아 경고가 없고 [다시 저장]이 있다')
        ok('현장경비 360,000원' in txt, '저장 뒤에도 마진 값은 그대로 보인다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__evalDelay = 900; }")
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-eval\"]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(250)
        ok(not ev(pg).is_enabled() and '저장하는 중' in ev(pg).inner_text(), '★ 저장 중에는 버튼이 비활성 "저장하는 중…"이다')
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-eval\"]'); if (b) { b.disabled = false; b.click(); b.click(); } }"); pg.wait_for_timeout(1300)
        ok(len(ecalls(pg)) == 1, '★ 세 번 연속·비활성을 억지로 풀어 눌러도 저장 호출은 1건이다 — 실제 %d건' % len(ecalls(pg))); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__evalMode = 'mismatch'; }"); ev(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "saveEval")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('평가용으로 저장됨' in txt and '4.8%' in txt and '다릅니다' in txt and '-501%' in txt and '다시 불러온 뒤' in txt, '★ 서버가 저장한 값(4.8%)이 화면의 실현 마진율(-501%)과 다르면 "다릅니다 — 다시 불러온 뒤 저장해 주세요" 경고가 보인다'); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__evalMode = 'flaky'; }"); ev(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "saveEval")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('완결 처리한 청구서가 없어 저장할 마진이 없습니다' in txt and '평가용으로 저장됨' not in txt and '다시 저장' in ev(pg).inner_text() and ev(pg).is_enabled(), '★ 서버가 거절하면(failed-precondition) 서버가 준 한국어 안내와 [다시 저장]이 보이고 "저장됨"은 말하지 않는다')
        ev(pg).click(); pg.wait_for_timeout(600); txt = pg.inner_text('#pj-body'); ok(len(ecalls(pg)) == 2 and '평가용으로 저장됨' in txt and '완결 처리한 청구서가 없어' not in txt, '★ 다시 누르면 성공해서 저장됨이 보인다(호출 2건)')
        ok(not [e for e in errs if 'favicon' not in e and 'precondition' not in e.lower() and '완결 처리한' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__evalMode = 'perm'; }"); ev(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "saveEval")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('평가용 저장은 재무회계 권한이 있는 계정만 할 수 있습니다' in txt and '평가용으로 저장됨' not in txt, '권한이 없으면 권한 안내가 보인다'); pg.close()
        pg, errs = loaded('pjt_1000004'); txt = pg.inner_text('#pj-body')
        ok(ev(pg).count() == 0 and '완결한 청구서가 없어 평가용으로 저장할 마진이 없습니다' in txt, '★ 완결한 청구서가 없는 연결 프로젝트는 버튼 없이 안내만 보인다'); pg.close()
        pg, errs = fresh(['pjt_1000005']); open_detail(pg); ok(ev(pg).count() == 0 and btn(pg).count() == 0, '연결이 없는 프로젝트에는 평가 저장 버튼도 없다'); pg.close()
        print('── 저장 뒤 다른 프로젝트로 가도')
        pg, errs = loaded('pjt_1000001'); ev(pg).click(); pg.wait_for_timeout(600)
        pg.locator('[data-pj-act="list"]').click(); pg.wait_for_timeout(300); pg.locator('[data-pj-open="pjt_1000002"]').click(); pg.wait_for_timeout(400); txt = pg.inner_text('#pj-body')
        ok('평가용으로 저장됨' not in txt and len(ecalls(pg)) == 1, '★ 다른 프로젝트(B)에는 A 의 저장 결과가 보이지 않고 저장 호출은 늘지 않는다'); pg.close()
        print('── 공통비 반영 이익(대기열 1-2-2-①): 누를 때만 서버가 전표 전체로 계산, 결과·오류·중복 방지')
        al = lambda pg: pg.locator('[data-pj-act="margin-alloc"]'); acalls = lambda pg: [c for c in mcalls(pg) if c['p'].get('action') == 'allocate']
        pg, errs = fresh(['pjt_1000001']); open_detail(pg)
        ok(al(pg).count() == 0, '★ 마진을 불러오기 전에는 [공통비 반영해서 보기] 버튼이 없다')
        btn(pg).click(); pg.wait_for_function('window.__calls.some(c => c.fn === "marginAct")', timeout=5000); pg.wait_for_timeout(450)
        ok(len(acalls(pg)) == 0 and al(pg).count() == 1 and al(pg).is_enabled() and '공통비 반영해서 보기' in al(pg).inner_text() and '그 달 공수 비율' in pg.inner_text('#pj-body'), '★ 마진 보고가 성공해도 공통비 호출은 0건(자동 호출 없음 — 전표 전체를 읽는 무거운 동작이라)이고 활성 버튼과 안내가 보인다')
        al(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "allocate")', timeout=5000); pg.wait_for_timeout(500); ac = acalls(pg); txt = pg.inner_text('#pj-body')
        ok(len(ac) == 1 and ac[0]['p'] == {'action': 'allocate'}, '★ 버튼을 누르면 marginAct 가 정확히 1건({action: allocate})으로 나간다 (실제: %s)' % ac)
        ok('공통비 반영 이익 -5,160,000원 (-516%)' in txt and '공헌이익 -5,010,000원' in txt and '공통비 배부 150,000원' in txt, '★ 공통비 반영 이익 = 공헌이익(완결 1,000,000 − 원가 6,010,000 = -5,010,000) − 공통비 배부 150,000(서버 연결 id p4ph2 몫) = -5,160,000원(-516%%) — 영업기획 id(pjt_…)와 서버 id(p4ph2)가 달라도 찾는다 (실제: %s)' % (txt[txt.find('공통비 반영 이익'):txt.find('공통비 반영 이익') + 120].replace('\n', ' ') if '공통비 반영 이익' in txt else '줄 없음'))
        ok('(잠정)' in txt and '공통비 전체 1,000,000원 중 40%(400,000원)만 배부됐습니다' in txt and '공수가 없는 1개월 600,000원은 배부하지 않았습니다' in txt, '★ 잠정이고 "공통비 전체 1,000,000원 중 40%(400,000원)만 배부 — 공수가 없는 1개월 600,000원은 배부하지 않았습니다"가 보인다')
        ok('미표시 판관비 12줄 700,000원' in txt and '일용직 40일' in txt and '자체 직원 참여일 0일' in txt and '참여 기록이 아직 없습니다' in txt and '2026-07 150,000원(공수 30)' in txt, '★ 미표시 판관비 12줄 700,000원·공수 구성(일용직 40일·자체 직원 0일, 참여 기록 없음)·이 프로젝트가 받은 달(2026-07 150,000원·공수 30)이 보인다')
        ok('다시 계산' in al(pg).inner_text() and '현장경비 360,000원' in txt, '[다시 계산] 버튼이 있고 마진 값은 그대로 보인다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__allocDelay = 900; }")
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-alloc\"]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(250)
        ok(not al(pg).is_enabled() and '계산하는 중' in al(pg).inner_text(), '★ 계산 중에는 버튼이 비활성 "계산하는 중…"이다')
        pg.evaluate("() => { const b = document.querySelector('[data-pj-act=\"margin-alloc\"]'); if (b) { b.disabled = false; b.click(); b.click(); } }"); pg.wait_for_timeout(1300)
        ok(len(acalls(pg)) == 1, '★ 세 번 연속·비활성을 억지로 풀어 눌러도 공통비 호출은 1건이다 — 실제 %d건' % len(acalls(pg))); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__allocMode = 'flaky'; }"); al(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "allocate")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('공통비 배부를 불러오지 못했습니다' in txt and '공통비 반영 이익 ' not in txt and '다시 계산' in al(pg).inner_text(), '★ 서버 오류면 안내와 [다시 계산]이 보이고 공통비 반영 이익은 말하지 않는다')
        al(pg).click(); pg.wait_for_timeout(600); txt = pg.inner_text('#pj-body'); ok(len(acalls(pg)) == 2 and '공통비 반영 이익 -5,160,000원' in txt and '불러오지 못했습니다' not in txt, '★ 다시 누르면 성공해서 결과가 보인다(호출 2건)')
        ok(not [e for e in errs if 'favicon' not in e and 'internal' not in e.lower()], '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__allocMode = 'perm'; }"); al(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "allocate")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('재무회계 권한이 있는 계정만 볼 수 있습니다' in txt, '권한이 없으면 권한 안내가 보인다'); pg.close()
        pg, errs = loaded('pjt_1000001'); pg.evaluate("() => { window.__allocMode = 'bad'; }"); al(pg).click(); pg.wait_for_function('window.__calls.some(c => c.p && c.p.action === "allocate")', timeout=5000); pg.wait_for_timeout(500); txt = pg.inner_text('#pj-body')
        ok('응답 형식이 올바르지 않아' in txt and '공통비 반영 이익 ' not in txt, '★ 응답 모양이 이상하면 성공으로 보지 않고 안내한다(이상한 숫자로 화면을 그리지 않음)'); pg.close()
        pg, errs = loaded('pjt_1000004'); txt = pg.inner_text('#pj-body'); ok(al(pg).count() == 0, '★ 완결한 청구서가 없는 연결 프로젝트는 공통비 버튼이 없다'); pg.close()
        pg, errs = fresh(['pjt_1000005']); open_detail(pg); ok(al(pg).count() == 0 and btn(pg).count() == 0, '연결이 없는 프로젝트에는 공통비 버튼도 없다'); pg.close()
        print('── 다른 프로젝트로 가도 전체 계산 한 번의 응답에서 그 프로젝트 몫만')
        pg, errs = loaded('pjt_1000001'); al(pg).click(); pg.wait_for_timeout(600)
        pg.locator('[data-pj-act="list"]').click(); pg.wait_for_timeout(300); pg.locator('[data-pj-open="pjt_1000002"]').click(); pg.wait_for_timeout(400); btn(pg).click(); pg.wait_for_timeout(600); txt = pg.inner_text('#pj-body')
        ok(len(acalls(pg)) == 1 and '공통비 배부 250,000원' in txt and '공통비 배부 150,000원' not in txt, '★ 다른 프로젝트(B, 연결 p4ph4)로 가서 마진을 불러오면 같은 응답(호출 1건)에서 그 프로젝트의 몫 250,000원만 보이고 A 의 150,000원은 보이지 않는다 (호출 %d건)' % len(acalls(pg))); pg.close()
        ok(pass_n + fail_n >= 74, '시험이 끝까지 실행됨')
        b.close()
    print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
except Exception as e:
    import traceback; fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %s' % repr(e)[:300]); traceback.print_exc(); print('\n실패 %d건 / 통과 %d' % (fail_n, pass_n)); sys.exit(1)
