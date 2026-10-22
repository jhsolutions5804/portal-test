"""프로젝트 마감 체크리스트(대기열 1-2-8 5단계 마지막, 설계 §3-4) — 실제 크로미움·실제 컨트롤러(pjt/index.js mountMonthly)·실제 화면 코드로 시험한다.
서버 접근(core/firebase.js)만 가짜이고, 서버 함수(monthlyReportAct)는 페이지 안의 가짜(window.__ck)가 저장·검증·실패를 흉내 낸다 — 클릭 → 서버 호출 → 화면 갱신이 실제로 이어지는지(문자열 시험으로는 못 잡는 연결)를 본다.
공개 저장소이므로 가짜 값만 쓴다. 항목 이름은 코드에 없다(여기 이름은 예시). 크로미움이 없으면 건너뛴다. 이 파일은 파이썬 % 서식을 쓰지 않는다."""
import os, sys, re, json, datetime
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pjt-report-tolog.test.py'), encoding='utf-8').read().split('\n')
_end = next(i for i, l in enumerate(_src) if l.startswith('CALLM = '))
_prefix = '\n'.join(_src[:_end]).replace('mountReport', 'mountMonthly').replace('__file__', repr(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pjt-report-tolog.test.py'))))
_ns = {'__name__': 'ckprefix'}
exec(compile(_prefix, 'prefix', 'exec'), _ns)
sync_playwright = _ns['sync_playwright']; b_launch = None; BASE = _ns['BASE']; FAKE_FB = _ns['FAKE_FB']; PAGE = _ns['PAGE']
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
TODAY = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
# 페이지 안 가짜 서버: list·get·closeoutGet·closeoutSave·generate. 호출을 모두 기록하고 저장 내용을 보관한다. failNext 로 다음 저장을 실패시킨다.
SERVER = """(init) => {
  window.__ck = { calls: [], items: init.items || [], version: init.version || 0, seq: init.seq || 0, failNext: null, canEdit: init.canEdit !== false, report: init.report || null };
  window.__callM = async (p) => {
    const S = window.__ck; S.calls.push(JSON.parse(JSON.stringify(p)));
    if (p.action === 'list') return { ok: true, months: [], canEdit: S.canEdit };
    if (p.action === 'get') return S.report ? { ok: true, exists: true, report: S.report, canEdit: S.canEdit } : { ok: true, exists: false, canEdit: S.canEdit };
    if (p.action === 'closeoutGet') return { ok: true, items: S.items, version: S.version, updatedByName: S.version ? '팀장' : '', canEdit: S.canEdit };
    if (p.action === 'closeoutSave') {
      if (S.failNext) { const e = new Error(S.failNext.message); e.code = S.failNext.code; S.failNext = null; throw e; }
      const used = new Set(); let seq = S.seq; const out = p.items.map((i) => { let id = i.id; if (!/^c[0-9]+$/.test(id) || used.has(id)) id = ''; if (id) { used.add(id); seq = Math.max(seq, Number(id.slice(1))); } return Object.assign({}, i, { id }); });
      out.forEach((i) => { if (!i.id) { seq += 1; i.id = 'c' + seq; } }); S.seq = seq; S.items = out; S.version += 1; return { ok: true, items: out, version: S.version, updatedByName: '팀장', canEdit: true };
    }
    throw new Error('모르는 동작 ' + p.action);
  };
}"""
def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        def fresh(init=None, me=None, proj='p1', width=1300):
            pg = b.new_page(viewport={'width': width, 'height': 1000}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
            pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
            pg.route('**/*.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
            pg.goto(BASE + '/x.html'); pg.wait_for_function('window.__ready === true')
            pg.evaluate(SERVER, init or {})
            who = me or {'admin': True, 'uid': 'u1', 'name': '테스터'}
            pg.evaluate("([w, pj]) => { window.__mount(document.getElementById('root'), { segs: [pj], q: {} }, { me: w, callMonthly: window.__callM }); }", [who, proj])
            pg.wait_for_function("document.querySelector('#mr-body') && !document.querySelector('#mr-body').hasAttribute('aria-busy') && document.querySelector('.jh-pjt__mr')", timeout=8000)
            pg.wait_for_timeout(250)
            return pg, errs
        def calls(pg, action=None):
            c = pg.evaluate('window.__ck.calls'); return [x for x in c if action is None or x['action'] == action]
        def rows(pg): return pg.evaluate("[...document.querySelectorAll('[data-ck-row]')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value))")
        def ckcard_text(pg): return pg.evaluate("(() => { const h = [...document.querySelectorAll('#mr-body h3')].find((x) => x.innerText.trim() === '마감 체크리스트'); return h ? h.closest('section').innerText : ''; })()")
        def save_disabled(pg): return pg.evaluate("(() => { const b = document.querySelector('[data-ck-save]'); return b ? b.disabled : null; })()")
        def settle(pg, ms=200): pg.wait_for_timeout(ms)

        print('── 권한자: 열면 체크리스트를 한 번 읽고, 비어 있으면 이름 입력 칸')
        pg, errs = fresh()
        ok([x['action'] for x in calls(pg)] == ['list', 'get', 'closeoutGet'], '★ 열 때 서버 호출 순서: list → get → closeoutGet 한 번씩 — ' + str([x['action'] for x in calls(pg)]))
        ok(pg.query_selector('[data-ck-names]') is not None and pg.query_selector('[data-ck-row]') is None and '마감 체크리스트' in ckcard_text(pg), '★ 체크리스트가 비어 있으면 "한 줄에 하나씩" 이름 입력 칸과 [항목 만들기]가 보인다(이름은 코드에 없다)')
        pg.evaluate("(() => { const t = document.querySelector('[data-ck-names]'); t.value = '시공검측\\n시운전\\n\\n완성검사 \\n턴 온\\n시운전'; t.dispatchEvent(new Event('input', { bubbles: true })); })()")
        pg.click('[data-ck-seed]'); settle(pg)
        ok([r[0] for r in rows(pg)] == ['시공검측', '시운전', '완성검사', '턴 온'], '★ [항목 만들기]: 빈 줄·공백·중복(시운전)을 정리해 4개 행 — ' + str([r[0] for r in rows(pg)]))
        ok(len(calls(pg, 'closeoutSave')) == 0 and save_disabled(pg) is False, '★ 만들기만으로는 서버에 저장하지 않고(저장 호출 0) 저장 버튼이 눌린다')

        print('── 편집: 오늘·순서·삭제·추가')
        pg.click('[data-ck-today="0"]'); settle(pg)
        ok(rows(pg)[0][1] == TODAY, '★ [오늘]을 누르면 첫 항목 완료일이 오늘(한국 시간 ' + TODAY + ')')
        pg.click('[data-ck-down="0"]'); settle(pg)
        ok([r[0] for r in rows(pg)] == ['시운전', '시공검측', '완성검사', '턴 온'] and rows(pg)[1][1] == TODAY, '★ [↓]: 첫 항목이 둘째로 내려가고 완료일도 함께 따라간다')
        ok(pg.evaluate("document.querySelector('[data-ck-up=\"0\"]').disabled") is True and pg.evaluate("document.querySelector('[data-ck-down=\"3\"]').disabled") is True, '맨 위 ↑·맨 아래 ↓ 는 비활성')
        pg.click('[data-ck-del="2"]'); settle(pg)
        ok([r[0] for r in rows(pg)] == ['시운전', '시공검측', '턴 온'], '[삭제]: 완성검사 행이 빠진다')
        pg.click('[data-ck-add]'); settle(pg)
        ok(len(rows(pg)) == 4 and rows(pg)[3][0] == '', '[항목 추가]: 빈 행이 맨 아래에 생긴다')
        ok(save_disabled(pg) is True, '★ 이름이 빈 행이 있으면 저장 버튼이 비활성(서버가 막기 전에 알려 줌)')
        ok('이름' in pg.evaluate("document.querySelector('[data-ck-hint]').innerText") and not pg.evaluate("document.querySelector('[data-ck-hint]').hidden"), '안내 줄에 "이름" 문구가 보인다')
        pg.fill('[data-ck-f="name"][data-ck-i="3"]', '인수인계'); settle(pg)
        ok(save_disabled(pg) is False and pg.evaluate("document.querySelector('[data-ck-hint]').hidden") is True, '★ 이름을 적으면 안내가 사라지고 저장 버튼이 눌린다(다시 그리지 않고 갱신)')
        pg.fill('[data-ck-f="memo"][data-ck-i="0"]', '지적 3건 보완'); settle(pg)
        ok(pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-ck-f')") == 'memo', '★ 입력 중에 화면을 다시 그리지 않아 커서(포커스)가 유지된다')

        print('── 저장: 한 번만 보내고, 서버 응답으로 번호가 붙는다')
        pg.click('[data-ck-save]'); pg.click('[data-ck-save]', force=True); settle(pg, 400)
        sv = calls(pg, 'closeoutSave')
        ok(len(sv) == 1, '★ 저장 요청은 한 번만(연타해도) — ' + str(len(sv)))
        ok([i['name'] for i in sv[0]['items']] == ['시운전', '시공검측', '턴 온', '인수인계'] and sv[0]['items'][1]['doneDate'] == TODAY and sv[0]['items'][1]['memo'] == '' and sv[0]['items'][0]['memo'] == '지적 3건 보완', '★ 보낸 내용: 이름·완료일·메모가 화면 그대로(순서 포함) — ' + json.dumps(sv[0]['items'], ensure_ascii=False)[:160])
        ok(set(sv[0].keys()) == {'action', 'pjtId', 'items'} and all(set(i.keys()) == {'id', 'name', 'doneDate', 'assignee', 'memo'} for i in sv[0]['items']) and all(i['id'] == '' for i in sv[0]['items']), '★ 요청에는 정해진 필드만(숫자·uid 없음), 새 항목은 번호 빈 글자(서버가 붙임)')
        ok(pg.evaluate("window.__ck.items.map((i) => i.id)") == ['c1', 'c2', 'c3', 'c4'] and save_disabled(pg) is True, '서버가 번호 c1~c4 를 붙였고 저장 직후엔 저장 버튼이 비활성(변경 없음)')
        ok('저장했습니다' in pg.inner_text('#mr-body') and '다시 만들기' in pg.inner_text('#mr-body'), '★ 저장 안내: 이미 만든 보고서에 반영하려면 "다시 만들기"')
        ok(len(calls(pg, 'closeoutGet')) == 1, '저장해도 체크리스트를 다시 읽지 않는다(응답으로 갱신)')
        ok(not errs, '시험 중 화면 오류·콘솔 오류 없음 ' + str(errs[:2])); pg.close()

        print('── 저장 실패: 초안을 지우지 않고 한글 안내')
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '', 'memo': ''}], 'version': 1, 'seq': 1})
        ok(len(rows(pg)) == 1 and rows(pg)[0][0] == '시공검측', '저장된 항목이 행으로 나온다')
        pg.fill('[data-ck-f="name"][data-ck-i="0"]', '시공검측 수정'); pg.evaluate("window.__ck.failNext = { code: 'functions/permission-denied', message: '마감 체크리스트는 PJT 권한자·관리자만 저장할 수 있습니다.' }")
        pg.click('[data-ck-save]'); settle(pg, 300)
        ok('권한자' in pg.inner_text('#mr-body') and rows(pg)[0][0] == '시공검측 수정', '★ 서버가 거절하면 한글 안내가 보이고 적던 내용(초안)은 그대로 남는다')
        ok(save_disabled(pg) is False, '실패 뒤에도 다시 저장할 수 있다(처리 중 상태가 풀린다)')
        pg.click('[data-ck-save]'); settle(pg, 300)
        ok(len(calls(pg, 'closeoutSave')) == 2 and pg.evaluate("window.__ck.items[0].name") == '시공검측 수정', '다시 누르면 저장된다')
        pg.close()

        print('── 서버가 준 항목에 모르는 필드가 섞여 있어도 저장 요청에는 정해진 필드만')
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '', 'memo': '', 'uid': 'u9', 'amount': 5000000}], 'version': 1, 'seq': 1})
        pg.fill('[data-ck-f="name"][data-ck-i="0"]', '시공검측 수정'); pg.click('[data-ck-save]'); settle(pg, 300)
        sv = calls(pg, 'closeoutSave')
        ok(len(sv) == 1 and set(sv[0]['items'][0].keys()) == {'id', 'name', 'doneDate', 'assignee', 'memo'} and 'u9' not in json.dumps(sv[0]) and '5000000' not in json.dumps(sv[0]), '★ 서버가 준 항목에 uid·금액 같은 모르는 필드가 있어도 되돌려 보내지 않는다 — ' + json.dumps(sv[0] if sv else {}, ensure_ascii=False)[:140])
        pg.close()

        print('── 금액·연락처·오늘 이후 날짜는 서버에 보내기 전에 막는다')
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '', 'memo': ''}], 'version': 1, 'seq': 1})
        pg.fill('[data-ck-f="memo"][data-ck-i="0"]', '단가 3만원 인상'); settle(pg)
        ok(save_disabled(pg) is True and '금액' in pg.evaluate("document.querySelector('[data-ck-hint]').innerText"), '★ 메모에 금액을 적으면 안내가 뜨고 저장이 막힌다')
        pg.fill('[data-ck-f="memo"][data-ck-i="0"]', '연락 010-1111-2222'); settle(pg)
        ok(save_disabled(pg) is True and '전화번호' in pg.evaluate("document.querySelector('[data-ck-hint]').innerText"), '전화번호도 막는다')
        pg.fill('[data-ck-f="memo"][data-ck-i="0"]', ''); settle(pg)
        ok(save_disabled(pg) is True, '원래대로 돌아오면(변경 없음) 저장 버튼 비활성')
        ok(pg.eval_on_selector('[data-ck-f="doneDate"]', 'e => e.max') == TODAY, '★ 완료일 입력칸의 최댓값이 오늘이라 달력에서도 오늘 이후를 고를 수 없다')
        ok(len(calls(pg, 'closeoutSave')) == 0, '막힌 동안 저장 호출 0'); pg.close()

        print('── 권한 없는 참여자: 편집 카드도, 체크리스트 읽기 요청도 없다')
        pg, errs = fresh({'canEdit': False}, me={'admin': False, 'uid': 'u2', 'name': '참여자'}, proj='p2')
        ok(len(calls(pg, 'closeoutGet')) == 0 and pg.query_selector('[data-ck-save]') is None and ckcard_text(pg) == '', '★ canEdit 가 아니면 closeoutGet 을 부르지 않고 편집 카드가 없다')
        ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()

        print('── 보고서 본문의 마감 완성도(참여자 누구나)')
        REP = {'ym': TODAY[:7], 'pjtId': 'p2', 'pjtLabel': '현장2', 'partial': True, 'version': 1, 'generatedByName': '팀장', 'notes': {'remarks': '', 'nextPlan': ''}, 'data': {'ym': TODAY[:7], 'closeout': {'total': 3, 'done': 2, 'rate': 2 / 3, 'doneThisMonth': 1, 'items': [{'id': 'c1', 'name': '시공검측', 'done': True, 'doneDate': TODAY[:7] + '-01', 'assignee': '김', 'memo': ''}, {'id': 'c2', 'name': '시운전', 'done': True, 'doneDate': '2020-01-01', 'assignee': '', 'memo': ''}, {'id': 'c3', 'name': '<img src=x onerror="window.__xss=1">', 'done': False, 'doneDate': '', 'assignee': '', 'memo': ''}]}}}
        pg, errs = fresh({'canEdit': False, 'report': REP}, me={'admin': False, 'uid': 'u2', 'name': '참여자'}, proj='p2')
        body = pg.inner_text('#mr-body')
        ok('마감 완성도' in body and '2 / 3항목' in body and '66.7%' in body and '+1항목' in body, '★ 권한 없는 참여자도 본문에서 "마감 완성도 2 / 3항목 · 66.7% · 이번 달 +1항목"을 본다 — ' + body[body.find('마감 완성도'):body.find('마감 완성도') + 60].replace('\n', ' '))
        ok(pg.evaluate("document.querySelectorAll('[data-done=\"true\"]').length") == 2 and pg.evaluate("document.querySelectorAll('[data-done=\"false\"]').length") == 1, '완료 2·미완료 1 표시')
        ok(pg.evaluate('window.__xss') is None and pg.evaluate("document.querySelectorAll('#mr-body img').length") == 0, '★ 서버가 준 항목 이름의 <img onerror> 가 실행되지 않고 img 도 만들어지지 않는다')
        ok(pg.query_selector('[data-ck-save]') is None and len(calls(pg, 'closeoutGet')) == 0, '편집 칸·체크리스트 읽기 없음')
        pg.close()

        print('── 폰 폭(390): 가로 넘침 없이 입력칸이 세로로 쌓인다')
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '김', 'memo': '지적 3건 보완'}, {'id': 'c2', 'name': '시운전', 'doneDate': '', 'assignee': '', 'memo': ''}], 'version': 1, 'seq': 2}, width=390)
        W = pg.evaluate('document.documentElement.scrollWidth'); ok(W <= 390, '★ 페이지 가로 넘침 없음(문서 폭 ' + str(W) + ')')
        geo = pg.evaluate("(() => { const r = document.querySelector('[data-ck-row=\"0\"]'); const ins = [...r.querySelectorAll('input')].map((i) => { const b = i.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width) }; }); return ins; })()")
        ok(all(g['r'] <= 392 and g['w'] >= 200 for g in geo) and len(set(g['t'] for g in geo)) == 4, '★ 이름·완료일·담당·메모 입력칸이 폭 200px 이상으로 한 줄씩(위에서 아래로 4단) — ' + str(geo))
        os.makedirs('/tmp/shots', exist_ok=True); pg.screenshot(path='/tmp/shots/closeout-edit-390.png', full_page=True)
        ok(not errs, '화면 오류 없음 ' + str(errs[:2])); pg.close()
        print('── 폰 폭(390): 하단 고정 막대가 겹치지 않아 월 선택·만들기를 실제로 누를 수 있다(보고서가 없는 달·있는 달)')
        def clickable(pg, sel):
            return pg.evaluate("(sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width === 0) return false; const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && (e === top || e.contains(top) || top.contains(e)); }", sel)
        def fixed_bars(pg): return pg.evaluate("[...document.querySelectorAll('.jh-actionbar')].filter((e) => getComputedStyle(e).position === 'fixed').length")
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '', 'memo': ''}], 'version': 1, 'seq': 1}, width=390)
        ok(fixed_bars(pg) == 1, '★ 보고서가 없는 달: 하단 고정 막대는 정확히 1개 — ' + str(fixed_bars(pg)))
        ok(clickable(pg, '[data-mr-ym]') is True and clickable(pg, '[data-mr-gen]') is True, '★ 월 선택칸과 [만들기]의 중심점이 실제로 눌린다(다른 막대에 가려지지 않음)')
        pg.close()
        pg, errs = fresh({}, width=390)
        ok(pg.query_selector('[data-ck-seed]') is not None and fixed_bars(pg) == 1, '★ 체크리스트가 비어 이름 입력 칸이 있는 장면(390px): 하단 고정 막대는 정확히 1개 — ' + str(fixed_bars(pg)))
        ok(clickable(pg, '[data-mr-ym]') is True and clickable(pg, '[data-mr-gen]') is True, '★ 이 장면에서도 월 선택·[만들기]가 눌린다')
        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); pg.wait_for_timeout(200)
        ok(clickable(pg, '[data-ck-seed]') is True, '★ 맨 끝까지 스크롤한 상태에서 [항목 만들기]가 막대에 가려지지 않고 눌린다')
        pg.close()
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '', 'memo': ''}], 'version': 1, 'seq': 1}, width=1300)
        ok(pg.evaluate("getComputedStyle(document.querySelector('.jh-pjt__mr')).paddingBottom") == '0px' and fixed_bars(pg) == 0, '★ PC 폭(1300): 폰 전용 아래 여백이 없고(0px) 고정 막대도 없다(폰 폭 보정이 PC 화면을 바꾸지 않는다)')
        pg.close()
        REP1 = json.loads(json.dumps(REP)); REP1['pjtId'] = 'p1'; REP1['pjtLabel'] = '현장1'; REP1['data']['closeout'] = {'total': 1, 'done': 0, 'rate': 0, 'doneThisMonth': 0, 'items': [{'id': 'c1', 'name': '시공검측', 'done': False, 'doneDate': '', 'assignee': '', 'memo': ''}]}
        pg, errs = fresh({'items': [{'id': 'c1', 'name': '시공검측', 'doneDate': '', 'assignee': '', 'memo': ''}], 'version': 1, 'seq': 1, 'report': REP1}, width=390)
        ok(pg.query_selector('[data-mr-save]') is not None and pg.query_selector('[data-ck-save]') is not None, '(전제) 보고서가 있고 직접 입력 저장·체크리스트 저장 버튼이 모두 화면에 있다')
        ok(fixed_bars(pg) == 1, '★ 보고서가 있는 달(직접 입력·체크리스트 카드 포함): 하단 고정 막대는 정확히 1개 — ' + str(fixed_bars(pg)))
        ok(clickable(pg, '[data-mr-ym]') is True and clickable(pg, '[data-mr-gen]') is True and clickable(pg, '[data-mr-print]') is True, '★ 월 선택·[다시 만들기]·[PDF 저장]의 중심점이 실제로 눌린다')
        pg.fill('[data-ck-f="name"][data-ck-i="0"]', '시공검측 수정'); pg.wait_for_timeout(150)
        ok(pg.evaluate("document.querySelector('[data-ck-save]').disabled") is False, '(전제) 이름을 바꾸면 체크리스트 [저장]이 켜진다(변경이 없을 때는 설계대로 비활성이라 점검 대상이 아님)')
        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); pg.wait_for_timeout(200)
        bar = pg.evaluate("(() => { const e = document.querySelector('.jh-actionbar'); const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })()")
        ck = pg.evaluate("(() => { const r = document.querySelector('[data-ck-save]').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })()")
        ok(ck[1] <= bar[0], '★ 문서 맨 끝까지 스크롤하면 마지막 카드의 체크리스트 [저장]이 하단 고정 막대(위 ' + str(bar[0]) + 'px) 위에 있다 — 저장 버튼 아래 ' + str(ck[1]) + 'px')
        ok(clickable(pg, '[data-ck-save]') is True, '★ 켜진 체크리스트 [저장]이 하단 고정 막대에 가려지지 않고 눌린다(맨 끝까지 스크롤한 상태)')
        last = pg.evaluate("(() => { const cards = document.querySelectorAll('#mr-body section.jh-card'); const r = cards[cards.length - 1].getBoundingClientRect(); return Math.round(r.bottom); })()")
        ok(last <= bar[0], '마지막 카드의 아래 끝(' + str(last) + 'px)도 고정 막대 위에 있다(막대 뒤로 잘리는 내용이 없다)')
        pg.evaluate("document.querySelector('[data-mr-save]').scrollIntoView({block: 'center'})"); pg.wait_for_timeout(150)
        ok(clickable(pg, '[data-mr-save]') is True, '★ 직접 입력 [저장]도 가려지지 않고 눌린다(카드 안의 일반 줄)')
        pg.close()
        b.close()
try:
    run()
finally:
    pass
FLOOR = 53
if pass_n + fail_n < FLOOR: fail_n += 1; print('FAIL 시험이 끝까지 실행되지 않음(' + str(pass_n + fail_n) + '건 < ' + str(FLOOR) + ')')
print('\n' + ('실패 ' + str(fail_n) + '건 / 통과 ' + str(pass_n) if fail_n else '전부 통과 (' + str(pass_n) + '건)')); sys.exit(1 if fail_n else 0)
