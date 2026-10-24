"""임금대장 화면 시험(대기열 1-3-16 ①) — 실제 크로미움에서 화면 함수가 만든 HTML 이 폰·PC 폭에서 어떻게 보이는지 확인한다.
확인: 32칸 표가 가로 스크롤 영역 안에 있고 페이지 전체가 옆으로 밀리지 않는다 · 성명 칸이 고정된다 · 이름·사유에 넣은 HTML/스크립트가 실행되지 않는다 · 단추의 꺼짐 상태 · 월 입력.
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
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('ledger-view.js?v=')[1].split("'")[0]
PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>포털 홈</title></head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => {
 const L = await import('/modules/hr/ledger.js?v=' + ver); const V = await import('/modules/hr/ledger-view.js?v=' + ver);
 const S = (id, name, extra) => Object.assign({ workerId: id, month: '2026-08', name, empNo: 'E' + id, dept: '사업본부', rank: '대리', basic: 2000000, fixedOt: 180000, fixedNight: 20000, weekly: 400000, holidayPay: 50000, bonus: 100000, specialBonus: 0, extraPay: 0, techAllowance: 50000, travelAllowance: 0, grossPay: 2800000, pension: 100000, health: 80000, ltcare: 10000, employ: 25000, dormitory: 0, incomeTax: 60000, localTax: 6000, totalDeduct: 281000, netPay: 2519000, attHours: 176, holidayHours: 6, leaveHours: 8, otHours: 12, nightHours: 5 }, extra || {});
 const W = (id, name) => ({ id, name, empNo: 'E' + id, hireDate: '2024-03-01', job: 'FCU 설치' });
 const slips = { w1: S('w1', '김가나'), w2: S('w2', '이다라'), w3: S('w3', '<img src=x onerror="window.__x=1">') };
 const rows = [L.ledgerRow(slips.w1, W('w1', '김가나'), 20), L.ledgerRow(slips.w2, W('w2', '이다라'), null), L.ledgerRow(slips.w3, W('w3', slips.w3.name), 18)];
 const good = L.closeChecks('2026-08', [], slips, rows); const bad = L.closeChecks('2026-08', [], Object.assign({}, slips, { w1: S('w1', '김가나', { netPay: 1 }) }), rows);
 window.__V = V; window.__rows = rows; window.__good = good; window.__bad = bad;
 return [good.ok, bad.ok, rows.length].join(','); }"""
PAINT = """([st]) => { const s = Object.assign({ ym: '2026-08', loading: false, error: '', busy: false, unlockOpen: false, reason: '' }, st || {});
 if (s.data === 'good') s.data = { rows: window.__rows, checks: window.__good, close: null }; else if (s.data === 'bad') s.data = { rows: window.__rows, checks: window.__bad, close: null };
 else if (s.data === 'closed') s.data = { rows: window.__rows, checks: window.__good, close: { status: 'closed', version: 2, closedAt: '2026-09-05T03:04:00Z', closedBy: 'adm@jhsol.kr', rowCount: 3, unlockLog: [] } };
 document.getElementById('root').innerHTML = '<div class="jh-hr">' + window.__V.ledgerPageHtml(s) + '</div>'; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, h, label) in ((390, 800, '폰(390px)'), (1280, 800, 'PC(1280px)')):
   ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html')
   print('── ' + label)
   if label.startswith('폰'):
    ok(pg.evaluate(SETUP, VER) == 'true,false,3', '화면·계산 모듈을 실제 브라우저에서 불러온다(점검 통과·막힘 모두 만든다)')
   else:
    pg.evaluate(SETUP, VER)
   pg.evaluate(PAINT, [{'data': 'good'}]); pg.wait_for_timeout(300)
   ok(pg.evaluate("document.querySelectorAll('[data-l-table] thead th').length") == 32, '표 머리글이 32칸이다')
   ok(pg.evaluate("[...document.querySelectorAll('[data-l-table] tr')].every((r) => r.children.length === 32)"), '모든 줄(머리글·직원 3·합계)이 32칸이다')
   ok(pg.evaluate("document.querySelectorAll('[data-l-table] tbody tr').length") == 4, '직원 줄 3 + 합계 줄 1')
   sw = pg.evaluate("(() => { const w = document.querySelector('.jh-hr__scroll'); return [w.scrollWidth, w.clientWidth, document.documentElement.scrollWidth, innerWidth]; })()")
   if w == 390: ok(sw[0] > sw[1] + 50, '★ 폰: 표가 컨테이너보다 넓어 안에서 가로 스크롤된다(표 %dpx > 영역 %dpx)' % (sw[0], sw[1]))
   ok(sw[2] <= sw[3] + 1, '★ %s: 페이지 전체는 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, sw[2], sw[3]))
   ok(pg.evaluate("getComputedStyle(document.querySelector('[data-l-table] thead th')).position") == 'sticky' and pg.evaluate("getComputedStyle(document.querySelector('[data-l-table] tbody td')).position") == 'sticky', '성명 칸(머리글·직원 줄)이 고정(sticky)이다')
   if w == 390:
    pg.evaluate("document.querySelector('.jh-hr__scroll').scrollLeft = 600"); pg.wait_for_timeout(150)
    pos = pg.evaluate("(() => { const wr = document.querySelector('.jh-hr__scroll').getBoundingClientRect(); const td = document.querySelector('[data-l-table] tbody td').getBoundingClientRect(); return [Math.round(td.left - wr.left), Math.round(td.width)]; })()")
    ok(pos[0] <= 2, '★ 폰: 가로로 600px 밀어도 이름 칸이 왼쪽에 붙어 있다(왼쪽 간격 %dpx)' % pos[0])
   ok(pg.evaluate('window.__x') is None, '★ 이름에 넣은 <img onerror> 가 실행되지 않는다')
   ok(pg.evaluate("document.querySelectorAll('[data-l-table] img').length") == 0 and '&lt;img' in pg.evaluate("document.querySelector('[data-l-table]').innerHTML"), '이름의 태그가 글자로 보인다(이미지 태그가 만들어지지 않음)')
   ok(pg.evaluate("document.querySelector('[data-l-month]').type") == 'month' and pg.evaluate("document.querySelector('[data-l-month]').value") == '2026-08', '월 입력칸: month 형식, 값 2026-08')
   ok(pg.evaluate("document.querySelector('[data-l-act=close]').disabled") is False, '점검 통과: [이 달 마감] 켜짐')
   pg.evaluate(PAINT, [{'data': 'bad'}]); ok(pg.evaluate("document.querySelector('[data-l-act=close]').disabled") is True and pg.evaluate("document.querySelector('.jh-alert[data-tone=danger]') !== null"), '점검에서 막히면 [이 달 마감] 꺼짐 + 빨간 안내')
   pg.evaluate(PAINT, [{'data': 'closed'}]); ok(pg.evaluate("document.querySelector('[data-l-act=close]').disabled") is True and pg.evaluate("document.querySelector('[data-l-act=unlock]') !== null"), '마감된 달: [이 달 마감] 꺼짐 + [마감 해제] 나타남')
   RS = '</textarea><script>window.__y=1</script>"사유" & <b>굵게</b>'
   pg.evaluate(PAINT, [{'data': 'closed', 'unlockOpen': True, 'reason': RS}]); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelector('[data-l-reason]').value") == RS and pg.evaluate('window.__y') is None, '★ 해제 사유 입력칸: 넣은 글자가 한 글자도 안 바뀌고(왕복) 스크립트는 실행되지 않는다')
   pg.evaluate(PAINT, [{'loading': True, 'data': None}]); ok(pg.evaluate("document.querySelector('[aria-busy=true]') !== null") and pg.evaluate("document.querySelector('[data-l-table]') === null"), '불러오는 중: 자리표시만 보이고 표·단추 없음')
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 30: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 30)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
