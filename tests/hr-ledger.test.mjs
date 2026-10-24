import { ledgerRow, closeChecks, ledgerTotals, ledgerCsv, ledgerHtml, closeDoc, versionDoc, unlockPatch, isClosed, canUnlock, expectedForMonth, isYm, LEDGER_HEAD, LEDGER_PAY, LEDGER_DEDUCT, LEDGER_TOL } from '../app/modules/hr/ledger.js';
import { payslipCalc, payslipRecord } from '../app/modules/hr/payslip.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = { id: 'w1', name: '김가나', empNo: 'E01', dept: '사업본부', rank: '대리', hireDate: '2024-03-01', job: 'FCU 설치', empType: 'field' };
const W2 = { id: 'w2', name: '이다라', empNo: 'E02', dept: '관리팀', rank: '사원', hireDate: '2025-01-02', job: '총무', empType: 'office' };
const calc = (o) => payslipCalc(Object.assign({ hourly: 11000, month: '2026-08', attHours: 176, leaveHours: 16, nightHours: 5, attDates: new Set(), leaveDocs: [], workerName: '김가나', holidayRecords: [{ date: '2026-08-15', workHours: 6 }], holidaySet: new Set(), bonus: 100000, specialBonus: 0, extraPay: 0, techAllowance: 50000, travelAllowance: 0, dormitory: 0 }, o || {}));
const slip = (w, c, extra) => Object.assign({ workerId: w.id }, payslipRecord(w, { hourly: 11000 }, '2026-08', '2026-09-30', '', c, [], '2026-09-30T00:00:00Z'), extra || {});
const c1 = calc(), s1 = slip(W, c1), r1 = ledgerRow(s1, W, 20);
// ── 실제 급여명세서 기록 → 임금대장 한 줄
ok(r1.name === '김가나' && r1.empNo === 'E01' && r1.dept === '사업본부' && r1.rank === '대리' && r1.hireDate === '2024-03-01' && r1.job === 'FCU 설치' && r1.month === '2026-08' && r1.workerId === 'w1', '인적사항(성명·사번·부서·직위·고용일·종사업무·귀속월)이 그대로 옮겨진다');
ok(r1.workHours === Math.round((c1.sal.attHours + c1.sal.holidayHours) * 100) / 100 && r1.workHours > 0 && r1.holidayHours === c1.sal.holidayHours && r1.leaveHours === 16 && r1.holidayHours === 6 && r1.nightHours === 5 && r1.otHours === c1.sal.otHours, '근로시간 = 평일 실근로 + 휴일근로, 휴가 환산·연장·야간은 명세서 값 그대로(실제 계산 결과로 확인)');
ok(r1.holidayHours > 0 && r1.workHours === c1.sal.attHours + c1.sal.holidayHours, '휴일근로 시간이 근로시간에 더해진다(휴가 환산은 더하지 않는다)');
ok(r1.pay.basic === s1.basic && r1.pay.weekly === s1.weekly && r1.pay.bonus === 100000 && r1.pay.techAllowance === 50000 && r1.grossPay === c1.totalPay && r1.ded.pension === c1.pension && r1.ded.health === c1.health && r1.ded.incomeTax === c1.incomeTax && r1.totalDeduct === c1.totalDeduct && r1.netPay === c1.netPay, '지급·공제·합계·실지급이 명세서와 같다');
ok(LEDGER_PAY.length === 10 && LEDGER_DEDUCT.length === 7 && LEDGER_HEAD.length === 12 + 10 + 1 + 7 + 2, '열 구성(인적 6 + 근로 6 + 지급 10 + 지급합 + 공제 7 + 공제합·실지급)');
// ── 근로일수
ok(r1.workDays === 20 && r1.workDaysFrom === 'attendance', '명세서에 workDays 가 없으면 출퇴근 기록에서 센 값을 쓴다');
const r1b = ledgerRow(Object.assign({}, s1, { workDays: 22 }), W, 20); ok(r1b.workDays === 22 && r1b.workDaysFrom === 'slip', '명세서에 workDays 가 있으면 그 값이 우선(실제 지급 기준)');
const r1c = ledgerRow(s1, W); ok(r1c.workDays === null && r1c.workDaysFrom === '' && ledgerRow(s1, W, null).workDays === null && ledgerRow(Object.assign({}, s1, { workDays: 0 }), W).workDays === 0, '자료가 없으면 null(자료 없음), 0일은 0으로 구분');
// ── 점검: 정상
const S = { w1: s1 }; const ck = closeChecks('2026-08', [W], S, [r1]);
ok(ck.ok && ck.blockers.length === 0 && ck.warnings.length === 0, '실제 급여명세서는 검산을 통과한다(막힘 0·경고 0)');
const c2 = calc({ travelAllowance: 30000 }), s2 = slip(W, c2); ok(closeChecks('2026-08', [W], { w1: s2 }, [ledgerRow(s2, W, 20)]).ok && s2.netPay === s2.grossPay - s2.totalDeduct + 30000 && s2.grossPay === c1.totalPay, '여비교통비(비과세)는 지급합계에 들어가지 않고 실지급에만 더해진다 — 검산 통과');
const c3 = calc({ wageType: 'comprehensive', fixedOT: 300000, fixedNight: 50000 }), s3 = slip(W, c3); ok(closeChecks('2026-08', [W], { w1: s3 }, [ledgerRow(s3, W, 1)]).ok, '포괄임금 명세서도 검산 통과');
// ── 점검: 위조·오류를 잡는다
const bad = (patch) => closeChecks('2026-08', [W], { w1: Object.assign({}, s1, patch) }, [r1]);
ok(!bad({ grossPay: s1.grossPay + 1000 }).ok && bad({ grossPay: s1.grossPay + 1000 }).blockers.some((b) => b.code === 'sum-gross'), '지급합계가 항목 합과 다르면 막는다');
ok(bad({ totalDeduct: s1.totalDeduct + 500 }).blockers.some((b) => b.code === 'sum-deduct'), '공제합계가 항목 합과 다르면 막는다');
ok(bad({ netPay: s1.netPay + 5000 }).blockers.some((b) => b.code === 'net'), '실지급이 (지급합 − 공제합 + 여비)와 다르면 막는다');
ok(bad({ month: '2026-07' }).blockers.some((b) => b.code === 'month'), '다른 달 명세서가 섞이면 막는다');
ok(LEDGER_TOL === 10 && bad({ grossPay: s1.grossPay + 10 }).blockers.every((b) => b.code !== 'sum-gross') && bad({ grossPay: s1.grossPay + 11 }).blockers.some((b) => b.code === 'sum-gross') && bad({ grossPay: s1.grossPay - 11 }).blockers.some((b) => b.code === 'sum-gross') && bad({ totalDeduct: s1.totalDeduct + 11 }).blockers.some((b) => b.code === 'sum-deduct') && bad({ netPay: s1.netPay + 11 }).blockers.some((b) => b.code === 'net'), '허용 오차는 정확히 ±10원(10원은 통과, ±11원은 막힘 — 지급·공제·실지급 모두)');
ok(!closeChecks('2026-08', [W], {}, []).ok && closeChecks('2026-08', [W], {}, []).blockers[0].code === 'no-slips' && !closeChecks('2026-8', [W], S, [r1]).ok && !closeChecks('', [], S, []).ok, '명세서가 한 건도 없거나 귀속월이 잘못되면 막는다');
// ── 점검: 경고
const ck2 = closeChecks('2026-08', [W, W2], S, [r1]); ok(ck2.ok && ck2.warnings.length === 1 && ck2.warnings[0].code === 'missing-slip' && ck2.warnings[0].workerId === 'w2', '명세서가 없는 재직 직원은 경고(막지는 않는다)');
const W3 = { id: 'w3', name: '신입', hireDate: '2026-09-01' }, W4 = { id: 'w4', name: '퇴사', hireDate: '2020-01-01', status: 'resigned', resignDate: '2026-07-31' }, W5 = { id: 'w5', name: '말퇴', hireDate: '2020-01-01', status: 'resigned', resignDate: '2026-08-01' }, W6 = { id: 'w6', name: '날짜없음퇴사', status: 'resigned' };
ok(closeChecks('2026-08', [W, W3, W4, W6], S, [r1]).warnings.length === 0 && closeChecks('2026-08', [W, W5], S, [r1]).warnings.length === 1, '입사 전·퇴사 후 직원은 경고 대상이 아니고, 그 달에 퇴사한 직원은 대상이다');
ok(expectedForMonth({ id: 'a', hireDate: '2026-08-31' }, '2026-08') && !expectedForMonth({ id: 'a', hireDate: '2026-09-01' }, '2026-08') && expectedForMonth({ id: 'a', hireDate: '2026-08-01' }, '2026-08') && expectedForMonth(W, '2026-08') && !expectedForMonth(W3, '2026-08') && expectedForMonth(W3, '2026-09') && !expectedForMonth(W4, '2026-08') && expectedForMonth(W4, '2026-07') && expectedForMonth({ id: 'x' }, '2026-08') && !expectedForMonth(W6, '2026-08') && !expectedForMonth(W, 'bad'), '재직 판정(입사일·퇴사일 경계, 날짜 없음, 잘못된 월)');
const ck3 = closeChecks('2026-08', [W], S, [r1c]); ok(ck3.ok && ck3.warnings.some((x) => x.code === 'no-workdays'), '근로일수 자료가 없으면 경고');
const r0 = ledgerRow(Object.assign({}, s1, { attHours: 0, holidayHours: 0, leaveHours: 0 }), W, 20); ok(closeChecks('2026-08', [W], S, [r0]).warnings.some((x) => x.code === 'no-hours'), '지급은 있는데 근로시간이 0이면 경고');
// ── 합계
const rows = [r1, ledgerRow(slip(W2, calc({ workerName: '이다라', holidayRecords: [], attHours: 160, leaveHours: 0, nightHours: 0, bonus: 0, techAllowance: 0 })), W2, null)];
const t = ledgerTotals(rows); ok(t.count === 2 && t.grossPay === rows[0].grossPay + rows[1].grossPay && t.netPay === rows[0].netPay + rows[1].netPay && t.workDays === 20 && t.pay.basic === rows[0].pay.basic + rows[1].pay.basic && t.ded.pension === rows[0].ded.pension + rows[1].ded.pension && t.workHours === Math.round((rows[0].workHours + rows[1].workHours) * 100) / 100, '합계 줄(인원·지급·공제·실지급·시간·일수), 근로일수 null 은 0으로 더한다');
ok(ledgerTotals([]).count === 0 && ledgerTotals(null).netPay === 0, '빈 목록 합계');
// ── CSV
const csv = ledgerCsv(rows, '2026-08', 'JH솔루션'); const lines = csv.replace(/^\ufeff/, '').split('\r\n').filter((x) => x !== '');
ok(csv.charCodeAt(0) === 0xFEFF && csv.endsWith('\r\n') && lines.length === 5, '맨 앞 BOM(엑셀 한글)·줄 끝 CRLF·줄 구성(제목·머리글·직원 2·합계)');
ok(lines[0].includes('임금대장 — 2026-08') && lines[1].includes('성명') && lines[1].split('","').length === LEDGER_HEAD.length, '제목 줄 다음 머리글(열 ' + LEDGER_HEAD.length + '개)');
ok(lines.length === 5 && lines[2].split('","').length === LEDGER_HEAD.length && lines[4].startsWith('"합계(2명)"') && lines[4].split('","').length === LEDGER_HEAD.length, '직원 줄·합계 줄의 열 수가 머리글과 같다');
const evil = ledgerCsv([ledgerRow(Object.assign({}, s1, { name: '=HYPERLINK("x")' }), W, 1)], '2026-08'); ok(evil.includes('"\'=HYPERLINK(""x"")"'), 'CSV 수식 주입 방어(= 로 시작하는 이름에 작은따옴표)');
ok(/"-?\d+"/.test(lines[2]) && !lines[2].includes('NaN') && ledgerCsv([], '2026-08').includes('"합계(0명)"'), '숫자는 숫자 그대로, 빈 목록도 깨지지 않는다');
// ── 인쇄용 HTML
const html = ledgerHtml([ledgerRow(Object.assign({}, s1, { name: '<script>alert(1)</script>' }), W, 1)], '2026-08', '<b>회사</b>');
ok(html.includes('A4 landscape') && html.includes('임금대장 — 2026-08') && !html.includes('<script>alert') && html.includes('&lt;script&gt;') && !html.includes('<b>회사</b>') && html.includes('합계(1명)'), '인쇄 문서: A4 가로, 이름·회사명의 HTML 을 막는다');
// ── 마감·해제 문서
const cd = closeDoc('2026-08', rows, ck2, 'boss@jhsol.kr', '2026-09-05T01:00:00Z', 2, { unlockLog: [{ at: 'x', by: 'y', reason: 'z' }] });
ok(isClosed(cd) && cd.ym === '2026-08' && cd.version === 2 && cd.rowCount === 2 && cd.totals.netPay === t.netPay && cd.warningCount === 1 && cd.closedBy === 'boss@jhsol.kr' && cd.unlockLog.length === 1 && closeDoc('2026-08', rows, null, '', 'n').version === 1, '마감 문서(상태·버전·인원·합계·경고 수·이전 해제 이력 보존)');
const keepNet = rows[0].netPay, keepPay = rows[0].pay.basic; const vd = versionDoc('2026-08', rows, 2, 'boss@jhsol.kr', 'n'); rows[0].netPay = -1; rows[0].pay.basic = -1; ok(vd.rows[0].netPay === keepNet && vd.rows[0].pay.basic === keepPay && vd.version === 2 && vd.rows.length === 2 && vd.by === 'boss@jhsol.kr' && vd.ym === '2026-08', '스냅샷은 원본과 분리된 깊은 복사본(나중에 원본이 바뀌어도 마감 당시 값 유지)'); rows[0].netPay = keepNet; rows[0].pay.basic = keepPay;
const up = unlockPatch(cd, 'boss@jhsol.kr', '  급여 정정  ', '2026-09-06T00:00:00Z');
ok(up.ok && up.patch.status === 'open' && up.patch.unlockLog.length === 2 && up.patch.unlockLog[1].reason === '급여 정정' && up.patch.unlockLog[1].by === 'boss@jhsol.kr' && Object.keys(up.patch).sort().join() === 'status,unlockLog', '해제: 사유 공백 정리·이력 한 줄 추가·바꾸는 칸은 상태와 이력뿐');
ok(!unlockPatch(cd, 'a', '   ', 'n').ok && !unlockPatch(cd, 'a', '', 'n').ok && !unlockPatch({ status: 'open' }, 'a', '사유', 'n').ok && !unlockPatch(null, 'a', '사유', 'n').ok, '사유가 없거나 마감 상태가 아니면 해제할 수 없다');
ok(canUnlock(true, '', []) && canUnlock(false, 'Kim@JHSOL.kr', ['kim@jhsol.kr']) && !canUnlock(false, 'x@jhsol.kr', ['kim@jhsol.kr']) && !canUnlock(false, '', ['kim@jhsol.kr']) && !canUnlock(false, 'kim@jhsol.kr', null) && !canUnlock(false, 'kim@jhsol.kr', 'kim@jhsol.kr'), '해제 권한: 관리자 + 인사 일정 담당자 목록(대소문자 무시), 목록이 아니면 거부');
ok(isYm('2026-08') && !isYm('2026-13') && !isYm('2026-8') && !isYm('') && !isYm(null) && !isClosed(null) && !isClosed({ status: 'open' }), '귀속월 형식·마감 판정');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
