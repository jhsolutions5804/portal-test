"""근로시간 화면 배치 시험(대표님 2026-10-26: "오른쪽 카드도 floating") — 실제 스타일 파일로 ①넓은 화면에서 오른쪽 칸이 스크롤을 따라오는지 ②좁은 화면(두 칸·한 칸)에서는 일반 배치인지 ③칸이 화면보다 길면 안에서 스크롤인지 ④캡스 업로드 보기가 가운데+오른쪽을 합쳐 넓게 쓰는지 잰다. playwright 가 없으면 건너뜀."""
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
CSS = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'shell', 'edoc', 'legacy', 'calendar', 'hr'))
def page(mode, side_h):
 wide = '<div class="jh-ac__wide"><section class="jh-card"><div class="jh-hr__pad">캡스 패널</div></section></div>'
 center = '<div class="jh-ac__center"><section class="jh-card" style="height:2400px"><div class="jh-hr__pad">긴 달력과 주별 표</div></section></div><div class="jh-ac__side" id="side"><section class="jh-card" style="height:%dpx"><div class="jh-hr__pad">근로 내역 추가/수정</div></section><section class="jh-card" style="height:220px"><div class="jh-hr__pad">초과근로</div></section></div>' % side_h
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">%s</head><body><div class="jh-hr jh-hr--wide"><div class="jh-ac__layout" data-mode="%s"><section class="jh-card" id="list" style="height:300px"><div class="jh-hr__pad">근로자</div></section>%s</div></div></body></html>' % (CSS, mode, wide if mode in ('caps', 'ot') else center)
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
def load(pg, w, mode, side_h=300):
 pg.set_viewport_size({'width': w, 'height': 900}); pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=page(mode, side_h))); pg.goto(BASE + '/x.html'); pg.wait_for_timeout(250)
R = "() => { const s = document.getElementById('side'); const r = s.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), pos: getComputedStyle(s).position, sh: s.scrollHeight, ch: s.clientHeight, oy: getComputedStyle(s).overflowY }; }"
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
  load(pg, 1400, 'cal'); m0 = pg.evaluate(R); pg.evaluate('window.scrollTo(0, 1500)'); pg.wait_for_timeout(200); m1 = pg.evaluate(R)
  ok(m0['pos'] == 'sticky' and m0['top'] < 200, '★ PC 1400px: 오른쪽 칸이 sticky 이고 처음에는 위쪽에 있다(top %dpx)' % m0['top'])
  ok(0 <= m1['top'] <= 40 and m1['bottom'] <= 900, '★ PC 1400px: 1500px 내려도 오른쪽 칸이 화면 위쪽에 떠서 따라온다(top %dpx·bottom %dpx)' % (m1['top'], m1['bottom']))
  lt = pg.evaluate("() => Math.round(document.getElementById('list').getBoundingClientRect().top)"); ok(0 <= lt <= 40, 'PC 1400px: 왼쪽 근로자 목록도 계속 따라온다(top %dpx)' % lt)
  load(pg, 1400, 'cal', side_h=1800); pg.evaluate('window.scrollTo(0, 1500)'); pg.wait_for_timeout(200); m2 = pg.evaluate(R)
  ok(m2['h'] <= 900 and m2['sh'] > m2['ch'] and m2['oy'] == 'auto', '★ PC: 오른쪽 칸이 화면보다 길면 칸 높이를 화면에 맞추고 안에서 스크롤(칸 %dpx < 내용 %dpx)' % (m2['h'], m2['sh']))
  load(pg, 1100, 'cal'); m3a = pg.evaluate(R); pg.evaluate('window.scrollTo(0, 1500)'); pg.wait_for_timeout(200); m3 = pg.evaluate(R)
  ok(m3['pos'] == 'static' and m3a['top'] > 2000 and m3['top'] == m3a['top'] - 1500, '1100px(두 칸 배치): 오른쪽 칸은 가운데 아래(%dpx)로 내려가 일반 배치이고 스크롤한 만큼 그대로 움직인다(떠서 따라오지 않음)' % m3a['top'])
  load(pg, 390, 'cal'); m4 = pg.evaluate(R); ok(m4['pos'] == 'static' and pg.evaluate('document.documentElement.scrollWidth') <= 391, '폰 390px: 한 칸 일반 배치이고 화면이 밀리지 않는다')
  for w, label in ((1400, 'PC 1400px'), (1100, '1100px'), (390, '폰 390px')):
   load(pg, w, 'caps'); ww = pg.evaluate("() => { const e = document.querySelector('.jh-ac__wide'); const l = document.querySelector('.jh-ac__layout'); return [Math.round(e.getBoundingClientRect().width), Math.round(l.getBoundingClientRect().width), Math.round(document.getElementById('list').getBoundingClientRect().width)]; }")
   if w == 1400: ok(ww[0] > ww[1] - ww[2] - 60 - 40, '★ %s: 캡스 업로드 보기는 가운데+오른쪽 두 칸을 합쳐 넓게 쓴다(패널 %dpx / 전체 %dpx / 목록 %dpx)' % (label, ww[0], ww[1], ww[2]))
   elif w == 1100: ok(ww[0] > 500, '%s: 캡스 업로드 보기는 목록 옆 한 칸을 넓게 쓴다(패널 %dpx)' % (label, ww[0]))
   else: ok(ww[0] >= ww[1] - 2, '%s: 캡스 업로드 보기는 한 칸 전체 폭(패널 %dpx / 전체 %dpx)' % (label, ww[0], ww[1]))
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음')
  ctx.close(); b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 9: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 9)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
