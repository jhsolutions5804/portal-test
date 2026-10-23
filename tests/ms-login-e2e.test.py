"""Microsoft 로그인 — 실제 앱 부팅 경로의 로그인 화면 시험(대기열 00-0, 실제 크로미움).
노드 시험(ms-login-view)은 renderLogin 함수만 따로 그려 보고, 다른 크로미움 시험들은 로그인 이후 화면을 가짜 로그인으로 본다 — 입구인 "로그인 전 화면"이 실제 앱 부팅(boot.js → shell.js)에서 그려지고 동작하는지는 이 시험만 본다. 모든 직원의 입구라 CI 가 계속 지킨다.
Firebase SDK 파일(gstatic)만 실제로 받고 인증·데이터·Microsoft 서버는 막는다(로그인하지 않은 상태 그대로 6초 지연 타이머 뒤 로그인 화면이 뜬다). 크로미움(playwright)이 없는 환경에서는 건너뛴다(종료 코드 0, SKIP 표시).
타이밍에 흔들리지 않도록 고정 대기 대신 "조건이 될 때까지 기다리기(poll)"를 쓰고, 기다려도 안 되면 예외로 죽지 않고 무엇이 안 됐는지 FAIL 로 남긴다."""
import http.server, os, socketserver, sys, threading
from urllib.parse import parse_qs, urlparse
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — Microsoft 로그인 화면 시험 건너뜀'); sys.exit(0)
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
class Threaded(socketserver.ThreadingMixIn, socketserver.TCPServer):   # 앱 전체(모듈 수십 개)를 실제로 불러오면 요청이 동시에 몰려 단일 스레드 서버는 요청 하나에 막힐 수 있다(2026-10-23 12회 중 4회 실패 — ms-login-test.js 요청이 끝나지 않았다)
    allow_reuse_address = True; daemon_threads = True
srv = Threaded(('127.0.0.1', 0), Quiet); PORT = srv.server_address[1]; threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % PORT; ALLOW = (BASE, 'https://www.gstatic.com/firebasejs/')
TENANT, CLIENT = '548fcb48-1ab8-4c47-8242-bc098ea80416', '3669b1e5-34e9-4630-a357-ac512a878a90'
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
def poll(pg, cond, ms=15000):
    """조건이 참이 될 때까지 100ms 간격으로 기다린다(고정 대기에 흔들리지 않는다). 참이면 True, 시간이 다 되면 False"""
    waited = 0
    while waited <= ms:
        try:
            if cond(): return True
        except Exception: pass
        pg.wait_for_timeout(100); waited += 100
    return False
def blocked(pg):
    pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith(ALLOW) else r.abort())
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        try:
            # ── 1) 로그인 전 화면 — 시작 주소에 쿼리·해시를 붙여 연다(리디렉션 주소가 이것들을 떼는지 보려고)
            pg = b.new_page(viewport={'width': 420, 'height': 800}); pg.set_default_timeout(8000); errs = []; reqs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:160])); pg.on('request', lambda r: reqs.append(r.url)); blocked(pg)
            pg.goto(BASE + '/app/index.html?r=1#/edoc/new', wait_until='domcontentloaded')
            shown = poll(pg, lambda: pg.locator('#jh-ms-btn').count() == 1, 25000)   # 6초 지연 타이머 뒤 로그인 화면
            ok(shown, '★ 실제 앱 부팅 경로에서 25초 안에 로그인 화면의 "Microsoft로 로그인" 버튼이 그려진다 ' + ('' if shown else '(부팅 오류: ' + str(errs[:2]) + ')'))
            if shown:
                btn = pg.locator('#jh-ms-btn')
                ok(btn.inner_text().strip() == 'Microsoft로 로그인' and btn.get_attribute('type') == 'button', '버튼 글자·type=button')
                ok(btn.evaluate('e => e.closest("form") === null'), 'Microsoft 버튼은 폼 밖(게스트 폼 제출과 섞이지 않는다)')
                tab_staff = pg.locator('#jh-tab-staff'); tab_guest = pg.locator('#jh-tab-guest')
                ok(tab_staff.count() == 1 and tab_guest.count() == 1 and tab_staff.inner_text().strip() == '직원 계정 로그인' and tab_guest.inner_text().strip() == 'Guest 계정 로그인', '★ 로그인 화면 위에 "직원 계정 로그인"·"Guest 계정 로그인" 탭이 있다')
                ok(tab_staff.get_attribute('aria-selected') == 'true' and tab_guest.get_attribute('aria-selected') == 'false' and not pg.locator('#jh-id').is_visible(), '★ 처음에는 직원 계정 로그인 탭이 선택돼 있고 아이디·비밀번호 칸은 보이지 않는다')
                has_guest = tab_guest.count() == 1
                if has_guest:
                    tab_guest.click()
                    opened = poll(pg, lambda: pg.locator('#jh-id').is_visible() and pg.locator('#jh-pw').is_visible(), 3000)
                    ok(opened and pg.locator('#jh-pw').get_attribute('type') == 'password' and not btn.is_visible(), '★ Guest 계정 로그인 탭을 누르면 아이디·비밀번호 칸이 보이고 Microsoft 버튼은 숨는다 — 기존 비밀번호 로그인 경로가 유지된다(정규 직원 잠금 방지)')
                    ok(pg.locator('#jh-login-btn').count() == 1 and pg.locator('#jh-login-form').count() == 1, '비밀번호 로그인 폼·버튼이 있다')
                    tab_staff.click(); poll(pg, lambda: btn.is_visible(), 3000)
                btn.click()
                got = poll(pg, lambda: [u for u in reqs if 'login.microsoftonline.com' in u and 'authorize' in u], 6000)
                hit = [u for u in reqs if 'login.microsoftonline.com' in u and 'authorize' in u]
                ok(bool(hit), '★ 버튼을 누르면 Microsoft 인증 주소(authorize)로 이동을 시도한다')
                if hit:
                    u = urlparse(hit[0]); q = parse_qs(u.query)
                    ok(u.path == '/' + TENANT + '/oauth2/v2.0/authorize', '★ 회사 테넌트의 인증 주소')
                    ok(q.get('client_id') == [CLIENT] and q.get('response_type') == ['code'] and q.get('code_challenge_method') == ['S256'] and q.get('scope') == ['openid profile email'], '앱 ID·코드 흐름·S256·범위(openid profile email)')
                    ok(not q['state'][0].startswith('mstest.') and len(q['state'][0]) >= 16 and len(q['nonce'][0]) >= 16 and len(q['code_challenge'][0]) >= 43, '★ state 는 시험 페이지용(mstest.)이 아니고 state·nonce·챌린지가 충분히 길다')
                    ok(q['redirect_uri'] == [BASE + '/app/index.html'], '★ 리디렉션 주소는 시작 주소의 쿼리(?r=1)·해시(#/edoc/new)를 뗀 origin + 경로여야 한다 — Entra 에 등록된 주소와 글자까지 같아야 하기 때문 ' + str(q.get('redirect_uri')))
                ok(not [e for e in errs if 'does not provide' in e or 'SyntaxError' in e or 'Failed to resolve module' in e or 'is not defined' in e], '부팅 중 import·구문·정의 오류가 없다 ' + str(errs[:2]))
            pg.close()
            # ── 2) 시험 페이지(mstest.)용 콜백은 앱이 아니라 시험 페이지로 보낸다 — 실제 브라우저에서 index.html 의 이동 스크립트가 동작하는지
            pg2 = b.new_page(viewport={'width': 420, 'height': 800}); pg2.set_default_timeout(8000); blocked(pg2); nav2 = []
            pg2.on('framenavigated', lambda f: nav2.append(f.url) if f == pg2.main_frame else None)
            pg2.goto(BASE + '/app/index.html?code=C1&state=mstest.ABC', wait_until='commit')
            went = poll(pg2, lambda: any(u.startswith(BASE + '/app/ms-login-test.html?code=C1&state=mstest.ABC') for u in nav2), 12000)
            ok(went, '★ state 가 mstest. 인 콜백은 앱이 아니라 시험 페이지로 쿼리째 이동한다(이동 경로로 확인 — 시험 페이지가 처리 뒤 주소를 지우므로 최종 주소가 아니다) ' + str(nav2[:3]))
            cleaned = poll(pg2, lambda: pg2.url == BASE + '/app/ms-login-test.html', 20000)
            ok(cleaned, '★ 시험 페이지는 콜백을 처리한 뒤 주소에서 code·state 를 지운다(주소창·브라우저 기록에 인증 코드가 남지 않는다) — 최종 주소: ' + pg2.url[:80])
            pg2.close()
            # ── 3) 일반(본 로그인) 콜백은 시험 페이지로 가지 않는다 — 위 이동 시험과 짝(이동하지 않는 쪽)
            pg3 = b.new_page(viewport={'width': 420, 'height': 800}); pg3.set_default_timeout(8000); blocked(pg3); nav3 = []
            pg3.on('framenavigated', lambda f: nav3.append(f.url) if f == pg3.main_frame else None)
            pg3.goto(BASE + '/app/index.html?code=C1&state=abcdef0123456789', wait_until='commit'); pg3.wait_for_timeout(3000)
            ok(not any('ms-login-test.html' in u for u in nav3 + [pg3.url]), '★ 일반(본 로그인) 콜백은 시험 페이지로 가지 않는다(위 이동 시험과 짝) ' + str(nav3[:2]))
            pg3.close()
        except Exception as e:
            ok(False, '시험 도중 예외로 중단됨: ' + type(e).__name__ + ' ' + str(e).split('\n')[0][:160])
        finally: b.close()
finally: srv.shutdown()
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
