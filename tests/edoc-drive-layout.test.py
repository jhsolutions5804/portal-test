"""차량 운행일지 작성 화면 줄 배치 시험(대표님 2026-10-25) — 운행일자·차량·프로젝트가 PC 폭에서 한 줄, 중간 폭에서는 두 칸 + 아랫줄, 폰 폭에서는 한 칸씩 쌓이는지
실제 스타일 파일(tokens·base·components·edoc)을 불러와 크로미움에서 잰다. 크로미움(playwright)이 없으면 건너뛴다."""
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
LONG = 'P4 Ph2 (FAB) · FCU 183대 설치 공사 및 부대 배관 연결 작업(2026년 하반기 2차 구간 전체)'
def page(layout):
 css = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'edoc'))
 f = lambda lab, inner: '<div class="jh-field"><label class="jh-field__label">%s</label>%s</div>' % (lab, inner)
 return '<!doctype html><html><head><meta charset="utf-8">%s</head><body><div class="jh-form" id="frm"><div class="jh-form__row" id="row" data-cols="%s">%s%s%s</div></div></body></html>' % (css, layout,
  f('운행일자', '<input class="jh-input" type="date" value="2026-10-26">'), f('차량', '<select class="jh-select"><option>현대 스타리아 (716호1313)</option></select>'), f('프로젝트', '<select class="jh-select"><option>%s</option></select>' % LONG))
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
M = "(() => { const r = [...document.querySelectorAll('#row > .jh-field')].map((e) => e.getBoundingClientRect()); const row = document.getElementById('row').getBoundingClientRect(); return { tops: r.map((x) => Math.round(x.top)), lefts: r.map((x) => Math.round(x.left)), widths: r.map((x) => Math.round(x.width)), rowW: Math.round(row.width), rowRight: Math.round(row.right), doc: document.documentElement.scrollWidth, win: innerWidth, selW: [...document.querySelectorAll('#row select')].map((e) => Math.round(e.getBoundingClientRect().width)) }; })()"
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, label) in ((1400, 'PC 1400px'), (1100, 'PC 1100px(경계)'), (1000, '중간 1000px'), (700, '태블릿 700px'), (390, '폰 390px')):
   ctx = b.new_context(viewport={'width': w, 'height': 800}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=page('narrow-first-3'))); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(300); m = pg.evaluate(M); print('── %s %s' % (label, m))
   ok(m['doc'] <= w + 1 and m['rowRight'] <= w + 1, '★ %s: 줄이 화면을 넘지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, m['doc'], w))
   ok(max(m['selW']) <= m['rowW'], '%s: 긴 프로젝트 이름이 칸을 넓히지 않는다(선택 칸 %s ≤ 줄 %d)' % (label, m['selW'], m['rowW']))
   if w >= 1100:
    ok(len(set(m['tops'])) == 1, '★ %s: 운행일자·차량·프로젝트가 한 줄(위치 %s)' % (label, m['tops']))
    ok(abs(m['widths'][0] - 220) <= 2 and abs(m['widths'][1] - m['widths'][2]) <= 2 and m['widths'][1] > 250, '%s: 날짜 칸 220px, 차량·프로젝트는 같은 폭(%s)' % (label, m['widths']))
   elif w >= 900:
    ok(m['tops'][0] == m['tops'][1] and m['tops'][2] > m['tops'][0] and m['lefts'][2] == m['lefts'][0] and m['widths'][2] >= m['rowW'] - 2, '%s: 날짜·차량은 한 줄, 프로젝트는 아랫줄 전체 폭(%s)' % (label, m['widths']))
   else:
    ok(m['tops'][0] < m['tops'][1] < m['tops'][2] and len(set(m['lefts'])) == 1 and min(m['widths']) >= m['rowW'] - 2, '★ %s: 한 칸씩 위에서 아래로 쌓이고 폭을 꽉 채운다(위치 %s)' % (label, m['tops']))
   ctx.close()
  # 대조: 예전 배치(narrow-first)에서는 세 번째 칸이 아래로 밀렸다(원인 재현)
  ctx = b.new_context(viewport={'width': 1400, 'height': 800}); pg = ctx.new_page(); pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=page('narrow-first'))); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(300); m = pg.evaluate(M)
  ok(m['tops'][2] > m['tops'][0], '대조(원인 재현): 예전 narrow-first 배치에서는 PC 폭에서도 프로젝트가 아랫줄로 밀린다(위치 %s)' % m['tops']); ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 15: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 15)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
