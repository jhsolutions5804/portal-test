"""재무회계 보고서 인쇄 제목 연결 시험(대기열 1-2-7 ①, 대표님 2026-10-22) — 실제 크로미움·실제 화면 코드(finance/index.js·view.js·logic.js)로 시험한다.
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
PRINT_STUB = """() => { window.__prints = []; window.print = () => { window.__prints.push(document.title); }; document.title = '포털 홈'; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch()
  def fresh(tab='reports'):
   pg = b.new_page(viewport={'width': 1200, 'height': 900}); errs = []
   pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
   pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
   pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
   pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true', timeout=20000)
   pg.evaluate("(t) => window.__mount(document.getElementById('root'), { segs: [t], q: {} }, { me: { admin: true, uid: 'u1' } })", tab)
   pg.wait_for_selector('[data-act="print"]', timeout=15000); pg.evaluate(PRINT_STUB)
   return pg, errs
  def setrange(pg, f, t):
   pg.evaluate("([f, t]) => { const a = document.querySelector('[data-rep=\"from\"]'), b = document.querySelector('[data-rep=\"to\"]'); const set = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; set(a, f); set(b, t); }", [f, t]); pg.wait_for_timeout(900)
  prints = lambda pg: pg.evaluate('window.__prints')
  print('── 재무제표를 인쇄하면 저장 창의 기본 이름(문서 제목)이 문서 이름이 된다')
  pg, errs = fresh(); setrange(pg, '2026-01-01', '2026-09-30'); pg.evaluate(PRINT_STUB)
  pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  ok(prints(pg) == ['손익계산서 - 2026-01~2026-09'], '★ 손익계산서: window.print 가 불리는 순간 document.title 이 "손익계산서 - 2026-01~2026-09" 다 (실제: %s)' % prints(pg))
  ok(pg.evaluate('document.title') == '손익계산서 - 2026-01~2026-09', '★ 인쇄 대화상자가 열려 있는 동안(afterprint 전)에는 제목이 그대로다')
  pg.evaluate("() => window.dispatchEvent(new Event('afterprint'))"); pg.wait_for_timeout(200)
  ok(pg.evaluate('document.title') == '포털 홈', '★ afterprint 가 오면 원래 제목(포털 홈)으로 돌아온다')
  pg.locator('[data-act="print"]').first.click(); pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  ok(len(prints(pg)) == 3 and pg.evaluate('document.title') == '손익계산서 - 2026-01~2026-09', '인쇄를 연달아 눌러도 인쇄는 눌린 횟수만큼 불린다(총 3번)')
  pg.evaluate("() => window.dispatchEvent(new Event('afterprint'))"); pg.wait_for_timeout(200)
  ok(pg.evaluate('document.title') == '포털 홈', '★ 연달아 눌렀다가 afterprint 가 와도 원래 제목(포털 홈)으로 돌아온다 — 문서 이름이 탭 제목에 영구히 남지 않는다')
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
  print('── 종류를 바꿔도 그 종류의 이름이 된다')
  pg, errs = fresh(); setrange(pg, '2026-01-01', '2026-09-30')
  pg.locator('[data-rep-kind="bs"]').click(); pg.wait_for_timeout(500); pg.evaluate(PRINT_STUB); pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  ok(prints(pg) == ['재무상태표 - 2026-09-30'], '★ 재무상태표는 기준일만: 재무상태표 - 2026-09-30 (실제: %s)' % prints(pg)); pg.close()
  pg, errs = fresh(); setrange(pg, '2026-01-01', '2026-09-30')
  pg.locator('[data-rep-kind="cf"]').click(); pg.wait_for_timeout(500); pg.evaluate(PRINT_STUB); pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  ok(prints(pg) == ['현금흐름표 - 2026-01~2026-09'], '현금흐름표 - 2026-01~2026-09 (실제: %s)' % prints(pg)); pg.close()
  pg, errs = fresh(); setrange(pg, '2026-01-01', '2026-09-30')
  pg.locator('[data-rep-kind="bk"]').click(); pg.wait_for_timeout(500); pg.evaluate(PRINT_STUB); pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  ok(prints(pg) == ['통장 대사'], '★ 통장 대사는 기간 없이 종류만 (실제: %s)' % prints(pg)); pg.close()
  pg, errs = fresh(); setrange(pg, '2026-01-01', '2026-09-30')
  pg.locator('[data-rep-kind="gl"]').click(); pg.wait_for_timeout(500); pg.evaluate(PRINT_STUB); pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  t = prints(pg)[0] if prints(pg) else ''
  ok(t == '계정별 원장 - 2026-01~2026-09 - 외상매입금', '★ 계정별 원장은 기간 뒤에 계정 이름(코드 2010 이 아니라 외상매입금)이 붙는다 (실제: %s)' % t)
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
  print('── 부가세 신고표')
  pg, errs = fresh(); pg.locator('[data-rep-kind="vat"]').click(); pg.wait_for_timeout(700); pg.evaluate(PRINT_STUB); pg.locator('[data-act="print"]').first.click(); pg.wait_for_timeout(300)
  t = prints(pg)[0] if prints(pg) else ''
  ok(t == '부가세 신고표 - 2026-01~2026-06', '★ 부가세 신고표 제목에 신고 기간이 들어간다 — vatPick 이 고른 기간(가짜 전표 기준)이 제목에 연결됐는지 확인한다 (실제: %s)' % t); ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음(부가세 기간 계산 포함) %s' % errs[:2]); pg.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 13: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 13)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
