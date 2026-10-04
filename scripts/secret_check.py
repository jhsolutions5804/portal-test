#!/usr/bin/env python3
"""저장소에 올라가면 안 되는 비밀 값(비공개 키·토큰·클라이언트 암호)이 파일에 들어 있는지 점검한다.
이 저장소는 공개 저장소이므로 커밋 전에 반드시 통과해야 한다. 사용: python3 scripts/secret_check.py [폴더]  (발견되면 종료 코드 1)
발견 내용(값)은 출력하지 않고 파일 경로와 종류만 알려 준다."""
import os, re, sys
ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PATTERNS = {
    '비공개 키(PRIVATE KEY)': re.compile(r'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'),
    'GitHub 토큰': re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'),
    'MS 클라이언트 암호 형식': re.compile(r'(?<![A-Za-z0-9])[A-Za-z0-9]{3}8Q~[A-Za-z0-9._~-]{20,}'),
    '서비스 계정 JSON': re.compile(r'"type"\s*:\s*"service_account"'),
    'client_secret 값': re.compile(r'client_secret["\']?\s*[:=]\s*["\'][A-Za-z0-9~._-]{20,}'),
}
SKIP_DIRS = {'.git', 'node_modules', 'backup'}
EXTS = ('.md', '.txt', '.html', '.js', '.mjs', '.json', '.py', '.css', '.csv', '.env', '.yml', '.yaml', '.ps1', '.bat', '.sh')
found = []
for base, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for f in files:
        if not (f.endswith(EXTS) or f.startswith('.env')): continue
        path = os.path.join(base, f)
        try: s = open(path, encoding='utf-8', errors='ignore').read()
        except OSError: continue
        for name, pat in PATTERNS.items():
            if pat.search(s): found.append((os.path.relpath(path, ROOT), name))
if found:
    print('비밀 값으로 보이는 내용이 발견되었습니다 — 커밋하지 마세요:')
    for p, n in found: print('  %s  (%s)' % (p, n))
    sys.exit(1)
print('비밀 값 점검 통과 (%s)' % ROOT)
