"""차량 운행일지 작성 화면 줄 배치 시험(대표님 2026-10-25) — 운행일자·차량·프로젝트가 "폼 칸의 폭"에 따라 한 줄 / 날짜·차량 + 프로젝트 아랫줄 / 한 칸씩으로 배치되는지.
실제 새 문서 작성 화면은 왼쪽 종류 목록 + 오른쪽 폼으로 나뉘어 폼 칸이 화면보다 훨씬 좁아서(1400px 화면에서 폼 약 600px), 화면 폭이 아니라 칸 폭으로 재야 한다(처음 만든 화면 폭 기준 규칙은 1100px 화면에서 차량·프로젝트 칸이 27px 로 찌그러졌다).
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
def page(pane, wrap=True):
 css = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'edoc'))
 f = lambda lab, inner: '<div class="jh-field"><label class="jh-field__label">%s</label>%s</div>' % (lab, inner)
 row = '<div class="jh-form__row" id="row" data-cols="narrow-first-3">%s%s%s</div>' % (f('운행일자', '<input class="jh-input" type="date" value="2026-10-26">'), f('차량', '<select class="jh-select"><option>현대 스타리아 (716호1313)</option></select>'), f('프로젝트', '<select class="jh-select"><option>%s</option></select>' % LONG))
 return '<!doctype html><html><head><meta charset="utf-8">%s</head><body><div style="width:%dpx"><div class="jh-form" id="frm">%s</div></div></body></html>' % (css, pane, ('<div class="jh-form__rowbox" id="box">%s</div>' % row) if wrap else row)
def serve(pn, tweak=None):
 return lambda r: r.fulfill(status=200, content_type='text/html', body=(tweak(page(pn)) if tweak else page(pn)))
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
M = "(() => { const r = [...document.querySelectorAll('#row > .jh-field')].map((e) => e.getBoundingClientRect()); const bx = (document.getElementById('box') || document.getElementById('row')).getBoundingClientRect(); return { tops: r.map((x) => Math.round(x.top)), lefts: r.map((x) => Math.round(x.left)), widths: r.map((x) => Math.round(x.width)), bw: Math.round(bx.width), doc: document.documentElement.scrollWidth, win: innerWidth, selW: [...document.querySelectorAll('#row select')].map((e) => Math.round(e.getBoundingClientRect().width)) }; })()"
def check(m, label):
 bw = m['bw']; ok(m['doc'] <= m['win'] + 1, '★ %s: 화면 밖으로 넘치지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, m['doc'], m['win']))
 ok(max(m['selW']) <= bw, '%s: 긴 프로젝트 이름이 칸을 넓히지 않는다(선택 칸 %s ≤ 상자 %d)' % (label, m['selW'], bw))
 if m['win'] <= 899: ok(m['tops'][0] < m['tops'][1] < m['tops'][2] and len(set(m['lefts'])) == 1 and min(m['widths']) >= bw - 2, '★ %s: 폰·좁은 화면(899px 이하)은 한 칸씩(%s)' % (label, m['tops']))
 elif bw >= 832: ok(len(set(m['tops'])) == 1 and abs(m['widths'][0] - 220) <= 2 and abs(m['widths'][1] - m['widths'][2]) <= 2 and m['widths'][1] >= 280, '★ %s: 상자 %dpx(넓음) → 세 칸 한 줄, 날짜 220px + 같은 폭 둘(%s)' % (label, bw, m['widths']))
 elif bw > 480: ok(m['tops'][0] == m['tops'][1] and m['tops'][2] > m['tops'][0] and m['lefts'][2] == m['lefts'][0] and m['widths'][2] >= bw - 2 and m['widths'][1] >= 150, '★ %s: 상자 %dpx(보통) → 날짜·차량 한 줄 + 프로젝트 아랫줄 전체 폭, 차량 칸 %dpx(%s)' % (label, bw, m['widths'][1], m['widths']))
 else: ok(m['tops'][0] < m['tops'][1] < m['tops'][2] and len(set(m['lefts'])) == 1 and min(m['widths']) >= bw - 2, '★ %s: 상자 %dpx(아주 좁음) → 한 칸씩 쌓임(%s)' % (label, bw, m['tops']))
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  # 분할 화면 흉내 — 화면은 넓고 폼 칸만 여러 폭(.jh-form 안쪽 패딩 때문에 상자는 칸보다 조금 좁다)
  for pane in (1500, 900, 880, 860, 700, 606, 520, 420, 306):
   ctx = b.new_context(viewport={'width': 1500, 'height': 800}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', serve(pane)); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(250); check(pg.evaluate(M), '폼 칸 %dpx' % pane); ctx.close()
  # 좁은 화면(폰·태블릿): 폼 칸이 아무리 넓어도 899px 이하 화면은 한 칸씩
  for vw, pane in ((800, 740), (412, 380)):
   ctx = b.new_context(viewport={'width': vw, 'height': 800}); pg = ctx.new_page(); pg.route('**/x.html', serve(pane)); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(250); check(pg.evaluate(M), '화면 %dpx' % vw); ctx.close()
  # 대조(원인 재현): 상자 없이 예전 narrow-first 2열 격자에 세 칸을 넣으면 세 번째 칸이 밀린다 / 화면 폭만 보는 3열은 좁은 칸에서 찌그러진다
  ctx = b.new_context(viewport={'width': 1500, 'height': 800}); pg = ctx.new_page(); pg.route('**/x.html', serve(606, lambda h: h.replace('narrow-first-3', 'narrow-first'))); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(250); m = pg.evaluate(M)
  ok(m['tops'][2] > m['tops'][0], '대조(원인 재현): 예전 narrow-first 배치에서는 프로젝트가 아랫줄로 밀린다(위치 %s)' % m['tops']); ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 30: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 30)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
