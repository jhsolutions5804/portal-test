"""평가 결과 통보서 인쇄 시험(대기열 1-2-7 ②, 대표님 2026-10-22) — 실제 크로미움으로 두 가지를 확인한다.
① 옛 방식(sandbox="" iframe 안쪽 창의 print() 를 바깥에서 부름)이 실제로 교차 출처 오류를 내는지 — 이 문제의 증거를 시험으로 남긴다.
② 새 방식(새 창에 resultPrintHtml 을 쓴다)이 실제로 새 창의 제목을 문서 이름으로 만들고 인쇄를 부르는지.
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
VER = open(os.path.join(ROOT, 'modules', 'eval', 'index.js'), encoding='utf-8').read().split('eval-perm.js?v=')[1].split("'")[0]
PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>포털 홈</title></head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => {
 const R = await import('/modules/eval/result-report.js?v=' + ver); const E = await import('/modules/eval/evaluation.js?v=' + ver);
 const W = { id: 'w1', name: '도하린', dept: 'PJT팀', rank: '사원' };
 const cyc = Object.assign(E.emptyCycle(W, 2026), { leadAgg: { areas: { achievement: 4, competency: 5, conduct: 3 }, n: 1, by: 'uL' }, peerAgg: { avg: 4, n: 3 }, ceo: { approved: true, score: null, comment: '' }, confirmed: true });
 const r = R.buildResultData({ year: 2026, worker: W, cycle: cyc, adhoc: [] }); window.__R = R; window.__data = r.data; window.__html = R.resultHtml(r.data, { today: '2026-11-20' });
 return r.ok;
}"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 800}); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html')
  ok(pg.evaluate(SETUP, VER) is True, '통보서 데이터와 문서(resultHtml)를 실제 브라우저에서 만든다')
  print('── ① 옛 방식: sandbox="" iframe 안쪽 창의 print() 를 바깥에서 부르면')
  r1 = pg.evaluate("""() => new Promise((res) => { const f = document.createElement('iframe'); f.setAttribute('sandbox', ''); f.srcdoc = window.__html; document.body.appendChild(f);
   f.onload = () => { const out = { threw: false, msg: '' }; try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { out.threw = true; out.msg = String(e && e.message || e); } res(out); }; })""")
  ok(r1['threw'] is True and 'cross-origin' in r1['msg'], '★ 옛 [인쇄] 버튼이 하던 일(sandbox iframe 의 contentWindow.print())은 실제로 교차 출처 오류가 난다 — 그래서 늘 "Ctrl+P" 안내만 보였다 (실제: %s)' % r1['msg'][:90])
  print('── ② 새 방식: 새 창에 인쇄용 문서를 쓴다')
  pg.evaluate("""() => { window.__opened = []; window.__printed = []; const orig = window.open.bind(window);
   window.open = (u, n) => { const w = orig(u, n); window.__opened.push([u, n]); if (w) { w.print = () => { window.__printed.push(w.document.title); }; window.__win = w; } return w; }; }""")
  pg.evaluate("""() => { const R = window.__R; const w = window.open('', '_blank'); w.document.write(R.resultPrintHtml(window.__html, R.resultPrintTitle(window.__data))); w.document.close(); }""")
  pg.wait_for_function('window.__printed.length >= 1', timeout=8000)
  ok(pg.evaluate('window.__opened') == [['', '_blank']], '새 창을 window.open("", "_blank") 로 연다')
  ok(pg.evaluate('window.__printed') == ['인사평가 결과 통보서 - 도하린 - 2026'], '★ 새 창에서 window.print 가 불리는 순간 창의 제목이 문서 이름이다 — 저장 창의 기본 파일 이름 (실제: %s)' % pg.evaluate('window.__printed'))
  ok(pg.evaluate('window.__win.document.title') == '인사평가 결과 통보서 - 도하린 - 2026', '새 창의 document.title 도 문서 이름이다')
  body = pg.evaluate('window.__win.document.body.innerText')
  ok('도하린' in body and '80' in body, '★ 새 창의 본문은 통보서 내용이다(직원 이름·점수가 보인다)')
  ok(pg.evaluate('window.__printed.length') == 1, '인쇄는 한 번만 불린다')
  ok(pg.evaluate("window.__win.document.querySelectorAll('script').length") == 1, '새 창 문서에는 스크립트가 인쇄 스크립트 하나뿐이다')
  ok(pg.evaluate('document.title') == '포털 홈', '★ 원래 창(포털)의 제목은 바뀌지 않는다')
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 10: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 10)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
