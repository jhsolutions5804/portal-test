// 견적 산식 표(행을 추가해 가며 세부 내역을 쌓는 계산기) 순수 계산 시험 — 가짜 숫자만 쓴다(공개 저장소이므로 실제 단가·금액을 시험에 넣지 않는다).
// 계산 모듈: app/modules/plan/estimate-calc.js (화면·저장을 모른다). 열: 번호(자동)·내역·단위·수량·단가·합계·비고. 합계 칸이 비어 있으면 수량×단가, 적혀 있으면 그 값으로 고정.
import { calcSheet, newCalc, newRow, sanitizeCalc, applyToItem, calcIsEmpty, DEFAULTS, LIMITS } from '../app/modules/plan/estimate-calc.js';
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

ok(pass + fail >= 64, '★ 시험 전체가 끝까지 실행됨(' + (pass + fail) + '건 ≥ 64) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
