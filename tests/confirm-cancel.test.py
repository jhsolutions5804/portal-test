"""확인창을 취소했을 때 동작이 실행되지 않는지, 확인했을 때는 실행되는지 — 실제 크로미움·실제 확인창(core/dialog.js)·실제 화면 부품으로 시험한다.
배경(2026-10-18): confirmDialog 는 { ok, reason } 객체를 돌려주는데 객체는 항상 참이라 `if (!ok) return` 으로는 취소가 걸러지지 않았다.
가짜 확인창이 불리언을 돌려주던 시험은 이 버그를 가렸다 → 가짜 없이 실제 확인창을 쓴다. 서버 호출(firebase.js)만 가짜로 대체해 호출 수를 센다.
크로미움(playwright)이 없으면 건너뛴다."""
import http.server, threading, socketserver, sys, os
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('SKIP playwright 없음 — 건너뜀'); sys.exit(0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
httpd = socketserver.TCPServer(('127.0.0.1', 0), H); port = httpd.server_address[1]; threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d' % port; VER = '20261018e'
FAKE_FB = """export const functions={}; export const httpsCallable=(f,n)=>async(p)=>{(window.__calls=window.__calls||[]).push(p);
 window.__cal=window.__cal||{}; if(p.action==='calendarAdd'){ window.__cal[p.id]='log_'+p.id; await new Promise(r=>setTimeout(r,150)); return {data:{ok:true,scheduleId:'log_'+p.id}}; } if(p.action==='list')return {data:{ok:true,today:'2026-10-18',urgent:[],changes:[],entries:[{id:'e1',date:'2026-10-18',category:'발주처 요청·지시',title:'시험 항목',source:'메일',status:'confirmed',claimedBy:'u1',claimedByName:'나',replyDetected:false,impactChecked:false,restricted:false,createdByName:'',createdByMe:false,createdMs:0,auto:false,dueDate:'',due:null},{id:'e4',date:'2026-10-18',category:'발주처 요청·지시',title:'기한 있는 확정 항목',source:'메일',status:'confirmed',claimedBy:'u1',claimedByName:'나',replyDetected:false,impactChecked:false,restricted:false,createdByName:'',createdByMe:false,createdMs:0,auto:false,dueDate:'2026-10-22',due:null,calendarId:(window.__cal||{})['e4']||''},{id:'e2',date:'2026-10-17',category:'회의 결정',title:'완료된 시험 항목',source:'메일',status:'done',claimedBy:'u1',claimedByName:'나',replyDetected:false,impactChecked:false,restricted:false,createdByName:'',createdByMe:true,createdMs:0,auto:false,dueDate:'',due:null}],total:2,canConfirm:true,isManager:true}};
 if(p.action==='inboxList')return {data:{ok:true,items:[{id:'a'.repeat(32),date:'2026-10-18',category:'발주처 요청·지시',title:'미분류 시험 메일',sourceRef:'',dueDate:'',restricted:false,siteHint:''}],projects:[{id:'p1',name:'P4 Ph2'}],total:1}};
 return {data:{ok:true}}};"""
PAGE = """<!doctype html><meta charset=utf-8><link rel=stylesheet href="%(b)s/theme/tokens.css"><link rel=stylesheet href="%(b)s/theme/base.css"><link rel=stylesheet href="%(b)s/theme/components.css"><link rel=stylesheet href="%(b)s/theme/pjt.css"><div id=log></div><div id=inbox></div>
<script type=module>import { createLogPanel } from "%(b)s/modules/pjt/log-panel.js?v=%(v)s"; import { createInboxPanel } from "%(b)s/modules/pjt/inbox-panel.js?v=%(v)s"; import { confirmDialog } from "%(b)s/core/dialog.js?v=%(v)s"; import { functions, httpsCallable } from "%(b)s/core/firebase.js?v=%(v)s";
window.__lp=createLogPanel(document.getElementById('log'),{proj:'p1',label:'시험',me:{uid:'u1'}});
window.__ip=createInboxPanel(document.getElementById('inbox'),{callLog:async(x)=>(await httpsCallable(functions,'pjtLogAct')(x)).data,confirm:confirmDialog});
await Promise.all([window.__lp.ready,window.__ip.ready]); window.__ready=true;</script>""" % {'b': BASE, 'v': VER}
pass_n = fail_n = 0
def ok(c, m):
    global pass_n, fail_n
    if c: pass_n += 1; print('OK ' + m)
    else: fail_n += 1; print('FAIL ' + m)
with sync_playwright() as p:
    b = p.chromium.launch()
    def fresh():
        pg = b.new_page(viewport={'width': 1200, 'height': 900})
        pg.route('**/core/firebase.js*', lambda r: r.fulfill(status=200, content_type='text/javascript', body=FAKE_FB))
        pg.route(BASE + '/__t.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE))
        pg.goto(BASE + '/__t.html'); pg.wait_for_function('window.__ready===true', timeout=15000); pg.evaluate('window.__calls=[]'); return pg
    def calls(pg, action): return [c for c in pg.evaluate('window.__calls') if c.get('action') == action]
    CASES = [('이력 종결', '[data-lg-act="closed"]', 'setStatus'), ('이력 보류', '[data-lg-act="hold"]', 'setStatus'), ('받은함 치우기(이 현장 아님)', '[data-ib-act="dismiss"]', 'inboxDismiss')]
    for name, sel, action in CASES:
        pg = fresh(); btn = pg.query_selector(sel)
        if not btn: ok(False, name + ': 버튼을 찾지 못함(시험 자료 점검 필요)'); pg.close(); continue
        btn.scroll_into_view_if_needed(); btn.click(timeout=5000); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.click('.jh-dialog [data-cancel].jh-btn', timeout=5000); pg.wait_for_timeout(300)
        ok(len(calls(pg, action)) == 0, '★ %s: 취소 버튼을 누르면 서버를 부르지 않는다' % name); ok(pg.query_selector('.jh-dialog') is None, name + ': 취소하면 확인창이 닫힌다'); pg.close()
        pg = fresh(); b2 = pg.query_selector(sel); b2.scroll_into_view_if_needed(); b2.click(timeout=5000); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        ok(len(calls(pg, action)) == 0, '★ %s: Esc 키로 닫아도 서버를 부르지 않는다' % name); pg.close()
        pg = fresh(); b3 = pg.query_selector(sel); b3.scroll_into_view_if_needed(); b3.click(timeout=5000); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.click('.jh-dialog__backdrop', position={'x': 5, 'y': 5}, timeout=5000); pg.wait_for_timeout(300)
        ok(len(calls(pg, action)) == 0, '★ %s: 바깥(배경)을 눌러 닫아도 서버를 부르지 않는다' % name); pg.close()
        pg = fresh(); b4 = pg.query_selector(sel); b4.scroll_into_view_if_needed(); b4.click(timeout=5000); pg.wait_for_selector('.jh-dialog', timeout=5000); pg.click('.jh-dialog [data-ok]', timeout=5000); pg.wait_for_timeout(400)
        ok(len(calls(pg, action)) == 1, '%s: 확인 버튼을 누르면 서버를 정확히 한 번 부른다' % name); pg.close()
    # ── 캘린더에 넣기(설계 §8): 확인창 없이 서버를 한 번만 부르고, 목록을 다시 읽어 "캘린더에 있음" 칩이 나타난다
    pg = fresh(); btn = pg.query_selector('[data-lg-act="calendar"]')
    if not btn: ok(False, '캘린더에 넣기: 기한 있는 확정 항목에 버튼이 없음(시험 자료 점검 필요)')
    else:
        btn.scroll_into_view_if_needed(); btn.click(timeout=5000); pg.wait_for_timeout(700)
        c = calls(pg, 'calendarAdd'); ok(len(c) == 1 and c[0].get('id') == 'e4' and c[0].get('pjtId') == 'p1', '★ 캘린더에 넣기: 서버를 정확히 한 번, 그 항목 번호와 프로젝트로 부른다')
        ok(pg.query_selector('.jh-dialog') is None, '캘린더에 넣기: 확인창을 띄우지 않는다(되돌릴 수 있는 일이라 설계 §8-4 대로 한 번에)')
        ok('캘린더에 있음' in pg.inner_text('#log'), '★ 캘린더에 넣기: 목록을 다시 읽어 "📅 캘린더에 있음" 칩이 나타난다')
        ok(pg.query_selector('[data-lg-act="calendar"]') is None, '캘린더에 넣기: 칩이 나타난 뒤에는 버튼이 사라진다(중복 방지)')
    pg.close()
    pg = fresh(); btn = pg.query_selector('[data-lg-act="calendar"]'); btn.scroll_into_view_if_needed(); btn.click(timeout=5000)
    b2 = pg.query_selector('[data-lg-act="calendar"]')
    if b2: b2.dispatch_event('click')
    pg.wait_for_timeout(800); ok(len(calls(pg, 'calendarAdd')) == 1, '★ 처리 중에 두 번 눌러도 서버는 한 번만 부른다(중복 클릭 방지)'); pg.close()
    b.close()
print('\n' + (('%d건 실패' % fail_n) if fail_n else '전부 통과') + ' (%d건)' % pass_n); sys.exit(1 if fail_n else 0)
