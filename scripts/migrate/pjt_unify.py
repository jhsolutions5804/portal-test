#!/usr/bin/env python3
"""PJT 저장 구조 통일 이전(테섭 전용): 모든 프로젝트를 pjt_registry/<id>/… 한 구조로 복사한다. 원본은 지우지 않는다(되돌릴 수 있음).
사용: python3 pjt_unify.py <서비스계정.json> [--run]   (--run 이 없으면 쓰기 없이 계획만 출력 = 점검)
  1) 옛 데이터를 읽어 /tmp/mig_in.json 에 → 2) node build_structures.mjs 가 구조 데이터를 만들고 → 3) 이 스크립트가 새 위치에 쓴다."""
import sys, json, subprocess, base64, os, re
sys.path.insert(0, os.path.dirname(__file__)); from fs_rest import *
KEY = sys.argv[1]; RUN = '--run' in sys.argv; fs = FS(KEY, dry=not RUN)
ALLOWED = ['portal-test-6e0ff']   # 본섭에는 쓰지 않는다(본섭 전환은 별도 승인)
assert fs.pid in ALLOWED, '이 스크립트는 테섭(portal-test-6e0ff)에서만 실행합니다: ' + fs.pid
FIXED = {'p4ph2': dict(label='P4 Ph2 (FAB)', roster='pjt_workers_fab', att='worker_attendance', md='worker_manday', sch='user_schedules', rep='daily_report_docs', prog='progress_checks_', ph4=False),
         'p4ph4': dict(label='P4 Ph4 (SUP)', roster='pjt_workers_ph4', att='ph4_attendance', md='ph4_manday', sch='ph4_schedules', rep='ph4_reports', prog='ph4_progress_', ph4=True)}
ids = fs.collection_ids(); R = 'pjt_registry'
def say(*a): print(*a, flush=True)
# ── 1. 읽기 ──
settings = {k: fs.get(f'pjt_settings/{k}') for k in FIXED}
reg = {i: f for i, f in fs.list(R)}
light = []
for rid, f in reg.items():
    if rid in FIXED: continue
    items = [dict(id=i, **decf(x)) for i, x in fs.list(f'{R}/{rid}/items')]
    for it in items: it.pop('createdAt', None); it.pop('updatedAt', None)
    light.append(dict(id=rid, doc=decf(f), items=items))
json.dump(json.loads(json.dumps(dict(light=light), default=str)), open('/tmp/mig_in.json', 'w'), ensure_ascii=False)
subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'build_structures.mjs')], check=True)
OUT = json.load(open('/tmp/mig_out.json')); S = OUT['structures']; PAST = OUT['past']
# ── 2. 쓰기 계획 ──
W = []; count = {}
def add(path, fields, tag):
    W.append(dict(path=path, fields=fields)); count[tag] = count.get(tag, 0) + 1
def copy_col(src, dst, tag, idmap=None, only=None):
    for i, f in fs.list(src):
        if only and not only(i): continue
        add(f'{dst}/{idmap(i) if idmap else i}', f, tag)
import datetime
now_iso = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
all_created = [d['createdAt'] for d in (decf(f) for f in reg.values()) if d.get('createdAt')]
base_ts = sorted(all_created)[0] if all_created else '2026-07-01T00:00:00Z'
def minus_days(ts, n):
    t = datetime.datetime.strptime(ts[:19], '%Y-%m-%dT%H:%M:%S') - datetime.timedelta(days=n); return t.strftime('%Y-%m-%dT%H:%M:%SZ')
days_all = {}   # (프로젝트, 날짜) → {섹터: {키: True}}  — 검증에도 쓴다
for n, (k, c) in enumerate(FIXED.items()):
    st = decf(settings[k]) if settings[k] else {}
    doc = dict(st); doc['name'] = c['label']; doc['legacyName'] = st.get('name', ''); doc['progressStructure'] = S[k]; doc['migratedAt'] = now_iso; doc['migratedFrom'] = 'pjt_settings'
    f = encf(doc); f['createdAt'] = {'timestampValue': minus_days(base_ts, 2 - n)}
    if settings[k] and 'updatedAt' in settings[k]: f['updatedAt'] = settings[k]['updatedAt']
    if 'participants' in (settings[k] or {}): f['participants'] = settings[k]['participants']
    add(f'{R}/{k}', f, 'registry-doc')
    copy_col(c['roster'], f'{R}/{k}/workers', f'{k}:명부'); copy_col(c['att'], f'{R}/{k}/attendance', f'{k}:출역'); copy_col(c['md'], f'{R}/{k}/manday', f'{k}:공수')
    copy_col(c['sch'], f'{R}/{k}/schedules', f'{k}:일정'); copy_col(c['rep'], f'{R}/{k}/reports', f'{k}:공사일보')
    # 공정: 날짜별 컬렉션 → progress_days/<날짜> { groups: { 섹터: { 키: true } } }
    for col in sorted(x for x in ids if x.startswith(c['prog'])):
        date = col[len(c['prog']):]
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date): continue
        for zid, zf in fs.list(col):
            ch = {kk: True for kk, vv in decf(zf).get('checks', {}).items() if vv is True}
            if ch: days_all.setdefault((k, date), {}).setdefault(zid, {}).update(ch)
    if k == 'p4ph2':   # 코드에만 있던 과거 공정
        for date, zs in PAST.items():
            for zid, ch in zs.items(): days_all.setdefault((k, date), {}).setdefault(zid, {}).update({kk: True for kk, vv in ch.items() if vv})
    # 배치도 + 도면 이미지(Ph2 만 저장소에 도면 파일이 있었다)
    for i, f in fs.list('zone_layouts'):
        if c['ph4'] != i.startswith('ph4_'): continue
        zid = i.replace('ph4_', '', 1) if c['ph4'] else i; f = dict(f)
        png = os.path.join(os.path.dirname(__file__), '../../pjt/assets/floorplans', zid + '.png')
        if not c['ph4'] and os.path.exists(png) and 'image' not in f:
            f['image'] = {'stringValue': 'data:image/png;base64,' + base64.b64encode(open(png, 'rb').read()).decode()}
        add(f'{R}/{k}/layouts/{zid}', f, f'{k}:배치도')
# 그 밖의 프로젝트(옛 경량): 구조 데이터·자동 공수 1·날짜별 공정(+품목 현재 상태 기준선)
for p in light:
    rid = p['id']; doc = reg[rid]; d = decf(doc); st = S[rid]; imap = OUT['notes'][rid]['itemGroup']; first = OUT['notes'][rid]['groups'][0]
    nf = dict(doc); nf['progressStructure'] = enc(st); nf['migratedAt'] = enc(now_iso); nf['migratedFrom'] = enc('pjt_registry(items)')
    if 'defaultManday' not in d: nf['defaultManday'] = enc(1)
    add(f'{R}/{rid}', nf, 'registry-doc')
    union = set()
    for date, f in fs.list(f'{R}/{rid}/progress_checks'):
        flat = decf(f)
        for kk, vv in flat.items():
            if vv is not True or '_' not in kk: continue
            owner = next((iid for iid in imap if kk.startswith(iid + '_')), None); g = imap.get(owner, first)
            days_all.setdefault((rid, date), {}).setdefault(g, {})[kk] = True; union.add(kk)
    base = {}   # 날짜별 문서가 없는 옛 체크(품목의 현재 상태) → 기준선 날짜 문서
    for it in p['items']:
        for stg, v in (it.get('stages') or {}).items():
            kk = f"{it['id']}_{stg}"
            if v is True and kk not in union: base.setdefault(imap.get(it['id'], first), {})[kk] = True
    if base:
        sd = d.get('startDate') if re.match(r'^\d{4}-\d{2}-\d{2}$', str(d.get('startDate') or '')) else (d.get('createdAt') or '2026-01-01')[:10]
        for g, ch in base.items(): days_all.setdefault((rid, sd), {}).setdefault(g, {}).update(ch)
        say(f'  기준선: {rid} {sd} 에 날짜 기록 없는 체크 {sum(len(v) for v in base.values())}칸을 넣음')
    for sub in ['workers', 'attendance', 'manday', 'schedules', 'reports', 'layouts']: count[f'{rid}:{sub}'] = len(fs.list(f'{R}/{rid}/{sub}'))   # 이미 이 위치에 있음(이동 없음)
for (pid, date), groups in sorted(days_all.items()): add(f'{R}/{pid}/progress_days/{date}', {'groups': enc(groups), 'updatedAt': {'timestampValue': now_iso}}, f'{pid}:공정일')
# 영업기획 프로젝트의 연동 값
for i, f in fs.list('gihoek_projects'):
    d = decf(f); lk = d.get('linkPjt')
    if lk is None:
        lk = 'p4ph4' if (d.get('progProfile') == 'p4ph4' or d.get('mandayCol') == 'ph4_manday') else ('none' if (d.get('mandayCol') == '' and not d.get('progProfile')) else 'p4ph2')
    elif lk.startswith('reg_'): lk = lk[4:]
    if lk != d.get('linkPjt'):
        nf = dict(f); nf['linkPjt'] = enc(lk); add(f'gihoek_projects/{i}', nf, '영업기획 연동값 변경'); say(f'  영업기획 프로젝트 {i}: linkPjt {d.get("linkPjt")} → {lk}')
# ── 3. 출력·실행 ──
say('\n쓰기 계획(%s):' % ('실행' if RUN else '점검만'))
for k in sorted(count): say(f'  {k:28s} {count[k]}')
say(f'총 쓰기 {len(W)}건 (원본은 그대로)')
fs.commit(W); say('완료' if RUN else '(점검만 했습니다 — 쓰기 없음. 실제 이전은 --run)')
json.dump({f'{p}|{d}': v for (p, d), v in days_all.items()}, open('/tmp/mig_days.json', 'w'), ensure_ascii=False)
