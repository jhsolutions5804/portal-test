"""근로계약서 작성 화면의 단시간 근로자 칸 배치 시험(1-3-23) — 실제 스타일 파일로 폰·PC 폭에서 요일 7줄·시각 입력·시급 카드가 잘리거나 화면 밖으로 나가지 않는지 잰다.
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
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('short-view.js?v=')[1].split("'")[0] if 'short-view.js?v=' in open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read() else open(os.path.join(ROOT, 'modules', 'hr', 'view.js'), encoding='utf-8').read().split('short-view.js?v=')[1].split("'")[0]
CSS = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'shell', 'hr'))
PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">%s</head><body><div class="jh-hr"><div id="p-body"></div></div></body></html>' % CSS
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => { const V = await import('/modules/hr/view.js?v=' + ver); const S = await import('/modules/hr/short-doc.js?v=' + ver);
 const f = S.shortInit({ workerId: 'w1', name: '김가나', jumin: '', phone: '', address: '', dept: '', rank: '', job: '사무 보조', empType: 'office', startDate: '2026-10-13', endDate: '2026-10-30', contractDate: '2026-10-27', hourly: '10320', salary: '', signData: null, payBasis: 'hourly', payInput: '', maxWeekly: '14', payDay: '익월 말일' });
 ['화', '수', '목', '금'].forEach((d) => { const r = f.sched.find((x) => x.day === d); r.on = true; r.start = '13:00'; r.end = '16:00'; });
 window.__html = (errs) => V.laborFormHtml({ aView: 'form', aForm: f, aSal: { basic: 0, weekly: 0, total: 0, annual: 0 }, aWorkers: [{ id: 'w1', name: '김가나', empNo: 'A-1', status: 'active' }], aSigning: false, aErrs: errs || [] }); return 'ok'; }"""
MEASURE = """() => { const body = document.getElementById('p-body'); const rows = [...document.querySelectorAll('[data-an-dayrow]')].map((r) => { const b = r.getBoundingClientRect(); const kids = [...r.querySelectorAll('button,input')].map((e) => e.getBoundingClientRect()); return { top: Math.round(b.top), right: Math.round(b.right), left: Math.round(b.left), maxKidRight: Math.round(Math.max(...kids.map((k) => k.right))), minKidLeft: Math.round(Math.min(...kids.map((k) => k.left))), minKidW: Math.round(Math.min(...kids.filter((k) => k.width > 0).map((k) => k.width))), h: Math.round(b.height) }; }); const tm = [...document.querySelectorAll('input[type=time]:not([disabled])')].map((e) => Math.round(e.getBoundingClientRect().width)); const pay = document.querySelector('[data-an-pay]'); return { rows, doc: document.documentElement.scrollWidth, win: innerWidth, timeW: tm, payVisible: !!pay && pay.getBoundingClientRect().width > 80, bodyRight: Math.round(body.getBoundingClientRect().right) }; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, label) in ((390, '폰 390px'), (820, '태블릿 820px'), (1280, 'PC 1280px')):
   ctx = b.new_context(viewport={'width': w, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); print('── ' + label)
   ok(pg.evaluate(SETUP, VER) == 'ok', '%s: 화면 모듈을 브라우저에서 불러온다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html([]); }"); pg.wait_for_timeout(250); m = pg.evaluate(MEASURE)
   ok(len(m['rows']) == 7, '%s: 요일 7줄이 그려진다' % label)
   ok(m['doc'] <= w + 1, '★ %s: 화면이 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, m['doc'], w))
   ok(all(r['maxKidRight'] <= r['right'] + 1 and r['minKidLeft'] >= r['left'] - 1 for r in m['rows']), '★ %s: 요일 줄 안의 단추·시각·휴게 칸이 줄 밖으로 나가지 않는다' % label)
   ok(min(m['timeW']) >= 100 and len(m['timeW']) == 8, '%s: 켜진 4요일의 시각 입력 8칸이 100px 이상(시각이 잘리지 않음, 가장 좁은 %s)' % (label, min(m['timeW']) if m['timeW'] else '-'))
   ok(m['payVisible'], '%s: 시급 입력칸이 보인다' % label)
   ok(all(m['rows'][i]['top'] < m['rows'][i + 1]['top'] for i in range(6)), '%s: 요일 줄이 월→일 순서로 위에서 아래로' % label)
   if w == 390: ok(all(r['h'] < 130 for r in m['rows']), '폰: 요일 한 줄이 두세 줄로 접혀도 130px 안에 들어온다(가장 큰 %dpx)' % max(r['h'] for r in m['rows']))
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html(['시급을 입력해 주세요.', '화요일: 종료 시각이 시작 시각보다 늦어야 합니다.']); }"); pg.wait_for_timeout(150)
   ok(pg.evaluate("() => document.querySelectorAll('[role=alert] li').length") == 2 and pg.evaluate("() => document.documentElement.scrollWidth") <= w + 1, '%s: 막힌 이유 2건이 목록으로 보이고 화면은 안 넘친다' % label)
   if w == 390: pg.screenshot(path='/tmp/alloc/short_form_phone.png', full_page=True)
   if w == 1280: pg.screenshot(path='/tmp/alloc/short_form_pc.png', full_page=True)
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 26: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 26)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
