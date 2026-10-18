"""공사일보 폰 폭 팝업 배치 시험 — 실제 크로미움으로 실제 CSS(theme/*.css)와 실제 reportHtml 출력을 그려 높이·위치·겹침을 잰다.
대표님 2026-10-19: ①폰에서는 달력만 보이고, 날짜를 누르면 공사일보가 팝업으로 뜨고, 닫기를 누르면 다시 달력만 ②다크 모드에서 종이를 살짝 어둡게.
클릭 동작은 컨트롤러 대신 같은 순수 함수(openPopup·closePopup)로 흉내 낸다 — 컨트롤러 연결은 tests/pjt-report-popup.test.mjs 가 확인한다. 크로미움이 없으면 건너뛴다."""
import http.server, threading, socketserver, os, sys, glob
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
httpd = socketserver.TCPServer(('127.0.0.1', 0), H); BASE = 'http://127.0.0.1:%d' % httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
LINKS = ''.join('<link rel=stylesheet href="%s/theme/%s">' % (BASE, os.path.basename(f)) for f in sorted(glob.glob(os.path.join(ROOT, 'theme', '*.css'))))
PAGE = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">""" + LINKS + """<div id=app style="padding:8px"></div><nav class="jh-tabbar" id=tb style="display:flex;position:fixed;left:0;right:0;bottom:0;height:57px;z-index:20;background:#fff">메뉴</nav>
<script type=module>
import { reportHtml } from '%(b)s/modules/pjt/report-view.js'; import { fromStored } from '%(b)s/modules/pjt/report.js'; import { openPopup, closePopup, createPopupHistory } from '%(b)s/modules/pjt/report-popup.js';
const st = { proj: 'p4ph2', label: 'P4 Ph2 (FAB)', ready: true, date: '2026-10-14', today: '2026-10-14', month: { y: 2026, m: 9 }, dates: new Set(['2026-10-14']), exists: true, editing: false, preview: false, manage: true, readonly: false, popup: false, ctx: { site: 'P4 Ph2 (FAB)', client: '귀뚜라미', dateKey: '2026-10-14' }, form: fromStored({ author: '관리자', content: '4층 FCU 설치', tomorrow: '5층', headcount: 3, manday: 3, equip: '', note: '' }) };
const paint = () => { document.getElementById('app').innerHTML = reportHtml(st); };
const pushHash = (h) => { if (location.hash === h) return; history.replaceState(null, '', h); }; // 실제 PJT 모듈의 pushHash 와 같다 — 기록을 쌓지 않고 현재 항목을 덮어쓴다
const hist = createPopupHistory(window, { narrow: () => matchMedia('(max-width: 599px)').matches, close: () => { closePopup(st); paint(); }, requestClose: (cancel) => { closePopup(st); paint(); } }); hist.attach(); window.__hist = hist;
document.getElementById('app').onclick = (e) => { const d = e.target.closest('[data-rp-day]'); if (d) { openPopup(st); st.date = d.getAttribute('data-rp-day'); pushHash('#/pjt/p4ph2/report/' + st.date); paint(); hist.open(); return; } const a = e.target.closest('[data-rp-act]'); if (a && a.getAttribute('data-rp-act') === 'closepop') { if (!hist.closeByButton()) { closePopup(st); paint(); } } };
window.__st = st; window.__paint = paint; paint(); window.__ready = true;
</script>""" % {'b': BASE}
JS = """() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(), c = getComputedStyle(e); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top), disp: c.display, pos: c.position, z: c.zIndex, vis: b.width > 0 && b.height > 0 && c.display !== 'none' }; }; return { vw: innerWidth, vh: innerHeight, cal: r('.jh-pjt__calcol'), col: r('.jh-pjt__rpcol'), head: r('.jh-pjt__rphead'), card: r('.jh-pjt__rpt'), doc: r('.jh-pjt__doc'), docBg: (() => { const e = document.querySelector('.jh-pjt__doc'); return e ? getComputedStyle(e).backgroundColor : null; })(), overflowX: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
n_ok = n_bad = 0
def ok(c, m):
    global n_ok, n_bad
    if c: n_ok += 1; print('OK   ' + m)
    else: n_bad += 1; print('FAIL ' + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    def open_page(w, h=844, scheme='light'):
        ctx = b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme); pg = ctx.new_page(); pg.route(BASE + '/__t.html', lambda route, request: route.fulfill(status=200, content_type='text/html', body=PAGE))
        pg.goto(BASE + '/__t.html'); pg.wait_for_function('window.__ready===true', timeout=15000); return pg
    # ── 폰 폭 390: 닫힘 = 달력만
    pg = open_page(390); m = pg.evaluate(JS)
    ok(m['cal'] and m['cal']['vis'], '★ [390 닫힘] 달력이 보인다')
    ok(not (m['col'] and m['col']['vis']) and not (m['card'] and m['card']['vis']), '★ [390 닫힘] 공사일보 카드는 보이지 않는다(달력만 남음)')
    ok(not (m['head'] and m['head']['vis']), '[390 닫힘] 팝업 머리글도 보이지 않는다')
    ok(not m['overflowX'], '[390 닫힘] 가로 넘침 없음')
    # 날짜 칸 누름 → 팝업
    pg.click('[data-rp-day="2026-10-14"]'); pg.wait_for_timeout(100); m = pg.evaluate(JS)
    ok(m['col'] and m['col']['vis'] and m['col']['pos'] == 'fixed', '★ [390 열림] 날짜를 누르면 공사일보가 고정 위치 팝업으로 뜬다')
    ok(m['col'] and m['col']['x'] == 0 and m['col']['y'] == 0 and m['col']['w'] == 390 and m['col']['h'] == 844, '★ [390 열림] 팝업이 화면 전체(390×844)를 덮는다  (실제: %s)' % ({k: m['col'][k] for k in ('x', 'y', 'w', 'h')} if m['col'] else None))
    ok(m['col'] and m['col']['z'] == '59', '★ [390 열림] 겹침 순서 59 — 하단 메뉴(20) 위, 확인창(60) 아래  (실제: %s)' % (m['col']['z'] if m['col'] else None))
    ok(m['head'] and m['head']['vis'] and m['head']['y'] == 0 and m['head']['pos'] == 'sticky', '★ [390 열림] 머리글(닫기 버튼)이 맨 위에 붙어 보인다')
    ok(m['card'] and m['card']['vis'], '[390 열림] 그날 공사일보 카드가 팝업 안에 보인다')
    top = pg.evaluate("() => { const e = document.elementFromPoint(195, 820); return e ? (e.closest('#tb') ? '하단 메뉴' : (e.closest('.jh-pjt__rpcol') ? '팝업' : e.tagName)) : null; }")
    ok(top == '팝업', '★ [390 열림] 화면 맨 아래 위치에서 눌리는 것은 하단 메뉴가 아니라 팝업이다  (실제: %s)' % top)
    ok(not pg.evaluate(JS)['overflowX'], '[390 열림] 가로 넘침 없음')
    # 닫기
    pg.click('[data-rp-act="closepop"]'); pg.wait_for_timeout(100); m = pg.evaluate(JS)
    ok(not (m['col'] and m['col']['vis']) and m['cal'] and m['cal']['vis'], '★ [390] 닫기를 누르면 다시 달력만 보인다')
    pg.click('[data-rp-day="2026-10-14"]'); pg.wait_for_timeout(100); ok(pg.evaluate(JS)['col']['vis'], '[390] 다시 날짜를 누르면 또 열린다(여러 번 반복 가능)'); pg.context.close()
    # ── 경계 599 / 600
    pg = open_page(599); pg.evaluate("() => { __st.popup = true; __paint(); }"); m = pg.evaluate(JS); ok(m['col']['pos'] == 'fixed', '[599 열림] 599px 에서는 팝업이다'); pg.context.close()
    pg = open_page(600); pg.evaluate("() => { __st.popup = true; __paint(); }"); m = pg.evaluate(JS)
    ok(m['col']['pos'] != 'fixed' and m['head'] and not m['head']['vis'] and m['card']['vis'], '★ [600] 600px 부터는 팝업이 아니라 원래대로(달력 아래에 일보가 그대로 보이고 머리글은 숨김)'); pg.context.close()
    # ── 넓은 화면 1280: 팝업 상태와 무관하게 원래대로 2열
    for popup in (False, True):
        pg = open_page(1280, 800); pg.evaluate("(v) => { __st.popup = v; __paint(); }", popup); m = pg.evaluate(JS)
        ok(m['cal']['vis'] and m['card']['vis'] and m['col']['pos'] != 'fixed' and not m['head']['vis'], '★ [1280 popup=%s] 넓은 화면은 달력과 공사일보가 그대로 함께 보이고 팝업·머리글이 없다' % popup)
        ok(m['card']['x'] > m['cal']['x'] + m['cal']['w'] - 2, '[1280 popup=%s] 달력은 왼쪽, 공사일보는 오른쪽 열(2열 유지)' % popup); pg.context.close()
    # ── 종이: 라이트·다크·강제 설정·인쇄
    def doc_bg(scheme, theme=None, media=None):
        pg = open_page(1280, 800, scheme)
        if theme: pg.evaluate("(t) => document.documentElement.setAttribute('data-theme', t)", theme)
        if media: pg.emulate_media(media=media)
        bg = pg.evaluate(JS)['docBg']; pg.context.close(); return bg
    ok(doc_bg('light') == 'rgb(255, 255, 255)', '[라이트] 종이는 흰색')
    ok(doc_bg('dark') == 'rgb(227, 231, 237)', '★ [다크 시스템 설정] 종이가 살짝 어두워진다 rgb(227,231,237)  (실제: %s)' % doc_bg('dark'))
    ok(doc_bg('light', 'dark') == 'rgb(227, 231, 237)', '★ [앱에서 다크 선택] 종이가 살짝 어두워진다')
    ok(doc_bg('dark', 'light') == 'rgb(255, 255, 255)', '★ [시스템은 다크지만 앱에서 라이트 선택] 종이는 흰색 그대로')
    ok(doc_bg('dark', 'dark', 'print') == 'rgb(255, 255, 255)', '★ [다크 + 인쇄] 인쇄는 흰 종이')
    # ── 진짜 뒤로 가기(크로미움의 history): 프로젝트 홈 → 공사일보 → 날짜 누름(팝업) → 뒤로 가기
    def walk(w):
        pg = open_page(w); pg.evaluate("() => { history.replaceState(null, '', '#/pjt/p4ph2'); history.pushState(null, '', '#/pjt/p4ph2/report'); }")  # 프로젝트 홈 → 공사일보 탭(기록 쌓임)
        return pg
    pg = walk(390); pg.click('[data-rp-day="2026-10-14"]'); pg.wait_for_timeout(100)
    ok(pg.evaluate(JS)['col']['vis'] and pg.evaluate('location.hash') == '#/pjt/p4ph2/report/2026-10-14', '[뒤로가기 390] 날짜를 누르면 팝업이 열리고 주소는 날짜 주소로 바뀐다(기록은 덮어쓰기)')
    pg.go_back(); pg.wait_for_timeout(150); m = pg.evaluate(JS)
    ok(not (m['col'] and m['col']['vis']) and m['cal']['vis'], '★ [뒤로가기 390] 뒤로 가기를 누르면 팝업만 닫히고 달력(공사일보)이 남는다')
    ok(pg.evaluate('location.hash').startswith('#/pjt/p4ph2/report'), '★ [뒤로가기 390] 프로젝트 홈으로 가지 않고 공사일보에 머문다  (주소: %s)' % pg.evaluate('location.hash'))
    pg.go_back(); pg.wait_for_timeout(150); ok(pg.evaluate('location.hash') == '#/pjt/p4ph2', '★ [뒤로가기 390] 한 번 더 누르면 그때 프로젝트 홈으로 간다(정상 흐름)  (주소: %s)' % pg.evaluate('location.hash')); pg.context.close()
    pg = walk(390); pg.click('[data-rp-day="2026-10-14"]'); pg.wait_for_timeout(100); pg.click('[data-rp-act="closepop"]'); pg.wait_for_timeout(200)
    ok(not pg.evaluate(JS)['col']['vis'], '[닫기버튼 390] 닫기 버튼으로 닫으면 달력만 보인다')
    pg.go_back(); pg.wait_for_timeout(150); ok(pg.evaluate('location.hash') == '#/pjt/p4ph2', '★ [닫기버튼 390] 닫기 버튼 뒤 첫 뒤로 가기는 곧장 프로젝트 홈 — 팝업을 열었다 닫은 흔적이 기록에 남지 않는다  (주소: %s)' % pg.evaluate('location.hash')); pg.context.close()
    pg = walk(390)
    for _ in range(3): pg.click('[data-rp-day="2026-10-14"]'); pg.wait_for_timeout(60); pg.click('[data-rp-act="closepop"]'); pg.wait_for_timeout(150)
    pg.go_back(); pg.wait_for_timeout(150); ok(pg.evaluate('location.hash') == '#/pjt/p4ph2', '[반복 390] 열고 닫기를 3번 반복해도 기록이 쌓이지 않는다 — 뒤로 가기 한 번에 프로젝트 홈  (주소: %s)' % pg.evaluate('location.hash')); pg.context.close()
    pg = walk(1280); pg.click('[data-rp-day="2026-10-14"]'); pg.wait_for_timeout(100); pg.go_back(); pg.wait_for_timeout(150)
    ok(pg.evaluate('location.hash') == '#/pjt/p4ph2', '★ [뒤로가기 1280] 넓은 화면은 원래대로 — 날짜를 눌러도 기록이 늘지 않아 뒤로 가기 한 번에 프로젝트 홈(데스크톱 동작 그대로)  (주소: %s)' % pg.evaluate('location.hash')); pg.context.close()
    b.close()
print('\n' + (('%d건 실패' % n_bad) if n_bad else '전부 통과') + ' (%d건)' % n_ok); sys.exit(1 if n_bad else 0)
