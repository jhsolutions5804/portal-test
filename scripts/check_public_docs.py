#!/usr/bin/env python3
"""공개 저장소에 문서·민감 정보가 다시 올라오지 않게 막는 검사(CI 에서 실행).
배경(2026-10-19): 이 저장소(portal-test)는 공개이고 GitHub Pages 로 배포돼 docs/ 문서를 로그인 없이 누구나 읽을 수 있었다. 거기에 급여·거래처·직원 정보가 쌓여 있어 비공개 서버 저장소(app-docs/)로 옮겼다.
규칙: ① docs/ 에는 README.md 한 개만 둔다(다른 파일이 있으면 실패) ② 공개되는 문서·메모 파일(*.md)에 직원 실명·금액(○○원)·거래처가 있으면 실패.
문서는 비공개 저장소 portal-functions 의 app-docs/ 에 둔다."""
import os, re, sys, glob
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
NAMES = ['윤석원', '정다애', '김영서', '김종화', '서민우', '이경택', '이한영', '송지훈', '김영희', '김민서', '양혜원', '형일우']
SENS = [('직원 실명', re.compile('|'.join(NAMES))), ('금액(쉼표 ○○원)', re.compile(r'\d{1,3}(?:,\d{3}){1,}\s*원')), ('거래처', re.compile(r'에스제이|지효근|이엔지 정산'))]
bad = []
docs = os.path.join(ROOT, 'docs')
if os.path.isdir(docs):
    for f in sorted(glob.glob(os.path.join(docs, '**', '*'), recursive=True)):
        if os.path.isfile(f) and os.path.relpath(f, docs).replace(os.sep, '/') != 'README.md': bad.append('docs/ 에 문서가 있음(비공개 저장소 app-docs/ 로 옮길 것): docs/' + os.path.relpath(f, docs).replace(os.sep, '/'))
for f in sorted(glob.glob(os.path.join(ROOT, '**', '*.md'), recursive=True)):
    rel = os.path.relpath(f, ROOT).replace(os.sep, '/')
    if rel.startswith(('node_modules/', 'scripts/dev/node_modules/', '.git/')): continue
    t = open(f, encoding='utf-8', errors='ignore').read()
    for name, pat in SENS:
        n = len(pat.findall(t))
        if n: bad.append('공개 문서에 %s %d건: %s' % (name, n, rel))
print('공개 문서 검사: ' + ('문제 %d건' % len(bad) if bad else '통과 — docs/ 는 README.md 뿐이고 공개 *.md 에 민감 정보 없음'))
for b in bad[:20]: print('  - ' + b)
sys.exit(1 if bad else 0)
