#!/usr/bin/env python3
"""새 모듈 만들기 틀 — 모듈을 "꽂고 빼는 부품"으로 만들 때 쓴다(설계서 §46).
  만들기:  python3 scripts/new_module.py <영문소문자id> "<화면 이름>" [--icon 🧩] [--order 85] [--widget] [--calendar] [--hidden]
  빼기:    python3 scripts/new_module.py --remove <id>
만들면: app/modules/<id>/{index,logic,view,data}.js · app/theme/<id>.css(+index.html 링크) · tests/<id>.test.mjs 를 만들고,
        app/modules/index.js(모듈 목록)·scripts/ui_contract_check.py(스타일 계약)에 한 줄씩 등록한다. 핵심부(core/)는 고치지 않는다.
옵션:   --widget 홈에 작은 카드(위젯) 추가 · --calendar 일정 제공자 뼈대 추가 · --hidden 사이드바에는 안 넣고 홈 위젯·주소로만(출퇴근·일정처럼)"""
import os, re, sys, argparse, shutil
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
APP = os.path.join(ROOT, 'app'); TPL = os.path.join(os.path.dirname(__file__), 'module_template')
RESERVED = {'core', 'shared', 'theme', 'legacy', 'edoc', 'attendance', 'calendar', 'company', 'home', 'index', 'login'}
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s): open(p, 'w', encoding='utf-8', newline='').write(s)
def ver():
    m = re.search(r"\?v=(\d+[a-z]?)", rd(os.path.join(APP, 'modules', 'index.js'))); return m.group(1) if m else '0'
def fill(t, d):
    for k, v in d.items(): t = t.replace('__' + k + '__', v)
    return t

WIDGET_VIEW = """
export function widgetHtml(items, summary) {
  return '<div class="jh-panel jh-card"><div class="jh-panel__head"><h3>__ICON__ __TITLE__</h3><a class="jh-link" href="#/__ID__/home">열기 ›</a></div><div class="jh-form"><div class="jh-chip">' + esc(summary) + '</div></div></div>';
}"""
WIDGET_CODE = """
/** 홈 위젯 — 위젯 하나가 실패해도 홈 전체는 보인다(core/home.js 가 감싼다). slot = 위젯 자리, ctx = { me, setBadge } */
async function mountWidget(slot, ctx) {
  slot.innerHTML = '<div class="jh-panel jh-card"><div class="jh-panel__head"><h3>__ICON__ __TITLE__</h3></div><div class="jh-empty">불러오는 중…</div></div>';
  const items = await loadItems(ctx.me);
  slot.innerHTML = widgetHtml(items, sampleSummary(items));
}"""
CAL_CODE = """
/** 일정 제공자 뼈대 — 반환하는 일정은 shared/calendar-event.js 의 makeEvent() 모양(제목·시작·끝·종류). 일정 모듈이 이 목록을 달력에 합친다 */
async function loadCalendar(range, ctx) {
  return [];   // TODO: range.from ~ range.to (YYYY-MM-DD) 사이의 일정을 읽어 makeEvent() 로 만들어 돌려주세요
}"""

def create(a):
    id_ = a.id
    if not re.match(r'^[a-z][a-z0-9]{1,19}$', id_): sys.exit('아이디는 영문 소문자로 시작하는 소문자·숫자 2~20자여야 합니다: ' + id_)
    if id_ in RESERVED or os.path.exists(os.path.join(APP, 'modules', id_)): sys.exit('이미 있거나 예약된 이름입니다: ' + id_)
    d = {'ID': id_, 'TITLE': a.title, 'ICON': a.icon, 'ORDER': str(a.order), 'VER': ver()}
    widgets = (a.widget); cal = (a.calendar)
    d['VIEW_IMPORTS'] = 'pageHtml' + (', widgetHtml' if widgets else '')
    d['NAV_LINE'] = "  nav: false,                              // 사이드바에는 넣지 않고 홈 위젯·주소(#/%s/…)로만 들어간다\n" % id_ if a.hidden else ''
    d['WIDGETS_LINE'] = "  widgets: [{ id: 'summary', order: 80, reserve: 'medium', mount: mountWidget }],   // 홈 위젯(order: 작을수록 위, reserve: 자리 예약 높이 tall|medium|large)\n" if widgets else ''
    d['CALENDAR_LINE'] = "  calendar: [{ id: '%s', label: '%s 일정', order: 90, defaultOn: true, load: loadCalendar }],   // 일정 제공자(일정 화면의 표시 목록에 나타남)\n" % (id_, a.title) if cal else ''
    d['WIDGET_VIEW'] = fill(WIDGET_VIEW, d) if widgets else ''; d['WIDGET_CODE'] = fill(WIDGET_CODE, d) if widgets else ''; d['CALENDAR_CODE'] = fill(CAL_CODE, d) if cal else ''
    d['WIDGET_CSS'] = ''
    mdir = os.path.join(APP, 'modules', id_); os.makedirs(mdir)
    for name in ('index', 'logic', 'view', 'data'): wr(os.path.join(mdir, name + '.js'), fill(rd(os.path.join(TPL, name + '.js.tpl')), d).rstrip('\n') + '\n')
    wr(os.path.join(APP, 'theme', id_ + '.css'), fill(rd(os.path.join(TPL, 'module.css.tpl')), d).rstrip('\n') + '\n')
    os.makedirs(os.path.join(ROOT, 'tests'), exist_ok=True); wr(os.path.join(ROOT, 'tests', id_ + '.test.mjs'), fill(rd(os.path.join(TPL, 'test.mjs.tpl')), d))
    # 등록: 모듈 목록 · 스타일 링크 · 스타일 계약
    p = os.path.join(APP, 'modules', 'index.js'); s = rd(p); v = d['VER']
    imps = list(re.finditer(r"^import \* as (\w+) from '\./\w+/index\.js\?v=[^']*';\n", s, re.M)); assert imps, '모듈 목록 형식을 못 찾음'
    s = s[:imps[-1].end()] + "import * as %s from './%s/index.js?v=%s';\n" % (id_, id_, v) + s[imps[-1].end():]
    m = re.search(r"(\{ manifest: \w+\.manifest, mount: \w+\.mount \})\n\]\.concat\(legacy\)", s); assert m, '모듈 배열 끝을 못 찾음'
    s = s.replace(m.group(0), m.group(1) + ",\n  { manifest: %s.manifest, mount: %s.mount }\n].concat(legacy)" % (id_, id_), 1); wr(p, s)
    p = os.path.join(APP, 'index.html'); s = rd(p); links = list(re.finditer(r'<link rel="stylesheet" href="theme/\w+\.css\?v=[^"]*">\n', s)); assert links
    s = s[:links[-1].end()] + '<link rel="stylesheet" href="theme/%s.css?v=%s">\n' % (id_, v) + s[links[-1].end():]; wr(p, s)
    p = os.path.join(ROOT, 'scripts', 'ui_contract_check.py'); s = rd(p)
    m = re.search(r"'calendar', 'company'([^\]]*)\]", s); assert m, '스타일 파일 목록을 못 찾음'
    s = s.replace(m.group(0), "'calendar', 'company'" + m.group(1) + ", '%s']" % id_, 1)
    m = re.search(r'jh-org jh-org__node', s); assert m; s = s.replace('jh-org jh-org__node', 'jh-%s jh-%srow jh-org jh-org__node' % (id_, id_), 1); wr(p, s)
    print('만들었습니다:', id_, '(%s)' % a.title); print('  app/modules/%s/ · app/theme/%s.css · tests/%s.test.mjs' % (id_, id_, id_))
    print('다음 순서: ① logic.js·data.js·view.js 를 실제 내용으로 ② node tests/%s.test.mjs ③ python3 scripts/module_check.py && python3 scripts/app_check.py && python3 scripts/ui_contract_check.py ④ 새 컬렉션이면 보안 규칙 먼저 정하기(data.js 머리 주석) ⑤ 올리기 전 build 번호 새로 매기기(app_stamp.py)' % id_)

def remove(id_):
    mdir = os.path.join(APP, 'modules', id_)
    if id_ in RESERVED or not os.path.isdir(mdir): sys.exit('지울 수 없는 이름입니다(없거나 기본 모듈): ' + id_)
    shutil.rmtree(mdir)
    for pth in (os.path.join(APP, 'theme', id_ + '.css'), os.path.join(ROOT, 'tests', id_ + '.test.mjs')):
        if os.path.exists(pth): os.remove(pth)
    p = os.path.join(APP, 'modules', 'index.js'); s = rd(p)
    s = re.sub(r"^import \* as %s from '\./%s/index\.js\?v=[^']*';\n" % (id_, id_), '', s, flags=re.M)
    s = re.sub(r",\n  \{ manifest: %s\.manifest, mount: %s\.mount \}(?=\n\]\.concat)" % (id_, id_), '', s); s = re.sub(r"\n  \{ manifest: %s\.manifest, mount: %s\.mount \},(?=\n)" % (id_, id_), '', s); wr(p, s)
    p = os.path.join(APP, 'index.html'); s = rd(p); s = re.sub(r'<link rel="stylesheet" href="theme/%s\.css\?v=[^"]*">\n' % id_, '', s); wr(p, s)
    p = os.path.join(ROOT, 'scripts', 'ui_contract_check.py'); s = rd(p); s = s.replace(", '%s']" % id_, ']').replace('jh-%s jh-%srow ' % (id_, id_), ''); wr(p, s)
    print('뺐습니다:', id_, '— 모듈 폴더·스타일·시험·등록 줄을 모두 지웠습니다. (Firestore 에 쌓인 데이터는 그대로 남습니다)')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('id', nargs='?'); ap.add_argument('title', nargs='?'); ap.add_argument('--icon', default='🧩'); ap.add_argument('--order', type=int, default=85)
    ap.add_argument('--widget', action='store_true'); ap.add_argument('--calendar', action='store_true'); ap.add_argument('--hidden', action='store_true'); ap.add_argument('--remove', metavar='ID')
    a = ap.parse_args()
    if a.remove: remove(a.remove)
    elif a.id and a.title: create(a)
    else: ap.print_help(); sys.exit(2)
