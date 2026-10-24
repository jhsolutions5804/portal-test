"""영업기획 프로젝트 화면의 실행예산(대기열 1-3-9, 3단계) — 실제 크로미움·실제 화면 코드(plan/index.js·projects-view·budget-view·budget-io·budget)로 시험한다.
서버 접근(core/firebase.js)만 가짜(저장소를 메모리에 두고 읽기·쓰기를 기록). 공개 저장소이므로 가짜 값만 쓴다(실제 금액·거래처·이름 없음). 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json, re
try:
 from playwright.sync_api import sync_playwright
except Exception:
 print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
class H(http.server.SimpleHTTPRequestHandler):
 def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
 def log_message(s, *a): pass
httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % port
VER = open(os.path.join(ROOT, 'modules', 'plan', 'index.js'), encoding='utf-8').read().split('ui.js?v=')[1].split("'")[0]
def calc(qty, price, count): return {'rows': [{'name': '품', 'unit': '식', 'qty': str(qty), 'price': str(price), 'total': '', 'remark': ''}], 'markup': '10', 'unit': '10000', 'count': str(count)}
EST = {'e1': {'no': 'EST-2026-001', 'baseNo': 'EST-2026-001', 'rev': 1, 'pjtId': 'q1', 'status': 'active', 'title': '시험', 'date': '2026-10-01', 'items': [
 {'name': '정상 항목', 'spec': '', 'qty': 2, 'price': 110000, 'amount': 220000, 'remark': '', 'calc': calc(2, 100000, 2)},
 {'name': '네고 항목', 'spec': '', 'qty': 2, 'price': 100000, 'amount': 200000, 'remark': '', 'calc': calc(2, 100000, 2)},
 {'name': '산식 없음', 'spec': '', 'qty': 1, 'price': 50000, 'amount': 50000, 'remark': ''}]}}
DATA = {'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'createdAt': {'seconds': 1}}}, 'gihoek_estimates': EST, 'gihoek_settlements': {}, 'pjt_registry': {}}
FAKE_FB = """
const DATA = %s; const STORE = { gihoek_budgets: {} }; window.__STORE = STORE; window.__saved = []; window.__docReads = []; window.__calls = [];
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({}); export const documentId = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]);
export const getDoc = async (r) => { window.__docReads.push(r.__col + '/' + r.__id); if (window.__failBudgetRead && r.__col === 'gihoek_budgets') { const e = new Error('읽기 실패 시험'); e.code = window.__failBudgetRead; throw e; } const v = (STORE[r.__col] || {})[r.__id]; return { exists: () => v !== undefined, data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))) }; };
export const setDoc = async (r, v, o) => { if (window.__failBudgetWrite && r.__col === 'gihoek_budgets') { const e = new Error('쓰기 실패 시험'); e.code = window.__failBudgetWrite; throw e; } STORE[r.__col] = STORE[r.__col] || {}; STORE[r.__col][r.__id] = JSON.parse(JSON.stringify(v)); window.__saved.push({ op: 'setDoc', col: r.__col, id: r.__id }); };
export const addDoc = async (c, v) => { window.__calls.push({ op: 'addDoc', col: c.__col }); return { id: 'new1' }; }; export const updateDoc = async (r) => { window.__calls.push({ op: 'updateDoc', col: r.__col }); };
export const writeBatch = () => ({ set() { window.__calls.push({ op: 'batchSet' }); }, update() {}, delete() {}, commit: async () => {} });
export const deleteDoc = async (r) => { window.__calls.push({ op: 'deleteDoc', col: r.__col }); }; export const serverTimestamp = () => '<서버시각>'; export const deleteField = () => ({}); export const Timestamp = {};
export const httpsCallable = () => async () => ({ data: { ok: true } }); export const onAuthStateChanged = () => {}; export const arrayUnion = () => ({}); export const arrayRemove = () => ({});
""" % json.dumps(DATA)
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
CSS = ''.join('<link rel=stylesheet href="%s/' + x + '">' for x in re.findall(r'href="(theme/[a-z]+\.css)[^"]*"', idx))
PAGE = ("""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">%(css)s<div id=root></div>
<script type=module>import { mountProjects } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountProjects; window.__ready = true;</script>""") % {'css': CSS % tuple([BASE] * CSS.count('%s')), 'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
BD = {'pjtId': 'q1', 'rev': 1, 'rows': [{'cat': 'sub', 'name': '외주 가', 'amount': 1000000, 'memo': '', 'src': 'manual'}, {'cat': 'reserve', 'name': '예비', 'amount': 100000, 'memo': '', 'src': 'manual'}], 'note': '시험', 'savedAt': '2026-10-24T09:00:00.000Z', 'by': 'u0', 'history': []}
with sync_playwright() as p:
 b = p.chromium.launch()
 def fresh(width=1300, store=None, fail_read=None, fail_write=None):
  pg = b.new_page(viewport={'width': width, 'height': 1000}); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
  pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
  pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
  pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
  if store is not None: pg.evaluate('(s) => { window.__STORE.gihoek_budgets = s; }', store)
  if fail_read: pg.evaluate('(c) => { window.__failBudgetRead = c; }', fail_read)
  if fail_write: pg.evaluate('(c) => { window.__failBudgetWrite = c; }', fail_write)
  pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: ['q1'], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' } }); }")
  pg.wait_for_function("document.body.innerText.includes('실행예산 (계획 원가)') && !document.body.innerText.includes('실행예산을 불러오는 중')", timeout=8000)
  return pg, errs
 def card(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.innerText.includes('실행예산')); return h ? h.closest('section').innerText : ''; })()")
 def click(pg, act, extra=''): pg.locator('[data-bd-act="%s"]%s' % (act, extra)).first.click()
 def stored(pg): return pg.evaluate("window.__STORE.gihoek_budgets.q1 || null")
 def saved_n(pg): return pg.evaluate("window.__saved.filter((x) => x.col === 'gihoek_budgets').length")
 def settle(pg): pg.wait_for_timeout(250)
 def set_row(pg, i, cat=None, name=None, amount=None, memo=None):
  if cat is not None: pg.select_option('[data-bd-k="cat"][data-bd-i="%d"]' % i, cat)
  if name is not None: pg.fill('[data-bd-k="name"][data-bd-i="%d"]' % i, name)
  if amount is not None: pg.fill('[data-bd-k="amount"][data-bd-i="%d"]' % i, amount); pg.locator('[data-bd-k="amount"][data-bd-i="%d"]' % i).dispatch_event('change')
  if memo is not None: pg.fill('[data-bd-k="memo"][data-bd-i="%d"]' % i, memo)
 def wait_read(pg): pg.wait_for_selector('[data-bd-read]', timeout=6000)

 print('── 처음 열기: 읽기는 정확히 한 번, 반복해서 불러오지 않는다')
 pg, errs = fresh(); settle(pg); t = card(pg)
 ok('아직 실행예산이 없습니다' in t and pg.locator('[data-bd-act="new"]').count() == 1 and pg.locator('[data-bd-act="new-import"]').count() == 1, '★ 저장본이 없으면 안내와 [작성]·[견적에서 가져와 작성]이 보인다')
 ok(pg.evaluate("window.__docReads.filter((x) => x === 'gihoek_budgets/q1').length") == 1, '★ 실행예산 문서를 정확히 한 번만 읽었다(화면을 다시 그려도 반복 로딩 없음) — ' + str(pg.evaluate('window.__docReads')))
 ok('요약' in pg.inner_text('body') and pg.locator('h3:has-text("실행예산 (계획 원가)")').count() == 1, '기존 요약 카드 옆에 "실행예산 (계획 원가)" 카드가 한 개')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()

 print('── 작성·저장: 입력 → 쉼표 정리 → 미리보기 → 저장(r1)')
 pg, errs = fresh(); click(pg, 'new'); pg.wait_for_selector('[data-bd-edit]')
 ok('r1 로 저장됩니다' in card(pg) and pg.locator('[data-bd-body] tr').count() == 1, '새 작성: r1 안내와 빈 행 하나')
 ok(pg.evaluate("getComputedStyle(document.querySelector('.jh-plan__bdtable')).display") == 'table', '★ PC 폭에서는 편집 표가 표 모양 그대로다(카드 전환은 폰 폭에서만)')
 set_row(pg, 0, cat='sub', name='외주 가', amount='1000000')
 ok(pg.input_value('[data-bd-k="amount"][data-bd-i="0"]') == '1,000,000', '★ 금액 칸은 입력을 마치면 쉼표가 붙는다(1,000,000)')
 ok('1,000,000' in pg.inner_text('[data-bd-preview]'), '★ 미리보기 합계가 입력과 함께 바뀐다')
 click(pg, 'add-row'); ok(pg.locator('[data-bd-body] tr').count() == 2 and pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-bd-i')") == '1', '행 추가 후 새 행의 내역 칸에 커서가 간다')
 set_row(pg, 1, cat='reserve', name='예비', amount='100,000'); pg.fill('[data-bd-note]', '처음 저장')
 click(pg, 'save'); wait_read(pg); d = stored(pg)
 ok(d and d['rev'] == 1 and d['pjtId'] == 'q1' and d['note'] == '처음 저장' and d['by'] == 'u1' and d['updatedAt'] == '<서버시각>' and d['history'] == [], '★ 저장된 문서: 개정 1·프로젝트 q1·메모·저장자 u1·서버 시각·이력 없음')
 ok([r['amount'] for r in d['rows']] == [1000000, 100000] and [r['cat'] for r in d['rows']] == ['sub', 'reserve'], '★ 금액은 숫자(쉼표 없음)로, 비목은 코드로 저장된다')
 t = card(pg); ok('r1' in t and '1,100,000' in t and '저장했습니다' in t, '저장 뒤 읽기 화면: r1·총 계획 1,100,000·저장 안내')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()

 print('── 개정(r2)과 이력')
 pg, errs = fresh(store={'q1': BD}); wait_read(pg); click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]')
 ok('r1 을 고쳐 r2 로 저장됩니다' in card(pg) and pg.input_value('[data-bd-k="amount"][data-bd-i="0"]') == '1000000', '수정: r1 을 고쳐 r2 로 저장된다는 안내와 기존 값')
 set_row(pg, 0, amount='1,200,000'); pg.fill('[data-bd-note]', '네고'); click(pg, 'save'); wait_read(pg); d = stored(pg)
 ok(d['rev'] == 2 and d['rows'][0]['amount'] == 1200000 and d['note'] == '네고' and len(d['history']) == 1 and d['history'][0]['rev'] == 1 and d['history'][0]['rows'][0]['amount'] == 1000000 and d['history'][0]['note'] == '시험', '★ r2 저장 + 이전 개정(r1)이 이력에 값 그대로 남는다')
 click(pg, 'history'); pg.wait_for_selector('[data-bd-history]'); rows = pg.locator('[data-bd-history] tbody tr'); ok(rows.count() == 2 and 'r2' in rows.nth(0).inner_text() and 'r1' in rows.nth(1).inner_text(), '이력: r2(현재)가 위, r1 이 아래')
 click(pg, 'view-rev', '[data-bd-rev="1"]'); pg.wait_for_selector('[data-bd-revrows]'); ok('r1 내용' in card(pg) and '1,000,000' in pg.inner_text('[data-bd-revrows]'), '★ [보기]로 r1 의 옛 값(1,000,000)을 볼 수 있다')
 click(pg, 'view-rev', '[data-bd-rev="1"]'); settle(pg); ok(pg.locator('[data-bd-revrows]').count() == 0, '같은 [보기]를 다시 누르면 접힌다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()

 print('── 같은 내용이면 저장하지 않는다')
 pg, errs = fresh(store={'q1': BD}); wait_read(pg); click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); n0 = saved_n(pg); click(pg, 'save'); wait_read(pg)
 ok(saved_n(pg) == n0 and '바뀐 내용이 없어 저장하지 않았습니다' in card(pg) and stored(pg)['rev'] == 1, '★ 고치지 않고 저장하면 쓰지 않고 안내만(개정 번호 그대로)')
 click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); click(pg, 'cancel'); wait_read(pg); ok(pg.locator('[data-bd-edit]').count() == 0 and saved_n(pg) == n0, '취소하면 편집 화면이 닫히고 쓰지 않는다'); pg.close()

 print('── 충돌: 내 입력을 버리지 않고, 이어서 저장을 눌러야만 덮어쓴다')
 pg, errs = fresh(store={'q1': BD}); wait_read(pg); click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); set_row(pg, 0, amount='1,500,000')
 pg.evaluate("() => { const d = window.__STORE.gihoek_budgets.q1; d.history.push({ rev: 1, rows: d.rows, savedAt: d.savedAt, note: d.note, by: d.by }); d.rev = 2; d.rows = [{ cat: 'site', name: '다른 사람', amount: 7, memo: '', src: 'manual' }]; d.note = '다른 곳'; }")
 n0 = saved_n(pg); click(pg, 'save'); pg.wait_for_selector('[data-bd-act="conflict-continue"]'); t = card(pg)
 ok('다른 곳에서 먼저 바뀌었습니다(현재 r2)' in t and saved_n(pg) == n0, '★ 충돌이면 쓰지 않고 현재 개정(r2)을 알린다')
 ok(pg.input_value('[data-bd-k="amount"][data-bd-i="0"]') == '1,500,000' and pg.locator('[data-bd-edit]').count() == 1, '★ 내가 입력한 값(1,500,000)과 편집 화면이 그대로 남아 있다')
 click(pg, 'conflict-continue'); settle(pg); ok('r2' in card(pg) and '이어서 저장' in card(pg) and pg.locator('[data-bd-act="conflict-continue"]').count() == 0, '[이어서 저장]을 누르면 최신(r2) 기준이 된다는 안내')
 click(pg, 'save'); wait_read(pg); d = stored(pg); ok(d['rev'] == 3 and d['rows'][0]['amount'] == 1500000 and d['history'][-1]['rev'] == 2 and d['history'][-1]['rows'][0]['name'] == '다른 사람', '★ 이어서 저장하면 r3 이 되고 다른 사람이 저장한 r2 도 이력에 남는다(조용히 사라지지 않는다)')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()

 print('── 견적에서 가져오기: 투입비 한 줄 + 정할 항목은 금액 빈 행(저장 때 막힘)')
 pg, errs = fresh(); click(pg, 'new-import'); pg.wait_for_selector('[data-bd-import]'); t = pg.inner_text('[data-bd-import]')
 ok('EST-2026-001' in t and '200,000' in t and '정상 항목' not in t.split('정해야 할 항목')[0] and '네고 항목' in t and '산식 없음' in t and '금액만 직접 고침' in t, '★ 견적 패널: 최종 개정본·자동 투입비 200,000·정할 항목(네고·산식 없음)')
 click(pg, 'import-apply'); settle(pg); ok(pg.locator('[data-bd-body] tr').count() == 1 and pg.input_value('[data-bd-k="amount"][data-bd-i="0"]') == '200,000' and pg.input_value('[data-bd-k="cat"][data-bd-i="0"]') == '', '★ [투입비 가져오기]: 견적 투입비 한 줄(200,000, 비목 미배정)')
 click(pg, 'import-decisions'); settle(pg); ok(pg.locator('[data-bd-body] tr').count() == 3 and pg.input_value('[data-bd-k="amount"][data-bd-i="1"]') == '' and pg.input_value('[data-bd-k="name"][data-bd-i="1"]') == '네고 항목', '★ [정할 항목을 행으로 추가]: 금액이 빈 행 2개(원가를 추측해 채우지 않는다)')
 n0 = saved_n(pg); click(pg, 'save'); pg.wait_for_selector('[role=alert]'); ok(saved_n(pg) == n0 and '2번 행' in card(pg) and '금액' in card(pg), '★ 금액이 빈 행이 있으면 저장하지 않고 몇 번 행인지 알린다')
 click(pg, 'del-row', '[data-bd-i="2"]'); click(pg, 'del-row', '[data-bd-i="1"]'); settle(pg); set_row(pg, 0, cat='site'); click(pg, 'save'); wait_read(pg); d = stored(pg)
 ok(d['rev'] == 1 and len(d['rows']) == 1 and d['rows'][0]['src'] == 'est' and d['rows'][0]['estNo'] == 'EST-2026-001' and d['rows'][0]['amount'] == 200000 and d['rows'][0]['cat'] == 'site', '행을 지우고 비목을 골라 저장: 출처 est·견적 번호·200000·현장경비')
 click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); click(pg, 'import-open'); pg.wait_for_selector('[data-bd-import]'); click(pg, 'import-apply'); settle(pg)
 ok(pg.locator('[data-bd-body] tr').count() == 1 and pg.input_value('[data-bd-k="cat"][data-bd-i="0"]') == 'site', '★ 다시 가져와도 같은 견적 줄이라 중복 행이 생기지 않고 고른 비목(현장경비)이 유지된다')
 click(pg, 'import-close'); settle(pg); ok(pg.locator('[data-bd-import]').count() == 0, '[닫기]로 패널이 닫힌다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()

 print('── 오류·권한·깨진 문서')
 pg, errs = fresh(fail_read='permission-denied'); ok('관리자만' in card(pg) and pg.locator('[data-bd-act]').count() == 0, '★ 읽기 권한이 없으면 안내만(버튼 없음)'); pg.close()
 pg, errs = fresh(fail_read='unavailable'); ok('불러오지 못했습니다' in card(pg) and 'unavailable' in card(pg) and pg.locator('[data-bd-act="reload"]').count() == 1, '읽기 실패: 이유와 [다시 불러오기]')
 pg.evaluate('() => { window.__failBudgetRead = null; }'); click(pg, 'reload'); pg.wait_for_function("document.body.innerText.includes('아직 실행예산이 없습니다')", timeout=6000); ok(True, '[다시 불러오기] 뒤 정상 화면으로 돌아온다'); pg.close()
 pg, errs = fresh(store={'q1': {'pjtId': 'q1', 'rev': 0, 'rows': []}}); t = card(pg); ok('올바르지 않아 열 수 없습니다' in t and pg.locator('[data-bd-act="edit"]').count() == 0 and pg.locator('[data-bd-act="new"]').count() == 0, '★ 깨진 저장 문서: 이유만 보이고 수정·작성 버튼이 없다(그 위에 덮어쓰지 않는다)'); pg.close()
 pg, errs = fresh(store={'q1': BD}, fail_write='permission-denied'); wait_read(pg); click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); set_row(pg, 0, amount='9'); click(pg, 'save'); pg.wait_for_selector('[role=alert]')
 ok('관리자만 저장할 수 있습니다' in card(pg) and pg.locator('[data-bd-edit]').count() == 1 and pg.input_value('[data-bd-k="amount"][data-bd-i="0"]') == '9', '★ 쓰기 권한이 없으면 안내하고 내 입력은 그대로'); pg.close()
 pg, errs = fresh(store={'q1': BD}, fail_write='unavailable'); wait_read(pg); click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); set_row(pg, 0, amount='9'); click(pg, 'save'); pg.wait_for_selector('[role=alert]')
 ok('저장 실패' in card(pg) and 'unavailable' in card(pg) and pg.locator('[data-bd-act="save"]:not([disabled])').count() == 1, '쓰기 실패: 이유를 알리고 [저장]이 다시 눌린다(저장 중 상태에 갇히지 않는다)'); pg.close()

 print('── XSS · 모바일 폭 · 입력 중 커서')
 evil = dict(BD, rows=[{'cat': 'sub', 'name': '<img src=x onerror="window.__xss=1">', 'amount': 1, 'memo': '<script>window.__xss=2</script>', 'src': 'est', 'estNo': '<b>E</b>'}], note='<u>메모</u>')
 pg, errs = fresh(store={'q1': evil}); wait_read(pg); settle(pg)
 ok(pg.evaluate('window.__xss === undefined') and pg.evaluate("document.querySelector('[data-bd-read] img, [data-bd-read] script, [data-bd-read] b, [data-bd-read] u') === null"), '★ 읽기 화면: 이름·메모·견적 번호·저장 메모의 태그가 실행되지 않는다')
 click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); settle(pg); ok(pg.evaluate('window.__xss === undefined') and pg.input_value('[data-bd-k="name"][data-bd-i="0"]') == '<img src=x onerror="window.__xss=1">', '★ 편집 화면: 값이 글자 그대로 입력칸에 들어가고 실행되지 않는다'); pg.close()
 pg, errs = fresh(width=390, store={'q1': BD}); wait_read(pg)
 inside = pg.evaluate("[...document.querySelectorAll('[data-bd-read] tbody tr')].every((tr) => { const td = tr.querySelector('td[data-label=\"금액(원)\"]'); if (!td) return false; const r = td.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= 391; })")
 ok(inside, '★ 폰 폭(390px) 읽기 화면: 모든 행의 금액 칸이 화면 안에 보인다(카드로 바뀜)')
 hs = pg.evaluate("[...document.querySelectorAll('[data-bd-read] .jh-plan__sumcell strong')].map((e) => Math.round(e.getBoundingClientRect().height))")
 ok(len(hs) == 5 and max(hs) < 30, '★ 폰 폭(390px) 읽기 화면: 요약 5칸의 금액이 한 줄로 보인다(숫자가 중간에서 줄바꿈되지 않는다) — 높이 %s' % hs)
 click(pg, 'edit'); pg.wait_for_selector('[data-bd-edit]'); settle(pg)
 w = pg.evaluate('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })'); ok(w['sw'] <= w['iw'] + 1, '★ 폰 폭(390px) 편집 화면에서 페이지가 가로로 넘치지 않는다(표는 자기 영역 안에서만 스크롤) — %s' % w)

 cells = pg.evaluate("['cat', 'name', 'amount', 'memo'].map((k) => { const e = document.querySelector('[data-bd-k=\"' + k + '\"][data-bd-i=\"0\"]'); const r = e.getBoundingClientRect(); return { k, ok: r.width > 40 && r.left >= 0 && r.right <= 391 }; })")
 ok(all(c['ok'] for c in cells), '★ 폰 폭(390px) 편집 화면: 첫 행의 비목·내역·금액·메모 입력칸이 모두 화면 안에 보인다 — %s' % [c['k'] for c in cells if not c['ok']] if not all(c['ok'] for c in cells) else '★ 폰 폭(390px) 편집 화면: 첫 행의 비목·내역·금액·메모 입력칸이 모두 화면 안에 보인다')
 box = pg.evaluate("(() => { const r = document.querySelector('[data-bd-act=\"save\"]').getBoundingClientRect(); return { l: r.left, r2: r.right }; })()"); ok(box['l'] >= 0 and box['r2'] <= 391, '[저장] 버튼이 화면 안에 있다'); pg.close()
 pg, errs = fresh(); click(pg, 'new'); pg.wait_for_selector('[data-bd-edit]'); loc = pg.locator('[data-bd-k="amount"][data-bd-i="0"]'); loc.click(); loc.press_sequentially('1234567', delay=20)
 ok(loc.input_value() == '1234567' and pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-bd-k')") == 'amount', '★ 입력하는 동안 커서가 사라지지 않고 값이 그대로 쌓인다(입력마다 화면을 다시 그리지 않는다)')
 ok('1,234,567' in pg.inner_text('[data-bd-preview]'), '입력 중에도 미리보기 합계는 갱신된다'); pg.fill('[data-bd-k="amount"][data-bd-i="0"]', 'abc'); settle(pg); ok('입력 확인 필요' in pg.inner_text('[data-bd-preview]'), '읽을 수 없는 금액이면 미리보기에 "입력 확인 필요"')
 click(pg, 'del-row', '[data-bd-i="0"]'); settle(pg); ok(pg.locator('[data-bd-body] tr').count() == 1, '마지막 행을 지워도 빈 행 하나가 남는다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
 b.close()
print('\n' + ('전부 통과 (%d건)' % pass_n if not fail_n else '%d건 실패 / 통과 %d' % (fail_n, pass_n))); sys.exit(1 if fail_n else 0)
