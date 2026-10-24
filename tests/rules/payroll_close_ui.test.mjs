// 임금대장 입출력(ledger-io.js)이 만든 문서가 실제 보안 규칙을 통과하는지 — 에뮬레이터에서 처음부터 끝까지(대기열 1-3-16 ①).
// 앱 코드는 PORTAL_ROOT(저장소 경로)에서 불러오고, 규칙은 RULES_FILE 로 고른다. 실행 예: PORTAL_ROOT=... RULES_FILE=.../rules/firestore.test.rules firebase emulators:exec --only firestore --project demo-eval 'node payroll_close_ui.test.mjs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'; import { readFileSync } from 'node:fs'; import { pathToFileURL } from 'node:url'; import { join } from 'node:path';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
const ROOT = process.env.PORTAL_ROOT; if (!ROOT) { console.log('PORTAL_ROOT 가 필요합니다'); process.exit(2); }
const imp = (f) => import(pathToFileURL(join(ROOT, 'app/modules/hr', f)).href);
const { makeLedgerIo } = await imp('ledger-io.js'); const { payslipCalc, payslipRecord } = await imp('payslip.js');
const env = await initializeTestEnvironment({ projectId: 'demo-eval', firestore: { rules: readFileSync(process.env.RULES_FILE, 'utf8'), host: '127.0.0.1', port: 8089 } });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rej = async (fn) => { try { await fn(); return null; } catch (e) { return String((e && e.code) || (e && e.message) || e); } };
const em = (u) => ({ email: u + '@jhsol.kr' });
const calc = (n) => payslipCalc({ hourly: 11000, month: '2026-08', attHours: 176, leaveHours: 8, nightHours: 4, attDates: new Set(), leaveDocs: [], workerName: n, holidayRecords: [{ date: '2026-08-15', workHours: 6 }], holidaySet: new Set(), bonus: 100000, specialBonus: 0, extraPay: 0, techAllowance: 0, travelAllowance: 0, dormitory: 0 });
const slip = (W, n, wd) => payslipRecord(W, { hourly: 11000 }, '2026-08', '2026-09-30', '', calc(n), [], '2026-09-30T00:00:00Z', wd);
const W1 = { id: 'w1', name: '김가나', empNo: 'E01', dept: '사업본부', rank: '대리' }, W2 = { id: 'w2', name: '이다라', empNo: 'E02', dept: '관리팀', rank: '사원' };
await env.withSecurityRulesDisabled(async (c) => { const db = c.firestore();
  await setDoc(doc(db, 'portal_users/ADM'), { status: 'approved', admin: true }); await setDoc(doc(db, 'portal_users/HR'), { status: 'approved', admin: false }); await setDoc(doc(db, 'portal_users/EMP'), { status: 'approved', admin: false });
  await setDoc(doc(db, 'hr_calendar_access/config'), { emails: ['hr@jhsol.kr'] });
  await setDoc(doc(db, 'workers/w1'), { name: '김가나', empNo: 'E01', dept: '사업본부', rank: '대리' }); await setDoc(doc(db, 'workers/w2'), { name: '이다라', empNo: 'E02', dept: '관리팀', rank: '사원' });
  await setDoc(doc(db, 'worker_private/w1'), { job: 'FCU 설치', hireDate: '2024-03-01' });
  await setDoc(doc(db, 'payslips/w1/months/2026-08'), slip(W1, '김가나')); await setDoc(doc(db, 'payslips/w2/months/2026-08'), slip(W2, '이다라', 21));
  for (const d of ['2026-08-03', '2026-08-04', '2026-08-05']) await setDoc(doc(db, 'worker_attendance_log/w1_' + d), { workerId: 'w1', yearMonth: '2026-08', date: d });
});
const ctx = (u) => env.authenticatedContext(u, em(u)).firestore();
const fbOf = (db) => ({ db, doc, getDoc, getDocs, collection, query, where, updateDoc, writeBatch, serverTimestamp });
const adm = ctx('ADM'), hr = ctx('HR'), emp = ctx('EMP');
const ioA = makeLedgerIo(fbOf(adm)), ioH = makeLedgerIo(fbOf(hr)), ioE = makeLedgerIo(fbOf(emp));
// ── 불러오기
const d = await ioA.loadMonth('2026-08');
ok(d.rows.length === 2 && d.rows[0].workDays === 3 && d.rows[1].workDays === 21 && d.checks.ok && d.close === null, '관리자: 실제 규칙 아래에서 명세서·명부·출퇴근 기록을 읽어 임금대장이 만들어진다(근로일수 3·21, 점검 통과)');
ok((await rej(() => ioE.loadMonth('2026-08'))) !== null, '일반 직원은 임금대장을 불러올 수 없다(급여명세서 읽기 거부 → 예외, 빈 표로 숨기지 않음)');
ok((await rej(() => ioH.loadMonth('2026-08'))) !== null, '인사 일정 담당자(비관리자)도 급여명세서가 없으니 임금대장을 불러올 수 없다');
// ── 마감
ok((await rej(() => ioE.closeMonth('2026-08', d, 'emp@jhsol.kr'))) !== null && (await rej(() => ioH.closeMonth('2026-08', d, 'hr@jhsol.kr'))) !== null, '일반 직원·인사 일정 담당자는 마감할 수 없다');
ok((await getDoc(doc(adm, 'payroll_close/2026-08'))).exists() === false, '실패한 마감 시도는 아무것도 남기지 않는다');
const rc = await ioA.closeMonth('2026-08', d, 'ADM@jhsol.kr'); ok(rc.version === 1 && rc.count === 2, '★ 관리자가 앱 코드로 마감하면 규칙을 통과한다(마감 문서 + 스냅샷 한 번에)');
const cd = (await getDoc(doc(adm, 'payroll_close/2026-08'))).data(), vd = (await getDoc(doc(adm, 'payroll_close/2026-08/versions/1'))).data();
ok(cd.status === 'closed' && cd.version === 1 && cd.closedBy === 'adm@jhsol.kr' && cd.rowCount === 2 && vd.rows.length === 2 && vd.rows[0].workDays === 3, '저장된 마감 문서·스냅샷 내용(마감자 소문자·근로일수 포함)');
ok((await rej(() => setDoc(doc(adm, 'payslips/w1/months/2026-08'), slip(W1, '김가나')))) !== null && (await rej(() => deleteDoc(doc(adm, 'payslips/w1/months/2026-08')))) !== null, '★ 마감 뒤에는 관리자도 그 달 급여명세서를 고치거나 지울 수 없다');
ok((await rej(() => setDoc(doc(adm, 'payslips/w1/months/2026-09'), Object.assign(slip(W1, '김가나'), { month: '2026-09' })))) === null, '다른 달 급여명세서는 계속 쓸 수 있다');
ok((await rej(() => ioA.closeMonth('2026-08', d, 'adm@jhsol.kr'))) !== null, '이미 마감된 달은 다시 마감할 수 없다');
// ── 해제(인사 일정 담당자)
ok((await rej(() => ioE.unlockMonth('2026-08', 'emp@jhsol.kr', '사유'))) !== null, '일반 직원은 해제할 수 없다');
ok((await rej(() => ioH.unlockMonth('2026-08', 'hr@jhsol.kr', '   '))) !== null, '사유가 없으면 해제할 수 없다');
ok((await rej(() => ioH.unlockMonth('2026-08', 'someone@jhsol.kr', '남의 이름'))) !== null, '다른 사람 이름으로는 해제할 수 없다(규칙이 거부)');
ok((await rej(() => ioH.unlockMonth('2026-08', 'HR@JHSOL.KR', '  6월분 식대 정정  '))) === null, '★ 인사 일정 담당자(비관리자)가 앱 코드로 사유를 적고 해제하면 규칙을 통과한다');
const ud = (await getDoc(doc(adm, 'payroll_close/2026-08'))).data(); ok(ud.status === 'open' && ud.unlockLog.length === 1 && ud.unlockLog[0].by === 'hr@jhsol.kr' && ud.unlockLog[0].reason === '6월분 식대 정정', '해제 이력: 담당자 이메일과 사유가 남는다');
ok((await rej(() => setDoc(doc(adm, 'payslips/w1/months/2026-08'), slip(W1, '김가나', 20)))) === null, '해제하면 그 달 급여명세서를 다시 고칠 수 있다(근로일수 20 저장)');
// ── 재마감: 고친 명세서가 스냅샷에 반영, 이력 보존
const d2 = await ioA.loadMonth('2026-08'); ok(d2.rows[0].workDays === 20 && d2.rows[0].workDaysFrom === 'slip' && d2.close.status === 'open', '다시 불러오면 새 명세서의 근로일수(20)가 보인다');
ok((await rej(() => ioH.closeMonth('2026-08', d2, 'hr@jhsol.kr'))) !== null, '인사 일정 담당자는 다시 마감할 수 없다(관리자만)');
const rc2 = await ioA.closeMonth('2026-08', d2, 'adm@jhsol.kr'); const cd2 = (await getDoc(doc(adm, 'payroll_close/2026-08'))).data();
ok(rc2.version === 2 && cd2.status === 'closed' && cd2.version === 2 && cd2.unlockLog.length === 1, '★ 재마감: 앱 코드가 버전 2 로 마감하고 규칙을 통과하며 해제 이력은 그대로 보존된다');
ok((await getDoc(doc(adm, 'payroll_close/2026-08/versions/1'))).data().rows[0].workDays === 3 && (await getDoc(doc(adm, 'payroll_close/2026-08/versions/2'))).data().rows[0].workDays === 20, '이전 마감 스냅샷(v1: 3일)은 그대로, 새 스냅샷(v2: 20일)이 추가된다');
ok((await rej(() => setDoc(doc(adm, 'payslips/w1/months/2026-08'), slip(W1, '김가나')))) !== null, '재마감하면 다시 잠긴다');
ok((await rej(() => deleteDoc(doc(adm, 'payroll_close/2026-08')))) !== null && (await rej(() => updateDoc(doc(adm, 'payroll_close/2026-08/versions/1'), { rows: [] }))) !== null, '마감 문서와 스냅샷은 관리자도 지우거나 고칠 수 없다');
// ── 급여명세서 화면이 저장하는 모양(근로일수 포함)도 규칙을 통과한다
ok((await rej(() => setDoc(doc(adm, 'payslips/w2/months/2026-07'), Object.assign(slip(W2, '이다라', 22), { month: '2026-07' })))) === null && (await getDoc(doc(adm, 'payslips/w2/months/2026-07'))).data().workDays === 22, '새로 저장하는 급여명세서(근로일수 workDays 포함)도 규칙을 통과한다');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); await env.cleanup(); process.exit(fail ? 1 : 0);
