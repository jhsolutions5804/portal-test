#!/usr/bin/env python3
"""app/ 의 모든 내부 import·CSS·스크립트 주소에 같은 버전(?v=)을 붙인다.
GitHub Pages 는 파일을 10분간 캐시하므로, 배포 직후 새 파일과 옛 파일이 섞여 로드되면 앱이 깨진다.
모든 주소에 같은 버전을 붙이면 '전부 새것 / 전부 옛것' 중 하나로만 로드된다.
사용: python3 scripts/app_stamp.py <버전>   예) python3 scripts/app_stamp.py 20261003c
"""
import re, sys, glob, os
ver = sys.argv[1] if len(sys.argv) > 1 else None
if not ver or not re.fullmatch(r'[0-9A-Za-z._-]+', ver):
    sys.exit('버전을 입력하세요 (영문·숫자·.-_)')
root = os.path.join(os.path.dirname(__file__), '..', 'app')
n = 0
for f in glob.glob(root + '/**/*.js', recursive=True):
    s = open(f, encoding='utf-8').read()
    t = re.sub(r"(from\s+'\.{1,2}/[^'?]*?\.js)(\?v=[^']*)?'", lambda m: m.group(1) + '?v=' + ver + "'", s)
    if t != s: open(f, 'w', encoding='utf-8', newline='').write(t); n += 1
idx = os.path.join(root, 'index.html')
s = open(idx, encoding='utf-8').read()
t = re.sub(r'(href="theme/[a-z]+\.css)(\?v=[^"]*)?"', lambda m: m.group(1) + '?v=' + ver + '"', s)
t = re.sub(r'(src="core/boot\.js)(\?v=[^"]*)?"', lambda m: m.group(1) + '?v=' + ver + '"', t)
if t != s: open(idx, 'w', encoding='utf-8', newline='').write(t); n += 1
# 검사: 상대 import 가 모두 같은 버전인지
bad = []
for f in glob.glob(root + '/**/*.js', recursive=True):
    for m in re.finditer(r"from\s+'(\.{1,2}/[^']*)'", open(f, encoding='utf-8').read()):
        if not m.group(1).endswith('?v=' + ver): bad.append((f, m.group(1)))
print('버전', ver, '적용 파일', n, '개 /', '검사 통과' if not bad else '불일치 ' + str(bad))
sys.exit(1 if bad else 0)
