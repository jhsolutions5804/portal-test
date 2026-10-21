// 재무회계 "개인 지출(인출금) 누계" 계산 시험 — 가짜 데이터만 쓴다(이 저장소는 공개이므로 실제 금액·거래처·이름을 시험에 넣지 않는다).
// 개인사업자(대표님 2026-10-21 확인)라서 개인 지출은 인출금(3020)으로 잡는다(지출 항목 분류 "개인 지출(인출금)"). 3020 은 5xxx·6xxx 가 아니라 판관비·프로젝트 마진에 들어가지 않는다.
// 인출금 순액 = 차변(개인 지출·인출) − 대변(대표님이 회사로 되돌린 금액). 개인카드 미지급 잔액 = 2021(미지급금·대표자 개인카드) 대변 − 차변.
import { ownerDraws } from '../app/modules/finance/logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ln = (account, side, amount) => ({ account, side, amount });
const E = (id, date, memo, lines, extra) => Object.assign({ id, no: id.toUpperCase(), date, memo, lines, status: 'posted', source: { kind: 'manual' } }, extra || {});
const ENT = () => [
  E('a1', '2026-03-03', '개인 식사', [ln('3020', 'D', 100000), ln('2020', 'C', 100000)]),
  E('a2', '2026-03-20', '개인 용품', [ln('3020', 'D', 50000), ln('1020', 'C', 50000)]),
  E('a3', '2026-04-05', '입금(되돌림)', [ln('1020', 'D', 30000), ln('3020', 'C', 30000)]),
  E('a4', '2026-05-01', '개인 지출', [ln('3020', 'D', 200000), ln('2020', 'C', 200000)]),
  E('a5', '2025-12-15', '작년 인출', [ln('3020', 'D', 70000), ln('1020', 'C', 70000)]),
  E('a6', '2026-05-02', '잘못 입력', [ln('3020', 'D', 40000), ln('2020', 'C', 40000)], { reversedBy: 'a7' }),
  E('a7', '2026-05-02', '잘못 입력 취소', [ln('3020', 'C', 40000), ln('2020', 'D', 40000)], { reverses: 'a6' }),
  E('a8', '2026-03-10', '회사 일(개인카드)', [ln('5340', 'D', 500000), ln('2021', 'C', 500000)]),
  E('a9', '2026-03-11', '회사 일 비용 정산 아님', [ln('6090', 'D', 10000), ln('2020', 'C', 10000)]),
];
const R = (o, ents) => ownerDraws(ents || ENT(), Object.assign({ today: '2026-05-20' }, o || {}));
console.log('── 누계');
ok(R().yearTotal === 320000, '★ 손계산: 올해 누계 = 100,000 + 50,000 − 30,000 + 200,000 + (40,000 − 40,000) = 320,000 (실제 ' + R().yearTotal + ')');
ok(R().allTotal === 390000, '★ 전체 누계 = 올해 320,000 + 작년 70,000 = 390,000 (실제 ' + R().allTotal + ')');
ok(R().year === 2026, '기준 연도는 기준일의 연도다');
ok(R({ today: '2027-01-10' }).year === 2027 && R({ today: '2027-01-10' }).yearTotal === 0 && R({ today: '2027-01-10' }).allTotal === 390000, '★ 해가 바뀌면 올해 누계는 0 에서 다시 시작하고 전체 누계는 그대로다');
ok(R({ today: '2025-12-31' }).yearTotal === 70000, '기준일이 2025 년이면 올해 누계는 2025 년 줄만(70,000)이다');
console.log('── 월별(최근 6개월)');
{ const m = R().months; ok(m.length === 6 && m[0].month === '2025-12' && m[5].month === '2026-05', '★ 최근 6개월(기준월 포함) — 2025-12 ~ 2026-05 (실제 ' + m.map((x) => x.month).join(',') + ')'); }
{ const m = R().months; const get = (k) => (m.find((x) => x.month === k) || {}).amount; ok(get('2026-03') === 150000 && get('2026-04') === -30000 && get('2026-05') === 200000 && get('2026-01') === 0 && get('2026-02') === 0 && get('2025-12') === 70000, '★ 월별: 3월 150,000 · 4월 −30,000(되돌림) · 5월 200,000(역분개 쌍은 상쇄) · 1·2월은 줄이 없어 0 · 작년 12월 70,000'); }
console.log('── 최근 항목');
{ const r = R().recent; ok(r.length === 4 && eq(r.map((x) => x.date), ['2026-05-01', '2026-03-20', '2026-03-03', '2025-12-15']), '★ 최근 항목은 개인 지출(차변) 줄만 최신순이고 역분개 쌍(5월 2일 두 줄)과 되돌림(대변 4월 5일)은 빠진다 (실제 ' + r.map((x) => x.date).join(',') + ')'); }
{ const r = R().recent; ok(r[0].memo === '개인 지출' && r[0].amount === 200000 && r[1].amount === 50000, '항목에는 날짜·메모·금액이 있다'); }
{ const many = []; for (let i = 1; i <= 9; i++) many.push(E('m' + i, '2026-05-0' + i, '지출' + i, [ln('3020', 'D', i * 1000), ln('2020', 'C', i * 1000)])); const r = R({}, many).recent; ok(r.length === 5 && r[0].date === '2026-05-09' && r[4].date === '2026-05-05', '★ 최근 항목은 최대 5건이다');
  const same = [E('s1', '2026-05-01', '가', [ln('3020', 'D', 1000), ln('2020', 'C', 1000)], { seq: 1 }), E('s2', '2026-05-01', '나', [ln('3020', 'D', 2000), ln('2020', 'C', 2000)], { seq: 2 })]; ok(R({}, same).recent[0].memo === '나', '같은 날짜면 나중에 입력한 것이 먼저다(seq)'); }
console.log('── 개인카드 미지급 잔액');
ok(R().cardPayable === 500000, '★ 2021(미지급금·대표자 개인카드) 순 잔액 = 대변 500,000 − 차변 0 = 500,000 (회사가 대표님께 줄 돈) (실제 ' + R().cardPayable + ')');
{ const e = ENT().concat([E('p1', '2026-05-10', '개인카드 대금 정산', [ln('2021', 'D', 200000), ln('1020', 'C', 200000)])]); ok(R({}, e).cardPayable === 300000, '카드 대금을 정산해 차변이 생기면 잔액이 줄어든다(500,000 − 200,000 = 300,000)'); }
ok(R().cardPayable !== R().allTotal, '개인카드 미지급(회사 일 비용)과 인출금(개인 지출)은 다른 값이다 — 섞어서 합치지 않는다');
console.log('── 상태·방어');
{ const e = ENT(); e.forEach((x) => { x.status = 'draft'; }); const r = R({}, e); ok(r.yearTotal === 0 && r.allTotal === 0 && r.cardPayable === 0 && r.recent.length === 0, '★ 임시(draft) 전표는 세지 않는다'); }
{ const e = ENT(); e[0].status = 'void'; ok(R({}, e).yearTotal === 220000, '취소(void) 전표는 세지 않는다 (320,000 − 100,000)'); }
ok(!R().recent.some((x) => x.memo === '회사 일(개인카드)' || x.memo.includes('정산 아님')), '★ 5xxx·6xxx 비용 줄은 개인 지출이 아니다 — 판관비·현장경비와 섞이지 않는다');
for (const bad of [null, undefined, 'x', 3, {}]) { let r; try { r = ownerDraws(bad, { today: '2026-05-20' }); } catch (e) { r = { threw: e.message }; } ok(r && !r.threw && r.yearTotal === 0 && r.allTotal === 0 && r.months.length === 6 && eq(r.recent, []), '이상한 입력(' + JSON.stringify(bad) + ')은 던지지 않고 0 과 빈 목록을 돌려준다'); }
{ const e = ENT().concat([null, 3, { id: 'q', date: 'x', status: 'posted', lines: [] }, { id: 'q2', date: '2026-05-01', status: 'posted', lines: null }, E('q3', '2026-05-03', [null, ln('3020', 'D', 'x'), ln('3020', 'D', -5), ln('3020', 'Z', 100)])]); ok(R({}, e).yearTotal === 320000, '깨진 전표·줄은 건너뛴다(합계가 그대로 320,000)'); }
{ const t = ownerDraws(ENT(), {}); ok(typeof t.year === 'number' && t.months.length === 6, '기준일을 주지 않으면 오늘 날짜를 쓴다(던지지 않음)'); }
{ const src = JSON.stringify(ENT()); ownerDraws(ENT()); const e2 = ENT(); const before = JSON.stringify(e2); ownerDraws(e2, { today: '2026-05-20' }); ok(JSON.stringify(e2) === before, '입력 전표를 바꾸지 않는다(순수 함수)'); }
{ const a = ENT(); const b = ENT().reverse(); ok(eq(R({}, a), R({}, b)), '전표 입력 순서와 무관하다'); }
ok(Number.isInteger(R().yearTotal) && R().months.every((x) => Number.isInteger(x.amount)), '금액은 정수다');
{ const r = R(); ok(!/uid|seq|source/.test(JSON.stringify(r)), '결과에는 화면에 필요한 값만 있다(내부 필드 없음)'); }
ok(pass + fail >= 28, '시험이 끝까지 실행됨');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
