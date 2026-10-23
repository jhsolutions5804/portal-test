"""청구서 공정 연동 — 공정 데이터 불러오기는 견적의 프로젝트마다 그 프로젝트의 공정 체크를 읽는다(대기열 1-2-10). 실제 크로미움·실제 화면 코드로 시험하고 서버 접근(core/firebase.js)만 가짜.
노드 시험(plan-issue-progress-fetch.test.mjs)이 계산 규칙을 증명하고, 이 시험은 화면 연결(프로젝트마다 어느 경로를 읽는지·견적별 진행·저장되는 금액)을 증명한다. 공개 저장소라 가짜 값만 쓴다. 이 파일은 파이썬 % 서식을 쓰지 않는다."""
import os, sys, json
_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, 'plan-issue-progress.test.py'), encoding='utf-8').read().split('\n')
_end = next(i for i, l in enumerate(_src) if l.startswith('pass_n = fail_n = 0'))
_ns = {'__name__': 'ipfprefix', '__file__': os.path.join(_here, 'plan-issue-progress.test.py')}
exec(compile('\n'.join(_src[:_end]), 'prefix', 'exec'), _ns)
sync_playwright = _ns['sync_playwright']; BASE = _ns['BASE']; PAGE = _ns['PAGE']; DATA = _ns['DATA']; FAKE_FB = _ns['FAKE_FB']
# 프로젝트마다 다른 공정 체크 문서(progress_days) — Ph2(ph2k): 설치는 5공정 모두 체크해야 / Ph4(ph4k): 설치는 내진스토퍼 1공정
DATA['pjt_registry/ph2k/progress_days'] = {'2026-10-10': {'groups': {'fiz': {'801_반입': True, '801_내진스토퍼': True, '801_다이크': True, '801_실링': True, '801_동판': True, '801_결선': True, '802_반입': True}}}}
DATA['pjt_registry/ph4k/progress_days'] = {'2026-10-11': {'groups': {'core20': {'EHU_4F10701_반입': True, 'EHU_4F10701_내진스토퍼': True, 'EHU_4F10702_반입': True}}}}
# 가짜 서버: 기존 시험이 만든 FAKE_FB 에서 데이터 부분을 새 DATA(progress_days 추가)로 교체
_base_fb = _ns['FAKE_FB']
_old_json = json.dumps({k: v for k, v in DATA.items() if not k.endswith('/progress_days')})
assert _old_json in _base_fb, '가짜 서버 데이터 모양을 못 찾음'
FAKE_FB = _base_fb.replace(_old_json, json.dumps(DATA), 1)
# 문서 읽기 경로를 기록한다
_gd = "export const getDocs = async (q) => mkSnap(DATA[q.__col]);"
assert _gd in FAKE_FB, 'getDocs 정의를 못 찾음'
FAKE_FB = FAKE_FB.replace(_gd, "window.__reads = window.__reads || []; export const getDocs = async (q) => { window.__reads.push(q.__col); if (window.__failPath && q.__col === window.__failPath) throw new Error('읽기 실패(시험용)'); return mkSnap(DATA[q.__col]); };", 1)
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
    progress_reads = lambda pg: pg.evaluate("(window.__reads || []).filter((c) => /progress_days/.test(c))")
    print('── 공정 데이터 불러오기: 견적의 프로젝트마다 그 프로젝트의 공정 체크를 읽는다')
    pg, errs = fresh()
    pg.select_option('[data-is-f="method"]', 'progress'); pg.wait_for_timeout(300)
    pg.click('[data-is-pjt="q2"]'); pg.wait_for_timeout(400)  # 공정 연동은 프로젝트를 먼저 고르고 그 프로젝트들의 견적을 고른다 — 두 프로젝트(q1·q2)를 선택
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(300)
    pg.check('[data-is-est="A"]'); pg.wait_for_timeout(250); pg.check('[data-is-est="B"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("[...document.querySelectorAll('[data-is-est]')].filter((e) => e.checked).map((e) => e.getAttribute('data-is-est'))") == ['A', 'B'], '(전제) 서로 다른 프로젝트의 견적 A(q1·Ph2)와 B(q2·Ph4)가 함께 선택됨')
    ok(progress_reads(pg) == [], '(전제) 불러오기 전에는 공정 체크를 읽지 않았다')
    pg.click('[data-is-act="fetch-prog"]'); pg.wait_for_timeout(1500)
    rd = progress_reads(pg)
    ok(sorted(rd) == ['pjt_registry/ph2k/progress_days', 'pjt_registry/ph4k/progress_days'], '★ 견적 A 는 Ph2 의 공정 체크(ph2k)를, 견적 B 는 Ph4 의 공정 체크(ph4k)를 각각 읽는다 — 읽은 곳 ' + str(rd))
    ok(len(rd) == 2, '★ 같은 곳을 두 번 읽지 않는다(프로젝트마다 한 번) — ' + str(len(rd)) + '회')
    ok('pjt_registry/none/progress_days' not in rd and 'pjt_registry/auto/progress_days' not in rd, '연동 없음·자동 설정이라는 이름의 컬렉션을 읽으러 가지 않는다')
    txt = pg.inner_text('body')
    ok('반입 2/39' in txt.replace(' ', '') or '반입2/39' in txt.replace(' ', ''), '★ 견적 A(Ph2 3F FIZ 39대)의 화면에 반입 2/39 가 나온다')
    ok('반입 2/3' in txt.replace(' ', '') or '반입2/3' in txt.replace(' ', ''), '★ 견적 B(Ph4 #20Core 3대)의 화면에 반입 2/3 이 나온다(옛 방식에서는 Ph2 의 체크로 읽어 0/3)')
    pg.click('[data-is-act="publish"]'); pg.wait_for_timeout(1800)
    sv = pg.evaluate("window.__saved.filter((s) => s.col === 'gihoek_settlements').map((s) => s.data)")
    d0 = sv[0] if sv else {}
    ok(len(sv) == 1, '발행하면 정산서가 1건 저장된다 — ' + str(len(sv)) + '건')
    ok(d0.get('perEst') == {'A': 1800000, 'B': 5400000}, '★ 저장된 견적별 금액이 손계산과 같다 — A = 39,000,000×0.8×2/39 + ×0.2×1/39 = 1,800,000 · B = 9,000,000×0.8×2/3 + ×0.2×1/3 = 5,400,000 — ' + str(d0.get('perEst')))
    ok(d0.get('perPjtAmount') == {'q1': 1800000, 'q2': 5400000} and d0.get('supply') == 7200000, '★ 프로젝트별 금액 q1 1,800,000 · q2 5,400,000, 합계 7,200,000 — ' + str((d0.get('perPjtAmount'), d0.get('supply'))))
    specs = [(x.get('spec') or '') for x in d0.get('lines', [])]
    ok(len(specs) == 2 and any('3F FIZ' in x and '2/39' in x.replace(' ', '') for x in specs) and any('20Core' in x and '2/3' in x.replace(' ', '') for x in specs), '★ 저장된 줄 두 개가 각 견적의 진행을 담는다(3F FIZ 반입 2/39 · #20Core 반입 2/3) — ' + str(specs))
    ok(not errs, '화면 오류·콘솔 오류 없음 ' + str(errs[:2])); pg.close()
    print('── 한 프로젝트의 공정 체크를 못 읽어도 다른 프로젝트는 정상')
    pg, errs = fresh()
    pg.evaluate("() => { window.__failPath = 'pjt_registry/ph4k/progress_days'; }")
    pg.select_option('[data-is-f="method"]', 'progress'); pg.wait_for_timeout(300)
    pg.click('[data-is-pjt="q2"]'); pg.wait_for_timeout(400)  # 공정 연동은 프로젝트를 먼저 고르고 그 프로젝트들의 견적을 고른다 — 두 프로젝트(q1·q2)를 선택
    pg.select_option('[data-is-f="recipientId"]', 'c1'); pg.wait_for_timeout(300)
    pg.check('[data-is-est="A"]'); pg.wait_for_timeout(250); pg.check('[data-is-est="B"]'); pg.wait_for_timeout(300)
    pg.click('[data-is-act="fetch-prog"]'); pg.wait_for_timeout(1500)
    ok(len(progress_reads(pg)) == 2, '두 프로젝트의 공정 체크를 모두 읽으려 했다 — ' + str(progress_reads(pg)))
    txt2 = pg.inner_text('body').replace(' ', '')
    ok('반입2/39' in txt2, '★ Ph4 의 공정 체크를 못 읽어도 Ph2 의 견적 A 는 정상 계산된다(반입 2/39)')
    ok('반입2/3' not in txt2.replace('반입2/39', ''), '★ 못 읽은 Ph4 의 견적 B 는 진행 0 이다(다른 프로젝트의 체크로 채워지지 않는다 — 옛 방식에서는 Ph2 의 체크로 읽었다)')
    ok('불러오기 실패' not in pg.inner_text('body'), '한 프로젝트를 못 읽어도 "불러오기 실패"로 전체가 멈추지 않는다(그 프로젝트만 0)')
    ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()
    b.close()
FLOOR = 17
if pass_n + fail_n < FLOOR: fail_n += 1; print('FAIL 시험이 끝까지 실행되지 않음(' + str(pass_n + fail_n) + '건 < ' + str(FLOOR) + ')')
print('\n' + ('실패 ' + str(fail_n) + '건 / 통과 ' + str(pass_n) if fail_n else '전부 통과 (' + str(pass_n) + '건)')); sys.exit(1 if fail_n else 0)
