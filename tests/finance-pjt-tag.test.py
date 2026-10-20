"""재무회계 "프로젝트 표시" 탭 연결 시험 — 실제 크로미움·실제 화면 코드(finance/index.js·view.js)·실제 확인창(core/dialog.js)으로 시험한다.
서버 호출(core/firebase.js)만 가짜로 바꾸고, 호출 인자를 그대로 기록해 "무엇이 몇 번 서버로 나갔는지"를 확인한다(가짜 확인창이 취소 버그를 가렸던 2026-10-18 사건의 교훈: 확인창은 가짜로 두지 않는다).
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

DATA = {
  'ledger_entries': {
    'e1': {'no': '2026-0001', 'seq': 1, 'date': '2026-07-31', 'memo': '매출 가짜회사 · 2026년 07월 용역비', 'status': 'posted', 'source': {'kind': 'manual', 'id': ''}, 'lines': [{'account': '1100', 'side': 'D', 'amount': 1000, 'partner': '가짜회사'}, {'account': '4010', 'side': 'C', 'amount': 1000, 'partner': '가짜회사'}]},
    'e2': {'no': '2026-0002', 'seq': 2, 'date': '2026-07-31', 'memo': '매입 가짜외주', 'status': 'posted', 'source': {'kind': 'manual', 'id': ''}, 'lines': [{'account': '5210', 'side': 'D', 'amount': 500, 'partner': '가짜외주'}, {'account': '2020', 'side': 'C', 'amount': 500, 'partner': '가짜외주'}]},
    'e3': {'no': '2026-0003', 'seq': 3, 'date': '2026-07-31', 'memo': '매입 가짜소모품', 'status': 'posted', 'source': {'kind': 'manual', 'id': ''}, 'lines': [{'account': '5340', 'side': 'D', 'amount': 40, 'partner': '가짜소모품'}, {'account': '2020', 'side': 'C', 'amount': 40, 'partner': '가짜소모품'}]},
    'e4': {'no': '2026-0004', 'seq': 4, 'date': '2026-08-31', 'memo': '매출 가짜회사 · 2026년 08월 용역비', 'status': 'posted', 'source': {'kind': 'manual', 'id': ''}, 'lines': [{'account': '1100', 'side': 'D', 'amount': 900, 'partner': '가짜회사'}, {'account': '4010', 'side': 'C', 'amount': 900, 'partner': '가짜회사'}]},
  },
  'ledger_pjt_proposals': {
    'e1_1': {'entryId': 'e1', 'lineIdx': 1, 'method': '공수비율', 'splits': [{'pjt': 'pA', 'amount': 600}, {'pjt': 'pB', 'amount': 400}], 'status': 'proposed', 'basisMonth': '2026-07', 'warn': '', 'note': ''},
    'e2_0': {'entryId': 'e2', 'lineIdx': 0, 'method': '수동', 'splits': [], 'status': 'proposed', 'basisMonth': '2026-07', 'warn': '', 'note': '2026-07 공수 없음 — 직접 지정해 주세요'},
    'e3_0': {'entryId': 'e3', 'lineIdx': 0, 'method': '직접', 'splits': [{'pjt': 'pA', 'amount': 40}], 'status': 'proposed', 'basisMonth': '2026-07', 'warn': '', 'note': ''},
    'e4_1': {'entryId': 'e4', 'lineIdx': 1, 'method': '공수비율', 'splits': [{'pjt': 'pA', 'amount': 900}], 'status': 'proposed', 'basisMonth': '2026-08', 'warn': '', 'note': ''},
  },
  'ledger_pjt_tags': {},
  'pjt_registry': {'pA': {'name': '가짜 프로젝트 A'}, 'pB': {'name': '가짜 프로젝트 B'}},
}
FAKE_FB = """
const DATA = %s; window.__calls = []; window.__mode = window.__mode || 'ok';
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]);
export const getDoc = async (r) => { const v = (DATA[r.__col] || {})[r.__id]; return { exists: () => v !== undefined, data: () => v }; };
export const httpsCallable = (f, name) => async (p) => {
  window.__calls.push(JSON.parse(JSON.stringify(p)));
  if (window.__fail && window.__fail[p.action]) throw Object.assign(new Error(window.__fail[p.action]), { code: 'internal' });
  if (window.__resp && window.__resp[p.action] !== undefined) return { data: typeof window.__resp[p.action] === 'function' ? window.__resp[p.action](p) : window.__resp[p.action] };
  if (p.action === 'pjtTagClear') { await new Promise((r) => setTimeout(r, window.__delay || 200)); if (window.__mode === 'rejectclear') throw Object.assign(new Error('이미 마감된 달이라 해제할 수 없습니다(시험 거부 사유)'), { code: 'failed-precondition' }); const id = p.entryId + '_' + p.lineIdx; DATA.ledger_pjt_tags[id] = { status: 'cleared', entryId: p.entryId, lineIdx: p.lineIdx, splits: [], method: '' }; return { data: { ok: true } }; }
  if (p.action === 'pjtTagSet') { await new Promise((r) => setTimeout(r, window.__delay || 200)); if (window.__mode === 'reject') throw Object.assign(new Error('분할 금액의 합이 줄 금액과 다릅니다(시험 거부 사유)'), { code: 'invalid-argument' }); const id = p.entryId + '_' + p.lineIdx; DATA.ledger_pjt_tags[id] = { status: 'confirmed', entryId: p.entryId, lineIdx: p.lineIdx, splits: p.splits, method: p.method }; return { data: { ok: true, id } }; }
  if (p.action === 'pjtTagBatch') { await new Promise((r) => setTimeout(r, window.__delay || 200));
    if (window.__mode === 'reject') return { data: { saved: [], rejected: p.items.map((x, i) => ({ index: i, code: 'invalid-argument', message: '합계가 맞지 않는 시험 거부 사유' })) } };
    p.items.forEach((x) => { const id = x.entryId + '_' + x.lineIdx; DATA.ledger_pjt_tags[id] = Object.assign({ status: 'confirmed', entryId: x.entryId, lineIdx: x.lineIdx, splits: x.splits }, {}); });
    return { data: { saved: p.items.map((x, i) => ({ index: i, id: x.entryId + '_' + x.lineIdx })), rejected: [] } }; }
  return { data: { ok: true } };
};
export const onAuthStateChanged = () => {}; export const serverTimestamp = () => 0; export const updateDoc = async () => {}; export const setDoc = async () => {}; export const addDoc = async () => {}; export const deleteDoc = async () => {}; export const writeBatch = () => ({}); export const Timestamp = {}; export const documentId = () => ({}); export const deleteField = () => ({}); export const arrayUnion = () => ({}); export const arrayRemove = () => ({});
""" % json.dumps(DATA)
PAGE = """<!doctype html><meta charset=utf-8><link rel=stylesheet href="%(b)s/theme/tokens.css"><link rel=stylesheet href="%(b)s/theme/base.css"><link rel=stylesheet href="%(b)s/theme/components.css"><link rel=stylesheet href="%(b)s/theme/finance.css"><div id=root></div>
<script type=module>import { mount } from "%(b)s/modules/finance/index.js?v=%(v)s"; window.__mount = mount; window.__ready = true;</script>""" % {'b': BASE, 'v': VER}

pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK   ' + m)
    else: fail_n += 1; print('FAIL ' + m)

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        def fresh(mode='ok', delay=200):
            pg = b.new_page(viewport={'width': 1200, 'height': 900}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
            pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
            pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true', timeout=20000)
            pg.evaluate("([m, d]) => { window.__mode = m; window.__delay = d; }", [mode, delay])
            pg.evaluate("() => window.__mount(document.getElementById('root'), { segs: ['pjt'], q: {} }, { me: { admin: true, uid: 'u1' } })")
            return pg, errs
        calls = lambda pg: pg.evaluate('window.__calls.filter(c => c.action === "pjtTagBatch")')

        print('── 탭 열기')
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        ok(pg.locator('.jh-fin__ptrow').count() == 4, '대기 줄 4개가 그려짐(전표 4건의 대상 줄: 7월 3 + 8월 1)')
        ok('가짜 프로젝트 A' in pg.inner_text('.jh-fin__pjttag') and '가짜 프로젝트 B' in pg.inner_text('.jh-fin__pjttag'), '프로젝트 이름이 보임(id 가 아니라 이름)')
        ok(pg.locator('[data-pt-row]:disabled').count() == 1, '확정할 수 없는 줄(수동) 1개만 체크박스가 비활성')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음: %s' % [e for e in errs][:2])

        print('── 확정 취소')
        pg.locator('[data-pt-confirm-month="2026-07"]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000)
        ok('2줄' in pg.inner_text('.jh-dialog'), '★ 확인창이 뜨고 확정할 줄 수(2줄 — 수동 줄 제외)를 알려 줌')
        pg.locator('.jh-dialog button[data-cancel]').click(); pg.wait_for_timeout(400)
        ok(len(calls(pg)) == 0, '★ 확인창에서 취소하면 서버 호출이 0번(취소가 무시되던 버그 재발 방지)')
        ok(pg.locator('.jh-dialog').count() == 0, '취소하면 확인창이 닫힘')

        print('── 확정')
        pg.locator('[data-pt-confirm-month="2026-07"]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000)
        pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagBatch")', timeout=5000); pg.wait_for_timeout(700)
        cs = calls(pg); ok(len(cs) == 1, '★ 확정하면 서버 pjtTagBatch 가 1번 호출됨')
        items = cs[0]['items'] if cs else []
        ok(len(items) == 2 and sorted(x['entryId'] for x in items) == ['e1', 'e3'], '★ 요청 항목은 확정할 수 있는 2줄(e1·e3) — 수동 줄(e2)은 보내지 않음')
        it = next((x for x in items if x['entryId'] == 'e1'), {}); ok(it.get('lineIdx') == 1 and it.get('method') == '공수비율' and sum(s['amount'] for s in it.get('splits', [])) == 1000 and set(it.keys()) == {'entryId', 'lineIdx', 'method', 'splits', 'note', 'basis'}, '요청 한 건의 모양이 서버가 받는 형식(필요한 필드만, 분할 합 = 줄 금액)')
        ok('2줄을 확정했습니다' in pg.inner_text('.jh-fin__pjttag'), '완료 메시지가 보임')
        ok(pg.locator('.jh-fin__ptrow').count() == 2, '확정한 줄은 대기 목록에서 사라지고 남은 줄(7월 수동 1개 + 8월 1개)만 보임')
        ok(all(x['entryId'] != 'e4' for x in items), '★ "이 달 전부 확정"은 그 달(7월) 줄만 보내고 다른 달(8월) 줄은 보내지 않음')
        ok('8월' in pg.inner_text('.jh-fin__pjttag') or '2026-08' in pg.inner_text('.jh-fin__pjttag'), '확정하지 않은 8월 줄은 그대로 보임')
        ok(pg.locator('[data-pt-confirm-month="2026-07"]').is_disabled() and pg.locator('[data-pt-confirm-month="2026-08"]').is_enabled(), '확정할 수 있는 줄이 없는 7월 버튼은 비활성, 아직 확정 가능한 8월 버튼은 활성')
        pg.close()

        print('── 연속 클릭(중복 방지)')
        pg, errs = fresh(delay=900); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        pg.locator('[data-pt-confirm-month="2026-07"]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.locator('.jh-dialog button[data-ok]').click()
        pg.wait_for_timeout(150)
        for _ in range(3):
            try: pg.locator('[data-pt-confirm-month="2026-07"]').click(timeout=300, force=True)
            except Exception: pass
        pg.wait_for_timeout(1400)
        ok(len(calls(pg)) == 1, '★ 확정이 처리되는 동안 같은 버튼을 여러 번 눌러도 서버 호출은 1번')
        ok(pg.locator('.jh-dialog').count() == 0, '연속 클릭이 두 번째 확인창을 띄우지 않음')
        pg.close()

        print('── 확정 처리 중에는 선택이 바뀌지 않음')
        pg, errs = fresh(delay=900); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        pg.locator('[data-pt-confirm-month="2026-07"]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_timeout(200)
        for sel in ('[data-pt-pick-month="2026-08"]', '[data-pt-clear]'):
            try: pg.locator(sel).click(timeout=300, force=True)
            except Exception: pass
        pg.wait_for_timeout(100)
        ok((not pg.locator('[data-pt-row="e4_1"]').is_checked()) and pg.locator('[data-pt-pick-month="2026-08"]').is_disabled(), '★ 확정이 처리되는 동안에는 "이 달 전체 선택"을 눌러도 줄이 체크되지 않고 버튼이 비활성')
        pg.wait_for_timeout(1300); pg.close()

        print('── 서버가 줄을 거부했을 때')
        pg, errs = fresh(mode='reject'); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        pg.locator('[data-pt-confirm-month="2026-07"]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_timeout(1000)
        t = pg.inner_text('.jh-fin__pjttag')
        ok('합계가 맞지 않는 시험 거부 사유' in t and '0줄을 확정했습니다' in t, '★ 서버가 거부한 사유를 사용자에게 보여 줌(0줄 확정 + 사유)')
        ok(pg.locator('.jh-fin__ptrow').count() == 4, '거부되면 줄은 대기 목록에 그대로 남음')
        ok(pg.locator('[data-pt-confirm-month="2026-07"]').is_enabled(), '★ 거부 뒤 버튼이 다시 눌림(busy 가 영원히 잠기지 않음)')
        pg.close()

        print('── 선택 바(맨 위 고정·실시간 개수)')
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        bar = pg.locator('[data-pt-bar]'); first_card = pg.locator('[data-pt-month]').first
        ok(bar.count() == 1 and bar.bounding_box()['y'] < first_card.bounding_box()['y'], '★ 선택 바가 첫 달 카드보다 위에 보임')
        ok('선택 0줄' in bar.inner_text(), '처음에는 "선택 0줄"')
        pg.locator('[data-pt-row="e3_0"]').check(); pg.wait_for_timeout(100)
        ok('선택 1줄' in bar.inner_text(), '★ 줄을 고르면 화면을 다시 그리지 않고도 바로 "선택 1줄"로 바뀜')
        pg.locator('[data-pt-row="e1_1"]').check(); pg.wait_for_timeout(100)
        ok('선택 2줄' in bar.inner_text() and pg.locator('[data-pt-row]:checked').count() == 2, '두 줄을 고르면 "선택 2줄"')
        pg.locator('[data-pt-clear]').click(); pg.wait_for_timeout(100)
        ok('선택 0줄' in bar.inner_text() and pg.locator('[data-pt-row]:checked').count() == 0, '★ "선택 해제"를 누르면 체크가 모두 풀리고 "선택 0줄"')
        pg.set_viewport_size({'width': 1200, 'height': 260}); pg.evaluate('window.scrollTo(0, document.body.scrollHeight)'); pg.wait_for_timeout(200)
        bb = bar.bounding_box(); ok(bb is not None and 0 <= bb['y'] <= 12, '★ 화면을 맨 아래까지 내려도 선택 바가 맨 위에 붙어 따라옴(y=%s)' % (bb and round(bb['y'])))
        pg.close()

        print('── 이 달 전체 선택')
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        pg.locator('[data-pt-pick-month="2026-07"]').click(); pg.wait_for_timeout(150)
        ok(pg.locator('[data-pt-row]:checked').count() == 2 and pg.locator('[data-pt-row="e1_1"]').is_checked() and pg.locator('[data-pt-row="e3_0"]').is_checked(), '★ "이 달 전체 선택"을 누르면 그 달의 확정 가능한 줄(2개)이 모두 체크됨')
        ok((not pg.locator('[data-pt-row="e2_0"]').is_checked()) and (not pg.locator('[data-pt-row="e4_1"]').is_checked()), '★ 확정할 수 없는 줄(수동)과 다른 달(8월) 줄은 체크되지 않음')
        ok('선택 2줄' in pg.locator('[data-pt-bar]').inner_text(), '선택 바가 바로 "선택 2줄"')
        pg.locator('[data-pt-row="e3_0"]').uncheck(); pg.wait_for_timeout(100)
        ok('선택 1줄' in pg.locator('[data-pt-bar]').inner_text(), '전체 선택 뒤 한 줄을 빼면 "선택 1줄"')
        pg.locator('[data-pt-confirm-sel]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000)
        ok('선택한 1줄' in pg.inner_text('.jh-dialog'), '★ 확정 확인창에 빼고 남은 1줄이 보임')
        pg.locator('.jh-dialog button[data-cancel]').click(); pg.wait_for_timeout(300); ok(len(calls(pg)) == 0, '취소하면 서버 호출 없음')
        pg.locator('[data-pt-pick-month="2026-08"]').click(); pg.wait_for_timeout(150)
        ok('선택 2줄' in pg.locator('[data-pt-bar]').inner_text() and pg.locator('[data-pt-row="e4_1"]').is_checked(), '다른 달도 이어서 선택할 수 있고 앞의 선택은 유지(7월 1줄 + 8월 1줄 = 2줄)')
        pg.close()

        print('── 선택한 줄 확정')
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        pg.locator('[data-pt-confirm-sel]').click(); pg.wait_for_timeout(300)
        ok('먼저 선택' in pg.inner_text('.jh-fin__pjttag') and len(calls(pg)) == 0, '아무것도 선택하지 않고 누르면 안내만 나오고 서버 호출 없음')
        pg.locator('[data-pt-row="e3_0"]').check(); pg.locator('[data-pt-confirm-sel]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000)
        ok('선택한 1줄' in pg.inner_text('.jh-dialog'), '선택한 줄 수가 확인창에 보임')
        pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagBatch")', timeout=5000)
        cs = calls(pg); ok(len(cs) == 1 and [x['entryId'] for x in cs[0]['items']] == ['e3'], '선택한 줄(e3)만 서버로 나감')
        pg.close()
        print('── 가져오기 직후 자동 제안(급여명세서 가져오기로 확정까지 실제로 실행)')
        PAY = {'month': '2026-09', 'workers': 1, 'payslips': [{'workerId': 'w1', 'name': '가짜직원', 'month': '2026-09', 'dept': '현장팀', 'grossPay': 1000, 'pension': 40, 'health': 30, 'ltcare': 3, 'employ': 7, 'incomeTax': 10, 'localTax': 1, 'dormitory': 0, 'netPay': 909}]}
        def imp_fresh(post_resp, propose=None, fail=None):
            pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
            pg.evaluate("([pay, post, prop, fail]) => { window.__resp = { payrollRead: pay, post: post, pjtProposeNew: prop }; window.__fail = fail || {}; if (prop === null) delete window.__resp.pjtProposeNew; }", [PAY, post_resp, propose, fail])
            pg.evaluate("() => { location.hash = '#/finance/import'; }"); pg.evaluate("() => window.__mount(document.getElementById('root'), { segs: ['import'], q: {} }, { me: { admin: true, uid: 'u1' } })")
            pg.wait_for_selector('[data-imp-kind=\"payroll\"]', timeout=15000); pg.locator('[data-imp-kind=\"payroll\"]').click(); pg.wait_for_selector('[data-act=\"pay-load\"]', timeout=5000)
            pg.locator('[data-pay-month]').fill('2026-09'); pg.locator('[data-act=\"pay-load\"]').click(); pg.wait_for_selector('[data-act=\"commit\"]:not([disabled])', timeout=8000)
            return pg, errs
        def acts(pg): return pg.evaluate("window.__calls.map(c => c.action)")
        pg, errs = imp_fresh({'posted': [{'id': 'E100'}], 'duplicates': [], 'rejected': []}, {'ok': True, 'created': 3, 'wouldCreate': 3, 'skippedExisting': 0})
        pg.locator('[data-act=\"commit\"]').click(); pg.wait_for_function('window.__calls.some(c => c.action === \"pjtProposeNew\")', timeout=8000); pg.wait_for_timeout(300)
        a1 = acts(pg); ok(a1.count('pjtProposeNew') == 1 and a1.index('pjtProposeNew') > a1.index('post'), '★ 가져오기를 확정하면 전표 저장(post) 뒤에 pjtProposeNew 를 정확히 한 번 부른다 (호출 순서: %s)' % [x for x in a1 if x in ('payrollRead', 'post', 'pjtProposeNew')])
        ok(pg.evaluate("window.__calls.find(c => c.action === 'pjtProposeNew').dryRun") is False, '★ 제안은 dryRun false 로 실제로 만든다')
        ok('저장 1건' in pg.inner_text('body') and '프로젝트 표시 제안 3건' in pg.inner_text('body'), '★ 화면에 가져오기 결과("저장 1건")와 제안 안내("프로젝트 표시 제안 3건")가 둘 다 보인다')
        ok(not errs, '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = imp_fresh({'posted': [{'id': 'E100'}], 'duplicates': [], 'rejected': []}, None, {'pjtProposeNew': '제안 서버 시험 실패'})
        pg.locator('[data-act=\"commit\"]').click(); pg.wait_for_function('window.__calls.some(c => c.action === \"pjtProposeNew\")', timeout=8000); pg.wait_for_timeout(400)
        ok('저장 1건' in pg.inner_text('body') and '만들지 못했습니다' in pg.inner_text('body'), '★ 제안 서버가 실패해도 가져오기 결과("저장 1건")는 그대로 있고 "프로젝트 표시 제안은 만들지 못했습니다" 안내만 더해진다')
        ok(not errs, '★ 제안이 실패해도 화면 오류·콘솔 오류가 없다(예외가 밖으로 새지 않음) %s' % errs[:2]); pg.close()
        pg, errs = imp_fresh({'posted': [], 'duplicates': [{'id': 'E1'}], 'rejected': []}, {'ok': True, 'created': 9})
        pg.locator('[data-act=\"commit\"]').click(); pg.wait_for_function("document.body.innerText.includes('이미 있어 건너뜀')", timeout=8000); pg.wait_for_timeout(300)
        ok('pjtProposeNew' not in acts(pg), '★ 새로 저장된 전표가 없으면(전부 이미 있어 건너뜀) 제안을 부르지 않는다')
        ok('프로젝트 표시 제안' not in pg.inner_text('body'), '제안을 안 불렀으니 제안 안내도 없다'); pg.close()
        pg, errs = imp_fresh({'posted': [{'id': 'E100'}], 'duplicates': [], 'rejected': []}, {'ok': True, 'created': 0, 'skippedExisting': 4})
        pg.locator('[data-act=\"commit\"]').click(); pg.wait_for_function('window.__calls.some(c => c.action === \"pjtProposeNew\")', timeout=8000); pg.wait_for_timeout(300)
        ok('저장 1건' in pg.inner_text('body') and '프로젝트 표시 제안' not in pg.inner_text('body'), '만들 제안이 0건이면 굳이 알리지 않는다(가져오기 결과만)'); pg.close()
        print('── 줄 직접 지정 패널(실제 클릭 → 패널 → 저장)')
        def sp_open(pg, rid):
            pg.locator('[data-pt-edit="%s"]' % rid).click(); pg.wait_for_selector('.jh-dialog [data-sp-cells]', timeout=5000)
        def sets(pg): return pg.evaluate('window.__calls.filter(c => c.action === "pjtTagSet")')
        def left(pg): return pg.inner_text('.jh-dialog [data-sp-left]')
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        sp_open(pg, 'e2_0')
        ok('2026-0002' in pg.inner_text('.jh-dialog') and '가짜외주' in pg.inner_text('.jh-dialog') and '500' in pg.inner_text('.jh-dialog'), '★ 직접 지정을 누르면 패널이 열리고 줄 정보(번호·거래처·금액 500원)가 보인다')
        ok(pg.locator('.jh-dialog [data-sp-pjt]').count() == 1 and len(sets(pg)) == 0, '★ 제안이 없는 줄은 빈 칸 하나로 열리고 서버 호출은 0건이다')
        ok('이전 지정은 기록에 남습니다' not in pg.inner_text('.jh-dialog'), '★ 처음 지정하는 패널(직접 지정)에는 "이전 지정" 안내가 없다(재지정 패널에만)')
        ok('남은 금액 500' in left(pg), '남은 금액이 줄 금액 500으로 시작한다')
        pg.locator('.jh-dialog [data-sp-pjt]').first.select_option('pA'); pg.locator('.jh-dialog [data-sp-amt]').first.fill('300'); pg.wait_for_timeout(100)
        ok('200' in left(pg), '★ 금액을 입력하면 남은 금액이 실시간으로 바뀐다(500 − 300 = 200) (실제: %s)' % left(pg))
        pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_timeout(250)
        ok(len(sets(pg)) == 0 and pg.locator('.jh-dialog').count() == 1 and ('모자' in pg.inner_text('.jh-dialog') or '200' in pg.inner_text('.jh-dialog [data-panel-msg]')), '★ 합이 안 맞으면 저장을 눌러도 서버 호출 0건이고 패널은 열린 채 이유가 보인다')
        pg.locator('.jh-dialog [data-sp-amt]').first.fill('500'); pg.locator('.jh-dialog [data-sp-note]').fill('대표님 지정'); pg.wait_for_timeout(100)
        pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagSet")', timeout=5000); pg.wait_for_timeout(500)
        cs = sets(pg); ok(len(cs) == 1 and cs[0] == {'action': 'pjtTagSet', 'entryId': 'e2', 'lineIdx': 0, 'method': '직접', 'splits': [{'pjt': 'pA', 'amount': 500}], 'note': '대표님 지정'}, '★ 합이 맞게 저장하면 서버에 pjtTagSet 이 정확히 1건(방식 직접·메모 포함)으로 간다 (실제: %s)' % cs)
        ok(pg.locator('.jh-dialog').count() == 0, '★ 저장에 성공하면 패널이 닫힌다')
        ok(pg.locator('[data-pt-row="e2_0"]').count() == 0 and '가짜외주' not in pg.inner_text('.jh-fin__pjttag'), '★ 저장한 줄(e2_0)은 대기 목록에서 사라진다(확정됐으므로)')
        ok(not errs, '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000); sp_open(pg, 'e1_1')
        ok(pg.locator('.jh-dialog [data-sp-pjt]').count() == 2 and pg.locator('.jh-dialog [data-sp-pjt]').nth(0).input_value() == 'pA' and pg.locator('.jh-dialog [data-sp-amt]').nth(1).input_value() == '400', '★ 제안이 있는 줄은 제안(A 600·B 400)이 두 칸에 채워져 열린다')
        ok('남은 금액 0' in left(pg), '채워진 칸의 합이 맞으면 남은 금액 0이다')
        pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagSet")', timeout=5000); pg.wait_for_timeout(400)
        cs = sets(pg); ok(len(cs) == 1 and cs[0]['method'] == '수동' and [x['pjt'] for x in cs[0]['splits']] == ['pA', 'pB'] and cs[0]['note'] == '', '★ 두 프로젝트로 나눠 저장하면 방식은 수동이고 분할이 그대로 간다'); pg.close()
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000); sp_open(pg, 'e1_1')
        for k in range(20): pg.locator('.jh-dialog [data-sp-add]').click()
        ok(pg.locator('.jh-dialog [data-sp-pjt]').count() == 12, '★ 칸 추가는 12칸에서 멈춘다(서버 한도) — 실제 %d칸' % pg.locator('.jh-dialog [data-sp-pjt]').count()); pg.close()
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000); sp_open(pg, 'e2_0')
        pg.locator('.jh-dialog [data-close]').last.click(); pg.wait_for_timeout(200)
        ok(pg.locator('.jh-dialog').count() == 0 and len(sets(pg)) == 0 and pg.locator('[data-pt-row="e2_0"]').count() == 1, '★ 닫기를 누르면 서버 호출 0건이고 줄은 그대로 대기 목록에 있다')
        sp_open(pg, 'e2_0'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200); ok(pg.locator('.jh-dialog').count() == 0 and len(sets(pg)) == 0, 'Esc 로 닫아도 서버 호출 0건'); pg.close()
        pg, errs = fresh('reject'); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000); sp_open(pg, 'e2_0')
        pg.locator('.jh-dialog [data-sp-pjt]').first.select_option('pB'); pg.locator('.jh-dialog [data-sp-amt]').first.fill('500'); pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagSet")', timeout=5000); pg.wait_for_timeout(500)
        ok(pg.locator('.jh-dialog').count() == 1 and '시험 거부 사유' in pg.inner_text('.jh-dialog'), '★ 서버가 거절하면 패널이 열린 채 서버가 준 이유가 패널 안에 보인다')
        ok(pg.locator('.jh-dialog [data-sp-amt]').first.input_value() == '500' and pg.locator('.jh-dialog [data-sp-pjt]').first.input_value() == 'pB', '★ 거절돼도 입력한 값(프로젝트 B·500)은 그대로 남아 있다(다시 고쳐 시도할 수 있게)')
        ok(pg.locator('[data-pt-row="e2_0"]').count() == 1 and not errs, '거절되면 줄은 대기 목록에 그대로 있고 화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh('ok', 600); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000); sp_open(pg, 'e2_0')
        pg.locator('.jh-dialog [data-sp-pjt]').first.select_option('pA'); pg.locator('.jh-dialog [data-sp-amt]').first.fill('500')
        pg.evaluate("() => { const b = document.querySelector('.jh-dialog [data-act=\"save\"]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(1200)
        ok(len(sets(pg)) == 1, '★ 저장 중에 여러 번 눌러도 서버 호출은 1건이다(두 번 눌림 방지) — 실제 %d건' % len(sets(pg))); pg.close()
        print('── 확정된 줄 구역(수정·해제)')
        def confirm_line(pg, rid, pjt, amt):
            sp_open(pg, rid); pg.locator('.jh-dialog [data-sp-pjt]').first.select_option(pjt); pg.locator('.jh-dialog [data-sp-amt]').first.fill(amt)
            pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_function('document.querySelectorAll(".jh-dialog").length === 0', timeout=5000); pg.wait_for_timeout(300)
        def clears(pg): return pg.evaluate('window.__calls.filter(c => c.action === "pjtTagClear")')
        def confirm_proposed(pg, rid):   # 제안이 이미 채워진 줄(e1_1: A 600·B 400)은 열고 그대로 저장한다(칸을 바꾸면 합이 어긋나 서버가 아니라 앱이 먼저 거절한다)
            sp_open(pg, rid); pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_function('document.querySelectorAll(".jh-dialog").length === 0', timeout=6000); pg.wait_for_timeout(300)
        def done_open(pg):
            if pg.locator('[data-pt-done-toggle][aria-expanded="false"]').count(): pg.locator('[data-pt-done-toggle]').click(); pg.wait_for_selector('[data-pt-done-row]', timeout=3000)
        pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        ok(pg.locator('[data-pt-done-toggle]').count() == 0, '★ 확정된 줄이 하나도 없으면 확정 구역이 아예 없다')
        confirm_line(pg, 'e2_0', 'pA', '500')
        ok(pg.locator('[data-pt-done-toggle]').count() == 1 and '확정된 줄 1줄' in pg.inner_text('[data-pt-done]') and pg.locator('[data-pt-done-row]').count() == 0, '★ 직접 지정으로 확정하면 "확정된 줄 1줄" 구역이 생기고 처음에는 접혀 있다')
        n0 = pg.evaluate('window.__calls.length'); done_open(pg)
        ok(pg.locator('[data-pt-done-row="e2_0"]').count() == 1 and '가짜 프로젝트 A' in pg.inner_text('[data-pt-done-row="e2_0"]') and '100%' in pg.inner_text('[data-pt-done-row="e2_0"]') and pg.evaluate('window.__calls.length') == n0, '★ 펼치면 줄과 프로젝트 칩(A 100%)이 보이고 서버 호출은 늘지 않는다')
        ok(pg.locator('[data-pt-redo="e2_0"]').count() == 1 and pg.locator('[data-pt-undo="e2_0"]').count() == 1, '[수정]·[해제] 버튼이 줄마다 있다')
        pg.locator('[data-pt-redo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog [data-sp-cells]', timeout=5000)
        ok(pg.locator('.jh-dialog [data-sp-pjt]').first.input_value() == 'pA' and pg.locator('.jh-dialog [data-sp-amt]').first.input_value() == '500' and '다시 지정' in pg.inner_text('.jh-dialog'), '★ [수정]을 누르면 현재 지정(A·500)이 채워진 패널이 "다시 지정"으로 열린다')
        ok('남은 금액 0' in left(pg), '채워진 상태라 남은 금액은 0원이다')
        ok('이전 지정은 기록에 남습니다' in pg.inner_text('.jh-dialog [data-panel-msg]'), '★ [수정] 패널에는 "이전 지정은 기록에 남습니다" 안내가 보인다(마진율 등에 영향이 가는 되돌리기 어려운 변경이라 알린다)')
        pg.locator('.jh-dialog [data-sp-amt]').first.fill('300'); pg.locator('.jh-dialog [data-sp-add]').click(); pg.locator('.jh-dialog [data-sp-pjt]').nth(1).select_option('pB'); pg.locator('.jh-dialog [data-sp-amt]').nth(1).fill('200')
        n1 = len(sets(pg)); pg.locator('.jh-dialog [data-act="save"]').click(); pg.wait_for_function('document.querySelectorAll(".jh-dialog").length === 0', timeout=5000); pg.wait_for_timeout(300)
        cs = sets(pg); ok(len(cs) == n1 + 1 and cs[-1]['method'] == '수동' and [x['pjt'] for x in cs[-1]['splits']] == ['pA', 'pB'] and cs[-1]['entryId'] == 'e2', '★ 수정을 저장하면 pjtTagSet 이 한 번 더 가고(방식 수동·분할 A·B) 같은 줄(e2)이다')
        ok(pg.locator('[data-pt-done-row="e2_0"]').count() == 1 and '가짜 프로젝트 B' in pg.inner_text('[data-pt-done-row="e2_0"]') and pg.locator('[data-pt-done-toggle][aria-expanded="true"]').count() == 1, '★ 수정 뒤에도 구역은 펼친 채이고 줄이 새 지정(A·B)으로 바뀐다')
        pg.locator('[data-pt-undo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog button[data-cancel]', timeout=3000)
        ok(len(clears(pg)) == 0 and ('해제' in pg.inner_text('.jh-dialog')), '★ [해제]를 누르면 확인창이 먼저 뜨고 서버 호출은 0건이다')
        pg.locator('.jh-dialog button[data-cancel]').click(); pg.wait_for_timeout(250)
        ok(len(clears(pg)) == 0 and pg.locator('[data-pt-done-row="e2_0"]').count() == 1, '★ 확인창에서 취소하면 서버 호출 0건이고 줄은 확정된 채 그대로다')
        pg.locator('[data-pt-undo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog button[data-ok]', timeout=3000); pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagClear")', timeout=5000); pg.wait_for_timeout(600)
        cc = clears(pg); ok(len(cc) == 1 and cc[0]['entryId'] == 'e2' and cc[0]['lineIdx'] == 0, '★ 확인하면 pjtTagClear 가 정확히 1건(e2·줄 0)으로 간다 (실제: %s)' % cc)
        ok(pg.locator('[data-pt-done-row="e2_0"]').count() == 0 and pg.locator('[data-pt-row="e2_0"]').count() == 1, '★ 해제한 줄은 확정 구역에서 사라지고 위 대기 목록으로 돌아온다')
        ok(not errs, '화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh('rejectclear'); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        confirm_line(pg, 'e2_0', 'pA', '500'); done_open(pg)
        pg.locator('[data-pt-undo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog button[data-ok]', timeout=3000); pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagClear")', timeout=5000); pg.wait_for_timeout(600)
        ok('시험 거부 사유' in pg.inner_text('.jh-fin__pjttag') and pg.locator('[data-pt-done-row="e2_0"]').count() == 1 and pg.locator('[data-pt-row="e2_0"]').count() == 0, '★ 서버가 해제를 거절하면 이유가 화면에 보이고 줄은 확정된 채 그대로다(대기 목록으로 가지 않음)')
        ok(not errs, '거절돼도 화면 오류 없음 %s' % errs[:2]); pg.close()
        pg, errs = fresh('ok', 600); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000); confirm_line(pg, 'e2_0', 'pA', '500'); done_open(pg)
        pg.locator('[data-pt-undo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog button[data-ok]', timeout=3000)
        pg.evaluate("() => { const b = document.querySelector('.jh-dialog button[data-ok]'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(1400)
        ok(len(clears(pg)) == 1, '★ 해제 확인을 여러 번 눌러도 서버 호출은 1건이다 — 실제 %d건' % len(clears(pg))); pg.close()
        print('── 해제 진행 중 잠금과 끝난 뒤 복구')
        pg, errs = fresh('ok', 1200); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        confirm_line(pg, 'e2_0', 'pA', '500'); confirm_proposed(pg, 'e1_1'); done_open(pg)
        pg.locator('[data-pt-undo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog button[data-ok]', timeout=3000); pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_timeout(300)
        dis = pg.evaluate("() => [...document.querySelectorAll('[data-pt-undo],[data-pt-redo]')].map((b) => b.disabled)")
        ok(len(dis) >= 2 and all(dis), '★ 해제 요청이 진행 중인 동안에는 [수정]·[해제] 버튼이 모두 비활성이다(%d개)' % len(dis))
        pg.evaluate("() => { document.querySelectorAll('[data-pt-undo]').forEach((b) => { b.disabled = false; b.click(); }); }"); pg.wait_for_timeout(500)
        ok(pg.locator('.jh-dialog').count() == 0 and len(clears(pg)) == 1, '★ 진행 중에 억지로 다른 줄의 [해제]를 눌러도 확인창이 안 뜨고 서버 호출은 늘지 않는다(컨트롤러 잠금) — 해제 호출 %d건' % len(clears(pg)))
        pg.wait_for_function('document.querySelector("[data-pt-row=\\"e2_0\\"]") !== null', timeout=6000); pg.wait_for_timeout(300)
        ok(pg.evaluate("() => [...document.querySelectorAll('[data-pt-undo],[data-pt-redo],[data-pt-edit]')].every((b) => !b.disabled)"), '★ 해제가 끝나면 버튼이 다시 활성으로 돌아온다(영구 잠금 방지)')
        pg.locator('[data-pt-redo="e1_1"]').click(); pg.wait_for_selector('.jh-dialog [data-sp-cells]', timeout=4000)
        ok(pg.locator('.jh-dialog [data-sp-cells]').count() == 1, '★ 해제가 끝난 뒤 다른 줄의 [수정]이 정상으로 열린다'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        pg.locator('[data-pt-edit="e2_0"]').click(); pg.wait_for_selector('.jh-dialog [data-sp-cells]', timeout=4000); ok('2026-0002' in pg.inner_text('.jh-dialog'), '★ 해제로 돌아온 줄의 [직접 지정]도 정상으로 열린다'); pg.close()
        pg, errs = fresh('rejectclear'); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
        confirm_line(pg, 'e2_0', 'pA', '500'); confirm_proposed(pg, 'e1_1'); done_open(pg)
        pg.locator('[data-pt-undo="e2_0"]').click(); pg.wait_for_selector('.jh-dialog button[data-ok]', timeout=3000); pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagClear")', timeout=5000); pg.wait_for_timeout(600)
        ok(pg.evaluate("() => [...document.querySelectorAll('[data-pt-undo],[data-pt-redo]')].every((b) => !b.disabled)"), '★ 해제가 실패한 뒤에도 버튼이 다시 활성으로 돌아온다(실패 경로의 복구)')
        pg.locator('[data-pt-undo="e1_1"]').click(); pg.wait_for_selector('.jh-dialog button[data-ok]', timeout=3000); ok(pg.locator('.jh-dialog button[data-ok]').count() == 1, '★ 실패한 뒤에도 다른 줄의 [해제]를 다시 시도할 수 있다(확인창이 뜬다)'); pg.close()
        b.close()
except Exception as _e:
    import traceback; fail_n += 1; print('FAIL 시험이 예외로 중단됨 → ' + type(_e).__name__ + ': ' + str(_e).split('\n')[0][:200]); print(traceback.format_exc()[-500:])
if pass_n + fail_n < 63: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 ≥ 63) — 중간에 죽어 뒤쪽이 안 도는 일 방지' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
