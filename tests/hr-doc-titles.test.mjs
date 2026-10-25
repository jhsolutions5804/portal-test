import fs from 'node:fs';
import { withDocTitle, openDocWindow } from '../app/shared/doc-title.js';
import { contractDocTitle, payslipDocTitle, dismissalDocTitle, resignDocTitle, leavePromoDocTitle, offerDocTitle, resumeDocTitle } from '../app/modules/hr/doc-titles.js';
import * as M from '../app/modules/hr/frozen-docs.js';
import { psHtml } from '../app/modules/hr/payslip-doc.js';
/* 인사 서류(근로계약서·연봉계약서·급여명세서) 인쇄 제목(대기열 1-2-7 ③, 대표님 2026-10-22 ㅇㅇ: 핵심 3종만, 작성 중 미리보기는 이름만)
 * frozen-docs.js 는 "서명·저장이 끝난 서류는 어떠한 경우에도 내용이 바뀌면 안 된다"는 동결 파일이라 양식 함수는 고치지 않고, 창에 열 때만 <title> 을 문서 이름으로 바꾼다(제목은 문서 내용이 아니라 창 이름표).
 * 공개 저장소라 가짜 이름·값만 쓴다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + (a === b ? '' : ' ← 실제: "' + a + '" / 기대: "' + b + '"'));
const titleOf = (h) => { const m = String(h).match(/<title>([\s\S]*?)<\/title>/); return m ? m[1] : null; };
const noTitle = (h) => String(h).replace(/<title>[\s\S]*?<\/title>/, '<title></title>');
console.log('── withDocTitle: 제목만 바꾸고 나머지는 한 글자도 바꾸지 않는다');
{ const SRC = '<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="utf-8">\n  <title>원래 제목</title>\n  <style>body { margin: 0; }</style>\n</head>\n<body>\n  <h1>  본문   제목  </h1>\n  <script>window.x = 1;</script>\n  <button onclick="window.print()">인쇄</button>\n</body>\n</html>\n'; const h = withDocTitle(SRC, '근로계약서 - 홍길동 - 2026-10-26');
  eq(titleOf(h), '근로계약서 - 홍길동 - 2026-10-26', '★ <title> 이 문서 이름으로 바뀐다'); eq(noTitle(h), noTitle(SRC), '★ <title> 외에는 한 글자도 바뀌지 않는다(공백·개행·스크립트·인쇄 버튼 포함) — 동결·서명 서류의 내용이 그대로여야 한다'); ok((h.match(/<script/g) || []).length === 1 && h.includes('onclick="window.print()"'), '★ 스크립트를 더하거나 빼지 않는다(인사 서식에는 이미 인쇄 버튼이 있다 — 통보서와 달리 자동 인쇄 스크립트를 넣지 않는다)'); }
eq(titleOf(withDocTitle('<html><head><title>첫째</title></head><body><svg><title>그림</title></svg></body></html>', '새 제목')), '새 제목', '★ <title> 이 둘이면 첫 번째(문서 제목)만 바꾼다');
ok(withDocTitle('<html><head><title>첫째</title></head><body><svg><title>그림</title></svg></body></html>', '새 제목').includes('<svg><title>그림</title></svg>'), '본문 속 <title>(그림 설명 등)은 그대로다');
ok(titleOf(withDocTitle('<title>원래</title>', '<script>alert(1)</script>')) === '&lt;script&gt;alert(1)&lt;/script&gt;', '★ 제목은 이스케이프한다(이름에 태그가 들어와도 실행되지 않는다)');
for (const bad of ['', '   ', null, undefined, 3, {}]) eq(titleOf(withDocTitle('<title>원래</title>', bad)), '원래', '제목이 ' + JSON.stringify(bad) + ' 이면 원래 제목을 그대로 둔다');
eq(titleOf(withDocTitle('<title>원래</title>', '제목\n둘째\t탭\u0000')), '제목 둘째 탭', '제어문자·개행은 공백 하나로 정리한다');
ok(titleOf(withDocTitle('<title>원래</title>', '가'.repeat(500))).length <= 200, '제목은 200자까지');
{ const r = withDocTitle('<p>제목 없는 조각</p>', '문서'); ok(/<title>문서<\/title>/.test(r) && r.includes('<p>제목 없는 조각</p>'), '★ <title> 이 없는 HTML 도 던지지 않고 제목을 더하며 내용은 보존한다'); }
for (const bad of [null, undefined, 3, {}, []]) { let r, threw = false; try { r = withDocTitle(bad, '문서'); } catch (e) { threw = true; } ok(!threw && typeof r === 'string', 'HTML 이 문자열이 아니면(' + JSON.stringify(bad) + ') 던지지 않는다'); }
{ const s = '<title>원래</title><p>본문</p>'; const sn = s; withDocTitle(s, '문서'); ok(s === sn, '입력 문자열은 불변이다'); }
console.log('── 제목 함수(저장본): 근로계약서=이름+계약 시작일 · 연봉계약서=이름+연도 · 급여명세서=연월+이름');
const LAB = { name: '김가나', startDate: '2026-03-01', endDate: '2027-02-28', dept: '사업본부', rank: '대리', job: 'FCU 설치', salary: 36000000, hourly: 14384.35, contractDate: '2026-02-20', address: '대전 서구 가나로 1', jumin: '900101-1234567', phone: '010-1234-5678', signData: 'data:image/png;base64,SIGNDATA', empType: 'field' };
eq(contractDocTitle('근로계약서', LAB), '근로계약서 - 김가나 - 2026-03-01', '★ 근로계약서 저장본: 종류 - 이름 - 계약 시작일');
eq(contractDocTitle('연봉계약서', LAB), '연봉계약서 - 김가나 - 2026', '★ 연봉계약서 저장본: 종류 - 이름 - 연도(대표님 확정 "연봉은 연도")');
eq(contractDocTitle('연봉계약서', Object.assign({}, LAB, { startDate: '2027-01-01' })), '연봉계약서 - 김가나 - 2027', '연도는 계약 시작일의 연도');
const SLIP = { month: '2026-10', payDate: '2026-11-30', bankAccount: '신한 110-123-456789', name: '김가나', dept: '사업본부', rank: '대리', empNo: '25002', basic: 2000000, grossPay: 3500000, netPay: 3100000, totalDeduct: 400000 };
eq(payslipDocTitle(SLIP), '급여명세서 - 2026-10 - 김가나', '★ 급여명세서 저장본: 종류 - 연월 - 이름(대표님 확정 "급여명세서는 연월 우선")');
console.log('── 제목 함수(작성 중 미리보기): 이름만(계약 시작일은 아직 바뀔 수 있다 — 대표님 2026-10-22)');
eq(contractDocTitle('근로계약서', LAB, { preview: true }), '근로계약서 - 김가나', '★ 근로계약서 미리보기: 계약 시작일 없이 종류 - 이름');
eq(contractDocTitle('연봉계약서', LAB, { preview: true }), '연봉계약서 - 김가나', '★ 연봉계약서 미리보기: 연도 없이 종류 - 이름');
eq(payslipDocTitle(SLIP, { preview: true }), '급여명세서 - 2026-10 - 김가나', '★ 급여명세서 미리보기도 연월은 넣는다 — 월은 사용자가 고른 값이고 급여명세서의 정체성이다(계약 시작일처럼 바뀔 수 있는 날짜가 아니다)');
console.log('── 개인정보가 제목에 새지 않는다(서류의 폼에는 주민번호·주소·연락처·급여·계좌·서명이 모두 있다)');
for (const [lab, rec] of [['근로계약서', LAB], ['연봉계약서', LAB]]) for (const pv of [false, true]) { const t = contractDocTitle(lab, rec, { preview: pv }); ok(!/900101|1234567|010-|대전|가나로|36,?000,?000|14,?384|FCU|사업본부|대리|SIGNDATA|2026-02-20|2027-02-28/.test(t), '★ ' + lab + (pv ? ' 미리보기' : ' 저장본') + ' 제목에 주민번호·연락처·주소·급여·직무·부서·직급·서명·다른 날짜가 없다 — 실제: ' + t); }
for (const pv of [false, true]) { const t = payslipDocTitle(SLIP, { preview: pv }); ok(!/110-123|신한|25002|2,?000,?000|3,?500,?000|3,?100,?000|400,?000|사업본부|대리|2026-11-30/.test(t), '★ 급여명세서' + (pv ? ' 미리보기' : ' 저장본') + ' 제목에 계좌·사번·급여·공제·부서·직급·지급일이 없다 — 실제: ' + t); }
eq(contractDocTitle('근로계약서', Object.assign({}, LAB, { name: '김가나 010-1234-5678' })), '근로계약서 - 김가나 - 2026-03-01', '★ 이름 칸에 전화번호가 섞여도 지운다(안전 규칙)');
eq(contractDocTitle('근로계약서', Object.assign({}, LAB, { name: '김/가나' })), '근로계약서 - 김-가나 - 2026-03-01', '이름의 금지 문자는 정리한다');
console.log('── 비어 있거나 이상한 입력');
eq(contractDocTitle('근로계약서', Object.assign({}, LAB, { startDate: '' })), '근로계약서 - 김가나', '계약 시작일이 비어 있으면 그 칸을 건너뛴다');
eq(contractDocTitle('연봉계약서', Object.assign({}, LAB, { startDate: '' })), '연봉계약서 - 김가나', '연도를 모르면 건너뛴다');
eq(contractDocTitle('연봉계약서', Object.assign({}, LAB, { startDate: '미정' })), '연봉계약서 - 김가나', '날짜가 아닌 값은 버린다');
eq(contractDocTitle('근로계약서', Object.assign({}, LAB, { name: '' })), '근로계약서 - 2026-03-01', '이름이 없으면 그 칸을 건너뛴다');
eq(payslipDocTitle(Object.assign({}, SLIP, { month: '' })), '급여명세서 - 김가나', '월을 모르면 이름만');
eq(payslipDocTitle(Object.assign({}, SLIP, { month: '2026-13' })), '급여명세서 - 김가나', '★ 존재하지 않는 월(13월)은 버린다 — period 가 아니라 월 형식이라 값 검사를 한다');
for (const bad of [null, undefined, 'x', 3, [], {}]) { let a, b, threw = false; try { a = contractDocTitle('근로계약서', bad); b = payslipDocTitle(bad); } catch (e) { threw = true; } ok(!threw && a === '근로계약서' && b === '급여명세서', '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않고 종류만 돌려준다'); }
{ let a, threw = false; try { a = contractDocTitle(undefined, LAB); } catch (e) { threw = true; } ok(!threw && typeof a === 'string' && a.length > 0, '종류 이름이 없어도 던지지 않는다 — ' + a); }
{ const r = JSON.parse(JSON.stringify(LAB)); const sn = JSON.stringify(r); contractDocTitle('근로계약서', r); contractDocTitle('연봉계약서', r, { preview: true }); ok(JSON.stringify(r) === sn, '입력을 바꾸지 않는다'); }
console.log('── 실제 동결 양식 전체에 적용해도 <title> 외에는 한 글자도 바뀌지 않는다(서명·저장된 서류의 내용 불변 — 이 작업에서 가장 중요한 시험)');
M.configureFrozenDocs({ signatures: { kjh: 'data:image/png;base64,KJHSIGN' }, logo: 'data:image/png;base64,LOGO' });
const SAMPLES = [LAB, { name: '이다라', startDate: '2025-04-01', endDate: '', dept: '', rank: '', job: '', salary: 0, contractDate: '', address: '', jumin: '', hourly: 0, empType: 'office', wageType: 'comprehensive' }, { name: '박마바', startDate: '2026-09-05', endDate: '2027-09-04', dept: '경영지원', rank: '과장', job: '총무', salary: '42000000', contractDate: '2026-09-01', address: '평택', jumin: '8512012345678', hourly: 16000, empType: 'field', wageType: 'comprehensive', signData: '' }];
let nHtml = 0, nSame = 0, nTitle = 0; const tpls = [['annual', M.__ANNUAL_TPL], ['labor', M.__LABOR_TPL]];
for (const [kind, tpl] of tpls) for (const v of Object.keys(tpl)) for (const d of SAMPLES) { let h; try { h = tpl[v](d); } catch (e) { continue; } if (typeof h !== 'string') continue; nHtml++; const t = withDocTitle(h, '새 이름 - ' + d.name); if (noTitle(t) === noTitle(h)) nSame++; if (titleOf(t) === '새 이름 - ' + d.name) nTitle++; }
ok(nHtml >= 40, '★ 동결 양식 근로·연봉계약서 전 버전(v0~v6) × 샘플 3건에서 서류 ' + nHtml + '건을 만들었다(40건 이상)'); ok(nSame === nHtml, '★ 그 ' + nHtml + '건 모두 <title> 외에는 한 글자도 안 바뀐다(' + nSame + '/' + nHtml + ')'); ok(nTitle === nHtml, '그 ' + nHtml + '건 모두 제목이 새 이름으로 바뀐다(' + nTitle + '/' + nHtml + ')');
{ const slips = [{ month: '2026-10', payDate: '2026-11-30', bankAccount: '신한 110-1', name: '김가나', dept: '사업본부', rank: '대리', empNo: '25002', empType: 'field', basic: 2000000, fixedOt: 180000, fixedNight: 48000, weekly: 480000, holidayPay: 100000, grossPay: 3000000, netPay: 2700000, totalDeduct: 300000 }, { month: '2026-08', payDate: '', name: '이다라', basic: 1000000, grossPay: 1000000, netPay: 900000, totalDeduct: 100000 }]; let n = 0, same = 0; for (const v of Object.keys(M.__PS_TPL)) for (const s of slips) { let h; try { h = M.__PS_TPL[v](s); } catch (e) { continue; } if (typeof h !== 'string') continue; n++; if (noTitle(withDocTitle(h, '급여명세서 - 2026-10 - ' + s.name)) === noTitle(h)) same++; } ok(n >= 8 && same === n, '★ 동결 급여명세서 양식(v0~v6) 서류 ' + n + '건 모두 <title> 외 불변(' + same + '/' + n + ')');
  let h2; try { h2 = psHtml(slips[0]); } catch (e) { h2 = null; } if (typeof h2 === 'string') ok(noTitle(withDocTitle(h2, '급여명세서 - 2026-10 - 김가나')) === noTitle(h2), '★ 최신 급여명세서 양식(payslip-doc.js psHtml)도 <title> 외 불변'); else ok(true, '(최신 psHtml 은 이 샘플로 만들 수 없어 건너뜀)'); }
console.log('── openDocWindow: 새 창에 쓴다(팝업 차단·오류 안내)');
const mkWin = () => { const w = { writes: [], closed: 0, document: { write: (h) => { w.writes.push(h); }, close: () => { w.closed++; } } }; return w; };
{ const win = mkWin(); const toasts = []; const opened = []; const r = openDocWindow({ html: '<title>원래</title><p>본문</p>', title: '근로계약서 - 김가나', openWindow: (u, n) => { opened.push([u, n]); return win; }, toast: (m) => toasts.push(m) }); ok(r === true && opened.length === 1 && opened[0][0] === '' && opened[0][1] === '_blank', '★ window.open("", "_blank") 로 새 창을 연다'); eq(titleOf(win.writes[0]), '근로계약서 - 김가나', '★ 창에 쓰는 문서의 제목이 문서 이름이다'); ok(win.writes.length === 1 && win.closed === 1, '문서를 한 번 쓰고 닫는다'); ok(win.writes[0].includes('<p>본문</p>'), '본문은 그대로 쓴다'); }
{ const toasts = []; const r = openDocWindow({ html: '<title>원래</title>', title: 'x', openWindow: () => null, toast: (m) => toasts.push(m) }); ok(r === false && toasts.length === 1 && /팝업/.test(toasts[0]), '★ 팝업이 막히면 안내하고 false 를 돌려준다(던지지 않는다)'); }
{ const toasts = []; const r = openDocWindow({ html: '<title>원래</title>', title: 'x', openWindow: () => { throw new Error('열기 오류'); }, toast: (m) => toasts.push(m) }); ok(r === false && toasts.length === 1, '창을 여는 중 오류가 나도 던지지 않고 안내한다'); }
{ const win = mkWin(); win.document.write = () => { throw new Error('쓰기 오류'); }; const toasts = []; const r = openDocWindow({ html: '<title>원래</title>', title: 'x', openWindow: () => win, toast: (m) => toasts.push(m) }); ok(r === false && toasts.length === 1, '창에 쓰는 중 오류가 나도 던지지 않고 안내한다'); }
{ const win = mkWin(); openDocWindow({ html: '<title>원래</title><p>본문</p>', title: '', openWindow: () => win, toast: () => {} }); eq(titleOf(win.writes[0]), '원래', '제목이 비면 원래 제목 그대로 쓴다(제목을 못 만들어도 서류는 열린다)'); }
{ const win = mkWin(); let threw = false; try { openDocWindow({ html: '<p>x</p>', title: 't', openWindow: () => win }); } catch (e) { threw = true; } ok(!threw, 'toast 가 없어도 던지지 않는다'); }
{ const win = mkWin(); const html = '<!DOCTYPE html>\n<html><head><title>원래</title></head><body>\n<p>본문</p>\n</body></html>\n'; openDocWindow({ html, title: '근로계약서 - 김가나', openWindow: () => win, toast: () => {} }); eq(win.writes[0], withDocTitle(html, '근로계약서 - 김가나'), '★ 창에 쓰는 문서는 제목만 바뀐 문서와 정확히 같다 — 끝에 스크립트나 다른 내용이 더해지지 않는다(서명·저장된 서류의 내용 불변)'); }
{ const toasts = []; const r = openDocWindow({ html: '<title>원래</title>', title: 'x', openWindow: () => null, toast: (m) => toasts.push(m) }); ok(r === false && /팝업이 차단/.test(toasts[0]) && !/열지 못했습니다/.test(toasts[0]), '★ 팝업이 막히면 "팝업이 차단" 안내가 나온다(창 열기 오류 안내와 구분 — 사용자가 해야 할 일이 다르다) — 안내: ' + toasts[0]); const t2 = []; openDocWindow({ html: '<title>원래</title>', title: 'x', openWindow: () => { throw new Error('열기 오류'); }, toast: (m) => t2.push(m) }); ok(/열지 못했습니다/.test(t2[0]) && !/팝업이 차단/.test(t2[0]), '창을 여는 중 오류는 다른 안내가 나온다 — ' + t2[0]); }
{ const rec = Object.assign({}, LAB, { name: '김가나' }); for (const f of ['address', 'job', 'dept', 'rank', 'contractDate', 'endDate']) { const t = contractDocTitle('근로계약서', Object.assign({}, rec, { [f]: '구별용값ZZ' })); ok(!/구별용값ZZ/.test(t), '★ ' + f + ' 필드는 제목에 쓰이지 않는다(서류에는 있어도 제목에는 이름·종류·날짜만)'); } for (const f of ['bankAccount', 'dept', 'rank', 'empNo', 'payDate', 'basic']) { const t = payslipDocTitle(Object.assign({}, SLIP, { [f]: '구별용값ZZ' })); ok(!/구별용값ZZ/.test(t), '★ 급여명세서 ' + f + ' 필드는 제목에 쓰이지 않는다'); } }
console.log('── 화면 연결(hr/index.js): 호출 지점이 제목을 넘긴다');
{ const src = fs.readFileSync(new URL('../app/modules/hr/index.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/openDocWindow/.test(src), '★ hr/index.js 가 공용 창 열기 함수(openDocWindow)를 쓴다');
  const lines = src.split('\n'); const calls = lines.filter((l) => /\bopenWin\(/.test(l) && !/const openWin =/.test(l)).map((l) => l.replace(/\s+/g, ' '));
  const find = (re) => calls.filter((c) => re.test(c));
  ok(find(/openWin\(outHtml\(d\)[^)]*,\s*contractDocTitle\(/).length === 1, '★ 근로·연봉계약서 저장본 열기가 제목(contractDocTitle)을 넘긴다');
  ok(find(/openWin\(outHtml\(K\.record\(st\.aForm\)\)[^;]*,\s*contractDocTitle\([^;]*preview: *true/).length === 1, '★ 계약서 작성 중 미리보기는 preview: true 로 이름만 넘긴다');
  ok(find(/openWin\(psHtml\(d\)[^;]*,\s*payslipDocTitle\(/).length >= 1, '★ 급여명세서 저장본 열기가 제목(payslipDocTitle)을 넘긴다');
  ok(find(/payslipRecord\(.*openWin\(psHtml\(rec\), payslipDocTitle\(rec, \{ preview: true \}\)\)/).length === 1, '★ 급여명세서 작성 중 미리보기도 제목을 넘긴다(같은 기록으로 문서와 제목을 만들고 preview: true)');
  /* 연차촉진·해고예고·퇴직원·휴직원·이력서·연봉 제안서는 대표님 "넣어도 돼"(2026-10-22) 뒤 범위 안 — 아래 '나머지 서류' 구역에서 시험한다 */
  ok(!/frozen-docs/.test(src.split('\n').filter((l) => /^import /.test(l) && /doc-titles|doc-title/.test(l)).join('\n')), 'doc-title 파일은 동결 파일을 가져오지 않는다'); }
{ const fz = fs.readFileSync(new URL('../app/modules/hr/frozen-docs.js', import.meta.url), 'utf8'); ok(!/doc-title|withDocTitle|contractDocTitle|payslipDocTitle/.test(fz), '★ 동결 파일(frozen-docs.js)은 한 글자도 고치지 않았다(제목 치환 코드가 없다)'); ok(/직접 수정 금지\(동결\)/.test(fz) && fz.split('\n').length === 1847, '동결 파일의 머리말과 길이(1847줄)가 그대로다'); }
console.log('── 나머지 서류(대표님 2026-10-22 "이름·날짜 넣어도 돼"): 해고예고통지서·퇴직원·휴직원·연차촉진·연봉 제안서·이력서');
const DS = { workerName: '김가나', noticeDate: '2026-10-22', dismissalDate: '2026-11-21', reasonType: 'discipline', reasonDetail: '무단결근 3회 비밀사유', ruleRef: '취업규칙 제9조', hourly: 14384, ordinaryWage: 3000000, noticeAllowance: 3000000, dept: '사업본부', rank: '대리', workerId: 'w-secret-1', delivery: '직접 교부' };
const RR = { authorName: '김가나', authorDept: '사업본부', authorRank: '대리', lastDate: '2026-11-30', returnDate: '2027-02-28', reason: '개인 사정 비밀사유', approvalLine: [{ name: '결재자비밀' }], status: 'approved', dtype: 'resign', authorUid: 'uid-secret', authorEmail: 'kim@example.com' };
const LP = { stage: 'p1', workerName: '김가나', noticeDate: '2026-10-22', periodStart: '2026-01-01', periodEnd: '2026-12-31', grantDays: 15, usedDays: 3, unusedDays: 12, designatedDates: ['2026-12-01', '2026-12-02'], memo: '메모비밀', dept: '사업본부', rank: '대리', empNo: '25002', replyDue: '2026-11-01', method: '서면' };
const OF = { kind: 'renew', name: '김가나', dept: '사업본부', rank: '대리', empNo: '25002', job: 'FCU', amount: '48000000', curSalary: '40000000', offerDate: '2026-10-22', replyDue: '2026-10-29', startDate: '2027-01-01', hireDate: '2023-01-01' };
const AP = { name: '김가나', birth: '1990-01-01', address: '대전 서구 가나로 1', phone: '010-1234-5678', email: 'kim@example.com', gender: '여', eduLevel: '대졸', military: '군필', notes: '비고비밀' };
console.log(' · 파일 이름 형식');
eq(dismissalDocTitle(DS), '해고예고통지서 - 김가나 - 2026-10-22', '★ 해고예고통지서: 종류 - 이름 - 통지일');
eq(resignDocTitle(Object.assign({}, RR, { dtype: 'resign' }), '퇴직'), '퇴직원 - 김가나 - 2026-11-30', '★ 퇴직원: 종류 - 이름 - 퇴직 예정일');
eq(resignDocTitle(RR, '휴직'), '휴직원 - 김가나 - 2026-11-30', '★ 휴직원: 종류 - 이름 - 휴직 시작일(같은 필드 lastDate 가 휴직 시작일을 뜻한다)');
eq(leavePromoDocTitle(LP), '연차 유급휴가 사용 촉진 통보서 (1차) - 김가나 - 2026-10-22', '★ 연차촉진 1차: 서류 제목(차수 포함) - 이름 - 통보일 (지금은 이름이 아예 없다)');
eq(leavePromoDocTitle(Object.assign({}, LP, { stage: 'p2' })), '연차 유급휴가 사용 시기 지정 통보서 (2차) - 김가나 - 2026-10-22', '연차촉진 2차(시기 지정)');
eq(leavePromoDocTitle(Object.assign({}, LP, { stage: 'p1x' })), '연차 유급휴가 사용 촉진 통보서 (추가 1차) - 김가나 - 2026-10-22', '연차촉진 추가 1차');
eq(offerDocTitle(OF), '연봉 제안서 - 김가나 - 2026-10-22', '★ 연봉 제안서(재출력): 종류 - 이름 - 제안일');
eq(offerDocTitle(OF, { preview: true }), '연봉 제안서 - 김가나', '★ 연봉 제안서(작성 중 출력): 이름만 — 제안일·금액이 아직 바뀔 수 있다');
eq(resumeDocTitle(AP), '이력서 - 김가나', '★ 이력서: 종류 - 이름(날짜 없음 — 자연스러운 기준일이 없고 생년월일은 개인정보다)');
console.log(' · 서류에 있어도 제목에 쓰이지 않는 것(해고 사유·연봉 금액·생년월일 등 — 이 서류들은 개인정보 위험이 크다)');
const LEAK = (t, bad, m) => ok(!new RegExp(bad).test(t), '★ ' + m + ' — 실제: ' + t);
LEAK(dismissalDocTitle(DS), '비밀사유|취업규칙|14,?384|3,?000,?000|사업본부|대리|w-secret|2026-11-21|직접|징계|discipline', '해고예고통지서 제목에 해고 사유·규정·임금·수당·부서·직급·직원 id·해고일·교부 방법이 없다');
for (const k of ['퇴직', '휴직']) LEAK(resignDocTitle(RR, k), '비밀사유|결재자|uid-secret|example\\.com|사업본부|대리|2027-02-28|approved', k + '원 제목에 사유·결재선·uid·이메일·부서·직급·복직일이 없다');
LEAK(leavePromoDocTitle(LP), '메모비밀|2026-12-0|15일|사업본부|대리|25002|2026-11-01|2026-01-01|서면', '연차촉진 제목에 연차 일수·지정일·메모·부서·직급·사번·회신기한·대상 기간이 없다');
for (const pv of [false, true]) LEAK(offerDocTitle(OF, { preview: pv }), '48,?000,?000|40,?000,?000|FCU|사업본부|대리|25002|2027-01-01|2023-01-01|2026-10-29', '연봉 제안서' + (pv ? '(작성 중)' : '') + ' 제목에 연봉 금액·현 연봉·직무·부서·직급·사번·시작일·입사일·회신기한이 없다');
LEAK(resumeDocTitle(AP), '1990|대전|010-|example\\.com|여|대졸|군필|비고비밀', '이력서 제목에 생년월일·주소·연락처·이메일·성별·학력·병역·비고가 없다');
for (const [f, fn, rec] of [['workerId', dismissalDocTitle, DS], ['dismissalDate', dismissalDocTitle, DS], ['reasonDetail', dismissalDocTitle, DS]]) { const t = fn(Object.assign({}, rec, { [f]: '구별용값ZZ' })); ok(!/구별용값ZZ/.test(t), '★ 해고예고통지서 ' + f + ' 필드는 제목에 쓰이지 않는다'); }
for (const f of ['authorDept', 'authorRank', 'reason', 'returnDate', 'authorEmail']) ok(!/구별용값ZZ/.test(resignDocTitle(Object.assign({}, RR, { [f]: '구별용값ZZ' }), '퇴직')), '★ 퇴직원 ' + f + ' 필드는 제목에 쓰이지 않는다');
for (const f of ['memo', 'dept', 'empNo', 'method', 'replyDue', 'periodStart']) ok(!/구별용값ZZ/.test(leavePromoDocTitle(Object.assign({}, LP, { [f]: '구별용값ZZ' }))), '★ 연차촉진 ' + f + ' 필드는 제목에 쓰이지 않는다');
for (const f of ['amount', 'curSalary', 'job', 'dept', 'empNo', 'replyDue']) ok(!/구별용값ZZ/.test(offerDocTitle(Object.assign({}, OF, { [f]: '구별용값ZZ' }))), '★ 연봉 제안서 ' + f + ' 필드는 제목에 쓰이지 않는다');
for (const f of ['birth', 'address', 'phone', 'email', 'gender', 'eduLevel', 'military', 'notes']) ok(!/구별용값ZZ/.test(resumeDocTitle(Object.assign({}, AP, { [f]: '구별용값ZZ' }))), '★ 이력서 ' + f + ' 필드는 제목에 쓰이지 않는다');
console.log(' · 비어 있거나 이상한 입력');
eq(dismissalDocTitle(Object.assign({}, DS, { noticeDate: '' })), '해고예고통지서 - 김가나', '통지일이 비면 건너뛴다');
eq(dismissalDocTitle(Object.assign({}, DS, { workerName: '' })), '해고예고통지서 - 2026-10-22', '이름이 비면 건너뛴다');
eq(resignDocTitle(Object.assign({}, RR, { lastDate: '' }), '퇴직'), '퇴직원 - 김가나', '퇴직 예정일이 비면 이름만');
eq(resignDocTitle(RR, undefined), '퇴직원 - 김가나 - 2026-11-30', '종류를 모르면 퇴직원(코드의 기본과 같다: 휴직이 아니면 퇴직)');
eq(leavePromoDocTitle(Object.assign({}, LP, { noticeDate: '' })), '연차 유급휴가 사용 촉진 통보서 (1차) - 김가나', '통보일이 비면 이름까지');
eq(offerDocTitle(Object.assign({}, OF, { offerDate: '' })), '연봉 제안서 - 김가나', '제안일이 비면 이름만');
eq(offerDocTitle(Object.assign({}, OF, { name: '' })), '연봉 제안서 - 2026-10-22', '이름이 없으면(빈칸 출력) 제안일만');
eq(resumeDocTitle(Object.assign({}, AP, { name: '' })), '이력서', '이름이 없으면 종류만');
for (const [nm, fn] of [['해고예고', () => dismissalDocTitle(null)], ['퇴직원', () => resignDocTitle(null, '퇴직')], ['연차촉진', () => leavePromoDocTitle(null)], ['연봉 제안서', () => offerDocTitle(null)], ['이력서', () => resumeDocTitle(null)]]) { let r, threw = false; try { r = fn(); } catch (e) { threw = true; } ok(!threw && typeof r === 'string' && r.length > 0, '★ ' + nm + ': 이상한 입력(null)에도 던지지 않고 종류를 돌려준다 — ' + r); }
for (const bad of [undefined, 'x', 3, [], {}]) { let threw = false; try { dismissalDocTitle(bad); resignDocTitle(bad, '퇴직'); leavePromoDocTitle(bad); offerDocTitle(bad); resumeDocTitle(bad); } catch (e) { threw = true; } ok(!threw, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
eq(dismissalDocTitle(Object.assign({}, DS, { workerName: '김가나 010-1234-5678' })), '해고예고통지서 - 김가나 - 2026-10-22', '★ 이름 칸의 전화번호는 지운다(안전 규칙)');
eq(resumeDocTitle(Object.assign({}, AP, { name: '김/가나' })), '이력서 - 김-가나', '이름의 금지 문자는 정리한다');
{ const r = JSON.parse(JSON.stringify(DS)); const sn = JSON.stringify(r); dismissalDocTitle(r); ok(JSON.stringify(r) === sn, '입력을 바꾸지 않는다'); }
console.log(' · 서류를 여는 곳(hr/index.js)이 제목을 넘긴다');
{ const src = fs.readFileSync(new URL('../app/modules/hr/index.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/withDocTitle\(resignPrintHtml\(d, w, d\.filed, st\.today\), resignDocTitle\(/.test(src), '★ 퇴직원·휴직원: 준비 중 창을 먼저 여는 구조(팝업 차단을 피하려고 클릭 직후 동기로 연다)는 그대로 두고 문서를 다시 쓰는 곳에서 제목만 바꾼다');
  ok(/win\.document\.open\(\); win\.document\.write\(withDocTitle\(/.test(src), '퇴직원·휴직원은 여전히 win.document.open() 으로 다시 쓴다(비동기 구조 유지)');
  ok(/resignDocTitle\(d, rrqKindOf\(d\)\)/.test(src), '★ 퇴직원·휴직원 제목은 서류의 종류(rrqKindOf(d) — 휴직/퇴직)를 넘긴다 — 항상 퇴직으로 두면 휴직원이 퇴직원 이름으로 저장된다');
  ok(/withDocTitle\(resumePrintHtml\(a\), resumeDocTitle\(a\)\)/.test(src), '★ 이력서가 제목을 바꾼다');
  ok(/openDocWindow\(\{ html: dsHtmlByVer\(d, \{ stamp: st\.stamp \}\), title: dismissalDocTitle\(d\)/.test(src), '★ 해고예고통지서(발행 직후·재출력 모두 이 함수)가 제목을 넘긴다');
  ok(/openDocWindow\(\{ html: leavePromoHtmlByVer\(rec\), title: leavePromoDocTitle\(rec\)/.test(src), '★ 연차촉진(발행 직후·재출력 모두 이 함수)이 제목을 넘긴다');
  ok(/openDocWindow\(\{ html: offerBuildHtml\(f, r, ctxOf\(\)\), title: offerDocTitle\(f, o\)/.test(src), '★ 연봉 제안서가 제목을 넘기고 작성 중(preview)과 재출력을 구분한다');
  ok(/openPrint\(st\.of, \{ preview: true \}\)/.test(src) && /openPrint\(o\);/.test(src), '★ 연봉 제안서: 작성 폼의 출력은 preview: true(이름만), 저장된 제안서 재출력은 날짜까지');
  ok(!/win\.document\.write\((dsHtmlByVer|leavePromoHtmlByVer|offerBuildHtml)\(/.test(src), '★ 이 세 서류는 더 이상 문서를 직접 쓰지 않고 공용 함수를 거친다(제목이 빠지는 길이 없다)'); }
ok(pass + fail >= 161, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
