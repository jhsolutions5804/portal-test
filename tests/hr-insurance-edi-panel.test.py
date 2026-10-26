"""4대보험 > 📝 신고 입력표 배치 시험(대기열 1-3-17 2단계) — 실제 스타일 파일로 폰·PC 폭에서 최근 입사자 표·근로자 선택·월 보수 입력·다섯 구역 표·복사 단추가 화면을 밀지 않는지 잰다. 가짜 이름만 쓴다. playwright 가 없으면 건너뜀."""
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
src = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read(); VER = src.split('insurance-edi-view.js?v=')[1].split("'")[0]
CSS = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'shell', 'edoc', 'legacy', 'calendar', 'hr'))
PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">%s</head><body><div class="jh-hr"><div id="p-body"></div></div></body></html>' % CSS
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => { const V = await import('/modules/hr/insurance-edi-view.js?v=' + ver);
 const workers = [{ id: 'w1', name: '김가나', empNo: 'A1', hireDate: '2026-10-20', status: 'active' }, { id: 'w2', name: '이다라', empNo: 'A2', hireDate: '2026-10-09', status: 'active' }, { id: 'w3', name: '박마바', empNo: 'A3', hireDate: '2026-09-02', status: 'active' }];
 const e = Object.assign(V.ediInit(), { loaded: true, workers, sel: 'w1', annual: { salary: 30000000, contractDate: '2026-10-20', endDate: '2027-10-19' } });
 const lw = [{ id: 'h', name: '형일우', empNo: 'A9', hireDate: '2026-06-29', resignDate: '2026-09-16', status: 'resigned' }, { id: 'h2', name: '김퇴사', empNo: 'A8', hireDate: '2025-01-02', resignDate: '2026-10-20', status: 'active' }];
 const slips = [['2026-06', 179362], ['2026-07', 2819154], ['2026-08', 2690424], ['2026-09', 1434893]].map(([ym, g]) => ({ ym, grossPay: g }));
 const le = Object.assign(V.ediInit(), { kind: 'loss', loaded: true, workers: lw, sel: 'h', slips });
 window.__html = (o) => V.insuranceShellHtml({ view: 'edi', edi: Object.assign({}, e, o || {}), today: '2026-10-26', loading: false, data: { payslips: {}, bills: {} } });
 window.__loss = (o) => V.insuranceShellHtml({ view: 'edi', edi: Object.assign({}, le, o || {}), today: '2026-10-26', loading: false, data: { payslips: {}, bills: {} } }); return 'ok'; }"""
MEASURE = """() => { const b = document.getElementById('p-body'); const sc = [...b.querySelectorAll('.jh-hr__scroll')].map((x) => { const r = x.getBoundingClientRect(); return { boxW: Math.round(r.width), right: Math.round(r.right), sw: x.scrollWidth, cw: x.clientWidth }; });
 const cp = [...b.querySelectorAll('button[data-edi-copy]')].map((x) => { const r = x.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; }); const inp = [...b.querySelectorAll('input[data-edi-pay],input[data-edi-hours],select[data-edi-worker]')].map((x) => Math.round(x.getBoundingClientRect().right));
 return { doc: document.documentElement.scrollWidth, win: innerWidth, sc, cp, inp, cards: b.querySelectorAll('.jh-card').length, h3: [...b.querySelectorAll('h3')].map((h) => h.textContent.trim()).join('|') }; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, label) in ((390, '폰 390px'), (820, '태블릿 820px'), (1280, 'PC 1280px')):
   ctx = b.new_context(viewport={'width': w, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); print('── ' + label)
   ok(pg.evaluate(SETUP, VER) == 'ok', '%s: 화면 모듈을 브라우저에서 불러온다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html(); }"); pg.wait_for_timeout(250); m = pg.evaluate(MEASURE)
   ok(m['doc'] <= w + 1, '★ %s: 화면이 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, m['doc'], w))
   ok(all(x['right'] <= w + 1 for x in m['sc']) and all(r <= w + 1 for r in m['inp']), '%s: 표 상자·입력 칸·선택 칸이 화면 밖으로 나가지 않는다' % label)
   ok(len(m['cp']) >= 10 and all(x['right'] <= w + 40 and x['h'] >= 24 for x in m['cp']), '%s: 복사 단추 %d개가 눌리기 좋은 크기(높이 24px 이상)로 보인다' % (label, len(m['cp'])))
   ok(all(t in m['h3'] for t in ('공통', '국민연금', '건강보험', '고용보험', '산재보험')), '%s: 다섯 구역 카드가 그려진다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html({ sel: '', annual: null }); }"); pg.wait_for_timeout(150); m2 = pg.evaluate(MEASURE)
   ok(m2['doc'] <= w + 1 and m2['cards'] == 1, '%s: 근로자를 고르기 전(최근 입사자 표만)에도 화면을 넘지 않는다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html({ jumin: '900101-1234567' }); }"); pg.wait_for_timeout(150); m3 = pg.evaluate(MEASURE); ok(m3['doc'] <= w + 1, '%s: 주민번호를 열람한 화면도 화면을 넘지 않는다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__loss(); }"); pg.wait_for_timeout(250); ml = pg.evaluate(MEASURE)
   ok(ml['doc'] <= w + 1, '★ %s: 퇴사(자격 상실) 화면도 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, ml['doc'], w))
   ok(all(x['right'] <= w + 1 for x in ml['sc']) and all(r <= w + 1 for r in ml['inp']), '%s: 퇴사 화면의 표 상자·입력 칸·선택 칸이 화면 밖으로 나가지 않는다' % label)
   ok(len(ml['cp']) >= 9 and all(x['right'] <= w + 40 and x['h'] >= 24 for x in ml['cp']), '%s: 퇴사 화면 복사 단추 %d개가 눌리기 좋은 크기' % (label, len(ml['cp'])))
   ok(all(t in ml['h3'] for t in ('공통', '국민연금', '건강보험', '고용보험', '산재보험')) and pg.locator('[data-edi-kind="loss"][aria-pressed="true"]').count() == 1 and pg.locator('[data-edi-lpay]').count() == 1 and pg.locator('[data-edi-reason]').count() == 1, '%s: 퇴사 화면에 다섯 구역·퇴사 선택 상태·보수총액 입력·사유 선택이 있다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__loss({ sel: '', slips: [] }); }"); pg.wait_for_timeout(150); ml2 = pg.evaluate(MEASURE); ok(ml2['doc'] <= w + 1, '%s: 퇴사 화면에서 근로자를 고르기 전(최근 퇴사자 표)도 화면을 넘지 않는다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__loss({ reasonOther: true, jumin: '900101-1234567' }); }"); pg.wait_for_timeout(150); ml3 = pg.evaluate(MEASURE); ok(ml3['doc'] <= w + 1, '%s: 그 밖의 사유·주민번호 열람 상태도 화면을 넘지 않는다' % label)
   if w == 390: pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__loss(); }"); pg.wait_for_timeout(150); pg.screenshot(path='/tmp/alloc/edi_loss_phone.png', full_page=True)
   if w == 1280: pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__loss(); }"); pg.wait_for_timeout(150); pg.screenshot(path='/tmp/alloc/edi_loss_pc.png', full_page=True)
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 40: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 40)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
