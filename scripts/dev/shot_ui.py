"""실제 브라우저(Chromium) 화면 캡처 도구 — 가짜 로그인(관리자)·가짜 Firestore 샘플 데이터로 앱을 띄워 화면 모양을 눈으로 확인한다.
사용: pip install playwright && playwright install chromium   →   python3 shot_ui.py <경로,경로,…> [pc|phone]   (예: python3 shot_ui.py hr/home,hr/workers,finance/home pc)
환경변수: ACTIONS='[{"click":"선택자","wait":600},{"select":["선택자","값"]}]' 로 캡처 전에 누르기·고르기, TAG=접미사. 결과는 /tmp/jh_shot/ 에 저장.
한계: 가짜 데이터라 실제 데이터 모양·보안 규칙·서버 함수는 못 본다 — 최종 확인은 테섭에서 직접. """
import json, sys, re, threading, http.server, socketserver, os
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..')); os.makedirs('/tmp/jh_shot',exist_ok=True); os.makedirs('/tmp/jh_site',exist_ok=True)
if not os.path.exists('/tmp/jh_site/portal-test'): os.symlink(ROOT,'/tmp/jh_site/portal-test')
NAMES=sorted({n.strip().split(' as ')[0].strip() for f in __import__('glob').glob(ROOT+'/app/**/*.js',recursive=True) for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*'https://[^']*'",open(f,encoding='utf-8',errors='replace').read(),re.S) for n in m.group(1).split(',') if n.strip()})
today='2026-10-13'
def ago(y): return f'{2026-y}-10-13'
D={
 'portal_users':{'u1':{'name':'김짜장','email':'admin@jhsol.kr','status':'approved','admin':True,'empNo':'10001','rank':'대표','dept':'경영지원본부','perms':{}},'u2':{'name':'김가나','email':'a@jhsol.kr','status':'approved','empNo':'20001'}},
 'workers':{'w1':{'name':'김가나','empNo':'20001','rank':'대리','dept':'PJT팀','empType':'field','hireDate':ago(5),'email':'a@jhsol.kr','phone':'010-1111-2222','status':'active','portalUid':'u2','certifications':['기능사'],'step':5,'stepYear':2026},
            'w2':{'name':'이다라','empNo':'25002','rank':'사원','dept':'영업기획팀','empType':'office','hireDate':ago(1),'status':'active'},
            'w3':{'name':'박마바','empNo':'22003','rank':'과장','dept':'인사총무팀','empType':'office','hireDate':ago(4),'status':'active'},
            'w4':{'name':'최퇴사','empNo':'19004','rank':'사원','dept':'PJT팀','empType':'field','hireDate':ago(7),'status':'resigned','resignDate':today}},
 'worker_private':{'w1':{'juminMasked':'900101-1******','bankAccount':'신한 110-123-456789','address':'대전 서구'},'w2':{'jumin':'9505052345678','address':'대전'}},
 'edoc_leave':{'l1':{'dtype':'leave','status':'approved','authorName':'김가나','leaveType':'연차(유급)','startDate':today,'endDate':today,'days':1},'l2':{'dtype':'leave','status':'posted','authorName':'이다라','leaveType':'반차(오전)(유급)','startDate':'2026-10-05','endDate':'2026-10-05','days':0.5,'adminCreated':True}},
 'annual_contracts/w1/contracts':{'20260301':{'workerId':'w1','name':'김가나','contractDate':'2026-03-01','startDate':'2026-03-01','endDate':'2027-02-28','hourly':12000,'salary':30000000,'wageType':'noncomprehensive','tplVer':'v6','savedAt':'2026-10-05T00:00:00.000Z'}},
 'labor_contracts/w1/contracts':{'20260301':{'workerId':'w1','name':'김가나','contractDate':'2026-03-01','startDate':'2026-03-01','endDate':'2027-02-28','hourly':12000,'job':'배관','tplVer':'v6'}},
 'payslips/w1/months':{'2026-09':{'month':'2026-09','payDate':'2026-10-31','name':'김가나','basic':2000000,'grossPay':3000000,'netPay':2700000,'tplVer':'v6'}},
 'overtime':{'o1':{'date':today,'name':'김가나','rank':'대리','workerId':'w1','hours':2,'amount':30000,'rate':15000,'yearMonth':'2026-10','reason':'야간 입고'},'o2':{'date':'2026-10-08','name':'이다라','rank':'사원','workerId':'w2','hours':1.5,'amount':20000,'rate':13000,'yearMonth':'2026-10'}},
 'worker_attendance_log':{'a1':{'workerId':'w1','name':'김가나','date':'2026-10-12','yearMonth':'2026-10','checkIn':'07:00','checkOut':'18:00','breakMinutes':120,'workHours':9},'a2':{'workerId':'w1','name':'김가나','date':'2026-10-13','yearMonth':'2026-10','checkIn':'07:10','checkOut':'17:50','breakMinutes':120,'workHours':8.67,'isBusinessTrip':True,'tripType':'company_car'}},
 'salary_offers':{'s1':{'name':'김후보','kind':'new','applicantId':'a1','savedAt':today}},'job_postings':{'j1':{'title':'배관 기능공 모집','status':'open','createdAt':today}},'recruit_applicants':{'a1':{'name':'김후보','status':'new','phone':'010-1','appliedAt':today}},
 'hr_calendar_events':{'c1':{'date':today,'title':'시험 일정','type':'etc'}},'company_settings':{'salaryTable':{'minWage':10320,'techAllowancePerCert':50000},'signatures':{}},
 'leave_promotions/w1/records':{'r1':{'stage':'p1','category':'y1','periodStart':'2026-01-01','noticeDate':'2026-07-01','unusedDays':10,'method':'직접 교부(수령 서명)'}},
 'hr_calendar_access':{'config':{'emails':['admin@jhsol.kr']}},'evaluations/w1/records':{'v1':{'type':'regular','grade':'A','date':today}},'interviews/w1/records':{'i1':{'date':today,'topic':'면담'}},
 'edoc_overtime':{'e1':{'status':'approved','date':today,'name':'이다라','rank':'사원','workerId':'w2','hours':1,'amount':10000,'rate':10000}},
 'gihoek_companies':{'jheng':{'company':'제이에이치이엔지','ceo':'김영희','roleSupplier':True,'roleClient':True,'contacts':[{'name':'김','tel':'010-1111-2222','email':'a@b.c'}],'tel':'010-3735-7891'},'jhsol':{'company':'제이에이치솔루션','roleSupplier':True,'roleClient':False,'contacts':[]},'daram':{'company':'다람이엔지','roleSupplier':False,'roleClient':True,'ceo':'박대표','bizno':'123-45-67890','contacts':[]},'sj':{'company':'에스제이','roleSupplier':False,'roleClient':True,'roleVendor':True,'contacts':[]},'gtr':{'company':'귀뚜라미범양냉방','roleSupplier':False,'roleClient':True,'contacts':[]}},
 'gihoek_projects':{'pjt_1782285557624':{'code':'P4 Ph2 (FAB동) FCU','name':'FCU 183대 설치','site':'P4 Ph2','client':'귀뚜라미범양냉방','type':'fcu','status':'run','linkPjt':'p4ph2','createdAt':{'seconds':1782285557}},'pjt_1784786243034':{'code':'H17L Gas RM. 전환공사','name':'AHU 설치 공사','site':'H3 17L','client':'삼성전자','contractor':'삼성중공업','type':'general','status':'run','linkPjt':'reg_REG1','createdAt':{'seconds':1784786243}},'pjt_1790924923339':{'code':'M14 CTH','name':'CTH 13대 설치','site':'이천 M14','client':'SK하이닉스','type':'fcu','status':'done','linkPjt':'none','createdAt':{'seconds':1790924923}}},
 'pjt_registry':{'REG1':{'name':'H17L Gas RM. 전환공사','status':'active'},'REG2':{'name':'다른 현장','status':'active'}},
 'gihoek_estimates':{'est1':{'no':'EST-2026-001','baseNo':'EST-2026-001','replacedBy':'EST-2026-001-r2','title':'FCU 183대 설치 견적','pjtId':'pjt_1782285557624','date':'2026-05-10','status':'void','rev':1,'items':[{'qty':183,'price':100000}],'client':{'company':'다람이엔지'}},'est2':{'no':'EST-2026-001-r2','baseNo':'EST-2026-001','issuer':{'company':'제이에이치솔루션','ceo':'이','bizno':'111-22-33333'},'client':{'company':'다람이엔지','ceo':'박대표','bizno':'123-45-67890','contact':'최과장'},'authorName':'김짜장','notes':'납기: 계약 후 2주','title':'FCU 183대 설치 견적','pjtId':'pjt_1782285557624','date':'2026-05-20','status':'active','rev':2,'items':[{'qty':183,'price':95000}],'client':{'company':'다람이엔지'}},'est3':{'no':'EST-2026-005','title':'구 견적','pjtId':'pjt_1782285557624','date':'2026-01-10','status':'void','items':[{'amount':1000}]}},
 'gihoek_settlements':{'set1':{'no':'2606001','docType':'invoice','status':'done','pjtId':'pjt_1782285557624','amount':5000000,'supply':5000000,'vat':500000,'total':5500000,'baseMonth':'2026-05','issueDate':'2026-06-30','payDate':'2026-07-31','method':'manual','lines':[{'name':'FCU 설치 1차','amount':5000000}],'sender':{'company':'제이에이치이엔지','ceo':'김영희'},'recipient':{'company':'다람이엔지'}},'set2':{'no':'2607001','docType':'invoice','status':'active','pjtId':'pjt_1782285557624','amount':2000000,'supply':2000000,'vat':200000,'total':2200000,'baseMonth':'2026-06','issueDate':'2026-07-31','payDate':'2026-08-31','method':'progress','lines':[{'name':'공정 정산','spec':'40%','amount':2000000}],'sender':{'company':'제이에이치이엔지','ceo':'김영희'},'recipient':{'company':'다람이엔지'},'pjtIds':['pjt_1782285557624','pjt_1784786243034'],'perPjtAmount':{'pjt_1782285557624':1200000,'pjt_1784786243034':800000}},'set3':{'no':'2607002','docType':'payment','status':'done','pjtId':'pjt_1782285557624','amount':3000000,'supply':3000000,'vat':300000,'total':3300000,'baseMonth':'2026-06','issueDate':'2026-07-31','payDate':'2026-08-10','method':'manday','lines':[{'name':'공수 정산','amount':3000000}],'sender':{'company':'제이에이치솔루션','ceo':'이'},'recipient':{'company':'에스제이'}},'set5':{'no':'2608001','docType':'payment','status':'active','pjtId':'pjt_1782285557624','amount':1000000,'supply':1000000,'vat':100000,'total':1100000,'baseMonth':'2026-07','issueDate':'2026-08-31','payDate':'2026-09-10','method':'manual','lines':[{'name':'기타 지급','spec':'식대','amount':1000000}],'sender':{'company':'제이에이치솔루션','ceo':'이'},'recipient':{'company':'에스제이'}}},
 'general_leases':{'g1':{'name':'원희캐슬 B111','kind':'office','deposit':10000000,'rent':800000,'status':'active'}},'general_vehicles':{'v1':{'name':'스타리아','plate':'12가3456','status':'active'}},
}
FS = '''
const D = window.__DATA = window.__DATA || {}; const rows=(p)=>Object.entries(D[p]||{});
export const getFirestore=()=>({}); export const collection=(db,...s)=>({__t:'col',path:s.join('/')});
export const doc=(a,...s)=>{ if(a&&a.__t==='col'){const i=s[0]||('auto'+Math.random().toString(36).slice(2,7)); return {__t:'doc',path:a.path+'/'+i,id:i,coll:a.path};} const p=s.join('/'),q=p.split('/'); return {__t:'doc',path:p,id:q[q.length-1],coll:q.slice(0,-1).join('/')}; };
export const where=(f,op,v)=>({__c:'w',f,op,v}); export const orderBy=(f,d)=>({__c:'o',f,d}); export const limit=(n)=>({__c:'l',n}); export const query=(c,...cs)=>({__t:'q',path:c.path,cs});
const snap=(path,rs)=>{const docs=rs.map(([i,d])=>({id:i,data:()=>d,ref:{__t:'doc',path:path+'/'+i,id:i,coll:path},exists:()=>true}));return {docs,size:docs.length,empty:!docs.length,forEach:(f)=>docs.forEach(f)};};
export const getDocs=async(q)=>{let r=rows(q.path);(q.cs||[]).forEach((c)=>{if(c.__c==='w'){r=r.filter(([,d])=>{const x=d[c.f];if(c.op==='==')return x===c.v;if(c.op==='!=')return x!==c.v;if(c.op==='in')return (c.v||[]).includes(x);if(c.op==='>=')return x>=c.v;if(c.op==='<=')return x<=c.v;if(c.op==='>')return x>c.v;if(c.op==='<')return x<c.v;if(c.op==='array-contains')return (x||[]).includes(c.v);return true;});}else if(c.__c==='o'){r=r.slice().sort(([,a],[,b])=>{const x=a[c.f],y=b[c.f];return (x>y?1:x<y?-1:0)*(c.d==='desc'?-1:1);});}else if(c.__c==='l')r=r.slice(0,c.n);});return snap(q.path,r);};
export const getDoc=async(r)=>{const d=(D[r.coll]||{})[r.id];return {exists:()=>!!d,data:()=>d,id:r.id,ref:r};};
export const setDoc=async(r,data,o)=>{(D[r.coll]=D[r.coll]||{})[r.id]=Object.assign({},o&&o.merge?(D[r.coll][r.id]||{}):{},data);}; export const addDoc=async(c,data)=>{const i='auto'+Math.random().toString(36).slice(2,7);(D[c.path]=D[c.path]||{})[i]=data;return {id:i};};
export const updateDoc=async(r,data)=>{const o=(D[r.coll]||{})[r.id];if(o)Object.assign(o,data);}; export const deleteDoc=async(r)=>{if(D[r.coll])delete D[r.coll][r.id];};
export const deleteField=()=>({__del:1}); export const serverTimestamp=()=>({toDate:()=>new Date(),toMillis:()=>Date.now()}); export const Timestamp={fromMillis:(n)=>({toMillis:()=>n,toDate:()=>new Date(n)})};
export const writeBatch=()=>({set(){},update(){},delete(){},commit:async()=>{}}); export const onSnapshot=(q,cb)=>{setTimeout(()=>cb(q.__t==='doc'?{exists:()=>false,data:()=>null}:snap(q.path,rows(q.path))),0);return ()=>{};};
'''
# 구포털 페이지(iframe 으로 열리는 gihoek 등)가 가져오는 이름도 가짜 모듈에 넣는다
for _hf in ['gihoek/index.html']:
    try:
        for _m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*'https://[^']*'",open(os.path.join(ROOT,_hf),encoding='utf-8',errors='replace').read(),re.S):
            NAMES=sorted(set(NAMES)|{_n.strip().split(' as ')[0].strip() for _n in _m.group(1).split(',') if _n.strip()})
    except Exception: pass
def dummies(skip): return '\n'.join(f'export const {n} = (...a) => ({{__stub:"{n}"}});' for n in NAMES if n not in skip)
MODS={
 'firebase-app.js':'export const initializeApp=(c)=>({options:c}); export const getApp=()=>({}); export default {};',
 'firebase-auth.js':'const user={uid:"u1",email:"admin@jhsol.kr"}; export const getAuth=()=>({currentUser:user}); export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(user),0);return()=>{};}; export const signInWithEmailAndPassword=async()=>({user}); export const signOut=async()=>{}; export const updatePassword=async()=>{}; export const reauthenticateWithCredential=async()=>{}; export const sendPasswordResetEmail=async()=>{}; export const EmailAuthProvider={credential:()=>({})}; export default {};',
 'firebase-storage.js':'export const getStorage=()=>({}); export const ref=()=>({}); export const uploadBytesResumable=()=>({on(){},then(){}}); export const getDownloadURL=async()=>"x"; export const deleteObject=async()=>{}; export default {};',
 'firebase-functions.js':'export const getFunctions=()=>({}); export const httpsCallable=()=>async()=>({data:{}}); export default {};',
 'firebase-firestore.js':FS,
}
def handler(route):
    name=route.request.url.split('/')[-1].split('?')[0]
    src=MODS.get(name)
    if src is None: return route.fulfill(status=404,body='')
    exp=set(re.findall(r'export (?:const|async function|function) (\w+)',src))
    route.fulfill(status=200,content_type='application/javascript',body=src+'\n'+dummies(exp))
PORT=8765
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def serve():
    os.chdir('/tmp/jh_site'); socketserver.TCPServer.allow_reuse_address=True
    with socketserver.TCPServer(('127.0.0.1',PORT),Q) as s: s.serve_forever()
threading.Thread(target=serve,daemon=True).start()
routes=sys.argv[1].split(',') ; size=sys.argv[2] if len(sys.argv)>2 else 'pc'
vw={'pc':(1440,900),'phone':(390,844),'tall':(1440,2000)}[size]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':vw[0],'height':vw[1]}); ctx.add_init_script('window.__DATA='+json.dumps(D)+';')
    ctx.route('https://www.gstatic.com/firebasejs/**',handler); ctx.route(re.compile(r'https://(?!www\.gstatic).*'),lambda r: r.fulfill(status=200,body='',content_type='text/plain') if r.request.url.startswith('https://') else r.continue_())
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)[:200])); pg.on('console',lambda m: errs.append('CONSOLE '+m.text[:200]) if m.type=='error' else None)
    for rt in routes:
        errs.clear(); pg.goto(f'http://127.0.0.1:{PORT}/portal-test/app/index.html#/{rt}'); pg.wait_for_timeout(2200)
        for a in json.loads(os.environ.get('ACTIONS','[]')):
            try:
                if 'click' in a: pg.click(a['click'],timeout=3000)
                elif 'select' in a: pg.select_option(a['select'][0],a['select'][1])
                elif 'fill' in a: pg.fill(a['fill'][0],a['fill'][1])
                elif 'expect_frame' in a:
                    pg.wait_for_timeout(a.get('wait',2500)); found=any(a['expect_frame'] in (f.inner_text('body') if f!=pg.main_frame else '') for f in pg.frames if f!=pg.main_frame); print('   iframe 안에 "'+a['expect_frame']+'" 있음:',found); (errs.append('iframe 에 없음: '+a['expect_frame']) if not found else None)
                pg.wait_for_timeout(a.get('wait',500))
            except Exception as e: errs.append('ACTION '+str(a)[:80]+' → '+str(e)[:100])
        fn=f'/tmp/jh_shot/{size}_'+rt.replace('/','_')+os.environ.get('TAG','')+'.png'; pg.screenshot(path=fn); print(rt,'→',fn,'| 오류',len(errs),(errs[:2] if errs else ''))
    b.close()
