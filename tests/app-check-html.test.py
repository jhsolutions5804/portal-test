"""앱 점검 도구(scripts/app_check.py)의 화면 파일 버전 검사 시험 — 임시 폴더에 가짜 app/ 을 만들고 도구를 복사해 실행한다(실제 저장소 파일은 건드리지 않는다).
배경(2026-10-23, 대기열 00-0): Microsoft 로그인 시험 페이지(app/ms-login-test.html)가 모듈 주소(core/ms-login-test.js?v=…)를 직접 가지는데, .js 만 검사하던 점검이 그 번호가 옛것으로 남아도 못 잡았다.
규칙: app/ 최상위의 .html 안의 `import { … } from './….js?v=…'` 번호도 .js 파일들의 번호와 같아야 한다."""
import os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); SC = os.path.join(HERE, '..', 'scripts')
ok_n = bad_n = 0
def ok(c, m):
    global ok_n, bad_n
    if c: ok_n += 1; print('OK ' + m)
    else: bad_n += 1; print('FAIL ' + m)
def sandbox(html):
    d = tempfile.mkdtemp(prefix='chk-'); os.makedirs(os.path.join(d, 'scripts')); os.makedirs(os.path.join(d, 'app', 'core')); os.makedirs(os.path.join(d, 'app', 'modules'))
    for n in ('app_check.py', 'module_check.py'): shutil.copy(os.path.join(SC, n), os.path.join(d, 'scripts', n))
    w = lambda p, t: open(os.path.join(d, p), 'w', encoding='utf-8').write(t)
    w('app/core/a.js', "import { b } from './b.js?v=20261023c';\nexport const a = b;\n"); w('app/core/b.js', "export const b = 1;\n")
    if html is not None: w('app/ms-login-test.html', html)
    return d
def check(html):
    d = sandbox(html); r = subprocess.run([sys.executable, os.path.join(d, 'scripts', 'app_check.py')], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=d); shutil.rmtree(d, ignore_errors=True); return r.returncode, r.stdout
H = lambda v: '<script type="module">import { m } from ' + chr(39) + './core/b.js' + ('?v=' + v if v else '') + chr(39) + ';</script>'
rc, out = check(H('20261023c')); ok(rc == 0 and '이상 없음' in out, '★ 화면 파일의 번호가 .js 파일들과 같으면 통과(기준선) — ' + out.strip().split('\n')[-1][:80])
rc, out = check(H('20261023b')); ok(rc != 0 and '버전 불일치' in out, '★★ 화면 파일만 옛 번호(b)로 남으면 버전 불일치로 실패한다 — ' + out.strip().split('\n')[-1][:80])
rc, out = check(H('20261024a')); ok(rc != 0 and '버전 불일치' in out, '화면 파일이 더 새 번호여도 다르면 실패한다')
rc, out = check(H('')); ok(rc != 0 and '버전 불일치' in out, '★ 화면 파일의 모듈 주소에 번호가 아예 없으면 실패한다(.js 의 import 는 번호 없는 주소도 번호 없음으로 세지만 여기서는 다른 파일과 달라진다)')
rc, out = check(None); ok(rc == 0 and '이상 없음' in out, '화면 파일이 없는 저장소는 이전과 같이 통과한다(호환)')
rc, out = check('<p>본문에 적힌 글자 core/b.js?v=20250101z 는 가져오기 구문이 아니다</p><style>.a{}</style>'); ok(rc == 0 and '이상 없음' in out, '★ 가져오기 구문이 없는 화면 파일은 번호를 세지 않는다 — 본문에 적힌 같은 모양의 글자는 무시')
rc, out = check('<script>const x = 1;</script>'); ok(rc == 0 and '이상 없음' in out, '일반 스크립트만 있는 화면 파일도 통과')
rc, out = check(H('20261023c') + '\n' + H('20261023b')); ok(rc != 0 and '버전 불일치' in out, '한 화면 파일 안에 가져오기가 둘이고 하나만 옛 번호여도 실패한다')
rc, out = check('<script type="module">import * as m from ' + chr(39) + './core/b.js?v=20261023b' + chr(39) + ';</script>'); ok(rc != 0 and '버전 불일치' in out, '`import * as` 형태도 같은 규칙으로 검사한다')
print('\n' + (('%d건 실패' % bad_n) if bad_n else '전부 통과') + ' (%d건)' % ok_n); sys.exit(1 if bad_n else 0)
