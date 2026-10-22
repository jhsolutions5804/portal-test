"""정산서 청구서 발행 화면 — 거래처 일치 규칙(대기열 1-2-10 ①) 연결 시험. 실제 크로미움·실제 화면 코드(plan/index.js mountBilling·issue-view·issue)로 시험하고 서버 접근(core/firebase.js)만 가짜.
노드 시험(plan-issue-client.test.mjs)이 규칙 자체를 증명하고, 이 시험은 화면 연결(견적 후보 표시·수신자 자동 채움·자동 해제 알림)을 증명한다. 공개 저장소라 가짜 값만 쓴다. 이 파일은 파이썬 % 서식을 쓰지 않는다."""
import os, sys, json
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'plan-closing.test.py'), encoding='utf-8').read().split('\n')
_end = next(i for i, l in enumerate(_src) if l.startswith('pass_n = fail_n = 0'))
_prefix = '\n'.join(_src[:_end]).replace('mountClosing', 'mountBilling').replace('__file__', repr(os.path.join(_here, 'plan-closing.test.py')))
# 가짜 서버 데이터를 이 시험용으로 교체(DATA 는 prefix 안에서 정의되므로 prefix 실행 전에 문자열 치환으로 바꾼다)
_ns = {'__name__': 'icprefix'}
exec(compile(_prefix, 'prefix', 'exec'), _ns)
sync_playwright = _ns['sync_playwright']; BASE = _ns['BASE']; PAGE = _ns['PAGE']; json_dumps = json.dumps
DATA = {
  'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'linkPjt': '', 'createdAt': {'seconds': 1}}, 'q2': {'name': '현장2', 'code': 'A2', 'status': 'run', 'linkPjt': '', 'createdAt': {'seconds': 2}}},
  'gihoek_companies': {'c1': {'company': '원청일', 'roleClient': True, 'contacts': []}, 'c2': {'company': '원청이', 'roleClient': True, 'contacts': []}, 'c3': {'company': '원청삼', 'roleClient': True, 'contacts': []}, 's1': {'company': '우리회사', 'roleSupplier': True, 'contacts': []}},
  'gihoek_estimates': {
    'A': {'title': '견적A', 'pjtId': 'q1', 'clientId': 'c1', 'status': 'active', 'items': [{'name': '항목', 'qty': 1, 'price': 1000}], 'date': '2026-10-01'},
    'B': {'title': '견적B', 'pjtId': 'q1', 'clientId': 'c2', 'status': 'active', 'items': [{'name': '항목', 'qty': 1, 'price': 2000}], 'date': '2026-10-02'},
    'C': {'title': '견적C', 'pjtId': 'q2', 'clientId': 'c1', 'status': 'active', 'items': [{'name': '항목', 'qty': 1, 'price': 3000}], 'date': '2026-10-03'}, 'N': {'title': '견적N(프로젝트 없음)', 'pjtId': '', 'clientId': 'c1', 'status': 'active', 'items': [{'name': '항목', 'qty': 1, 'price': 500}], 'date': '2026-10-04'}},
  'gihoek_settlements': {}, 'pjt_registry': {}}
FAKE_FB = _ns['FAKE_FB'].replace(json_dumps(_ns['DATA']), json_dumps(DATA), 1)
assert json_dumps(DATA) in FAKE_FB, '가짜 서버 데이터 교체 실패'
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh(width=1300):
        pg = b.new_page(viewport={'width': width, 'height': 1000}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
        pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
        pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
        pg.evaluate("() => { window.__toasts = []; const o = document.createElement('div'); }")
        pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: ['new', 'q1'], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' } }); }")
        pg.wait_for_function("document.querySelector('[data-is-f=\"recipientId\"]')", timeout=8000); pg.wait_for_timeout(300)
        return pg, errs
    def picks(pg): return pg.evaluate("[...document.querySelectorAll('[data-is-est]')].map((e) => e.getAttribute('data-is-est'))")
    def checked(pg): return pg.evaluate("[...document.querySelectorAll('[data-is-est]')].filter((e) => e.checked).map((e) => e.getAttribute('data-is-est'))")
    def recipient(pg): return pg.eval_on_selector('[data-is-f="recipientId"]', 'e => e.value')
    def toasts(pg): return pg.evaluate("[...document.querySelectorAll('.jh-toast, [role=status], [data-toast]')].map((e) => e.innerText.trim()).filter(Boolean)")
    def set_method(pg, m):
        pg.select_option('[data-is-f="method"]', m); pg.wait_for_timeout(300)

    print('── 수량 정산·수신자를 먼저 고르면 같은 거래처 견적만 보인다')
    pg, errs = fresh()
    set_method(pg, 'qty')
    ok(sorted(picks(pg)) == ['A', 'B', 'C'], '(전제) 수량 정산은 프로젝트와 무관하게 활성 견적이 모두 후보(수신자를 고르기 전) — ' + str(picks(pg)))
    ok(pg.evaluate("document.querySelectorAll('[data-is-pjt]').length") == 0, '★ 수량 정산에는 상단 프로젝트 선택 칸이 없다(프로젝트는 견적이 정한다) — 프로젝트 체크박스 0개')
    info = lambda: pg.evaluate("(() => { const e = document.querySelector('[data-is-pjtinfo]'); return e ? e.innerText.trim() : null; })()")
    ok(info() is not None and '견적을 고르면' in info(), '★ 견적을 고르기 전에는 정산 프로젝트 안내가 "견적을 고르면 그 견적의 프로젝트로 정해집니다" — ' + str(info()))
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(300)
    ok(recipient(pg) == 'c1' and sorted(picks(pg)) == ['A', 'C'], '★ 수신자 원청일(c1)을 고르면 후보가 그 거래처의 견적 A(현장1)·C(현장2) — 프로젝트와 무관하게 거래처로 거른다 — ' + str(picks(pg)))
    pg.check('[data-is-est="A"]'); pg.wait_for_timeout(300)
    ok(info() == 'A1', '★ 견적 A 를 고르면 정산 프로젝트가 A1 — ' + str(info()))
    pg.check('[data-is-est="C"]'); pg.wait_for_timeout(300)
    ok(info() == 'A1 + A2', '★ 다른 프로젝트의 견적 C 를 더 고르면 A1 + A2(선택 순서) — ' + str(info()))
    pg.uncheck('[data-is-est="A"]'); pg.wait_for_timeout(300)
    ok(info() == 'A2', '★ A 를 풀면 A2 만 남는다 — ' + str(info()))
    pg.select_option('[data-is-f="recipientId"]', 'c2'); pg.wait_for_timeout(400)
    ok(checked(pg) == [] and '견적을 고르면' in str(info()), '★ 수신자를 c2 로 바꾸면 C 가 자동 해제되고 정산 프로젝트 안내도 처음 문구로 돌아간다 — 선택 ' + str(checked(pg)) + ' · 안내 ' + str(info()))
    labels = pg.evaluate("[...document.querySelectorAll('[data-is-est]')].map((e) => e.closest('label').innerText.replace(/\\s+/g, ' ').trim())")
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(300)
    labels = pg.evaluate("[...document.querySelectorAll('[data-is-est]')].map((e) => e.closest('label').innerText.replace(/\\s+/g, ' ').trim())")
    ok('N' not in picks(pg) and sorted(picks(pg)) == ['A', 'C'], '★ 프로젝트 없는 견적 N(거래처 c1)은 후보에 없다 — 프로젝트를 정해야 정산할 수 있다("해당 없음" 삭제) — ' + str(picks(pg)))
    ok(len(labels) == 2 and any('A1' in x and '견적A' in x for x in labels) and any('A2' in x and '견적C' in x for x in labels), '★ 후보 라벨에 견적 이름과 프로젝트 코드가 함께 보인다(여러 프로젝트가 섞여 구분이 필요) — ' + str(labels))
    pg.select_option('[data-is-f="recipientId"]', 'c3'); pg.wait_for_timeout(400)
    ok(picks(pg) == [] and '이 거래처의 유효 견적이 없습니다' in pg.inner_text('body'), '★ 견적이 없는 거래처를 고르면 "이 거래처의 유효 견적이 없습니다"(프로젝트 기준 문구가 아니다) — 후보 ' + str(picks(pg)))
    ok(not errs, '화면 오류·콘솔 오류 없음 ' + str(errs[:2])); pg.close()

    print('── 수신자를 비우고 견적을 먼저 고르면 그 견적의 거래처가 수신자가 된다')
    pg, errs = fresh(); set_method(pg, 'qty')
    ok(recipient(pg) == '', '(전제) 수신자 비어 있음')
    pg.check('[data-is-est="B"]'); pg.wait_for_timeout(300)
    ok(recipient(pg) == 'c2' and checked(pg) == ['B'], '★ 견적 B 를 고르면 수신자가 원청이(c2)로 자동 채워지고 B 가 선택된다 — 수신자 ' + recipient(pg) + ' · 선택 ' + str(checked(pg)))
    ok(picks(pg) == ['B'], '★ 그 뒤 후보는 같은 거래처(c2)의 견적 B 뿐이다(A 는 사라진다) — ' + str(picks(pg)))
    ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()

    print('── 수신자를 바꾸면 다른 거래처 견적은 자동 해제되고 알림이 뜬다')
    pg, errs = fresh(); set_method(pg, 'qty')
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(200)
    pg.check('[data-is-est="A"]'); pg.wait_for_timeout(300)
    ok(checked(pg) == ['A'], '(전제) 원청일 견적 A 선택됨')
    pg.select_option('[data-is-f="recipientId"]', 'c2'); pg.wait_for_timeout(500)
    ok(recipient(pg) == 'c2' and checked(pg) == [], '★ 수신자를 원청이(c2)로 바꾸면 견적 A 가 자동 해제된다 — 선택 ' + str(checked(pg)))
    ok(picks(pg) == ['B'], '후보도 원청이의 견적 B 로 바뀐다 — ' + str(picks(pg)))
    body = pg.inner_text('body')
    ok('해제했습니다' in body or '거래처 하나만' in body, '★ 알림에 "해제했습니다·거래처 하나만"이 보인다 — 화면 글자: ' + body[body.find('해제') - 30:body.find('해제') + 60].replace('\n', ' ') if '해제' in body else '알림 문구 없음')
    ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()

    print('── 후보 필터를 우회해 다른 거래처 견적을 고르려 해도 막는다(최후 방어)')
    pg, errs = fresh(); set_method(pg, 'qty')
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(300)
    ok(sorted(picks(pg)) == ['A', 'C'] and 'B' not in picks(pg), '(전제) 수신자 c1 이라 화면에 견적 B(거래처 c2) 체크박스가 없다 — ' + str(picks(pg)))
    pg.evaluate("() => { const host = document.querySelector('[data-is-est]').closest('label').parentElement; const l = document.createElement('label'); l.innerHTML = '<input type=\"checkbox\" data-is-est=\"B\" id=\"forceB\"> 강제로 넣은 견적B'; host.appendChild(l); }")
    pg.click('#forceB'); pg.wait_for_timeout(400)  # check() 는 상태가 안 바뀌면 오류라서 click() 으로 누른다 — 앱이 체크를 되돌리는 것이 정상
    ok(pg.eval_on_selector('#forceB', 'e => e.checked') is False, '★ 다른 거래처 견적 B 의 체크가 되돌려진다(화면 상태와 선택 목록이 어긋나지 않게)')
    ok(checked(pg) == [], '★ 선택 목록에 B 가 들어가지 않는다 — ' + str(checked(pg)))
    body = pg.inner_text('body'); ok('다른 거래처' in body and '거래처 하나만' in body, '★ 알림에 "다른 거래처…거래처 하나만"이 보인다')
    ok(recipient(pg) == 'c1', '수신자는 그대로 c1')
    ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()

    print('── 수신자를 비우면 제한이 풀린다')
    pg, errs = fresh(); set_method(pg, 'qty')
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(200)
    pg.select_option('[data-is-f="recipientId"]', ''); pg.wait_for_timeout(300)
    ok(sorted(picks(pg)) == ['A', 'B', 'C'], '★ 수신자를 비우면 다시 A·B·C 모두 후보 — ' + str(picks(pg)))
    ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()
    b.close()
FLOOR = 29
if pass_n + fail_n < FLOOR: fail_n += 1; print('FAIL 시험이 끝까지 실행되지 않음(' + str(pass_n + fail_n) + '건 < ' + str(FLOOR) + ')')
print('\n' + ('실패 ' + str(fail_n) + '건 / 통과 ' + str(pass_n) if fail_n else '전부 통과 (' + str(pass_n) + '건)')); sys.exit(1 if fail_n else 0)
