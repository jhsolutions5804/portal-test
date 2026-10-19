"""견적 항목 "산식" 표 연결 시험 — 실제 크로미움·실제 화면 코드(plan/index.js·view·calc·formula)로 시험한다. 서버 접근(core/firebase.js)만 가짜(저장 요청은 그대로 기록).
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
SAVED_EST = {'e1': {'no': 'EST-2026-001', 'baseNo': 'EST-2026-001', 'rev': 1, 'status': 'active', 'title': '저장된 가짜 견적', 'date': '2026-10-01', 'pjtId': 'p1', 'clientId': 'c2', 'issuerId': 'c1', 'client': {'company': '가짜 거래처'}, 'issuer': {'company': '가짜 발행처'}, 'notes': '',
  'items': [{'name': '품목 1', 'spec': '', 'qty': 13, 'price': 474, 'amount': 6160, 'remark': '', 'calc': {'rows': [{'name': '구역 A', 'unit': '인', 'qty': '=2*18', 'price': '100', 'total': '', 'remark': ''}, {'name': '구역 B', 'unit': '인', 'qty': '20', 'price': '100', 'total': '', 'remark': ''}], 'markup': '10', 'unit': '10', 'count': '13'}}, {'name': '품목 2', 'spec': '', 'qty': 2, 'price': 50, 'amount': 100, 'remark': ''}]}}
DATA = {
  'gihoek_projects': {'p1': {'name': '가짜 프로젝트', 'code': 'FAKE-1', 'status': 'active'}},
  'gihoek_companies': {'c1': {'company': '가짜 발행처', 'roles': ['supplier'], 'contacts': []}, 'c2': {'company': '가짜 거래처', 'roles': ['client'], 'contacts': []}},
  'gihoek_estimates': {},
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
""" % json.dumps(dict(DATA, gihoek_estimates=SAVED_EST))
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
CSS = ''.join('<link rel=stylesheet href="%s/' + x + '">' for x in re.findall(r'href="(theme/[a-z]+\.css)[^"]*"', idx))
PAGE = ("""<!doctype html><meta charset=utf-8>%(css)s<div id=root></div>
<script type=module>import { mountEstimates } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountEstimates; window.__ready = true;</script>""") % {'css': CSS % tuple([BASE] * CSS.count('%s')), 'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK   ' + m)
    else: fail_n += 1; print('FAIL ' + m)
def safe(fn, default=None):
    try: return fn()
    except Exception as e: return default
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh(segs, empty=False):
        pg = b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        fb = FAKE_FB if not empty else FAKE_FB.replace(json.dumps(SAVED_EST), '{}')
        pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=fb))
        pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
        pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true', timeout=20000)
        pg.evaluate("(s) => window.__mount(document.getElementById('root'), { segs: s, q: {} }, { me: { admin: true, uid: 'u1', name: '가짜' } })", segs)
        return pg, errs
    def new_form(): 
        pg, errs = fresh(['new'], empty=True); pg.wait_for_selector('#es-rows', timeout=15000); return pg, errs
    def C(r, k): return '[data-ec-c="%s"][data-ec-r="%d"]' % (k, r)
    def M(k): return '[data-ec-m="%s"]' % k
    def open_calc(pg, i=0): pg.locator('[data-ec-open="%d"]' % i).click(); pg.wait_for_selector('[data-ec-box="%d"]' % i, timeout=5000)
    def put(pg, r, k, v): pg.locator(C(r, k)).fill(v); pg.wait_for_timeout(30)
    def good(pg):
        put(pg, 0, 'name', '구역 A'); put(pg, 0, 'unit', '인'); put(pg, 0, 'qty', '=2*18'); put(pg, 0, 'price', '100')
        pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80)
        put(pg, 1, 'name', '구역 B'); put(pg, 1, 'unit', '인'); put(pg, 1, 'qty', '20'); put(pg, 1, 'price', '100')
        pg.locator(M('unit')).fill('10'); pg.locator(M('count')).fill('13'); pg.wait_for_timeout(60)

    print('── 열기·닫기')
    pg, errs = new_form()
    ok(pg.locator('[data-ec-open]').count() == 2, '새 견적 화면의 기본 항목 2줄에 각각 "산식" 버튼이 있음')
    open_calc(pg, 0)
    ok(pg.locator('[data-ec-box]').count() == 1 and pg.locator('thead th').filter(has_text='내역').count() >= 1, '★ "산식"을 누르면 그 항목 아래에 표가 열림')
    heads = pg.evaluate("[...document.querySelectorAll('[data-ec-box] thead th')].map(t => t.textContent.trim()).filter(Boolean)"); heads = [re.sub(r'\s+', ' ', h) for h in heads]; ok(heads == ['번호', '내역 A', '단위 B', '수량 C', '단가 D', '합계 E', '비고 F'], '★ 열: 번호·내역 A·단위 B·수량 C·단가 D·합계 E·비고 F (실제 화면: %s)' % heads)
    ok(pg.locator('tr[data-ec-r]').count() == 1 and pg.locator(M('markup')).input_value() == '10' and pg.locator(M('unit')).input_value() == '100000' and pg.locator(M('count')).input_value() == '', '새 표: 빈 행 1개, 가산율 10 · 내림 단위 100000 · 총 대수 비어 있음')
    ok(pg.locator('[data-ec-apply]').is_disabled(), '내역을 안 쓴 동안 "항목에 넣기"는 비활성')
    pg.locator('[data-ec-open="0"]').click(); pg.wait_for_timeout(80); ok(pg.locator('[data-ec-box]').count() == 0, '같은 "산식"을 다시 누르면 닫힘')
    open_calc(pg, 0); pg.locator('[data-ec-close]').click(); pg.wait_for_timeout(80); ok(pg.locator('[data-ec-box]').count() == 0, '"닫기" 버튼으로도 닫힘')
    ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음: %s' % errs[:2]); pg.close()

    print('── 계산 블록은 항목 표 밖에 놓임(폰 폭에서 잘리지 않게)')
    pg, errs = new_form(); open_calc(pg, 1)
    ok(pg.evaluate("(() => { const b = document.querySelector('[data-ec-box]'); return !!b && !b.closest('table') && b.parentElement.id === 'es-calc'; })()"), '★ 계산 블록이 항목 표(<table>) 안이 아니라 표 뒤의 #es-calc 안에 있음')
    ok('품목 2 산식' in pg.locator('[data-ec-box]').inner_text(), '★ 두 번째 품목에서 열면 제목이 "품목 2 산식"')
    ok(pg.locator('[data-ec-open="1"]').get_attribute('aria-expanded') == 'true' and pg.locator('[data-ec-open="0"]').get_attribute('aria-expanded') in (None, 'false'), '열린 품목의 "산식" 버튼에만 aria-expanded=true')
    open_calc(pg, 0); ok(pg.locator('[data-ec-box]').count() == 1 and 'rowspan' not in pg.content().lower() and '품목 1 산식' in pg.locator('[data-ec-box]').inner_text(), '다른 품목에서 열면 앞의 블록이 닫히고 하나만 열림(제목 "품목 1 산식")')
    pg.locator('[data-ec-close]').click(); pg.wait_for_timeout(80); ok(pg.locator('[data-ec-open="0"]').get_attribute('aria-expanded') in (None, 'false') and pg.locator('#es-calc').inner_html().strip() == '', '닫으면 블록이 비고 aria-expanded 가 풀림'); pg.close()

    print('── 폰 폭(390px): 입력칸과 버튼이 화면 안에 있음')
    pg = b.new_page(viewport={'width': 390, 'height': 1600}); pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB.replace(json.dumps(SAVED_EST), '{}'))); pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
    pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true'); pg.evaluate("() => window.__mount(document.getElementById('root'), { segs: ['new'], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' } })"); pg.wait_for_selector('#es-rows')
    open_calc(pg, 0); good(pg); pg.wait_for_timeout(100)
    def inside(sel):
        bb = safe(lambda: pg.locator(sel).first.bounding_box()); return bool(bb) and bb['x'] >= -1 and bb['x'] + bb['width'] <= 391
    ok(inside('[data-ec-m="markup"]') and inside('[data-ec-m="count"]'), '★ 폰에서도 가산율·총 장비 대수 입력칸이 화면 폭 안에 보임(항목 표 폭 784px 를 따라 밀리지 않음)')
    ok(inside('[data-ec-apply]') and inside('[data-ec-close]'), '★ "항목에 넣기"·"닫기" 버튼이 화면 안에 보임')
    ok(pg.evaluate("document.documentElement.scrollWidth <= 391"), '페이지 전체가 가로로 넘치지 않음(가로 스크롤은 표 안에서만)')
    ok(pg.evaluate("(() => { const s = document.querySelector('[data-ec-box] .jh-plan__scroll'); return !!s && s.scrollWidth >= s.clientWidth; })()"), '내역 표는 블록 안의 자체 가로 스크롤 영역에 있음')
    pg.close()

    print('── 입력할 때 결과가 바로 바뀌고 커서가 유지됨')
    pg, errs = new_form(); open_calc(pg)
    pg.locator(C(0, 'name')).evaluate('el => { el.dataset.mark = "keep"; }')
    q = pg.locator(C(0, 'qty')); q.click(); q.type('=2*18', delay=15)
    ok(pg.evaluate("document.activeElement.getAttribute('data-ec-c')") == 'qty' and q.input_value() == '=2*18', '★ 수량에 수식을 입력하는 동안 입력칸과 포커스가 그대로')
    put(pg, 0, 'price', '100')
    ok(pg.locator(C(0, 'name')).get_attribute('data-mark') == 'keep', '★ 다른 칸을 입력해도 입력칸 DOM 이 교체되지 않음(표시를 남긴 칸이 그대로)')
    ok(pg.locator(C(0, 'total')).get_attribute('placeholder') == '3,600', '★ 합계 칸에 수량×단가 = 3,600 이 자동으로 보임(연한 글자)')
    ok(pg.locator(C(0, 'total')).input_value() == '' and pg.locator(C(0, 'total')).get_attribute('data-ec-auto') == 'true', '자동 합계 칸의 값은 비어 있음(고정이 아님)')
    pg.locator(M('count')).fill('13'); pg.locator(M('unit')).fill('10'); pg.wait_for_timeout(60)
    txt = pg.locator('[data-ec-sum]').inner_text(); ok('3,600' in txt and '3,960' in txt, '★ 소계 3,600 · 견적가 3,960(가산 10%%) 이 바로 보임 (실제: %s)' % txt.replace('\n', ' ')[:70])
    ok(pg.locator('[data-ec-apply]').is_enabled(), '계산되면 "항목에 넣기"가 눌림'); pg.close()

    print('── 엑셀처럼 칸을 가리키는 수식(대표님이 쓰신 =e1*c2)')
    pg, errs = new_form(); open_calc(pg); pg.locator(M('unit')).fill('1')
    put(pg, 0, 'name', '인건비'); put(pg, 0, 'unit', '인'); put(pg, 0, 'qty', '2'); put(pg, 0, 'price', '7000')
    pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80)
    put(pg, 1, 'name', '출장 할증'); put(pg, 1, 'unit', '식'); put(pg, 1, 'qty', '1.1'); put(pg, 1, 'price', '=e1*c2'); pg.wait_for_timeout(80)
    ok(pg.locator('tr[data-ec-err]').count() == 0 and pg.locator('tr[data-ec-errrow]').count() == 0, '★ 단가 =e1*c2 가 오류 없이 받아들여짐(예전에는 "수식에는 숫자와 + - × ÷ ( ) % 만 쓸 수 있습니다" 로 거부)')
    ok(pg.locator(C(1, 'total')).get_attribute('placeholder') == '16,940', '★ 2행 합계 = 수량 1.1 × 단가(E1 14,000 × C2 1.1 = 15,400) = 16,940 (수식은 쓴 그대로 계산)')
    put(pg, 1, 'price', '=e1'); ok(pg.locator(C(1, 'total')).get_attribute('placeholder') == '15,400' and '29,400' in pg.locator('[data-ec-sum]').inner_text(), '단가를 =e1 로 고치면 1.1 × 14,000 = 15,400, 소계 29,400')
    put(pg, 1, 'price', '=a1'); ok(pg.locator('tr[data-ec-err]').count() == 1 and '글자 칸' in pg.locator('tr[data-ec-errrow]').inner_text(), '글자 칸(A 내역)을 가리키면 그 행에 이유가 보임')
    put(pg, 1, 'price', '=d2'); ok(pg.locator('tr[data-ec-err]').count() == 1 and '순환' in pg.locator('tr[data-ec-errrow]').inner_text(), '★ 자기 행을 가리키는 순환 참조는 오류(화면이 멈추지 않음)')
    put(pg, 1, 'price', '=e1'); pg.locator(M('count')).fill('=c1+c2'); pg.wait_for_timeout(80)
    ok(pg.locator('[data-ec-apply]').is_enabled() and pg.locator(M('count')).input_value() == '=c1+c2', '총 장비 대수에 =c1+c2 (2 + 1.1 = 3.1)를 써도 오류 없이 계산되어 항목에 넣을 수 있음')
    pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80); put(pg, 2, 'name', '합계 행'); put(pg, 2, 'total', '=SUM(e1:e2)'); pg.wait_for_timeout(80)
    ok('58,800' in pg.locator('[data-ec-sum]').inner_text() and pg.locator(C(2, 'total')).get_attribute('data-ec-fixed') == 'true', '★ 3행 합계를 =SUM(e1:e2)(14,000 + 15,400 = 29,400)로 고정하면 소계 = 14,000 + 15,400 + 29,400 = 58,800')
    pg.close()

    print('── 행을 지우면 수식의 행 번호가 따라감')
    pg, errs = new_form(); open_calc(pg)
    put(pg, 0, 'name', '맨 위'); put(pg, 0, 'qty', '9'); put(pg, 0, 'price', '9')
    pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80); put(pg, 1, 'name', '인건비'); put(pg, 1, 'qty', '2'); put(pg, 1, 'price', '7000')
    pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80); put(pg, 2, 'name', '할증'); put(pg, 2, 'qty', '1.1'); put(pg, 2, 'price', '=e2')
    ok(pg.locator(C(2, 'total')).get_attribute('placeholder') == '15,400', '삭제 전: 3행 단가 =e2(2행 합계 14,000) → 합계 15,400')
    pg.locator('[data-ec-del="0"]').click(); pg.wait_for_timeout(100)
    ok(pg.locator(C(1, 'price')).input_value() == '=e1' and pg.locator(C(1, 'total')).get_attribute('placeholder') == '15,400' and pg.locator('tr[data-ec-err]').count() == 0, '★ 맨 위 행을 지워도 할증 행의 =e2 가 =e1 로 따라가 같은 칸(인건비)을 가리키고 금액이 그대로 15,400')
    pg.locator('[data-ec-del="0"]').click(); pg.wait_for_timeout(100)
    ok(pg.locator('tr[data-ec-err]').count() == 1 and '삭제' in pg.locator('tr[data-ec-errrow]').inner_text() and pg.locator(C(0, 'price')).input_value() == '=#REF!' and pg.locator('[data-ec-apply]').is_disabled(), '★ 가리키던 행(인건비)을 지우면 =#REF! 가 되고 "삭제된 칸" 오류로 막혀 항목에 넣을 수 없음(조용히 틀린 금액이 안 나옴)')
    pg.close()

    print('── 행 삭제가 총 대수 칸의 수식도 따라감')
    pg, errs = new_form(); open_calc(pg); put(pg, 0, 'qty', '5'); put(pg, 0, 'price', '10')
    pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80); put(pg, 1, 'qty', '8'); put(pg, 1, 'price', '10')
    pg.locator(M('unit')).fill('1'); pg.locator(M('count')).fill('=c2'); pg.wait_for_timeout(60)
    sm0 = pg.locator('[data-ec-sum]').inner_text(); ok('130' in sm0 and '143' in sm0 and '18' in sm0, '삭제 전: 소계 130 · 견적가 143 · 총 대수 =c2 (8) → 대당 143 ÷ 8 = 17.875 → 18 (실제: %s)' % sm0.replace(chr(10), ' ')[:60])
    pg.locator('[data-ec-del="0"]').click(); pg.wait_for_timeout(100)
    ok(pg.locator(M('count')).input_value() == '=c1', '★ 1행을 지우면 총 장비 대수 칸의 =c2 가 =c1 로 화면에도 바로 바뀜'); pg.close()

    print('── 합계 고정·해제')
    pg, errs = new_form(); open_calc(pg); good(pg)
    put(pg, 1, 'total', '2500')
    ok(pg.locator(C(1, 'total')).get_attribute('data-ec-fixed') == 'true' and pg.locator(C(1, 'total')).get_attribute('data-ec-auto') == 'false', '★ 합계 칸에 쓰면 그 행이 고정으로 바뀜')
    txt = pg.locator('[data-ec-sum]').inner_text(); ok('6,100' in txt, '★ 소계가 고정값을 반영해 6,100 (3,600 + 2,500)')
    put(pg, 1, 'total', ''); ok(pg.locator(C(1, 'total')).get_attribute('data-ec-auto') == 'true' and pg.locator(C(1, 'total')).get_attribute('data-ec-fixed') is None, '지우면 자동으로 돌아감')
    ok('5,600' in pg.locator('[data-ec-sum]').inner_text(), '소계가 5,600 으로 복귀'); pg.close()

    print('── 행 추가·삭제')
    pg, errs = new_form(); open_calc(pg)
    pg.locator('[data-ec-add]').click(); pg.wait_for_timeout(80)
    ok(pg.locator('tr[data-ec-r]').count() == 2 and pg.evaluate("document.activeElement.getAttribute('data-ec-c') + document.activeElement.getAttribute('data-ec-r')") == 'name1', '★ 행 추가 → 2행이 되고 새 행의 내역 칸에 포커스')
    ok(pg.locator('tr[data-ec-r] td.jh-plan__ecno').all_inner_texts() == ['1', '2'], '번호가 1, 2 로 자동')
    put(pg, 0, 'name', '앞 행'); put(pg, 1, 'name', '뒤 행')
    pg.locator('[data-ec-del="0"]').click(); pg.wait_for_timeout(80)
    ok(pg.locator('tr[data-ec-r]').count() == 1 and pg.locator(C(0, 'name')).input_value() == '뒤 행', '★ 첫 행을 지우면 뒤 행이 올라옴(순서·내용 유지)')
    pg.locator('[data-ec-del="0"]').click(); pg.wait_for_timeout(80)
    ok(pg.locator('tr[data-ec-r]').count() == 1 and pg.locator(C(0, 'name')).input_value() == '', '★ 마지막 행을 지워도 빈 행 1개가 남음(표가 사라지지 않음)')
    for _ in range(61): safe(lambda: (pg.locator('[data-ec-add]').click(timeout=800), pg.wait_for_timeout(15)))
    ok(pg.locator('tr[data-ec-r]').count() == 60, '★ 행은 60개까지만 늘어남(실제 %d)' % pg.locator('tr[data-ec-r]').count()); pg.close()

    print('── 오류 행')
    pg, errs = new_form(); open_calc(pg); good(pg); put(pg, 1, 'qty', '=1/0')
    ok(pg.locator('tr[data-ec-err="true"]').count() == 1 and '0 으로 나눌 수 없습니다' in pg.locator('tr[data-ec-errrow]').inner_text(), '★ 틀린 행에만 오류 표시와 이유가 붙음')
    ok(pg.locator('[data-ec-apply]').is_disabled(), '★ 오류가 있으면 "항목에 넣기"가 비활성')
    pg.locator('[data-es-it="0:amount"]').fill('500')
    safe(lambda: pg.locator('[data-ec-apply]').click(force=True, timeout=500)); pg.wait_for_timeout(80)
    ok(pg.locator('[data-es-it="0:amount"]').input_value() == '500', '★ 거부된 계산은 눌러도 항목을 바꾸지 않음(미리 넣은 금액 500 유지)')
    put(pg, 1, 'qty', '20'); ok(pg.locator('tr[data-ec-err]').count() == 0 and pg.locator('[data-ec-apply]').is_enabled(), '고치면 오류가 사라지고 버튼이 다시 눌림'); pg.close()

    print('── 항목에 넣기')
    pg, errs = new_form(); pg.locator('[data-es-it="0:name"]').fill('가짜 품목'); open_calc(pg); good(pg)
    ok('다릅니다' in pg.locator('[data-ec-sum]').inner_text(), '넣기 전에는 항목 값과 계산 결과가 다르다는 알림이 보임')
    pg.locator('[data-ec-apply]').click(); pg.wait_for_timeout(120)
    ok(pg.locator('[data-es-it="0:qty"]').input_value() == '13', '★ 수량 = 총 장비 대수 13')
    ok(pg.locator('[data-es-it="0:amount"]').input_value() == '6,160', '★ 금액 = 견적가 6,160 (5,600 × 1.1)')
    ok(pg.locator('[data-es-it="0:price"]').input_value() == '474', '단가 = 대당 금액 474(반올림)')
    ok(pg.locator('[data-es-it="0:name"]').input_value() == '가짜 품목', '품명은 건드리지 않음')
    ok(pg.locator('#es-supply').input_value() == '6,160', '★ 견적 합계(공급가액)가 6,160 으로 갱신됨')
    ok('다릅니다' not in pg.locator('[data-ec-sum]').inner_text(), '★ 넣은 뒤에는 어긋남 알림이 사라짐')
    ok(pg.locator('[data-ec-box]').count() == 1 and pg.locator('[data-ec-open="0"]').get_attribute('data-ec-has') is None, '넣은 뒤에도 표는 열려 있음(값을 고쳐 다시 넣을 수 있음)')
    put(pg, 1, 'qty', '25'); ok('다릅니다' in pg.locator('[data-ec-sum]').inner_text(), '표를 고치면 다시 어긋남 알림이 생김')
    pg.close()

    print('── 번호 어긋남 방지')
    pg, errs = new_form(); pg.locator('[data-es-act="add-row"]').click(); pg.locator('[data-es-act="add-row"]').click(); pg.wait_for_timeout(80)
    open_calc(pg, 1); good(pg); pg.locator('[data-ec-apply]').click(); pg.wait_for_timeout(100)
    ok(pg.locator('[data-es-it="1:amount"]').input_value() == '6,160' and pg.locator('[data-es-it="0:amount"]').input_value() in ('0', '') and pg.locator('[data-es-it="2:amount"]').input_value() in ('0', ''), '★ 두 번째 항목(1번)에서 열어 넣으면 1번에만 들어가고 다른 항목은 그대로')
    pg.locator('[data-es-del="0"]').click(); pg.wait_for_timeout(120)
    ok(pg.locator('[data-ec-box]').count() == 0 and pg.locator('[data-es-it="0:amount"]').input_value() == '6,160', '★ 항목을 지우면 열린 표는 닫히고, 데이터에서 다시 그려도 옛 1번이 0번 자리에 값을 그대로 가짐')
    ok(pg.locator('[data-ec-open="0"]').get_attribute('data-ec-has') == 'true', '★ 그 항목은 산식 ✓ 표시(내역 데이터가 항목을 따라 이동함 — 삭제로 사라지지 않음)')
    open_calc(pg, 0); ok(pg.locator(C(0, 'name')).input_value() == '구역 A' and pg.locator(C(1, 'name')).input_value() == '구역 B' and pg.locator(M('count')).input_value() == '13', '★ 다시 열면 쓴 내역(구역 A·B·총 대수 13)이 그대로 보임')
    pg.locator('[data-es-act="add-row"]').click(); pg.wait_for_timeout(80)
    ok(pg.locator('[data-ec-box]').count() == 0, '항목을 추가하면 열린 표는 닫힘')
    pg.locator('[data-ec-open="0"]').click(); pg.wait_for_timeout(250)
    ok(pg.locator('[data-ec-box="0"]').count() == 1, '★ 닫힌 뒤 같은 번호를 다시 누르면 열림 — 옛 열림 상태가 남아 "닫으려는 것"으로 오판하지 않음')
    ok(safe(lambda: pg.locator(C(0, 'name')).input_value(), '') == '구역 A', '닫혀도 내역은 항목에 남아 있어 다시 열면 그대로'); pg.close()

    print('── 저장: 문서에 산식 표가 실려 서버로 나감')
    pg, errs = new_form(); pg.locator('[data-es-f="title"]').fill('가짜 새 견적'); pg.locator('[data-es-it="0:name"]').fill('품목 1'); open_calc(pg); good(pg); pg.locator('[data-ec-apply]').click(); pg.wait_for_timeout(100)
    pg.locator('[data-es-it="1:name"]').fill('일반 품목'); pg.locator('[data-es-it="1:price"]').fill('50'); pg.wait_for_timeout(50)
    pg.locator('[data-es-act="save"]').click(); pg.wait_for_function('window.__saved.length > 0', timeout=6000)
    sv = pg.evaluate('window.__saved.filter(s => s.col === "gihoek_estimates")'); doc0 = sv[0]['data'] if sv else {}
    items = doc0.get('items', []); ok(len(sv) == 1 and len(items) == 2, '★ 견적이 1건 저장되고 품목 2개가 서버로 나감')
    c0 = items[0].get('calc') if items else None
    ok(bool(c0) and len(c0['rows']) == 2 and c0['rows'][0]['qty'] == '=2*18' and c0['count'] == '13' and c0['markup'] == '10' and c0['unit'] == '10', '★ 저장 문서의 첫 품목에 산식 표(행 2개·수식 글자 =2*18·총 대수 13)가 그대로 실림')
    ok(items and items[0]['amount'] == 6160 and items[0]['qty'] == 13, '품목의 수량·금액은 기존처럼 저장')
    ok(items and 'calc' not in items[1], '★ 산식을 쓰지 않은 품목은 문서 모양이 예전과 같음(calc 키 없음)'); pg.close()

    print('── 다시 열기: 저장된 견적을 개정으로 열면 표가 복원됨')
    pg, errs = fresh(['e1']); pg.wait_for_selector('[data-es-act="edit"]', timeout=15000)
    pg.locator('[data-es-act="edit"]').click(); pg.wait_for_selector('#es-rows', timeout=8000)
    ok(pg.locator('[data-ec-open="0"]').get_attribute('data-ec-has') == 'true' and pg.locator('[data-ec-open="1"]').get_attribute('data-ec-has') is None, '★ 개정 화면에서 산식이 저장된 품목 1 에만 "산식 ✓" 표시')
    open_calc(pg, 0)
    ok(pg.locator(C(0, 'name')).input_value() == '구역 A' and pg.locator(C(0, 'qty')).input_value() == '=2*18' and pg.locator(C(1, 'name')).input_value() == '구역 B' and pg.locator(M('count')).input_value() == '13', '★ 표가 저장했던 그대로 복원됨(구역 A·B, 수식 =2*18 글자, 총 대수 13)')
    ok(pg.locator(C(0, 'total')).get_attribute('placeholder') == '3,600' and '5,600' in pg.locator('[data-ec-sum]').inner_text(), '복원한 표를 다시 계산하면 같은 값(구역 A 3,600 · 소계 5,600)')
    ok('다릅니다' not in pg.locator('[data-ec-sum]').inner_text(), '항목의 수량·금액이 저장했던 계산 결과와 같아 어긋남 알림이 없음(수량 13 · 금액 6,160)')
    put(pg, 1, 'qty', '25'); pg.locator('[data-ec-apply]').click(); pg.wait_for_timeout(100)
    ok(pg.locator('[data-es-it="0:amount"]').input_value() == '6,710', '★ 개정에서 내역을 고쳐(구역 B 수량 20→25: 3,600+2,500=6,100) 항목에 넣으면 금액이 6,710 으로 바뀜')
    pg.locator('[data-es-act="save"]').click(); pg.wait_for_function('window.__saved.length > 0', timeout=6000)
    sv = pg.evaluate('window.__saved.filter(s => s.col === "gihoek_estimates")'); rev = [s for s in sv if s['data'].get('rev') == 2]
    ok(len(rev) == 1 and rev[0]['data']['items'][0]['calc']['rows'][1]['qty'] == '25', '★ 개정본(r2)이 고친 내역(25)과 함께 저장됨')
    orig = [s for s in sv if s['id'] == 'e1']; ok(all('calc' not in s['data'].get('items', [{}])[0] for s in orig) or all(s['data'].get('status') == 'void' for s in orig), '원본은 폐기 처리만 되고 산식 내역은 건드리지 않음')
    pg.close()
    b.close()
ok(pass_n + fail_n >= 75, '★ 시험 전체가 끝까지 실행됨(%d건 ≥ 75) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
