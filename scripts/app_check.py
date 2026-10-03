#!/usr/bin/env python3
"""app/ 배포 전 점검: ① 문법(node --check) ② 상대 import 대상 파일·export 이름 일치 ③ 모든 내부 주소의 ?v= 버전 일치.
사용: python3 scripts/app_check.py   (이상 있으면 종료 코드 1)"""
import re, os, glob, subprocess, tempfile, shutil, sys
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app'))
files = glob.glob(root + '/**/*.js', recursive=True)
problems = []
tmp = tempfile.mkdtemp(); open(os.path.join(tmp, 'package.json'), 'w').write('{"type":"module"}')
for f in files:
    dst = os.path.join(tmp, os.path.relpath(f, root)); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy(f, dst)
    r = subprocess.run(['node', '--check', dst], capture_output=True, text=True)
    if r.returncode: problems.append('문법 오류 ' + os.path.relpath(f, root) + ': ' + r.stderr[:160])
shutil.rmtree(tmp, ignore_errors=True)
exports = {}
for f in files:
    t = open(f, encoding='utf-8').read(); names = set(re.findall(r'export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)', t))
    for blk in re.findall(r'export\s*\{([^}]*)\}', t):
        for n in blk.split(','):
            n = n.strip().split(' as ')[-1].strip()
            if n: names.add(n)
    exports[os.path.abspath(f)] = names
versions = set()
for f in files:
    t = open(f, encoding='utf-8').read()
    for m in re.finditer(r"import\s+(?:\*\s+as\s+\w+|\{([^}]*)\})\s+from\s+'(\.{1,2}/[^'?]+)(\?v=([^']*))?'", t):
        versions.add(m.group(4))
        target = os.path.abspath(os.path.join(os.path.dirname(f), m.group(2)))
        if not os.path.exists(target): problems.append('없는 파일 %s → %s' % (os.path.relpath(f, root), m.group(2))); continue
        for n in [x.strip().split(' as ')[0].strip() for x in (m.group(1) or '').split(',') if x.strip()]:
            if n not in exports[target]: problems.append('없는 export %s → %s : %s' % (os.path.relpath(f, root), m.group(2), n))
if len(versions) > 1: problems.append('버전 불일치: ' + str(versions))
print('점검 파일', len(files), '개 / 버전', versions, '/', '이상 없음' if not problems else '문제 %d건' % len(problems))
for p in problems: print('  -', p)
sys.exit(1 if problems else 0)
