"""4대보험 월별 대조 화면 시험(대기열 1-3-17) — 실제 크로미움에서 대조 표와 입력 폼을 폰·PC 폭으로 그려 확인한다.
공개 저장소이므로 가짜 이름·값만 쓴다. 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os
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
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('insurance-view.js?v=')[1].split("'")[0]
PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>포털</title></head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => { const V = await import('/modules/hr/insurance-view.js?v=' + ver); window.__V = V;
 const S = { count: 5, gross: 13238476, pension: 345800, health: 303760, ltcare: 39900, employ: 115940 };
 window.__data = { payslips: { '2026-06': S, '2026-07': S, '2026-08': S }, bills: { '2026-05': { pension: 691600, health: 607520, ltcare: 79800, unpaid: 0 }, '2026-07': { pension: 691600, health: 607520, ltcare: 79800, unpaid: 0 }, '2026-08': { pension: 1826060, health: 607520, ltcare: 79800, unpaid: 100000 } } }; return 'ok'; }"""
PAGE_JS = """(form) => { document.getElementById('root').innerHTML = '<div class="jh-hr">' + window.__V.insurancePageHtml({ loading: false, error: '', busy: false, data: window.__data, offset: 0, form: form }) + '</div>'; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, h, label) in ((390, 800, '폰(390px)'), (1280, 800, 'PC(1280px)')):
   ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); print('── ' + label)
   if w == 390: ok(pg.evaluate(SETUP, VER) == 'ok', '화면 모듈(계산 모듈 포함)을 브라우저에서 불러온다')
   else: pg.evaluate(SETUP, VER)
   pg.evaluate(PAGE_JS, None); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelectorAll('[data-ins-table] tbody tr').length") == 4 and pg.evaluate("document.querySelectorAll('[data-ins-edit]').length") == 5, '대조 표 4줄(최근 달이 위), 줄마다 [고지 입력/수정] + 위쪽 [＋ 고지금액 입력]')
   ok(pg.evaluate("[...document.querySelectorAll('[data-ins-table] tbody tr')].map((r) => r.querySelector('strong').innerText).join()") == '2026-08,2026-07,2026-06,2026-05', '줄 순서 08 → 07 → 06 → 05')
   t = pg.evaluate("document.querySelector('[data-ins-table]').innerText")
   ok('연금 비율 이탈' in t and '전월 대비 급증' in t and '미납' in t and '고지서 없음' in t and '명세서 없음' in t and '이상 없음' in t, '점검 표시가 글자로 보인다(비율 이탈·급증·미납·고지서 없음·명세서 없음·이상 없음)')
   ok('1,823,920' in t and '689,460' in t and '2,513,380' in t, '금액이 천 단위 쉼표로 보인다(사업주 실부담 1,823,920 등)')
   ok(pg.evaluate("document.querySelector('[data-ins-table]').closest('.jh-hr__scroll').getBoundingClientRect().right <= innerWidth + 1"), '★ %s: 표 영역이 화면 오른쪽을 넘지 않는다' % label)
   ok(pg.evaluate("document.documentElement.scrollWidth") <= w + 1, '★ %s: 페이지 전체가 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, pg.evaluate("document.documentElement.scrollWidth"), w))
   ok(pg.evaluate("document.querySelector('[data-ins-offset]').value") == '0' and pg.evaluate("document.querySelectorAll('[data-ins-offset] option').length") == 3, '고지월 차이 선택(0·1·−1개월), 기본 0')
   pg.evaluate(PAGE_JS, {'ym': '2026-09', 'pension': '', 'health': '', 'ltcare': '', 'unpaid': '', 'exists': False}); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelectorAll('[data-ins-form] [data-ins-f]').length") == 5 and pg.evaluate("document.querySelector('[data-ins-f=ym]').type") == 'month' and pg.evaluate("document.querySelector('[data-ins-f=ym]').disabled") is False and pg.evaluate("document.querySelector('[data-ins-act=delete]')") is None, '입력 폼: 월 + 금액 4칸, 월은 수정 가능, 삭제 단추 없음')
   ok(pg.evaluate("document.querySelector('[data-ins-f=pension]').getAttribute('inputmode')") == 'numeric', '금액 칸은 숫자 자판(휴대폰)')
   pg.evaluate(PAGE_JS, {'ym': '2026-08', 'pension': 1826060, 'health': 607520, 'ltcare': 79800, 'unpaid': 100000, 'exists': True}); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelector('[data-ins-f=ym]').disabled") is True and pg.evaluate("document.querySelector('[data-ins-f=pension]').value") == '1826060' and pg.evaluate("document.querySelector('[data-ins-act=delete]') !== null"), '수정 폼: 월 고정, 기존 값 채움, [삭제] 단추')
   ok(pg.evaluate("document.querySelector('[data-ins-form]').getBoundingClientRect().right <= innerWidth + 1") and pg.evaluate("document.documentElement.scrollWidth") <= w + 1, '★ %s: 입력 폼도 화면을 넘지 않는다' % label)
   pg.evaluate(PAGE_JS, {'ym': '2026-09', 'pension': '<img src=x onerror="window.__x=1">', 'health': '', 'ltcare': '', 'unpaid': '', 'exists': False}); pg.wait_for_timeout(200)
   ok(pg.evaluate("window.__x") is None, '★ 입력칸 값에 넣은 <img onerror> 가 실행되지 않는다')
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 22: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 22)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
