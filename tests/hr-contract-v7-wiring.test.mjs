/* 계약서 v7 연결 시험 — 저장 문서·목록 상태·급여명세서 연동·입력 화면·원격 서명 페이지 (화면·네트워크 없음) */
import fs from 'node:fs';
import { annualNewForm, annualFillFromWorker, annualRecord, annualStatus, annualSummary } from '../app/modules/hr/annual.js';
import { laborNewForm, laborRecord } from '../app/modules/hr/labor.js';
import { annualDocHtml, laborDocHtml } from '../app/modules/hr/labor-doc.js';
import { payslipCalc, payslipRecord } from '../app/modules/hr/payslip.js';
import { psHtml } from '../app/modules/hr/payslip-doc.js';
import { annualFormHtml, laborFormHtml, annualWorkerHtml } from '../app/modules/hr/view.js';
import { annualSalary } from '../app/modules/hr/offer.js';
import { v7Calc } from '../app/modules/hr/contract-v7.js';
import { contractState } from '../app/modules/hr/logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const W = { id: 'w1', name: '홍길동', empNo: 'E1', rank: '사원', dept: '사업본부', address: '평택', empType: 'field' };

// 저장 문서
const f = Object.assign(annualFillFromWorker(annualNewForm('2026-11-01'), W, []), { hourly: 11000, contractType: 'regular', contractDate: '2026-10-30', wageType: 'comprehensive', fixedOT: 300000, fixedNight: 100000, fixedOTHours: 12, extraItems: [{ name: '직책수당', amount: 200000, ordinary: true }, { name: '', amount: 5 }] });
const rec = annualRecord(f, '2026-10-29T00:00:00.000Z'); const c = v7Calc(f);
ok(rec.tplVer === 'v7' && rec.salary === c.annual && rec.monthlyTotal === c.total && rec.extraItems.length === 1 && rec.extraItems[0].name === '직책수당' && rec.fixedOT === 300000 && rec.endDate === f.endDate && rec.workerId === 'w1', '★ 연봉계약서 저장: 양식 v7, 계약연봉 = 월 지급계(고정연장·야간·추가 항목 포함)×12, 빈 항목 줄은 저장하지 않음');
ok(annualRecord(Object.assign({}, f, { wageType: 'noncomprehensive' })).fixedOT === '' && annualRecord(Object.assign({}, f, { periodType: 'project', projectName: 'P4', endDate: '2027-01-01' })).endDate === '' && annualRecord(Object.assign({}, f, { periodType: 'open' })).endDate === '', '비포괄이면 고정연장 저장 안 함, 프로젝트 종료 시·정함 없음은 종료일을 저장하지 않음(옛 값 제거)');
const base = annualRecord(Object.assign(annualFillFromWorker(annualNewForm('2026-11-01'), W, []), { hourly: 11000, contractType: 'regular', contractDate: '2026-10-30' }));
ok(base.salary === annualSalary(11000).annual, '고정수당·추가 항목이 없으면 계약연봉은 기존 계산(시급×…×12)과 같다');
const lf = Object.assign(laborNewForm(), { workerId: 'w1', name: '홍길동', hourly: 11000, contractType: 'fixed', periodType: 'project', projectName: 'P4 Ph2', workPlace: '평택', startDate: '2026-11-01', endDate: '2027-01-01', contractDate: '2026-10-30' });
const lr = laborRecord(lf); ok(lr.tplVer === 'v7' && lr.endDate === '' && lr.periodType === 'project' && lr.workPlace === '평택' && lr.salary === annualSalary(11000).annual, '근로계약서 저장: v7, 프로젝트 종료 시는 종료일 없음, 근무지·구분 그대로');
ok(annualDocHtml(rec).includes('연 봉 계 약 서') && annualDocHtml(rec).includes('직책수당') && laborDocHtml(lr).includes('「P4 Ph2」 프로젝트 종료 시까지') && annualDocHtml({ name: '옛', tplVer: 'v6', hourly: 11000, salary: 1 }).includes('연 봉 계 약 서') && !annualDocHtml({ name: '옛', tplVer: 'v6', hourly: 11000, salary: 1 }).includes('통상임금 포함'), '출력 연결: v7 은 새 양식, 저장된 v6 문서는 동결 양식 그대로');

// 목록 상태
const sum1 = annualSummary([{ contractDate: '2025-01-01', endDate: '2025-12-31' }, { contractDate: '2026-11-01', periodType: 'project', endDate: '' }]); const sum2 = annualSummary([{ contractDate: '2026-01-01', endDate: '2026-12-31', periodType: 'range' }, { contractDate: '2025-01-01', endDate: '2025-12-31' }]); const sum3 = annualSummary([{ contractDate: '2025-01-01', endDate: '2025-12-31' }, { contractDate: '2026-11-01', periodType: 'open' }]);
ok(annualStatus(sum1, '2026-12-01').text === '✅ 프로젝트 종료 시' && annualStatus(sum3, '2026-12-01').text === '✅ 기간의 정함 없음' && annualStatus(sum2, '2026-06-01').key === 'valid' && annualStatus(sum2, '2027-02-01').key === 'expired' && annualStatus({ endDate: '', cnt: 1 }, '2026-12-01').key === 'check', '★ 목록 상태: 가장 최근 계약이 프로젝트 종료 시·기간의 정함 없음이면 그대로 표시, 기간 지정은 기존처럼 만료 판정');

// 급여명세서 연동
const items = [{ name: '직책수당', amount: 200000, ordinary: true }, { name: '식대', amount: 100000, ordinary: false }];
const p0 = payslipCalc({ hourly: 11000, hasContract: true, month: '2026-10', attHours: 220, nightHours: 6 });
const pNo = payslipCalc({ hourly: 11000, hasContract: true, month: '2026-10', attHours: 220, nightHours: 6, contractItems: [{ name: '식대', amount: 100000, ordinary: false }], ordinaryExtra: 0 });
const pOrd = payslipCalc({ hourly: 11000, hasContract: true, month: '2026-10', attHours: 220, nightHours: 6, contractItems: items, ordinaryExtra: 200000 });
ok(pNo.totalPay === p0.totalPay + 100000 && pNo.sal.fixedOt === p0.sal.fixedOt && pNo.sal.fixedNight === p0.sal.fixedNight && pNo.sal.weekly === p0.sal.weekly && pNo.contractItemsTotal === 100000, '★ 통상임금 제외 항목: 지급계에만 합산되고 연장·야간·주휴 단가는 그대로');
const rate = 11000 + 200000 / 208.56;
ok(Math.abs(pOrd.ordinaryHourly - rate) < 1e-9 && pOrd.sal.fixedOt === Math.round(rate * pOrd.sal.otHours * 1.5) && pOrd.sal.fixedNight === Math.round(rate * 6 * 0.5) && pOrd.sal.fixedOt > p0.sal.fixedOt && pOrd.totalPay > pNo.totalPay + 200000 && pOrd.sal.basic === p0.sal.basic, '★ 통상임금 포함 항목: 연장·야간 단가가 통상시급((기본+주휴+포함 항목)÷208.56)으로 올라가고 기본근로수당은 그대로');
const none = payslipCalc({ hourly: 11000, hasContract: true, month: '2026-10', attHours: 220, nightHours: 6, contractItems: [], ordinaryExtra: 0 });
ok(JSON.stringify(none) === JSON.stringify(Object.assign({}, p0, { contractItems: [], contractItemsTotal: 0 })) && p0.ordinaryHourly === 11000, '★ 항목이 없으면 기존 급여 계산과 한 글자도 다르지 않다(회귀 없음)');
ok(payslipCalc({ hourly: 11000, month: '2026-10', contractItems: [{ name: '', amount: 5 }, { name: 'x', amount: 0 }, { name: 'y', amount: -3 }] }).contractItemsTotal === 0, '이름·금액이 없거나 음수인 줄은 무시');
const w = { name: '홍길동', dept: 'A', rank: '사원' };
const d1 = payslipRecord(w, { hourly: 11000 }, '2026-10', '2026-11-30', '', pOrd, [], '2026-10-29T00:00:00Z'), d0 = payslipRecord(w, { hourly: 11000 }, '2026-10', '2026-11-30', '', p0, [], '2026-10-29T00:00:00Z');
ok(d1.contractItems.length === 2 && d1.contractItemsTotal === 300000 && !('contractItems' in d0) && d1.grossPay === pOrd.totalPay, '저장 문서: 항목이 있을 때만 contractItems 기록(없으면 필드 자체가 없어 기존 문서와 같음)');
const h1 = psHtml(d1), h0 = psHtml(d0); ok(h1.includes('직책수당') && h1.includes('연봉계약서 지급 항목 · 통상임금 포함') && h1.includes('₩100,000') && !h0.includes('연봉계약서 지급 항목') && psHtml(Object.assign({}, d1, { contractItems: [{ name: '<i>x</i>', amount: 1000 }] })).indexOf('<i>x</i>') < 0, '급여명세서 출력: 항목 행 추가(기술수당 아래), 항목이 없으면 출력 그대로, 글자는 안전하게 처리');

// 입력 화면
const mk = (form) => ({ aView: 'form', aWorkers: [W], aForm: form, aSal: annualSalary(Number(form.hourly || 0)), aV7: v7Calc(form), aProjects: [{ id: 'p1', name: 'P4 Ph2 (FAB)' }], aErrs: [], aSigning: false });
const hf = annualFormHtml(mk(Object.assign({}, f, { contractType: 'fixed', periodType: 'project', projectId: 'p1', projectName: 'P4 Ph2 (FAB)' })));
ok(['data-c7-type="fixed"', 'data-c7-ptype="project"', 'data-c7-proj', '<option value="p1" selected>P4 Ph2 (FAB)', 'data-c7-f="fixedOTHours"', 'data-c7-row="0|name"', 'data-c7-row="0|ordinary" checked', 'data-an-act="c7-add"', 'data-an-act="c7-del"', 'data-c7-sum', '특약사항'].every((s) => hf.includes(s)), '★ 연봉계약서 화면: 구분·계약기간 방식·프로젝트 선택(목록)·고정연장 시간·지급 항목 행(추가/삭제/통상임금 체크)·특약');
const hl = laborFormHtml(mk(Object.assign({}, lf, { contractType: 'fixed', periodType: 'range' }))); const hs = laborFormHtml(mk(Object.assign({}, lf, { workType: 'short' })));
ok(hl.includes('근무지 *') && hl.includes('data-c7-f="workPlace"') && hl.includes('data-c7-ptype="range"') && !hl.includes('data-c7-sum') && !hs.includes('data-c7-type'), '근로계약서 화면: 계약직이면 근무지(필수) 칸, 지급 항목은 연봉계약서에만, 단시간 근로계약서는 기존 화면 그대로');
ok(!hl.includes('data-c7-ptype="open" checked') && /data-c7-ptype="open"[^>]*disabled/.test(hl) && /data-c7-ptype="range"[^>]*checked/.test(hl), '계약직은 "기간의 정함 없음" 선택이 막혀 있다');
ok(annualFormHtml(mk(Object.assign({}, annualNewForm('2026-11-01'), { name: '홍', workerId: 'w1' }))).includes('정규직/계약직을 선택해 주세요') && !/readonly/.test(annualFormHtml(mk(Object.assign({}, annualNewForm('2026-11-01'), { name: '홍', workerId: 'w1' })))), '연봉계약서 종료일 칸은 더 이상 읽기 전용이 아니다(자동 1년 고정 해제), 구분 미선택 안내');

// 연결(컨트롤러·서명 페이지)
const idx = rd('../app/modules/hr/index.js'), sio = rd('../app/modules/hr/sign-io.js'), sign = rd('../sign.html');
ok(/v7Check\(f, kind\)/.test(idx) && /act === 'c7-add'/.test(idx) && /act === 'c7-del'/.test(idx) && /\[data-c7-type\]/.test(idx) && /\[data-c7-proj\]/.test(idx) && /\[data-c7-row\]/.test(idx) && /docHtml: annualDocHtml/.test(idx) && /v7HourlyFromPay\(f\)/.test(idx) && /pjt_registry/.test(idx), '컨트롤러 연결: 검사·추가/삭제·구분·프로젝트·항목 처리·연봉계약서 출력·월급 역산·프로젝트 목록');
ok(/const outHtml = /.test(idx) && !/\/\/[^\n]*const outHtml = /.test(idx) && !/\/\/[^\n]*const sal0 = /.test(rd('../app/modules/hr/payslip.js')), '회귀 방지: 한 줄 주석이 뒤따르는 선언을 가리지 않았다(outHtml·sal0)');
ok(/pickContractHtml\(link\.docType, f\)/.test(sign) && /f\.tplVer === 'v7'/.test(sign) && /configureContractV7\(\{ signatures: window\._compSignatures \}\)/.test(sign) && /from '\.\/app\/modules\/hr\/contract-v7\.js'/.test(sign), '원격 서명 페이지: 저장 문서가 v7 이면 새 양식으로 그리고 직인도 연결');
ok(/annualDocHtml\(snapDoc\)/.test(sio), '열람 전용 링크: 연봉계약서도 v7 양식으로 그린다');
ok(contractState('', 1, '2026-12-01', 'project').text === '프로젝트 종료 시' && contractState('', 1, '2026-12-01', 'open').text === '정함 없음' && contractState('2026-11-30', 1, '2026-12-01').text === '만료' && contractState('2027-01-01', 1, '2026-12-01', 'project').text === '유효' && contractState('', 1, '2026-12-01').text === '확인필요' && contractState('', 0, '2026-12-01', 'open').text === '정함 없음' && contractState('', 0, '2026-12-01').text === '미작성', '근로자 목록 계약 상태: 종료일 없는 계약(정함 없음·프로젝트 종료 시)도 표시, 기존 만료·유효·확인필요·미작성 판정은 그대로');
const wk = annualWorkerHtml({ aWorkers: [{ id: 'w1', name: '홍' }], aSel: 'w1', aLabel: '연봉계약서', aDocType: 'annual', aLog: {}, aDocs: [{ id: '1', contractDate: '2026-10-30', startDate: '2026-11-01', periodType: 'project', projectName: 'P4 Ph2', contractType: 'fixed', salary: 1 }, { id: '2', contractDate: '2026-01-01', startDate: '2026-01-01', endDate: '2026-12-31', contractType: 'regular', salary: 1 }, { id: '3', contractDate: '2025-01-01', startDate: '2025-01-01', endDate: '2025-12-31', salary: 1 }] });
ok(wk.includes('계약직') && wk.includes('P4 Ph2 종료 시') && wk.includes('정규직') && wk.includes('2026.01.01 ~ 2026.12.31') && wk.includes('2025.01.01 ~ 2025.12.31'), '근로자별 계약서 목록: 정규직/계약직 표시와 프로젝트 종료 시·정함 없음 기간 표기(옛 계약서는 기존 표기 그대로)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
