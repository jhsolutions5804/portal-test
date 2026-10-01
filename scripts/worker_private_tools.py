#!/usr/bin/env python3
"""근로자 민감 항목(주민번호·계좌·주소·서명)을 workers → worker_private 로 옮기는 도구.
  copy   : workers 의 민감 항목을 worker_private/{ID} 에 복사(원본 유지). portalUid 도 함께 저장(본인 열람 규칙용). 기본은 dry-run, --apply 로 실행.
  scrub  : worker_private 에 같은 값이 있는 것만 workers 에서 민감 항목을 삭제(값이 없거나 다르면 건너뜀). 기본은 dry-run, --apply 로 실행.
  verify : workers 에 민감 항목이 남아 있는지, worker_private 와 값이 어긋나는지 점검(읽기 전용).
출력에는 개인정보 값을 찍지 않는다(필드 이름·개수만)."""
import sys,argparse,time,requests
def token(sa_path):
    import google.auth.transport.requests as tr
    from google.oauth2 import service_account
    c=service_account.Credentials.from_service_account_file(sa_path,scopes=['https://www.googleapis.com/auth/datastore']); c.refresh(tr.Request()); return c.token
ap=argparse.ArgumentParser(); ap.add_argument('cmd',choices=['copy','scrub','verify']); ap.add_argument('--env',choices=['prod','test'],required=True); ap.add_argument('--apply',action='store_true')
a=ap.parse_args()
CFG={'prod':('p4ph2-fab-506a7','/mnt/project/p4ph2-fab-506a7-firebase-adminsdk-fbsvc-f84b0371ec.json'),'test':('portal-test-6e0ff','/mnt/project/portal-test-6e0ff-firebase-adminsdk-fbsvc-fd25dd577d.json')}
PROJ,SA=CFG[a.env]; BASE=f'https://firestore.googleapis.com/v1/projects/{PROJ}/databases/(default)/documents'
S=requests.Session(); S.headers['Authorization']='Bearer '+token(SA)
FIELDS=['jumin','bankAccount','address','signData']
def get_all(col):
    out=[]; tok=None
    while True:
        p={'pageSize':300}; 
        if tok: p['pageToken']=tok
        r=S.get(f'{BASE}/{col}',params=p).json(); out+=r.get('documents',[]); tok=r.get('nextPageToken')
        if not tok: return out
workers=get_all('workers'); priv={d['name'].split('/')[-1]:d.get('fields',{}) for d in get_all('worker_private')}
W={d['name'].split('/')[-1]:d.get('fields',{}) for d in workers}
print(f'[{a.env}] 근로자 {len(W)}명, worker_private {len(priv)}건')
if a.cmd=='copy':
    n=0; skipped=0
    for wid,f in W.items():
        have={k:f[k] for k in FIELDS if k in f}
        if not have: skipped+=1; continue
        pr=dict(have)
        if 'portalUid' in f: pr['portalUid']=f['portalUid']
        pr['migratedAt']={'stringValue':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
        print(f'   복사 대상: {len(have)}개 항목 {sorted(have)}' + (' (portalUid 포함)' if 'portalUid' in pr else ''))
        if a.apply:
            mask='&'.join('updateMask.fieldPaths='+k for k in pr); r=S.patch(f'{BASE}/worker_private/{wid}?{mask}',json={'fields':pr}); assert r.status_code==200,r.text[:200]
            chk=S.get(f'{BASE}/worker_private/{wid}').json().get('fields',{}); assert all(chk.get(k)==have[k] for k in have),'값 불일치 — 중단'
        n+=1
    print(f'{"복사·검증 완료" if a.apply else "[dry-run] 복사 예정"}: {n}명 / 민감 항목이 없어 건너뜀 {skipped}명')
elif a.cmd=='scrub':
    n=0; keep=0
    for wid,f in W.items():
        rm=[k for k in FIELDS if k in f]
        if not rm: continue
        safe=[k for k in rm if k in priv.get(wid,{}) and priv[wid][k]==f[k]]
        unsafe=[k for k in rm if k not in safe]
        # private 쪽이 더 최신 값이면(수정 후 workers 에는 옛 값이 남은 경우) 다르더라도 private 에 값이 있으면 삭제해도 안전
        safe2=[k for k in unsafe if k in priv.get(wid,{})]
        safe+=safe2; unsafe=[k for k in unsafe if k not in safe2]
        if unsafe: keep+=1; print(f'   보존(worker_private 에 없음): {sorted(unsafe)}')
        if safe:
            n+=1
            if a.apply:
                mask='&'.join('updateMask.fieldPaths='+k for k in safe); r=S.patch(f'{BASE}/workers/{wid}?{mask}',json={'fields':{}}); assert r.status_code==200,r.text[:200]
    print(f'{"삭제 완료" if a.apply else "[dry-run] 삭제 예정"}: {n}명의 workers 문서에서 민감 항목 삭제 / worker_private 에 없어 보존한 문서 {keep}건')
else:
    left=sum(1 for f in W.values() if any(k in f for k in FIELDS)); diff=sum(1 for wid,f in W.items() for k in FIELDS if k in f and k in priv.get(wid,{}) and priv[wid][k]!=f[k])
    nopriv=sum(1 for wid,f in W.items() if any(k in f for k in FIELDS) and wid not in priv)
    print(f'workers 에 민감 항목이 남은 문서: {left}건 / worker_private 와 값이 다른 항목: {diff}건 / worker_private 가 없는 문서: {nopriv}건')
    print('→ 모두 0이면 분리 완료' if (left==0 and diff==0 and nopriv==0) else '→ 아직 workers 에 민감 항목이 남아 있음')
