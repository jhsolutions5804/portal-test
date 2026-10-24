// 실행예산(계획 원가) 순수 계산 시험 — 설계: 비공개 저장소 app-docs/execution-budget-design.md(대기열 1-3-9). 공개 저장소라 가짜 숫자만 쓴다.
import { CATS, LIMITS, sanitizeRows, budgetTotals, budgetCompare, importFromEstimates, draftRowsFromImport } from '../app/modules/plan/budget.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const J = (v) => JSON.stringify(v);
const R = (cat, amount, extra) => Object.assign({ cat, name: '내역', amount, memo: '' }, extra || {});

// ── 상수
ok(J(CATS.map((c) => c.key)) === J(['sub', 'labor', 'site', 'reserve']), '비목은 외주·자체 노무·현장경비·예비비 4가지(순서 고정)');
ok(CATS.every((c) => typeof c.label === 'string' && c.label) && CATS.find((c) => c.key === 'reserve').noActual === true && CATS.filter((c) => c.noActual).length === 1, '예비비만 실적이 없는 칸이다');
ok(LIMITS.rows === 200 && LIMITS.name === 120 && LIMITS.memo === 200, '한도: 행 200·내역 120자·메모 200자');

// ── 입력 검증 sanitizeRows
{ const r = sanitizeRows([R('sub', 1000000), R('labor', '500,000', { name: ' 노무 ', memo: ' 메모 ' }), R('', 300)]);
  ok(r.ok && r.rows.length === 3, '정상 입력은 통과한다');
  ok(r.rows[1].amount === 500000 && r.rows[1].name === '노무' && r.rows[1].memo === '메모', '천 단위 쉼표 금액은 숫자로, 글자는 앞뒤 공백을 뗀다');
  ok(r.rows[2].cat === '' && r.rows[2].src === 'manual', '비목 미배정(빈 글자)을 허용하고 출처 기본값은 manual 이다'); }
ok(sanitizeRows([]).ok && sanitizeRows([]).rows.length === 0, '빈 목록은 빈 결과');
ok(!sanitizeRows(null).ok && !sanitizeRows('x').ok && !sanitizeRows({}).ok && !sanitizeRows(undefined).ok, '배열이 아니면 거부');
{ const r = sanitizeRows([{ cat: 'sub', name: '', amount: '', memo: '' }, R('sub', 10), { cat: '', name: '', amount: null, memo: '' }, {}]);
  ok(r.ok && r.rows.length === 1, '내역·금액·메모가 모두 빈 행은 버린다(비목만 골라 둔 새 행·중간 행 포함)'); }
ok(!sanitizeRows([{ cat: 'foo', name: '', amount: '', memo: '' }, R('sub', 5)]).ok === false, '비목 글자가 이상해도 나머지가 전부 빈 행이면 빈 행으로 본다');
{ const r = sanitizeRows([R('sub', 1), R('foo', 2)]); ok(!r.ok && /2번 행/.test(r.error) && /비목/.test(r.error), '모르는 비목은 거부하고 몇 번 행인지 알린다'); }
{ const r = sanitizeRows([R('sub', -5)]); ok(!r.ok && /1번 행/.test(r.error), '음수 금액은 거부'); }
ok(!sanitizeRows([R('sub', 1.5)]).ok && !sanitizeRows([R('sub', '1.5')]).ok, '소수 금액은 거부(원 단위 정수만)');
ok(!sanitizeRows([R('sub', 'abc')]).ok && !sanitizeRows([R('sub', '12원')]).ok && !sanitizeRows([R('sub', '１２')]).ok, '숫자가 아닌 글자·전각 숫자는 거부');
ok(!sanitizeRows([R('sub', NaN)]).ok && !sanitizeRows([R('sub', Infinity)]).ok && !sanitizeRows([R('sub', true)]).ok && !sanitizeRows([R('sub', [5])]).ok && !sanitizeRows([R('sub', { a: 1 })]).ok, 'NaN·무한·참거짓·배열·객체 금액은 거부(숫자로 둔갑하지 않는다)');
ok(sanitizeRows([R('sub', 1e13)]).ok && !sanitizeRows([R('sub', 1e13 + 1)]).ok && !sanitizeRows([R('sub', '10000000000001')]).ok, '금액 한도 1e13(견적 저장 규칙과 같음)');
{ const r = sanitizeRows([{ cat: 'sub', name: '이름만', amount: '', memo: '' }]); ok(!r.ok && /금액을 입력/.test(r.error), '내역이 있는데 금액이 비면 거부하고 "금액을 입력"하라고 알린다(조용히 0원으로 두지 않는다)'); }
{ const r = sanitizeRows([{ cat: 'site', name: '', amount: 0, memo: '' }]); ok(r.ok && r.rows.length === 1 && r.rows[0].amount === 0, '금액 0 은 값으로 인정(빈 행이 아님)'); }
ok(!sanitizeRows([R('sub', 1, { name: 'x'.repeat(121) })]).ok && sanitizeRows([R('sub', 1, { name: 'x'.repeat(120) })]).ok, '내역 120자 한도');
ok(!sanitizeRows([R('sub', 1, { memo: 'x'.repeat(201) })]).ok && sanitizeRows([R('sub', 1, { memo: 'x'.repeat(200) })]).ok, '메모 200자 한도');
ok(sanitizeRows(Array.from({ length: 200 }, () => R('sub', 1))).ok && !sanitizeRows(Array.from({ length: 201 }, () => R('sub', 1))).ok, '행 200개 한도');
ok(!sanitizeRows([R('sub', 1, { src: 'hack' })]).ok && sanitizeRows([R('sub', 1, { src: 'est', estNo: 'EST-2026-001' })]).rows[0].estNo === 'EST-2026-001', '출처는 est·manual 만, est 면 견적 번호를 남긴다');
{ const r = sanitizeRows([Object.assign(R('sub', 1), { evil: 'x', __proto__x: 1 }), JSON.parse('{"cat":"sub","name":"a","amount":2,"memo":"","__proto__":{"polluted":true}}')]);
  ok(r.ok && !('evil' in r.rows[0]) && Object.keys(r.rows[0]).sort().join() === 'amount,cat,memo,name,src' && ({}).polluted === undefined && !('polluted' in r.rows[1]), '알려진 칸만 새 객체로 복사 — 알 수 없는 필드·__proto__ 오염 제거'); }
{ const src = [R('sub', '1,000', { name: '  공백  ', memo: ' 메모 ' })]; const snap = J(src); const r = sanitizeRows(src); ok(r.ok && r.rows[0].name === '공백' && J(src) === snap, '입력을 바꾸지 않는다(공백을 떼는 것은 결과에만)'); }
ok(sanitizeRows([R('sub', 1, { src: 'est', estNo: 'E'.repeat(100) })]).rows[0].estNo.length === 40, '견적 번호는 40자까지만 남긴다');
ok(!sanitizeRows([null]).ok && !sanitizeRows([5]).ok && !sanitizeRows(['x']).ok, '행이 객체가 아니면 거부');
{ const r = sanitizeRows([R('sub', 1), R('sub', -1), R('foo', 1)]); ok(!r.ok && /2번 행/.test(r.error) && !('rows' in r && r.rows && r.rows.length), '한 행이라도 틀리면 전체 거부 — 가장 앞의 틀린 행을 알린다'); }

// ── 합계 budgetTotals
{ const s = sanitizeRows([R('sub', 1000000), R('labor', 500000), R('site', 200000), R('reserve', 100000), R('', 50000), R('sub', 20000)]).rows; const t = budgetTotals(s);
  ok(t.sub === 1020000 && t.labor === 500000 && t.site === 200000 && t.reserve === 100000 && t.unassigned === 50000, '비목별 합과 미배정 합');
  ok(t.total === 1870000 && t.planBase === 1770000, '총 계획 = 전부, 예비비 제외 계획 = 총 − 예비비'); }
{ const t = budgetTotals([]); ok(t.total === 0 && t.planBase === 0 && t.sub === 0 && t.unassigned === 0, '빈 목록의 합은 0'); }

// ── 비교 budgetCompare — 이유 상태
const plan = { rows: [R('sub', 1000000), R('labor', 500000), R('site', 200000), R('reserve', 100000)] };
const act = (s, l, g) => ({ sub: s, labor: l, site: g });
ok(budgetCompare(null, act(1, 1, 1)).state === 'nobudget' && budgetCompare(undefined, act(1, 1, 1)).state === 'nobudget' && budgetCompare('x', act(1, 1, 1)).state === 'nobudget' && budgetCompare({}, act(1, 1, 1)).state === 'nobudget' && budgetCompare({ rows: 'x' }, act(1, 1, 1)).state === 'nobudget', '실행예산이 없거나 모양이 이상하면 nobudget');
ok(budgetCompare({ rows: [] }, act(1, 1, 1)).state === 'nobudget' && budgetCompare({ rows: [R('sub', 0)] }, act(1, 1, 1)).state === 'nobudget', '행이 없거나 합이 0 이면 nobudget(0 으로 나누지 않는다)');
{ const c = budgetCompare({ rows: [R('sub', -1)] }, act(1, 1, 1)); ok(c.state === 'bad' && typeof c.error === 'string' && c.total === null, '저장된 값이 이상하면 bad + 이유(이상한 숫자로 화면을 그리지 않는다)'); }
for (const [label, a] of [['이름 붙은 배열', Object.assign([1], { sub: 1, labor: 1, site: 1 })], ['없음', null], ['한 칸 빠짐', { sub: 1, labor: 1 }], ['NaN', act(1, NaN, 1)], ['글자', act('1', 1, 1)], ['무한', act(1, 1, Infinity)], ['null 칸', act(1, null, 1)], ['배열', [1, 1, 1]]]) {
  const c = budgetCompare(plan, a);
  ok(c.state === 'nocost' && c.total.plan === 1800000 && c.total.actual === null && c.total.rate === null && c.total.over === false && c.rows.every((x) => x.actual === null && x.rate === null), '실적을 모르면(' + label + ') nocost — 계획만 보여 주고 실적·달성률은 만들지 않는다'); }

// ── 비교 — 정상 계산
{ const c = budgetCompare(plan, act(800000, 600000, 100000));
  ok(c.state === 'ok' && c.rows.length === 4, '정상이면 ok, 비목 4줄(예비비 포함)');
  const by = Object.fromEntries(c.rows.map((x) => [x.cat, x]));
  ok(by.sub.plan === 1000000 && by.sub.actual === 800000 && by.sub.remain === 200000 && by.sub.rate === 80 && by.sub.over === false, '외주: 계획·실적·잔액·달성률 80.0·초과 아님');
  ok(by.labor.rate === 120 && by.labor.over === true && by.labor.remain === -100000, '자체 노무: 120% 초과, 잔액은 음수로');
  ok(by.site.rate === 50 && by.site.over === false, '현장경비 50%');
  ok(by.reserve.plan === 100000 && by.reserve.actual === null && by.reserve.rate === null && by.reserve.over === false && by.reserve.remain === null, '예비비는 계획만(실적·달성률·초과 없음)');
  ok(c.total.plan === 1800000 && c.total.planBase === 1700000 && c.total.actual === 1500000 && c.total.remain === 300000 && c.total.rate === 83.3 && c.total.over === false && c.total.usingReserve === false, '합계: 계획 180만(예비비 포함)·실적 150만·잔액 30만·83.3%'); }
{ const c = budgetCompare(plan, act(1000000, 500000, 250000)); ok(c.total.actual === 1750000 && c.total.over === false && c.total.usingReserve === true && c.total.rate === 97.2, '실적이 예비비 제외 계획(170만)을 넘고 총 계획(180만) 이내면 예비비 사용 중'); }
{ const c = budgetCompare(plan, act(1000000, 500000, 400000)); ok(c.total.over === true && c.total.usingReserve === false && c.total.remain === -100000, '총 계획을 넘으면 초과(예비비 사용 중과 겹치지 않는다)'); }
{ const c = budgetCompare(plan, act(1000000, 500000, 200000)); ok(c.total.actual === 1700000 && c.total.usingReserve === false && c.total.over === false, '정확히 예비비 제외 계획과 같으면 아직 예비비를 쓰지 않은 것'); }
{ const c = budgetCompare(plan, act(1800000, 0, 0)); ok(c.total.over === false && c.total.rate === 100 && c.total.remain === 0, '정확히 총 계획과 같으면 초과가 아니다(100%)'); }
{ const c = budgetCompare({ rows: [R('sub', 1000), R('labor', 0)] }, act(0, 500, 0)); const by = Object.fromEntries(c.rows.map((x) => [x.cat, x]));
  ok(by.labor.plan === 0 && by.labor.actual === 500 && by.labor.rate === null && by.labor.over === true, '계획 0 인 비목에 실적이 생기면 달성률은 null 이지만 초과로 본다(0 으로 나누지 않는다)');
  ok(by.site.plan === 0 && by.site.actual === 0 && by.site.rate === null && by.site.over === false, '계획도 실적도 0 이면 초과 아님'); }
{ const c = budgetCompare({ rows: [R('sub', 3)] }, act(1, 0, 0)); ok(c.total.rate === 33.3, '달성률은 소수 첫째 자리 반올림(1/3 → 33.3)'); }
{ const c = budgetCompare({ rows: [R('sub', 1000)] }, act(-100, 0, 0)); ok(c.state === 'ok' && c.total.actual === -100 && c.rows[0].remain === 1100, '환급 같은 음수 실적도 그대로 계산한다'); }
{ const c = budgetCompare({ rows: [R('sub', 1000), R('', 400)] }, act(500, 0, 0)); ok(c.warnUnassigned === true && c.unassigned === 400 && c.total.plan === 1400 && c.rows.find((x) => x.cat === 'sub').plan === 1000, '비목 미배정 금액은 총 계획에는 들어가고 비목별 계획에서는 빠지며 경고가 켜진다'); }
{ const c = budgetCompare(plan, act(1, 1, 1)); ok(c.warnUnassigned === false && c.unassigned === 0, '미배정이 없으면 경고 없음'); }
{ const b = J(plan), a = act(800000, 600000, 100000), sa = J(a); budgetCompare(plan, a); ok(J(plan) === b && J(a) === sa, '입력을 바꾸지 않는다'); }
{ const p = { rows: [R('sub', '1,000,000'), R('reserve', '100,000')] }; const c = budgetCompare(p, act(500000, 0, 0)); ok(c.state === 'ok' && c.total.plan === 1100000 && c.rows.find((x) => x.cat === 'sub').plan === 1000000, '쉼표가 든 저장값도 읽는다'); }

// ── 견적에서 가져오기 importFromEstimates
const calc = (qty, price, count, markup, unit) => ({ rows: [{ name: '품', unit: '식', qty: String(qty), price: String(price), total: '', remark: '' }], markup: String(markup === undefined ? 10 : markup), unit: String(unit || 10000), count: String(count) });
// 소계 200000 → 견적가 220000 → 대수 2 → 대당 110000. 적용하면 수량 2·금액 220000
const itemOk = (name) => ({ name, spec: '', qty: 2, price: 110000, amount: 220000, remark: '', calc: calc(2, 100000, 2) });
const itemNego = (name) => ({ name, spec: '', qty: 2, price: 100000, amount: 200000, remark: '', calc: calc(2, 100000, 2) });   // 네고로 금액만 직접 고침
const itemPlain = (name) => ({ name, spec: '', qty: 1, price: 50000, amount: 50000, remark: '' });
const itemBad = (name) => ({ name, spec: '', qty: 1, price: 1, amount: 1, remark: '', calc: { rows: [{ name: 'x', unit: '', qty: 'abc', price: '1', total: '', remark: '' }], markup: '10', unit: '10000', count: '1' } });
const E = (o) => Object.assign({ id: 'e', no: 'EST-2026-001', baseNo: 'EST-2026-001', rev: 1, status: 'active', pjtId: 'P1', items: [] }, o);
ok(importFromEstimates([], 'P1').state === 'noest' && importFromEstimates(null, 'P1').state === 'noest' && importFromEstimates('x', 'P1').state === 'noest', '견적이 없으면 noest');
ok(importFromEstimates([E()], '').state === 'nopjt' && importFromEstimates([E()], null).state === 'nopjt' && importFromEstimates([E()], 5).state === 'nopjt', '프로젝트가 없으면 nopjt');
ok(importFromEstimates([E({ pjtId: 'P2', items: [itemOk('a')] })], 'P1').state === 'noest', '다른 프로젝트 견적은 가져오지 않는다');
{ const r1 = E({ no: 'EST-2026-001', rev: 1, status: 'void', replacedBy: 'EST-2026-001-r2', items: [itemOk('옛')] });
  const r2 = E({ no: 'EST-2026-001-r2', rev: 2, status: 'active', items: [itemOk('가'), itemNego('나'), itemPlain('다'), itemBad('라')] });
  const r = importFromEstimates([r1, r2], 'P1');
  ok(r.state === 'ok' && r.groups.length === 1 && r.groups[0].no === 'EST-2026-001-r2' && r.groups[0].rev === 2, '★ 개정된 견적은 폐기된 원본이 아니라 최종 개정본(r2)을 본다');
  const it = r.groups[0].items;
  ok(it.length === 4 && it[0].kind === 'calc' && it[0].subtotal === 200000 && it[0].amount === 220000, '산식 표가 있고 금액이 견적가와 같으면 calc — 소계(투입비)를 쓴다');
  ok(it[1].kind === 'differs' && it[1].subtotal === 200000 && it[1].amount === 200000 && it[1].price === 220000, '★ 네고로 금액만 직접 고친 항목은 differs — 소계·견적가·실제 금액을 모두 보여 준다');
  ok(it[2].kind === 'nocalc' && it[2].subtotal === null && it[2].amount === 50000, '산식 표가 없는 항목은 nocalc');
  ok(it[3].kind === 'bad' && typeof it[3].error === 'string' && it[3].error && it[3].subtotal === null, '산식 표가 틀린 항목은 bad + 이유');
  ok(r.autoCost === 200000 && r.groups[0].autoCost === 200000 && r.decisions === 3 && r.groups[0].decisions === 3, '★ 자동 합계는 calc 항목만(20만), 대표님이 정해야 할 항목은 3개');
  ok(r.supply === 220000 + 200000 + 50000 + 1 && r.groups[0].supply === r.supply, '견적 공급가액 합(참고)도 함께 준다'); }
{ const g1 = E({ no: 'EST-2026-001', baseNo: 'EST-2026-001', items: [itemOk('a')] }), g2 = E({ no: 'EST-2026-002', baseNo: 'EST-2026-002', items: [itemOk('b'), itemOk('c')] });
  const r = importFromEstimates([g2, g1], 'P1'); ok(r.groups.length === 2 && r.groups[0].baseNo === 'EST-2026-001' && r.groups[1].baseNo === 'EST-2026-002' && r.autoCost === 600000 && r.multi === true, '견적 묶음이 여럿이면 묶음별로 나눠 보여 주고 합산(기준 번호 순서, multi 표시)'); }
{ const v = E({ status: 'void', items: [itemOk('a')] }); ok(importFromEstimates([v], 'P1').state === 'noest', '폐기된 견적(void, 개정 없음)은 제외'); }
{ const c = E({ status: 'closed', items: [itemOk('a')] }); const r = importFromEstimates([c], 'P1'); ok(r.state === 'ok' && r.groups[0].status === 'closed' && r.autoCost === 200000, '종결된 견적(closed)은 확정본으로 본다'); }
{ const r = importFromEstimates([null, 5, 'x', [], E({ items: null }), E({ no: 'EST-2026-009', baseNo: 'EST-2026-009', items: [null, 7, itemOk('ok')] })], 'P1'); ok(r.state === 'ok' && r.groups.length === 2 && r.groups[1].items.length === 1 && r.autoCost === 200000, '모양이 이상한 견적·품목은 건너뛰고 나머지를 계산한다'); }
{ const a = E({ no: 'EST-2026-001-r2', rev: 2, items: [itemOk('a')] }), b = E({ no: 'EST-2026-001-r3', rev: 3, items: [itemOk('a'), itemOk('b')] }); ok(importFromEstimates([a, b], 'P1').groups[0].no === 'EST-2026-001-r3' && importFromEstimates([b, a], 'P1').groups[0].no === 'EST-2026-001-r3', '개정이 여럿 유효해도 가장 높은 rev 하나만(순서와 무관)'); }
{ const x = E({ rev: undefined, items: [itemOk('a')] }); ok(importFromEstimates([x], 'P1').groups[0].rev === 1, 'rev 가 없으면 1 로 본다'); }
{ const list = [E({ items: [itemOk('a')] })]; const s = J(list); importFromEstimates(list, 'P1'); ok(J(list) === s, '입력을 바꾸지 않는다(산식 계산이 견적 품목을 건드리지 않는다)'); }
{ const big = E({ items: [Object.assign(itemOk('a'), { calc: calc(1, 1e13, 1, 10, 1) })] }); const r = importFromEstimates([big], 'P1'); ok(r.groups[0].items[0].kind === 'bad', '산식 한도를 넘는 표는 bad'); }

// ── 가져온 결과 → 초안 행
{ const r = importFromEstimates([E({ no: 'EST-2026-001-r2', rev: 2, items: [itemOk('a'), itemOk('b'), itemPlain('c')] })], 'P1'); const d = draftRowsFromImport(r);
  ok(d.length === 1 && d[0].cat === '' && d[0].amount === 400000 && d[0].src === 'est' && d[0].estNo === 'EST-2026-001-r2' && /견적 투입비/.test(d[0].name), '묶음마다 "견적 투입비" 한 줄(비목 미배정, 출처 est, 견적 번호)을 초안으로 만든다 — 정할 항목은 자동으로 채우지 않는다');
  ok(sanitizeRows(d).ok, '초안 행은 입력 검증을 그대로 통과한다'); }
{ const r = importFromEstimates([E({ items: [itemPlain('c')] })], 'P1'); ok(draftRowsFromImport(r).length === 0, '자동 합계가 0 이면 초안 행을 만들지 않는다'); }
ok(draftRowsFromImport(null).length === 0 && draftRowsFromImport({}).length === 0 && draftRowsFromImport({ groups: 'x' }).length === 0, '이상한 입력이면 빈 목록');
{ const r = { groups: [{ no: 'N', autoCost: 1000.6 }] }; const d = draftRowsFromImport(r); ok(d.length === 1 && d[0].amount === 1001, '소수 합계는 원 단위로 반올림해 초안으로'); }

console.log('\n' + (fail ? fail + '건 실패 / 통과 ' + pass : '전부 통과 (' + pass + '건)'));
process.exit(fail ? 1 : 0);
