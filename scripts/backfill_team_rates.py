"""master_worker_private.teamRate(없으면 옛 위치 master_workers.teamRate) → team_rates/{팀장ID}.teamRate 복사 스크립트.
팀장 ‘내 팀 공수표’가 읽는 문서를 채운다. 사용: python3 backfill_team_rates.py <서비스계정.json> [--apply]
 · 기본은 건수만 세는 dry-run(읽기 전용, 금액 값은 출력하지 않음).
 · --apply: team_rates에 값이 없는 팀장만 복사한다. 이미 있으면 덮어쓰지 않는다(기획 화면에서 저장한 값이 더 최신). 멱등.
 · 팀장 = master_workers에서 leaderId가 없는 근로자. 단가가 설정되지 않은 팀장은 건너뛴다.
"""
import sys, json, os, datetime, requests
from google.oauth2 import service_account
import google.auth.transport.requests as tr
f=sys.argv[1]; apply='--apply' in sys.argv
EMU=os.environ.get('FIRESTORE_EMULATOR_HOST')
if EMU:
    H={'Authorization':'Bearer owner'}; P='demo-rules'; B=f'http://{EMU}/v1/projects/{P}/databases/(default)/documents'
else:
    cred=service_account.Credentials.from_service_account_file(f,scopes=['https://www.googleapis.com/auth/datastore']); cred.refresh(tr.Request())
    H={'Authorization':'Bearer '+cred.token}; P=json.load(open(f))['project_id']; B=f'https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents'
def list_docs(coll):
    out=[]; tok=None
    while True:
        r=requests.get(f'{B}/{coll}',headers=H,params={'pageSize':300,**({'pageToken':tok} if tok else {})}); r.raise_for_status(); j=r.json()
        out+=j.get('documents',[]); tok=j.get('nextPageToken')
        if not tok: return out
def num(fv):
    if not fv: return None
    if 'integerValue' in fv: return int(fv['integerValue'])
    if 'doubleValue' in fv: return float(fv['doubleValue'])
    return None
masters=list_docs('master_workers'); privs={d['name'].rsplit('/',1)[1]:d for d in list_docs('master_worker_private')}; rates={d['name'].rsplit('/',1)[1] for d in list_docs('team_rates')}
stat={'leaders':0,'no_rate':0,'copy':0,'already':0}; plan=[]
for d in masters:
    lid=d['name'].rsplit('/',1)[1]; fl=d.get('fields',{})
    lv=fl.get('leaderId',{}).get('stringValue','')
    if lv: continue                                   # 팀원은 대상 아님
    stat['leaders']+=1
    v=num(privs.get(lid,{}).get('fields',{}).get('teamRate')); src='private'
    if v is None: v=num(fl.get('teamRate')); src='legacy'   # 옛 위치 폴백
    if v is None: stat['no_rate']+=1; continue
    if lid in rates: stat['already']+=1; continue
    stat['copy']+=1; plan.append((lid,v))
print(P,json.dumps(stat,ensure_ascii=False))
if not apply: print('dry-run (변경 없음). 실제 복사는 --apply'); sys.exit(0)
now=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for lid,v in plan:
    val={'integerValue':str(int(v))} if float(v).is_integer() else {'doubleValue':float(v)}
    r=requests.patch(f'{B}/team_rates/{lid}',headers=H,params=[('updateMask.fieldPaths','teamRate'),('updateMask.fieldPaths','updatedAt')],json={'fields':{'teamRate':val,'updatedAt':{'timestampValue':now}}}); r.raise_for_status()
print('적용 완료')
