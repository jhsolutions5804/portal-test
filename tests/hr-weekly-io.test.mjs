import { makeWeeklyIo } from '../app/modules/hr/weekly-io.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rej = async (fn) => { try { await fn(); return null; } catch (e) { return String((e && e.message) || e); } };
const L = (id, wid, date, h) => [id, { workerId: wid, yearMonth: date.slice(0, 7), date, workHours: h, name: wid }];
const seed = Object.fromEntries([L('a1', 'w1', '2025-12-30', 8), L('a2', 'w1', '2026-01-02', 8), L('a3', 'w2', '2025-12-31', 9), L('a4', 'w1', '2026-09-30', 8), L('a5', 'w1', '2026-10-05', 8), L('a6', 'w1', '2026-10-12', 8), L('a7', 'w1', '2026-10-19', 8), L('a8', 'w1', '2026-10-25', 7), L('a9', 'w1', '2026-10-26', 8), L('b1', 'w2', '2026-10-20', 9), L('b2', 'w1', '2026-11-02', 8), L('b3', 'w2', '2026-11-03', 8), L('b4', 'w1', '2026-11-30', 8), L('b5', 'w1', '2026-12-01', 8)]);
function fake(opt) { const queries = []; const fb = { db: {}, collection: (db, p) => ({ coll: p }), where: (f, op, v) => ({ f, op, v }), query: (c, ...w) => ({ coll: c.coll, w }),
  getDocs: async (q) => { if (opt && opt.fail) throw new Error('permission-denied'); queries.push(q.w.map((x) => x.f + x.op + x.v).join('&')); const out = Object.entries(seed).filter(([, d]) => q.coll === 'worker_attendance_log' && q.w.every((w) => d[w.f] === w.v)).map(([id, d]) => ({ id, data: () => JSON.parse(JSON.stringify(d)) })); return { size: out.length, forEach: (fn) => out.forEach(fn) }; } }; return { fb, queries }; }
let F = fake(), io = makeWeeklyIo(F.fb);
// ── 앞·뒤 달 기록(한 직원)
let a = await io.adjacentRows('w1', 2026, 10);
ok(a.map((r) => r.date).sort().join() === '2026-09-30,2026-11-02,2026-11-30' && a.every((r) => r.workerId === 'w1'), '10월을 보는 중이면 9월과 11월의 그 직원 기록만(10월·다른 직원 제외)');
ok(F.queries.length === 2 && F.queries.every((q) => q.includes('workerId==w1')) && F.queries[0].includes('yearMonth==2026-09') && F.queries[1].includes('yearMonth==2026-11'), '조회는 정확히 2번, 모두 직원 조건 포함(전 직원 기록을 읽지 않는다)');
a = await io.adjacentRows('w1', 2026, 1); ok(a.map((r) => r.date).join() === '2025-12-30', '1월을 보면 앞 달은 작년 12월(2026-02 기록은 없으니 비어 있음)');
a = await io.adjacentRows('w1', 2026, 12); ok(a.map((r) => r.date).sort().join() === '2026-11-02,2026-11-30', '12월을 보면 뒤 달은 내년 1월(기록 없음), 앞 달은 11월');
a = await io.adjacentRows('w2', 2026, 1); ok(a.map((r) => r.date).join() === '2025-12-31', '다른 직원도 같은 방식');
ok((await io.adjacentRows('없는직원', 2026, 10)).length === 0, '기록이 없으면 빈 목록');
// ── 이번 주·지난주 전체 기록
F = fake(); io = makeWeeklyIo(F.fb); let r = await io.reportRows('2026-10-25');
ok(r.map((x) => x.date).sort().join() === '2026-10-12,2026-10-19,2026-10-20,2026-10-25' && F.queries.length === 1 && F.queries[0] === 'yearMonth==2026-10', '일요일(10-25): 이번 주 10-19~25 와 지난주 10-12~18 만, 같은 달이라 조회 1번(10-05·10-26 제외)');
F = fake(); io = makeWeeklyIo(F.fb); r = await io.reportRows('2026-11-02');
ok(r.map((x) => x.date).sort().join() === '2026-10-26,2026-11-02,2026-11-03' && F.queries.length === 2, '월요일(11-02): 지난주 10-26~11-01 이라 두 달(10·11월)을 읽고 그 범위만(10-25 제외)');
F = fake(); io = makeWeeklyIo(F.fb); r = await io.reportRows('2026-01-05');
ok(r.map((x) => x.date).sort().join() === '2025-12-30,2025-12-31,2026-01-02' && F.queries.sort().join() === 'yearMonth==2025-12,yearMonth==2026-01', '해가 바뀌는 때(2026-01-05): 작년 12월과 올해 1월');
F = fake(); io = makeWeeklyIo(F.fb); r = await io.reportRows('2026-10-20'); ok(r.some((x) => x.workerId === 'w2') && r.some((x) => x.workerId === 'w1'), '모든 직원 기록을 함께 가져온다(홈 신호용)');
ok(/permission-denied/.test(await rej(() => makeWeeklyIo(fake({ fail: true }).fb).reportRows('2026-10-25'))) && /permission-denied/.test(await rej(() => makeWeeklyIo(fake({ fail: true }).fb).adjacentRows('w1', 2026, 10))), '읽기에 실패하면 빈 목록으로 숨기지 않고 예외를 던진다');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
