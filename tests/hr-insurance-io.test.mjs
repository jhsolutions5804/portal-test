import { makeInsuranceIo, billPatch, isMonth, BILL_MAX } from '../app/modules/hr/insurance-io.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rej = async (fn) => { try { await fn(); return null; } catch (e) { return String((e && e.message) || e); } };
// ── 월 형식·입력 검사
ok(isMonth('2026-09') && isMonth('2026-12') && isMonth('2026-01') && !isMonth('2026-13') && !isMonth('2026-00') && !isMonth('2026-9') && !isMonth('26-09') && !isMonth('2026-09-01') && !isMonth('') && !isMonth(null) && !isMonth('2026-09x'), '월 형식: 2026-01~2026-12 만 인정');
ok(BILL_MAX === 1000000000, '상한은 10억(보안 규칙과 같음)');
const bp = billPatch({ pension: '838,060원', health: ' 700000 ', ltcare: '0', unpaid: '' });
ok(bp.ok && bp.data.pension === 838060 && bp.data.health === 700000 && bp.data.ltcare === 0 && bp.data.unpaid === 0, '쉼표·"원"·공백은 지우고 숫자로, 미납액을 비우면 0');
ok(billPatch({ pension: 1826060, health: 0, ltcare: 0, unpaid: 100 }).ok && billPatch({ pension: '000123', health: '0', ltcare: '0' }).data.pension === 123 && billPatch({ pension: '1,000,000,000', health: '0', ltcare: '0' }).ok, '숫자 값도 받고, 앞에 0이 있어도 숫자로, 정확히 10억은 허용');
for (const [label, v, key] of [['소수', { pension: '1.5', health: '0', ltcare: '0' }, '국민연금'], ['음수', { pension: '-5', health: '0', ltcare: '0' }, '국민연금'], ['글자', { pension: '0', health: '십만', ltcare: '0' }, '건강보험'], ['10억 초과', { pension: '0', health: '0', ltcare: '1,000,000,001' }, '장기요양'], ['미납액 글자', { pension: '0', health: '0', ltcare: '0', unpaid: 'x' }, '미납액'], ['연금 비움', { pension: '', health: '0', ltcare: '0' }, '국민연금'], ['건강 비움', { pension: '0', health: '   ', ltcare: '0' }, '건강보험'], ['요양 비움', { pension: '0', health: '0' }, '장기요양'], ['전체 비어 있음', {}, '국민연금'], ['null', null, '국민연금'], ['지수 표기', { pension: '1e3', health: '0', ltcare: '0' }, '국민연금'], ['소수점 끝', { pension: '10.', health: '0', ltcare: '0' }, '국민연금']]) { const r = billPatch(v); ok(!r.ok && r.errors.some((e) => e.includes(key)) && r.data === undefined, '잘못된 입력 거부 — ' + label + '(' + key + ' 안내)'); }
ok(billPatch({ pension: 'x', health: 'y', ltcare: 'z' }).errors.length === 3, '여러 칸이 틀리면 칸마다 안내');
// ── 가짜 저장소
const clone = (o) => JSON.parse(JSON.stringify(o));
function mk(seed) { const store = clone(seed); const log = { sets: [], deletes: [], reads: [] };
  const fb = { db: {}, collection: (db, p) => ({ path: p }), doc: (db, c, id) => ({ path: id === undefined ? c : c + '/' + id }), serverTimestamp: () => '__ts__',
    getDocs: async (ref) => { log.reads.push(ref.path); const pre = ref.path + '/'; const docs = Object.keys(store).filter((k) => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map((k) => ({ id: k.slice(pre.length), data: () => clone(store[k]) })); return { size: docs.length, forEach: (fn) => docs.forEach(fn) }; },
    setDoc: async (ref, data, ...rest) => { log.sets.push([ref.path, clone(data), rest.length]); store[ref.path] = clone(data); }, deleteDoc: async (ref) => { log.deletes.push(ref.path); delete store[ref.path]; } };
  return { store, log, io: makeInsuranceIo(fb) }; }
const seed = { 'workers/w1': { name: 'A' }, 'workers/w2': { name: 'B', status: 'resigned' }, 'workers/w3': { name: 'C' },
  'payslips/w1/months/2026-07': { grossPay: 3000000, pension: 100000, health: 90000, ltcare: 10000, employ: 27000 }, 'payslips/w2/months/2026-07': { grossPay: 2000000, pension: 80000, health: 70000, ltcare: 9000, employ: 18000 },
  'payslips/w1/months/2026-08': { grossPay: 3100000, pension: 100000, health: 90000, ltcare: 10000, employ: 28000 }, 'payslips/w3/months/2026-08': { grossPay: '2,000,000', pension: 'x', health: null }, 'payslips/w1/months/bad': { grossPay: 999 }, 'payslips/w1/months/2026-1': { grossPay: 999 },
  'insurance_bills/2026-07': { ym: '2026-07', pension: 360000, health: 320000, ltcare: 38000, unpaid: 0, updatedBy: 'a@b.c' }, 'insurance_bills/2026-08': { pension: '700000', health: 1 }, 'insurance_bills/junk': { pension: 5 } };
let t = mk(seed); let r = await t.io.loadSlipTotals();
ok(JSON.stringify(Object.keys(r).sort()) === '["2026-07","2026-08"]', '명세서 월 합계: 월 형식이 아닌 문서(bad·2026-1)는 건너뛴다');
ok(r['2026-07'].count === 2 && r['2026-07'].gross === 5000000 && r['2026-07'].pension === 180000 && r['2026-07'].health === 160000 && r['2026-07'].ltcare === 19000 && r['2026-07'].employ === 45000, '7월: 퇴사자(w2) 명세서도 더한다(2명, 총지급 5,000,000, 연금 180,000…)');
ok(r['2026-08'].count === 2 && r['2026-08'].gross === 3100000 && r['2026-08'].pension === 100000 && r['2026-08'].health === 90000, '8월: 숫자가 아닌 값(글자 연금·null 건강·"2,000,000" 글자)은 0으로 세어 합계가 깨지지 않는다');
ok(Object.keys((await mk({}).io.loadSlipTotals())).length === 0 && Object.keys((await mk({ 'workers/w': { name: 'x' } }).io.loadSlipTotals())).length === 0, '직원이 없거나 명세서가 없으면 빈 결과');
ok(t.log.reads.filter((p) => p.startsWith('payslips/')).length === 3 && t.log.reads.includes('workers'), '읽기: 직원 목록 1번 + 직원마다 명세서 1번(월마다 읽지 않는다)');
// 고지금액
t = mk(seed); const b = await t.io.loadBills();
ok(JSON.stringify(Object.keys(b).sort()) === '["2026-07","2026-08"]' && b['2026-07'].pension === 360000 && b['2026-07'].updatedBy === 'a@b.c' && b['2026-08'].pension === 700000 && b['2026-08'].health === 1 && b['2026-08'].ltcare === 0 && b['2026-08'].unpaid === 0, '고지금액: 월 형식이 아닌 문서(junk)는 건너뛰고, 글자 숫자는 숫자로, 빠진 칸은 0');
const all = await t.io.load(); ok(all.payslips['2026-07'].count === 2 && all.bills['2026-08'].pension === 700000, '한꺼번에 읽기(load)는 명세서 합계와 고지금액 둘 다 돌려준다');
// 저장
t = mk(seed); const sv = await t.io.saveBill('2026-09', { pension: '838,060', health: '700,000', ltcare: '90,000', unpaid: '' }, ' Admin@JHSOL.kr ');
const [path, data, extra] = t.log.sets[0]; ok(path === 'insurance_bills/2026-09' && Object.keys(data).sort().join() === 'health,ltcare,pension,unpaid,updatedAt,updatedBy,ym' && data.ym === '2026-09' && data.pension === 838060 && data.unpaid === 0 && data.updatedBy === 'admin@jhsol.kr' && data.updatedAt === '__ts__' && sv.pension === 838060, '저장: 정해진 7칸만, 문서 번호=귀속월, 작업자 이메일은 소문자·공백 제거, 수정 시각은 서버 시각');
ok(extra === 0, '★ 저장은 병합 없이 전체 교체(setDoc 에 병합 옵션을 주지 않는다 — 규칙이 정해진 칸만 허용)');
t = mk(seed); ok(/월 형식/.test(await rej(() => t.io.saveBill('2026-13', { pension: 1, health: 1, ltcare: 1 }, 'a@b.c'))) && /월 형식/.test(await rej(() => t.io.saveBill('', { pension: 1, health: 1, ltcare: 1 }, 'a@b.c'))) && /월 형식/.test(await rej(() => t.io.saveBill(undefined, { pension: 1, health: 1, ltcare: 1 }, 'a@b.c'))) && t.log.sets.length === 0, '월이 이상하면 저장하지 않고 예외');
ok(/숫자/.test(await rej(() => t.io.saveBill('2026-09', { pension: '1.5', health: 1, ltcare: 1 }, 'a@b.c'))) && /입력해/.test(await rej(() => t.io.saveBill('2026-09', { pension: '', health: 1, ltcare: 1 }, 'a@b.c'))) && t.log.sets.length === 0, '값이 이상하면 저장하지 않고 이유와 함께 예외(저장 호출 없음)');
ok(/이메일/.test(await rej(() => t.io.saveBill('2026-09', { pension: 1, health: 1, ltcare: 1 }, ''))) && /이메일/.test(await rej(() => t.io.saveBill('2026-09', { pension: 1, health: 1, ltcare: 1 }, undefined))) && t.log.sets.length === 0, '누가 저장하는지 알 수 없으면 저장하지 않는다');
await t.io.saveBill('2026-07', { pension: 1, health: 2, ltcare: 3 }, 'a@b.c'); ok(t.store['insurance_bills/2026-07'].pension === 1 && t.store['insurance_bills/2026-07'].health === 2 && !('updatedAt' in {}) && t.log.sets.length === 1, '같은 달을 다시 저장하면 새 값으로 바뀐다');
// 삭제
t = mk(seed); await t.io.deleteBill('2026-07'); ok(t.log.deletes.join() === 'insurance_bills/2026-07' && !('insurance_bills/2026-07' in t.store) && /월 형식/.test(await rej(() => t.io.deleteBill('x'))) && t.log.deletes.length === 1, '삭제: 그 달 문서만 지우고, 월이 이상하면 지우지 않는다');
// 읽기 실패는 숨기지 않는다
const bad = makeInsuranceIo({ db: {}, collection: (d, p) => ({ path: p }), doc: () => ({}), serverTimestamp: () => 1, setDoc: async () => {}, deleteDoc: async () => {}, getDocs: async () => { throw new Error('permission-denied'); } });
ok(/permission-denied/.test(await rej(() => bad.load())) && /permission-denied/.test(await rej(() => bad.loadBills())), '읽기에 실패하면 빈 값으로 숨기지 않고 예외');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
