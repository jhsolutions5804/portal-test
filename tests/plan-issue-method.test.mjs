import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const I = await import('../app/modules/plan/issue.js?v=' + VER);
/* 정산서 발행 — 프로젝트 선택 규칙(대기열 1-2-10 새 ② 단계, 대표님 2026-10-22 "상단 프로젝트 삭제 · 해당 없음 삭제").
 * 프로젝트가 입력의 본질인 공정·공수는 방식 카드 안에서 프로젝트를 고르고, 프로젝트 없는 정산서는 없다(마지막 프로젝트는 해제할 수 없고, 방식을 공정·공수로 바꿀 때 프로젝트가 비어 있으면 첫 프로젝트로 채운다).
 * 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const PJ = [{ id: 'p1', code: 'A1' }, { id: 'p2', code: 'A2' }, { id: 'p3', code: 'A3' }];
const EST = () => [{ id: 'e1', pjtId: 'p1', status: 'active', items: [] }, { id: 'e2', pjtId: 'p2', status: 'active', items: [] }];
const D = (o) => Object.assign({ docType: 'invoice', method: 'progress', pjtId: 'p1', pjtIds: ['p1'], estIds: [], qtyInput: {}, qtyAmt: {} }, o || {});
console.log('── togglePjt: 마지막 프로젝트는 해제할 수 없다(해당 없음 삭제)');
{ const d = D(); const r = I.togglePjt(d, 'p1', EST()); ok(typeof r === 'string' && /하나 이상/.test(r), '★ 선택된 프로젝트가 p1 하나뿐일 때 p1 을 해제하려 하면 오류 문구("하나 이상") — ' + r); eq([d.pjtIds, d.pjtId, d.method], [['p1'], 'p1', 'progress'], '★ 아무것도 바뀌지 않는다(프로젝트·대표 프로젝트·정산 방식 그대로 — 옛 동작은 직접 입력으로 바뀌었다)'); }
{ const d = D({ pjtIds: ['p1', 'p2'] }); const r = I.togglePjt(d, 'p1', EST()); eq([r, d.pjtIds, d.pjtId], ['', ['p2'], 'p2'], '★ 둘 이상 선택돼 있으면 하나를 해제할 수 있다 → p2 만 남고 대표 프로젝트도 p2'); }
{ const d = D({ pjtIds: ['p1', 'p2'], estIds: ['e1', 'e2'] }); I.togglePjt(d, 'p1', EST()); eq(d.estIds, ['e2'], '프로젝트를 해제하면 그 프로젝트의 선택 견적은 해제된다(e1 은 p1)'); }
{ const d = D(); const r = I.togglePjt(d, 'p2', EST()); eq([r, d.pjtIds, d.pjtId], ['', ['p1', 'p2'], 'p1'], '새 프로젝트를 고르면 뒤에 더해진다(대표 프로젝트는 그대로 p1)'); }
{ const d = D({ pjtIds: [], pjtId: '', method: 'manday', docType: 'payment' }); const r = I.togglePjt(d, 'p3', EST()); eq([r, d.pjtIds, d.pjtId, d.method], ['', ['p3'], 'p3', 'manday'], '프로젝트가 비어 있던 상태에서 고르면 그 프로젝트가 대표가 된다(방식은 그대로)'); }
{ const d = D({ pjtIds: [], pjtId: '' }); const r = I.togglePjt(d, 'zzz', EST()); ok(r === '' || typeof r === 'string', '목록에 없는 id 를 눌러도 던지지 않는다'); }
console.log('── setMethod: 공정·공수로 바꿀 때 프로젝트가 비어 있으면 첫 프로젝트로 채운다');
{ const d = D({ method: 'manual', pjtIds: [], pjtId: '' }); I.setMethod(d, 'progress', PJ); eq([d.method, d.pjtIds, d.pjtId], ['progress', ['p1'], 'p1'], '★ 직접 입력(프로젝트 없음) → 공정 연동: 프로젝트가 첫 프로젝트 p1 로 채워진다'); }
{ const d = D({ method: 'manual', pjtIds: [], pjtId: '', docType: 'payment' }); I.setMethod(d, 'manday', PJ); eq([d.method, d.pjtIds, d.pjtId], ['manday', ['p1'], 'p1'], '★ 공수 연동으로 바꿀 때도 같다'); }
{ const d = D({ method: 'manual', pjtIds: ['p2'], pjtId: 'p2' }); I.setMethod(d, 'progress', PJ); eq([d.method, d.pjtIds, d.pjtId], ['progress', ['p2'], 'p2'], '이미 프로젝트가 있으면 그대로(p2)'); }
{ const d = D({ method: 'progress', pjtIds: [], pjtId: '' }); I.setMethod(d, 'manual', PJ); eq([d.method, d.pjtIds, d.pjtId], ['manual', [], ''], '★ 직접 입력으로 바꿀 때는 프로젝트를 채우지 않는다(줄에서 고른다)'); }
{ const d = D({ method: 'progress', pjtIds: [], pjtId: '' }); I.setMethod(d, 'qty', PJ); eq([d.method, d.pjtIds, d.pjtId], ['qty', [], ''], '★ 수량 정산으로 바꿀 때도 채우지 않는다(견적이 정한다)'); }
{ const d = D({ method: 'manual', pjtIds: [], pjtId: '' }); I.setMethod(d, 'progress', []); eq([d.method, d.pjtIds, d.pjtId], ['progress', [], ''], '프로젝트 목록이 비어 있으면 채울 것이 없어 그대로(빈 채로)'); }
for (const bad of [null, undefined, 'x', 3, {}]) { const d = D({ method: 'manual', pjtIds: [], pjtId: '' }); let threw = false; try { I.setMethod(d, 'progress', bad); } catch (e) { threw = true; } ok(!threw && d.method === 'progress', '프로젝트 목록이 이상해도(' + JSON.stringify(bad) + ') 던지지 않고 방식은 바뀐다'); }
{ const d = D({ method: 'manual', pjtIds: [], pjtId: '' }); I.setMethod(d, 'progress', [{ code: '코드만' }, null, { id: 7 }, { id: 'p5', code: 'A5' }]); eq(d.pjtIds, ['p5'], '목록에 id 가 없거나 글자가 아닌 항목은 건너뛰고 처음으로 올바른 프로젝트를 쓴다'); }
{ const d = D({ method: 'manual', pjtIds: undefined, pjtId: undefined }); I.setMethod(d, 'progress', PJ); eq([d.pjtIds, d.pjtId], [['p1'], 'p1'], '프로젝트 필드가 아예 없던 초안도 채워진다'); }
{ const d = D({ method: 'manual', pjtIds: ['p9'], pjtId: 'p9' }); I.setMethod(d, 'progress', PJ); eq(d.pjtIds, ['p9'], '목록에 없는 프로젝트(p9)가 이미 들어 있어도 건드리지 않는다(존재 판정은 발행 쪽 몫)'); }
console.log('── 방식 변경 후 견적 선택은 프로젝트와 맞다');
{ const d = D({ method: 'qty', pjtIds: ['p1', 'p2'], pjtId: 'p1', estIds: ['e1', 'e2'], recipientId: '' }); I.setMethod(d, 'progress', PJ); eq([d.pjtIds, d.estIds], [['p1', 'p2'], ['e1', 'e2']], '수량 정산에서 견적이 정한 프로젝트(p1·p2)는 공정으로 바꿔도 그대로이고 견적 선택도 그대로');
  const ids = I.pickableEstimates(d, EST(), PJ).map((e) => e.id); ok(Array.isArray(ids), '공정에서도 견적 후보를 계산할 수 있다 — ' + ids.join()); }
ok(pass + fail >= 23, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
