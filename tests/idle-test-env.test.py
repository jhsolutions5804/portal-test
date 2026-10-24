"""테섭(주소에 /portal-test/)은 자동 로그아웃 없음, 본섭 주소는 그대로 1시간(대표님 2026-10-24 "테섭은 로그아웃 제한시간 없애줘") — 새 플랫폼(app/core/idle.js)과 폰용 가드(m/auth-guard.js)를 실제 크로미움에서 확인한다.
주소 경로만 바꿔 같은 코드를 테섭 주소·본섭 주소로 열고, 시계(Date.now)를 앞당겨 "오래 가만히 둔 뒤"를 흉내 낸다. 옛 화면(classic.html)은 tests/idle-test-env.test.mjs. 크로미움이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, re
try:
 from playwright.sync_api import sync_playwright
except Exception:
 print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
class H(http.server.SimpleHTTPRequestHandler):
 def __init__(s, *a, **k): super().__init__(*a, directory=REPO, **k)
 def log_message(s, *a): pass
httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % port
VER = re.search(r'idle\.js\?v=([0-9a-z]+)', open(os.path.join(REPO, 'app', 'core', 'boot.js'), encoding='utf-8').read()).group(1)
CLOCK = "(() => { const real = Date.now.bind(Date); window.__off = 0; Date.now = () => real() + window.__off; })();"
NEWPAGE = '<!doctype html><meta charset=utf-8><script type=module>import { startIdle, stopIdle } from "%s/app/core/idle.js?v=%s"; window.__idle = { startIdle, stopIdle }; window.__ready = true;</script>' % (BASE, VER)
MPAGE = '<!doctype html><meta charset=utf-8><script>localStorage.setItem("jh_login_perms", JSON.stringify({ a: 1 })); localStorage.setItem("jh_last_active", String(Date.now() - 2 * 3600 * 1000));</script><script src="%s/m/auth-guard.js"></script><body>m page</body>' % BASE
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
with sync_playwright() as p:
 b = p.chromium.launch()
 def page(path, html, init=''):
  ctx = b.new_context(); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.route('**' + path, lambda r: r.fulfill(status=200, content_type='text/html', body=html))
  pg.route('**/classic.html', lambda r: r.fulfill(status=200, content_type='text/html', body='<!doctype html><body>classic stub</body>'))
  pg.add_init_script(CLOCK + init); pg.goto(BASE + path); return pg, errs
 def new_idle(path, init='', offset_ms=2 * 3600 * 1000, wait=2500):
  pg, errs = page(path, NEWPAGE, init); pg.wait_for_function('window.__ready === true')
  pg.evaluate("() => { window.__expired = 0; window.__idle.startIdle({ onExpire: () => { window.__expired++; } }); }")
  pg.evaluate('(o) => { window.__off = o; }', offset_ms); pg.wait_for_timeout(wait)
  r = pg.evaluate("({ expired: window.__expired, dialog: !!document.querySelector('.jh-idle') })"); pg.context.close(); return r, errs
 print('── 새 플랫폼(app/core/idle.js)')
 r, e = new_idle('/portal-test/p.html'); ok(r['expired'] == 0 and not r['dialog'], '★ 테섭 주소: 2시간 가만히 둬도 자동 로그아웃이 일어나지 않고 경고창도 뜨지 않는다 — %s' % r)
 r, e = new_idle('/portal-test/p.html', offset_ms=4 * 3600 * 1000 * 6); ok(r['expired'] == 0, '★ 테섭 주소: 하루(24시간)가 지나도 마찬가지다')
 r, e = new_idle('/portal-test/p.html', init="localStorage.setItem('jh_idle_ms','3000'); localStorage.setItem('jh_idle_warn_ms','1000');", offset_ms=4000); ok(r['expired'] == 1, '★ 테섭에서 시험용으로 jh_idle_ms 를 직접 주면 그 값으로 동작한다(기존 시험 장치 유지) — %s' % r)
 r, e = new_idle('/p.html'); ok(r['expired'] == 1, '★ 본섭 주소(/portal-test/ 가 아님): 2시간 뒤에는 자동 로그아웃된다(1시간 기준 그대로) — %s' % r)
 r, e = new_idle('/p.html', offset_ms=30 * 60 * 1000); ok(r['expired'] == 0 and not r['dialog'], '본섭 주소: 30분 뒤에는 아직 로그아웃도 경고도 없다 — %s' % r)
 r, e = new_idle('/p.html', offset_ms=3590 * 1000); ok(r['expired'] == 0 and r['dialog'], '본섭 주소: 59분 50초 뒤에는 경고창이 뜬다(1분 전 안내 그대로) — %s' % r)
 r, e = new_idle('/portal-test-old/p.html'); ok(r['expired'] == 1, '이름이 비슷한 주소(/portal-test-old/)는 테섭으로 오인하지 않는다')
 ok(not e, '화면 오류 없음 %s' % e[:2])
 print('── 폰용 가드(m/auth-guard.js): 로그인 정보가 있고 마지막 활동이 2시간 전')
 for path, expect_out, label in (('/portal-test/m/p.html', False, '테섭 주소'), ('/m/p.html', True, '본섭 주소')):
  pg, errs = page(path, MPAGE); pg.wait_for_timeout(2500); st = pg.evaluate("({ path: location.pathname, perms: localStorage.getItem('jh_login_perms') })")
  if expect_out: ok(st['path'].endswith('/classic.html') and st['perms'] is None, '★ %s: 2시간 방치면 로그아웃되어 로그인 화면(classic)으로 간다(기존 동작 그대로) — %s' % (label, st))
  else: ok(st['path'] == path and st['perms'] is not None, '★ %s: 2시간 방치해도 로그아웃되지 않고 그 화면에 그대로 있다 — %s' % (label, st))
  ok(not errs, label + ': 화면 오류 없음 %s' % errs[:2]); pg.context.close()
 b.close()
print('\n' + ('전부 통과 (%d건)' % pass_n if not fail_n else '%d건 실패 / 통과 %d' % (fail_n, pass_n))); sys.exit(1 if fail_n else 0)
