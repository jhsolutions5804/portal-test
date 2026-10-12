/* 동결 양식 시험 — 구포털 원본 블록(tests/fixtures/frozen_block_original.js)을 빈 환경에서 실행한 출력과, 그대로 옮긴 모듈(frozen-docs.js)의 출력이
 * 글자 하나까지 같은지 비교한다. 서명·저장이 끝난 서류는 내용이 바뀌면 안 된다는 원칙의 자동 점검. */
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url'; import path from 'path';
import * as M from '../app/modules/hr/frozen-docs.js';
import { payslipCalc, payslipRecord } from '../app/modules/hr/payslip.js';
const here = path.dirname(fileURLToPath(import.meta.url)); const code = fs.readFileSync(path.join(here, 'fixtures/frozen_block_original.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const LOGO = 'data:image/png;base64,LOGO'; const SIGS = { kjh: 'data:image/png;base64,KJHSIGN', other: 'x' };
const TRAVEL = { personal_near: '🚗 개인차량 · 40km 이내 (1만원/일)', personal_far: '🚗 개인차량 · 40km 초과 (2만원/일)', company_car: '🚙 회사차량 (거리무관 1만원/일)', longtrip: '🚄 지방장기출장 · 왕복KTX 실비' };
const sandbox = { console, Math, Date, JSON, Number, String, Array, Object, Set, Map, parseInt, parseFloat, isNaN, RegExp, Intl, Boolean, undefined, window: { open() {}, close() {}, print() {} }, document: { getElementById() { return null; } }, alert() {}, C2: {}, wrap2: (x) => x, backBtn2: () => '', JH_LOGO: LOGO, _compSignatures: SIGS, psWonR: (v) => '₩' + Math.round(v || 0).toLocaleString(), PS_TRAVEL_PER_DAY: { personal_near: 10000, personal_far: 20000, company_car: 10000 }, PS_TRAVEL_TYPE_LABEL: TRAVEL };
const ctx = vm.createContext(sandbox); vm.runInContext(code, ctx);
M.configureFrozenDocs({ signatures: SIGS, logo: LOGO });
const orig = (expr, d) => { ctx.__d = d; return vm.runInContext(expr, ctx); };

// 샘플 문서: 근로·연봉계약서(필드는 원본을 실행해 수집한 것) + 급여명세서(저장본)
const contracts = [
  { name: '김가나', startDate: '2026-03-01', endDate: '2027-02-28', dept: '사업본부', rank: '대리', job: 'FCU 설치', salary: 36000000, contractDate: '2026-02-20', address: '대전 서구 <테스트> & "주소"', jumin: '900101-1234567', signData: 'data:image/png;base64,SIGNDATA', hourly: 14384.35, empType: 'field', wageType: 'noncomprehensive' },
  { name: '이다라', startDate: '2025-04-01', endDate: '', dept: '', rank: '', job: '', salary: 0, contractDate: '', address: '', jumin: '', hourly: 0, empType: 'office', wageType: 'comprehensive' },
  { name: '박마바', startDate: '2026-09-05', endDate: '2027-09-04', dept: '경영지원', rank: '과장', job: '총무', salary: '42000000', contractDate: '2026-09-01', address: '평택', jumin: '8512012345678', hourly: 16000, empType: 'field', wageType: 'comprehensive', signData: '' },
];
const slips = [
  { month: '2026-10', payDate: '2026-11-30', bankAccount: '신한 110-1', name: '김가나', dept: '사업본부', rank: '대리', empNo: '25002', empType: 'field', basic: 2000000, fixedOt: 180000, fixedNight: 48000, weekly: 480000, holidayPay: 100000, attHours: 170, leaveHours: 8, nightHours: 8, actualHours: 178, standardHours: 160, otHours: 10, shortHours: 0, shortDeduct: 0, holidayHours: 10, weeklyQualifyingWeeks: 5, weeklyTotalWeeks: 5, weeklyEstimated: false, bonus: 100000, specialBonus: 50000, extraPay: 30000, techAllowance: 100000, travelAllowance: 70000, travelItems: [{ type: 'personal_near', days: 3 }, { type: 'longtrip', tripCount: 2, perTrip: 20000 }, { type: '', amount: 5000 }], grossPay: 3100000, pension: 139500, health: 109895, ltcare: 14077, employ: 27900, dormitory: 80000, incomeTax: 100000, localTax: 10000, totalDeduct: 481372, netPay: 2688628 },
  { month: '2026-08', payDate: '', name: '이다라', travelType: 'company_car', travelDays: 4, basic: 1000000, fixedOt: 0, fixedNight: 0, weekly: 0, holidayPay: 0, weeklyEstimated: true, grossPay: 1000000, netPay: 900000, totalDeduct: 100000 },
  { month: '2026-09', payDate: '2026-10-31', name: '박마바', travelType: 'longtrip', travelTripCount: 2, travelPerTrip: 50000, basic: 1500000, grossPay: 1500000, netPay: 1400000, weekly: 300000, weeklyQualifyingWeeks: 3, weeklyTotalWeeks: 4, shortHours: 12, shortDeduct: 144000, actualHours: 148, standardHours: 160 },
  {},
];
const vers = ['v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
let compared = 0, same = 0; const diffs = [];
const cmp = (label, a, b) => { compared++; if (a === b) same++; else diffs.push(label + ' (원본 ' + a.length + '자 / 모듈 ' + b.length + '자)'); };
for (const v of vers) for (const [i, d] of contracts.entries()) { const dd = Object.assign({}, d, { tplVer: v }); cmp('근로계약서 ' + v + ' #' + i, orig('docHtmlByVer(__LABOR_TPL, __d)', dd), M.docHtmlByVer(M.__LABOR_TPL, dd)); cmp('연봉계약서 ' + v + ' #' + i, orig('docHtmlByVer(__ANNUAL_TPL, __d)', dd), M.docHtmlByVer(M.__ANNUAL_TPL, dd)); }
for (const v of vers) for (const [i, d] of slips.entries()) { const dd = Object.assign({}, d, { tplVer: v }); cmp('급여명세서 ' + v + ' #' + i, orig('docHtmlByVer(__PS_TPL, __d)', dd), M.docHtmlByVer(M.__PS_TPL, dd)); }
ok(compared === 7 * 3 * 2 + 7 * 4 && same === compared && diffs.length === 0, '★ 동결 양식 원본과 모듈의 출력이 글자 하나까지 같음: 근로계약서·연봉계약서 3종 문서 × v0~v6, 급여명세서 4종 × v0~v6 = ' + compared + '건 비교 ' + (diffs.length ? '(다른 것: ' + diffs.slice(0, 3).join('; ') + ')' : ''));
// tplVer 없는 옛 문서: 저장 시각으로 양식 판정
const eras = ['2026-08-01T00:00:00Z', '2026-08-30T00:00:00+09:00', '2026-09-01T12:00:00+09:00', '2026-09-03T00:00:00+09:00', '2026-09-23T18:30:00+09:00', '2026-09-24T00:00:00+09:00', '2026-09-30T23:00:00+09:00', '2026-10-01T18:00:51+09:00', '2026-10-12T00:00:00Z', ''];
let eraSame = 0; for (const t of eras) { const d = Object.assign({}, contracts[0], { savedAt: t }); const a = [orig('docTplVer(__d)', d), orig('docHtmlByVer(__LABOR_TPL, __d)', d), orig('docHtmlByVer(__ANNUAL_TPL, __d)', d)]; const b = [M.docTplVer(d), M.docHtmlByVer(M.__LABOR_TPL, d), M.docHtmlByVer(M.__ANNUAL_TPL, d)]; if (JSON.stringify(a) === JSON.stringify(b)) eraSame++; }
ok(eraSame === eras.length && M.docTplVer({ savedAt: '2026-09-02T18:00:00+09:00' }) === 'v3' && M.docTplVer({}) === 'v0' && M.docTplVer({ tplVer: 'v4' }) === 'v4' && M.DOC_TPL_CURRENT === 'v6' && M.docTplVer({ savedAt: '2026-10-05T00:00:00+09:00' }) === 'v6' && M.docTplVer({ savedAt: '2026-09-30T23:00:00+09:00' }) === 'v5', '양식 버전 판정(tplVer 없으면 저장 시각 기준)과 그 버전으로 그린 출력이 원본과 같음, 현재 양식 v6');
const sv = slips[0]; ok(JSON.stringify(orig('[__psSavedPs(__d), __psSavedC(__d)]', sv)) === JSON.stringify([M.__psSavedPs(sv), M.__psSavedC(sv)]) && orig('docHtmlByVer(__PS_TPL, __d)', Object.assign({}, sv, { tplVer: 'zzz' })) === M.docHtmlByVer(M.__PS_TPL, Object.assign({}, sv, { tplVer: 'zzz' })), '저장본 복원 도우미와 알 수 없는 버전(현재 양식으로 대체)도 원본과 같음');
// 원본 블록의 연봉 산식(v0·v1)도 같은 결과
ok([0, 12000, 11000.5].every((h) => ['office', 'field'].every((et) => JSON.stringify(orig('__calcAnnualSalary_v0(' + h + ',"' + et + '")', {})) === JSON.stringify(M.__calcAnnualSalary_v0(h, et)) && JSON.stringify(orig('__calcAnnualSalary_v1(' + h + ',"' + et + '")', {})) === JSON.stringify(M.__calcAnnualSalary_v1(h, et)))), '동결된 옛 연봉 산식(v0 포괄·v1 비포괄)도 원본과 같은 값');
// 바깥 의존(직인·로고) 설정이 출력에 반영되는지
const w1 = M.docHtmlByVer(M.__LABOR_TPL, Object.assign({}, contracts[0], { tplVer: 'v5' })); M.configureFrozenDocs({ signatures: { kjh: 'data:image/png;base64,CHANGED' }, logo: 'https://x/l.png' }); const w2 = M.docHtmlByVer(M.__LABOR_TPL, Object.assign({}, contracts[0], { tplVer: 'v5' })); const p2 = M.docHtmlByVer(M.__PS_TPL, Object.assign({}, slips[0], { tplVer: 'v5' }));
ok(w1.includes('KJHSIGN') && !w1.includes('CHANGED') && w2.includes('CHANGED') && !w2.includes('KJHSIGN') && p2.includes('src="https://x/l.png"') && !p2.includes('LOGO"'), '직인·로고는 바깥에서 넣는 값 — 바꾸면 출력에 반영(양식 본문은 그대로)');
M.configureFrozenDocs({ signatures: SIGS, logo: LOGO });   // 앞 시험이 바꾼 직인·로고를 원본과 같게 되돌린다
// 새 급여명세서 화면의 미리보기 = 저장될 문서(payslipRecord)를 현재 양식(v5)으로 그린 것 — 저장 후 출력과 같은 서식·같은 값
const c = payslipCalc({ hourly: 12000, hasContract: true, month: '2026-10', attHours: 170, holidaySet: new Set(['2026-10-05', '2026-10-09']), attDates: new Set(['2026-10-01']), workerName: '김가나', bonus: 100000, techAllowance: 100000, travelAllowance: 30000 });
const rec = payslipRecord({ name: '김가나', dept: '사업본부', rank: '대리', empNo: '25002', empType: 'field' }, { hourly: 12000 }, '2026-10', '2026-11-30', '신한 110-1', c, [{ type: 'personal_near', days: 3 }]);
const html = M.docHtmlByVer(M.__PS_TPL, rec); const won = (n) => '₩' + Math.round(n).toLocaleString();
ok(rec.tplVer === M.DOC_TPL_CURRENT && html.includes('급 여 명 세 서') && html.includes('김가나') && html.includes('25002') && html.includes('신한 110-1') && html.includes(won(c.netPay)) && html.includes(won(c.totalPay)) && html.includes(won(c.sal.basic)) && html.includes('3일×₩10,000') && orig('docHtmlByVer(__PS_TPL, __d)', rec) === html, '★ 미리보기와 저장본 출력: 새 화면이 만든 저장 문서(v5)를 원본 양식으로 그려도 값(실지급액·지급계·기본근로수당·여비교통비)이 그대로 나오고 원본과 같은 출력');

console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
