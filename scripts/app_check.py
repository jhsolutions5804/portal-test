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
# export * from './x.js' (재내보내기)를 따라가 이름을 합친다(여러 단계도 반복해서 처리)
for _ in range(4):
    for f in files:
        t0 = open(f, encoding='utf-8').read()
        for m in re.finditer(r"export\s*\*\s*from\s*'(\.{1,2}/[^'?]+)(?:\?v=[^']*)?'", t0):
            tgt = os.path.abspath(os.path.join(os.path.dirname(f), m.group(1)))
            if tgt in exports: exports[os.path.abspath(f)] |= exports[tgt]
versions = set()
for f in files:
    t = open(f, encoding='utf-8').read()
    for m in re.finditer(r"import\s+(?:\*\s+as\s+\w+|\{([^}]*)\})\s+from\s+'(\.{1,2}/[^'?]+)(\?v=([^']*))?'", t):
        versions.add(m.group(4))
        target = os.path.abspath(os.path.join(os.path.dirname(f), m.group(2)))
        if not os.path.exists(target): problems.append('없는 파일 %s → %s' % (os.path.relpath(f, root), m.group(2))); continue
        for n in [x.strip().split(' as ')[0].strip() for x in (m.group(1) or '').split(',') if x.strip()]:
            if n not in exports[target]: problems.append('없는 export %s → %s : %s' % (os.path.relpath(f, root), m.group(2), n))
# app/ 최상위의 화면 파일(.html)이 직접 가진 모듈 가져오기 주소의 번호도 같은 집합에 넣는다 — .js 만 보면 html 안의 번호가 옛것으로 남아도 모른다(2026-10-23 Microsoft 로그인 시험 페이지). 본문·스타일에 적힌 같은 모양의 글자는 import 구문이 아니라 세지 않는다
for f in glob.glob(root + '/*.html'):
    for m in re.finditer(r"import\s+(?:\*\s+as\s+\w+|\{[^}]*\})\s+from\s+'(\.{1,2}/[^'?]+)(\?v=([^']*))?'", open(f, encoding='utf-8').read()): versions.add(m.group(3))
if len(versions) > 1: problems.append('버전 불일치: ' + str(versions))
# 줄 끝에 붙인 주석이 뒤따르는 코드를 삼키는 실수(두 번 있었음) 방지: 한 줄에 주석 표시(//)가 둘 이상이면 의심
def _strip_strings(l):
    out = []; q = None; i = 0
    while i < len(l):
        c = l[i]
        if q:
            if c == '\\': i += 2; continue
            if c == q: q = None
            i += 1; continue
        if c in "'\"`": q = c; i += 1; continue
        out.append(c); i += 1
    return ''.join(out)
for f in files:
    for n, l in enumerate(open(f, encoding='utf-8').read().split('\n')):
        t = re.sub(r'https?://', '', _strip_strings(l))
        if t.count('//') >= 2 and not t.lstrip().startswith(('//', '*', '/*')):
            problems.append('주석 뒤에 코드가 삼켜졌을 수 있음 %s:%d : %s' % (os.path.relpath(f, root), n + 1, l.strip()[:80]))
import subprocess
mc = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'module_check.py'), root], capture_output=True, text=True)
print(mc.stdout.strip())
if mc.returncode: problems.append('모듈 규약 위반 (module_check.py)')
print('점검 파일', len(files), '개 / 버전', versions, '/', '이상 없음' if not problems else '문제 %d건' % len(problems))
for p in problems: print('  -', p)
sys.exit(1 if problems else 0)
