"""주 단위 근로시간 화면 시험(대기열 1-3-16 ②) — 실제 크로미움에서 출퇴근 달력 안의 주별 카드와 인사 홈 신호 칸을 그려 확인한다.
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
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('weekly-view.js?v=')[1].split("'")[0]
PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>포털 홈</title></head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => {
 const W = await import('/modules/hr/weekly.js?v=' + ver); const V = await import('/modules/hr/weekly-view.js?v=' + ver); const VW = await import('/modules/hr/view.js?v=' + ver);
 const add = (s, n) => W.addDays(s, n); const rec = (date, h, o) => Object.assign({ date, workHours: h, checkIn: '09:00', checkOut: '19:00', breakMinutes: 60 }, o || {});
 const days = (start, hs) => hs.map((h, i) => rec(add(start, i), h)); const wk = (id, nm, d0, hs) => days(d0, hs).map((r) => Object.assign({ workerId: id, name: nm }, r));
 const rows = days('2026-10-12', [8, 8, 8, 8, 6]).concat(days('2026-10-19', [10, 10, 10, 10, 6]), days('2026-10-26', [10, 10, 10, 10, 10, 4]));
 const rep = W.weeklyReport([{ id: 'a', name: '김가나' }, { id: 'b', name: '<img src=x onerror="window.__x=1">' }, { id: 'c', name: '이다라' }], [].concat(wk('a', '김가나', '2026-10-19', [10, 10, 10, 10, 8]), wk('b', 'b', '2026-10-12', [11, 11, 11, 11, 11, 3]), wk('c', '이다라', '2026-10-19', [9, 9, 9, 9, 9])), '2026-10-25');
 window.__W = W; window.__V = V; window.__VW = VW; window.__rows = rows; window.__rep = rep; return rep.items.length + ',' + rows.length; }"""
CAL = """([sel, adj]) => { const st = { today: '2026-10-25', acMode: 'cal', acW: 'w1', acWorkers: [{ id: 'w1', name: '김가나', empNo: 'E1', rank: '대리' }], workers: [], acY: 2026, acM: 10, acRows: window.__rows, acAdj: [], acLeaves: [], acHol: new Set(), acSel: '', acForm: null, acWeek: sel, acDaily: null, otRows: [], otOpen: '', otForm: null, otFormWage: null, otWage: null, otBanner: null };
 document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__VW.attendCalHtml(st) + '</div>'; }"""
HOME = """() => { document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__VW.homeHtml() + '</div>'; document.getElementById('hm-week').innerHTML = window.__V.weeklyHomeHtml(window.__rep); }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, h, label) in ((390, 800, '폰(390px)'), (1280, 800, 'PC(1280px)')):
   ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html')
   print('── ' + label)
   r0 = pg.evaluate(SETUP, VER)
   if w == 390: ok(r0 == '3,16', '주 근로시간 모듈·실제 화면 함수를 브라우저에서 불러온다(홈 신호 3건, 기록 16일)')
   pg.evaluate(CAL, ['', None]); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelectorAll('[data-w-table] tbody tr').length") == 5 and pg.evaluate("document.querySelectorAll('[data-ac-week]').length") == 3, '달력 화면 안의 주별 표: 10월이 걸치는 5주, 기록 있는 3주에 [일별] 단추')
   ok(pg.evaluate("document.querySelector('[data-w-table]').innerText.includes('🔴 52시간 초과') && document.querySelector('[data-w-table]').innerText.includes('🟡 주의')"), '단계가 기호와 글자로 보인다(🟡 주의 · 🔴 52시간 초과)')
   ok(pg.evaluate("document.querySelector('[data-w-table]').getBoundingClientRect().right <= innerWidth + 1"), '★ %s: 주별 표가 화면 오른쪽을 넘지 않는다' % label)
   ok(pg.evaluate("document.documentElement.scrollWidth") <= w + 1, '★ %s: 페이지 전체가 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, pg.evaluate("document.documentElement.scrollWidth"), w))
   pg.evaluate(CAL, ['2026-10-26', None]); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelectorAll('[data-w-detail] tbody tr').length") == 8, '주를 고르면 일별 내역(월~일 7줄 + 합계)')
   ok(pg.evaluate("document.querySelector('[data-w-detail]').innerText.includes('합계') && document.querySelector('[data-w-detail]').closest('section').innerText.includes('합계 54h')"), '일별 내역 합계 54h')
   pg.evaluate(HOME); pg.wait_for_timeout(300)
   ok(pg.evaluate("window.__x") is None, '★ 직원 이름에 넣은 <img onerror> 가 실행되지 않는다')
   ok(pg.evaluate("document.querySelectorAll('[data-hm-week]').length") == 3 and pg.evaluate("document.querySelector('#hm-week .jh-alert[data-tone=danger]') !== null"), '홈 신호 칸: 대상 3건(초과·경고·주의) + 52시간 초과 빨간 안내')
   ok(pg.evaluate("document.querySelector('#hm-week').getBoundingClientRect().right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"), '★ %s: 홈 신호 칸도 화면을 넘지 않는다' % label)
   ok(pg.evaluate("[...document.querySelectorAll('[data-hm-week]')].map((x) => x.getAttribute('data-hm-week').split('|')[1]).every((s) => /^\\d{4}-\\d{2}-\\d{2}$/.test(s))") and pg.evaluate("[...document.querySelectorAll('[data-hm-week]')].every((x) => x.getAttribute('data-hm-week').split('|')[0].length > 0)"), '이름 단추: 직원|주(월요일 날짜) 값이 들어 있다')
   ok(len(pg.evaluate("[...document.querySelectorAll('#hm-week tbody tr')].map((r) => r.children[0].innerText.trim())")) == 3 and pg.evaluate("document.querySelector('#hm-week tbody tr').innerText.includes('58h')"), '홈 표: 3줄, 가장 심한 단계(58h 초과)가 맨 위')
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 24: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 24)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
