#!/usr/bin/env python3
"""빌드 번호를 올리지 않고 app/ 코드를 바꿨는지 검사한다(CI 에서 실행).
배경(2026-10-18): 같은 번호(?v=…)로 수정판을 올리면 브라우저가 옛 파일을 계속 써서 수정이 사용자에게 가지 않는다(확인창 취소 버그 수정이 그랬다).
규칙: 기준(base) 대비 app/ 아래 .js·.css·.html 이 바뀌었으면 app/version.json 의 build 가 달라져야 한다. 문서·시험·scripts 만 바뀐 경우는 통과.
사용: python3 scripts/check_build_bump.py <기준 커밋>   (기준이 없으면 이 검사는 건너뜀 — 첫 푸시 등)"""
import json, subprocess, sys, re
base = sys.argv[1] if len(sys.argv) > 1 else ''
ZERO = '0' * 40
def git(*a): return subprocess.run(['git', *a], capture_output=True, text=True, encoding='utf-8', errors='replace')
if not base or base == ZERO or git('cat-file', '-e', base + '^{commit}').returncode != 0:
    print('건너뜀 — 비교할 기준 커밋이 없음(%r)' % base); sys.exit(0)
changed = [f for f in git('diff', '--name-only', base, 'HEAD', '--', 'app').stdout.split('\n') if f.strip()]
code = [f for f in changed if re.search(r'\.(js|css|html)$', f) and not f.endswith('version.json')]
def build_at(rev):
    r = git('show', rev + ':app/version.json')
    try: return json.loads(r.stdout).get('build', '')
    except Exception: return ''
old, new = build_at(base), build_at('HEAD')
print('app 코드 변경 %d개 · 번호 %r → %r' % (len(code), old, new))
if not code: print('통과 — app 코드 변경 없음'); sys.exit(0)
if old and old == new:
    print('실패 — app 코드가 바뀌었는데 빌드 번호가 그대로입니다. python3 scripts/app_stamp.py <새 번호> (예: 20261018g) 로 올리세요.')
    for f in code[:8]: print('   바뀐 파일:', f)
    sys.exit(1)
print('통과 — 코드가 바뀌었고 번호도 바뀜'); sys.exit(0)
