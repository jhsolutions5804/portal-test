#!/usr/bin/env python3
"""UI 계약 점검: ChatGPT 등 외부에서 받은 theme/*.css 가 클래스 계약을 지키는지 자동 검사한다.
사용: python3 scripts/ui_contract_check.py [theme 폴더 경로]   (기본: app/theme)
검사: ① 계약 클래스 전부 정의 ② data-* 속성 값 스타일 존재 ③ tokens.css 밖 색 직접 값 ④ !important·ID 선택자·@import·외부 url
     ⑤ 기준 폭 899px 외 미디어쿼리 ⑥ 미리보기 HTML이 쓰는 클래스가 CSS에 정의됨(preview.html 이 있으면)"""
import glob
import re, os, sys
theme = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'app', 'theme')
files = ['tokens', 'base', 'components', 'shell', 'edoc', 'legacy', 'calendar', 'company', 'admin']
css = {}
for f in files:
    p = os.path.join(theme, f + '.css')
    if not os.path.exists(p): sys.exit('파일 없음: ' + p)
    css[f] = open(p, encoding='utf-8').read()
allcss = '\n'.join(css.values())
nocomment = lambda s: re.sub(r'/\*.*?\*/', '', s, flags=re.S)
body = nocomment(allcss)

CLASSES = """jh-btn jh-iconbtn jh-card jh-field jh-field__label jh-input jh-select jh-textarea jh-field__hint jh-field__error
jh-segmented jh-segmented__item jh-badge jh-chip jh-chiplist jh-alert jh-empty jh-skeleton jh-link jh-toast
jh-dialog jh-dialog__backdrop jh-dialog__panel jh-dialog__title jh-dialog__body jh-dialog__actions jh-suggest jh-suggest__item
jh-login jh-login__card jh-login__brand jh-login__sub jh-login__msg jh-app jh-sidebar jh-sidebar__brand jh-sidebar__foot
jh-nav jh-nav__item jh-nav__icon jh-nav__label jh-nav__badge jh-body jh-topbar jh-topbar__title jh-topbar__tools jh-main jh-tabbar jh-userchip
jh-split jh-split__list jh-split__detail jh-edoc-tabs jh-tab jh-tab__count jh-filters jh-doclist jh-docrow jh-docrow__main
jh-docrow__title jh-docrow__summary jh-docrow__meta jh-docrow__side jh-detail jh-detail__back jh-detail__head jh-detail__type
jh-detail__title jh-detail__meta jh-detail__state jh-detail__body jh-detail__line jh-detail__h jh-detail__foot jh-kv jh-kv__row jh-kv__item
jh-timeline jh-step jh-step__role jh-step__name jh-step__state jh-step__time
jh-form jh-form__head jh-form__title jh-form__sub jh-form__section jh-form__h jh-form__row jh-form__foot
jh-line-editor jh-line-editor__list jh-line-editor__add jh-line-item jh-line-item__handle jh-line-item__order jh-line-item__name jh-line-item__tag jh-line-item__actions
jh-guide jh-guide__title jh-guide__line jh-guide__step jh-guide__arrow jh-guide__note jh-guide__diff
jh-actionbar jh-actionbar__primary jh-actionbar__danger jh-actionbar__secondary
jh-dashboard jh-kpi-grid jh-kpi jh-kpi__label jh-kpi__value jh-kpi__hint jh-dashboard__grid jh-panel jh-panel__head
jh-settings jh-settings__card jh-settings__row jh-settings__type
jh-paper jh-paper__title jh-stamps jh-stamp jh-stamp__role jh-stamp__sign jh-stamp__name jh-paper__table
jh-cal jh-cal__bar jh-cal__nav jh-cal__title jh-cal__legend jh-cal__toggle jh-cal__dot jh-cal__grid  jh-cal__wd jh-cal__day jh-cal__num jh-cal__hol jh-cal__ev jh-cal__more  jh-cal__dayhead jh-cal__list jh-cal__row jh-cal__time jh-cal__what jh-cal__name jh-cal__meta jh-cal__todo jh-cal__check jh-cal__acts jh-cal__two jh-cal__time-pick jh-cal__form jh-cal__split jh-cal__views jh-cal__filter jh-cal__filter-sum jh-cal__agenda jh-cal__daysec jh-cal__dayh jh-cal__none jh-cal__newtxt  jh-cal__gridwrap jh-cal__dayarea jh-sheet jh-sheet__backdrop jh-sheet__panel jh-sheet__item jh-sheet__sep jh-fab jh-admin jh-admin__tabs jh-admin__proj jh-admin__sum jh-admin__chips jh-admin__members jh-admin__chip jh-admin__member jh-admin__add jh-admin__actions jh-org jh-org__node jh-org__node--ceo jh-org__node--hq jh-org__node--extra jh-org__title jh-org__people jh-org__p jh-org__empty jh-company__views jh-profile__details jh-profile jh-profile__body jh-profile__dl jh-profile__sec jh-profile__row jh-company jh-company__tabs jh-company__bar jh-company__search jh-company__dept jh-company__people jh-company__person jh-company__meta jh-company__ruletabs jh-company__ruletab jh-company__name jh-md jh-md__h jh-md__p jh-md__list jh-md__hr jh-md__tablewrap jh-md__table jh-keep jh-idle jh-legacy jh-legacy__quick jh-legacy__nav jh-legacy__nav--wide jh-legacy__chip jh-legacy__frame jh-attach jh-attach__item jh-attach__name jh-attach__size jh-attach__actions jh-attach__add jh-detail__attach jh-admin jh-pagehead__actions jh-admin__section jh-admin__h jh-admin__h2 jh-admin__group jh-admin__add jh-admin__grid jh-admin__save jh-admin__state jh-admin__toggle jh-admin__title jh-admin__sum jh-admin__body jh-comments jh-comment jh-comment__head jh-comment__meta jh-comment__body jh-detail__comments jh-widget jh-clock jh-clock__date jh-clock__time jh-clock__actions jh-pagehead jh-pc-only jh-todo-grid jh-todo jh-todo__top jh-todo__icon jh-todo__value jh-todo__label jh-todo__hint jh-pipeline jh-pipe jh-pipe__count jh-pipe__label jh-ring jh-ring__track jh-ring__bar jh-ring__center jh-progress jh-progress__bar jh-statrow
jh-noprint jh-paper__body jh-paper__sub jh-paper__company jh-paper__date jh-paper__seal
jh-pager jh-pager__info jh-pager__nav jh-pager__btn jh-pager__page jh-pager__gap jh-pager__status jh-pager__size""".split()
ATTRS = {
  # 기본값(draft 배지, pending 단계, secondary 버튼, approver 줄)은 기본 클래스 스타일로 갈음해도 되어 검사에서 제외
  'data-status': ['reviewing','approved','rejected','posted'],
  'data-state': ['done','current','rejected','ref','skipped'],
  'data-variant': ['primary','danger','ghost'],
  'data-tone': ['accent','warn','info','danger'],
  'data-kind': ['author','cc'],
  'data-locked': ['true'], 'data-diff': ['true'], 'data-invalid': ['true'],
  'data-view': ['list','detail'], 'data-cols': ['1','3','4','narrow-first'],
  'aria-pressed': ['true'], 'aria-current': ['page'], 'aria-selected': ['true'],
}
problems = []; ok = []
defined = set(re.findall(r'\.(jh-[a-z0-9_-]+)', body))
miss = [c for c in CLASSES if c not in defined]
(problems if miss else ok).append('계약 클래스 %d개 중 정의 안 된 것: %s' % (len(CLASSES), miss) if miss else '계약 클래스 %d개 모두 정의됨' % len(CLASSES))
miss_attr = []
for a, vals in ATTRS.items():
    for v in vals:
        if not re.search(r'\[\s*' + re.escape(a) + r'\s*=\s*["\']?' + re.escape(v) + r'["\']?\s*\]', body): miss_attr.append('%s="%s"' % (a, v))
(problems if miss_attr else ok).append('data-* 값 스타일 없음: %s' % miss_attr if miss_attr else 'data-* 속성 값 스타일 %d개 모두 있음' % sum(len(v) for v in ATTRS.values()))
# 색 직접 값 (tokens.css, .jh-paper 규칙 제외)
rest = nocomment('\n'.join(css[f] for f in files if f != 'tokens'))
rest = re.sub(r'\.jh-(paper|stamp|stamps)[^{]*\{[^}]*\}', '', rest)
hexes = re.findall(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)', rest)
(problems if hexes else ok).append('tokens.css 밖 색 직접 값 %d건: %s' % (len(hexes), sorted(set(hexes))[:8]) if hexes else 'tokens.css 밖 색 직접 값 없음')
for pat, label in [(r'!important', '!important'), (r'(^|[\s,}])#[A-Za-z_][\w-]*\s*[{,]', 'ID 선택자'), (r'@import', '@import'), (r'url\(\s*["\']?https?:', '외부 url')]:
    n = len(re.findall(pat, body, flags=re.M))
    (problems if n else ok).append('%s %d건' % (label, n) if n else '%s 없음' % label)
widths = set(re.findall(r'@media\s*\(\s*max-width:\s*(\d+)px', body)) | set(re.findall(r'@media\s*\(\s*min-width:\s*(\d+)px', body))
bad_w = [w for w in widths if w not in ('899', '900')]
(problems if bad_w else ok).append('기준 폭 외 미디어쿼리: %s' % bad_w if bad_w else '미디어쿼리 기준 폭: %s' % sorted(widths))
# 다크 테마: 라이트에서 정의한 색 토큰이 다크 블록에서도 모두 다시 정의되어 있고, 글자-바탕 조합이 모두 4.5:1 이상인지
tok = nocomment(css['tokens'])
def parse_vars(block):
    return {k: v.strip() for k, v in re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);', block)}
m_light = re.search(r':root\s*\{(.*?)\n\}', tok, flags=re.S)
m_dark = re.search(r'@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{(.*?)\n  \}\s*\}', tok, flags=re.S)
if not m_light: problems.append('tokens.css 에서 :root 블록을 찾지 못함')
elif not m_dark: problems.append('다크 테마 블록(@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } })이 없음')
else:
    L = parse_vars(m_light.group(1)); D = parse_vars(m_dark.group(1))
    is_color = lambda v: bool(re.match(r'^(#|rgba?\()', v))
    FIXED = {'--c-on-primary', '--c-hover-on-dark', '--paper-bg', '--paper-ink', '--paper-line', '--paper-head', '--c-side-active'}   # 테마가 달라도 같아도 되는 색
    missing = [k for k, v in L.items() if is_color(v) and k not in D and k not in FIXED]
    (problems if missing else ok).append('다크 블록에 다시 정의되지 않은 색 토큰: %s' % missing if missing else '다크 블록이 라이트의 색 토큰을 모두 다시 정의함(%d개)' % len(D))
    if 'color-scheme' not in tok: problems.append(':root 에 color-scheme: light dark 가 없음')
    def lum(h):
        h = h.lstrip('#'); h = h * 2 if len(h) == 3 else h
        r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        f = lambda x: x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    def ratio(a, b): la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)
    PAIRS = [('ink','surface'),('ink','bg'),('ink-2','surface'),('ink-2','bg'),('ink-2','primary-weak'),('ink-3','surface'),('ink-3','bg'),('primary','surface'),('primary','bg'),('primary','primary-weak'),('primary-strong','primary-weak'),
             ('success','surface'),('danger','surface'),('warn-ink','warn-weak'),('warn-ink','warn-bg'),('primary-ink','primary'),('on-danger','danger'),('on-primary','side-active'),('side-ink','side'),('toast-ink','toast-bg'),
             ('st-draft-fg','st-draft-bg'),('st-pending-fg','st-pending-bg'),('st-reviewing-fg','st-reviewing-bg'),('st-approved-fg','st-approved-bg'),('st-rejected-fg','st-rejected-bg'),('st-posted-fg','st-posted-bg'),('st-rejected-fg','surface')]
    for name, T in (('라이트', dict(L)), ('다크', {**L, **D})):
        low = []
        for f, b in PAIRS:
            fv = T.get('--c-' + f) or T.get('--' + f); bv = T.get('--c-' + b) or T.get('--' + b)
            if fv and bv and fv.startswith('#') and bv.startswith('#'):
                r = ratio(fv, bv)
                if r < 4.5: low.append('%s/%s %.2f' % (f, b, r))
        (problems if low else ok).append('%s 테마 글자-바탕 대비 4.5 미달: %s' % (name, low) if low else '%s 테마 글자-바탕 %d조합 모두 4.5:1 이상' % (name, len(PAIRS)))
pv = os.path.join(theme, '..', 'preview.html')
if os.path.exists(pv):
    h = open(pv, encoding='utf-8').read()
    used = set(c for m in re.finditer(r'class="([^"]+)"', h) for c in m.group(1).split() if c.startswith('jh-'))
    undefined = sorted(c for c in used if c not in defined)
    (problems if undefined else ok).append('미리보기가 쓰는데 CSS에 없는 클래스: %s' % undefined if undefined else '미리보기 사용 클래스 %d개 모두 정의됨' % len(used))
# 정의되지 않은 CSS 변수 검사: var(--x) 로 쓰는데 어디에도 정의가 없으면 그 속성이 통째로 무시된다(연결선이 안 보이거나 폭 제한이 사라짐). 대체값이 있는 var(--x, 값)은 제외.
_defs = set(); _uses = {}
for _f in glob.glob(os.path.join(theme, '*.css')):
    _t = open(_f, encoding='utf-8').read()
    _defs |= set(re.findall(r'(--[A-Za-z0-9-]+)\s*:', _t))
    for _m in re.finditer(r'var\((--[A-Za-z0-9-]+)\s*\)', _t): _uses.setdefault(_m.group(1), os.path.basename(_f))
_undef = sorted((k, v) for k, v in _uses.items() if k not in _defs)
(problems if _undef else ok).append('정의되지 않은 CSS 변수 %d개: %s' % (len(_undef), _undef) if _undef else 'CSS 변수 사용 %d개 모두 정의됨' % len(_uses))
print('# UI 계약 점검 —', os.path.abspath(theme))
for o in ok: print('  OK  ', o)
for p in problems: print('  FAIL', p)
print('결과:', '통과' if not problems else '실패 %d건' % len(problems))
sys.exit(1 if problems else 0)
