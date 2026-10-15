# 테섭 Firestore 보안 규칙 "읽기 전용" 조회 — GET 만 사용, 게시·수정 호출 없음
import json, difflib, re
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession
KEY='/mnt/project/portal-test-6e0ff-firebase-adminsdk-fbsvc-fd25dd577d.json'
cred=service_account.Credentials.from_service_account_file(KEY, scopes=['https://www.googleapis.com/auth/cloud-platform'])
s=AuthorizedSession(cred); PID=json.load(open(KEY))['project_id']; print('프로젝트:',PID,'(읽기 전용)')
r=s.get('https://firebaserules.googleapis.com/v1/projects/%s/releases/cloud.firestore'%PID,timeout=40)
print('릴리스 조회:',r.status_code)
if r.status_code!=200: print(r.text[:300]); raise SystemExit
rel=r.json(); print('게시 시각(updateTime):',rel.get('updateTime'),'| 규칙셋:',rel.get('rulesetName','').split('/')[-1][:12])
rs=s.get('https://firebaserules.googleapis.com/v1/'+rel['rulesetName'],timeout=40); print('규칙 본문 조회:',rs.status_code)
if rs.status_code!=200: print(rs.text[:300]); raise SystemExit
src=rs.json()['source']['files'][0]['content']; open('/tmp/current_test.rules','w',encoding='utf-8').write(src)
cur=src.split('\n'); print('현재 게시 규칙 줄수:',len(cur))
for name in ['firestore.rules_테섭_배포전_백업_2026-10-13.rules','firestore.rules_테섭_수정전_백업2_2026-10-13.rules']:
    b=open('/mnt/user-data/outputs/'+name,encoding='utf-8',errors='replace').read().split('\n')
    d=[l for l in difflib.unified_diff(b,cur,lineterm='',n=0) if not l.startswith(('@@','---','+++'))]
    print('\n[%s] 줄수 %d → 현재와 다른 줄 %d개'%(name,len(b),len(d)))
    for l in d[:12]: print('  ',l[:170])
print('\nedoc_drive 포함:', 'edoc_drive' in src, '| eval_ 규칙 이미 있음:', 'eval_' in src, '| isEvalCollection 이미 있음:', 'isEvalCollection' in src)
