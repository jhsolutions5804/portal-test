import { makeHistoryIo } from '../app/modules/hr/history-io.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const TS = (iso) => ({ toDate: () => new Date(iso) });
const seed = () => ({
  'annual_contracts/w1/contracts/a1': { contractDate: '2026-01-02', startDate: '2026-01-01', endDate: '2026-12-31', hourly: 10320, salary: 21565000 }, 'annual_contracts/w2/contracts/a9': { contractDate: '2026-02-02', startDate: '2026-02-01', endDate: '2027-01-31' },
  'labor_contracts/w1/contracts/l1': { startDate: '2026-10-13', endDate: '2026-10-30', hourly: 10030 },
  'workers/w1/history/h1': { type: 'rank', fromRank: '사원', toRank: '대리', effectiveDate: '2026-03-01' }, 'workers/w2/history/h2': { type: 'dept', fromDept: 'A', toDept: 'B', effectiveDate: '2026-04-01' },
  'interviews/w1/records/i1': { date: '2026-06-10', memo: '면담', followUp: false }, 'evaluations/w1/records/e1': { type: 'regular', year: 2025, grade: 'A', status: 'confirmed', confirmedAt: TS('2026-02-10T01:00:00Z') },
  'severance/w1/records/s1': { retireDate: '2026-11-30', serviceDays: 100, severance: 1000000 }, 'leave_promotions/w1/records/p1': { stage: 'p1', noticeDate: '2026-07-01', periodStart: '2026-01-01', periodEnd: '2026-12-31', unusedDays: 3 },
  'payslips/w1/months/2026-08': { month: '2026-08', netPay: 2000000 }, 'payslips/w2/months/2026-08': { month: '2026-08' },
  'dismissal_notices/d1': { workerId: 'w1', noticeDate: '2026-10-20', dismissalDate: '2026-11-19', reasonType: 'x' }, 'dismissal_notices/d2': { workerId: 'w2', noticeDate: '2026-10-21', dismissalDate: '2026-11-20' },
  'doc_send_log/x1': { workerId: 'w1', sentAt: TS('2026-10-04T04:00:00Z'), channel: 'email', docLabel: '급여명세서', toMasked: 'ys***@jhsol.kr' }, 'doc_send_log/x2': { workerId: 'w2', sentAt: TS('2026-10-05T04:00:00Z'), channel: 'email', docLabel: '근로계약서' },
  'edoc_leave/v1': { authorName: '김가나', status: 'approved', leaveType: '연차', startDate: '2026-07-01', endDate: '2026-07-01' }, 'edoc_leave/v2': { authorName: '이다라', status: 'approved', leaveType: '연차', startDate: '2026-07-02', endDate: '2026-07-02' },
  'edoc_resign/r1': { authorName: '김가나', lastDate: '2026-11-30', status: 'approved', leaveKind: '퇴직' }, 'edoc_resign/r2': { authorName: '이다라', lastDate: '2026-12-31', status: 'approved' }
});
function fake(opt) { const o = opt || {}; const store = seed(); const log = []; const snap = (id, d) => ({ id, data: () => d }); // 값을 복사하지 않는다(시각 값의 toDate 함수가 지워지지 않도록)
  const fb = { db: {}, collection: (db, p) => ({ coll: p }), where: (f, op, v) => ({ f, op, v }), query: (c, ...w) => ({ coll: c.coll, w }),
    getDocs: async (q) => { const c = q.coll; const w = q.w || []; log.push(c + (w.length ? '?' + w.map((x) => x.f + x.op + x.v).join('&') : ''));
      if ((o.failColl || []).some((f) => c === f || c.startsWith(f))) throw new Error('permission-denied'); const out = []; for (const [p, d] of Object.entries(store)) { if (p.startsWith(c + '/') && !p.slice(c.length + 1).includes('/') && w.every((x) => d[x.f] === x.v)) out.push(snap(p.split('/').pop(), d)); } return { size: out.length, forEach: (fn) => out.forEach(fn) }; } };
  return { fb, log, store }; }
const W1 = { id: 'w1', name: '김가나', dept: '사업본부', rank: '대리', hireDate: '2024-03-01' };
let F = fake(), io = makeHistoryIo(F.fb), r = await io.load(W1);
const keys = r.items.map((i) => i.key).sort().join();
ok(r.errors.length === 0 && r.skipped === 0 && keys === 'annual:a1,change:h1,dismissal:d1,eval:e1,interview:i1,join,labor:l1,leave:v1,payslip:2026,promo:p1,resign:r1,retire:s1,send:x1', '모든 종류의 이력이 모인다(계약 2·변동·면담·평가·퇴직 정산·촉진·급여명세서·해고예고·발송·연차·퇴직원서·입사)');
ok(!r.items.some((i) => ['annual:a9', 'change:h2', 'dismissal:d2', 'send:x2', 'leave:v2', 'resign:r2'].includes(i.key)) && r.items.find((i) => i.key === 'payslip:2026').title === '급여명세서 2026년 1건', '다른 직원의 자료(계약·변동·해고예고·발송·연차·퇴직원서)는 섞이지 않는다');
ok(r.items.map((i) => i.date).join() === r.items.map((i) => i.date).sort().reverse().join() && r.items[0].date === '2026-11-30', '결과는 최신 날짜 순');
ok(r.items.find((i) => i.key === 'annual:a1').secret === '시급 10,320원 · 연봉 21,565,000원' && !JSON.stringify(r.items.map((i) => [i.title, i.detail])).includes('21,565,000'), '금액은 secret 에만 있고 제목·내용에는 없다');
const q = F.log; ok(q.length === 12 && q.includes('dismissal_notices?workerId==w1') && q.includes('doc_send_log?workerId==w1') && q.includes('edoc_leave?authorName==김가나') && q.includes('edoc_resign?authorName==김가나') && q.includes('annual_contracts/w1/contracts') && q.includes('payslips/w1/months') && !q.includes('edoc_leave') && !q.includes('dismissal_notices') && !q.includes('doc_send_log') && !q.includes('edoc_resign'), '읽기는 정확히 12번: 공용 컬렉션(해고예고·서류 발송·연차·퇴직원서)은 직원 조건을 붙여 읽고 전체를 읽지 않는다');
// ── 일부 실패
F = fake({ failColl: ['evaluations/w1', 'edoc_leave'] }); r = await makeHistoryIo(F.fb).load(W1);
ok(r.errors.join() === '평가,연차·휴가' && r.items.some((i) => i.kind === 'contract') && r.items.some((i) => i.kind === 'join') && !r.items.some((i) => i.kind === 'eval') && !r.items.some((i) => i.kind === 'leave'), '일부 읽기가 실패하면 그 자료 이름이 errors 에 담기고 나머지는 그대로 보인다(예외로 전체가 사라지지 않음)');
F = fake({ failColl: ['annual_contracts', 'labor_contracts', 'workers', 'interviews', 'evaluations', 'severance', 'leave_promotions', 'payslips', 'dismissal_notices', 'doc_send_log', 'edoc_leave', 'edoc_resign'] }); r = await makeHistoryIo(F.fb).load(W1);
ok(r.errors.length === 12 && r.items.length === 1 && r.items[0].kind === 'join', '전부 실패해도 예외 없이 오류 12건과 명부의 입사 한 줄만');
// ── 입력 방어
F = fake(); r = await makeHistoryIo(F.fb).load({ id: 'w1', name: '', hireDate: '2024-03-01' }); ok(r.errors.length === 0 && F.log.length === 10 && !F.log.some((x) => x.startsWith('edoc_')), '이름이 없으면 연차·퇴직원서는 읽지 않는다(이름 없는 조건으로 전체를 읽지 않도록)');
F = fake(); r = await makeHistoryIo(F.fb).load({ name: '번호없음', hireDate: '2024-03-01' }); ok(r.items.length === 0 && r.errors.join() === '직원 번호 없음' && F.log.length === 0, '직원 번호가 없으면 아무것도 읽지 않는다(undefined 경로 방지)');
F = fake(); r = await makeHistoryIo(F.fb).load(null); ok(r.items.length === 0 && r.errors.length === 1 && F.log.length === 0, '직원 자체가 없어도 깨지지 않는다');
F = fake(); r = await makeHistoryIo(F.fb).load({ id: 'zz', name: '없는사람' }); ok(r.items.length === 0 && r.errors.length === 0 && r.skipped === 0, '자료가 하나도 없는 직원은 빈 목록(오류 아님)');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
