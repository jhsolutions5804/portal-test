import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const I = await import('../app/modules/plan/issue.js?v=' + VER);
/* 정산서 발행 — 직접 입력은 줄마다 프로젝트를 고른다(대기열 1-2-10 새 ② 단계, 대표님 2026-10-22 "상단 프로젝트 삭제 · 정산 항목 작성 시 프로젝트 선택 · 해당 없음 삭제").
 * 정산서의 프로젝트(pjtIds·pjtId)와 프로젝트별 금액(perPjtAmount)은 줄에서 계산한다 — 돈이 어느 프로젝트로 귀속되는지를 정하는 값이라 손계산으로 고정한다.
 * 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const PJ = [{ id: 'p1', code: 'A1' }, { id: 'p2', code: 'A2' }];
const L = (name, qty, price, pjtId) => ({ name, spec: '', qty, price, amount: Math.round(qty * price), remark: '', pjtId });
const D = (items, o) => Object.assign({ docType: 'invoice', method: 'manual', pjtId: '', pjtIds: [], recipientId: '', recipientContact: '', senderId: '', estIds: [], qtyInput: {}, qtyAmt: {}, supplyOverride: null, vatOverride: null, manualItems: items, baseMonth: '2026-10', issueDate: '2026-10-22', payDate: '', notes: '' }, o || {});
const plan = (items, projects) => I.manualPjtPlan(D(items), projects === undefined ? PJ : projects);
console.log('── 줄에서 정산서의 프로젝트와 프로젝트별 금액을 계산');
eq(plan([L('가', 3, 1000, 'p1'), L('나', 2, 500, 'p1')]), { pjtIds: ['p1'], pjtId: 'p1', perPjtAmount: { p1: 4000 }, supply: 4000, errors: [] }, '★ 한 프로젝트 — 줄1 3×1,000 + 줄2 2×500 = 4,000, 모두 p1');
eq(plan([L('가', 3, 1000, 'p1'), L('나', 1, 1000, 'p2')]), { pjtIds: ['p1', 'p2'], pjtId: 'p1', perPjtAmount: { p1: 3000, p2: 1000 }, supply: 4000, errors: [] }, '★ 두 프로젝트 — p1 3,000 · p2 1,000, 합계 4,000, 대표 프로젝트는 첫 줄의 p1');
eq(plan([L('가', 3, 1000, 'p2'), L('나', 1, 1000, 'p1')]), { pjtIds: ['p2', 'p1'], pjtId: 'p2', perPjtAmount: { p2: 3000, p1: 1000 }, supply: 4000, errors: [] }, '프로젝트 순서는 줄 순서(첫 줄이 p2 이면 대표 프로젝트도 p2)');
eq(plan([L('가', 3, 1000, 'p1'), L('네고', 1, -500, 'p1')]), { pjtIds: ['p1'], pjtId: 'p1', perPjtAmount: { p1: 2500 }, supply: 2500, errors: [] }, '★ 같은 프로젝트의 네고 줄(-500) — p1 은 3,000 - 500 = 2,500');
eq(plan([L('가', 3, 1000, 'p1'), L('네고', 1, -500, 'p2')]), { pjtIds: ['p1', 'p2'], pjtId: 'p1', perPjtAmount: { p1: 3000, p2: -500 }, supply: 2500, errors: [] }, '★ 다른 프로젝트의 네고 줄 — p2 는 -500(합계 2,500 은 그대로)');
eq(plan([L('가', 3, 1000, 'p1'), L('다', 1, 700, 'p1'), L('라', 1, 300, 'p2'), L('마', 1, 100, 'p1')]), { pjtIds: ['p1', 'p2'], pjtId: 'p1', perPjtAmount: { p1: 3800, p2: 300 }, supply: 4100, errors: [] }, '★ 같은 프로젝트 줄이 떨어져 있어도 합쳐서 더한다 — p1 3,000+700+100 = 3,800 · p2 300');
console.log('── 빈 줄은 무시, 프로젝트 없는 줄은 오류');
eq(plan([L('가', 3, 1000, 'p1'), L('', 1, 0, '')]), { pjtIds: ['p1'], pjtId: 'p1', perPjtAmount: { p1: 3000 }, supply: 3000, errors: [] }, '★ 품명도 금액도 없는 완전히 빈 줄은 프로젝트가 없어도 무시한다');
{ const r = plan([L('가', 3, 1000, 'p1'), L('운반', 1, 1000, '')]); ok(r.errors.length === 1 && /프로젝트/.test(r.errors[0]) && /2번/.test(r.errors[0]), '★ 품명과 금액이 있는데 프로젝트가 없는 줄은 오류(줄 번호를 알려 준다) — ' + JSON.stringify(r.errors)); }
{ const r = plan([L('', 1, 500, '')]); ok(r.errors.length === 1 && /1번/.test(r.errors[0]), '품명이 없어도 금액이 있으면 줄이다 — 프로젝트가 없으면 오류 — ' + JSON.stringify(r.errors)); }
{ const r = plan([L('가', 1, 0, '')]); ok(r.errors.length === 1 && /1번/.test(r.errors[0]), '금액이 0 이어도 품명이 있으면 줄이다 — 프로젝트가 없으면 오류 — ' + JSON.stringify(r.errors)); }
{ const r = plan([L('가', 1, 1000, ''), L('나', 1, 1000, '')]); ok(r.errors.length === 2, '프로젝트 없는 줄이 둘이면 오류도 둘(줄마다 알려 준다) — ' + r.errors.length + '개'); }
console.log('── 존재하지 않는 프로젝트·이상한 값은 오류(돈이 엉뚱한 곳으로 가지 않게)');
{ const r = plan([L('가', 1, 1000, 'zzz')]); ok(r.errors.length === 1 && /프로젝트/.test(r.errors[0]), '★ 프로젝트 목록에 없는 id(zzz)는 오류 — ' + JSON.stringify(r.errors)); }
for (const bad of [7, {}, [], true]) { const r = plan([L('가', 1, 1000, bad)]); ok(r.errors.length === 1, '프로젝트 id 가 글자가 아니면(' + JSON.stringify(bad) + ') 오류'); }
eq(plan([L('가', 1, 1000, 'zzz')], null).errors, [], '호환: 프로젝트 목록을 안 넘기면(옛 호출) 존재 검사는 건너뛴다');
for (const bad of [7, {}, [], true]) { const r = plan([L('가', 1, 1000, bad)], null); ok(r.errors.length === 1 && r.pjtIds.length === 0, '★ 프로젝트 목록 없이 호출해도(옛 호출) 글자가 아닌 프로젝트 id(' + JSON.stringify(bad) + ')는 오류이고 프로젝트로 안 들어간다 — 글자 검사가 유일한 방어'); }
{ const r = plan([L('가', 3, 1000, 'p1'), L('운반', 1, 1000, ''), L('나', 1, 500, 'zzz')]); eq([r.supply, r.pjtIds, r.perPjtAmount, r.errors.length], [3000, ['p1'], { p1: 3000 }, 2], '★ 오류가 있는 줄(프로젝트 없음·없는 프로젝트)의 금액은 합계·프로젝트별 금액에 들어가지 않는다 — 합계 3,000 은 유효한 줄만'); }
console.log('── buildSettlement: 저장 계획');
{ const r = I.buildSettlement(D([L('가', 3, 1000, 'p1'), L('나', 1, 1000, 'p2')]), { settlements: [], estimates: [], companies: [], projects: PJ, me: {}, now: 1790000000000 });
  ok(r.ok, '발행 저장 계획이 만들어진다 — ' + JSON.stringify(r.errors));
  eq([r.payload.pjtId, r.payload.pjtIds, r.payload.perPjtAmount, r.payload.supply], ['p1', ['p1', 'p2'], { p1: 3000, p2: 1000 }, 4000], '★ 저장되는 프로젝트·프로젝트별 금액·합계가 줄에서 계산된 값(돈의 귀속)');
  eq(r.payload.lines.map((l) => [l.name, l.amount, l.pjtId]), [['가', 3000, 'p1'], ['나', 1000, 'p2']], '★ 저장되는 줄마다 프로젝트가 함께 저장된다'); }
{ const r = I.buildSettlement(D([L('가', 3, 1000, 'p1'), L('운반', 1, 1000, '')]), { settlements: [], estimates: [], companies: [], projects: PJ, me: {}, now: 1 }); ok(!r.ok && r.errors.some((e) => /프로젝트/.test(e)), '★ 프로젝트 없는 줄이 있으면 발행되지 않는다 — ' + JSON.stringify(r.errors)); }
{ const r = I.buildSettlement(D([L('가', 3, 1000, 'p1')], { pjtId: 'p9', pjtIds: ['p9'] }), { settlements: [], estimates: [], companies: [], projects: PJ, me: {}, now: 1 }); ok(r.ok && r.payload.pjtId === 'p1' && JSON.stringify(r.payload.pjtIds) === '["p1"]' && JSON.stringify(r.payload.perPjtAmount) === '{"p1":3000}', '★ 초안에 옛 상단 프로젝트(p9)가 남아 있어도 직접 입력은 줄의 프로젝트만 쓴다(돈이 p9 로 가지 않는다)'); }
{ const r = I.buildSettlement(D([L('가', 3, 1000, 'p1'), L('네고', 1, -4000, 'p1')]), { settlements: [], estimates: [], companies: [], projects: PJ, me: {}, now: 1 }); ok(!r.ok && r.errors.some((e) => /금액/.test(e)), '합계가 0 이하이면 기존처럼 발행되지 않는다 — ' + JSON.stringify(r.errors)); }
console.log('── 다른 방식은 줄 계획을 쓰지 않는다');
{ const d = D([L('가', 3, 1000, '')], { method: 'qty', pjtId: 'p1', pjtIds: ['p1'] }); const r = I.buildSettlement(d, { settlements: [], estimates: [], companies: [], projects: PJ, me: {}, now: 1 }); ok(!r.ok && r.errors.some((e) => /금액/.test(e)) && !r.errors.some((e) => /줄/.test(e)), '수량 정산은 직접 입력 줄 검사를 하지 않는다(견적이 없어 금액 없음 오류만)'); }
console.log('── 수정 복원(draftFromSettlement): 줄 프로젝트 복원, 옛 정산서는 정산서의 프로젝트로');
{ const s = { docType: 'invoice', method: 'manual', pjtId: 'p1', pjtIds: ['p1', 'p2'], lines: [{ name: '가', spec: '', qty: 3, price: 1000, amount: 3000, pjtId: 'p1' }, { name: '나', spec: '', qty: 1, price: 1000, amount: 1000, pjtId: 'p2' }], baseMonth: '2026-10', issueDate: '2026-10-22' }; const d = I.draftFromSettlement(s); eq(d.manualItems.map((x) => [x.name, x.pjtId]), [['가', 'p1'], ['나', 'p2']], '★ 저장된 줄의 프로젝트가 복원된다'); }
{ const s = { docType: 'invoice', method: 'manual', pjtId: 'p1', pjtIds: ['p1'], lines: [{ name: '옛1', spec: '', qty: 1, price: 500, amount: 500 }, { name: '옛2', spec: '', qty: 1, price: 700, amount: 700 }], baseMonth: '2026-09', issueDate: '2026-09-20' }; const d = I.draftFromSettlement(s); eq(d.manualItems.map((x) => [x.name, x.pjtId]), [['옛1', 'p1'], ['옛2', 'p1']], '★ 옛 정산서(줄에 프로젝트가 없음)는 정산서의 프로젝트 p1 로 채워 복원한다'); }
{ const s = { docType: 'invoice', method: 'manual', pjtId: '', pjtIds: [], lines: [{ name: '옛3', spec: '', qty: 1, price: 500, amount: 500 }], baseMonth: '2026-09', issueDate: '2026-09-20' }; const d = I.draftFromSettlement(s); eq(d.manualItems.map((x) => [x.name, x.pjtId]), [['옛3', '']], '프로젝트가 없던 옛 정산서는 줄 프로젝트도 비어 있다(수정하려면 고르게 됨)'); }
{ const s = { docType: 'invoice', method: 'manual', pjtId: 'p1', pjtIds: ['p1'], lines: [{ name: '가', spec: '', qty: 1, price: 500, amount: 500, pjtId: 7 }], baseMonth: '2026-09', issueDate: '2026-09-20' }; const d = I.draftFromSettlement(s); eq(d.manualItems[0].pjtId, 'p1', '줄 프로젝트가 글자가 아니면 정산서의 프로젝트로 채운다'); }
console.log('── 새 초안: 줄 프로젝트는 비어 있다(고르게 한다)');
{ const d = I.newIssueDraft({ docType: 'invoice', pjtId: 'p1', companies: [], today: '2026-10-22' }); ok(d.manualItems.length === 2 && d.manualItems.every((x) => x.pjtId === ''), '새 초안의 줄은 프로젝트가 비어 있다(프로젝트 화면에서 들어와도 기본값을 끼워 넣지 않는다 — 줄에서 고르게)'); }
console.log('── 안전');
for (const bad of [null, undefined, 'x', 3, {}]) { let threw = false; try { I.manualPjtPlan(D(bad), PJ); I.manualPjtPlan(D([L('가', 1, 1, 'p1')]), bad); } catch (e) { threw = true; } ok(!threw, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const items = [L('가', 3, 1000, 'p1')]; const sn = JSON.stringify(items); I.manualPjtPlan(D(items), PJ); ok(JSON.stringify(items) === sn, '줄을 바꾸지 않는다'); }
ok(pass + fail >= 40, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
