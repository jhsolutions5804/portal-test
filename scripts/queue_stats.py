#!/usr/bin/env python3
"""대기열(docs/platform-queue.md) 현황 계산 — 대표님 요청(2026-10-19): 대기열을 불러올 때 맨 위에 완료 과제 수·대기 과제 수·진행도(%)를 함께 보여 준다.
세는 법: 줄이 ☑(완료)·☐(대기)·⏸(무기한 보류)로 시작하는 항목을 문서에 적힌 그대로 센다. 진행도 % = 완료 ÷ (완료 + 대기) — 보류는 분모에서 뺀다.
한계: 항목 수 기준이라 큰 과제와 작은 과제를 똑같이 한 건으로 센다. 오래전에 끝나 패치노트로 옮긴 완료 이력은 문서에 없으므로 포함되지 않는다.
사용: python3 scripts/queue_stats.py            → 현황 요약 + 섹션별 소계
      python3 scripts/queue_stats.py --open     → 위에 더해 미완(☐) 항목을 문서 순서대로 번호 붙여 출력
      python3 scripts/queue_stats.py --json     → 기계가 읽는 JSON"""
import re, sys, os, json
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'platform-queue.md')
HEAD = re.compile(r'^(#{2,3})\s+(.*)')
ITEM = re.compile(r'^\s*[-*]?\s*(☐|☑|⏸)\s*(.*)')
def clean(t): return re.sub(r'\s+', ' ', re.sub(r'\*\*|`', '', t)).strip()
def parse():
    sec = '(머리말)'; rows = []
    for l in open(P, encoding='utf-8').read().split('\n'):
        m = HEAD.match(l)
        if m: sec = clean(re.sub(r'\s*[\(—].*', '', m.group(2)))[:34]; continue
        m = ITEM.match(l)
        if m: rows.append({'state': {'☐': 'open', '☑': 'done', '⏸': 'hold'}[m.group(1)], 'sec': sec, 'text': clean(m.group(2))})
    return rows
def summary(rows):
    n = lambda s: sum(1 for r in rows if r['state'] == s); d, o, h = n('done'), n('open'), n('hold')
    return {'완료': d, '대기': o, '보류': h, '전체': d + o + h, '진행도': round(100 * d / (d + o), 1) if d + o else 0.0}
if __name__ == '__main__':
    rows = parse(); s = summary(rows)
    if '--json' in sys.argv: print(json.dumps({'요약': s, '항목': rows}, ensure_ascii=False)); sys.exit(0)
    print('완료 %d · 대기 %d · 보류 %d (전체 %d) · 진행도 %.1f%%  [완료÷(완료+대기), 항목 수 기준]' % (s['완료'], s['대기'], s['보류'], s['전체'], s['진행도']))
    by = {}
    for r in rows: by.setdefault(r['sec'], {'done': 0, 'open': 0, 'hold': 0})[r['state']] += 1
    print('\n섹션별: 완료 / 대기 / 보류')
    for k, v in by.items(): print('  %-36s %3d / %3d / %3d' % (k, v['done'], v['open'], v['hold']))
    if '--open' in sys.argv:
        print('\n미완(대기) 항목 — 문서 순서:')
        i = 0
        for r in rows:
            if r['state'] == 'open': i += 1; print('%3d | %-30s | %s' % (i, r['sec'][:30], r['text'][:90]))
