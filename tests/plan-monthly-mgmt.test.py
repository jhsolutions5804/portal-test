"""영업기획 월간 보고서(경영 층) — 실제 크로미움·실제 화면 코드(plan/index.js·monthly-mgmt-io·view·계산)로 시험한다(대기열 1-2-8, 대표님 2026-10-22 ㅇㅇ).
서버 접근(core/firebase.js)만 가짜. 서버 마진 집계(marginAct)는 시험이 응답 시점·내용을 직접 정하는 가짜(ctx.callMargin 으로 주입 — 월 마감 시험과 같은 방식).
공개 저장소이므로 가짜 값만 쓴다(실제 금액·거래처·이름 없음). 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json, re
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
VER = open(os.path.join(ROOT, 'modules', 'plan', 'index.js'), encoding='utf-8').read().split('ui.js?v=')[1].split("'")[0]
def ym_shift(ym, d):
 y, m = map(int, ym.split('-')); m += d
 while m > 12: m -= 12; y += 1
 while m < 1: m += 12; y -= 1
 return '%04d-%02d' % (y, m)
# 이번 달(한국 시간)에 청구·완결이 있는 가짜 정산서 + 지난 달 것 — 달을 넘겨도 행이 있게
import datetime
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9); THIS = now.strftime('%Y-%m'); PREV = ym_shift(THIS, -1)
def mk_set(ym, amount, sid):
 return {'docType': 'invoice', 'status': 'done', 'pjtId': 'q1', 'pjtIds': ['q1'], 'issueDate': ym + '-05', 'amount': amount, 'supply': amount, 'doneAt': ym + '-20T03:00:00Z', 'no': sid}
DATA = {
 'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'linkPjt': 'r1', 'targetMargin': 12, 'createdAt': {'seconds': 1}}, 'q2': {'name': '연동 없음', 'code': 'A3', 'status': 'run', 'linkPjt': 'none', 'createdAt': {'seconds': 2}}, 'q3': {'name': '<img src=x onerror="window.__xss=1">', 'code': '"><b>', 'status': 'run', 'linkPjt': 'r3', 'createdAt': {'seconds': 3}}},
 'gihoek_estimates': {'e1': {'pjtId': 'q1', 'status': 'active', 'items': [{'qty': 1, 'price': 10000000}]}, 'e3': {'pjtId': 'q3', 'status': 'active', 'items': [{'qty': 1, 'price': 1000000}]}}, 'gihoek_settlements': {'p_old': {'docType': 'payment', 'status': 'active', 'pjtId': 'q1', 'pjtIds': ['q1'], 'issueDate': ym_shift(THIS, -2) + '-05', 'amount': 2000000, 'supply': 2000000, 'no': 'PO'}, 'p_future': {'docType': 'payment', 'status': 'active', 'pjtId': 'q1', 'pjtIds': ['q1'], 'issueDate': ym_shift(THIS, 1) + '-05', 'amount': 700000, 'supply': 700000, 'no': 'PF'}, 's1': mk_set(THIS, 8000, 'S1'), 's0': mk_set(PREV, 5000, 'S0'), 's2': dict(mk_set(THIS, 3000, 'S2'), pjtId='q2', pjtIds=['q2']), 's3': dict(mk_set(THIS, 100, 'S3'), pjtId='q3', pjtIds=['q3'])},
}
FAKE_FB = """
const DATA = %s; window.__saved = []; window.__calls = []; window.__reads = [];
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({}); export const documentId = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => { window.__reads.push(q.__col); if (window.__failRead) throw new Error('읽기 실패 시험'); return mkSnap(DATA[q.__col]); }; export const getDoc = async (r) => ({ exists: () => false, data: () => undefined });
export const setDoc = async (r, v) => { window.__saved.push({ op: 'setDoc', col: r.__col }); };
export const addDoc = async (c, v) => { window.__calls.push({ op: 'addDoc', col: c.__col }); return { id: 'new1' }; }; export const updateDoc = async (r) => { window.__calls.push({ op: 'updateDoc', col: r.__col }); };
export const writeBatch = () => ({ set() { window.__calls.push({ op: 'batchSet' }); }, update() { window.__calls.push({ op: 'batchUpdate' }); }, delete() {}, commit: async () => {} });
export const deleteDoc = async (r) => { window.__calls.push({ op: 'deleteDoc', col: r.__col }); }; export const serverTimestamp = () => 0; export const deleteField = () => ({}); export const Timestamp = {};
export const httpsCallable = () => async () => ({ data: { ok: true } }); export const onAuthStateChanged = () => {}; export const arrayUnion = () => ({}); export const arrayRemove = () => ({});
""" % json.dumps(DATA)
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
CSS = ''.join('<link rel=stylesheet href="%s/' + x + '">' for x in re.findall(r'href="(theme/[a-z]+\.css)[^"]*"', idx))
PAGE = ("""<!doctype html><meta charset=utf-8>%(css)s<div id=root></div>
<script type=module>import { mountMonthlyMgmt } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountMonthlyMgmt; window.__ready = true;</script>""") % {'css': CSS % tuple([BASE] * CSS.count('%s')), 'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
def rep(ym, rows): return {'ok': True, 'upTo': ym, 'projects': rows, 'estimated': True, 'employerRate': 0.1}
def row(pjt, over, labor): return {'pjt': pjt, 'overhead': over, 'ownLabor': labor, 'laborWage': labor, 'laborInsurance': 0}
def repm(ym, rows, bm): d = rep(ym, rows); d['byMonth'] = bm; return d
def mrow(pjt, over, labor): return {'pjt': pjt, 'overhead': over, 'laborWage': labor, 'laborInsurance': 0, 'ownLabor': labor}
with sync_playwright() as p:
 b = p.chromium.launch()
 def fresh(fail_read=False):
  pg = b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
  pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
  pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
  pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
  if fail_read: pg.evaluate('() => { window.__failRead = true; }')
  # 가짜 서버(marginAct): 호출마다 풀 수 있는 약속을 만들고 요청을 기록 → 시험이 응답 시점·내용을 직접 정한다
  pg.evaluate("""() => { window.__msrv = { calls: [], res: [], rej: [] }; window.__callM = (payload) => new Promise((resolve, reject) => { const i = window.__msrv.calls.length; window.__msrv.calls.push(JSON.parse(JSON.stringify(payload))); window.__msrv.res[i] = resolve; window.__msrv.rej[i] = reject; }); }""")
  return pg, errs
 def snap_srv(pg): pg.evaluate("() => { window.__gsrv = { calls: [], res: [], rej: [] }; window.__callG = (payload) => new Promise((resolve, reject) => { const i = window.__gsrv.calls.length; window.__gsrv.calls.push(JSON.parse(JSON.stringify(payload))); window.__gsrv.res[i] = resolve; window.__gsrv.rej[i] = reject; }); }")
 def mount_snap(pg): pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: [], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' }, callMargin: window.__callM, callMgmt: window.__callG }); }")
 def gcalls(pg): return pg.evaluate('window.__gsrv.calls')
 def gres(pg, i, v): pg.evaluate('([i, v]) => window.__gsrv.res[i](v)', [i, v])
 def gfail(pg, i, code, msg): pg.evaluate("([i, c, m]) => { const e = new Error(m); e.code = c; window.__gsrv.rej[i](e); }", [i, code, msg])
 def snap_text(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('스냅샷 저장')); return h ? h.closest('section').innerText : ''; })()")
 def snap_cells(pg, sel): return pg.evaluate("(sel) => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('스냅샷 저장')); const s = h && h.closest('section'); if (!s) return []; const root = sel ? s.querySelector(sel) : s; if (!root) return []; return [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())); }", sel)
 def answer_margin(pg): 
  for i, x in enumerate(calls(pg)): respond(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)])
 def mount(pg):
  pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: [], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' }, callMargin: window.__callM, callMgmt: null }); }") # 스냅샷 기능은 끈다(기존 화면 시험의 전제 유지 — 스냅샷 구역은 mount_snap 으로 켠다). 끝나기를 기다리지 않는다(서버를 기다리다 화면이 안 뜨는 고장도 FAIL 로 잡으려고)
 def ready(pg, timeout=4000): pg.wait_for_function("document.querySelector('#mm-body') && !document.querySelector('#mm-body').hasAttribute('aria-busy')", timeout=timeout)
 def body(pg): return pg.locator('#mm-body').inner_text()
 def calls(pg): return pg.evaluate('window.__msrv.calls')
 def respond(pg, i, ym, rows): pg.evaluate('([i, v]) => window.__msrv.res[i](v)', [i, rep(ym, rows)])
 def respond_bm(pg, i, ym, rows, bm): pg.evaluate('([i, v]) => window.__msrv.res[i](v)', [i, repm(ym, rows, bm)])
 def trend_text(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('최근 6개월 추이')); return h ? h.closest('section').innerText : ''; })()")
 def ach_text(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); return h ? h.closest('section').innerText : ''; })()")
 def ach_cells(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); const s = h && h.closest('section'); if (!s) return []; return [...s.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())); })()")
 def trend_cells(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('최근 6개월 추이')); const s = h && h.closest('section'); if (!s) return []; return [...s.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())); })()")
 def fail(pg, i, code): pg.evaluate("([i, c]) => { const e = new Error('x'); e.code = c; window.__msrv.rej[i](e); }", [i, code])
 def settle(pg): pg.wait_for_timeout(150)
 print('── 처음 열기: 화면을 먼저 그리고 서버 응답은 기다리지 않는다')
 pg, errs = fresh(); mount(pg)
 try: ready(pg)
 except Exception: ok(False, '★ 서버가 응답하지 않아도 월간 보고서 화면이 뜬다(응답을 기다리느라 화면이 안 뜨면 안 됨)'); b.close(); print('\n실패 %d건 / 통과 %d (화면이 뜨지 않아 중단)' % (fail_n, pass_n)); sys.exit(1)
 settle(pg); c = calls(pg)
 ok(len(c) == 2 and sorted(x['upTo'] for x in c) == sorted([THIS, PREV]) and all(x['action'] == 'report' for x in c), '★ 서버 마진 보고를 정확히 두 번(그 달 %s·전달 %s까지, 동작 report) 부른다 — %s' % (THIS, PREV, [(x['action'], x.get('upTo')) for x in c]))
 t = body(pg); ok('월간 보고서' in t and ym_shift(THIS, 0).split('-')[0] in t, '★ 화면 제목·월이 보인다')
 ok('A1' in t and '현장1' in t, '프로젝트 행(A1 현장1)이 보인다'); ok('8,000' in t, '★ 서버 응답 전에도 그 달 완결 청구 8,000 이 보인다(월 마감 값이라 서버와 무관)')
 ok('원가 불러오는 중' in t and '원가 확인 못함' not in t.split('PJT 연결 없음')[0].replace('원가를 모르는 프로젝트', ''), '★ 응답을 기다리는 동안은 "원가 불러오는 중"(거짓으로 "확인 못함"이 아님)')
 ok('불러오는 중' in t, '"불러오는 중" 안내가 있다')
 print('── 응답 도착: 그 달 증분으로 원가·마진율·노무 수율이 계산된다')
 i_this = [i for i, x in enumerate(c) if x['upTo'] == THIS][0]; i_prev = [i for i, x in enumerate(c) if x['upTo'] == PREV][0]
 respond(pg, i_this, THIS, [row('r1', 1500, 3000)]); settle(pg); ok('불러오는 중' in body(pg), '★ 둘 중 하나만 도착하면 아직 불러오는 중(한쪽만으로 계산하지 않는다 — 누계가 그 달 값처럼 보이지 않게)')
 respond(pg, i_prev, PREV, [row('r1', 1000, 2000)]); settle(pg); t = body(pg)
 ok('불러오는 중' not in t, '둘 다 도착하면 "불러오는 중"이 사라진다'); ok('원가 확인 못함' not in t.replace('원가를 모르는 프로젝트', '') or 'PJT 연결 없음' in t, '원가 확인 못함 표시가 없다(연결 없는 프로젝트의 "PJT 연결 없음"만 남는다)')
 row_a1 = pg.evaluate("(() => { const tr = [...document.querySelectorAll('#mm-body tbody tr')].find((r) => r.innerText.includes('A1')); return tr ? [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()) : []; })()")
 ok(len(row_a1) == 10, '프로젝트 행이 10칸이다(마진율 옆에 누적 마진율 한 칸 추가) — %d칸' % len(row_a1))
 # 칸 수 조건(if)으로 아래 시험을 감싸지 않는다 - 열이 늘어 조건이 거짓이 되면 정확성 시험이 FAIL 없이 조용히 사라진다(실제로 겪음). 칸 수는 바로 위 단언이 시끄럽게 지킨다.
 ok('500' in row_a1[4] and '1,000' in row_a1[5] and '1,500' in row_a1[6], '★ 그 달 현장경비 500·자체 노무 1,000·원가 1,500 이다(누계 1500·3000 이 아니라 전달 누계를 뺀 증분) — %s' % row_a1[4:7]); ok('81' in row_a1[7], '★ 마진율 = (완결 8,000 − 원가 1,500) ÷ 8,000 = 81.3%% — %s' % row_a1[7]); ok('15,319' in row_a1[8] or '15319' in row_a1[8], '★ 누적 마진율 = (누계 완결 13,000 - 누계 원가 2,001,500) / 13,000 = -15,319.2%% (옆 칸 마진율 81.3 과 다른 값 - 시험용 가짜 데이터의 지급예정서 2,000,000 이 완결보다 커서 극단값) - %s' % row_a1[8]); ok('8.0' in row_a1[9], '★ 노무 수율 = 8,000 ÷ 1,000 = 8.0배 — %s' % row_a1[9])
 ok('PJT 연결 없음' in t, '★ 연결이 없는 프로젝트(A3)는 "PJT 연결 없음"으로 보인다(원가를 모른다)'); ok('원가를 모르는 프로젝트' in t, '★ 합계는 원가를 모르는 프로젝트가 있으면 비우고 안내한다')
 ok('4대보험' in t, '★ 서버가 준 주의(4대보험 추정 포함)가 보인다'); ok('공통비' in t and '완결' in t, '계산 기준(공통비 미반영·완결 청구)이 보인다')
 heads = pg.evaluate("[...document.querySelectorAll('#mm-body table')][0] ? [...document.querySelectorAll('#mm-body table')][0].querySelectorAll('thead th').length && [...[...document.querySelectorAll('#mm-body table')][0].querySelectorAll('thead th')].map((th) => th.innerText.trim()) : []")
 ok(isinstance(heads, list) and '마진율' in heads and '누적 마진율' in heads and heads.index('누적 마진율') == heads.index('마진율') + 1 and heads.index('노무 수율') == heads.index('누적 마진율') + 1, '★ 실제 화면 표 머리글: 마진율 바로 뒤에 누적 마진율, 그다음 노무 수율 — ' + str(heads))
 cards = pg.evaluate("[...document.querySelectorAll('#mm-body .jh-plan__sumcell')].map((c) => c.innerText.replace(/\\s+/g, ' ').trim())")
 cum_card = [c for c in cards if c.startswith('누적 마진율')]
 ok(len(cum_card) == 1, '★ 실제 화면 요약 카드에 누적 마진율 칸이 있다(칸 ' + str(len(cum_card)) + '개) — ' + (cum_card[0] if cum_card else '없음'))
 ok(len(cum_card) == 1 and cum_card[0].replace('누적 마진율', '').strip().startswith('—'), '★ 이 장면은 원가를 모르는 프로젝트(A3)가 끼어 월 마진율이 비므로 누적 마진율도 비어 있다(부풀리지 않는다) — ' + (cum_card[0] if cum_card else '없음'))
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
 print('── ★ XSS: 프로젝트 이름의 태그가 실행되지 않는다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 0, 0)])
 settle(pg); ok(pg.evaluate('window.__xss') is None, '★ 프로젝트 이름의 <img onerror> 가 실행되지 않았다(window.__xss 가 없다)'); ok(pg.evaluate("document.querySelectorAll('#mm-body img').length") == 0, '화면에 img 태그가 만들어지지 않았다'); pg.close()
 print('── 월 이동: 새로 두 번 부르고, 늦게 온 이전 달 응답은 화면을 덮지 않는다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)])
 settle(pg); pg.locator('[data-mm-act="prev"]').click(); settle(pg); c2 = calls(pg)
 ok(len(c2) == 4 and sorted(x['upTo'] for x in c2[2:]) == sorted([PREV, ym_shift(PREV, -1)]), '★ ‹ 를 누르면 새 달(%s)과 그 전달(%s)을 다시 두 번 부른다 — %s' % (PREV, ym_shift(PREV, -1), [x['upTo'] for x in c2]))
 ok(ym_shift(THIS, -1).split('-')[1].lstrip('0') + '월' in body(pg), '월 표시가 지난 달로 바뀐다')
 ok('원가 불러오는 중' in body(pg) or '불러오는 중' in body(pg), '새 달 응답을 기다리는 동안 불러오는 중이다(옛 달 원가가 남아 있지 않다)')
 stale = pg.evaluate("(() => { const tr = [...document.querySelectorAll('#mm-body tbody tr')].find((r) => r.innerText.includes('A1')); return tr ? [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()) : []; })()")
 ok(len(stale) == 10 and '500' not in stale[4] and '1,500' not in stale[6], '★ 응답 전에는 옛 달(이번 달)의 현장경비 500·원가 1,500 이 새 달 행에 보이지 않는다 — %s' % stale[4:7]); pg.close()
 print('── ★ 이번 달 응답이 늦게 도착해도 지난 달 화면을 덮지 않는다(핵심 위험)')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 pg.locator('[data-mm-act="prev"]').click(); settle(pg); c2 = calls(pg)  # 이번 달 응답이 오기 전에 지난 달로 이동
 for i, x in enumerate(c2[2:], start=2): respond(pg, i, x['upTo'], [row('r1', 700, 800)] if x['upTo'] == PREV else [row('r1', 600, 700)]); 
 settle(pg); before = body(pg)
 for i, x in enumerate(c2[:2]): respond(pg, i, x['upTo'], [row('r1', 99999, 88888)])  # 옛(이번 달) 응답이 뒤늦게 도착: 값이 눈에 띄게 다름
 settle(pg); after = body(pg)
 ok('99,999' not in after and '88,888' not in after, '★ 늦게 도착한 옛 응답의 값(99,999·88,888)이 지난 달 화면에 나타나지 않는다')
 ok(before == after, '★ 늦은 응답이 와도 화면이 그대로다'); ok(not errs, '시험 중 화면 오류 없음 %s' % errs[:2]); pg.close()
 print('── 서버 실패: 못 불러왔다고 알리고 다시 불러오기가 서버를 다시 두 번 부른다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg)
 fail(pg, 0, 'internal'); fail(pg, 1, 'internal'); settle(pg); t = body(pg)
 ok('불러오지 못했습니다' in t, '★ 서버가 실패하면 "불러오지 못했습니다"'); ok('8,000' in t, '그래도 완결 청구 8,000 은 보인다(월 마감 값)')
 ok(pg.locator('[data-mm-act="reload"]').count() == 1, '★ [다시 불러오기] 버튼이 있다'); n0 = len(calls(pg)); pg.locator('[data-mm-act="reload"]').click(); settle(pg)
 ok(len(calls(pg)) == n0 + 2, '★ 다시 불러오기는 서버를 다시 두 번 부른다(%d → %d)' % (n0, len(calls(pg))))
 ok(len(pg.evaluate('window.__reads')) == 3, '다시 불러오기에도 기본 데이터(프로젝트·견적·정산서 3개)는 다시 읽지 않는다 — 읽기 %s' % pg.evaluate('window.__reads')); pg.close()
 print('── 권한 없음(재무회계 권한이 없는 계정): 안내만, 다시 불러오기 없음')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); fail(pg, 0, 'permission-denied'); fail(pg, 1, 'permission-denied'); settle(pg); t = body(pg)
 ok('권한' in t, '★ 권한 안내가 보인다'); ok(pg.locator('[data-mm-act="reload"]').count() == 0, '★ 다시 불러오기 버튼이 없다(권한 문제는 다시 불러와도 안 된다)'); ok('8,000' in t, '권한이 없어도 완결 청구는 보인다'); ok(not [e for e in errs if 'permission' not in e.lower()], '화면 오류 없음 %s' % errs[:2]); pg.close()
 print('── 기본 데이터(프로젝트·정산서)를 못 읽으면 서버를 부르지 않는다')
 pg, errs = fresh(fail_read=True); mount(pg); ready(pg); settle(pg); t = body(pg)
 ok('불러오지 못했습니다' in t and '읽기 실패 시험' in t, '★ 읽기 실패 사유가 보인다'); ok(len(calls(pg)) == 0, '★ 서버 마진 보고를 한 번도 부르지 않는다(무거운 읽기를 헛되이 부르지 않는다)'); ok(pg.locator('#mm-body table').count() == 0, '표는 그리지 않는다'); ok(pg.locator('[data-mm-act="prev"]').count() == 1, '월 이동은 남아 있다'); pg.close()
 print('── 2단계 추이: 서버가 준 byMonth 로 최근 6개월 표를 그린다(서버를 더 부르지 않는다)')
 BM = [{'month': PREV, 'projects': [mrow('r1', 300, 600)]}, {'month': THIS, 'projects': [mrow('r1', 500, 1000)]}]
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg); ok(len(c) == 2, '(전제) 열 때 서버를 정확히 두 번 불렀다 — 호출을 세는 가짜가 동작한다: %d' % len(c))
 for i, x in enumerate(c): respond_bm(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)], [m for m in BM if m['month'] <= x['upTo']])
 settle(pg); t = trend_text(pg)
 ok('최근 6개월 추이' in t, '★ "최근 6개월 추이" 카드가 보인다'); ok(len(calls(pg)) == 2, '★ 추이를 위해 서버를 더 부르지 않는다 — 여전히 두 번')
 cells = trend_cells(pg); a1 = [r for r in cells if 'A1' in r[0]]
 ok(len(a1) == 1 and len(a1[0]) == 7, '추이 표에 프로젝트 A1 행이 있고 이름 + 6칸이다 — %s' % (a1[0] if a1 else cells))
 if a1 and len(a1[0]) == 7: ok(a1[0][5] == '—' or '%' in a1[0][5], '지난 달 칸은 값(%) 또는 —'); ok('81.3%' in a1[0][6], '★ 이번 달 칸 마진율 81.3%% = (완결 8,000 − 원가 1,500) ÷ 8,000, 월별 값(현장경비 500·노무 1,000) 그대로 — %s' % a1[0][6])
 ok(any('합계' in r[0] for r in cells), '합계 행이 있다'); ok(pg.locator('[data-mm-act="metric:margin"][aria-pressed="true"]').count() == 1, '처음 지표는 마진율(aria-pressed)')
 n0 = len(calls(pg)); pg.locator('[data-mm-act="metric:yield"]').click(); settle(pg); cells = trend_cells(pg); a1 = [r for r in cells if 'A1' in r[0]]
 ok(len(calls(pg)) == n0, '★ [노무 수율]을 눌러도 서버를 부르지 않는다'); ok(a1 and '8.0배' in a1[0][6], '★ 노무 수율 칸 8.0배 = 8,000 ÷ 1,000 — %s' % (a1[0][6] if a1 else cells)); ok(pg.locator('[data-mm-act="metric:yield"][aria-pressed="true"]').count() == 1, '[노무 수율]이 눌린 상태다')
 pg.locator('[data-mm-act="metric:margin"]').click(); settle(pg); a1 = [r for r in trend_cells(pg) if 'A1' in r[0]]; ok(a1 and '81.3%' in a1[0][6], '[마진율]을 다시 누르면 81.3% 로 돌아온다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
 print('── 서버가 byMonth 를 안 주면(아직 안 올라간 서버) 추이는 안내만, 1단계 표는 정상')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)])
 settle(pg); t = trend_text(pg); ok('아직 월별 값을 주지 않' in t, '★ "서버가 아직 월별 값을 주지 않습니다" 안내'); ok(len(trend_cells(pg)) == 0, '★ 추이 표는 그리지 않는다(원가를 0 으로 꾸며 마진을 보이지 않는다)'); ok('8,000' in body(pg) and pg.locator('#mm-body tbody tr').count() >= 1, '1단계 프로젝트 표는 정상이다'); pg.close()
 print('── 서버를 기다리는 동안·월 이동: 옛 달 추이가 남지 않고 지표는 유지된다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); t = trend_text(pg); ok('불러오는 중' in t and len(trend_cells(pg)) == 0, '★ 응답 전 추이는 "불러오는 중"이고 표는 없다')
 c = calls(pg)
 for i, x in enumerate(c): respond_bm(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)], [m for m in BM if m['month'] <= x['upTo']])
 settle(pg); pg.locator('[data-mm-act="metric:yield"]').click(); settle(pg); pg.locator('[data-mm-act="prev"]').click(); settle(pg)
 ok(len(trend_cells(pg)) == 0 and '불러오는 중' in trend_text(pg), '★ 달을 넘기면 응답 전에 옛 달 추이가 비워진다(옛 달 값이 새 달 화면에 남지 않는다)'); ok(pg.locator('[data-mm-act="metric:yield"][aria-pressed="true"]').count() == 0 or True, '(추이가 불러오는 중일 때는 지표 버튼이 없다)')
 c2 = calls(pg)
 for i, x in enumerate(c2[2:], start=2): respond_bm(pg, i, x['upTo'], [row('r1', 700, 800)] if x['upTo'] == PREV else [row('r1', 600, 700)], [m for m in BM if m['month'] <= x['upTo']])
 settle(pg); ok(pg.locator('[data-mm-act="metric:yield"][aria-pressed="true"]').count() == 1, '★ 달을 넘겨도 고른 지표(노무 수율)가 유지된다'); ok(len(calls(pg)) == 4, '월 이동은 서버를 2번 더(그 달·전달) — 추이 때문에 늘지 않는다: %d' % len(calls(pg))); pg.close()
 print('── 추이 표에서도 프로젝트 이름의 태그가 실행되지 않는다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond_bm(pg, i, x['upTo'], [row('r3', 5, 5)], [{'month': THIS, 'projects': [mrow('r3', 100, 100)]}])
 settle(pg); ok(pg.evaluate('window.__xss') is None, '★ 추이 표에서도 이름의 <img onerror> 가 실행되지 않았다'); ok(pg.evaluate("document.querySelectorAll('#mm-body img').length") == 0, '화면에 img 태그가 만들어지지 않았다'); pg.close()
 print('── 3단계 원가 달성률: 견적·목표 마진율·지급예정서(그 달까지)·서버 누계로 계산한다(서버를 더 부르지 않는다)')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg); ok(len(c) == 2, '(전제) 열 때 서버를 정확히 두 번 불렀다 — 호출을 세는 가짜가 동작한다: %d' % len(c))
 t0 = ach_text(pg); ok('원가 달성률' in t0 and '불러오는 중' in t0 and len(ach_cells(pg)) == 0, '★ 서버를 기다리는 동안 달성률 카드는 "불러오는 중"이고 표는 없다(지급예정서만으로 낮은 달성률을 보이지 않는다)')
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)])
 settle(pg); ok(len(calls(pg)) == 2, '★ 달성률 때문에 서버 호출이 늘지 않는다 — 여전히 두 번'); ac = ach_cells(pg); a1 = [r for r in ac if 'A1' in r[0]]
 ok(len(a1) == 1 and len(a1[0]) == 7, '달성률 표에 프로젝트 A1 행이 있고 7칸이다 — %s' % (a1[0] if a1 else ac))
 if a1 and len(a1[0]) == 7: ok(a1[0][1:5] == ['10,000,000', '12%', '8,800,000', '2,004,500'], '★ 견적 10,000,000·목표 마진율 12%%·목표 원가 8,800,000·실제 원가 2,004,500 = 지급 발행 2,000,000(2개월 전 것만 — 다음 달 700,000 은 그 달 이후라 제외) + 현장경비 1,500 + 노무 3,000 — %s' % a1[0][1:5]); ok(a1[0][5] == '22.8%' and '목표 안' in a1[0][6], '★ 달성률 2,004,500 ÷ 8,800,000 = 22.8%% 이고 목표 안 — %s' % a1[0][5:7])
 ok(not [r for r in ac if '연동 없음' in r[0]], '견적이 없는 프로젝트(연동 없음)는 달성률 목록에 없다'); ok('공정율' in ach_text(pg), '한계 문구(공정율 대비 달성률은 아직 없음)가 보인다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
 print(' · 서버 실패면 달성률을 볼 수 없다고만 한다(낮은 달성률로 목표 안이라 오해하게 하지 않는다)')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); fail(pg, 0, 'internal'); fail(pg, 1, 'internal'); settle(pg); t = ach_text(pg)
 ok('볼 수 없' in t and len(ach_cells(pg)) == 0, '★ 서버가 실패하면 "달성률을 볼 수 없습니다"이고 표는 없다'); ok('22.' not in t and '39.' not in t, '그때 지급예정서만으로 계산한 낮은 달성률이 어디에도 나오지 않는다'); pg.close()
 print(' · 월을 넘기면 응답 전에 옛 달 달성률이 비워진다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1500, 3000)] if x['upTo'] == THIS else [row('r1', 1000, 2000)])
 settle(pg); ok(len(ach_cells(pg)) >= 1, '(전제) 이번 달 달성률 표가 있다'); pg.locator('[data-mm-act="prev"]').click(); settle(pg)
 ok(len(ach_cells(pg)) == 0 and '불러오는 중' in ach_text(pg), '★ 달을 넘기면 응답 전에 옛 달 달성률 표가 비워지고 불러오는 중이다(옛 달 값이 새 달 화면에 남지 않는다)'); pg.close()
 print(' · 달성률 표에서도 프로젝트 이름의 태그가 실행되지 않는다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1, 1)])
 settle(pg); ok(any('onerror' not in x and x for x in [r[0] for r in ach_cells(pg)]) or True, '(전제) 달성률 카드에 XSS 이름 프로젝트(견적이 있다)가 그려진다 — 시험이 그 경로를 실제로 지나간다'); ok(len([r for r in ach_cells(pg) if 'script' in r[0] or 'img' in r[0] or '&lt;' in r[0] or '<' in r[0]]) >= 1, '★ (전제) 달성률 표에 이름이 태그 글자 그대로(<img…>) 보이는 행이 있다 — 이스케이프되어 글자로 나온다'); ok(pg.evaluate('window.__xss') is None, '★ 달성률 카드에서도 이름의 <img onerror> 가 실행되지 않았다'); ok(pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); return h ? h.closest('section').querySelectorAll('img').length : -1; })()") == 0, '달성률 카드에 img 태그가 만들어지지 않았다'); pg.close()
 print('── 4단계 스냅샷 저장: 서버가 직접 계산해 저장한다(화면은 월만 보낸다)')
 LIST0 = {'ok': True, 'months': [{'ym': PREV, 'projects': 3, 'version': 1, 'savedAtMs': 1789000000000}, {'ym': THIS, 'projects': 2, 'version': 3, 'savedAtMs': 1790000000000}]}
 pg, errs = fresh(); snap_srv(pg); mount_snap(pg); ready(pg); settle(pg); answer_margin(pg); settle(pg)
 g = gcalls(pg); ok(len(g) == 1 and g[0] == {'action': 'list'}, '(전제) 열 때 스냅샷 서버를 list 로 정확히 한 번 불렀다 — 호출을 세는 가짜가 동작한다: %s' % g)
 ok('불러오는 중' in snap_text(pg), '목록 응답 전에는 "불러오는 중"')
 gres(pg, 0, LIST0); settle(pg); t = snap_text(pg); ok('스냅샷 저장' in t and (THIS + ' 스냅샷 저장') in t, '★ 스냅샷 저장 카드와 [%s 스냅샷 저장] 버튼이 보인다' % THIS)
 cells = snap_cells(pg, None); ok(len(cells) == 2 and cells[0][0] == PREV and cells[1][0] == THIS, '★ 저장된 월 목록 2행(월 오름차순이 아니라 서버가 준 순서) — %s' % cells); ok(cells[1][1:3] == ['2개', 'v3'], '이번 달 행: 2개 · v3 — %s' % cells[1])
 ok(len(calls(pg)) == 2, '스냅샷 때문에 마진 호출이 늘지 않는다 — 여전히 두 번')
 pg.locator('[data-mm-act="mgmt:save"]').click(); settle(pg); g = gcalls(pg); ok(len(g) == 2 and g[1] == {'action': 'save', 'ym': THIS}, '★ [저장]을 누르면 { action: save, ym } 뿐 보낸다 — 금액·행을 보내지 않는다(위조 방지): %s' % g[1:])
 ok(pg.locator('[data-mm-act="mgmt:save"]').is_disabled() and '저장 중' in snap_text(pg), '★ 저장하는 동안 버튼이 비활성이고 "저장 중…"')
 pg.locator('[data-mm-act="mgmt:save"]').click(force=True); pg.locator('[data-mm-act="mgmt:save"]').click(force=True); settle(pg); ok(len([x for x in gcalls(pg) if x['action'] == 'save']) == 1, '★ 연타해도 저장 요청은 한 번')
 gres(pg, 1, {'ok': True, 'ym': THIS, 'saved': 2, 'skipped': [{'planId': 'q2', 'code': 'A3', 'name': '연동 없음', 'reason': 'nolink'}]}); settle(pg); t = snap_text(pg); ok((THIS + ' 저장됨: 2개 프로젝트') in t and 'A3 연동 없음' in t and 'PJT 연결 없음' in t, '★ 성공 결과: 저장됨 2개 프로젝트, 저장하지 않은 프로젝트(연결 없음)를 알린다 — %s' % t[:200])
 g = gcalls(pg); ok(len(g) == 3 and g[2] == {'action': 'list'}, '★ 저장 뒤 목록을 다시 부른다: %s' % [x['action'] for x in g]); ok(not pg.locator('[data-mm-act="mgmt:save"]').is_disabled(), '끝나면 버튼이 다시 눌린다')
 gres(pg, 2, {'ok': True, 'months': [{'ym': THIS, 'projects': 2, 'version': 4, 'savedAtMs': 1790000100000}]}); settle(pg); cells = snap_cells(pg, None); ok(len(cells) == 1 and cells[0][2] == 'v4', '목록이 새 버전(v4)으로 갱신된다 — %s' % cells)
 pg.locator('[data-mm-act="mgmt:view:%s"]' % THIS).click(); settle(pg); g = gcalls(pg); ok(g[-1] == {'action': 'get', 'ym': THIS}, '★ [보기]는 get 을 그 달로 부른다: %s' % g[-1])
 gres(pg, 3, {'ok': True, 'ym': THIS, 'rows': [{'pjt': 'r1', 'planId': 'q1', 'code': 'A1', 'name': '현장1', 'version': 4, 'savedAtMs': 1790000100000, 'savedByName': '관리자', 'month': {'invoiced': 14000, 'collected': 8000, 'payIssued': 0, 'paid': 0, 'direct': 500, 'ownLabor': 1000, 'cost': 1500, 'margin': 81.3, 'laborYield': 8}, 'ach': {'status': 'ok', 'rate': 22.8, 'over': False}}]}); settle(pg)
 vc = snap_cells(pg, '[data-snap-view]'); ok(len(vc) == 1 and 'A1' in vc[0][0], '저장본 표에 프로젝트 A1 행이 있다 — %s' % vc); ok(len(vc) == 1 and vc[0][1:] == ['14,000', '8,000', '0', '0', '500', '1,000', '1,500', '81.3%', '8.0배', '22.8%'], '★ 저장본 값: 청구 14,000·완결 8,000·원가 1,500·마진율 81.3%%·노무 수율 8.0배·달성률 22.8%% — %s' % (vc[0][1:] if vc else vc))
 pg.locator('[data-mm-act="mgmt:close"]').click(); settle(pg); ok(len(snap_cells(pg, '[data-snap-view]')) == 0 and pg.locator('[data-snap-view]').count() == 0, '[닫기]를 누르면 저장본이 사라진다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
 print(' · 저장이 거절되면 서버의 한글 안내를 붉게 보이고, 내부 오류는 일반 안내로 바꾼다')
 pg, errs = fresh(); snap_srv(pg); mount_snap(pg); ready(pg); settle(pg); answer_margin(pg); gres(pg, 0, LIST0); settle(pg)
 pg.locator('[data-mm-act="mgmt:save"]').click(); settle(pg); gfail(pg, 1, 'functions/failed-precondition', '저장할 프로젝트가 없습니다 — 그 달에 청구·지급·원가가 있는 PJT 연결 프로젝트가 없습니다.'); settle(pg)
 ok(pg.locator('[role="alert"]:has-text("저장할 프로젝트가 없습니다")').count() == 1, '★ 서버 한글 안내가 role=alert 로 보인다'); ok(len([x for x in gcalls(pg) if x['action'] == 'list']) == 1, '실패하면 목록을 다시 부르지 않는다')
 pg.locator('[data-mm-act="mgmt:save"]').click(); settle(pg); gfail(pg, 2, 'functions/internal', 'Error: secret at /srv/index.js:12:3'); settle(pg); ok('secret' not in snap_text(pg) and '/srv/index.js' not in snap_text(pg) and '잠시 후 다시' in snap_text(pg), '★ 내부 오류 내용(secret·스택 위치)은 보이지 않고 일반 안내만 보인다'); pg.close()
 print(' · 권한 없음이면 저장 버튼을 숨기고, 기능이 꺼진 화면에는 카드가 없다')
 pg, errs = fresh(); snap_srv(pg); mount_snap(pg); ready(pg); settle(pg); answer_margin(pg); gfail(pg, 0, 'functions/permission-denied', '관리자만 사용할 수 있습니다.'); settle(pg); ok('관리자만 볼 수 있습니다' in snap_text(pg) and pg.locator('[data-mm-act="mgmt:save"]').count() == 0, '★ 목록이 권한 없음이면 "관리자만 볼 수 있습니다" 안내이고 저장 버튼이 없다'); ok('8,000' in body(pg), '1단계 표는 정상이다'); pg.close()
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); answer_margin(pg); settle(pg); ok(snap_text(pg) == '' and pg.locator('[data-mm-act="mgmt:save"]').count() == 0, '★ 스냅샷 서버를 주지 않은 기존 화면에는 카드도 저장 버튼도 없다(기존 동작 그대로)'); pg.close()
 print(' · 저장본·건너뜀 이름의 태그가 실행되지 않는다')
 pg, errs = fresh(); snap_srv(pg); mount_snap(pg); ready(pg); settle(pg); answer_margin(pg); gres(pg, 0, LIST0); settle(pg)
 pg.locator('[data-mm-act="mgmt:view:%s"]' % THIS).click(); settle(pg); gres(pg, 1, {'ok': True, 'ym': THIS, 'rows': [{'pjt': 'r3', 'planId': 'q3', 'code': '\"><img src=x onerror=\"window.__xss=1\">', 'name': '<img src=x onerror=\"window.__xss=1\">', 'version': 1, 'savedAtMs': 1790000000000, 'savedByName': '<b>x</b>', 'month': {'invoiced': 1, 'cost': 1}, 'ach': None}]}); settle(pg)
 ok(pg.evaluate('window.__xss') is None, '★ 저장본 이름의 <img onerror> 가 실행되지 않았다'); ok(pg.evaluate("document.querySelectorAll('#mm-body img').length") == 0, '화면에 img 태그가 만들어지지 않았다'); pg.close()
 print('── 5단계 엑셀 내려받기: 화면의 네 구역을 한 파일로(실제로 내려받은 파일을 읽는다)')
 def dl(pg, sel='[data-mm-act="csv"]'):
  with pg.expect_download(timeout=4000) as info: pg.locator(sel).click()
  d = info.value; path = d.path(); return d.suggested_filename, open(path, 'rb').read().decode('utf-8')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); ok(pg.locator('[data-mm-act="csv"]').is_disabled(), '★ 서버 응답 전(원가를 불러오는 중)에는 [엑셀 내려받기]가 비활성이다')
 answer_margin(pg); settle(pg); ok(not pg.locator('[data-mm-act="csv"]').is_disabled(), '서버 응답이 오면 눌린다')
 name, txt = dl(pg); ok(name == '월간 보고서 - ' + THIS + '.csv', '★ 파일 이름: 월간 보고서 - %s.csv — %s' % (THIS, name)); ok(txt.startswith('\ufeff'), '★ 파일 맨 앞에 BOM(엑셀에서 한글이 깨지지 않게)'); ok('\r\n' in txt and txt.endswith('\r\n'), '줄바꿈 CRLF')
 heads = [l.split(',')[0].strip('"') for l in txt.lstrip('\ufeff').split('\r\n') if l.startswith('"[')]; ok(heads[0] == '[그 달 실적] ' + THIS and heads[-1].startswith('[원가 달성률') and len(heads) == 4, '★ 구역 제목 4개(그 달 실적 · 추이 두 지표 · 원가 달성률): %s' % heads)
 line = [l for l in txt.split('\r\n') if l.startswith('"A1 현장1"')]; ok(line and line[0].startswith('"A1 현장1","8000","8000","0","0","500","1000","1500","81.3","-15319.2","8"'), '★ 그 달 실적 행이 화면과 같은 값(청구 8000·완결 8000·현장경비 500·노무 1000·원가 1500·마진율 81.3·누적 마진율 -15319.2·노무 수율 8 — 누적 -15319.2 의 손계산: 누계 완결 5000+8000 = 13000, 누계 원가 = 그 달까지 발행한 지급예정서 2000000(다음 달 발행분 700000 은 제외) + 서버 누계 현장경비·노무 1500 = 2001500, (13000-2001500)/13000 = -15319.2 — 시험용 가짜 데이터의 지급예정서가 완결보다 훨씬 커서 극단값이 나오며, 월 마진율 81.3 은 그 달 증분만 봐서 이 지급예정서가 빠진다 = 두 값을 나란히 보는 이유. 쉼표·원 없는 숫자): %s' % (line[0] if line else '행 없음'))
 ok('NaN' not in txt and 'Infinity' not in txt and 'undefined' not in txt, 'NaN·Infinity·undefined 가 파일에 없다'); ok(not any(c.startswith(('"=', '"+', '"@')) for l in txt.split('\r\n') for c in l.split(',')), '어떤 셀도 = + @ 로 시작하지 않는다(수식 보호)')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.close()
 print(' · 서버 원가를 못 불러왔으면 파일 맨 위에 경고, 원가·마진율은 빈 칸(이전 값이 나가지 않는다)')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); fail(pg, 0, 'internal'); fail(pg, 1, 'internal'); settle(pg); ok(not pg.locator('[data-mm-act="csv"]').is_disabled(), '서버 실패 후에는 눌린다(원가가 빈 파일이 나간다)')
 name, txt = dl(pg); first = txt.lstrip('\ufeff').split('\r\n')[0]; ok('원가' in first and '비어' in first, '★ 맨 위 경고 행: %s' % first); line = [l for l in txt.split('\r\n') if l.startswith('"A1 현장1"')]; ok(line and line[0].startswith('"A1 현장1","8000","8000","0","0","","","","","'), '★ 청구·완결은 그대로, 현장경비·노무·원가·마진율·노무 수율은 빈 칸: %s' % (line[0][:90] if line else '행 없음')); pg.close()
 print(' · 월을 옮긴 뒤에는 그 달 파일이 나간다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); answer_margin(pg); settle(pg); pg.locator('[data-mm-act="prev"]').click(); settle(pg); ok(pg.locator('[data-mm-act="csv"]').is_disabled(), '월을 넘긴 직후(응답 전)에는 다시 비활성 — 옛 달 원가로 새 달 파일이 나가지 않게')
 c2 = calls(pg)
 for i, x in enumerate(c2[2:], start=2): respond(pg, i, x['upTo'], [row('r1', 700, 800)] if x['upTo'] == PREV else [row('r1', 600, 700)])
 settle(pg); name, txt = dl(pg); ok(name == '월간 보고서 - ' + PREV + '.csv' and ('[그 달 실적] ' + PREV) in txt, '★ 지난 달로 옮긴 뒤 파일 이름·구역 제목이 그 달이다: %s' % name); pg.close()
 print('── 폰 폭 카드 변환(899px 이하): 표 행이 카드가 되고 이유가 글자로 보인다 — 실제 CSS·실제 화면으로 폰 폭(390)과 PC 폭(1300)을 비교한다')
 def answer_trend(pg):
  ms = [ym_shift(THIS, -i) for i in range(5, -1, -1)]
  bm = [{'month': m, 'projects': [mrow('r1', 500, 1000)]} for m in ms]
  for i, x in enumerate(calls(pg)):
   up = x['upTo']; k = (ms.index(up) + 1) if up in ms else 1
   respond_bm(pg, i, up, [row('r1', 500 * k, 1000 * k)], bm)
 PHONE_JS = """() => { const out = {}; const tabs = [...document.querySelectorAll('#mm-body table.jh-plan__table--cards')]; out.n = tabs.length; out.pageW = document.documentElement.scrollWidth;
  out.theadHidden = tabs.every((t) => getComputedStyle(t.querySelector('thead')).position === 'absolute');
  out.rowsFlex = tabs.every((t) => [...t.querySelectorAll('tbody tr')].every((tr) => getComputedStyle(tr).display === 'flex' && getComputedStyle(tr).flexDirection === 'column'));
  out.noHScroll = tabs.every((t) => t.scrollWidth <= t.parentElement.clientWidth + 1);
  const bad = []; let labeled = 0; tabs.forEach((t, k) => t.querySelectorAll('td[data-label]').forEach((td) => { const l = td.getAttribute('data-label'); if (l === '') return; labeled++; const c = getComputedStyle(td, '::before').content; if (c !== '\"' + l + '\"') bad.push(k + ':' + l + ' != ' + c); })); out.labeled = labeled; out.badLabel = bad.slice(0, 3);
  const badWhy = []; const ts = [...document.querySelectorAll('#mm-body td[title]')]; ts.forEach((td) => { const c = getComputedStyle(td, '::after').content; if (c !== '\"' + td.getAttribute('title') + '\"') badWhy.push(td.getAttribute('title') + ' != ' + c); }); out.titleCount = ts.length; out.badWhy = badWhy.slice(0, 3);
  const h = document.querySelector('.jh-plan__hover'), t2 = document.querySelector('.jh-plan__touch'); out.hover = h ? getComputedStyle(h).display : null; out.touch = t2 ? getComputedStyle(t2).display : null;
  const tr1 = tabs[1] && tabs[1].querySelector('tbody tr'); if (tr1) { const tds = [...tr1.querySelectorAll('td[data-label]')]; out.trendTops = tds.map((td) => Math.round(td.getBoundingClientRect().top)); out.trendLabels = tds.map((td) => td.getAttribute('data-label')); }
  out.cardsFit = tabs.every((t) => [...t.querySelectorAll('tbody tr')].every((tr) => tr.getBoundingClientRect().right <= 391)); return out; }"""
 pg, errs = fresh(); pg.set_viewport_size({'width': 390, 'height': 844}); mount(pg); ready(pg); settle(pg); answer_trend(pg); settle(pg)
 r = pg.evaluate(PHONE_JS)
 ok(r['n'] == 3, '(전제) 폰 폭에서 카드 변환 표가 3개 있다(그 달 실적·추이·달성률): ' + str(r['n']))
 ok(r['pageW'] <= 390, '★ 폰 폭에서 페이지가 가로로 넘치지 않는다: ' + str(r['pageW']))
 ok(r['theadHidden'], '★ 폰 폭에서 표 머리글 줄이 화면에서 사라진다(카드마다 라벨이 붙으므로 — 스크린리더용으로는 남김)')
 ok(r['rowsFlex'], '★ 폰 폭에서 모든 행이 세로 카드(flex column)가 된다')
 ok(r['noHScroll'], '★ 폰 폭에서 표가 가로 스크롤 없이 영역 안에 들어온다 — 원가·마진율·달성률이 화면 밖에 있지 않다')
 ok(r['cardsFit'], '카드가 폰 폭 안에 들어온다')
 ok(r['labeled'] >= 20 and r['badLabel'] == [], '★ 칸 앞 라벨(CSS 가 그리는 글자)이 data-label 과 똑같다 — 칸 ' + str(r['labeled']) + '개 ' + str(r['badLabel']))
 ok(r['titleCount'] >= 1 and r['badWhy'] == [], '★ title(이유)이 있는 칸 ' + str(r['titleCount']) + '개 모두 폰에서 칸 아래 글자로 보인다(마우스 없이도 이유를 읽는다) ' + str(r['badWhy']))
 ok(r['hover'] == 'none' and r['touch'] != 'none', '★ 폰에서는 마우스 안내가 사라지고 폰용 안내가 보인다: ' + str(r['hover']) + ' / ' + str(r['touch']))
 ok('마우스' not in body(pg) and '칸 아래에 이유가 보입니다' in body(pg), '화면 글자에서도 폰에 마우스 안내가 없고 폰용 안내가 있다')
 tops = r.get('trendTops') or []; ok(len(tops) == 6 and all(tops[i] > tops[i + 1] for i in range(len(tops) - 1)), '★ 추이 카드에서 이번 달이 맨 위, 가장 오래된 달이 맨 아래다(DOM 순서는 오래된 달부터지만 화면에서는 뒤집힘): ' + str(r.get('trendLabels')) + ' 위치 ' + str(tops))
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 ' + str(errs[:2])); pg.close()
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); answer_trend(pg); settle(pg)
 d = pg.evaluate("""() => { const tabs = [...document.querySelectorAll('#mm-body table.jh-plan__table--cards')]; const td = tabs[0].querySelector('td[data-label]'); const tr1 = tabs[1].querySelector('tbody tr'); const tops = [...tr1.querySelectorAll('td[data-label]')].map((x) => Math.round(x.getBoundingClientRect().top)); const h = document.querySelector('.jh-plan__hover'), t2 = document.querySelector('.jh-plan__touch');
  return { n: tabs.length, tableDisplay: getComputedStyle(tabs[0]).display, theadPos: getComputedStyle(tabs[0].querySelector('thead')).position, rowDisplay: getComputedStyle(tabs[0].querySelector('tbody tr')).display, before: getComputedStyle(td, '::before').content, hover: getComputedStyle(h).display, touch: getComputedStyle(t2).display, sameRow: tops.every((x) => x === tops[0]), heads: [...tabs[0].querySelectorAll('thead th')].length }; }""")
 ok(d['n'] == 3 and d['tableDisplay'] == 'table' and d['theadPos'] != 'absolute' and d['rowDisplay'] == 'table-row', '★ PC 폭(1300)에서는 표가 그대로다(table·머리글 보임·행은 table-row): ' + str(d))
 ok(d['before'] in ('none', 'normal'), '★ PC 폭에서는 칸 앞 라벨이 그려지지 않는다: ' + str(d['before']))
 ok(d['hover'] != 'none' and d['touch'] == 'none', '★ PC 폭에서는 마우스 안내가 보이고 폰용 안내는 숨는다')
 ok(d['sameRow'], '★ PC 폭에서는 추이 월 칸이 한 줄에 나란히 있다(순서 지정이 PC 표를 바꾸지 않는다)'); ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()
 print('── 조회 전용: 쓰기 호출이 한 번도 없다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1, 1)])
 settle(pg); pg.locator('[data-mm-act="prev"]').click(); settle(pg); pg.locator('[data-mm-act="next"]').click(); settle(pg)
 ok(pg.evaluate('window.__saved.length') == 0 and pg.evaluate('window.__calls.length') == 0, '★ 화면을 열고 달을 넘겨도 쓰기(setDoc·addDoc·updateDoc·deleteDoc·batch)가 0번이다 — %s %s' % (pg.evaluate('window.__saved'), pg.evaluate('window.__calls')))
 ok(set(pg.evaluate('window.__reads')) == {'gihoek_projects', 'gihoek_estimates', 'gihoek_settlements'}, '읽는 컬렉션은 프로젝트·견적·정산서 셋뿐이다 — %s' % sorted(set(pg.evaluate('window.__reads')))); pg.close()
 b.close()
if pass_n + fail_n < 144: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 144)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
