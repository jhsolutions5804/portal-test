"""재무회계 "이엔지 정산" 탭의 월별 매출 세 숫자 카드 연결 시험(대기열 1-2-3-d) — 실제 크로미움·실제 화면 코드(finance/index.js·view.js·logic.js)로 시험한다.
서버 호출(core/firebase.js)만 가짜로 바꾸고, 호출 인자를 함수 이름과 함께 기록해 "무엇이 몇 번 서버로 나갔는지"를 확인한다.
공개 저장소이므로 가짜 데이터만 쓴다(실제 금액·거래처·직원 이름 없음). 크로미움(playwright)이 없으면 건너뛴다."""
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
VER = open(os.path.join(ROOT, 'modules', 'finance', 'index.js'), encoding='utf-8').read().split('ui.js?v=')[1].split("'")[0]
def E(no, seq, date, kind, lines): return {'no': no, 'seq': seq, 'date': date, 'memo': '가짜 ' + no, 'status': 'posted', 'source': {'kind': kind, 'id': ''}, 'lines': [{'account': a, 'side': s, 'amount': m, 'partner': '가짜이엔지'} for a, s, m in lines]}
DATA = {
 'ledger_entries': {
 's1': E('2026-0001', 1, '2026-07-10', 'taxinv_sales', [('1100', 'D', 1100), ('4010', 'C', 1000), ('2040', 'C', 100)]),
 's2': E('2026-0002', 2, '2026-07-25', 'taxinv_sales', [('1100', 'D', 550), ('4010', 'C', 500), ('2040', 'C', 50)]),
 's3': E('2026-0003', 3, '2026-08-05', 'taxinv_sales', [('1100', 'D', 220), ('4010', 'C', 200)]),
 'b1': E('2026-0004', 4, '2026-07-30', 'bank', [('1020', 'D', 900), ('1100', 'C', 900)]),
 },
 'ledger_pjt_proposals': {}, 'ledger_pjt_tags': {}, 'pjt_registry': {},
}
INV_OK = {'ok': True, 'months': [{'month': '2026-07', 'supply': 1700, 'done': 1300, 'open': 400, 'count': 3}, {'month': '2026-08', 'supply': 50, 'done': 0, 'open': 50, 'count': 1}], 'total': {'supply': 1750, 'done': 1300, 'open': 450, 'count': 4}}
FAKE_FB = """
const DATA = %s; const INV_OK = %s; window.__calls = []; window.__mode = window.__mode || 'ok';
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]);
export const getDoc = async (r) => { const v = (DATA[r.__col] || {})[r.__id]; return { exists: () => v !== undefined, data: () => v }; };
export const httpsCallable = (f, name) => async (p) => {
 window.__calls.push({ fn: name, p: JSON.parse(JSON.stringify(p)) });
 if (name === 'marginAct' && p.action === 'invoiceMonthly') {
 await new Promise((r) => setTimeout(r, window.__delay || 150));
 const n = window.__calls.filter((c) => c.fn === 'marginAct' && c.p.action === 'invoiceMonthly').length; const m = window.__mode;
 if (m === 'fail' || (m === 'failonce' && n === 1)) throw Object.assign(new Error('functions/unavailable: 서버가 응답하지 않습니다'), { code: 'functions/unavailable' });
 if (m === 'denied') throw Object.assign(new Error('재무회계 권한이 있는 계정만 사용할 수 있습니다.'), { code: 'functions/permission-denied' });
 if (m === 'badok') return { data: { ok: false } };
 return { data: INV_OK };
 }
 return { data: { ok: true } };
};
export const onAuthStateChanged = () => {}; export const serverTimestamp = () => 0; export const updateDoc = async () => {}; export const setDoc = async () => {}; export const addDoc = async () => {}; export const deleteDoc = async () => {}; export const writeBatch = () => ({}); export const Timestamp = {}; export const documentId = () => ({}); export const deleteField = () => ({}); export const arrayUnion = () => ({}); export const arrayRemove = () => ({}); export const increment = () => ({}); export const getDocsFromServer = getDocs; export const getCountFromServer = async () => ({ data: () => ({ count: 0 }) }); export const startAfter = () => ({}); export const signOut = async () => {}; export const signInWithEmailAndPassword = async () => ({}); export const ref = () => ({}); export const uploadBytes = async () => ({}); export const getDownloadURL = async () => ''; export const deleteObject = async () => {}; export const runTransaction = async () => ({}); export const onSnapshot = () => () => {};
""" % (json.dumps(DATA), json.dumps(INV_OK))
PAGE = """<!doctype html><meta charset=utf-8><link rel=stylesheet href="%(b)s/theme/tokens.css"><link rel=stylesheet href="%(b)s/theme/base.css"><link rel=stylesheet href="%(b)s/theme/components.css"><link rel=stylesheet href="%(b)s/theme/finance.css"><div id=root></div>
<script type=module>import { mount } from "%(b)s/modules/finance/index.js?v=%(v)s"; window.__mount = mount; window.__ready = true;</script>""" % {'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
try:
 with sync_playwright() as p:
  b = p.chromium.launch()
  def fresh(tab='gap', mode='ok', delay=150):
   pg = b.new_page(viewport={'width': 1200, 'height': 900}); errs = []
   pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
   pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
   pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
   pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true', timeout=20000)
   pg.evaluate("([m, d]) => { window.__mode = m; window.__delay = d; }", [mode, delay])
   pg.evaluate("(t) => window.__mount(document.getElementById('root'), { segs: [t], q: {} }, { me: { admin: true, uid: 'u1' } })", tab)
   return pg, errs
  inv_calls = lambda pg: pg.evaluate("window.__calls.filter(c => c.fn === 'marginAct' && c.p.action === 'invoiceMonthly')")
  body = lambda pg: pg.inner_text('#fin-body')
  print('── 이엔지 정산 탭을 열면 한 번만 부르고, 응답 전에도 세금계산서·통장 입금이 보인다')
  pg, errs = fresh(delay=900); pg.wait_for_selector('.jh-fin-table', timeout=15000); pg.wait_for_timeout(250); t0 = body(pg)
  ok('월별 매출 세 숫자' in t0 and '청구서 매출을 불러오는 중' in t0 and '1,500' in t0 and '1,650' in t0 and '900' in t0, '★ 응답이 오기 전에도 카드가 그려지고 "불러오는 중…"과 세금계산서 공급가 1,500·합계 1,650·통장 입금 900 이 바로 보인다(청구서 응답을 기다리지 않음)')
  ok(len(inv_calls(pg)) == 1 and inv_calls(pg)[0]['p'] == {'action': 'invoiceMonthly'}, '★ 탭을 열면 marginAct 가 정확히 1건({action: invoiceMonthly})으로 나간다 (실제: %s)' % inv_calls(pg))
  pg.wait_for_timeout(1200); t1 = body(pg)
  ok('1,700' in t1 and '완결 1,300 · 미완결 400' in t1 and '완결 1,300 · 미완결 450' in t1 and '청구서 매출을 불러오는 중' not in t1, '★ 응답이 오면 청구서 1,700(완결 1,300·미완결 400)과 연 합계(완결 1,300·미완결 450)가 보이고 불러오는 중 표시는 사라진다')
  ok('아직 프로젝트 매출에 포함되지 않았습니다' in t1 and '미완결 450' in t1 and '세 숫자는 서로 다른 서류입니다' in t1, '★ 미완결 450 경고와 "세 숫자는 서로 다른 서류입니다" 안내가 보인다')
  ok('외상매출금' in t1 and '월말 잔액' in t1 and '정산 차액 처리' in t1, '★ 기존 이엔지 정산 표(외상매출금 월별·월말 잔액)와 차액 처리 폼은 그대로 보인다(회귀 없음)')
  pg.locator('[data-g="type"]').first.select_option(index=0); pg.wait_for_timeout(300)
  ok(len(inv_calls(pg)) == 1, '★ 같은 탭에서 다른 조작으로 화면이 다시 그려져도 청구서 호출은 늘지 않는다(1건 유지)')
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
  print('── 다른 탭에서는 청구서 서버를 부르지 않는다')
  for tab in ('home', 'entries', 'reports', 'monthly'):
   pg, errs = fresh(tab=tab); pg.wait_for_timeout(900)
   ok(len(inv_calls(pg)) == 0, '★ %s 탭을 열어도 invoiceMonthly 호출은 0건이다(필요한 탭에서만 부른다)' % tab); pg.close()
  print('── 서버가 실패하면 오류와 다시 불러오기, 세금계산서·통장 입금은 그대로')
  pg, errs = fresh(mode='failonce'); pg.wait_for_selector('[data-inv-reload]', timeout=8000); t = body(pg)
  ok('서버가 응답하지 않습니다' in t and '1,500' in t and '1,650' in t and '900' in t and '완결 1,300' not in t, '★ 실패하면 오류 문구와 [다시 불러오기]가 보이고 세금계산서 1,500·1,650·통장 입금 900 은 그대로 보이며 청구서 숫자(완결·미완결 표기)는 없다 — 세금계산서 공급가의 연 합계(1,700)와 우연히 같은 값이라 청구서 전용 표기로 확인한다(0원으로 채우지 않음)')
  pg.locator('[data-inv-reload]').click(); pg.wait_for_function("window.__calls.filter(c => c.fn === 'marginAct').length === 2", timeout=5000); pg.wait_for_timeout(500); t = body(pg)
  ok(len(inv_calls(pg)) == 2 and '완결 1,300 · 미완결 400' in t and '서버가 응답하지 않습니다' not in t and pg.locator('[data-inv-reload]').count() == 0, '★ [다시 불러오기]를 누르면 2건째가 나가고 이번에는 성공해 청구서 1,700 이 보이며 오류와 버튼은 사라진다'); pg.close()
  pg, errs = fresh(mode='fail', delay=700); pg.wait_for_selector('[data-inv-reload]', timeout=8000)
  pg.evaluate("() => { window.__delay = 900; }"); pg.evaluate("() => { const b = document.querySelector('[data-inv-reload]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(300)
  ok(len(inv_calls(pg)) == 2 and pg.locator('[data-inv-reload]').count() == 0 and '불러오는 중' in body(pg), '★ 다시 불러오기를 세 번 연타해도 서버 호출은 1건만 더 나가고(총 2건) 불러오는 동안은 버튼이 없다(중복 방지)'); pg.wait_for_timeout(1200); pg.close()
  print('── 권한 없음·이상한 응답')
  pg, errs = fresh(mode='denied'); pg.wait_for_timeout(900); t = body(pg)
  ok('청구서 매출은 재무회계 권한이 있는 계정만 볼 수 있습니다' in t and pg.locator('[data-inv-reload]').count() == 0 and '1,500' in t and '900' in t and len(inv_calls(pg)) == 1, '★ 권한이 없으면 권한 안내가 보이고 다시 불러오기는 없으며(눌러도 소용없음) 세금계산서·통장 입금은 보이고 호출은 1건뿐이다'); pg.close()
  pg, errs = fresh(mode='badok'); pg.wait_for_selector('[data-inv-reload]', timeout=8000); t = body(pg)
  ok('청구서 매출을 불러오지 못했습니다' in t and '완결 1,300' not in t and '1,500' in t, '★ 서버가 성공이라는데 응답이 이상하면(ok 거짓) 오류와 다시 불러오기가 보이고 청구서 숫자를 0원으로 만들어 보이지 않는다'); pg.close()
  print('── 탭을 오가도')
  pg, errs = fresh(); pg.wait_for_timeout(900)
  pg.evaluate("() => window.__mount(document.getElementById('root'), { segs: ['home'], q: {} }, { me: { admin: true, uid: 'u1' } })"); pg.wait_for_timeout(500)
  pg.evaluate("() => window.__mount(document.getElementById('root'), { segs: ['gap'], q: {} }, { me: { admin: true, uid: 'u1' } })"); pg.wait_for_timeout(1000); t = body(pg)
  ok('완결 1,300 · 미완결 400' in t and len(inv_calls(pg)) <= 2, '★ 다른 탭에 갔다가 이엔지 정산 탭으로 돌아와도 청구서가 다시 보이고 호출은 많아야 2건이다(실제 %d건)' % len(inv_calls(pg))); pg.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 17: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨')
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
