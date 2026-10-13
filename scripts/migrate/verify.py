#!/usr/bin/env python3
"""이전 검증(읽기 전용): 옛 위치와 새 위치를 각각 읽어 문서 수·공정 체크 칸 수·월별 공수 합계가 같은지 대조한다."""
import sys, os, re, json; sys.path.insert(0, os.path.dirname(__file__)); from fs_rest import *
fs = FS(sys.argv[1]); ids = fs.collection_ids(); R = 'pjt_registry'
FIXED = {'p4ph2': dict(roster='pjt_workers_fab', att='worker_attendance', md='worker_manday', sch='user_schedules', rep='daily_report_docs', prog='progress_checks_'), 'p4ph4': dict(roster='pjt_workers_ph4', att='ph4_attendance', md='ph4_manday', sch='ph4_schedules', rep='ph4_reports', prog='ph4_progress_')}
PAST = json.load(open('/tmp/mig_out.json'))['past']; bad = 0
def chk(label, a, b):
    global bad; ok = a == b; bad += 0 if ok else 1; print(('✓ ' if ok else '✗ ') + label.ljust(34), a, '→', b, '' if ok else '  ← 불일치')
def mdsum(col):
    t = {}
    for i, f in fs.list(col):
        m = decf(f).get('md', {}); t[i[:7]] = round(t.get(i[:7], 0) + sum(float(v) for v in m.values() if isinstance(v, (int, float))), 1)
    return t
for k, c in FIXED.items():
    for a, b, lab in [(c['roster'], 'workers', '명부'), (c['att'], 'attendance', '출역'), (c['md'], 'manday', '공수'), (c['sch'], 'schedules', '일정'), (c['rep'], 'reports', '공사일보')]:
        chk(f'{k} {lab} 문서 수', len(fs.list(a)), len(fs.list(f'{R}/{k}/{b}')))
    chk(f'{k} 월별 공수 합계', mdsum(c['md']), mdsum(f'{R}/{k}/manday'))
    old = {}
    for col in (x for x in ids if x.startswith(c['prog'])):
        for z, zf in fs.list(col): old.setdefault(z, set()).update(kk for kk, vv in decf(zf).get('checks', {}).items() if vv is True)
    if k == 'p4ph2':
        for d, zs in PAST.items():
            for z, ch in zs.items(): old.setdefault(z, set()).update(kk for kk, vv in ch.items() if vv)
    new = {}
    for d, f in fs.list(f'{R}/{k}/progress_days'):
        for z, ch in decf(f).get('groups', {}).items(): new.setdefault(z, set()).update(kk for kk, vv in ch.items() if vv is True)
    chk(f'{k} 섹터별 체크 칸 수(누적)', {z: len(v) for z, v in sorted(old.items())}, {z: len(v) for z, v in sorted(new.items())})
    chk(f'{k} 체크 칸 내용 동일', all(old.get(z) == new.get(z) for z in set(old) | set(new)), True)
for rid, f in fs.list(R):
    if rid in FIXED: continue
    d = decf(f); items = {i: decf(x) for i, x in fs.list(f'{R}/{rid}/items')}
    old = set(); [old.update(kk for kk, vv in decf(x).items() if vv is True and '_' in kk) for _, x in fs.list(f'{R}/{rid}/progress_checks')]
    for iid, it in items.items(): old.update(f'{iid}_{s}' for s, v in (it.get('stages') or {}).items() if v is True)
    new = set(); [new.update(kk for g in decf(x).get('groups', {}).values() for kk, vv in g.items() if vv is True) for _, x in fs.list(f'{R}/{rid}/progress_days')]
    chk(f'{rid[:8]} 체크 칸(날짜별+품목 상태)', len(old), len(new)); chk(f'{rid[:8]} 체크 칸 내용 동일', old == new, True)
    S = d.get('progressStructure') or {}; n_items = sum(len(g['items']) for g in S.get('groups', [])); chk(f'{rid[:8]} 구조 품목 수 = 품목 문서 수', len(items), n_items)
g = fs.get('gihoek_projects') if False else None
for i, f in fs.list('gihoek_projects'):
    lk = decf(f).get('linkPjt'); ok = bool(lk) and not str(lk).startswith('reg_') and (lk in ('none',) or fs.get(f'{R}/{lk}') is not None); bad += 0 if ok else 1; print(('✓ ' if ok else '✗ ') + f'영업기획 {i} linkPjt={lk} → 프로젝트 문서 존재')
print('\n검증 결과:', '모두 일치' if not bad else f'불일치 {bad}건')
