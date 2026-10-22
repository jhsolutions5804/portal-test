import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const I = await import('../app/modules/plan/issue.js?v=' + VER);
/* 정산서 발행 — 거래처 일치 규칙(대기열 1-2-10 ① 단계, 대표님 2026-10-22 "정산서 하나에는 거래처 하나만").
 * 청구서의 수신자(원청)는 견적의 거래처(clientId)와 같아야 한다: 견적 후보는 수신자와 같은 거래처 것만 보이고, 다른 거래처 견적 선택은 거부되고, 수신자를 바꾸면 다른 거래처 견적은 자동 해제된다.
 * 지급예정서의 수신자는 하청이라 견적의 거래처(원청)와 다르므로 적용하지 않는다. 견적에 clientId 가 비어 있거나 초안에 수신자가 없으면 적용하지 않는다(호환 — 기존 시험·옛 데이터).
 * 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const EST = () => [
  { id: 'A', pjtId: 'p1', clientId: 'c1', status: 'active', title: 'A', items: [] },
  { id: 'B', pjtId: 'p1', clientId: 'c2', status: 'active', title: 'B', items: [] },
  { id: 'C', pjtId: 'p2', clientId: 'c1', status: 'active', title: 'C', items: [] },
  { id: 'D', pjtId: 'p1', clientId: 'c1', status: 'void', title: 'D', items: [] },
  { id: 'E', pjtId: 'p1', clientId: '', status: 'active', title: 'E(거래처 없음)', items: [] }];
const D = (o) => Object.assign({ docType: 'invoice', method: 'qty', pjtId: 'p1', pjtIds: ['p1'], recipientId: '', recipientContact: '', estIds: [], qtyInput: {}, qtyAmt: {} }, o || {});
const ids = (l) => l.map((e) => e.id).join();
console.log('── 견적 후보(pickableEstimates): 청구서에서 수신자가 있으면 같은 거래처 견적만');
eq(ids(I.pickableEstimates(D({ recipientId: 'c1' }), EST(), [])), 'A,E', '★ 청구서·수신자 c1·프로젝트 p1 → A(c1)와 E(거래처 미지정, 규칙 미적용). B 는 거래처 c2, C 는 프로젝트 p2, D 는 폐기');
eq(ids(I.pickableEstimates(D({ recipientId: 'c1', pjtIds: ['p1', 'p2'] }), EST(), [])), 'A,C,E', '★ 프로젝트 p1·p2 → A, C, E');
eq(ids(I.pickableEstimates(D({ recipientId: 'c2' }), EST(), [])), 'B,E', '수신자 c2 → B 와 E');
eq(ids(I.pickableEstimates(D({ recipientId: '' }), EST(), [])), 'A,B,E', '★ 수신자를 아직 안 골랐으면 제한 없음 → A, B, E');
eq(ids(I.pickableEstimates(D({ docType: 'payment', recipientId: 'c1' }), EST(), [])), 'A,B,E', '★ 지급예정서는 규칙 미적용(수신자는 하청이라 견적의 거래처와 다르다) → A, B, E');
eq(ids(I.pickableEstimates(D({ recipientId: 'zzz' }), EST(), [])), 'E', '수신자가 어느 견적과도 다르면 거래처 없는 E 만');
console.log('── toggleEst: 다른 거래처 견적 선택 거부, 수신자가 비면 첫 견적이 수신자 결정');
{ const d = D({ recipientId: 'c1' }); const r = I.toggleEst(d, 'B', [], EST()); ok(typeof r === 'string' && r.length > 0 && /거래처/.test(r), '★ 수신자 c1 인데 c2 견적 B 를 고르면 오류 문구(거래처)를 돌려준다 — ' + r); eq(d.estIds, [], '거부되면 선택 목록이 그대로(비어 있음)'); eq(d.recipientId, 'c1', '수신자도 그대로'); }
{ const d = D({ recipientId: 'c1' }); const r = I.toggleEst(d, 'A', [], EST()); eq([r, d.estIds, d.recipientId], ['', ['A'], 'c1'], '같은 거래처 견적 A 는 선택된다(오류 없음)'); }
{ const d = D({ recipientId: '', recipientContact: '담당' }); const r = I.toggleEst(d, 'A', [], EST()); eq([r, d.estIds, d.recipientId, d.recipientContact], ['', ['A'], 'c1', ''], '★ 수신자가 비어 있으면 첫 견적 A 를 고를 때 그 거래처 c1 이 수신자가 된다(담당자는 비움)'); const r2 = I.toggleEst(d, 'B', [], EST()); ok(/거래처/.test(r2) && d.estIds.join() === 'A', '★ 그 뒤 다른 거래처 B 는 거부된다'); const r3 = I.toggleEst(d, 'C', [], EST()); eq([r3, d.estIds], ['', ['A', 'C']], '같은 거래처 C(다른 프로젝트)는 선택된다'); }
{ const d = D({ recipientId: '' }); I.toggleEst(d, 'E', [], EST()); eq([d.estIds, d.recipientId], [['E'], ''], '거래처 미지정 견적 E 는 선택돼도 수신자를 정하지 않는다'); }
{ const d = D({ recipientId: 'c1', estIds: ['A'] }); const r = I.toggleEst(d, 'A', [], EST()); eq([r, d.estIds], ['', []], '선택돼 있던 견적을 다시 누르면 해제(거래처 규칙은 해제에 영향 없음)'); }
{ const d = D({ docType: 'payment', recipientId: 'c1' }); const r = I.toggleEst(d, 'B', [], EST()); eq([r, d.estIds, d.recipientId], ['', ['B'], 'c1'], '★ 지급예정서는 다른 거래처 견적도 선택된다(규칙 미적용, 수신자도 안 바뀐다)'); }
{ const d = D({ method: 'progress', recipientId: 'c1' }); const r = I.toggleEst(d, 'B', [], EST()); ok(/거래처/.test(r) && d.estIds.length === 0 && !d.prog, '★ 공정 연동에서도 다른 거래처 견적은 거부되고 공정 데이터(d.prog)가 만들어지지 않는다'); }
{ const d = D(); const r = I.toggleEst(d, 'A'); eq([r === undefined || r === '', d.estIds, d.recipientId], [true, ['A'], ''], '★ 호환: 견적 목록을 안 넘기는 옛 호출(기존 시험)은 예전처럼 선택만 된다');
  const d2 = D({ recipientId: 'c1' }); const r2 = I.toggleEst(d2, 'B'); eq([r2 === undefined || r2 === '', d2.estIds], [true, ['B']], '호환: 견적 목록이 없으면 거래처를 알 수 없어 규칙을 적용하지 않는다'); }
{ const d = D({ recipientId: 'c1' }); const r = I.toggleEst(d, 'nope', [], EST()); eq([r === undefined || r === '', d.estIds], [true, ['nope']], '목록에 없는 견적 id 는 예전처럼 처리(규칙 미적용)'); }
console.log('── setRecipient: 수신자를 바꾸면 다른 거래처 견적을 자동 해제');
{ const d = D({ recipientId: 'c1', estIds: ['A', 'C'], recipientContact: '담당' }); const rm = I.setRecipient(d, 'c2', [], EST()); eq([rm, d.estIds, d.recipientId, d.recipientContact], [['A', 'C'], [], 'c2', ''], '★ 수신자를 c1→c2 로 바꾸면 c1 견적 A·C 가 자동 해제되고 해제 목록을 돌려준다(담당자는 비움)'); }
{ const d = D({ recipientId: 'c1', estIds: ['A', 'E'] }); const rm = I.setRecipient(d, 'c2', [], EST()); eq([rm, d.estIds], [['A'], ['E']], '거래처 미지정 견적 E 는 남는다'); }
{ const d = D({ recipientId: 'c1', estIds: ['A', 'C'] }); const rm = I.setRecipient(d, 'c1', [], EST()); eq([rm, d.estIds], [[], ['A', 'C']], '같은 수신자를 다시 고르면 아무것도 해제되지 않는다'); }
{ const d = D({ recipientId: 'c1', estIds: ['A'] }); const rm = I.setRecipient(d, '', [], EST()); eq([rm, d.estIds, d.recipientId], [[], ['A'], ''], '수신자를 비우면 해제 없음(제한이 풀린다)'); }
{ const d = D({ docType: 'payment', recipientId: 'c1', estIds: ['A', 'B'] }); const rm = I.setRecipient(d, 'c2', [], EST()); eq([rm, d.estIds, d.recipientId], [[], ['A', 'B'], 'c2'], '★ 지급예정서는 수신자를 바꿔도 견적이 해제되지 않는다(규칙 미적용)'); }
{ const d = D({ recipientId: 'c1', estIds: ['A'] }); const rm = I.setRecipient(d, 'c2'); eq([rm, d.estIds, d.recipientId], [[], ['A'], 'c2'], '호환: 견적 목록을 안 넘기면 해제 없이 수신자만 바뀐다'); }
console.log('── 안전: 입력을 망가뜨리지 않는다');
for (const bad of [null, undefined, 'x', 3, {}]) { let threw = false; try { I.pickableEstimates(D({ recipientId: 'c1' }), bad, []); I.toggleEst(D(), 'A', [], bad); I.setRecipient(D({ estIds: ['A'] }), 'c2', [], bad); } catch (e) { threw = true; } ok(!threw, '견적 목록이 이상해도(' + JSON.stringify(bad) + ') 던지지 않는다'); }
{ const e = EST(); const sn = JSON.stringify(e); I.pickableEstimates(D({ recipientId: 'c1' }), e, []); I.toggleEst(D({ recipientId: 'c1' }), 'A', [], e); I.setRecipient(D({ estIds: ['A'] }), 'c2', [], e); ok(JSON.stringify(e) === sn, '견적 목록을 바꾸지 않는다'); }
ok(pass + fail >= 32, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
