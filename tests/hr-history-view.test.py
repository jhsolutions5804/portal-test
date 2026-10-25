"""인사 이력(인사기록카드) 화면 시험(대기열 1-3-16 ④) — 실제 크로미움에서 앱 스타일을 불러와 직원 상세 화면의 이력 카드를 그려 확인한다.
확인: 폰·PC 폭에서 가로로 넘치지 않음 · 금액 가림과 [보기] · 위험한 글자가 실행되지 않음 · 인쇄본에 금액이 없음 · **이력 카드만 다시 그려도 상세 화면에서 입력 중인 값이 유지됨**.
공개 저장소이므로 가짜 이름·값만 쓴다. 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, re
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
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('history-view.js?v=')[1].split("'")[0]
CSS = re.findall(r'<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"', open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read())
PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>포털 홈</title>' + ''.join('<link rel="stylesheet" href="/%s">' % c for c in CSS) + '</head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => {
 const Hs = await import('/modules/hr/history.js?v=' + ver); const Vw = await import('/modules/hr/history-view.js?v=' + ver); const D = await import('/modules/hr/view.js?v=' + ver);
 const W = { id: 'w1', name: '김가나', empNo: '24001', dept: '사업본부', rank: '대리', empType: 'field', job: 'FCU 설치', hireDate: '2024-03-01' };
 const long = 'ㄱ'.repeat(70) + 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(3);
 const built = Hs.buildHistory({ worker: W, annual: [{ id: 'a1', contractDate: '2026-01-02', startDate: '2026-01-01', endDate: '2026-12-31', hourly: 10320, salary: 21565000 }], labor: [{ id: 'l1', startDate: '2026-10-13', endDate: '2026-10-30', hourly: 10030 }],
  changes: [{ id: 'c1', type: 'both', fromRank: '사원', toRank: '대리', fromDept: '관리팀', toDept: '사업본부', reason: long, effectiveDate: '2026-03-01' }], interviews: [{ id: 'i1', date: '2026-06-10', memo: '<img src=x onerror="window.__x=1"> ' + long, followUp: true }],
  evals: [{ id: 'e1', type: 'regular', year: 2025, grade: 'A', status: 'confirmed', confirmedAt: '2026-02-10', comment: '성실' }], leaves: Array.from({ length: 40 }, (_, i) => ({ id: 'v' + i, status: 'approved', leaveType: '연차', startDate: '2026-0' + (1 + (i % 9)) + '-' + String(1 + (i % 27)).padStart(2, '0'), endDate: '2026-0' + (1 + (i % 9)) + '-' + String(1 + (i % 27)).padStart(2, '0') })), payslips: [{ month: '2026-08' }, { month: '2026-09' }] });
 window.__Hs = Hs; window.__Vw = Vw; window.__D = D; window.__W = W; window.__items = built.items;
 return built.items.length + ''; }"""
CARD = """([extra]) => { const h = Object.assign({ loading: false, items: window.__items, errors: [], skipped: 0, filter: 'all', limit: 30, shown: {} }, extra || {});
 document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__Vw.historyCardHtml(h) + '</div>'; }"""
DETAIL = """() => { const W = window.__W; const form = Object.assign({ name: '', empNo: '', dept: '', rank: '', empType: '', job: '', hireDate: '', step: '', phone: '', email: '', address: '', bankAccount: '', taxFamily: '', taxChildren: '', reason: '', resignDate: '', certs: [] }, W);
 const st = { today: '2026-10-25', workers: [W], sel: { id: 'w1', orig: W, form, history: null, hist: { loading: true, filter: 'all', limit: 30, shown: {} } } };
 window.__st = st; document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__D.detailHtml(st) + '</div>'; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, h, label) in ((390, 800, '폰(390px)'), (1280, 800, 'PC(1280px)')):
   ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(300)
   print('── ' + label)
   n = pg.evaluate(SETUP, VER)
   if w == 390: ok(n == '47', '이력 모듈·화면 모듈을 브라우저에서 불러온다(항목 47개)')
   pg.evaluate(CARD, [None]); pg.wait_for_timeout(300)
   ok(pg.evaluate("document.querySelectorAll('#w-hist .jh-hr__post').length") == 30 and pg.evaluate("document.querySelectorAll('[data-h-filter]').length") == 6, '처음에는 30줄만, 묶음 단추 6개')
   ok(pg.evaluate("document.querySelector('[data-h-more]') !== null && document.querySelector('[data-h-more]').innerText.includes('남은 17건')"), '[더 보기]에 남은 건수(17건)')
   ok(pg.evaluate("document.documentElement.scrollWidth") <= w + 1, '★ %s: 아주 긴 글자가 있어도 페이지가 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, pg.evaluate("document.documentElement.scrollWidth"), w))
   ok(pg.evaluate("document.querySelector('#w-hist').getBoundingClientRect().right <= innerWidth + 1"), '★ %s: 카드가 화면 오른쪽을 넘지 않는다' % label)
   ok(pg.evaluate("window.__x") is None and pg.evaluate("document.querySelectorAll('#w-hist img').length") == 0, '★ 면담 내용에 넣은 <img onerror> 가 실행되지 않고 이미지도 만들어지지 않는다')
   pg.evaluate(CARD, [{'filter': 'contract'}]); txt = pg.evaluate("document.querySelector('#w-hist').innerText")
   ok(pg.evaluate("document.querySelectorAll('#w-hist .jh-hr__post').length") == 2 and txt.count('금액') >= 2 and '21,565,000' not in txt and '10,320' not in txt and '10,030' not in txt, '★ 계약 2건: 금액은 화면 글자 어디에도 없고 "금액 ●●●●●"만 보인다')
   pg.evaluate(CARD, [{'filter': 'contract', 'shown': {'annual:a1': True}}]); txt = pg.evaluate("document.querySelector('#w-hist').innerText")
   ok('연봉 21,565,000원' in txt and '10,030' not in txt and txt.count('금액 ●●●●●') == 1, '[보기]를 누른 항목(연봉계약서)만 금액이 나타나고 근로계약서 금액은 계속 가려져 있다')
   pg.evaluate(CARD, [{'filter': 'leave', 'limit': 100}]); ok(pg.evaluate("document.querySelectorAll('#w-hist .jh-hr__post').length") == 40 and pg.evaluate("document.querySelector('[data-h-more]') === null"), '연차 묶음: 40줄 전부, 더 보기 없음')
   ok(pg.evaluate("[...document.querySelectorAll('[data-h-filter]')].filter((x) => x.getAttribute('data-variant') === 'primary').map((x) => x.getAttribute('data-h-filter')).join()") == 'leave', '선택한 묶음만 강조')
   pg.evaluate(CARD, [{'loading': True, 'items': None}]); ok(pg.evaluate("document.querySelector('#w-hist [aria-busy=true]') !== null && document.querySelector('[data-h-print]').disabled === true"), '읽는 중: 자리표시와 꺼진 인쇄 단추')
   # ── 상세 화면 안에서: 이력 카드만 다시 그려도 입력 중인 값이 유지된다
   pg.evaluate(DETAIL); pg.wait_for_selector('#w-hist [aria-busy=true]'); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelector('#w-hist') !== null && document.querySelector('[data-w-act=save]') !== null && document.querySelector('#w-hist').getBoundingClientRect().top > document.querySelector('[data-w-act=save]').getBoundingClientRect().top"), '직원 상세 화면: 수정 카드 아래에 이력 카드(읽는 중)가 붙는다')
   pg.evaluate("() => { const i = document.querySelector('[data-w-f=job]'); i.focus(); i.value = '입력 중인 업무 내용'; }")
   pg.evaluate("() => { const h = Object.assign(window.__st.sel.hist, { loading: false, items: window.__items, errors: [], skipped: 0 }); document.querySelector('#w-hist').innerHTML = window.__Vw.historyInnerHtml(h); }"); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelector('[data-w-f=job]').value") == '입력 중인 업무 내용' and pg.evaluate("document.activeElement === document.querySelector('[data-w-f=job]')"), '★ 이력이 늦게 도착해 카드를 다시 그려도 입력 중인 칸의 값과 커서(포커스)가 그대로다')
   ok(pg.evaluate("document.querySelectorAll('#w-hist .jh-hr__post').length") == 30 and pg.evaluate("document.querySelector('[data-h-print]').disabled") is False, '이력 카드는 새 내용으로 채워지고 인쇄 단추가 켜진다')
   ctx.close()
  # ── 인쇄본(새 창에 쓰는 문서) 실제 렌더
  ctx = b.new_context(viewport={'width': 794, 'height': 1100}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); pg.evaluate(SETUP, VER)
  html = pg.evaluate("() => window.__Vw.historyPrintHtml(Object.assign({}, window.__W, { phone: '010-1111-2222', address: '비밀 주소', bankAccount: '123-456' }), window.__items, '2026-10-25')")
  pp = ctx.new_page(); pp.set_content(html); pp.wait_for_timeout(300); t = pp.evaluate("document.body.innerText")
  print('── 인쇄본')
  ok(pp.title() == '인사기록카드 - 김가나' and '인사기록카드' in t and '김가나' in t and '24001' in t and t.count('연차') >= 40, '인쇄본: 제목·기본 정보·이력 표(연차 40건 포함)')
  ok('21,565,000' not in t and '10,320' not in t and '010-1111' not in t and '비밀 주소' not in t and '123-456' not in t and pp.evaluate("document.querySelectorAll('a[href]').length") == 0 and pp.evaluate("window.__x") is None, '★ 인쇄본에는 금액·연락처·주소·계좌·링크가 없고 위험한 글자도 실행되지 않는다')
  ok(pp.evaluate("document.documentElement.scrollWidth") <= 800, '인쇄본이 A4 폭(약 794px)을 넘지 않는다')
  ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 31: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 31)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
