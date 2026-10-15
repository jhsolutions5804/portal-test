import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/projects.js', import.meta.url), 'utf8').match(/pjt-summary\.js\?v=([0-9a-z]+)/) || [])[1];
const { allocateOwnLabor, ownLaborOf, payrollFromEntries, monthOf } = await import('../app/shared/own-labor.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const M = '2026-09';
// ── 손으로 계산한 기대값: A 300만 → X 12공수·Y 8공수(합 20) = X 180만·Y 120만 / B 400만 → X 20공수 = X 400만 / C 250만 → 공수 0 = 간접 250만
const payroll = [{ worker: 'A', month: M, amount: 3000000 }, { worker: 'B', month: M, amount: 4000000 }, { worker: 'C', month: M, amount: 2500000 }];
const manday = [{ worker: 'A', month: M, pjt: 'X', md: 12 }, { worker: 'A', month: M, pjt: 'Y', md: 8 }, { worker: 'B', month: M, pjt: 'X', md: 20 }];
const r = allocateOwnLabor(payroll, manday);
ok(r.byPjt.X === 5800000 && r.byPjt.Y === 1200000 && r.unallocated === 2500000, '★ 월급을 그 달 프로젝트별 공수 비율로 나눔: A 300만(X 12·Y 8공수)→X 180만·Y 120만, B 400만(X 20공수)→X 400만 ⇒ X 580만·Y 120만, 공수 없는 C 250만은 어느 프로젝트에도 안 넣고 간접으로 남김');
ok(Math.round(r.byPjt.X + r.byPjt.Y + r.unallocated) === 9500000, '배분액 + 간접 = 급여 총액(950만) — 어디로도 사라지는 돈이 없음');
ok(r.detail.length === 3 && r.detail.filter((d) => d.worker === 'A').length === 2 && r.detail.every((d) => d.month === M), '직원·월·프로젝트별 상세가 남음(A 2건·B 1건)');
// 연차·휴일처럼 공수 없는 날 → 급여는 그대로(날짜 보정 없음): 같은 직원의 공수를 일 단위로 쪼개 넣어도 월 합이 같으면 결과가 같다
const daily = []; for (let i = 0; i < 12; i++) daily.push({ worker: 'A', month: M, pjt: 'X', md: 1 }); for (let i = 0; i < 8; i++) daily.push({ worker: 'A', month: M, pjt: 'Y', md: 1 });
const r2 = allocateOwnLabor([{ worker: 'A', month: M, amount: 3000000 }], daily); ok(r2.byPjt.X === 1800000 && r2.byPjt.Y === 1200000 && r2.unallocated === 0, '★ 일자별 공수를 월로 합쳐 같은 비율로 계산 — 연차·휴일로 공수가 없는 날이 있어도 월급 전액을 그대로 배분(날짜 단위 보정 없음)');
// 정정·분할 급여 전표는 합산 / 공수가 소수 / 한 직원이 여러 달
const r3 = allocateOwnLabor([{ worker: 'A', month: M, amount: 2000000 }, { worker: 'A', month: M, amount: 1000000 }, { worker: 'A', month: '2026-10', amount: 3000000 }], [{ worker: 'A', month: M, pjt: 'X', md: 7.5 }, { worker: 'A', month: M, pjt: 'Y', md: 2.5 }, { worker: 'A', month: '2026-10', pjt: 'Y', md: 20 }]);
ok(r3.byPjt.X === 2250000 && r3.byPjt.Y === 750000 + 3000000 && r3.unallocated === 0, '같은 직원·월의 급여 전표 2장(200만+100만)은 합산 300만 → 공수 7.5:2.5 = X 225만·Y 75만, 다음 달 300만은 Y 에 전액');
ok(allocateOwnLabor([{ worker: 'A', month: M, amount: 1000 }], [{ worker: 'A', month: M, pjt: 'X', md: 1 }, { worker: 'A', month: M, pjt: 'Y', md: 1 }, { worker: 'A', month: M, pjt: 'Z', md: 1 }]).byPjt.X === 333, '나누어떨어지지 않으면 원 단위 반올림(1000원 ÷ 3 = 333원) — 프로젝트별 합이 총액과 1원 차이날 수 있음');
// 경계: 빈 입력·0·음수·이상한 값
ok(JSON.stringify(allocateOwnLabor([], [])) === '{"byPjt":{},"unallocated":0,"detail":[]}' && allocateOwnLabor(null, null).unallocated === 0 && allocateOwnLabor([{ worker: 'A', month: M, amount: 0 }], [{ worker: 'A', month: M, pjt: 'X', md: 5 }]).byPjt.X === undefined && allocateOwnLabor([{ worker: 'A', month: M, amount: -500 }], [{ worker: 'A', month: M, pjt: 'X', md: 5 }]).byPjt.X === undefined, '입력이 비었거나 급여가 0·음수면 배분하지 않음(안전하게 빈 결과)');
ok(allocateOwnLabor([{ worker: 'A', month: M, amount: 100 }], [{ worker: 'A', month: M, pjt: 'X', md: 0 }, { worker: 'A', month: M, pjt: 'Y', md: -3 }, { worker: 'A', month: M, pjt: 'Z', md: 'x' }]).unallocated === 100 && allocateOwnLabor([{ worker: 'A', month: M, amount: 100 }], [{ worker: 'B', month: M, pjt: 'X', md: 5 }]).unallocated === 100 && allocateOwnLabor([{ worker: 'A', month: M, amount: 100 }], [{ worker: 'A', month: '2026-08', pjt: 'X', md: 5 }]).unallocated === 100, '공수가 0·음수·숫자가 아니거나, 다른 직원·다른 달의 공수만 있으면 배분하지 않고 간접으로 남김');
// 프로젝트별 누계·기간
const many = [{ worker: 'A', month: '2026-08', amount: 3000000 }, { worker: 'A', month: M, amount: 3000000 }], mm = [{ worker: 'A', month: '2026-08', pjt: 'X', md: 10 }, { worker: 'A', month: M, pjt: 'X', md: 5 }, { worker: 'A', month: M, pjt: 'Y', md: 5 }];
ok(ownLaborOf('X', many, mm) === 4500000 && ownLaborOf('Y', many, mm) === 1500000 && ownLaborOf('X', many, mm, { from: M }) === 1500000 && ownLaborOf('X', many, mm, { to: '2026-08' }) === 3000000 && ownLaborOf('Q', many, mm) === 0 && ownLaborOf('X', null, null) === 0, '프로젝트 누계(8월 300만 전액 + 9월 절반 150만 = 450만)와 기간 필터, 없는 프로젝트·빈 입력은 0원');
// ── 급여 전표 → payroll
const entries = [
  { date: '2026-09-30', memo: '2026-09 급여 홍길동 (현장)', source: { kind: 'payslip', id: 'w1_2026-09' }, lines: [{ account: '5110', side: 'D', amount: 3200000, partner: '홍길동' }, { account: '2030', side: 'C', amount: 300000, partner: '4대보험·원천세(홍길동)' }, { account: '2050', side: 'C', amount: 2900000, partner: '홍길동' }] },
  { date: '2026-09-30', memo: '2026-09 급여 김사무', source: { kind: 'payslip', id: 'w2_2026-09' }, lines: [{ account: '6010', side: 'D', amount: 3000000, partner: '김사무' }] },
  { date: '2026-10-31', memo: '2026-10 급여 홍길동 (현장)', source: { kind: 'payslip', id: 'w1_2026-10' }, lines: [{ account: '5110', side: 'D', amount: 3300000, partner: '홍길동' }] },
  { date: '2026-09-15', memo: '식대', source: { kind: 'expense', id: 'e1' }, lines: [{ account: '5350', side: 'D', amount: 50000, partner: '식당' }] },
  { date: '2026-09-25', memo: '급여 이체', source: { kind: 'bank', id: 'b1' }, lines: [{ account: '5110', side: 'D', amount: 999999, partner: '통장' }] },
];
const pr = payrollFromEntries(entries);
ok(JSON.stringify(pr) === JSON.stringify([{ worker: '홍길동', month: '2026-09', amount: 3200000 }, { worker: '홍길동', month: '2026-10', amount: 3300000 }]), '★ 급여 전표에서 현장 직원(5110 현장노무비)의 payslip 전표만 뽑음 — 사무 직원(6010 판관비)·식대 등 다른 전표·통장 이체(payslip 아님)는 제외, 귀속월은 메모의 월');
ok(payrollFromEntries(null).length === 0 && payrollFromEntries([{ source: { kind: 'payslip' }, lines: [] }]).length === 0 && payrollFromEntries([{ date: '2026-09-30', memo: '2026-09 급여 가', source: { kind: 'payslip' }, lines: [{ account: '5110', side: 'C', amount: 5, partner: '가' }] }]).length === 0 && monthOf('2026-09-30') === '2026-09' && monthOf('') === '', '빈 입력·줄이 없는 전표·대변 줄은 무시, 날짜에서 월 추출');
// 급여 전표 → 배분: 위 전표의 홍길동이 9월에 X 10·Y 10공수면 320만을 반씩
ok(allocateOwnLabor(pr, [{ worker: '홍길동', month: '2026-09', pjt: 'X', md: 10 }, { worker: '홍길동', month: '2026-09', pjt: 'Y', md: 10 }]).byPjt.X === 1600000 && allocateOwnLabor(pr, [{ worker: '홍길동', month: '2026-09', pjt: 'X', md: 10 }, { worker: '홍길동', month: '2026-09', pjt: 'Y', md: 10 }]).unallocated === 3300000, '전표에서 뽑은 급여(9월 320만)를 공수 반반으로 나눠 X 160만, 공수가 없는 10월 330만은 간접으로 남음');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
