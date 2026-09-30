"""master_workers.{teamRate,dailyRate} → master_worker_private (관리자 전용) 이전 스크립트.
사용: python3 migrate_money.py <서비스계정.json> [--apply]
 · 기본은 건수만 세는 dry-run(읽기 전용, 금액 값은 출력하지 않음).
 · --apply: ① private에 값이 없으면 복사 → ② private 값이 확인된 필드만 master_workers에서 제거. 여러 번 실행해도 안전(멱등).
"""
import sys, json, requests
from google.oauth2 import service_account
import google.auth.transport.requests as tr
import os
f=sys.argv[1]; apply='--apply' in sys.argv
EMU=os.environ.get('FIRESTORE_EMULATOR_HOST')          # 로컬 에뮬레이터 검증용
if EMU:
    H={'Authorization':'Bearer owner'}; P='demo-rules'; B=f'http://{EMU}/v1/projects/{P}/databases/(default)/documents'
else:
    cred=service_account.Credentials.from_service_account_file(f,scopes=['https://www.googleapis.com/auth/datastore'])
    cred.refresh(tr.Request()); H={'Authorization':'Bearer '+cred.token}
    P=json.load(open(f))['project_id']; B=f'https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents'
FIELDS=['teamRate','dailyRate']
def list_docs(coll):
    out=[]; tok=None
    while True:
        r=requests.get(f'{B}/{coll}',headers=H,params={'pageSize':300,**({'pageToken':tok} if tok else {})}); r.raise_for_status(); j=r.json()
        out+=j.get('documents',[]); tok=j.get('nextPageToken')
        if not tok: return out
def val(fv):  # firestore typed value -> python number/None
    if fv is None: return None
    if 'integerValue' in fv: return int(fv['integerValue'])
    if 'doubleValue' in fv: return float(fv['doubleValue'])
    return None
masters=list_docs('master_workers'); privs={d['name'].rsplit('/',1)[1]:d for d in list_docs('master_worker_private')}
stat={'masters':len(masters),'with_money':0,'copy':0,'already_in_private':0,'conflict':0,'remove':0}
plan=[]
for d in masters:
    wid=d['name'].rsplit('/',1)[1]; fl=d.get('fields',{}); pf=privs.get(wid,{}).get('fields',{})
    has=[k for k in FIELDS if k in fl]
    if not has: continue
    stat['with_money']+=1
    copy={}; rem=[]
    for k in has:
        mv=val(fl[k])
        if k in pf:
            stat['already_in_private']+=1
            if val(pf[k])!=mv: stat['conflict']+=1     # private 값을 우선(더 최신)으로 보고 그대로 둔다
        else: copy[k]=fl[k]; stat['copy']+=1
        rem.append(k)
    plan.append((wid,copy,rem))
stat['remove']=sum(len(r) for _,_,r in plan)
print(P, json.dumps(stat,ensure_ascii=False))
if not apply: print('dry-run (변경 없음). 실제 이전은 --apply'); sys.exit(0)
for wid,copy,rem in plan:
    if copy:
        r=requests.patch(f'{B}/master_worker_private/{wid}',headers=H,params=[('updateMask.fieldPaths',k) for k in copy],json={'fields':copy}); r.raise_for_status()
    chk=requests.get(f'{B}/master_worker_private/{wid}',headers=H).json().get('fields',{})
    safe=[k for k in rem if k in chk]                       # private에 값이 실제로 있는 필드만 옛 위치에서 제거
    if safe:
        r=requests.patch(f'{B}/master_workers/{wid}',headers=H,params=[('updateMask.fieldPaths',k) for k in safe],json={'fields':{}}); r.raise_for_status()
print('적용 완료')
