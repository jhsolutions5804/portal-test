"""지원서 파기 관리·인력 현황 화면 시험(대기열 1-3-16 ⑥⑦) — 실제 크로미움에서 지원자 화면의 파기 카드와 인사 홈의 신호 칸·인력 현황을 폰·PC 폭으로 그려 확인한다.
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
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('workforce-view.js?v=')[1].split("'")[0]
PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>포털</title></head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => {
 const PG = await import('/modules/hr/recruit-purge.js?v=' + ver); const PV = await import('/modules/hr/recruit-purge-view.js?v=' + ver); const WF = await import('/modules/hr/workforce.js?v=' + ver); const WV = await import('/modules/hr/workforce-view.js?v=' + ver); const VW = await import('/modules/hr/view.js?v=' + ver);
 const T = '2026-12-31'; const A = (o) => Object.assign({ jobKey: 'j1', jobTitle: '사무직', status: 'new', name: '김가나', phone: '010-0000-0000', created: '2026.10.16 09:00' }, o || {});
 const posts = [{ id: 'j1', title: '사무직 모집', status: 'closed', decidedDate: '2026-10-01', retentionDays: 90 }, { id: 'j2', title: '<img src=x onerror="window.__x=1">', status: 'open', decidedDate: '' }];
 const apps = [A({ id: 'a1' }), A({ id: 'a2', status: 'pass', name: '박합격' }), A({ id: 'a3', jobKey: 'j2', name: '이다라' }), A({ id: 'a4', status: 'destroyed' })];
 const rep = PG.purgeReport(apps, posts, T); const list = apps.filter((a) => a.status !== 'destroyed').map((a) => Object.assign({}, a, { purgeInfo: PG.purgeInfo(a, posts.find((p) => p.id === a.jobKey) || null, T) }));
 const ws = [{ id: '1', name: '가', rank: '대표', empType: 'office', hireDate: '2015-01-01' }, { id: '2', name: '나', rank: '과장', empType: 'office', hireDate: '2021-10-25' }, { id: '3', name: '다', rank: '대리', empType: 'field', hireDate: '2026-03-01' }, { id: '4', name: '라', rank: '<b>위험</b>', empType: 'office', hireDate: '2024-01-01' }, { id: '5', name: '마', status: 'resigned', rank: '사원', hireDate: '2022-01-01', resignDate: '2025-12-31' }];
 window.__PV = PV; window.__WV = WV; window.__VW = VW; window.__rep = rep; window.__list = list; window.__ws = ws; window.__wf = WF.workforceStats(ws, '2026-10-25'); return rep.counts.due + ',' + rep.counts.nodate + ',' + window.__wf.headcount; }"""
APPL = """() => { document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__VW.applicantsHtml({ apList: window.__list, apFilter: 'all', apSel: '', purge: window.__rep }) + '</div>'; }"""
APPL0 = """() => { document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__VW.applicantsHtml({ apList: window.__list.map((a) => Object.assign({}, a, { purgeInfo: null })), apFilter: 'all', apSel: '', purge: null }) + '</div>'; }"""
HOME = """() => { document.getElementById('root').innerHTML = '<div class="jh-hr jh-hr--wide">' + window.__VW.homeHtml() + '</div>'; document.getElementById('hm-purge').innerHTML = window.__PV.purgeHomeHtml(window.__rep); document.getElementById('hm-work').innerHTML = window.__WV.workforceHtml(window.__wf); }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); errs = []
  for (w, h, label) in ((390, 800, '폰(390px)'), (1280, 800, 'PC(1280px)')):
   ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
   pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html'); print('── ' + label)
   r0 = pg.evaluate(SETUP, VER)
   if w == 390: ok(r0 == '1,1,4', '새 모듈과 실제 화면 함수를 브라우저에서 불러온다(기한 지남 1·확정일 미입력 1·재직 4명)')
   pg.evaluate(APPL); pg.wait_for_timeout(200)
   ok(pg.evaluate("document.querySelectorAll('[data-pg-table] tbody tr').length") == 2 and pg.evaluate("document.querySelectorAll('[data-pg-date]').length") == 2 and pg.evaluate("document.querySelectorAll('[data-pg-days]').length") == 2 and pg.evaluate("document.querySelectorAll('[data-pg-save]').length") == 2, '지원자 화면: 공고 2줄, 공고마다 확정일·보관기간 입력칸과 저장 단추')
   ok(pg.evaluate("document.querySelector('[data-pg-run]').disabled") is False and '1건 파기' in pg.evaluate("document.querySelector('[data-pg-run]').innerText"), '[기한 지난 1건 파기] 단추가 켜져 있다')
   ok(pg.evaluate("window.__x") is None, '★ 공고 제목에 넣은 <img onerror> 가 실행되지 않는다')
   ok(pg.evaluate("[...document.querySelectorAll('.jh-chip')].map((c) => c.innerText).filter((t) => /파기|확정일|합격자/.test(t)).length") >= 3, '지원자 행에 파기 상태 칩(기한 지남·합격자 제외·확정일 미입력)')
   ok(pg.evaluate("document.querySelector('[data-pg-table]').closest('.jh-hr__scroll').getBoundingClientRect().right <= innerWidth + 1"), '★ %s: 파기 표 영역이 화면 오른쪽을 넘지 않는다' % label)
   with_w = pg.evaluate("document.documentElement.scrollWidth"); pg.evaluate(APPL0); pg.wait_for_timeout(100); base_w = pg.evaluate("document.documentElement.scrollWidth"); pg.evaluate(APPL); pg.wait_for_timeout(100)
   print('   (참고) %s 지원자 화면 문서 폭: 파기 카드 있음 %dpx · 없음(기존 화면) %dpx · 화면 %dpx' % (label, with_w, base_w, w))
   ok(with_w <= base_w + 1, '★ %s: 파기 관리 카드를 더해도 지원자 화면이 더 넓어지지 않는다(%dpx ≤ 기존 %dpx)' % (label, with_w, base_w))
   pg.evaluate(HOME); pg.wait_for_timeout(300)
   ok(pg.evaluate("document.querySelector('#hm-purge .jh-alert[data-tone=danger]') !== null") and pg.evaluate("document.querySelector('#hm-purge a[href=\"#/hr/applicants\"]') !== null"), '인사 홈: 파기 신호 칸에 빨간 안내와 지원자 화면 링크')
   ok(pg.evaluate("[...document.querySelectorAll('#hm-work [data-w-bar]')].every((e) => e.getBoundingClientRect().width > 0 || e.style.width === '0%')") and pg.evaluate("document.querySelectorAll('#hm-work [data-w-bar]').length") == pg.evaluate("window.__wf.ranks.length + window.__wf.types.length + window.__wf.tenure.length + window.__wf.hires.length + window.__wf.exits.length"), '인력 현황: 막대가 항목 수만큼 그려지고 0이 아닌 값은 폭이 있다')
   ok(pg.evaluate("document.querySelector('#hm-work [data-w-bar]').closest('[role=img]').getBoundingClientRect().height") > 3, '인력 현황 막대 바탕의 높이가 보인다')
   ok(pg.evaluate("window.__y") is None and pg.evaluate("document.querySelector('#hm-work').innerHTML.includes('<b>위험</b>')") is False, '★ 직급에 넣은 <b> 태그가 그대로 들어가지 않는다')
   ok(pg.evaluate("document.querySelector('#hm-work').getBoundingClientRect().right <= innerWidth + 1 && document.querySelector('#hm-purge').getBoundingClientRect().right <= innerWidth + 1") and pg.evaluate("document.documentElement.scrollWidth") <= w + 1, '★ %s: 홈의 파기 신호 칸·인력 현황이 화면을 넘지 않는다' % label)
   ok(pg.evaluate("(() => { const k = document.getElementById('hm-kpi'), w = document.getElementById('hm-purge'), m = document.getElementById('hm-work'), l = document.getElementById('hm-list'); return !!k && w.compareDocumentPosition(m) & 4 && m.compareDocumentPosition(l) & 4; })()"), '칸 순서: 지원서 파기 → 인력 현황 → 목록')
   ctx.close()
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 22: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 22)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
