"""인사 서류(근로계약서·급여명세서) 새 창 제목 시험(대기열 1-2-7 ③, 대표님 2026-10-22) — 실제 크로미움으로 확인한다.
동결 양식(frozen-docs.js — 서명·저장된 서류, 수정 금지)의 실제 서류를 새 창에 쓰고, 창의 제목이 문서 이름으로 바뀌었는데 본문·서명 이미지·인쇄 버튼은 한 글자도 안 바뀌었는지 본다.
공개 저장소이므로 가짜 이름·값만 쓴다. 크로미움(playwright)이 없으면 건너뛴다."""
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
BASE = 'http://127.0.0.1:%d' % port
VER = open(os.path.join(ROOT, 'modules', 'hr', 'index.js'), encoding='utf-8').read().split('doc-titles.js?v=')[1].split("'")[0]
PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>포털 홈</title></head><body><div id="root"></div></body></html>'
pass_n = fail_n = 0
def ok(c, m):
 global pass_n, fail_n
 if c: pass_n += 1; print('OK ' + m)
 else: fail_n += 1; print('FAIL ' + m)
SETUP = """async (ver) => {
 const M = await import('/modules/hr/frozen-docs.js?v=' + ver); const D = await import('/shared/doc-title.js?v=' + ver); const T = await import('/modules/hr/doc-titles.js?v=' + ver);
 M.configureFrozenDocs({ signatures: { kjh: 'data:image/png;base64,iVBORw0KGgo=' }, logo: 'data:image/png;base64,iVBORw0KGgo=' });
 const LAB = { name: '김가나', startDate: '2026-03-01', endDate: '2027-02-28', dept: '사업본부', rank: '대리', job: 'FCU 설치', salary: 36000000, contractDate: '2026-02-20', address: '대전 서구 가나로 1', jumin: '900101-1234567', signData: 'data:image/png;base64,iVBORw0KGgo=', hourly: 14384.35, empType: 'field', wageType: 'noncomprehensive' };
 const SLIP = { month: '2026-10', payDate: '2026-11-30', bankAccount: '신한 110-1', name: '김가나', dept: '사업본부', rank: '대리', empNo: '25002', empType: 'field', basic: 2000000, fixedOt: 180000, fixedNight: 48000, weekly: 480000, holidayPay: 100000, grossPay: 3000000, netPay: 2700000, totalDeduct: 300000 };
 const DSM = await import('/modules/hr/dismissal.js?v=' + ver); const LPD = await import('/modules/hr/leave-promo-docs.js?v=' + ver); const LG = await import('/modules/hr/logic.js?v=' + ver);
 LPD.configureLeavePromoDocs && LPD.configureLeavePromoDocs({ signatures: { kjh: 'data:image/png;base64,iVBORw0KGgo=' } });
 window.__DS = { workerName: '김가나', noticeDate: '2026-10-22', dismissalDate: '2026-11-21', reasonType: 'discipline', reasonDetail: '시험용 사유', ruleRef: '취업규칙 제9조', tplVer: 'd1', hourly: 14384, ordinaryWage: 3000000, noticeAllowance: 3000000, dept: '사업본부', rank: '대리', empNo: '25002', hireDate: '2023-01-01', deliveryMethod: '직접 교부', delivery: '직접 교부', exemptType: '' };
 window.__LP = { stage: 'p1', category: 'y1', periodStart: '2026-01-01', periodEnd: '2026-12-31', noticeDate: '2026-10-22', grantDays: 15, usedDays: 3, unusedDays: 12, replyDue: '2026-11-01', designatedDates: [], priorReplyDates: [], p1NoticeDate: '', method: '서면', memo: '', tplVer: 'l1', workerName: '김가나', dept: '사업본부', rank: '대리', empNo: '25002' };
 window.__RR = { authorName: '김가나', authorDept: '사업본부', authorRank: '대리', lastDate: '2026-11-30', returnDate: '2027-02-28', reason: '시험용 사유', approvalLine: [], status: 'approved', leaveKind: '퇴직', filed: '2026-10-22' };
 window.__AP = { name: '김가나', birth: '1990-01-01', address: '대전 서구 가나로 1', phone: '010-1234-5678', email: 'kim@example.com', gender: '여', eduLevel: '대졸', military: '군필', notes: '' };
 window.__DSM = DSM; window.__LPD = LPD; window.__LG = LG;
 window.__M = M; window.__D = D; window.__T = T; window.__LAB = LAB; window.__SLIP = SLIP; return Object.keys(M.__LABOR_TPL).join(',');
}"""
OPEN = """([kind, v, title]) => { const M = window.__M, D = window.__D; const html = kind === 'labor' ? M.__LABOR_TPL[v](window.__LAB) : kind === 'annual' ? M.__ANNUAL_TPL[v](window.__LAB) : M.__PS_TPL[v](window.__SLIP);
 window.__orig = html; const ok = D.openDocWindow({ html, title, toast: (m) => { window.__toast = m; } }); return ok; }"""
try:
 with sync_playwright() as p:
  b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.route('**/x.html', lambda r: r.fulfill(status=200, content_type='text/html', body=PAGE)); pg.goto(BASE + '/x.html')
  vers = pg.evaluate(SETUP, VER); ok(vers.startswith('v0'), '동결 양식 표(v0~v6)를 실제 브라우저에서 불러온다: ' + vers)
  def open_doc(kind, v, title):
   with ctx.expect_page() as pi: r = pg.evaluate(OPEN, [kind, v, title])
   w = pi.value; w.wait_for_load_state('load'); return r, w
  print('── 근로계약서(동결 양식 v6)')
  r, w = open_doc('labor', 'v6', '근로계약서 - 김가나 - 2026-03-01')
  ok(r is True, '새 창이 열린다')
  ok(w.title() == '근로계약서 - 김가나 - 2026-03-01', '★ 새 창의 제목이 문서 이름이다 — 저장 창의 기본 파일 이름 (실제: %s)' % w.title())
  body = w.evaluate('document.body.textContent'); orig = pg.evaluate("() => new DOMParser().parseFromString(window.__orig, 'text/html').body.textContent")
  ok(len(body) > 1000 and body == orig, '★ 창의 본문 글자(textContent)가 원본 서류와 한 글자도 다르지 않다(%d자 = %d자) — 제목만 바뀌었다, 서명·저장된 서류의 내용 불변' % (len(body), len(orig)))
  imgs = w.evaluate("document.querySelectorAll('img').length"); origImgs = pg.evaluate("() => new DOMParser().parseFromString(window.__orig, 'text/html').querySelectorAll('img').length")
  ok(imgs == origImgs and imgs >= 1, '★ 서명·직인·로고 이미지가 그대로다(%d개 = 원본 %d개)' % (imgs, origImgs))
  ok(w.evaluate("document.querySelectorAll('button[onclick*=\"print\"]').length") >= 1, '서식의 [인쇄/PDF] 버튼이 그대로 있다')
  ok(w.evaluate("document.querySelectorAll('script').length") == pg.evaluate("() => new DOMParser().parseFromString(window.__orig, 'text/html').querySelectorAll('script').length"), '★ 스크립트가 늘거나 줄지 않았다(자동 인쇄 스크립트를 더하지 않는다)')
  ok(w.evaluate('document.documentElement.outerHTML.length') > 1000, '문서가 비어 있지 않다'); w.close()
  print('── 연봉계약서·급여명세서')
  r, w = open_doc('annual', 'v6', '연봉계약서 - 김가나 - 2026'); ok(w.title() == '연봉계약서 - 김가나 - 2026', '★ 연봉계약서 창 제목 (실제: %s)' % w.title()); w.close()
  r, w = open_doc('ps', 'v5', '급여명세서 - 2026-10 - 김가나'); ok(w.title() == '급여명세서 - 2026-10 - 김가나', '★ 급여명세서(동결 v5) 창 제목 (실제: %s)' % w.title())
  ok('김가나' in w.evaluate('document.body.innerText'), '급여명세서 본문에 직원 이름이 그대로 있다'); w.close()
  print('── 모든 동결 버전에서 제목만 바뀐다')
  allok = pg.evaluate("""() => { const M = window.__M, D = window.__D; let n = 0, same = 0; const strip = (h) => h.replace(/<title>[\\s\\S]*?<\\/title>/, '<title></title>');
   for (const [t, tpl] of [['l', M.__LABOR_TPL], ['a', M.__ANNUAL_TPL]]) for (const v of Object.keys(tpl)) { const h = tpl[v](window.__LAB); n++; if (strip(D.withDocTitle(h, '새 제목')) === strip(h)) same++; }
   for (const v of Object.keys(M.__PS_TPL)) { const h = M.__PS_TPL[v](window.__SLIP); n++; if (strip(D.withDocTitle(h, '새 제목')) === strip(h)) same++; } return [n, same]; }""")
  ok(allok[0] >= 20 and allok[0] == allok[1], '★ 동결 양식 %d개 버전 모두 <title> 외 불변(%d/%d)' % (allok[0], allok[1], allok[0]))
  print('── 나머지 서류(해고예고통지서·연차촉진·이력서·퇴직원) — 실제 생성 함수의 서류를 새 창에 쓴다')
  OPEN2 = """([which, title]) => { const D = window.__D; let html;
   if (which === 'ds') html = window.__DSM.dsHtmlByVer(window.__DS, { stamp: null }); else if (which === 'lp') html = window.__LPD.leavePromoHtmlByVer(window.__LP); else if (which === 'lp2') html = window.__LPD.leavePromoHtmlByVer(Object.assign({}, window.__LP, { stage: 'p2' })); else if (which === 'lpx') html = window.__LPD.leavePromoHtmlByVer(Object.assign({}, window.__LP, { stage: 'p1x' }));
   else if (which === 'ap') html = window.__LG.resumePrintHtml(window.__AP); else html = window.__LG.resignPrintHtml(window.__RR, null, window.__RR.filed, '2026-10-22');
   window.__orig = html; return D.openDocWindow({ html, title, toast: (m) => { window.__toast = m; } }); }"""
  def open2(which, title):
   with ctx.expect_page() as pi: r = pg.evaluate(OPEN2, [which, title])
   w = pi.value; w.wait_for_load_state('load'); return r, w
  for which, title, label in (('ds', '해고예고통지서 - 김가나 - 2026-10-22', '해고예고통지서'), ('lp', '연차 유급휴가 사용 촉진 통보서 (1차) - 김가나 - 2026-10-22', '연차촉진 1차'), ('lp2', '연차 유급휴가 사용 시기 지정 통보서 (2차) - 김가나 - 2026-10-22', '연차촉진 2차'), ('lpx', '연차 유급휴가 사용 촉진 통보서 (추가 1차) - 김가나 - 2026-10-22', '연차촉진 추가 1차'), ('ap', '이력서 - 김가나', '이력서'), ('rr', '퇴직원 - 김가나 - 2026-11-30', '퇴직원')):
   r, w = open2(which, title)
   ok(r is True and w.title() == title, '★ %s 새 창 제목이 문서 이름이다 (실제: %s)' % (label, w.title()))
   body = w.evaluate('document.body.textContent'); orig = pg.evaluate("() => new DOMParser().parseFromString(window.__orig, 'text/html').body.textContent")
   ok(len(body) > 100 and body == orig, '★ %s 본문 글자가 원본 서류와 한 글자도 다르지 않다(%d자 = %d자)' % (label, len(body), len(orig)))
   w.close()
  print('── 안전')
  ok(pg.evaluate('document.title') == '포털 홈', '★ 포털(원래 창)의 제목은 바뀌지 않는다')
  ok(not [e for e in errs if 'favicon' not in e], '화면 오류 없음 %s' % errs[:2])
  b.close()
except Exception as e:
 fail_n += 1; print('FAIL 시험이 예외로 중단됨 → %r' % (e,))
if pass_n + fail_n < 26: fail_n += 1; print('FAIL ★ 시험 전체가 끝까지 실행됨(%d건 < 26)' % (pass_n + fail_n))
print('\n' + ('실패 %d건 / 통과 %d' % (fail_n, pass_n) if fail_n else '전부 통과 (%d건)' % pass_n)); sys.exit(1 if fail_n else 0)
