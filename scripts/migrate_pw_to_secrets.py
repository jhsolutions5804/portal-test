"""portal_users.{_pw} → portal_secrets/{uid}.pw 이전 스크립트.
사용: python3 migrate_pw_to_secrets.py <서비스계정.json> [--apply]
 · 기본은 건수만 세는 dry-run(읽기 전용, 비밀번호 값은 어디에도 출력하지 않음).
 · --apply: ① portal_secrets에 값이 없으면 복사 → ② portal_secrets에 값이 실제로 있는 계정만 계정 문서에서 _pw 제거. 멱등(여러 번 실행해도 안전).
   portal_secrets에 이미 값이 있으면(더 최신) 그 값을 우선하고 계정 문서의 _pw만 제거한다.
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
users=list_docs('portal_users'); secrets={d['name'].rsplit('/',1)[1]:d for d in list_docs('portal_secrets')}
stat={'users':len(users),'with_pw':0,'copy':0,'secret_already':0,'remove':0}; plan=[]
for d in users:
    uid=d['name'].rsplit('/',1)[1]; fl=d.get('fields',{})
    if '_pw' not in fl: continue
    stat['with_pw']+=1
    has_secret=uid in secrets and 'pw' in secrets[uid].get('fields',{})
    if has_secret: stat['secret_already']+=1
    else: stat['copy']+=1
    stat['remove']+=1; plan.append((uid,fl['_pw'],has_secret))
print(P,json.dumps(stat,ensure_ascii=False))
if not apply: print('dry-run (변경 없음). 실제 이전은 --apply'); sys.exit(0)
now=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for uid,pwv,has_secret in plan:
    if not has_secret:
        r=requests.patch(f'{B}/portal_secrets/{uid}',headers=H,params=[('updateMask.fieldPaths','pw'),('updateMask.fieldPaths','migratedAt')],json={'fields':{'pw':pwv,'migratedAt':{'timestampValue':now}}}); r.raise_for_status()
    chk=requests.get(f'{B}/portal_secrets/{uid}',headers=H).json().get('fields',{})
    if 'pw' in chk:                                            # 새 위치에 실제로 있을 때만 옛 위치에서 제거
        r=requests.patch(f'{B}/portal_users/{uid}',headers=H,params=[('updateMask.fieldPaths','_pw')],json={'fields':{}}); r.raise_for_status()
print('적용 완료')
