import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const I = await import('../app/modules/plan/issue.js?v=' + VER);
/* 정산서 발행 — 수량 정산에서 프로젝트는 견적이 정한다(대기열 1-2-10 새 ② 단계, 대표님 2026-10-22 "상단 프로젝트 삭제 · 정산 항목에서 프로젝트 선택 · 해당 없음 삭제").
 * 수량 정산(qty)은 프로젝트와 무관하게 수신자(거래처)의 견적이 후보이고, 견적을 고르면 정산서의 프로젝트(pjtIds·pjtId)가 선택 순서대로 견적의 프로젝트로 정해진다.
 * 다른 방식(직접 입력·공정·공수)과 견적 목록을 안 넘기는 옛 호출은 그대로. 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const EST = () => [
  { id: 'A', pjtId: 'p1', clientId: 'c1', status: 'active', title: 'A', items: [] },
  { id: 'B', pjtId: 'p2', clientId: 'c1', status: 'active', title: 'B', items: [] },
  { id: 'C', pjtId: 'p1', clientId: 'c2', status: 'active', title: 'C', items: [] },
  { id: 'D', pjtId: 'p1', clientId: 'c1', status: 'void', title: 'D', items: [] },
  { id: 'E', pjtId: '', clientId: 'c1', status: 'active', title: 'E(프로젝트 없음)', items: [] },
  { id: 'F', pjtId: 'p3', clientId: 'c1', status: 'closed', title: 'F(종결)', items: [] }];
const D = (o) => Object.assign({ docType: 'invoice', method: 'qty', pjtId: '', pjtIds: [], recipientId: '', recipientContact: '', estIds: [], qtyInput: {}, qtyAmt: {} }, o || {});
const ids = (l) => l.map((e) => e.id).join();
console.log('── 견적 후보: 수량 정산은 프로젝트와 무관하게 수신자의 거래처 견적');
eq(ids(I.pickableEstimates(D({ recipientId: 'c1' }), EST(), [])), 'A,B', '★ 수량 정산·수신자 c1 → A(p1)·B(p2). C 는 거래처 c2, D 는 폐기, F 는 종결, E 는 프로젝트가 없는 견적이라 제외(해당 없음 삭제 — 프로젝트를 정해야 정산할 수 있다)');
eq(ids(I.pickableEstimates(D({ recipientId: '' }), EST(), [])), 'A,B,C', '수신자를 안 골랐으면 거래처 제한 없음 → A, B, C(프로젝트 없는 E 는 제외)');
eq(ids(I.pickableEstimates(D({ recipientId: 'c1', pjtIds: ['p1'] }), EST(), [])), 'A,B', '★ 초안에 프로젝트 p1 이 들어 있어도(프로젝트 화면에서 들어온 경우) 수량 정산 후보는 프로젝트로 거르지 않는다 → A, B');
eq(ids(I.pickableEstimates(D({ recipientId: 'c2' }), EST(), [])), 'C', '수신자 c2 → C');
eq(ids(I.pickableEstimates(D({ method: 'manual', recipientId: 'c1', pjtIds: ['p1'] }), EST(), [])), 'A', '(다른 방식은 그대로) 직접 입력은 기존처럼 프로젝트 p1 으로 거른다 → p1 이면서 거래처 c1 인 A 뿐(B 는 p2, E 는 프로젝트 없음이라 제외)');
console.log('── 견적을 고르면 정산서의 프로젝트가 정해진다');
{ const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'A', [], EST()); eq([d.pjtIds, d.pjtId], [['p1'], 'p1'], '★ A 선택 → 프로젝트 p1');
  I.toggleEst(d, 'B', [], EST()); eq([d.pjtIds, d.pjtId], [['p1', 'p2'], 'p1'], '★ 이어서 B 선택 → 프로젝트 p1, p2(선택 순서, 대표 프로젝트는 첫째 p1)');
  I.toggleEst(d, 'A', [], EST()); eq([d.pjtIds, d.pjtId, d.estIds], [['p2'], 'p2', ['B']], '★ A 해제 → 프로젝트 p2 만 남고 대표 프로젝트도 p2'); I.toggleEst(d, 'B', [], EST()); eq([d.pjtIds, d.pjtId, d.estIds], [[], '', []], '모두 해제하면 프로젝트도 비어 있다'); }
{ const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'E', [], EST()); eq([d.pjtIds, d.pjtId, d.estIds], [[], '', ['E']], '프로젝트 없는 견적 E 는 선택돼도 프로젝트를 만들지 않는다'); I.toggleEst(d, 'A', [], EST()); eq([d.pjtIds, d.pjtId], [['p1'], 'p1'], 'E 와 함께 A 를 고르면 프로젝트는 p1 만'); }
{ const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'A', [], EST()); I.toggleEst(d, 'A', [], EST()); I.toggleEst(d, 'B', [], EST()); eq([d.pjtIds, d.estIds], [['p2'], ['B']], '같은 프로젝트의 견적을 고르고 풀고 다시 골라도 프로젝트가 중복되지 않는다'); }
{ const E2 = EST().concat([{ id: 'A2', pjtId: 'p1', clientId: 'c1', status: 'active', title: 'A2', items: [] }]); const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'A', [], E2); I.toggleEst(d, 'A2', [], E2); eq(d.pjtIds, ['p1'], '★ 같은 프로젝트 p1 의 견적이 둘 선택돼도 프로젝트는 하나'); I.toggleEst(d, 'A', [], E2); eq(d.pjtIds, ['p1'], '★ 그중 하나(A)를 풀어도 다른 견적(A2)이 p1 이라 프로젝트는 남는다'); I.toggleEst(d, 'A2', [], E2); eq(d.pjtIds, [], '둘 다 풀면 프로젝트도 사라진다'); }
{ for (const bad of [7, {}, [], true, null, undefined]) { const E3 = [{ id: 'X', pjtId: bad, clientId: 'c1', status: 'active', title: 'X', items: [] }]; const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'X', [], E3); eq([d.pjtIds, d.pjtId, d.estIds], [[], '', ['X']], '★ 견적의 프로젝트 id 가 글자가 아니면(' + JSON.stringify(bad) + ') 프로젝트를 만들지 않는다(돈의 귀속에 쓰이는 값이라 이상한 값은 걸러낸다)'); } }
console.log('── 수신자를 바꾸면 견적이 풀리고 프로젝트도 다시 계산된다');
{ const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'A', [], EST()); I.toggleEst(d, 'B', [], EST()); const rm = I.setRecipient(d, 'c2', [], EST()); eq([rm, d.estIds, d.pjtIds, d.pjtId, d.recipientId], [['A', 'B'], [], [], '', 'c2'], '★ 수신자 c1→c2: A·B 자동 해제, 프로젝트도 비워진다'); }
{ const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'A', [], EST()); I.toggleEst(d, 'E', [], EST()); const rm = I.setRecipient(d, 'c2', [], EST()); eq([rm, d.estIds, d.pjtIds], [['A', 'E'], [], []], '★ E 는 프로젝트가 없지만 거래처 c1 의 견적이라 수신자가 c2 로 바뀌면 A 와 함께 해제된다(프로젝트가 없어도 거래처 규칙은 적용)'); }
console.log('── 다른 방식과 호환');
for (const m of ['manual', 'progress']) { const d = D({ method: m, recipientId: 'c1', pjtId: 'p9', pjtIds: ['p9'] }); if (m === 'manual') I.toggleEst(d, 'A', [], EST()); eq([d.pjtIds, d.pjtId], [['p9'], 'p9'], '(' + m + ') 견적을 고르거나 풀어도 프로젝트가 견적으로 바뀌지 않는다(수량 정산만 파생)'); }
{ const d = D({ method: 'qty', pjtId: 'p9', pjtIds: ['p9'] }); I.toggleEst(d, 'A'); eq([d.pjtIds, d.pjtId, d.estIds], [['p9'], 'p9', ['A']], '★ 호환: 견적 목록을 안 넘기는 옛 호출은 프로젝트를 건드리지 않는다'); }
{ const d = D({ method: 'qty', docType: 'payment', recipientId: 'c1' }); I.toggleEst(d, 'A', [], EST()); eq([d.pjtIds, d.pjtId], [['p1'], 'p1'], '지급예정서의 수량 정산도 견적이 프로젝트를 정한다(거래처 규칙은 청구서만, 파생은 두 문서 공통)'); }
console.log('── 안전');
for (const bad of [null, undefined, 'x', 3, {}]) { let threw = false; try { I.pickableEstimates(D({ recipientId: 'c1' }), bad, []); I.toggleEst(D(), 'A', [], bad); } catch (e) { threw = true; } ok(!threw, '견적 목록이 이상해도(' + JSON.stringify(bad) + ') 던지지 않는다'); }
{ const e = EST(); const sn = JSON.stringify(e); const d = D({ recipientId: 'c1' }); I.toggleEst(d, 'A', [], e); I.setRecipient(d, 'c2', [], e); ok(JSON.stringify(e) === sn, '견적 목록을 바꾸지 않는다'); }
ok(pass + fail >= 33, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
