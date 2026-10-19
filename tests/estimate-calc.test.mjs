// 견적 산식 표(행을 추가해 가며 세부 내역을 쌓는 계산기) 순수 계산 시험 — 가짜 숫자만 쓴다(공개 저장소이므로 실제 단가·금액을 시험에 넣지 않는다).
// 계산 모듈: app/modules/plan/estimate-calc.js (화면·저장을 모른다). 열: 번호(자동)·내역·단위·수량·단가·합계·비고. 합계 칸이 비어 있으면 수량×단가, 적혀 있으면 그 값으로 고정.
import { calcSheet, newCalc, newRow, sanitizeCalc, applyToItem, calcIsEmpty, removeRow, COL_LETTERS, DEFAULTS, LIMITS } from '../app/modules/plan/estimate-calc.js';
import { blankItem, itemSetAmount } from '../app/modules/plan/estimates.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
const row = (o) => Object.assign(newRow(), o);
const sheet = () => ({ rows: [row({ name: '구역 A', unit: '인', qty: '=2*18', price: '100' }), row({ name: '구역 B', unit: '인', qty: '20', price: '100' })], markup: '10', unit: '10', count: '13' });

console.log('── 손으로 계산한 값과 일치(가짜 숫자)');
const r = calcSheet(sheet());
ok(r.ok === true, '올바른 표는 ok');
ok(near(r.rows[0].total, 3600) && near(r.rows[1].total, 2000), '★ 행 합계 = 수량 × 단가 (=2*18 → 36 × 100 = 3,600 · 20 × 100 = 2,000)');
ok(near(r.subtotal, 5600), '소계 = 3,600 + 2,000 = 5,600');
ok(near(r.gross, 6160), '가산 후 = 5,600 × 1.1 = 6,160');
ok(r.price === 6160, '견적가 = 내림(6,160, 10) = 6,160');
ok(near(r.perUnit, 6160 / 13) && r.count === 13, '대당 금액 = 6,160 ÷ 총 대수 13');
ok(r.rows.every((x) => x.ok === true && x.auto === true), '합계를 적지 않은 행은 자동(auto) 표시');

console.log('── 합계 직접 고정(엑셀에서 수식을 덮어쓰는 것과 같음)');
const fixed = sheet(); fixed.rows[1].total = '2500'; const rf = calcSheet(fixed);
ok(near(rf.rows[1].total, 2500) && rf.rows[1].auto === false && near(rf.subtotal, 6100), '★ 합계 칸에 2500 을 적으면 그 행은 2500 으로 고정(수량×단가 2,000 무시), 소계 6,100');
const fixedF = sheet(); fixedF.rows[0].total = '=1000+500'; ok(near(calcSheet(fixedF).rows[0].total, 1500), '합계 칸에도 수식을 쓸 수 있음(=1000+500)');
const back = sheet(); back.rows[1].total = '2500'; back.rows[1].total = ''; ok(near(calcSheet(back).rows[1].total, 2000) && calcSheet(back).rows[1].auto === true, '고정한 합계를 지우면 자동(수량×단가)으로 돌아감');
const noQty = calcSheet({ rows: [row({ name: '일식', total: '5000' })], markup: '0', unit: '1', count: '1' }); ok(noQty.ok && near(noQty.subtotal, 5000), '수량·단가 없이 합계만 적은 행(일식)도 인정');

console.log('── 빈 칸·부분 입력');
const blankRow = calcSheet({ rows: [row({}), row({ name: '구역', qty: '2', price: '50' })], markup: '10', unit: '10', count: '2' }); ok(blankRow.ok && near(blankRow.subtotal, 100), '★ 완전히 빈 행은 무시(0원), 합계에 영향 없음');
const onlyPrice = calcSheet({ rows: [row({ name: '단가만', price: '50' }), row({ name: '정상', qty: '1', price: '10' })], markup: '0', unit: '1', count: '1' }); ok(onlyPrice.ok === true && near(onlyPrice.rows[0].total, 0) && near(onlyPrice.subtotal, 10), '수량이 비었으면 그 행의 합계는 0(수량 없는 단가는 금액이 아님)');
ok(near(calcSheet({ rows: [row({ qty: '3', price: '10' })], markup: '0', unit: '1', count: '1' }).subtotal, 30), '내역(품명)이 비어 있어도 수량·단가가 있으면 계산에 포함');

console.log('── 오류 행(한 행이라도 틀리면 전체가 거부 — 틀린 줄을 빼고 조용히 합계를 내지 않음)');
const e1 = sheet(); e1.rows[1].qty = '=1/0'; const re1 = calcSheet(e1); ok(re1.ok === false && re1.rows[1].ok === false && /0/.test(re1.rows[1].error), '★ 0 으로 나누는 행 → 전체 거부, 그 행에 이유가 붙음');
ok(re1.rows[0].ok === true && near(re1.rows[0].total, 3600), '다른 행의 계산은 그대로 보임(어느 행이 틀렸는지 알 수 있음)');
ok(re1.badRow === 1 && calcSheet(sheet()).badRow === undefined, '★ 틀린 행의 위치(badRow, 0부터)를 돌려줌 — 요약은 이유를 반복하지 않고 위치만 알림. 정상이면 없음');
const e2 = sheet(); e2.rows[0].price = 'abc'; ok(calcSheet(e2).ok === false && calcSheet(e2).rows[0].ok === false, '숫자가 아닌 단가 → 거부');
const e3 = sheet(); e3.rows[0].qty = '-2'; ok(calcSheet(e3).ok === true && near(calcSheet(e3).rows[0].total, -200), '음수 수량은 허용(값 조정·할인 행)');
const e4 = sheet(); e4.rows[0].total = '1+2'; ok(calcSheet(e4).ok === false, '합계 칸에 등호 없는 식 → 거부');
ok(typeof re1.error === 'string' && re1.error.length > 0, '거부할 때는 사람이 읽을 이유 문구가 있음');

console.log('── 가산·내림·총 대수');
const nm = sheet(); nm.markup = '0'; ok(calcSheet(nm).price === 5600, '가산율 0 이면 소계 그대로');
const hm = sheet(); hm.markup = '15'; hm.unit = '1'; ok(calcSheet(hm).price === 6440, '가산율 15% → 5,600 × 1.15 = 6,440');
const rd = sheet(); rd.unit = '100'; ok(calcSheet(rd).price === 6100, '★ 내림 단위 100 → 6,160 → 6,100 (올림·반올림 아님)');
const fl = calcSheet({ rows: [row({ qty: '1', price: '25000' })], markup: '10', unit: '1', count: '1' }); ok(fl.price === 27500, '★ 25000 × 1.1 = 27500 이 27499.999… 로 한 단위 내려가지 않음(내림 경계)');
let bad = 0; for (let p = 100; p <= 400; p += 7) for (const m of [5, 10, 15]) { const c = calcSheet({ rows: [row({ qty: '10', price: String(p) })], markup: String(m), unit: '1', count: '1' }); const expect = Math.floor(Math.round(p * 10 * (1 + m / 100) * 1e6) / 1e6); if (c.price !== expect) bad++; } ok(bad === 0, '단가·가산율을 바꿔 가며 견적가가 항상 내림 정수(경계 어긋남 0건)');
ok(near(calcSheet(Object.assign(sheet(), { count: '7' })).perUnit, 6160 / 7), '총 대수를 바꾸면 대당 금액만 바뀜');
ok(calcSheet(Object.assign(sheet(), { count: '7' })).price === 6160, '견적가는 총 대수와 무관');
const zc = calcSheet(Object.assign(sheet(), { count: '0' })); ok(zc.ok === false && /대수/.test(zc.error), '★ 총 대수 0 이면 대당 금액을 만들 수 없어 거부');
ok(calcSheet(Object.assign(sheet(), { count: '' })).ok === false && calcSheet(Object.assign(sheet(), { count: '-3' })).ok === false && calcSheet(Object.assign(sheet(), { count: 'x' })).ok === false, '총 대수가 비었거나 음수거나 숫자가 아니면 거부');
ok(calcSheet(Object.assign(sheet(), { count: '=8+5' })).count === 13, '총 대수에도 수식 사용(=8+5 → 13)');
ok(calcSheet(Object.assign(sheet(), { markup: '-5' })).ok === false, '가산율이 음수면 거부');
ok(calcSheet(Object.assign(sheet(), { unit: '0' })).ok === false && calcSheet(Object.assign(sheet(), { unit: '' })).ok === false, '내림 단위가 0 이거나 빈 칸이면 거부(0으로 나눔 방지)');
const big = calcSheet({ rows: [row({ qty: '1,000,000', price: '9,999,999' })], markup: '10', unit: '1', count: '1' }); ok(big.ok === false, '★ 합이 허용 한도(1e13)를 넘으면 거부');

const sumBig = calcSheet({ rows: [row({ qty: '1', price: '4,000,000,000,000' }), row({ qty: '1', price: '4,000,000,000,000' }), row({ qty: '1', price: '4,000,000,000,000' })], markup: '0', unit: '1', count: '1' });
ok(sumBig.ok === false && /한도/.test(sumBig.error), '★ 행 하나하나는 한도 안인데 여러 행의 합이 한도(1e13)를 넘으면 거부');
ok(calcSheet({ rows: [row({ qty: '1', price: '4,000,000,000,000' }), row({ qty: '1', price: '4,000,000,000,000' })], markup: '0', unit: '1', count: '1' }).ok === true, '경계: 합 8e12 는 한도 안이라 정상');
console.log('── 칸 참조(엑셀처럼): 열 A 내역·B 단위·C 수량·D 단가·E 합계·F 비고, 행은 표의 번호');
ok(COL_LETTERS === 'ABCDEF', '★ 열 글자는 A 내역 · B 단위 · C 수량 · D 단가 · E 합계 · F 비고 (번호 열은 행 번호라서 글자가 없음)');
const R = (rows, extra) => Object.assign({ rows, markup: '0', unit: '1', count: '1' }, extra || {});
const labor = () => row({ name: '인건비', unit: '인', qty: '2', price: '7000' });
const r1 = calcSheet(R([labor(), row({ name: '출장 할증', unit: '식', qty: '1.1', price: '=e1' })]));
ok(r1.ok && near(r1.rows[0].total, 14000) && near(r1.rows[1].total, 15400) && near(r1.subtotal, 29400), '★ 단가 =e1 (E1 = 1행 합계 14,000) → 2행 합계 1.1 × 14,000 = 15,400, 소계 29,400');
const r2 = calcSheet(R([labor(), row({ name: '출장 할증', unit: '식', qty: '1.1', price: '=e1*c2' })]));
ok(r2.ok && near(r2.rows[1].total, 16940), '수식은 쓴 그대로 계산(=e1*c2 + 수량 1.1 이면 1.1 이 두 번 곱해져 16,940) — 의도와 다르면 사용자가 수식을 고쳐야 함');
const r3 = calcSheet(R([labor(), row({ name: '출장 할증', unit: '식', qty: '1.1', total: '=e1*c2' })]));
ok(r3.ok && near(r3.rows[1].total, 15400) && r3.rows[1].auto === false, '합계 칸에 =e1*c2 (고정) → 15,400');
ok(near(calcSheet(R([row({ total: '=E2' }), row({ qty: '3', price: '10' })])).rows[0].total, 30), '★ 아래 행(앞으로 쓸 행)도 참조할 수 있음 — 1행 합계 =E2 → 30');
const r4 = calcSheet(R([labor(), row({ qty: '1', price: '=e1' }), row({ total: '=SUM(e1:e2)' })])); ok(r4.ok && near(r4.rows[2].total, 28000) && near(r4.subtotal, 56000), 'SUM 범위(E1:E2 = 14,000 + 14,000) → 3행 합계 28,000, 소계 56,000');
ok(near(calcSheet(R([row({ qty: '5', price: '10' }), row({ qty: '8', price: '10' })], { count: '=c1+c2' })).count, 13), '★ 총 장비 대수에도 칸 참조(=c1+c2 → 5 + 8 = 13)');
ok(near(calcSheet(R([row({ qty: '5', price: '100' })], { markup: '=c1*2', unit: '=C1' })).gross, 500 * 1.1), '가산율·내림 단위에도 칸 참조(=c1*2 → 10%)');
ok(calcSheet(R([row({ qty: '4', price: '=d2' }), row({})])).rows[0].total === 0 && calcSheet(R([row({ qty: '4', price: '=d2' }), row({})])).rows[0].ok === true, '★ 완전히 빈 행의 단가를 참조하면 그 행은 0 으로 계산(오류 아님)');

console.log('── 칸 참조 오류');
const cyc = calcSheet(R([row({ qty: '2', price: '=e1' })])); ok(cyc.ok === false && /순환/.test(cyc.error + JSON.stringify(cyc.rows)), '★ 단가가 자기 행 합계를 가리키면(D1 → E1 → D1) 순환 참조 오류');
const cyc2 = calcSheet(R([row({ total: '=e1' })])); ok(cyc2.ok === false && /순환/.test(JSON.stringify(cyc2.rows)), '합계가 자기 자신을 가리키면 순환');
const cyc3 = calcSheet(R([row({ total: '=e2' }), row({ total: '=e1' })])); ok(cyc3.ok === false && /순환/.test(JSON.stringify(cyc3.rows)), '두 행이 서로를 가리켜도 순환');
const cyc4 = calcSheet(R([row({ qty: '1', price: '5' }), row({ total: '=SUM(e1:e3)' }), row({ qty: '1', price: '1' })])); ok(cyc4.ok === false && /순환/.test(JSON.stringify(cyc4.rows)), '범위가 자기 행을 포함하면 순환(=SUM(E1:E3) 를 2행에 씀)');
const prop = calcSheet(R([row({ qty: '=1/0', price: '5' }), row({ qty: '1', price: '=e1' })])); ok(prop.ok === false && prop.rows[0].ok === false && prop.rows[1].ok === false && /E1/.test(prop.rows[1].error), '★ 참조한 칸에 오류가 있으면 그 행도 오류이고 어느 칸 때문인지(E1) 문구에 보임');
const txt = calcSheet(R([row({ name: '글자', qty: '1', price: '=a1' })])); ok(txt.ok === false && /A1/.test(txt.rows[0].error) && /글자/.test(txt.rows[0].error), '내역(글자 칸)을 가리키면 오류');
const far = calcSheet(R([row({ qty: '1', price: '=e9' })])); ok(far.ok === false && /9번 행/.test(far.rows[0].error), '없는 행(9번)을 가리키면 오류');
ok(calcSheet(R([row({ qty: '1', price: '=g1' })])).ok === false && calcSheet(R([row({ qty: '1', price: '=sum(' })])).ok === false, '없는 열(G)·덜 쓴 함수도 오류');
ok(calcSheet(R([row({ qty: '2', price: '=e1' }), labor()])).ok === false, '수량 2 · 단가 =e1(1행 자신) 순환 — 다른 행이 있어도 거부');
ok(Date.now() > 0 && (() => { const rows = Array.from({ length: 60 }, (_, i) => row({ qty: '1', price: i === 0 ? '5' : '=e' + i })); const t0 = Date.now(); const rr = calcSheet(R(rows)); return rr.ok && near(rr.rows[59].total, 5) && Date.now() - t0 < 500; })(), '★ 60행이 줄줄이 앞 행을 가리켜도(긴 사슬) 즉시 계산됨');

ok((() => { const rows = Array.from({ length: 40 }, (_, i) => row({ qty: '1', price: i === 0 ? '5' : '=e' + i + '+e' + i })); const t0 = Date.now(); const rr = calcSheet(R(rows)); return rr.ok && near(rr.rows[39].total, 5 * Math.pow(2, 39)) && Date.now() - t0 < 400; })(), '★ 각 행이 앞 행을 두 번 가리키는 40행 사슬(=e39+e39 …)도 즉시 계산(한 번 계산한 칸을 기억하지 않으면 2^40 번 계산해 브라우저가 멈춤) — 값 5×2^39 정확');
console.log('── 행을 지우면 수식의 행 번호를 자동으로 맞춤(안 맞추면 금액이 조용히 틀림)');
const mk = () => R([row({ qty: '2', price: '100' }), row({ qty: '1', price: '=e1' }), row({ total: '=SUM(e1:e2)' }), row({ qty: '=c3+1', price: '=d2' })], { count: '=c1+c2', markup: '=c4', unit: '=d1' });
const d0 = removeRow(mk(), 0);
ok(d0.rows.length === 3 && d0.rows[0].price === '=#REF!' && d0.rows[1].total === '=SUM(e1:e1)' && d0.rows[2].qty === '=c2+1' && d0.rows[2].price === '=d1', '★ 1행을 지우면: 1행을 가리키던 =e1 은 #REF!, 범위 e1:e2 는 e1:e1(남은 한 행), 아래 행을 가리키던 =c3+1 은 =c2+1, =d2 는 =d1 (쓴 글자는 번호만 바뀜)');
ok(d0.count === '=#REF!+c1' && d0.markup === '=c3' && d0.unit === '=#REF!', '총 대수·가산율·내림 단위의 참조도 같이 맞춤(=c1+c2 → =#REF!+c1)');
const d1 = removeRow(mk(), 1);
ok(d1.rows[1].total === '=SUM(e1:e1)' && d1.rows[2].qty === '=c2+1' && d1.rows[2].price === '=#REF!' && d1.count === '=c1+#REF!', '2행을 지우면: 범위 e1:e2 → e1:e1, =c3+1 → =c2+1, 지운 2행을 가리키던 =d2 는 #REF!');
const d3 = removeRow(mk(), 3); ok(d3.rows.length === 3 && d3.rows[1].price === '=e1' && d3.rows[2].total === '=SUM(e1:e2)' && d3.markup === '=#REF!' , '맨 아래 행을 지우면 위 행의 수식은 그대로(번호 안 바뀜), 그 행을 가리키던 것만 #REF!');
const rng = removeRow(R([row({}), row({}), row({ total: '=SUM(e2:e3)' }), row({ total: '=SUM(E2:E2)' })]), 1);
ok(rng.rows[1].total === '=SUM(e2:e2)' && rng.rows[2].total === '=SUM(#REF!)', '★ 2행을 지우면: 범위 e2:e3 은 시작이 지운 행이라 그 자리에 올라온 행부터 e2:e2, 범위 E2:E2(지운 행 하나뿐)는 =SUM(#REF!) — 함수는 남고 범위 자리만 #REF!');
const only = removeRow(R([row({ qty: '1', price: '3' })]), 0); ok(only.rows.length === 1 && only.rows[0].qty === '' && only.rows[0].price === '', '유일한 행을 지우면 빈 행 1개가 남음');
const txtc = removeRow(R([row({ qty: '1', price: '3' }), row({ name: '=e1', unit: '=e1', remark: '=e1' })]), 0); ok(txtc.rows[0].name === '=e1' && txtc.rows[0].unit === '=e1' && txtc.rows[0].remark === '=e1', '글자 칸(내역·단위·비고)에 쓴 "=e1" 은 수식이 아니라 글자라 건드리지 않음');
const plain = removeRow(R([row({}), row({ qty: '3', price: '100,000', name: 'x' })]), 0); ok(plain.rows[0].qty === '3' && plain.rows[0].price === '100,000', '수식이 아닌 숫자 칸은 그대로');
const lc = removeRow(R([row({}), row({}), row({ price: '=e2*D1 + e3' })]), 0);
ok(lc.rows[1].price === '=e1*#REF! + e2', '★ 한 수식 안의 여러 참조를 각각 맞춤: e2 → e1, D1(지운 행) → #REF!, e3 → e2 (쓴 글자는 번호만 바뀜)');
ok(removeRow(R([row({}), row({}), row({ price: '=e3' })]), 0).rows[1].price === '=e2' && removeRow(R([row({}), row({}), row({ price: '=E3' })]), 0).rows[1].price === '=E2', '★ 사용자가 쓴 글자는 번호만 바뀌고 대소문자는 그대로(e3 → e2, E3 → E2)');
const fn = removeRow(R([row({ qty: '1', price: '5' }), row({ price: '=SUM(1,2)+ROUND(e1,2)' }), row({})]), 2); ok(fn.rows[1].price === '=SUM(1,2)+ROUND(e1,2)', '★ 함수 이름(SUM·ROUND)은 칸 참조로 오인하지 않고 그대로 둠');
const afterDel = calcSheet(removeRow(R([row({ qty: '2', price: '100' }), row({ qty: '3', price: '=d1' })]), 0)); ok(afterDel.ok === false && /삭제/.test(afterDel.rows[0].error), '★ 지운 행을 가리키던 수식은 계산할 때 "삭제된 칸" 오류로 막힘(조용히 틀린 금액이 나오지 않음)');
const okDel = calcSheet(removeRow(R([row({ qty: '9', price: '9' }), row({ qty: '2', price: '100' }), row({ qty: '1', price: '=e2' })]), 0)); ok(okDel.ok && near(okDel.rows[1].total, 200), '★ 지운 행과 무관한 수식은 번호만 맞춰져 같은 칸(원래 2행 = 지금 1행)을 계속 가리킴 → 200');

console.log('── 견적가 0·설치비 0(의미 없는 결과를 항목에 넣지 않게)');
const z1 = calcSheet({ rows: [row({ qty: '1', price: '3' })], markup: '10', unit: '100', count: '1' }); ok(z1.ok === false && /내림 단위/.test(z1.error), '★ 내림 단위가 커서 견적가가 0 이 되면 거부하고 "내림 단위"를 알림');
const z2 = calcSheet({ rows: [row({ name: '빈 내역' })], markup: '10', unit: '10', count: '1' }); ok(z2.ok === false && /내역|금액/.test(z2.error), '★ 모든 행이 0원이면 거부(내역을 입력하라고 알림)');
ok(calcSheet({ rows: [], markup: '10', unit: '10', count: '1' }).ok === false, '행이 하나도 없으면 거부');
ok(calcSheet(null).ok === false && calcSheet(undefined).ok === false && calcSheet({}).ok === false && calcSheet({ rows: 'x' }).ok === false, 'null·빈 객체·rows 가 배열이 아니어도 오류 없이 거부');

console.log('── 기본값·한도');
ok(DEFAULTS.markup === '10' && DEFAULTS.unit === '100000', '기본값: 가산율 10(%), 내림 단위 100000(원) — 문자열(입력칸 값)로 둠');
ok(LIMITS.rows === 60 && LIMITS.text === 120, '한도: 행 60개, 셀 글자 120자');
const nc = newCalc(); ok(Array.isArray(nc.rows) && nc.rows.length >= 1 && nc.markup === '10' && nc.unit === '100000' && nc.count === '', '새 표: 빈 행 1개 이상, 가산율·내림 단위 기본값, 총 대수 비어 있음');
const nr = newRow(); ok(['name', 'unit', 'qty', 'price', 'total', 'remark'].every((k) => nr[k] === ''), '새 행은 전부 빈 칸');
ok(calcIsEmpty(newCalc()) === true && calcIsEmpty({ rows: [row({ name: 'x' })], markup: '10', unit: '10', count: '' }) === false && calcIsEmpty(null) === true, '★ 아무것도 안 쓴 표는 "비어 있음"(저장하지 않음)');
ok(calcIsEmpty({ rows: [row({})], markup: '12', unit: '10', count: '' }) === true, '가산율·내림 단위만 바꾸고 내역이 없으면 비어 있는 것으로 봄');
ok(calcIsEmpty({ rows: [row({})], markup: '10', unit: '10', count: '13' }) === false, '총 대수만 적어도 비어 있지 않음(작업 중인 값을 버리지 않음)');

console.log('── 저장용 정리(sanitizeCalc) — 문서에 들어가는 모양');
const clean = sanitizeCalc(sheet()); ok(clean && clean.rows.length === 2 && clean.rows[0].qty === '=2*18' && clean.markup === '10' && clean.unit === '10' && clean.count === '13', '★ 사용자가 쓴 글자(=2*18)를 그대로 보존해 저장 — 열 때 다시 계산');
ok(sanitizeCalc(newCalc()) === null && sanitizeCalc(null) === null && sanitizeCalc('x') === null && sanitizeCalc({ rows: 5 }) === null, '비었거나 모양이 틀린 표는 null(저장하지 않음)');
const dirty = sanitizeCalc({ rows: [{ name: '<b>x</b>', unit: 5, qty: 7, price: null, total: undefined, remark: 'r', evil: '<script>' }], markup: 10, unit: 10, count: 3, extra: 'z' });
ok(dirty && Object.keys(dirty).sort().join() === 'count,markup,rows,unit' && Object.keys(dirty.rows[0]).sort().join() === 'name,price,qty,remark,total,unit', '★ 알려진 칸만 남김(알 수 없는 필드 제거)');
ok(dirty.rows[0].qty === '7' && dirty.rows[0].price === '' && dirty.rows[0].unit === '5' && dirty.markup === '10' && dirty.count === '3', '숫자·null 은 문자열로 정리(저장 모양을 한 가지로)');
ok(dirty.rows[0].name === '<b>x</b>', '글자 자체는 바꾸지 않음(화면에서 이스케이프하는 것이 맞는 곳)');
const longT = sanitizeCalc({ rows: [row({ name: 'x'.repeat(500), qty: '1', price: '1' })], markup: '10', unit: '1', count: '1' }); ok(longT.rows[0].name.length === 120, '★ 셀 글자는 120자로 자름(문서가 부풀지 않게)');
const many = sanitizeCalc({ rows: Array.from({ length: 100 }, (_, i) => row({ name: 'n' + i, qty: '1', price: '1' })), markup: '10', unit: '1', count: '1' }); ok(many.rows.length === 60, '★ 행은 60개까지만 저장');
const trail = sanitizeCalc({ rows: [row({ name: 'a', qty: '1', price: '1' }), row({}), row({})], markup: '10', unit: '1', count: '1' }); ok(trail.rows.length === 1, '맨 끝의 빈 행은 저장하지 않음(작업 중 늘려 둔 빈 줄)');
const mid = sanitizeCalc({ rows: [row({ name: 'a', qty: '1', price: '1' }), row({}), row({ name: 'b', qty: '1', price: '1' })], markup: '10', unit: '1', count: '1' }); ok(mid.rows.length === 3, '가운데 빈 행은 유지(순서·번호를 바꾸지 않음)');
const rt = sanitizeCalc(JSON.parse(JSON.stringify(sanitizeCalc(sheet())))); ok(JSON.stringify(rt) === JSON.stringify(sanitizeCalc(sheet())), '★ 저장 → 읽기 → 다시 정리해도 같은 모양(왕복 안정)');
ok(calcSheet(rt).price === 6160 && calcSheet(rt).count === 13, '저장했다 읽은 표가 같은 견적가·대수를 냄');
const proto = JSON.parse('{"rows":[{"name":"a","qty":"1","price":"1","__proto__":{"polluted":true}}],"markup":"10","unit":"1","count":"1","__proto__":{"polluted2":true}}'); sanitizeCalc(proto); ok(({}).polluted === undefined && ({}).polluted2 === undefined, '★ __proto__ 를 담은 저장 데이터로도 객체 기본 속성이 오염되지 않음');

console.log('── 항목에 넣기(기존 견적 항목 규칙과 연결)');
const it = applyToItem(blankItem(), r); ok(it.qty === 13 && it.amount === 6160 && it.price === Math.round(6160 / 13), '★ 항목에 넣으면 수량 = 총 대수 13, 금액 = 견적가 6,160, 단가 = 대당 금액(반올림 474)');
const ref = itemSetAmount(Object.assign(blankItem(), { qty: 13 }), 6160); ok(it.price === ref.price && it.amount === ref.amount, '기존 itemSetAmount(금액을 기준으로 단가 맞춤)와 같은 결과');
ok(applyToItem(Object.assign(blankItem(), { name: '구역', spec: '규격', remark: '메모' }), r).name === '구역', '품명·규격·비고는 건드리지 않음');
ok(applyToItem(blankItem(), { ok: false, error: 'x' }) === null && applyToItem(blankItem(), null) === null, '거부된 결과는 항목을 바꾸지 않음(null)');
const orig = blankItem(); ok(applyToItem(orig, r) === orig, '받은 항목 객체를 그대로 고쳐 돌려줌');

ok(pass + fail >= 97, '★ 시험 전체가 끝까지 실행됨(' + (pass + fail) + '건 ≥ 97) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
