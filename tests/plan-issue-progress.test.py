"""청구서 공정 연동 — 견적마다 자기 프로젝트의 섹터 구조로(대기열 1-2-10). 실제 크로미움·실제 화면 코드(plan/index.js mountBilling·issue-view·issue)로 시험하고 서버 접근(core/firebase.js)만 가짜.
노드 시험(plan-issue-progress-multi.test.mjs)이 계산을 증명하고, 이 시험은 화면 연결(견적마다 섹터 드롭다운·추정 섹터)을 증명한다. 공개 저장소라 가짜 값만 쓴다. 이 파일은 파이썬 % 서식을 쓰지 않는다."""
import os, sys, json, subprocess
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'plan-closing.test.py'), encoding='utf-8').read().split('\n')
_end = next(i for i, l in enumerate(_src) if l.startswith('pass_n = fail_n = 0'))
_prefix = '\n'.join(_src[:_end]).replace('mountClosing', 'mountBilling').replace('__file__', repr(os.path.join(_here, 'plan-closing.test.py')))
_ns = {'__name__': 'ipprefix'}
exec(compile(_prefix, 'prefix', 'exec'), _ns)
sync_playwright = _ns['sync_playwright']; BASE = _ns['BASE']; PAGE = _ns['PAGE']
# 실제 공정 프로필(Ph2·Ph4)을 프로젝트 등록 문서의 progressStructure 로 변환 — 노드로 즉석 생성
_gen = r"""
import { PROGRESS_PROFILES } from 'file://__ROOT__/app/shared/pjt-progress-data.js';
import { structureFromProfile } from 'file://__ROOT__/app/shared/pjt-structure.js';
console.log(JSON.stringify({ ph2k: structureFromProfile(PROGRESS_PROFILES.p4ph2), ph4k: structureFromProfile(PROGRESS_PROFILES.p4ph4) }));
""".replace('__ROOT__', os.path.abspath(os.path.join(_here, '..')).replace(os.sep, '/'))
_r = subprocess.run(['node', '--input-type=module', '-e', _gen], capture_output=True, text=True, encoding='utf-8')
if _r.returncode != 0 or not _r.stdout.strip():
    print('SKIP 노드로 공정 구조를 만들지 못함 — ' + _r.stderr[:120]); sys.exit(0)
STRUCT = json.loads(_r.stdout)
DATA = {
  'gihoek_projects': {'q1': {'name': '현장1', 'code': 'A1', 'status': 'run', 'linkPjt': 'ph2k', 'createdAt': {'seconds': 1}}, 'q2': {'name': '현장2', 'code': 'A2', 'status': 'run', 'linkPjt': 'ph4k', 'createdAt': {'seconds': 2}}},
  'gihoek_companies': {'c1': {'company': '원청일', 'roleClient': True, 'contacts': []}, 's1': {'company': '우리회사', 'roleSupplier': True, 'contacts': []}},
  'gihoek_estimates': {
    'A': {'title': '3F FIZ FCU 39대 설치', 'pjtId': 'q1', 'clientId': 'c1', 'status': 'active', 'no': 'E1', 'items': [{'name': '항목', 'qty': 1, 'price': 39000000, 'amount': 39000000}], 'date': '2026-10-01'},
    'B': {'title': '(중공업) #20Core EHU', 'pjtId': 'q2', 'clientId': 'c1', 'status': 'active', 'no': 'E2', 'items': [{'name': '항목', 'qty': 1, 'price': 9000000, 'amount': 9000000}], 'date': '2026-10-02'}},
  'gihoek_settlements': {},
  'pjt_registry': {'ph2k': {'name': 'Ph2', 'progressStructure': STRUCT['ph2k']}, 'ph4k': {'name': 'Ph4', 'progressStructure': STRUCT['ph4k']}}}
FAKE_FB = _ns['FAKE_FB'].replace(json.dumps(_ns['DATA']), json.dumps(DATA), 1)
assert json.dumps(DATA) in FAKE_FB, '가짜 서버 데이터 교체 실패'
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh():
        pg = b.new_page(viewport={'width': 1300, 'height': 1400}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
        pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
        pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
        pg.evaluate("() => { window.__mount(document.getElementById('root'), { segs: ['new', 'q1'], q: {} }, { me: { admin: true, uid: 'u1', name: 'x' } }); }")
        pg.wait_for_function("document.querySelector('[data-is-f=\"recipientId\"]')", timeout=8000); pg.wait_for_timeout(400)
        return pg, errs
    zone_opts = lambda pg, eid: pg.evaluate("(() => { const s = document.querySelector('select[data-is-zone=\"" + eid + "\"]'); return s ? [...s.options].map((o) => o.value + '|' + o.text) : null; })()")
    zone_sel = lambda pg, eid: pg.evaluate("(() => { const s = document.querySelector('select[data-is-zone=\"" + eid + "\"]'); return s ? s.value : null; })()")
    chips = lambda pg: pg.evaluate("[...document.querySelectorAll('[data-is-pjt]')].filter((e) => e.checked).map((e) => e.getAttribute('data-is-pjt'))")
    print('── 공정 연동: 서로 다른 프로젝트의 견적은 각자 자기 프로젝트의 섹터로')
    pg, errs = fresh()
    pg.select_option('[data-is-f="method"]', 'progress'); pg.wait_for_timeout(400)
    ok(chips(pg) == ['q1'], '(전제) 프로젝트 화면에서 q1 으로 열렸으므로 q1 이 선택돼 있다 — ' + str(chips(pg)))
    pg.click('[data-is-pjt="q2"]'); pg.wait_for_timeout(400)
    ok(sorted(chips(pg)) == ['q1', 'q2'], '(전제) 프로젝트 q2 를 더하면 q1·q2 — ' + str(chips(pg)))
    pg.check('[data-is-est="A"]'); pg.wait_for_timeout(400); pg.check('[data-is-est="B"]'); pg.wait_for_timeout(500)
    oa = zone_opts(pg, 'A'); ob = zone_opts(pg, 'B')
    ok(oa is not None and len(oa) == 6 and oa[0].startswith('fiz|3F FIZ'), '★ 견적 A(q1·Ph2)의 섹터 드롭다운은 Ph2 의 6개 섹터(첫째 3F FIZ) — ' + str(oa))
    ok(ob is not None and len(ob) == 4 and ob[0].startswith('core20|'), '★ 견적 B(q2·Ph4)의 섹터 드롭다운은 Ph4 의 4개 섹터(첫째 #20Core) — 대표 프로젝트가 q1 이어도 — ' + str(ob))
    ok(zone_sel(pg, 'A') == 'fiz' and zone_sel(pg, 'B') == 'core20', '★ 추정된 섹터가 각자 맞다(A → fiz, B → core20; 옛 동작은 B 도 fiz) — A ' + str(zone_sel(pg, 'A')) + ' · B ' + str(zone_sel(pg, 'B')))
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(300)
    pg.check('[data-is-dep="A"]'); pg.wait_for_timeout(300); pg.check('[data-is-dep="B"]'); pg.wait_for_timeout(300)
    pg.click('[data-is-act="publish"]'); pg.wait_for_timeout(1800)
    sv = pg.evaluate("window.__saved.filter((s) => s.col === 'gihoek_settlements').map((s) => s.data)")
    d0 = sv[0] if sv else {}
    ok(len(sv) == 1 and d0.get('perEst') == {'A': 3900000, 'B': 900000} and d0.get('supply') == 4800000, '★ 보증금 10% 로 발행하면 견적별 금액이 A 3,900,000 · B 900,000(합계 4,800,000) — ' + str((d0.get('perEst'), d0.get('supply'))))
    specs = [x.get('spec') for x in d0.get('lines', [])]
    ok(len(specs) == 2 and specs[0].startswith('3F FIZ') and '/39' in specs[0] and specs[1].startswith('(중공업) #20Core') and '/3 ' in specs[1], '★ 저장되는 줄에 섹터 이름과 총 대수가 견적마다 자기 프로젝트의 것으로 기록된다(A: 3F FIZ …/39, B: (중공업) #20Core …/3) — 화면의 select 값은 브라우저가 보정하므로 저장된 데이터로 확인 — ' + str(specs))
    ok(d0.get('perPjtAmount') == {'q1': 3900000, 'q2': 900000}, '★ 프로젝트별 금액도 맞다(q1 3,900,000 · q2 900,000) — ' + str(d0.get('perPjtAmount')))
    ok(not errs, '화면 오류·콘솔 오류 없음 ' + str(errs[:2])); pg.close()
    b.close()
FLOOR = 9
if pass_n + fail_n < FLOOR: fail_n += 1; print('FAIL 시험이 끝까지 실행되지 않음(' + str(pass_n + fail_n) + '건 < ' + str(FLOOR) + ')')
print('\n' + ('실패 ' + str(fail_n) + '건 / 통과 ' + str(pass_n) if fail_n else '전부 통과 (' + str(pass_n) + '건)')); sys.exit(1 if fail_n else 0)
