"""영업기획 월간 보고서(경영 층)의 원가 달성률 — 실행예산 기준(대기열 1-3-9 4단계, 대표님 2026-10-24 ㅇㅇ). 실제 크로미움·실제 화면 코드(plan/index.js·monthly-mgmt-io·view·csv·계산·budget)로 시험한다.
서버 접근(core/firebase.js)만 가짜. 서버 마진 보고(marginAct)는 시험이 응답을 바로 돌려주는 가짜(ctx.callMargin 으로 주입). 공개 저장소이므로 가짜 값만 쓴다. 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json, re, datetime
try:
 from playwright.sync_api import sync_playwright
except Exception:
 print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
class H(http.server.SimpleHTTPRequestHandler):
 def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
 def log_message(s, *a): pass
httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % port
VER = open(os.path.join(ROOT, 'modules', 'plan', 'index.js'), encoding='utf-8').read().split('ui.js?v=')[1].split("'")[0]
def ym_shift(ym, d):
 y, m = map(int, ym.split('-')); m += d
 while m > 12: m -= 12; y += 1
 while m < 1: m += 12; y -= 1
 return '%04d-%02d' % (y, m)
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9); THIS = now.strftime('%Y-%m'); PREV = ym_shift(THIS, -1)
def pay(pid, amt, sid): return {'docType': 'payment', 'status': 'active', 'pjtId': pid, 'pjtIds': [pid], 'issueDate': PREV + '-05', 'amount': amt, 'supply': amt, 'no': sid}
def bud(pid, rows, rev=1): return {'pjtId': pid, 'rev': rev, 'rows': [{'cat': c, 'name': n, 'amount': a, 'memo': '', 'src': 'manual'} for c, n, a in rows], 'note': '', 'savedAt': '2026-10-24T09:00:00.000Z', 'by': 'u0', 'history': []}
DATA = {
 'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'linkPjt': 'r1', 'targetMargin': 12, 'createdAt': {'seconds': 1}}, 'q2': {'name': '목표만', 'code': 'A2', 'status': 'run', 'linkPjt': 'r2', 'targetMargin': 20, 'createdAt': {'seconds': 2}}, 'q3': {'name': '<img src=x onerror="window.__xss=1">', 'code': '"><b>', 'status': 'run', 'linkPjt': 'r3', 'targetMargin': 10, 'createdAt': {'seconds': 3}}},
 'gihoek_estimates': {'e1': {'pjtId': 'q1', 'status': 'active', 'items': [{'qty': 1, 'price': 10000000}]}, 'e2': {'pjtId': 'q2', 'status': 'active', 'items': [{'qty': 1, 'price': 5000000}]}, 'e3': {'pjtId': 'q3', 'status': 'active', 'items': [{'qty': 1, 'price': 1000000}]}},
 'gihoek_settlements': {'p1': pay('q1', 1000000, 'P1'), 'p2': pay('q2', 500000, 'P2')},
 'gihoek_budgets': {'q1': bud('q1', [('sub', '외주', 1500000), ('labor', '노무', 600000), ('site', '경비', 400000), ('reserve', '예비', 200000)]), 'q3': {'pjtId': 'q3', 'rev': 0, 'rows': []}},
}
FAKE_FB = """
const DATA = %s; window.__reads = []; window.__saved = [];
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({}); export const documentId = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => { window.__reads.push(q.__col); if (window.__failCol === q.__col) { const e = new Error('읽기 실패 시험'); e.code = 'permission-denied'; throw e; } return mkSnap(DATA[q.__col]); };
export const getDoc = async (r) => ({ exists: () => false, data: () => undefined });
export const setDoc = async (r) => { window.__saved.push(r.__col); }; export const addDoc = async () => ({ id: 'n' }); export const updateDoc = async () => {};
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const deleteDoc = async () => {}; export const serverTimestamp = () => 0; export const deleteField = () => ({}); export const Timestamp = {};
export const httpsCallable = () => async () => ({ data: { ok: true } }); export const onAuthStateChanged = () => {}; export const arrayUnion = () => ({}); export const arrayRemove = () => ({});
""" % json.dumps(DATA)
idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
CSS = ''.join('<link rel=stylesheet href="%s/' + x + '">' for x in re.findall(r'href="(theme/[a-z]+\.css)[^"]*"', idx))
PAGE = ("""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">%(css)s<div id=root></div>
<script type=module>import { mountMonthlyMgmt } from "%(b)s/modules/plan/index.js?v=%(v)s"; window.__mount = mountMonthlyMgmt; window.__ready = true;</script>""") % {'css': CSS % tuple([BASE] * CSS.count('%s')), 'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
with sync_playwright() as p:
 b = p.chromium.launch()
 def fresh(width=1300, fail_col=None):
  ctx = b.new_context(viewport={'width': width, 'height': 1000}, accept_downloads=True); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
  pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
  pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
  pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
  if fail_col: pg.evaluate('(c) => { window.__failCol = c; }', fail_col)
  pg.evaluate("() => { window.__callM = async (pl) => ({ ok: true, upTo: pl.upTo, projects: [{ pjt: 'r1', overhead: 300000, ownLabor: 700000, laborWage: 700000, laborInsurance: 0 }, { pjt: 'r2', overhead: 100000, ownLabor: 100000, laborWage: 100000, laborInsurance: 0 }, { pjt: 'r3', overhead: 0, ownLabor: 0, laborWage: 0, laborInsurance: 0 }], estimated: true, employerRate: 0.1 }); }")
  pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: [], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' }, callMargin: window.__callM, callMgmt: null }); }")
  pg.wait_for_function("document.querySelector('#mm-body') && !document.querySelector('#mm-body').hasAttribute('aria-busy')", timeout=8000)
  pg.wait_for_function("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); return h && !h.closest('section').innerText.includes('불러오는 중'); })()", timeout=8000)
  return pg, errs
 def ach_text(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); return h ? h.closest('section').innerText : ''; })()")
 def ach_rows(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); const s = h && h.closest('section'); return s ? [...s.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\\s+/g, ' ').trim())) : []; })()")
 print('── 실행예산이 있는 프로젝트와 없는 프로젝트가 한 표에 구분되어 나온다')
 pg, errs = fresh(); rows = ach_rows(pg); by = {r[0][:2]: r for r in rows}
 ok(len(rows) == 3, '프로젝트 3행(실행예산 있음 1·없음 1·깨짐 1) — %d행' % len(rows))
 r1 = by.get('A1') or []; ok(len(r1) == 7, '★ 표는 기존과 같은 7칸이다(새 칸을 끼우지 않았다) — %d칸' % len(r1))
 ok(r1 and '실행예산 r1' in r1[0] and '외주 66.7%' in r1[0] and '자체 노무 116.7%(초과)' in r1[0] and '현장경비 75%' in r1[0], '★ 실행예산 프로젝트: 이름 옆에 "실행예산 r1"과 비목별 달성률(초과 비목은 글자로) — ' + (r1[0] if r1 else ''))
 ok(len(r1) == 7 and r1[3] == '2,700,000' and r1[4] == '2,000,000' and '74.1' in r1[5] and '실행예산 안' in r1[6], '★ 목표 원가 2,700,000(실행예산 총 계획)·실제 원가 2,000,000·달성률 74.1%·판정 실행예산 안 — ' + str(r1[3:]))
 r2 = by.get('A2') or []; ok(r2 and '목표 마진율' in r2[0] and '목표 안' in r2[-1] and r2[3] == '4,000,000', '★ 실행예산이 없는 프로젝트는 지금처럼 목표 마진율 기준(목표 원가 5,000,000×(1−20%)=4,000,000, 판정 목표 안) — ' + str(r2))
 r3 = by.get('">') or []; ok(len(r3) == 7 and '실행예산 오류' in r3[0], '★ 깨진 실행예산 프로젝트는 "실행예산 오류"로 알리고 목표 마진율 기준 값으로 보인다')
 t = ach_text(pg); ok('깨진 실행예산 1개' in t and '저장본' in t, '깨진 문서 개수 알림과, 저장본(스냅샷)은 아직 목표 마진율 기준이라는 한계 문구가 보인다')
 ok(pg.evaluate('window.__xss === undefined') and pg.evaluate("document.querySelector('#mm-body img') === null"), '★ 프로젝트 이름의 태그가 실행되지 않는다')
 ok(pg.evaluate("window.__reads.filter((c) => c === 'gihoek_budgets').length") == 1, '실행예산 문서는 한 번만 읽는다')
 pg.locator('[data-mm-act="prev"]').first.click(); pg.wait_for_timeout(500); pg.wait_for_function("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); return h && !h.closest('section').innerText.includes('불러오는 중'); })()", timeout=8000)
 ok(pg.evaluate("window.__reads.filter((c) => c === 'gihoek_budgets').length") == 1 and '실행예산 r1' in ach_text(pg), '★ 월을 넘겨도 실행예산을 다시 읽지 않고 같은 계획을 쓴다(읽기 1번 유지)')
 with pg.expect_download() as dl: pg.locator('[data-mm-act="csv"]').click()
 csv = open(dl.value.path(), encoding='utf-8-sig').read(); ok('"기준"' in csv and '"실행예산 r1"' in csv and '외주 달성률(%)' in csv and '"66.7"' in csv and '"116.7"' in csv, '★ 실제로 내려받은 엑셀 파일에 기준(실행예산 r1)과 비목별 달성률(66.7·116.7)이 들어 있다')
 ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 %s' % errs[:2]); pg.context.close()
 print('── 실행예산을 못 읽어도 화면은 뜨고 알린다')
 pg, errs = fresh(fail_col='gihoek_budgets'); rows = ach_rows(pg); t = ach_text(pg)
 ok(len(rows) == 3 and all('실행예산 r' not in r[0] for r in rows), '★ 읽기가 실패해도 월간 보고서 화면은 정상으로 뜨고 모든 프로젝트가 목표 마진율 기준으로 나온다(%d행)' % len(rows))
 ok('실행예산을 불러오지 못해' in t and '목표 마진율 기준' in t, '★ 그 사실을 표 위에 알린다(조용히 바꾸지 않는다)')
 ok(not errs, '화면 오류 없음 %s' % errs[:2]); pg.context.close()
 print('── 폰 폭(390px)')
 pg, errs = fresh(width=390); w = pg.evaluate('({ sw: document.documentElement.scrollWidth, iw: innerWidth })'); ok(w['sw'] <= w['iw'] + 1, '★ 폰 폭에서 가로로 넘치지 않는다 — %s' % w)
 d = pg.evaluate("(() => { const h = [...document.querySelectorAll('#mm-body h3')].find((x) => x.innerText.includes('원가 달성률')); const t = h.closest('section').querySelector('table'); return { disp: getComputedStyle(t).display, judge: [...t.querySelectorAll('tbody tr')].map((tr) => { const td = tr.querySelector('td[data-label=\"판정\"]'); const r = td.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1; }) }; })()")
 ok(d['disp'] == 'block' and all(d['judge']), '★ 표가 카드로 바뀌고 모든 프로젝트의 판정 칸이 화면 안에 보인다 — %s' % d)
 hh = pg.evaluate("(() => { const e = document.querySelector('[data-ach-cats]'); return e ? Math.round(e.getBoundingClientRect().height) : -1; })()"); ok(hh > 0, '비목별 달성률 작은 글씨가 폰에서도 보인다(높이 %s)' % hh)
 ok(not errs, '화면 오류 없음 %s' % errs[:2]); pg.context.close()
 b.close()
print('\n' + ('전부 통과 (%d건)' % pass_n if not fail_n else '%d건 실패 / 통과 %d' % (fail_n, pass_n))); sys.exit(1 if fail_n else 0)
