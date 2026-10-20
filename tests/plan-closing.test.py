"""월말 마감 — 월간 보고서 미생성 경고 연결 시험 — 실제 크로미움·실제 화면 코드(plan/index.js·view·calc·formula)로 시험한다. 서버 접근(core/firebase.js)만 가짜(서버 함수는 시험이 응답 시점을 직접 제어하는 가짜).
공개 저장소이므로 가짜 값만 쓴다(실제 단가·금액·인원·거래처 없음). 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json, re
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
VER = open(os.path.join(ROOT, 'modules', 'plan', 'index.js'), encoding='utf-8').read().split('ui.js?v=')[1].split("'")[0]
DATA = {
 'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'linkPjt': 'r1', 'createdAt': {'seconds': 1}}, 'q2': {'name': '현장2', 'code': 'A2', 'status': 'run', 'linkPjt': 'r2', 'createdAt': {'seconds': 2}}, 'q3': {'name': '연동 없음', 'code': 'A3', 'status': 'run', 'linkPjt': 'none', 'createdAt': {'seconds': 3}}},
 'gihoek_estimates': {}, 'gihoek_settlements': {},
}
FAKE_FB = """
const DATA = %s; window.__saved = []; window.__calls = [];
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({}); export const documentId = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]); export const getDoc = async (r) => ({ exists: () => false, data: () => undefined });
export const setDoc = async (r, v) => { window.__saved.push({ col: r.__col, id: r.__id, data: JSON.parse(JSON.stringify(v)) }); if (r.__col === 'gihoek_estimates') DATA.gihoek_estimates[r.__id] = JSON.parse(JSON.stringify(v)); };
export const addDoc = async (c, v) => { window.__calls.push({ op: 'addDoc', col: c.__col }); return { id: 'new1' }; }; export const updateDoc = async () => {};
export const writeBatch = () => { const ops = []; return { set: (r, v) => ops.push({ r, v }), update() {}, delete() {}, commit: async () => { ops.forEach(({ r, v }) => { window.__saved.push({ col: r.__col, id: r.__id, data: JSON.parse(JSON.stringify(v)), batch: true }); if (r.__col === 'gihoek_estimates') DATA.gihoek_estimates[r.__id] = Object.assign(DATA.gihoek_estimates[r.__id] || {}, JSON.parse(JSON.stringify(v))); }); } }; };
export const deleteDoc = async () => {}; export const serverTimestamp = () => 0; export const deleteField = () => ({}); export const Timestamp = {};
export const httpsCallable = () => async () => ({ data: { ok: true } }); export const onAuthStateChanged = () => {}; export const arrayUnion = () => ({}); export const arrayRemove = () => ({});
""" % json.dumps(DATA)
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
CSS = ''.join('<link rel=stylesheet href="%s/' + x + '">' for x in re.findall(r'href="(theme/[a-z]+\.css)[^"]*"', idx))
PAGE = ("""<!doctype html><meta charset=utf-8>%(css)s<div id=root></div>
<script type=module>import { mountClosing } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountClosing; window.__ready = true;</script>""") % {'css': CSS % tuple([BASE] * CSS.count('%s')), 'b': BASE, 'v': VER}

pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
def ym_shift(ym, d):
    y, m = map(int, ym.split('-')); m += d
    while m > 12: m -= 12; y += 1
    while m < 1: m += 12; y -= 1
    return '%04d-%02d' % (y, m)
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh():
        pg = b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
        pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
        pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
        # 가짜 서버: 호출마다 풀 수 있는 약속을 만들고 요청을 기록 → 시험이 응답 시점·내용을 직접 정한다
        pg.evaluate("""() => { window.__srv = { calls: [], res: [], rej: [] }; window.__callM = (payload) => new Promise((resolve, reject) => { const i = window.__srv.calls.length; window.__srv.calls.push(JSON.parse(JSON.stringify(payload))); window.__srv.res[i] = resolve; window.__srv.rej[i] = reject; }); }""")
        return pg, errs
    def mount(pg):
        pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: [], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' }, callMonthly: window.__callM }); }")   # 끝나기를 기다리지 않는다(서버 응답을 기다리다 화면이 안 뜨는 고장도 FAIL 로 잡으려고)
        try: pg.wait_for_function("document.querySelector('#cl-body') && !document.querySelector('#cl-body').hasAttribute('aria-busy')", timeout=4000)
        except Exception: ok(False, '★ 서버가 응답하지 않아도 월말 마감 화면이 뜬다(응답을 기다리느라 화면이 안 뜨면 안 됨)'); b.close(); print('\n실패 %d건 / 통과 %d (화면이 뜨지 않아 중단)' % (fail_n, pass_n)); sys.exit(1)
    def ym_now(pg): return pg.evaluate("window.__srv.calls[0].ym")
    def body(pg): return pg.locator('#cl-body').inner_text()
    def resp(ym, rows): return {'ok': True, 'ym': ym, 'projects': rows}
    def ck_text(pg): return pg.evaluate("(() => { const b = document.querySelector('[data-cl-ck=\"monthlyReportMissing\"]'); return b ? b.closest('.jh-plan__party').innerText : ''; })()")
    print('── 처음 열기: 화면을 먼저 그리고, 서버 응답은 기다리지 않음')
    pg, errs = fresh(); mount(pg); pg.wait_for_timeout(100)
    ok(len(pg.evaluate("window.__srv.calls")) == 1 and pg.evaluate("window.__srv.calls[0].action") == 'status' and bool(re.match(r'^\d{4}-\d{2}$', pg.evaluate("window.__srv.calls[0].ym"))), '★ 열 때 서버에 status 를 정확히 한 번(월 형식 YYYY-MM) 요청')
    ok('월말 마감' in body(pg) and '월간 보고서 미생성 프로젝트' in body(pg), '★ 서버가 아직 응답하지 않아도 화면(월말 마감)이 이미 나와 있고 점검 항목에 "월간 보고서 미생성 프로젝트"가 보임')
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(80)
    ok('확인하는 중' in ck_text(pg) and '확인하지 못했습니다' not in ck_text(pg), '★ 응답을 기다리는 동안 열면 "확인하는 중입니다"(거짓으로 "못했습니다"가 아님)')
    print('── 응답 도착')
    ym = ym_now(pg); prev = ym_shift(ym, -1)
    pg.evaluate("(ym) => window.__srv.res[0]({ ok: true, ym, projects: [{ pjtId: 'r1', exists: false }, { pjtId: 'r2', exists: false }] })", ym); pg.wait_for_timeout(120)
    ok('확인하는 중' not in body(pg), '응답이 도착하면 "확인하는 중"이 사라짐')
    pg.close()
    print('── 지난 달로 이동하면 그 달 기준으로 다시 요청하고 경고가 나옴')
    pg, errs = fresh(); mount(pg); ym = ym_now(pg); prev = ym_shift(ym, -1)
    pg.evaluate("(ym) => window.__srv.res[0]({ ok: true, ym, projects: [{ pjtId: 'r1', exists: false }, { pjtId: 'r2', exists: true }] })", ym); pg.wait_for_timeout(100)
    pg.locator('[data-cl-act="prev"]').click(); pg.wait_for_timeout(100)
    calls = pg.evaluate("window.__srv.calls")
    ok(len(calls) == 2 and calls[1]['ym'] == prev and calls[1]['action'] == 'status', '★ ‹ 로 지난 달로 가면 그 달(%s)로 다시 요청(%s)' % (prev, [c['ym'] for c in calls]))
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(60)
    ok('확인하는 중' in ck_text(pg), '지난 달 응답을 기다리는 동안은 "확인하는 중"(이번 달 결과가 새 달에 남아 있지 않음)')
    pg.evaluate("(ym) => window.__srv.res[1]({ ok: true, ym, projects: [{ pjtId: 'r1', exists: false }, { pjtId: 'r2', exists: true }] })", prev); pg.wait_for_timeout(120)
    t = ck_text(pg)
    link = pg.evaluate("(() => { const b = document.querySelector('[data-cl-ck=\"monthlyReportMissing\"]'); const a = b && b.closest('.jh-plan__party').querySelector('a'); return a ? a.getAttribute('href') : ''; })()")
    ok('A1' in t and 'A2' not in t and 'A3' not in t, '★ 지난 달 응답이 오면 미생성(A1)만 나오고 이미 만든(A2)·연동 없음(A3)은 나오지 않음')
    ok(link == '#/pjt/r1/monthly', '★ 항목을 누르면 가는 주소는 #/pjt/r1/monthly (실제: %s)' % link)
    pg.close()
    print('── ★ 늦게 도착한 옛 응답이 새 달 화면을 덮지 않음(핵심 위험)')
    pg, errs = fresh(); mount(pg); ym = ym_now(pg); prev = ym_shift(ym, -1)
    pg.locator('[data-cl-act="prev"]').click(); pg.wait_for_timeout(80)                       # 이번 달 응답이 오기 전에 지난 달로 이동
    pg.evaluate("(p) => window.__srv.res[1]({ ok: true, ym: p, projects: [{ pjtId: 'r1', exists: false }, { pjtId: 'r2', exists: false }] })", prev); pg.wait_for_timeout(100)   # 지난 달 응답 먼저 도착
    before = ck_text(pg)
    pg.evaluate("(ym) => window.__srv.res[0]({ ok: true, ym, projects: [{ pjtId: 'r1', exists: true }, { pjtId: 'r2', exists: true }] })", ym); pg.wait_for_timeout(120)   # 이번 달(옛) 응답이 뒤늦게 도착: 전부 만들어짐
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(60)
    after = ck_text(pg)
    ok('A1' in after and 'A2' in after, '★ 옛(이번 달) 응답 — 전부 만들어짐 — 이 늦게 도착해도 화면(지난 달)의 미생성 2개(A1·A2)가 그대로 유지됨')
    ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
    print('── 실패·거부')
    pg, errs = fresh(); mount(pg); pg.evaluate("window.__srv.rej[0](new Error('permission-denied'))"); pg.wait_for_timeout(120)
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(60)
    ok('확인하지 못했습니다' in ck_text(pg) and '월말 마감' in body(pg), '★ 서버가 거부·실패하면 "확인하지 못했습니다"(참고)로 표시되고 월말 마감 화면의 나머지는 정상')
    ok(not errs, '실패해도 화면 오류 없음(예외가 밖으로 새지 않음) %s' % errs[:2]); pg.close()
    print('── 이상한 응답')
    pg, errs = fresh(); mount(pg); pg.evaluate("window.__srv.res[0]({ ok: true, ym: '1999-01', projects: [{ pjtId: 'r1', exists: false }] })"); pg.wait_for_timeout(120)
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(60)
    ok('확인하지 못했습니다' in ck_text(pg) and 'A1' not in ck_text(pg), '★ 다른 달(ym 불일치) 응답이 와도 믿지 않고 "확인하지 못했습니다"'); pg.close()
    pg, errs = fresh(); mount(pg); pg.evaluate("window.__srv.res[0](null)"); pg.wait_for_timeout(120)
    ok(not errs and '월말 마감' in body(pg), 'null 응답에도 화면이 죽지 않음'); pg.close()
    print('── 다음 달(›)로 이동해도 그 달로 다시 요청하고, 아직 시작 안 한 달은 경고하지 않음')
    pg, errs = fresh(); mount(pg); ym = ym_now(pg); nxt = ym_shift(ym, 1)
    pg.evaluate("(ym) => window.__srv.res[0]({ ok: true, ym, projects: [{ pjtId: 'r1', exists: true }, { pjtId: 'r2', exists: true }] })", ym); pg.wait_for_timeout(100)
    pg.locator('[data-cl-act="next"]').click(); pg.wait_for_timeout(100)
    calls = pg.evaluate("window.__srv.calls")
    ok(len(calls) == 2 and calls[1]['ym'] == nxt, '★ › 로 다음 달로 가면 그 달(%s)로 다시 요청(%s)' % (nxt, [c['ym'] for c in calls]))
    pg.evaluate("(n) => window.__srv.res[1]({ ok: true, ym: n, projects: [{ pjtId: 'r1', exists: false }, { pjtId: 'r2', exists: false }] })", nxt); pg.wait_for_timeout(120)
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(60)
    ok('A1' not in ck_text(pg), '아직 시작하지 않은 달(%s)은 미생성이어도 경고하지 않음' % nxt); pg.close()
    print('── 이번 달은 경고하지 않음')
    pg, errs = fresh(); mount(pg); ym = ym_now(pg); pg.evaluate("(ym) => window.__srv.res[0]({ ok: true, ym, projects: [{ pjtId: 'r1', exists: false }, { pjtId: 'r2', exists: false }] })", ym); pg.wait_for_timeout(120)
    pg.locator('[data-cl-ck="monthlyReportMissing"]').click(); pg.wait_for_timeout(60)
    ok('A1' not in ck_text(pg) and '#/pjt/' not in pg.content().split('monthlyReportMissing')[-1][:600], '★ 이번 달(아직 안 끝난 달)은 미생성이어도 경고하지 않음(항목에 프로젝트가 안 나옴)'); pg.close()
    b.close()
ok(pass_n + fail_n >= 17, '★ 시험 전체가 끝까지 실행됨(%d건 ≥ 17)' % (pass_n + fail_n))
print('\n전부 통과 (%d건)' % pass_n if not fail_n else '\n실패 %d건 / 통과 %d' % (fail_n, pass_n)); sys.exit(1 if fail_n else 0)
