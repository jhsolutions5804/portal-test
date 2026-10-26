"""재무회계 > 규칙 탭의 "📚 규칙으로 기존 카드 전표 다시 분류" 카드 배치 시험(2026-10-26) — 실제 스타일 파일로 폰·PC 폭에서 숫자 칸·이동 표·경고·실행 단추·결과가 화면을 밀지 않는지 잰다. 가짜 가맹점만 쓴다. playwright 가 없으면 건너뜀."""
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
src = open(os.path.join(ROOT, 'modules', 'finance', 'index.js'), encoding='utf-8').read(); VER = src.split('logic.js?v=')[1].split("'")[0]
CSS = ''.join('<link rel="stylesheet" href="/theme/%s.css">' % n for n in ('tokens', 'base', 'components', 'shell', 'edoc', 'legacy', 'calendar', 'finance'))
PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">%s</head><body><div class="jh-finance"><div id="p-body" class="jh-finance__split"><div class="jh-finance__col" id="col"></div><div class="jh-finance__col"></div></div></div></body></html>' % CSS
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => { const V = await import('/modules/finance/view.js?v=' + ver);
 const accs = ['6190', '6090', '3020', '6020', '6120', '6040']; const rules = []; const entries = []; let n = 0;
 const mk = (from, to, cnt) => { for (let i = 0; i < cnt; i++) { const k = 'm' + (n++); rules.push({ issuer: 'hyundai', key: k, account: to, label: 'x' }); entries.push({ id: 'e' + n, no: 'E-' + n, date: '2026-09-01', memo: k + ' · 기타', source: { kind: 'card', id: 'card_hyundai_2026-09-01_x' }, needsReview: true, lines: [{ account: from, side: 'D', amount: 123456 }, { account: '2020', side: 'C', amount: 123456 }] }); } };
 mk('6190', '6020', 12); mk('6190', '3020', 7); mk('6090', '3020', 3); mk('6190', '6090', 2); mk('6190', '6120', 2); mk('6020', '6020', 4);
 const st = (rr) => ({ rl: { merchant: rules, purchase: [], bank: [], q: '', upload: null, error: '', rr: rr || {} }, data: { entries, rules, settings: { lockedThrough: '2026-03-31' } } });
 window.__html = (rr) => V.ruleReclassHtml(st(rr)); return 'ok'; }"""
MEASURE = """() => { const b = document.getElementById('col'); const sc = [...b.querySelectorAll('.jh-finance__scroll')].map((x) => Math.round(x.getBoundingClientRect().right)); const btn = [...b.querySelectorAll('button')].map((x) => { const r = x.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), t: x.textContent.trim().slice(0, 20) }; });
 const kp = [...b.querySelectorAll('.jh-kpi')].map((x) => Math.round(x.getBoundingClientRect().right)); return { doc: document.documentElement.scrollWidth, win: innerWidth, sc, btn, kp, rows: b.querySelectorAll('tbody tr').length, warn: b.querySelectorAll('.jh-alert[data-tone=warn]').length, cards: b.querySelectorAll('.jh-card').length }; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, label) in ((390, '폰 390px'), (820, '태블릿 820px'), (1280, 'PC 1280px')):
   ctx = b.new_context(viewport={'width': w, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); print('── ' + label)
   ok(pg.evaluate(SETUP, VER) == 'ok', '%s: 화면 모듈을 브라우저에서 불러온다' % label)
   pg.evaluate("() => { document.getElementById('col').innerHTML = window.__html(); }"); pg.wait_for_timeout(250); m = pg.evaluate(MEASURE)
   ok(m['doc'] <= w + 1, '★ %s: 화면이 옆으로 밀리지 않는다(문서 %dpx ≤ 화면 %dpx)' % (label, m['doc'], w))
   ok(m['cards'] == 1 and m['rows'] == 5 and m['warn'] >= 1, '%s: 카드 1개·계정 이동 5종(6190→6020·6190→3020·6090→3020·6190→6090·6190→6120)·개인 지출 경고가 그려진다(줄 %d)' % (label, m['rows']))
   ok(all(r <= w + 1 for r in m['sc'] + m['kp']), '%s: 숫자 칸·표 상자가 화면 밖으로 나가지 않는다' % label)
   run = [x for x in m['btn'] if '실행' in x['t'] or '재분류' in x['t']]; ok(len(run) == 1 and run[0]['h'] >= 30 and run[0]['right'] <= w + 1, '%s: 실행 단추가 하나이고 눌리기 좋은 크기(높이 %s)' % (label, run[0]['h'] if run else '-'))
   pg.evaluate("() => { document.getElementById('col').innerHTML = window.__html({ result: { done: 26, marked: 4, failed: ['E-9: 마감됨', 'E-10: 오류'], markErr: '', verify: { ok: false, balanced: true, diffs: [{ account: '6190', expected: -1000, actual: 0 }] } } }); }"); pg.wait_for_timeout(150); m2 = pg.evaluate(MEASURE)
   ok(m2['doc'] <= w + 1, '%s: 실행 결과(실패·점검 불일치 포함)가 있어도 화면을 넘지 않는다' % label)
   pg.evaluate("() => { document.getElementById('col').innerHTML = window.__html({ running: true, progress: '12/26 재분류 중… E-12' }); }"); pg.wait_for_timeout(150); m3 = pg.evaluate(MEASURE); ok(m3['doc'] <= w + 1 and pg.locator('[data-rr-progress]').inner_text().startswith('12/26'), '%s: 실행 중 진행 문구(12/26)가 보이고 화면을 넘지 않는다' % label)
   if w == 1280: pg.evaluate("() => { document.getElementById('col').innerHTML = window.__html(); }"); pg.wait_for_timeout(150); pg.screenshot(path='/tmp/alloc/rr_pc.png', full_page=True)
   if w == 390: pg.evaluate("() => { document.getElementById('col').innerHTML = window.__html(); }"); pg.wait_for_timeout(150); pg.screenshot(path='/tmp/alloc/rr_phone.png', full_page=True)
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 19: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 19)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
