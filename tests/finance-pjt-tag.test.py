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

    print('── 선택한 줄 확정')
    pg, errs = fresh(); pg.wait_for_selector('.jh-fin__pjttag', timeout=15000)
    pg.locator('[data-pt-confirm-sel]').click(); pg.wait_for_timeout(300)
    ok('먼저 선택' in pg.inner_text('.jh-fin__pjttag') and len(calls(pg)) == 0, '아무것도 선택하지 않고 누르면 안내만 나오고 서버 호출 없음')
    pg.locator('[data-pt-row="e3_0"]').check(); pg.locator('[data-pt-confirm-sel]').click(); pg.wait_for_selector('.jh-dialog', timeout=5000)
    ok('선택한 1줄' in pg.inner_text('.jh-dialog'), '선택한 줄 수가 확인창에 보임')
    pg.locator('.jh-dialog button[data-ok]').click(); pg.wait_for_function('window.__calls.some(c => c.action === "pjtTagBatch")', timeout=5000)
    cs = calls(pg); ok(len(cs) == 1 and [x['entryId'] for x in cs[0]['items']] == ['e3'], '선택한 줄(e3)만 서버로 나감')
    pg.close(); b.close()
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
