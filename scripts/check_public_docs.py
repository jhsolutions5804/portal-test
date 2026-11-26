#!/usr/bin/env python3
"""공개 저장소에 문서·민감 정보가 다시 올라오지 않게 막는 검사(CI 에서 실행).
배경(2026-10-19): 이 저장소(portal-test)는 공개이고 GitHub Pages 로 배포돼 docs/ 문서를 로그인 없이 누구나 읽을 수 있었다. 거기에 급여·거래처·직원 정보가 쌓여 있어 비공개 서버 저장소(app-docs/)로 옮겼다.
규칙: ① docs/ 에는 README.md 한 개만 둔다(다른 파일이 있으면 실패) ② backup/ 폴더에 파일이 있으면 실패(옛 코드 스냅샷에 직원 실명 등이 있어 비공개 저장소 app-backups/ 로 옮김) ③ 공개되는 문서·메모 파일(*.md)에 직원 실명·금액(○○원)·거래처가 있으면 실패.
문서는 비공개 저장소 portal-functions 의 app-docs/ 에 둔다."""
import os, re, sys, glob, hashlib
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
# 금지어(직원 실명·거래처)는 공개 저장소에 평문으로 두지 않는다 — (글자 수, sha256) 목록만 둔다(2026-11-26, 대기열 4-6-101).
# 문서의 한글 덩어리에서 같은 글자 수 구간을 잘라 같은 방식으로 해시해 비교한다. 금지어를 바꾸려면 sha256('jh-public-check:' + 단어) 로 계산해 추가.
FORBIDDEN = [
    (3, '030c87b7e20706706fe6fa7ddbb5e69858f1292b2a090cfe14d3122e44f22c6d'),
    (3, '0cdeea20fd2452526bc1819b45b2c784c2886ae7809e856c6a9a8b02d2d3782f'),
    (3, '184f087acf604047f6919a9a0f86e7cfdff1dcde12ca036d57f891503b4af857'),
    (3, '305f838da7a7e41840dcb0b61cc694deca29152de76d595b69edecc4b2006868'),
    (3, '466bf2e45f63ef5f50e60b7d5c500359ecee7be46eb07263f9fc3b61a246b071'),
    (3, '4dcfa3967f3e5b31ad8ce684bbb26d5e99843151b018ad3a9bd7e757417a31e7'),
    (3, '529684633b48964d085c1d4e2a481fdaed68ec842f4a0247c8b9e644a739c974'),
    (3, '64a00d373ca63fef189fc2d681f931a601d3307c90bfc6e5e7d87339a47c29d0'),
    (3, '697ff7b5f738b79d79ec70e3e4a918d85e2527af6cc60a716abb19cac08aa92c'),
    (3, '6aaa3cbfa42e1266b362abe8a88a9bc1f42ba565b63fb83920297ee1f8b853d1'),
    (3, 'b27f3845002426945a08d58c6a061271597d01385513d469fe4b1dee86635abf'),
    (3, 'c626f35a4dbdc9fe51ad7b69923f0aa4932fa0635df7110f902ca2166fe5cb0a'),
    (3, 'faddf4da695563867ecc664e19b4abe5274cf2049e31c8dc3865edaa1f056294'),
    (4, 'af4ac6e727b2ad2bc69c62e9fc6141a5622fa2f631909cce2d90fdb89bb9acf1'),
    (6, '35d96d11477057c182c84bfbbc82438f2be4d8fa7f6cb33d68999d1181ddc188'),
]
SALT = 'jh-public-check:'
LENS = sorted({n for n, _ in FORBIDDEN})
HASHES = {h: n for n, h in FORBIDDEN}
def forbidden_hits(text):
    hits = 0
    for run in re.findall(r'[가-힣]+(?: [가-힣]+)*', text):
        for n in LENS:
            for i in range(len(run) - n + 1):
                if hashlib.sha256((SALT + run[i:i + n]).encode()).hexdigest() in HASHES: hits += 1
    return hits
MONEY = re.compile(r'\d{1,3}(?:,\d{3}){1,}\s*원')
bad = []
docs = os.path.join(ROOT, 'docs')
if os.path.isdir(docs):
    for f in sorted(glob.glob(os.path.join(docs, '**', '*'), recursive=True)):
        if os.path.isfile(f) and os.path.relpath(f, docs).replace(os.sep, '/') != 'README.md': bad.append('docs/ 에 문서가 있음(비공개 저장소 app-docs/ 로 옮길 것): docs/' + os.path.relpath(f, docs).replace(os.sep, '/'))
bk = os.path.join(ROOT, 'backup')
if os.path.isdir(bk) and any(os.path.isfile(f) for f in glob.glob(os.path.join(bk, '**', '*'), recursive=True)):
    bad.append('backup/ 폴더에 파일이 있음(옛 코드 스냅샷은 공개 저장소에 두지 않는다 — 비공개 저장소 app-backups/ 로 옮길 것, 2026-10-19)')
for f in sorted(glob.glob(os.path.join(ROOT, '**', '*.md'), recursive=True)):
    rel = os.path.relpath(f, ROOT).replace(os.sep, '/')
    if rel.startswith(('node_modules/', 'scripts/dev/node_modules/', '.git/')): continue
    t = open(f, encoding='utf-8', errors='ignore').read()
    for name, n in (('직원 실명·거래처', forbidden_hits(t)), ('금액(쉼표 ○○원)', len(MONEY.findall(t)))):
        if n: bad.append('공개 문서에 %s %d건: %s' % (name, n, rel))
print('공개 문서 검사: ' + ('문제 %d건' % len(bad) if bad else '통과 — docs/ 는 README.md 뿐이고 공개 *.md 에 민감 정보 없음'))
for b in bad[:20]: print('  - ' + b)
sys.exit(1 if bad else 0)
