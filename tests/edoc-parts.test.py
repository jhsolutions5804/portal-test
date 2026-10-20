"""전자결재 업무일지 "오늘 참여한 프로젝트" 연결 시험 — 실제 크로미움·실제 화면 코드(edoc/index.js·compose-view.js)로 시험한다.
서버 호출(core/firebase.js)만 가짜로 바꾸고, 호출을 이름·인자와 함께 시간순으로 기록해 "무엇이 어떤 순서로 몇 번 나갔는지"를 확인한다(문서 저장 → 참여 기록 저장 → 상신 순서가 핵심).
공개 저장소이므로 가짜 데이터만 쓴다(실제 이름·금액 없음). 크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os, json
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
VER = open(os.path.join(ROOT, 'modules', 'edoc', 'index.js'), encoding='utf-8').read().split('api.js?v=')[1].split("'")[0]
DATA = {
  'portal_users': {'u1': {'name': '가짜작성자', 'rank': '대리', 'dept': 'PJT팀', 'empNo': '0101', 'status': 'approved'}, 'u2': {'name': '가짜결재자', 'rank': '팀장', 'dept': 'PJT팀', 'empNo': '0100', 'status': 'approved'}},
  'edoc_settings': {'policy': {'required': [], 'proxy': []}, 'guides': {}, 'vehicles': {'list': []}, 'company': {'name': '가짜회사'}},
  'gihoek_projects': {'pa': {'name': '프로젝트A', 'code': 'C1', 'status': 'run'}, 'pb': {'name': '프로젝트B', 'code': '', 'status': 'run'}, 'pc': {'name': '프로젝트C', 'code': '', 'status': 'run'}},
}
FAKE_FB = """
const DATA = %s; window.__log = []; window.__calls = []; window.__docs = {};
export const db = {}; export const auth = {}; export const storage = {}; export const functions = {};
export const collection = (d, n) => ({ __col: n }); export const doc = (d, a, b) => ({ __col: a, __id: b });
export const query = (c) => c; export const orderBy = () => ({}); export const limit = () => ({}); export const where = () => ({});
const mkSnap = (o) => { const docs = Object.entries(o || {}).map(([id, v]) => ({ id, data: () => JSON.parse(JSON.stringify(v)), exists: () => true })); return { docs, size: docs.length, forEach: (f) => docs.forEach(f), empty: !docs.length }; };
export const getDocs = async (q) => mkSnap(DATA[q.__col]);
export const getDoc = async (r) => { let v = (DATA[r.__col] || {})[r.__id]; if (r.__col === 'edoc_settings' && r.__id === 'parts') v = window.__parts; if (r.__col.startsWith('edoc_') && r.__col !== 'edoc_settings') v = window.__docs[r.__col + '/' + r.__id]; return { exists: () => v !== undefined, data: () => v === undefined ? undefined : JSON.parse(JSON.stringify(v)), id: r.__id }; };
let seq = 0;
export const addDoc = async (c, v) => { const id = 'd' + (++seq); window.__docs[c.__col + '/' + id] = JSON.parse(JSON.stringify(Object.assign({}, v, { createdAt: 1 }))); window.__log.push({ k: 'addDoc', col: c.__col, id, data: JSON.parse(JSON.stringify(v)) }); return { id }; };
export const updateDoc = async (r, v) => { window.__log.push({ k: 'updateDoc', col: r.__col, id: r.__id, data: JSON.parse(JSON.stringify(v)) }); };
export const httpsCallable = (f, name) => async (p) => {
  const delay = (window.__delay && window.__delay[name + ':' + p.action]) || 0; if (delay) await new Promise((r) => setTimeout(r, typeof delay === 'function' ? delay(p) : delay));
  window.__log.push({ k: 'call', fn: name, action: p.action, p: JSON.parse(JSON.stringify(p)) }); window.__calls.push({ fn: name, p: JSON.parse(JSON.stringify(p)) });
  const fk = name + ':' + p.action; if (window.__fail && window.__fail[fk]) throw Object.assign(new Error(window.__fail[fk]), { code: 'failed-precondition' });
  if (name === 'pjtPartAct') {
    if (p.action === 'preview') { const ids = p.projects; const lab = window.__labor || {}; const w = ids.map((i) => lab[i] || 0); const allPos = w.every((x) => x > 0); if (ids.length === 1) return { data: { ok: true, date: p.date, projects: [{ pjt: ids[0], bp: 10000 }], basis: 'single' } }; if (allPos) { const sum = w.reduce((a, b) => a + b, 0); return { data: { ok: true, date: p.date, projects: ids.map((i, k) => ({ pjt: i, bp: Math.round(10000 * w[k] / sum) })), basis: 'manday' } }; } return { data: { ok: true, date: p.date, projects: ids.map((i) => ({ pjt: i, bp: Math.round(10000 / ids.length) })), basis: 'equal' } }; }
    if (p.action === 'save') return { data: { ok: true, date: p.date, projects: p.projects.map((x) => ({ pjt: x.pjt, bp: 0 })), basis: 'x' } };
    if (p.action === 'get') return { data: { ok: true, record: window.__record || null } };
  }
  return { data: { ok: true } };
};
export const onAuthStateChanged = () => {}; export const serverTimestamp = () => 0; export const setDoc = async () => {}; export const deleteDoc = async () => {};
export const storageRef = () => ({}); export const uploadBytesResumable = () => ({}); export const getDownloadURL = async () => ''; export const deleteObject = async () => {};
""" % json.dumps(DATA)
PAGE = """<!doctype html><meta charset=utf-8><link rel=stylesheet href="%(b)s/theme/tokens.css"><link rel=stylesheet href="%(b)s/theme/base.css"><link rel=stylesheet href="%(b)s/theme/components.css"><link rel=stylesheet href="%(b)s/theme/edoc.css"><div id=root></div>
<script type=module>import { mount } from "%(b)s/modules/edoc/index.js?v=%(v)s"; window.__mount = mount; window.__ready = true;</script>""" % {'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK   ' + m)
    else: fail_n += 1; print('FAIL ' + m)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        def fresh(parts_on, route=None, record=None, labor=None, fail=None, delay=None):
            pg = b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
            pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
            pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true', timeout=20000)
            pg.evaluate("([on, rec, lab, fl, dl]) => { window.__parts = on ? { enabled: true } : undefined; window.__record = rec; window.__labor = lab || {}; window.__fail = fl || {}; window.__delay = dl || {}; }", [parts_on, record, labor, fail, delay])
            pg.evaluate("(r) => window.__mount(document.getElementById('root'), r, { me: { uid: 'u1', name: '가짜작성자', rank: '대리', dept: 'PJT팀', admin: false } })", route or {'segs': ['new', 'daily'], 'q': {}})
            return pg, errs
        log = lambda pg: pg.evaluate('window.__log')
        calls = lambda pg, fn=None: [c for c in pg.evaluate('window.__calls') if fn is None or c['fn'] == fn]
        part = lambda pg: [c['p'] for c in calls(pg, 'pjtPartAct')]
        def open_compose(pg):
            pg.wait_for_selector('[data-compose="daily"]', timeout=15000); pg.wait_for_timeout(200)
        def pick_main(pg, pid):
            pg.locator('[data-input="pjtId"]').select_option(pid); pg.wait_for_timeout(250)
        def add_approver(pg):   # 실제 사용자 흐름 그대로: 결재선 검색 → 후보 선택 → 결재자로 추가(업무일지는 결재자가 한 명 이상 필요)
            pg.locator('[data-line-search]').fill('가짜결재자'); pg.wait_for_selector('[data-pick="u2"]', timeout=5000); pg.locator('[data-pick="u2"]').click(); pg.locator('[data-add="approver"]').click(); pg.wait_for_timeout(300)
        def fill_text(pg):
            pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); pg.locator('[data-input="date"]').fill('2026-10-16') if pg.locator('[data-input="date"]').count() else None
        print('── 스위치 꺼짐: 지금 쓰는 업무일지는 그대로')
        pg, errs = fresh(False); open_compose(pg)
        ok(pg.locator('#edoc-parts').count() == 0 and pg.locator('[data-part]').count() == 0, '★ 스위치가 꺼져 있으면 업무일지 양식에 참여 칩이 없다')
        pick_main(pg, 'pa'); ok(len(part(pg)) == 0, '★ 꺼져 있으면 프로젝트를 골라도 참여 기록 서버 호출이 0건이다')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 스위치 켜짐: 칩·미리보기')
        pg, errs = fresh(True); open_compose(pg)
        ok(pg.locator('#edoc-parts').count() == 1 and pg.locator('[data-part]').count() == 4, '★ 켜져 있으면 칩이 4개(프로젝트 A·B·C + 공통)다')
        ok(pg.locator('[data-part][aria-pressed="true"]').count() == 0 and len(part(pg)) == 0, '처음에는 선택된 칩이 없고 서버 호출도 없다')
        pick_main(pg, 'pa')
        ok(pg.locator('[data-part="pa"][aria-pressed="true"]').count() == 1 and pg.locator('[data-part][aria-pressed="true"]').count() == 1 and len(part(pg)) == 0, '★ 위쪽 프로젝트 A 를 고르면 A 칩이 자동으로 선택되고(하나뿐이라) 서버 호출은 0건이다')
        pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(500)
        pv = [x for x in part(pg) if x['action'] == 'preview']
        ok(len(pv) == 1 and pv[0]['projects'] == ['pa', 'pb'], '★ 칩 B 를 더하면 서버 preview 가 정확히 1건 나가고 프로젝트는 [pa, pb] 이다 (실제: %s)' % pv)
        ok('50%' in pg.inner_text('[data-parts-ratio]') and '균등' in pg.inner_text('[data-parts-ratio]'), '★ 일용직 공수가 없으면 균등 50%·50%와 근거가 보인다')
        pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(400)
        ok(pg.locator('[data-parts-ratio]').count() == 0 and pg.locator('[data-part="pa"][aria-pressed="true"]').count() == 1, '칩 B 를 다시 누르면 꺼지고 비율 줄이 사라진다')
        pg.locator('[data-part="common"]').click(); pg.wait_for_timeout(300)
        ok(pg.locator('[data-part][aria-pressed="true"]').count() == 1 and pg.locator('[data-part="common"][aria-pressed="true"]').count() == 1, '★ "공통"을 누르면 공통만 선택된다(단독)')
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 일용직 공수 비율 표시')
        pg, errs = fresh(True, labor={'pa': 10, 'pb': 30}); open_compose(pg); pick_main(pg, 'pa'); pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(500)
        ok('25%' in pg.inner_text('[data-parts-ratio]') and '75%' in pg.inner_text('[data-parts-ratio]') and '일용직 공수 비율로 나눴습니다' in pg.inner_text('[data-parts-ratio]'), '★ 서버가 공수 비율(A 10 : B 30)을 계산해 주면 25%·75%와 "일용직 공수 비율로 나눴습니다"가 보인다'); pg.close()
        print('── 위쪽 프로젝트 변경')
        pg, errs = fresh(True); open_compose(pg); pick_main(pg, 'pa'); pick_main(pg, 'pb')
        ok(pg.locator('[data-part="pb"][aria-pressed="true"]').count() == 1 and pg.locator('[data-part="pa"][aria-pressed="true"]').count() == 0, '★ 위쪽 프로젝트를 A → B 로 바꾸면 칩도 B 로 따라간다'); pg.close()
        print('── 빠른 연속 클릭: 늦게 온 응답이 최신 선택을 덮지 않는다')
        pg, errs = fresh(True); open_compose(pg)
        pg.evaluate("() => { window.__delay['pjtPartAct:preview'] = (p) => (p && p.projects && p.projects.length === 2 ? 700 : 50); }")
        pick_main(pg, 'pa'); pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(100); pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(1200)
        ok(pg.locator('[data-parts-ratio]').count() == 0 and pg.locator('[data-part="pb"][aria-pressed="true"]').count() == 0, '★ B 를 켰다가 바로 끄면(첫 미리보기 응답이 700ms 늦게 도착해도) 지난 응답이 화면에 비율 줄을 되살리지 않는다'); pg.close()
        print('── 응답 경쟁: 옛 응답이 늦게 도착해도 최신 선택의 비율을 덮지 않는다(두 응답이 서로 다른 내용)')
        pg, errs = fresh(True, labor={'pa': 10, 'pb': 30}); open_compose(pg)
        pg.evaluate("() => { window.__delay['pjtPartAct:preview'] = (p) => (p && p.projects && p.projects.indexOf('pb') !== -1 ? 900 : 50); }")
        pick_main(pg, 'pa'); pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(150)
        pg.locator('[data-part="pb"]').click(); pg.locator('[data-part="pc"]').click(); pg.wait_for_timeout(1500)
        txt = pg.inner_text('[data-parts-ratio]') if pg.locator('[data-parts-ratio]').count() else ''
        ok('25%' not in txt and '75%' not in txt and '50%' in txt, '★ [A·B](공수 비율 25·75, 응답 900ms 지연)를 [A·C](균등 50·50, 응답 50ms)로 바꾸면 늦게 온 옛 응답이 화면을 덮지 않고 최신 선택의 비율(50퍼센트)이 남는다 (화면: ' + txt.replace('\n', ' ') + ')'); pg.close()
        print('── 상신 검증')
        pg, errs = fresh(True); open_compose(pg); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); pg.locator('[data-act="submit"]').click(); pg.wait_for_timeout(400)
        ok(pg.locator('#edoc-parts [data-invalid="true"]').count() + pg.locator('[data-parts][data-invalid="true"]').count() >= 1, '★ 프로젝트를 안 고르고 상신하면 오류가 표시된다')
        lg = log(pg); ok(not [x for x in lg if x['k'] in ('addDoc', 'updateDoc')] and not [x for x in lg if x['k'] == 'call' and x['fn'] == 'edocAct'], '★ 그때는 문서 저장도 상신도 서버로 나가지 않는다'); pg.close()
        print('── 직접 비율')
        pg, errs = fresh(True); open_compose(pg); pick_main(pg, 'pa'); pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(400); pg.locator('[data-parts-custom]').click(); pg.wait_for_timeout(200)
        ok(pg.locator('[data-parts-ratio-input]').count() == 2 and pg.locator('[data-parts-ratio-input="pa"]').input_value() == '50', '★ 직접 입력을 켜면 칸이 둘 생기고 서버가 준 기본 비율(50)로 채워진다')
        pg.locator('[data-parts-ratio-input="pa"]').fill('70'); pg.locator('[data-parts-ratio-input="pb"]').fill('20'); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); pg.locator('[data-act="submit"]').click(); pg.wait_for_timeout(400)
        ok('100' in pg.inner_text('#edoc-parts') and not [x for x in log(pg) if x['k'] in ('addDoc', 'updateDoc')], '★ 합이 90% 면 상신이 막히고 이유("100")가 보이며 문서 저장은 나가지 않는다')
        pg.locator('[data-parts-ratio-input="pb"]').fill('30'); add_approver(pg); pg.locator('[data-act="submit"]').click(); pg.wait_for_timeout(900)
        sv = [x for x in part(pg) if x['action'] == 'save']
        ok(len(sv) == 1 and sv[0]['projects'] == [{'pjt': 'pa', 'ratio': 70}, {'pjt': 'pb', 'ratio': 30}], '★ 합이 100 이 되면 save 가 직접 비율(70·30)과 함께 정확히 1건 나간다 (실제: %s)' % sv); pg.close()
        print('── 정상 상신: 문서 저장 → 참여 기록 저장 → 상신 순서')
        pg, errs = fresh(True); open_compose(pg); pick_main(pg, 'pa'); pg.locator('[data-part="pb"]').click(); pg.wait_for_timeout(400); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); add_approver(pg); pg.locator('[data-act="submit"]').click(); pg.wait_for_timeout(1200)
        lg = log(pg); seqk = [(x['k'] if x['k'] != 'call' else x['fn'] + ':' + x['action']) for x in lg if x['k'] in ('addDoc', 'updateDoc') or (x['k'] == 'call' and x['action'] in ('save', 'submit'))]
        ok(seqk == ['addDoc', 'pjtPartAct:save', 'edocAct:submit'], '★ 순서는 문서 저장 → 참여 기록 저장 → 상신이다 (실제: %s)' % seqk)
        sv = [x for x in part(pg) if x['action'] == 'save']; ok(len(sv) == 1 and sv[0]['date'] == pg.locator('[data-input="date"]').input_value() and sv[0]['projects'] == [{'pjt': 'pa'}, {'pjt': 'pb'}], '★ save 본문: 업무일지 작성일과 프로젝트 [pa, pb](직접 비율을 안 썼으니 ratio 없음 — 서버가 계산) (실제: %s)' % sv)
        ad = [x for x in lg if x['k'] == 'addDoc'][0]['data']; ok('parts' not in ad and 'pb' not in json.dumps(ad, ensure_ascii=False).replace('pjtId', ''), '★ 문서 본문(addDoc)에 참여 칩이 섞이지 않는다(승인되면 잠기는 문서와 별도 기록) — 본문 키: %s' % sorted(ad.keys())[:8])
        ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2]); pg.close()
        print('── 처리 중에는 칩이 바뀌지 않는다(화면 disabled 를 억지로 풀어 컨트롤러 가드만 확인)')
        pg, errs = fresh(True, delay={}); open_compose(pg)
        pg.evaluate("() => { window.__delay['pjtPartAct:save'] = 900; }")
        pick_main(pg, 'pa'); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); add_approver(pg); pg.locator('[data-act="submit"]').click(); pg.wait_for_timeout(250)
        before = len(part(pg)); pg.evaluate("() => { const c = document.querySelector('[data-part=pb]'); c.disabled = false; c.click(); }"); pg.wait_for_timeout(300)
        ok(pg.locator('[data-part="pb"][aria-pressed="true"]').count() == 0 and len([x for x in part(pg) if x['action'] == 'preview']) == 0, '★ 저장·상신이 진행되는 동안(처리 중)에는 칩을 눌러도 선택이 바뀌지 않고 새 미리보기도 나가지 않는다(컨트롤러 가드, 화면 disabled 를 풀어도)')
        pg.wait_for_timeout(1500); pg.close()
        print('── 참여 기록 저장 실패')
        pg, errs = fresh(True, fail={'pjtPartAct:save': '40일이 지난 날짜는 관리자만 정정할 수 있습니다(시험 거부 사유)'}); open_compose(pg); pick_main(pg, 'pa'); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); add_approver(pg); pg.locator('[data-act="submit"]').click(); pg.wait_for_timeout(1000)
        lg = log(pg); ok(not [x for x in lg if x['k'] == 'call' and x['fn'] == 'edocAct' and x['action'] == 'submit'], '★ 참여 기록 저장이 실패하면 상신하지 않는다')
        ok(len([x for x in lg if x['k'] == 'addDoc']) == 1, '문서는 임시저장되어 있다(addDoc 1건)')
        ok('시험 거부 사유' in pg.inner_text('#edoc-form-error') and '상신하지 않았습니다' in pg.inner_text('#edoc-form-error'), '★ 서버가 준 이유와 "상신하지 않았습니다"가 보인다')
        ok(pg.locator('[data-act="submit"]').is_enabled(), '실패 뒤 다시 시도할 수 있다(상신 버튼이 다시 활성)'); pg.close()
        print('── 임시저장')
        pg, errs = fresh(True); open_compose(pg); pick_main(pg, 'pa'); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); pg.locator('[data-act="save"]').click(); pg.wait_for_timeout(900)
        sv = [x for x in part(pg) if x['action'] == 'save']; ok(len(sv) == 1 and len([x for x in log(pg) if x['k'] == 'addDoc']) == 1, '★ 임시저장은 문서를 저장하고 참여 기록도 저장한다(칩이 있으므로)'); pg.close()
        pg, errs = fresh(True, fail={'pjtPartAct:save': '서버 점검 중(시험)'}); open_compose(pg); pick_main(pg, 'pa'); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); pg.locator('[data-act="save"]').click(); pg.wait_for_timeout(1000)
        ok(len([x for x in log(pg) if x['k'] == 'addDoc']) == 1 and not [x for x in log(pg) if x['k'] == 'call' and x['fn'] == 'edocAct'], '★ 임시저장은 참여 기록 저장이 실패해도 문서 저장은 유지된다(상신 호출 없음)'); pg.close()
        pg, errs = fresh(True); open_compose(pg); pg.locator('[data-input="todayWork"]').fill('가짜 금일 업무'); pg.locator('[data-input="pjtId"]').select_option('pa'); pg.locator('[data-part="pa"]').click(); pg.wait_for_timeout(200)
        pg.locator('[data-act="save"]').click(); pg.wait_for_timeout(800)
        ok(len(part(pg)) == 0 and len([x for x in log(pg) if x['k'] == 'addDoc']) == 1, '★ 칩이 하나도 없으면 임시저장은 참여 기록을 보내지 않는다(문서만 저장, 빈 기록을 만들지 않음)'); pg.close()
        print('── 기존 문서 다시 열기')
        DOCS = {'edoc_daily/dx': {'dtype': 'daily', 'status': 'draft', 'authorUid': 'u1', 'authorName': '가짜작성자', 'date': '2026-10-16', 'pjtId': 'pa', 'pjtCode': 'C1', 'pjtName': '프로젝트A', 'todayWork': '가짜 금일 업무', 'tomorrowWork': '', 'issue': '', 'approvalLine': [], 'attachments': [], 'title': '가짜'}}
        pg, errs = fresh(True, route={'segs': ['edit', 'daily', 'dx'], 'q': {}}, record={'date': '2026-10-16', 'projects': [{'pjt': 'pa', 'bp': 5000}, {'pjt': 'pb', 'bp': 5000}], 'basis': 'equal'})
        pg.evaluate("(d) => { Object.assign(window.__docs, d); }", DOCS)
        pg.evaluate("(r) => window.__mount(document.getElementById('root'), r, { me: { uid: 'u1', name: '가짜작성자', rank: '대리', dept: 'PJT팀', admin: false } })", {'segs': ['edit', 'daily', 'dx'], 'q': {}})
        pg.wait_for_selector('[data-compose="daily"]', timeout=15000); pg.wait_for_timeout(500)
        gt = [x for x in part(pg) if x['action'] == 'get']
        ok(len(gt) >= 1 and gt[-1]['date'] == '2026-10-16', '★ 기존 문서를 열면 서버 get 으로 그날의 참여 기록을 불러온다 (호출: %s)' % gt)
        ok(pg.locator('[data-part="pa"][aria-pressed="true"]').count() == 1 and pg.locator('[data-part="pb"][aria-pressed="true"]').count() == 1, '★ 불러온 기록(pa·pb)대로 칩이 선택돼 있다 — 수정할 때 칩이 비어 기록을 덮어쓰는 일이 없다'); pg.close()
        b.close()
    print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
except Exception as e:
    import traceback; fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %s' % repr(e)[:300]); traceback.print_exc(); print('\n실패 %d건 / 통과 %d' % (fail_n, pass_n)); sys.exit(1)
