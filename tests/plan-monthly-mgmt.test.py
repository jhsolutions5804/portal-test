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
 'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'linkPjt': 'r1', 'createdAt': {'seconds': 1}}, 'q2': {'name': '연동 없음', 'code': 'A3', 'status': 'run', 'linkPjt': 'none', 'createdAt': {'seconds': 2}}, 'q3': {'name': '<img src=x onerror="window.__xss=1">', 'code': '"><b>', 'status': 'run', 'linkPjt': 'r3', 'createdAt': {'seconds': 3}}},
 'gihoek_estimates': {}, 'gihoek_settlements': {'s1': mk_set(THIS, 8000, 'S1'), 's0': mk_set(PREV, 5000, 'S0'), 's2': dict(mk_set(THIS, 3000, 'S2'), pjtId='q2', pjtIds=['q2']), 's3': dict(mk_set(THIS, 100, 'S3'), pjtId='q3', pjtIds=['q3'])},
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
 def mount(pg):
  pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: [], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' }, callMargin: window.__callM }); }") # 끝나기를 기다리지 않는다(서버를 기다리다 화면이 안 뜨는 고장도 FAIL 로 잡으려고)
 def ready(pg, timeout=4000): pg.wait_for_function("document.querySelector('#mm-body') && !document.querySelector('#mm-body').hasAttribute('aria-busy')", timeout=timeout)
 def body(pg): return pg.locator('#mm-body').inner_text()
 def calls(pg): return pg.evaluate('window.__msrv.calls')
 def respond(pg, i, ym, rows): pg.evaluate('([i, v]) => window.__msrv.res[i](v)', [i, rep(ym, rows)])
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
 ok(len(row_a1) == 9, '프로젝트 행이 9칸이다 — %d칸' % len(row_a1))
 if len(row_a1) == 9: ok('500' in row_a1[4] and '1,000' in row_a1[5] and '1,500' in row_a1[6], '★ 그 달 현장경비 500·자체 노무 1,000·원가 1,500 이다(누계 1500·3000 이 아니라 전달 누계를 뺀 증분) — %s' % row_a1[4:7]); ok('81' in row_a1[7], '★ 마진율 = (완결 8,000 − 원가 1,500) ÷ 8,000 = 81.3%% — %s' % row_a1[7]); ok('8.0' in row_a1[8], '★ 노무 수율 = 8,000 ÷ 1,000 = 8.0배 — %s' % row_a1[8])
 ok('PJT 연결 없음' in t, '★ 연결이 없는 프로젝트(A3)는 "PJT 연결 없음"으로 보인다(원가를 모른다)'); ok('원가를 모르는 프로젝트' in t, '★ 합계는 원가를 모르는 프로젝트가 있으면 비우고 안내한다')
 ok('4대보험' in t, '★ 서버가 준 주의(4대보험 추정 포함)가 보인다'); ok('공통비' in t and '완결' in t, '계산 기준(공통비 미반영·완결 청구)이 보인다')
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
 ok(len(stale) == 9 and '500' not in stale[4] and '1,500' not in stale[6], '★ 응답 전에는 옛 달(이번 달)의 현장경비 500·원가 1,500 이 새 달 행에 보이지 않는다 — %s' % stale[4:7]); pg.close()
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
 print('── 조회 전용: 쓰기 호출이 한 번도 없다')
 pg, errs = fresh(); mount(pg); ready(pg); settle(pg); c = calls(pg)
 for i, x in enumerate(c): respond(pg, i, x['upTo'], [row('r1', 1, 1)])
 settle(pg); pg.locator('[data-mm-act="prev"]').click(); settle(pg); pg.locator('[data-mm-act="next"]').click(); settle(pg)
 ok(pg.evaluate('window.__saved.length') == 0 and pg.evaluate('window.__calls.length') == 0, '★ 화면을 열고 달을 넘겨도 쓰기(setDoc·addDoc·updateDoc·deleteDoc·batch)가 0번이다 — %s %s' % (pg.evaluate('window.__saved'), pg.evaluate('window.__calls')))
 ok(set(pg.evaluate('window.__reads')) == {'gihoek_projects', 'gihoek_estimates', 'gihoek_settlements'}, '읽는 컬렉션은 프로젝트·견적·정산서 셋뿐이다 — %s' % sorted(set(pg.evaluate('window.__reads')))); pg.close()
 b.close()
if pass_n + fail_n < 42: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 42)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
