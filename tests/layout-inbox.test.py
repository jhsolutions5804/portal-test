"""미분류 메일 받은함 카드의 레이아웃 시험(실제 크로미움으로 그려 높이·폭을 잰다).
문자열 시험(m-inbox-view.test.mjs)은 구조만 보고 "글자가 한 글자씩 쪼개짐·칸이 끝없이 늘어남·이력 패널을 가림" 같은 배치 문제는 못 잡는다 — 2026-10-18 실제로 그랬다.
크로미움(playwright)이 없는 환경에서는 건너뛴다(종료 코드 0, SKIP 표시). 실제 CSS(theme/*.css)와 같은 칸 구조(overview-view.js 의 .jh-ov__log)를 쓴다."""
import glob, json, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — 레이아웃 시험 건너뜀'); sys.exit(0)
css = ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'theme', '*.css'))))
def row(i, t): return ('<div class="jh-pjt__ibrow" data-ib-row="%s"><div class="jh-pjt__ibtitle"><span aria-hidden="true">📨</span> %s</div><div class="jh-field__hint jh-pjt__ibmeta">10. 18 (일)</div>'
    '<div class="jh-pjt__ibctl"><select class="jh-select" data-ib-pick="%s"><option>프로젝트 선택</option><option>P4 Ph2 (FAB) 신축 현장</option></select><div class="jh-pjt__ibacts"><button class="jh-btn" data-variant="secondary">지정</button><button class="jh-btn" data-variant="ghost">이 현장 아님</button></div></div></div>') % (i, t, i)
def inbox(n): return '<section class="jh-card jh-pjt__inbox"><div class="jh-panel__head"><h3>📥 미분류 메일</h3></div><div class="jh-pjt__pad">' + ''.join(row('r%d' % k, '자료 회신 요청의 件 %d번째 메일 제목이 조금 긴 경우' % k) for k in range(n)) + '</div></section>'
def logs(n): return '<section class="jh-card jh-pjt__lg--compact"><div class="jh-panel__head"><h3>🗂️ 이력</h3></div><div class="jh-pjt__pad">' + ''.join('<div class="jh-pjt__lgrow"><span class="jh-pjt__lgicon">📨</span><div class="jh-pjt__lgbody"><div class="jh-pjt__lgtitle">이력 항목 %d</div></div></div>' % k for k in range(n)) + '</div></section>'
def page(n_inbox):
    third = ('<div class="jh-ov__inbox">%s</div>' % inbox(n_inbox) if n_inbox else '<div class="jh-ov__inbox"></div>') + '<div class="jh-ov__logbox">%s</div>' % logs(12)
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>%s</style></head><body><div class="jh-ov__wrap"><div class="jh-ov__layout">'
            '<section class="jh-card jh-ov__main" id="ov-sched"><div style="height:520px">달력</div></section><aside class="jh-card jh-ov__detailcard" id="ov-detail"><div style="height:300px">선택한 날</div></aside>'
            '<div class="jh-ov__log" data-ov-log>%s</div></div></div></body></html>') % (css, third)
JS = '''()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {w:b.width,h:b.height,top:b.top,bottom:b.bottom}};
 const titles=[...document.querySelectorAll('.jh-pjt__ibtitle')].map(e=>{const b=e.getBoundingClientRect();return {w:b.width,h:b.height}});
 const sel=r('.jh-pjt__ibctl .jh-select'); const btns=[...document.querySelectorAll('.jh-pjt__ibrow .jh-btn')].map(e=>{const b=e.getBoundingClientRect();return {w:b.width,h:b.height}});
 return {layout:r('.jh-ov__layout'),sched:r('#ov-sched'),detail:r('#ov-detail'),log:r('.jh-ov__log'),inbox:r('.jh-ov__inbox'),logbox:r('.jh-ov__logbox'),titles,sel,btns,
  overlap:(()=>{const a=document.querySelector('.jh-ov__inbox'),b=document.querySelector('.jh-ov__logbox');if(!a||!b||!a.firstElementChild)return false;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.bottom>y.top+1&&x.top<y.bottom-1})()}}'''
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    try:
        base = {}
        for w in (1920, 1440, 1280, 1100):
            pg = b.new_page(viewport={'width': w, 'height': 900}); pg.set_content(page(0)); pg.wait_for_timeout(100); base[w] = pg.evaluate(JS); pg.close()
        for n in (1, 2, 5):
            for w in (1920, 1440, 1280, 1100):
                pg = b.new_page(viewport={'width': w, 'height': 900}); pg.set_content(page(n)); pg.wait_for_timeout(100); m = pg.evaluate(JS); pg.close(); tag = '폭 %d · 받은함 %d건: ' % (w, n)
                ok(abs(m['layout']['h'] - base[w]['layout']['h']) <= 2, tag + '★ 받은함이 있어도 3단 카드 높이가 변하지 않는다(%d → %d)' % (base[w]['layout']['h'], m['layout']['h']))
                ok(all(t['h'] <= 70 for t in m['titles']), tag + '★ 제목이 한 글자씩 쪼개지지 않는다(제목 높이 %s)' % [round(t['h']) for t in m['titles']])
                ok(all(t['w'] >= 150 for t in m['titles']), tag + '제목 칸 폭이 충분하다(%s)' % [round(t['w']) for t in m['titles']])
                ok(not m['overlap'], tag + '★ 받은함이 이력 패널을 가리지 않는다')
                ok(m['inbox']['h'] > 0 and m['logbox']['h'] > 120, tag + '받은함이 보이고 이력 패널도 최소한은 보인다(이력 높이 %d)' % m['logbox']['h'])
                ok(m['sel']['w'] >= 100 and all(x['w'] >= 40 and x['h'] >= 30 for x in m['btns']), tag + '고르는 칸과 버튼이 눌러 쓸 수 있는 크기다')
    finally:
        b.close()
print('\n' + (('%d건 실패' % fail_n) if fail_n else '전부 통과') + ' (%d건)' % pass_n); sys.exit(1 if fail_n else 0)
