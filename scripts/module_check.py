#!/usr/bin/env python3
"""모듈 규약 점검: 모듈이 "끼우고 빼는 부품"으로 남아 있는지 import 관계를 검사한다.
  R1 모듈(modules/A)은 다른 모듈(modules/B)을 직접 불러오지 않는다 — 공용은 shared/ 로 올린다
  R2 핵심부(core/)는 모듈 폴더를 직접 알지 못한다 — 예외: core/boot.js 가 modules/index.js(목록 한 파일)만 불러온다
  R3 공용(shared/)은 모듈을 불러오지 않는다
  R4 modules/index.js 는 각 모듈의 index.js 만 불러온다
  R5 각 모듈의 index.js 는 manifest+mount 를 내놓거나, 어댑터처럼 modules 배열을 내놓는다
  R6 서버: 전자결재 서버 코드(functions/edoc/*.js, hooks/·test/ 제외)는 다른 모듈의 컬렉션 이름을 직접 쓰지 않는다 — 훅(hooks/)으로 옮긴다
사용: python3 scripts/module_check.py [app 폴더]   (위반이 있으면 종료 코드 1)"""
import re, os, sys, glob
root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'app'))
IMP = re.compile(r"(?:import|export)\s+(?:[^'\";]*?\s+from\s+)?['\"](\.{1,2}/[^'\"?]+)(?:\?[^'\"]*)?['\"]")
problems = []; checked = 0
def where(path):
    rel = os.path.relpath(path, root).replace(os.sep, '/')
    parts = rel.split('/')
    if parts[0] == 'modules': return ('modules', parts[1] if len(parts) > 2 else '(index)', rel)
    return (parts[0], '', rel)
mods = set()
for f in glob.glob(root + '/**/*.js', recursive=True):
    kind, name, rel = where(f)
    text = open(f, encoding='utf-8').read()
    if kind == 'modules' and name not in ('(index)',): mods.add(name)
    for m in IMP.finditer(text):
        target = os.path.normpath(os.path.join(os.path.dirname(f), m.group(1)))
        tk, tn, trel = where(target); checked += 1
        if kind == 'modules' and name != '(index)' and tk == 'modules' and tn not in (name,):
            problems.append('R1 모듈끼리 직접 참조: %s → %s (공용이면 shared/ 로 옮기세요)' % (rel, trel))
        if kind == 'core' and tk == 'modules' and not (rel == 'core/boot.js' and trel == 'modules/index.js'):
            problems.append('R2 핵심부가 모듈을 직접 참조: %s → %s (modules/index.js 를 통해서만)' % (rel, trel))
        if kind == 'shared' and tk == 'modules':
            problems.append('R3 공용이 모듈을 참조: %s → %s' % (rel, trel))
        if rel == 'modules/index.js' and not (tk == 'modules' and trel.endswith('/index.js') and tn != '(index)'):
            problems.append('R4 modules/index.js 가 각 모듈의 index.js 가 아닌 파일을 참조: %s' % trel)
for name in sorted(mods):
    p = os.path.join(root, 'modules', name, 'index.js')
    if not os.path.exists(p): problems.append('R5 modules/%s/index.js 없음' % name); continue
    t = open(p, encoding='utf-8').read()
    ok = (re.search(r'export\s+const\s+manifest\b', t) and re.search(r'export\s+(async\s+)?function\s+mount\b|export\s+const\s+mount\b', t)) or re.search(r'export\s+const\s+modules\b', t)
    if not ok: problems.append('R5 modules/%s/index.js 가 manifest+mount(또는 modules 배열)를 내놓지 않음' % name)
# R6: 서버 코드의 경계(functions 폴더가 이 컴퓨터에 있을 때만 검사 — 공개 저장소에는 올라가지 않는다)
srv = os.path.join(os.path.dirname(root), 'functions', 'edoc'); srv_checked = 0
FOREIGN = {'worker_attendance_log': '출퇴근'}
if os.path.isdir(srv):
    for f in sorted(glob.glob(srv + '/*.js')):
        srv_checked += 1; text = open(f, encoding='utf-8').read()
        for name, owner in FOREIGN.items():
            if name in text: problems.append('R6 서버 %s 가 다른 모듈(%s)의 컬렉션 %s 를 직접 참조 — hooks/ 로 옮기세요' % (os.path.basename(f), owner, name))
print('모듈 %d개 %s / import %d건 검사%s / %s' % (len(mods), sorted(mods), checked, (' / 서버 파일 %d개' % srv_checked) if srv_checked else '', '규약 위반 없음' if not problems else '위반 %d건' % len(problems)))
for p in problems: print('  -', p)
sys.exit(1 if problems else 0)
