import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const M = await import('../app/modules/plan/monthly-mgmt.js?v=' + VER);
/* 영업기획 월간 보고서 3단계 — 원가 달성률(대기열 1-2-8, 대표님 2026-10-22 ㄱㄱ · 설계 monthly-report-design.md §3-3).
 * 목표 원가 = 견적 공급가액 × (1 − 목표 마진율 ÷ 100), 실제 원가 = 선택한 달까지의 지급예정서 발행 + 현장경비 + 자체 직접노무비(마진 모듈의 원가와 같은 정의), 달성률 = 실제 원가 ÷ 목표 원가 × 100(100% 이하 = 목표 원가 안).
 * 목표 마진율은 프로젝트 문서의 targetMargin(숫자 %, -100~100, 미입력 = 필드 없음), 견적 공급가액은 pjtSummary 의 est(유효 견적의 공급가액 합 — 기존 마진 화면과 같은 정의).
 * 원칙: 모르는 값은 숫자로 꾸미지 않고 이유 상태를 돌려준다. 특히 서버 원가를 모르는데 지급예정서만으로 달성률을 내면 낮게 나와 "목표 안"으로 오해하게 되므로 내지 않는다. 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 계산했다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b)));
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const P = { id: 'pjt_1', code: 'P4-2', name: '가짜현장', status: 'run', linkPjt: 'R1', targetMargin: 12 };
const EST = [{ id: 'e1', pjtId: 'pjt_1', status: 'active', items: [{ qty: 1, price: 10000000 }] }];
const st = (id, docType, issueDate, amount, o) => Object.assign({ id, docType, pjtId: 'pjt_1', pjtIds: ['pjt_1'], issueDate, amount, status: 'active' }, o || {});
const SET = [st('p8', 'payment', '2026-08-10', 2000000), st('p9', 'payment', '2026-09-10', 1500000), st('p10', 'payment', '2026-10-05', 700000), st('i9', 'invoice', '2026-09-05', 99999999)];
const CUR = { ok: true, upTo: '2026-09', projects: [{ pjt: 'R1', overhead: 1200000, ownLabor: 2300000, laborWage: 2300000, laborInsurance: 0 }] };
console.log('── achievementRow(프로젝트, 견적, 정산서, 서버 누계 응답, 기준 달): 원가 달성률(누계)');
{ const a = M.achievementRow(P, EST, SET, CUR, '2026-09');
  eq(a.status, 'ok', '정상이면 status ok'); eq([a.id, a.pjt, a.code, a.name], ['pjt_1', 'R1', 'P4-2', '가짜현장'], '영업기획 id·연결된 PJT 등록 id·코드·이름');
  eq(a.est, 10000000, '★ 견적 공급가액 10,000,000'); eq(a.target, 12, '목표 마진율 12'); eq(a.targetCost, 8800000, '★ 목표 원가 = 10,000,000 × (1 − 0.12) = 8,800,000');
  eq(a.payIssued, 3500000, '★ 지급예정서 발행은 그 달(9월)까지만 — 8월 2,000,000 + 9월 1,500,000 = 3,500,000(10월 700,000 은 제외)');
  eq([a.direct, a.ownLabor], [1200000, 2300000], '서버 누계(9월까지) 현장경비 1,200,000·자체 노무 2,300,000'); eq(a.cost, 7000000, '★ 실제 원가 = 3,500,000 + 1,200,000 + 2,300,000 = 7,000,000');
  eq(a.rate, 79.5, '★ 달성률 = 7,000,000 ÷ 8,800,000 = 79.545…% → 79.5'); eq(a.over, false, '100% 이하이므로 목표 원가 안'); }
console.log('── 그 달까지만: 같은 데이터를 다른 달 기준으로');
{ const a8 = M.achievementRow(P, EST, SET, CUR, '2026-08'); eq(a8.payIssued, 2000000, '★ 8월 기준이면 지급 발행은 8월까지 2,000,000 뿐'); const a10 = M.achievementRow(P, EST, SET, CUR, '2026-10'); eq(a10.payIssued, 4200000, '★ 10월 기준이면 3,500,000 + 700,000 = 4,200,000'); eq(a10.cost, 4200000 + 1200000 + 2300000, '10월 기준 원가'); const a7 = M.achievementRow(P, EST, SET, CUR, '2026-07'); eq(a7.payIssued, 0, '7월 기준이면 지급 발행 0(그 이전에 발행된 것이 없다)'); }
console.log('── 목표 원가 초과·경계');
{ const over = M.achievementRow(P, EST, SET, Object.assign({}, CUR, { projects: [{ pjt: 'R1', overhead: 3000000, ownLabor: 3000000 }] }), '2026-09'); eq([over.cost, over.over], [9500000, true], '★ 원가 9,500,000 > 목표 원가 8,800,000 이면 over(초과)'); eq(over.rate, 108, '달성률 = 9,500,000 ÷ 8,800,000 = 107.95… → 108.0 → 108'); }
{ const ex = M.achievementRow(Object.assign({}, P, { targetMargin: 0 }), EST, [st('p', 'payment', '2026-09-10', 4000000)], { ok: true, projects: [{ pjt: 'R1', overhead: 3000000, ownLabor: 3000000 }] }, '2026-09'); eq([ex.targetCost, ex.cost, ex.rate, ex.over], [10000000, 10000000, 100, false], '★ 목표 마진율 0% 면 목표 원가 = 견적 10,000,000 — 원가가 정확히 같으면 달성률 100% 이고 초과가 아니다(경계: 100% 이하 = 목표 원가 안)'); }
{ const neg = M.achievementRow(Object.assign({}, P, { targetMargin: -10 }), EST, SET, CUR, '2026-09'); eq(neg.targetCost, 11000000, '★ 목표 마진율 -10% 면 목표 원가 = 10,000,000 × 1.1 = 11,000,000(허용 범위 -100~100)'); }
console.log('── 모르는 값은 숫자로 꾸미지 않는다: 이유 상태');
for (const tm of [undefined, null, '', '  ']) { const a = M.achievementRow(Object.assign({}, P, { targetMargin: tm }), EST, SET, CUR, '2026-09'); ok(a.status === 'notarget' && a.rate === null && a.targetCost === null, '★ 목표 마진율이 ' + JSON.stringify(tm) + ' 이면(미입력) notarget — 달성률·목표 원가를 내지 않는다'); }
{ const a = M.achievementRow(Object.assign({}, P, { targetMargin: 'x' }), EST, SET, CUR, '2026-09'); eq([a.status, a.rate], ['notarget', null], '목표 마진율이 숫자가 아니면 notarget'); }
{ const a = M.achievementRow(P, [], SET, CUR, '2026-09'); eq([a.status, a.rate, a.targetCost], ['noest', null, null], '★ 견적이 없으면 noest'); const b = M.achievementRow(P, [{ id: 'e', pjtId: 'pjt_1', status: 'active', items: [] }], SET, CUR, '2026-09'); eq(b.status, 'noest', '견적 공급가액이 0 이어도 noest'); }
for (const tm of [100, 101, 150]) { const a = M.achievementRow(Object.assign({}, P, { targetMargin: tm }), EST, SET, CUR, '2026-09'); ok(a.status === 'badtarget' && a.rate === null, '★ 목표 마진율이 ' + tm + ' 이상이면 목표 원가가 0 이하라 badtarget(0 나눗셈·무한대 방지)'); }
{ const a = M.achievementRow(Object.assign({}, P, { linkPjt: 'none' }), EST, SET, CUR, '2026-09'); eq([a.status, a.rate, a.cost], ['nolink', null, null], '★ 연결이 없으면 nolink — 원가를 모른다'); const b = M.achievementRow(Object.assign({}, P, { linkPjt: '' }), EST, SET, CUR, '2026-09'); eq(b.status, 'nolink', '연결이 비어 있어도 nolink'); }
console.log('── ★ 서버 원가를 모르는데 지급예정서만으로 달성률을 내지 않는다(낮게 나와 "목표 안"으로 오해하게 된다)');
for (const bad of [null, undefined, { ok: false, projects: [] }, { ok: true }, { ok: true, projects: 'x' }, 'x', 3]) { const a = M.achievementRow(P, EST, SET, bad, '2026-09'); ok(a.status === 'nocost' && a.rate === null && a.cost === null && a.over === null, '★ 서버 응답이 ' + JSON.stringify(bad) + ' 이면 nocost — 달성률·실제 원가를 내지 않는다(지급예정서 3,500,000 만으로 달성률 39.8% 를 내면 목표 안으로 오해)'); }
{ const a = M.achievementRow(P, EST, SET, null, '2026-09'); eq([a.est, a.targetCost, a.payIssued], [10000000, 8800000, 3500000], '그래도 목표 원가·견적·지급 발행은 알 수 있어 보인다(원가만 모른다)'); }
console.log('── 서버가 성공했는데 그 프로젝트가 응답에 없으면 현장경비·노무는 0(정말 없는 것)');
{ const a = M.achievementRow(P, EST, SET, { ok: true, projects: [{ pjt: 'R9', overhead: 5, ownLabor: 5 }] }, '2026-09'); eq([a.status, a.direct, a.ownLabor, a.cost], ['ok', 0, 0, 3500000], '지급 발행 3,500,000 뿐'); eq(a.rate, 39.8, '달성률 3,500,000 ÷ 8,800,000 = 39.77… → 39.8'); }
console.log('── 연결된 PJT 등록 id 로 서버 응답을 찾는다(영업기획 id 아님 — 1-2-2-④)');
{ const wrong = { ok: true, projects: [{ pjt: 'pjt_1', overhead: 9999999, ownLabor: 9999999 }] }; const a = M.achievementRow(P, EST, SET, wrong, '2026-09'); eq([a.direct, a.ownLabor], [0, 0], '★ 응답에 영업기획 id(pjt_1)로 된 항목이 있어도 쓰지 않는다'); }
console.log('── 견적·정산서 선택: 같은 프로젝트의 유효한 것만, 기존 마진 화면과 같은 규칙');
{ const est = EST.concat([{ id: 'e2', pjtId: 'pjt_1', status: 'void', items: [{ qty: 1, price: 5000000 }] }, { id: 'e3', pjtId: 'pjt_1', status: 'closed', items: [{ qty: 1, price: 7000000 }] }, { id: 'e4', pjtId: 'pjt_other', status: 'active', items: [{ qty: 1, price: 3000000 }] }]); eq(M.achievementRow(P, est, SET, CUR, '2026-09').est, 10000000, '★ 폐기(void)·종결(closed)·다른 프로젝트 견적은 합치지 않는다'); }
{ const set = SET.concat([st('v', 'payment', '2026-09-01', 5000000, { status: 'void' }), st('o', 'payment', '2026-09-01', 8000000, { pjtId: 'pjt_other', pjtIds: ['pjt_other'] })]); eq(M.achievementRow(P, EST, set, CUR, '2026-09').payIssued, 3500000, '★ 폐기된 지급예정서·다른 프로젝트 지급예정서는 안 섞인다'); }
{ const set = [st('j', 'payment', '2026-09-01', 6000000, { pjtIds: ['pjt_1', 'pjt_x'], perPjtAmount: { pjt_1: 1000000, pjt_x: 5000000 } })]; eq(M.achievementRow(P, EST, set, CUR, '2026-09').payIssued, 1000000, '★ 여러 프로젝트에 걸친 공동 발행 지급예정서는 이 프로젝트 몫(perPjtAmount 1,000,000)만'); const set2 = [st('k', 'payment', '2026-09-01', 6000000, { pjtIds: ['pjt_1', 'pjt_x'] })]; eq(M.achievementRow(P, EST, set2, CUR, '2026-09').payIssued, 3000000, '몫이 없으면 균등 분배(6,000,000 ÷ 2)'); }
{ const set = [st('i', 'invoice', '2026-09-01', 99999999)]; eq(M.achievementRow(P, EST, set, CUR, '2026-09').payIssued, 0, '★ 청구서(invoice)는 원가가 아니다 — 지급예정서(payment)만'); }
{ const set = [st('n', 'payment', '', 111), st('m', 'payment', 'x', 222), { id: 'z', docType: 'payment', pjtId: 'pjt_1', pjtIds: ['pjt_1'], amount: 333, status: 'active' }]; const a = M.achievementRow(P, EST, set, CUR, '2026-09'); eq(a.payIssued, 666, '발행일이 없거나 형식이 틀린 지급예정서는 그 달까지에 넣는다(원가를 낮춰 목표 안으로 보이게 하지 않는다 — 보수적으로 포함): 111 + 222 + 333 = 666'); }
console.log('── 목록과 안전');
{ const rows = M.achievementRows([P, Object.assign({}, P, { id: 'pjt_2', code: 'B', targetMargin: undefined, linkPjt: 'R2' }), Object.assign({}, P, { id: 'pjt_3', code: 'C' })], EST, SET, CUR, '2026-09'); eq(rows.map((r) => r.id), ['pjt_1'], '★ 견적이 있는 프로젝트만 나온다 — EST 는 pjt_1 의 견적뿐이라 견적이 없는 pjt_2·pjt_3 은 제외(견적이 없으면 목표 원가를 모르는 "견적 없음" 행으로 목록을 채우지 않는다)'); }
{ const rows = M.achievementRows([P], EST, SET, CUR, '2026-09'); eq(rows.length, 1, '견적이 있는 프로젝트는 목표 마진율이 없어도 이유 상태로 나온다(사용자가 목표 입력을 알아채게)'); const r2 = M.achievementRows([Object.assign({}, P, { targetMargin: undefined })], EST, SET, CUR, '2026-09'); eq(r2[0].status, 'notarget', 'notarget 행도 나온다'); }
{ const sn = JSON.stringify([P, EST, SET, CUR]); M.achievementRow(P, EST, SET, CUR, '2026-09'); M.achievementRows([P], EST, SET, CUR, '2026-09'); ok(JSON.stringify([P, EST, SET, CUR]) === sn, '입력을 바꾸지 않는다'); }
for (const bad of [null, undefined, 3, 'x', [], {}]) { let threw = false, r; try { r = M.achievementRow(bad, bad, bad, bad, bad); M.achievementRows(bad, bad, bad, bad, bad); M.achievementRow(P, bad, bad, CUR, bad); } catch (e) { threw = true; } ok(!threw && r && typeof r === 'object', '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const a = M.achievementRow(P, [{ id: 'e', pjtId: 'pjt_1', status: 'active', items: [{ qty: NaN, price: Infinity }, { amount: 'x' }, null] }], [st('q', 'payment', '2026-09-01', NaN), st('r', 'payment', '2026-09-01', Infinity)], { ok: true, projects: [{ pjt: 'R1', overhead: NaN, ownLabor: Infinity }] }, '2026-09'); ok([a.est, a.payIssued, a.direct, a.ownLabor, a.cost].every((v) => v === null || fin(v)) && (a.rate === null || fin(a.rate)), '★ 견적·정산서·서버 값이 NaN·Infinity 여도 유한한 숫자(또는 null)다 — 화면에 안 나온다'); }
{ for (const tm of [true, false, [], {}, [12]]) { const a = M.achievementRow(Object.assign({}, P, { targetMargin: tm }), EST, SET, CUR, '2026-09'); ok(a.status === 'notarget' && a.rate === null, '★ 목표 마진율이 ' + JSON.stringify(tm) + ' 이면 notarget — 불리언 true 가 1%, 배열 [12] 가 12% 로 해석되지 않는다(입력은 숫자·글자뿐이지만 이상한 값이 숫자로 둔갑하지 않게)'); } }
{ let threw = false, a; try { a = M.achievementRow(P, [null, 3, 'x', undefined, EST[0], [], { pjtId: 'pjt_1' }], [null, 3, 'x', undefined, SET[0], SET[1], [], { docType: 'payment' }], CUR, '2026-09'); } catch (e) { threw = true; } ok(!threw && a.est === 10000000 && a.payIssued === 2000000 + 1500000, '★ 견적·정산서 배열의 원소가 null·숫자·글자여도 던지지 않고 정상 항목만 합친다(최상위 입력만 이상하게 시험하면 원소가 null 인 배열을 놓친다) — 견적 ' + (a && a.est) + ' 지급 ' + (a && a.payIssued)); }
{ let threw = false; try { M.achievementRows([null, 3, 'x', P], [null, EST[0]], [null, SET[0]], CUR, '2026-09'); } catch (e) { threw = true; } ok(!threw, '프로젝트 목록의 원소가 null·숫자여도 던지지 않는다'); }
ok(pass + fail >= 65, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
