import { makeLedgerIo } from '../app/modules/hr/ledger-io.js';
import { payslipCalc, payslipRecord } from '../app/modules/hr/payslip.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rej = async (fn) => { try { await fn(); return null; } catch (e) { return String((e && e.message) || e); } };
const TS = { __ts: 'serverTimestamp' };
// ── 가짜 저장소: 경로 → 문서, 같은 모양의 함수(doc·collection·query·where·getDoc·getDocs·updateDoc·writeBatch)
function fake(seed, opt) {
  const o = opt || {}; const store = new Map(Object.entries(seed)); const log = []; const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const snap = (path, d) => ({ id: path.split('/').pop(), exists: () => d !== undefined, data: () => clone(d) });
  const fb = {
    db: {}, serverTimestamp: () => TS, where: (f, op, v) => ({ f, op, v }),
    doc: (db, ...s) => ({ path: s.join('/') }), collection: (db, p) => ({ coll: p }), query: (c, ...w) => ({ coll: c.coll, w }),
    getDoc: async (r) => { if (o.failRead && r.path.startsWith(o.failRead)) throw new Error('permission-denied'); return snap(r.path, store.get(r.path)); },
    getDocs: async (q) => { const c = q.coll + '/'; const out = []; for (const [p, d] of store) if (p.startsWith(c) && !p.slice(c.length).includes('/') && (q.w || []).every((w) => d[w.f] === w.v)) out.push(snap(p, d)); return { size: out.length, forEach: (fn) => out.forEach(fn), docs: out }; },
    updateDoc: async (r, patch) => { if (!store.has(r.path)) throw new Error('not-found'); log.push(['update', r.path]); store.set(r.path, Object.assign({}, store.get(r.path), clone(patch))); },
    writeBatch: () => { const ops = []; return { set(r, d) { ops.push([r.path, d]); }, commit: async () => { if (o.failCommit) throw new Error('commit-failed'); ops.forEach(([p, d]) => { log.push(['set', p]); store.set(p, clone(d)); }); } }; }
  };
  return { fb, store, log };
}
const W1 = { name: '김가나', empNo: 'E01', dept: '사업본부', rank: '대리' }, W2 = { name: '이다라', empNo: 'E02', dept: '관리팀', rank: '사원' }, W3 = { name: '퇴사자', empNo: 'E03', status: 'resigned', resignDate: '2026-06-30', hireDate: '2020-01-01' };
const calc = (name, o) => payslipCalc(Object.assign({ hourly: 11000, month: '2026-08', attHours: 176, leaveHours: 0, nightHours: 4, attDates: new Set(), leaveDocs: [], workerName: name, holidayRecords: [], holidaySet: new Set(), bonus: 100000, specialBonus: 0, extraPay: 0, techAllowance: 0, travelAllowance: 0, dormitory: 0 }, o || {}));
const slip = (w, id, name, extra, o) => Object.assign({}, payslipRecord(Object.assign({ id }, w), { hourly: 11000 }, '2026-08', '2026-09-30', '', calc(name, o), [], '2026-09-30T00:00:00Z', extra && extra.__wd), (extra || {}).fields || {});
const seed = () => ({
  'workers/w1': W1, 'workers/w2': W2, 'workers/w3': W3, 'worker_private/w1': { job: 'FCU 설치', hireDate: '2024-03-01' }, 'worker_private/w2': { job: '총무', hireDate: '2025-01-02' },
  'payslips/w1/months/2026-08': slip(W1, 'w1', '김가나'), 'payslips/w2/months/2026-08': slip(W2, 'w2', '이다라', { __wd: 21 }),
  'worker_attendance_log/w1_2026-08-03': { workerId: 'w1', yearMonth: '2026-08', date: '2026-08-03' }, 'worker_attendance_log/w1_2026-08-04': { workerId: 'w1', yearMonth: '2026-08', date: '2026-08-04' }, 'worker_attendance_log/w1_2026-08-05': { workerId: 'w1', yearMonth: '2026-08', date: '2026-08-05' },
  'worker_attendance_log/w1_2026-07-01': { workerId: 'w1', yearMonth: '2026-07', date: '2026-07-01' }, 'worker_attendance_log/w2_2026-08-03': { workerId: 'w2', yearMonth: '2026-08', date: '2026-08-03' }
});
// ── loadMonth
let F = fake(seed()), io = makeLedgerIo(F.fb), d = await io.loadMonth('2026-08');
ok(d.rows.length === 2 && d.rows[0].empNo === 'E01' && d.rows[1].empNo === 'E02' && d.ym === '2026-08', '급여명세서가 있는 직원만 사번 순으로 한 줄씩(퇴사자·명세서 없는 사람은 줄 없음)');
ok(d.rows[0].job === 'FCU 설치' && d.rows[0].hireDate === '2024-03-01' && d.rows[0].name === '김가나', '명부와 비공개 명부를 합쳐 고용일·종사업무를 채운다');
ok(d.rows[0].workDays === 3 && d.rows[0].workDaysFrom === 'attendance', '명세서에 근로일수가 없으면 그 달 출퇴근 기록의 날짜 수(3일, 다른 달 기록은 제외)');
ok(d.rows[1].workDays === 21 && d.rows[1].workDaysFrom === 'slip', '명세서에 근로일수가 있으면 그 값(출퇴근 기록 1건이 있어도 21일)');
ok(d.checks.ok && d.checks.blockers.length === 0 && d.close === null, '점검 통과·마감 문서 없음');
const f2 = fake(Object.assign(seed(), { 'worker_attendance_log/w1_2026-08-03': { workerId: 'w1', yearMonth: '2026-08', date: '2026-08-03' }, 'worker_attendance_log/w1_2026-08-03b': { workerId: 'w1', yearMonth: '2026-08', date: '2026-08-03' }, 'worker_attendance_log/w1_2026-08-04': undefined })); f2.store.delete('worker_attendance_log/w1_2026-08-04'); f2.store.delete('worker_attendance_log/w1_2026-08-05');
ok((await makeLedgerIo(f2.fb).loadMonth('2026-08')).rows[0].workDays === 1, '같은 날짜 기록이 여러 건이어도 하루로 센다');
const f3 = fake(seed()); [...f3.store.keys()].filter((k) => k.startsWith('worker_attendance_log/w1')).forEach((k) => f3.store.delete(k)); const d3 = await makeLedgerIo(f3.fb).loadMonth('2026-08');
ok(d3.rows[0].workDays === null && d3.checks.warnings.some((w) => w.code === 'no-workdays'), '출퇴근 기록이 없으면 "자료 없음"(null)과 경고 — 0일로 만들지 않는다');
const f4 = fake(Object.assign(seed(), { 'workers/w4': { name: '신입', empNo: 'E04', hireDate: '2026-01-01' } })); const d4 = await makeLedgerIo(f4.fb).loadMonth('2026-08');
ok(d4.checks.warnings.some((w) => w.code === 'missing-slip' && w.workerId === 'w4') && !d4.checks.warnings.some((w) => w.workerId === 'w3'), '재직 중인데 명세서가 없는 직원은 경고, 이미 퇴사한 직원은 경고 없음');
ok((await rej(() => io.loadMonth('2026-8'))) !== null && (await rej(() => io.loadMonth(''))) !== null && (await rej(() => io.loadMonth('2026-13'))) !== null, '잘못된 귀속월은 읽지 않고 예외');
const e1 = await rej(() => makeLedgerIo(fake(seed(), { failRead: 'payslips/w2' }).fb).loadMonth('2026-08')); ok(e1 && e1.includes('permission-denied'), '읽기에 실패하면 빈 표로 숨기지 않고 예외를 그대로 던진다');
// ── closeMonth
F = fake(seed()); io = makeLedgerIo(F.fb); d = await io.loadMonth('2026-08');
const r = await io.closeMonth('2026-08', d, 'ADM@JHSOL.KR');
const cd = F.store.get('payroll_close/2026-08'), vd = F.store.get('payroll_close/2026-08/versions/1');
ok(r.version === 1 && r.count === 2 && cd && vd, '마감: 마감 문서와 스냅샷(versions/1)이 함께 저장된다');
ok(cd.status === 'closed' && cd.version === 1 && cd.ym === '2026-08' && cd.closedBy === 'adm@jhsol.kr' && cd.closedAt && cd.closedAt.__ts === 'serverTimestamp' && cd.rowCount === 2 && Array.isArray(cd.unlockLog) && cd.unlockLog.length === 0 && cd.totals.netPay === d.rows[0].netPay + d.rows[1].netPay, '마감 문서: 상태·버전·마감자(소문자)·서버 시각·인원·합계·빈 해제 이력');
ok(vd.ym === '2026-08' && vd.version === 1 && vd.by === 'adm@jhsol.kr' && vd.at.__ts === 'serverTimestamp' && vd.rows.length === 2 && vd.rows[0].name === '김가나' && vd.rows[0].workDays === 3, '스냅샷: 마감 당시 직원 줄(근로일수 포함)을 그대로 보관');
ok(F.log.filter((l) => l[0] === 'set').length === 2, '쓰기는 정확히 2건(스냅샷 + 마감 문서)');
const d5 = await io.loadMonth('2026-08'); ok(d5.close && d5.close.status === 'closed' && d5.close.version === 1, '마감 뒤 다시 불러오면 마감 상태가 보인다');
ok((await rej(() => io.closeMonth('2026-08', d5, 'adm@jhsol.kr'))) === '이미 마감된 달입니다.', '이미 마감된 달은 다시 마감할 수 없다');
// 마감 직전 다시 읽기(화면을 열어 둔 사이 바뀐 값)
F = fake(seed()); io = makeLedgerIo(F.fb); d = await io.loadMonth('2026-08');
F.store.set('payslips/w2/months/2026-08', Object.assign({}, F.store.get('payslips/w2/months/2026-08'), { grossPay: 9999999 }));
const e2 = await rej(() => io.closeMonth('2026-08', d, 'adm@jhsol.kr')); ok(e2 && e2.includes('점검을 통과하지 못했습니다') && !F.store.has('payroll_close/2026-08') && F.log.length === 0, '화면을 열어 둔 사이 값이 틀어지면 마감 직전 점검이 막고 아무것도 쓰지 않는다');
F = fake(seed()); io = makeLedgerIo(F.fb); d = await io.loadMonth('2026-08');
F.store.set('payslips/w2/months/2026-08', Object.assign({}, F.store.get('payslips/w2/months/2026-08'), { attHours: 123.5, holidayHours: 0 })); await io.closeMonth('2026-08', d, 'adm@jhsol.kr');
ok(F.store.get('payroll_close/2026-08/versions/1').rows[1].workHours === 123.5, '스냅샷은 화면에 있던 값이 아니라 마감 순간 다시 읽은 최신 값');
// 점검 실패·잘못된 호출
F = fake(Object.assign(seed(), { 'payslips/w1/months/2026-08': Object.assign({}, seed()['payslips/w1/months/2026-08'], { netPay: 1 }) })); io = makeLedgerIo(F.fb); d = await io.loadMonth('2026-08');
ok(!d.checks.ok && (await rej(() => io.closeMonth('2026-08', d, 'adm@jhsol.kr'))) !== null && F.log.length === 0, '점검에서 막힌 달은 마감되지 않고 아무것도 쓰지 않는다');
F = fake(seed()); io = makeLedgerIo(F.fb); d = await io.loadMonth('2026-08');
ok((await rej(() => io.closeMonth('2026-09', d, 'adm@jhsol.kr'))) !== null && (await rej(() => io.closeMonth('2026-08', null, 'adm@jhsol.kr'))) !== null && (await rej(() => io.closeMonth('2026-08', d, ''))) !== null && (await rej(() => io.closeMonth('2026-08', d, '   '))) !== null && F.log.length === 0, '다른 달 내용·빈 내용·이메일 없음으로는 마감할 수 없다');
const Ff = fake(seed(), { failCommit: true }); const iof = makeLedgerIo(Ff.fb); const df = await iof.loadMonth('2026-08'); const ef = await rej(() => iof.closeMonth('2026-08', df, 'adm@jhsol.kr'));
ok(ef === 'commit-failed' && !Ff.store.has('payroll_close/2026-08') && !Ff.store.has('payroll_close/2026-08/versions/1'), '저장이 실패하면 마감 문서도 스냅샷도 남지 않는다(한 번에 묶음)');
// ── unlockMonth
F = fake(seed()); io = makeLedgerIo(F.fb); d = await io.loadMonth('2026-08'); await io.closeMonth('2026-08', d, 'adm@jhsol.kr'); F.log.length = 0;
ok((await rej(() => io.unlockMonth('2026-08', 'hr@jhsol.kr', '   '))) !== null && (await rej(() => io.unlockMonth('2026-08', 'hr@jhsol.kr', ''))) !== null && (await rej(() => io.unlockMonth('2026-08', '', '사유'))) !== null && F.log.length === 0, '사유가 없거나 이메일이 없으면 해제하지 않는다');
ok((await rej(() => io.unlockMonth('2026-09', 'hr@jhsol.kr', '사유'))) !== null, '마감 문서가 없는 달은 해제할 수 없다');
await io.unlockMonth('2026-08', 'HR@JHSOL.KR', '  6월분 식대 정정  ');
const ud = F.store.get('payroll_close/2026-08');
ok(ud.status === 'open' && ud.unlockLog.length === 1 && ud.unlockLog[0].by === 'hr@jhsol.kr' && ud.unlockLog[0].reason === '6월분 식대 정정' && /^\d{4}-\d{2}-\d{2}T/.test(ud.unlockLog[0].at) && Object.keys(ud.unlockLog[0]).sort().join() === 'at,by,reason' && ud.version === 1 && ud.rowCount === 2, '해제: 상태 open + 이력 한 줄(소문자 이메일·공백 정리 사유·ISO 시각), 나머지 칸은 그대로');
ok(F.log.length === 1 && F.log[0][0] === 'update', '해제는 문서 한 건 수정뿐');
ok((await rej(() => io.unlockMonth('2026-08', 'hr@jhsol.kr', '또'))) === '마감된 달이 아닙니다.', '이미 해제된 달은 다시 해제할 수 없다');
// ── 해제 → 재마감
d = await io.loadMonth('2026-08'); ok(d.close.status === 'open', '해제 뒤 불러오면 해제 상태');
const r2 = await io.closeMonth('2026-08', d, 'adm@jhsol.kr'); const cd2 = F.store.get('payroll_close/2026-08');
ok(r2.version === 2 && cd2.status === 'closed' && cd2.version === 2 && cd2.unlockLog.length === 1 && cd2.unlockLog[0].reason === '6월분 식대 정정', '재마감: 버전 2, 이전 해제 이력은 그대로 보존');
ok(F.store.has('payroll_close/2026-08/versions/1') && F.store.has('payroll_close/2026-08/versions/2') && F.store.get('payroll_close/2026-08/versions/1').version === 1, '이전 버전 스냅샷(v1)은 남고 새 스냅샷(v2)이 추가된다');
// ── 해제를 두 번 반복하면 이력이 누적된다
await io.unlockMonth('2026-08', 'adm@jhsol.kr', '두 번째 정정'); const ud2 = F.store.get('payroll_close/2026-08');
ok(ud2.status === 'open' && ud2.version === 2 && ud2.unlockLog.length === 2 && ud2.unlockLog[0].reason === '6월분 식대 정정' && ud2.unlockLog[1].reason === '두 번째 정정' && ud2.unlockLog[1].by === 'adm@jhsol.kr', '해제를 반복하면 이전 이력은 그대로 두고 한 줄씩 누적(버전은 마지막 마감 그대로)');
const r3 = await io.closeMonth('2026-08', await io.loadMonth('2026-08'), 'adm@jhsol.kr'); ok(r3.version === 3 && F.store.get('payroll_close/2026-08').unlockLog.length === 2, '다시 마감하면 버전 3, 이력 2건 유지');
// ── 사번 순서(입력 순서와 무관)
const fo = fake(Object.assign(seed(), { 'workers/w0': { name: '박영', empNo: 'E00', dept: '관리팀', rank: '사원' }, 'payslips/w0/months/2026-08': slip({ name: '박영', empNo: 'E00', dept: '관리팀', rank: '사원' }, 'w0', '박영', { __wd: 20 }) }));
const dord = await makeLedgerIo(fo.fb).loadMonth('2026-08'); ok(dord.rows.map((x) => x.empNo).join() === 'E00,E01,E02', '줄은 사번 순서(나중에 저장된 직원도 맨 앞에 올 수 있다)');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
