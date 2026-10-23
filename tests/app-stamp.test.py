"""빌드 번호 도구(scripts/app_stamp.py)의 시험 — 임시 폴더에 가짜 app/ 을 만들어 도구를 실행한다(실제 저장소 파일은 건드리지 않는다).
배경(2026-10-18): ① 도구가 `from '…'` 형태만 처리해 `import('…')` 호출의 번호가 옛것으로 남았다(pjt/index.js)  ② 인자 검증이 느슨해 `--help` 가 번호로 적용됐다."""
import os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.join(HERE, '..', 'scripts', 'app_stamp.py')
ok_n = bad_n = 0
def ok(c, m):
    global ok_n, bad_n
    if c: ok_n += 1; print('OK ' + m)
    else: bad_n += 1; print('FAIL ' + m)
def sandbox():
    d = tempfile.mkdtemp(prefix='stamp-'); os.makedirs(os.path.join(d, 'scripts')); os.makedirs(os.path.join(d, 'app', 'modules', 'pjt')); os.makedirs(os.path.join(d, 'app', 'shared')); os.makedirs(os.path.join(d, 'app', 'theme')); os.makedirs(os.path.join(d, 'm'))
    shutil.copy(TOOL, os.path.join(d, 'scripts', 'app_stamp.py'))
    w = lambda p, t: open(os.path.join(d, p), 'w', encoding='utf-8').write(t)
    w('app/index.html', '<meta name="jh-build" content="20260101a"><link rel="stylesheet" href="theme/pjt.css?v=20260101a"><script type="module" src="core/boot.js?v=20260101a"></script>')
    w('app/version.json', '{ "build": "20260101a" }')
    w('app/ms-login-test.html', '<style>.a{color:#fff}</style><script type="module">import { m } from ' + chr(39) + './core/ms-login-test.js?v=20260101a' + chr(39) + ';</script><p>core/ms-login-test.js?v=20260101a 는 본문의 글자</p>')   # 시험 페이지 화면 파일(대기열 00-0): 모듈 주소의 번호를 같이 올린다
    w('app/theme/pjt.css', 'a{}')
    w('app/shared/x.js', "export const x = 1;")
    w('app/modules/pjt/a.js', "import { x } from '../../shared/x.js?v=20260101a';\nconst m = await import('../../shared/y.js?v=20250101z');\nconst n = await import('./z.js');\nconst g = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js');\nconst o = await import('../../../outside.js');\n")
    w('m/pjt.html', "<script>const [a, b] = await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js'), import('./pjt-log.js?v=20250101z')]);</script>")  # 실제 m/pjt.html 의 형태: 외부 주소 + m/ 자기 파일
    w('m/pjt-log.js', "import { x } from '../app/shared/x.js?v=20260101a';")  # m/*.js 가 app/ 을 부르는 실제 형태
    return d
def run(d, ver):
    return subprocess.run([sys.executable, os.path.join(d, 'scripts', 'app_stamp.py'), ver], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=d)
def snap(d):
    out = {}
    for r, _, fs in os.walk(d):
        for f in fs: p = os.path.join(r, f); out[os.path.relpath(p, d)] = open(p, encoding='utf-8').read()
    return out
# 1) 올바른 번호: from·import( ) 모두 새 번호, 외부 주소·앱 밖 경로는 그대로
d = sandbox(); r = run(d, '20261018g'); a = open(os.path.join(d, 'app/modules/pjt/a.js'), encoding='utf-8').read()
ok(r.returncode == 0, '올바른 번호(20261018g)로 실행된다')
ok("from '../../shared/x.js?v=20261018g'" in a, 'from 형태는 새 번호')
ok("import('../../shared/y.js?v=20261018g')" in a, '★ import( ) 호출의 옛 번호(20250101z)도 새 번호로 바뀐다')
ok("import('./z.js?v=20261018g')" in a, '★ 번호가 없던 import( ) 호출에는 번호가 붙는다')
ok("import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js')" in a, '★ 외부 주소(https://)는 건드리지 않는다')
ok("import('../../../outside.js')" in a, '★ 앱 밖으로 나가는 경로(../../../)는 건드리지 않는다(번호를 붙이면 안 되는 파일)')
ok('20261018g' in open(os.path.join(d, 'app/index.html'), encoding='utf-8').read() and '"build": "20261018g"' in open(os.path.join(d, 'app/version.json'), encoding='utf-8').read(), '인덱스·jh-build·version.json 도 새 번호')
mh = open(os.path.join(d, 'm/pjt.html'), encoding='utf-8').read(); mj = open(os.path.join(d, 'm/pjt-log.js'), encoding='utf-8').read()
ok("from '../app/shared/x.js?v=20261018g'" in mj, '모바일(m/*.js)이 app/ 을 부르는 주소는 새 번호')
ok("import('./pjt-log.js?v=20261018g')" in mh and "import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js')" in mh, '모바일 페이지의 자기 모듈 import 는 새 번호, 외부 주소는 그대로')
ml = open(os.path.join(d, 'app/ms-login-test.html'), encoding='utf-8').read()
ok("import { m } from './core/ms-login-test.js?v=20261018g'" in ml, '★ 시험 페이지 화면 파일(app/ms-login-test.html)의 모듈 주소 번호도 새 번호로 바뀐다(.js 만 고치면 이 한 줄이 옛 번호로 남는다)')
ok('<style>.a{color:#fff}</style>' in ml and 'core/ms-login-test.js?v=20260101a 는 본문의 글자' in ml, '★ 화면 파일의 다른 글자(스타일·본문에 적힌 같은 모양의 글자)는 건드리지 않는다 — 모듈 가져오기 구문만')
r2 = run(d, '20261018g'); ok(r2.returncode == 0 and snap(d) == snap(d), '같은 번호를 다시 적용해도 오류 없이 같은 결과(멱등)')
shutil.rmtree(d, ignore_errors=True)
# 2) 잘못된 번호: 파일을 하나도 바꾸지 않고 거절
for bad in ['--help', '-h', 'latest', '2026', '20261018', '20261018ff', '20261018F', '2026-10-18', '', ' 20261018g', '20261018g;rm']:
    d = sandbox(); before = snap(d); r = run(d, bad)
    ok(r.returncode != 0 and snap(d) == before, '★ 잘못된 번호 %r 는 거절되고 파일이 하나도 바뀌지 않는다' % bad); shutil.rmtree(d, ignore_errors=True)
print('\n' + (('%d건 실패' % bad_n) if bad_n else '전부 통과') + ' (%d건)' % ok_n); sys.exit(1 if bad_n else 0)
