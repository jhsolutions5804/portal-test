#!/usr/bin/env python3
"""근로자 문서 ID 이전 도구 — '이름_주민번호13자리' 형식의 workers 문서 ID를 임의 ID로 바꾼다.
경로(문서 ID·상위 문서 ID)와 필드 값 안의 옛 ID를 전부 새 ID로 바꾸고, 옛 문서는 새 문서 검증 후 삭제한다.
모드: dry-run(기본, 읽기만) / --apply / --rollback.   매핑은 portal_secrets/worker_id_migration(관리자 전용)에 저장."""
import sys,re,json,secrets,argparse,concurrent.futures as cf,requests,time
def token(sa_path, scope):   # 서비스 계정 키 파일로 액세스 토큰 발급 (pip install google-auth requests)
    import google.auth.transport.requests as tr
    from google.oauth2 import service_account
    c = service_account.Credentials.from_service_account_file(sa_path, scopes=[scope]); c.refresh(tr.Request()); return c.token
ap=argparse.ArgumentParser(); ap.add_argument('--env',choices=['prod','test'],required=True)
ap.add_argument('--apply',action='store_true'); ap.add_argument('--rollback',action='store_true'); ap.add_argument('--delete-old',action='store_true')
a=ap.parse_args()
# 서비스 계정 키 파일 경로(비밀 — 저장소에 올리지 말 것). 환경에 맞게 바꿔서 실행.
CFG={'prod':('p4ph2-fab-506a7','/mnt/project/p4ph2-fab-506a7-firebase-adminsdk-fbsvc-f84b0371ec.json'),
     'test':('portal-test-6e0ff','/mnt/project/portal-test-6e0ff-firebase-adminsdk-fbsvc-fd25dd577d.json')}
PROJ,SA=CFG[a.env]; BASE=f'https://firestore.googleapis.com/v1/projects/{PROJ}/databases/(default)/documents'
S=requests.Session(); S.headers['Authorization']='Bearer '+token(SA,'https://www.googleapis.com/auth/datastore')
OLD=re.compile(r'^[가-힣\[\]\s]{2,12}_\d{13}$')      # [테스트] 홍길동_1101… 도 포함
def api(method,path,**kw):
    for i in range(4):
        r=S.request(method,path if path.startswith('http') else BASE+path,timeout=60,**kw)
        if r.status_code in (429,500,503): time.sleep(1.5*(i+1)); continue
        return r
    return r
def list_cols(parent=''):
    r=api('POST',parent+':listCollectionIds',json={'pageSize':300}); return r.json().get('collectionIds',[]) if r.status_code==200 else []
def list_docs(colpath):
    out=[]; tok=None
    while True:
        p={'pageSize':300,'showMissing':'true'}
        if tok: p['pageToken']=tok
        r=api('GET','/'+colpath,params=p).json()
        out+=r.get('documents',[]); tok=r.get('nextPageToken')
        if not tok: return out
def crawl():
    """전체 DB를 재귀적으로 훑어 [(경로, fields 또는 None)] 반환"""
    res=[]
    def walk_col(colpath):
        docs=list_docs(colpath); sub=[]
        for d in docs:
            path=d['name'].split('/documents/')[1]
            res.append((path,d.get('fields')))
            sub.append(path)
        return sub
    frontier=[c for c in list_cols()]
    with cf.ThreadPoolExecutor(8) as ex:
        while frontier:
            subs=[]
            for docpaths in ex.map(walk_col,frontier): subs+=docpaths
            # 각 문서의 하위 컬렉션 탐색
            nxt=[]
            for cols,dp in zip(ex.map(lambda p:list_cols('/'+p),subs),subs):
                nxt+=[dp+'/'+c for c in cols]
            frontier=nxt
    return res
def sub_val(v,m):
    if isinstance(v,dict):
        out={}
        for k,x in v.items():
            if k=='stringValue':
                s=x
                for o,n in m.items(): s=s.replace(o,n)
                out[k]=s
            else: out[k]=sub_val(x,m)
        return out
    if isinstance(v,list): return [sub_val(x,m) for x in v]
    return v
def contains(v,olds):
    if isinstance(v,dict): return any(contains(x,olds) for x in v.values())
    if isinstance(v,list): return any(contains(x,olds) for x in v)
    if isinstance(v,str): return any(o in v for o in olds)
    return False
def mask(s): return re.sub(r'(\d{2})\d{11}',r'\1●●●●●●●●●●●',s)
t0=time.time()
if a.rollback:
    r=api('GET','/portal_secrets/worker_id_migration'); assert r.status_code==200,'매핑 문서 없음'
    f=r.json()['fields']['map']['mapValue']['fields']; mp={v['stringValue']:k for k,v in f.items()}   # new→old
    mode='롤백'
else:
    docs=api('GET','/workers',params={'pageSize':300,'showMissing':'true'}).json().get('documents',[])
    ids=[d['name'].split('/')[-1] for d in docs]
    mp={i:'w_'+secrets.token_hex(8) for i in ids if OLD.match(i)}
    mode='이전'
print(f'[{a.env}] {mode} 대상 ID {len(mp)}개 (예: {mask(next(iter(mp)))} → {next(iter(mp.values()))})' if mp else f'[{a.env}] 대상 없음'); 
if not mp: sys.exit(0)
data=crawl(); print(f'전체 문서 {len(data)}건 점검 ({time.time()-t0:.0f}초)')
olds=list(mp)
path_hits=[(p,f) for p,f in data if any(o in p for o in olds)]
field_hits=[(p,f) for p,f in data if not any(o in p for o in olds) and f and contains(f,olds)]
import collections
byc=collections.Counter(p.split('/')[0] for p,f in path_hits); fc=collections.Counter(p.split('/')[0] for p,f in field_hits)
print('\n경로에 옛 ID가 들어 있어 문서 이동이 필요한 곳(컬렉션: 문서 수 / 그중 데이터 없는 상위 문서):')
for c,n in byc.most_common(): print(f'   {c:28s} {n:4d}건 (빈 상위 문서 {sum(1 for p,f in path_hits if p.split("/")[0]==c and f is None)})')
print('경로는 그대로이고 필드 값만 바꿀 곳:'); 
for c,n in fc.most_common(): print(f'   {c:28s} {n:4d}건')
if not a.apply and not a.rollback:
    print('\n[dry-run] 아무것도 변경하지 않았습니다. 적용하려면 --apply'); sys.exit(0)
# ───────── 적용 ─────────
def newpath(p): 
    for o,n in mp.items(): p=p.replace(o,n)
    return p
if a.apply:   # 매핑 저장(관리자 전용 컬렉션) — 롤백용
    body={'fields':{'map':{'mapValue':{'fields':{o:{'stringValue':n} for o,n in mp.items()}}},'createdAt':{'stringValue':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}}}
    r=api('PATCH','/portal_secrets/worker_id_migration',json=body); assert r.status_code==200,r.text[:200]; print('매핑 저장: portal_secrets/worker_id_migration')
ok=0; fail=[]
for p,f in path_hits:
    if f is None: continue            # 빈 상위 문서는 옮길 데이터가 없음
    np_=newpath(p); nf=sub_val(f,mp)
    r=api('PATCH','/'+np_,json={'fields':nf}); 
    if r.status_code!=200: fail.append((np_,r.status_code)); continue
    chk=api('GET','/'+np_).json().get('fields')
    if chk!=nf: fail.append((np_,'값 불일치'))
    else: ok+=1
for p,f in field_hits:
    nf=sub_val(f,mp); r=api('PATCH','/'+p,json={'fields':nf})
    if r.status_code!=200: fail.append((p,r.status_code))
    else: ok+=1
print(f'새 문서 생성·값 검증: {ok}건 성공, 실패 {len(fail)}건',fail[:3])
assert not fail,'실패가 있어 옛 문서를 삭제하지 않고 중단'
if a.apply or a.rollback:
    deleted=0
    for p,f in path_hits:
        if f is None: continue
        r=api('DELETE','/'+p); deleted+= (r.status_code==200)
    print(f'옛 문서 삭제 {deleted}건')
    # 재점검
    again=crawl(); left=[p for p,f in again if any(o in p for o in olds) and f is not None]; leftf=[p for p,f in again if f and contains(f,olds)]
    print(f'재점검: 옛 ID가 남은 문서 {len(left)+len(leftf)}건 / 전체 문서 수 {len(data)}→{len(again)}')
