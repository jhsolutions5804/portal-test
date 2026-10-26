"""캡스 업로드 패널(근로시간 > 📥 캡스 업로드) 배치 시험(1-3-25) — 실제 스타일 파일로 폰·PC 폭에서 미리보기 표·단추·기간 칸이 화면을 밀지 않는지 잰다. 공개 저장소이므로 가짜 이름만 쓴다. playwright 가 없으면 건너뛴다."""
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
src = open(os.path.join(ROOT, 'modules', 'hr', 'view.js'), encoding='utf-8').read(); VER = src.split('caps-view.js?v=')[1].split("'")[0]
CSS = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'shell', 'edoc', 'hr'))
PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">%s</head><body><div class="jh-hr jh-hr--wide"><div id="p-body"></div></div></body></html>' % CSS
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => { const I = await import('/modules/hr/caps-import.js?v=' + ver); const Vw = await import('/modules/hr/caps-view.js?v=' + ver);
 const t = I.parseCapsTime; const recs = []; const names = ['김가나', '이다라', '최사아']; let d = 0;
 for (const n of names) for (let i = 0; i < 14; i++) { const day = new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10); recs.push({ name: n, date: day, in: t(i % 5 === 3 ? '' : '07:' + String(10 + i).padStart(2, '0')), out: t(i % 5 === 4 ? '' : (n === '이다라' && i % 2 ? '+05:32' : '16:' + String(10 + i).padStart(2, '0'))) }); }
 recs.push({ name: '박마바', date: '2026-08-03', in: t('09:00'), out: t('18:00') });
 const workers = names.map((n, i) => ({ id: 'w' + i, name: n })); const existing = new Map([['w0_2026-08-04', { checkIn: '07:00', checkOut: '16:00', breakMinutes: 120, workHours: 7 }]]);
 const plan = I.buildCapsPlan({ records: recs, workers, existing, from: '2026-08-01', to: '2026-08-31', today: '2026-10-26' });
 const c = Object.assign(Vw.capsInit(), { stage: 'preview', fileName: '2026년_근태.xls', parse: { ok: true, records: recs, problems: [{ row: 5, reason: 'x' }], stats: { records: recs.length, names: 4, ids: 5, mergedIds: 1, from: '2026-01-01', to: '2026-10-26' } }, plan, from: '2026-08-01', to: '2026-08-31' });
 window.__html = (o) => Vw.capsPanelHtml(Object.assign({}, c, o || {})); window.__n = plan.writes.length; return 'ok'; }"""
MEASURE = """() => { const b = document.getElementById('p-body'); const tb = [...b.querySelectorAll('table')].map((t) => { const r = t.getBoundingClientRect(); const sc = t.closest('.jh-hr__scroll'); return { w: Math.round(r.width), scrollW: sc ? sc.scrollWidth : -1, boxW: sc ? Math.round(sc.getBoundingClientRect().width) : -1 }; });
 const btn = [...b.querySelectorAll('button[data-caps]')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent.trim().slice(0, 14), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; });
 const inp = [...b.querySelectorAll('input[data-caps-from],input[data-caps-to],input[data-caps-file]')].map((x) => { const r = x.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right) }; });
 return { doc: document.documentElement.scrollWidth, win: innerWidth, tb, btn, inp, kpi: document.querySelectorAll('.jh-kpi').length, rows: b.querySelectorAll('tbody tr').length }; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, label) in ((390, '폰 390px'), (820, '태블릿 820px'), (1280, 'PC 1280px')):
   ctx = b.new_context(viewport={'width': w, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); print('── ' + label)
   ok(pg.evaluate(SETUP, VER) == 'ok', '%s: 화면 모듈을 브라우저에서 불러온다' % label)
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html(); }"); pg.wait_for_timeout(250); m = pg.evaluate(MEASURE)
   ok(m['doc'] <= w + 1, '★ %s: 미리보기 화면이 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, m['doc'], w))
   ok(m['kpi'] == 5 and m['rows'] >= 10, '%s: 숫자 카드 5개와 미리보기 표 줄이 그려진다(표 줄 %d)' % (label, m['rows']))
   ok(all(t['boxW'] <= w for t in m['tb']), '%s: 표는 자기 스크롤 상자 안에서만 넘친다(상자 폭이 화면을 넘지 않음)' % label)
   ok(all(x['right'] <= w + 1 for x in m['btn'] + m['inp']), '%s: 단추·기간 칸·파일 칸이 화면 밖으로 나가지 않는다' % label)
   sv = [x for x in m['btn'] if x['t'].endswith('반영하기')]; ok(len(sv) == 1 and sv[0]['h'] >= 28 and sv[0]['w'] >= 80, '%s: "N건 반영하기" 단추가 눌리기 좋은 크기(높이 %s·폭 %s)' % (label, sv[0]['h'] if sv else '-', sv[0]['w'] if sv else '-'))
   pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html({ stage: 'pick', parse: null, plan: null }); }"); pg.wait_for_timeout(120)
   ok(pg.evaluate("() => document.documentElement.scrollWidth") <= w + 1 and pg.locator('input[data-caps-file]').count() == 1, '%s: 처음 화면(파일 선택만)도 화면을 넘지 않는다' % label)
   if w == 390: pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html(); }"); pg.wait_for_timeout(150); pg.screenshot(path='/tmp/alloc/caps_panel_phone.png', full_page=True)
   if w == 1280: pg.evaluate("() => { document.getElementById('p-body').innerHTML = window.__html(); }"); pg.wait_for_timeout(150); pg.screenshot(path='/tmp/alloc/caps_panel_pc.png', full_page=True)
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 20: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 20)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
