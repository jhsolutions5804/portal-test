// 견적 산식 표의 "저장·다시 열기" 시험 — 견적 문서(buildEstimate)에 항목별 산식 표(calc)가 실리고, 개정 초안(draftFromEstimate)에서 복원되는지. 가짜 값만 쓴다(공개 저장소).
import { buildEstimate, draftFromEstimate, itemAmt, blankItem } from '../app/modules/plan/estimates.js';
import { newRow, newCalc, sanitizeCalc, calcSheet } from '../app/modules/plan/estimate-calc.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const row = (o) => Object.assign(newRow(), o);
const calc = () => ({ rows: [row({ name: '구역 A', unit: '인', qty: '=2*18', price: '100' }), row({ name: '구역 B', unit: '인', qty: '20', price: '100' })], markup: '10', unit: '10', count: '13' });
const comps = [{ id: 'c1', company: '가짜 발행처', roles: ['supplier'], contacts: [] }, { id: 'c2', company: '가짜 거래처', roles: ['client'], contacts: [] }];
const draft = (items) => ({ editId: null, pjtId: 'p1', title: '가짜 견적', date: '2026-10-01', clientId: 'c2', issuerId: 'c1', items, notes: '' });
const build = (items, extra) => buildEstimate(Object.assign(draft(items), extra || {}), { estimates: [], companies: comps, now: 1, me: { uid: 'u1' } });

console.log('── 저장: 산식 표가 항목과 함께 문서에 실림');
const it = Object.assign(blankItem(), { name: '품목 1', qty: 13, price: 474, amount: 6160, calc: calc() });
const r = build([it]);
ok(r.ok === true, '산식 표가 붙은 견적도 저장할 수 있음');
ok(r.payload.items[0].calc && r.payload.items[0].calc.rows.length === 2 && r.payload.items[0].calc.rows[0].qty === '=2*18' && r.payload.items[0].calc.count === '13', '★ 항목의 산식 표(행·수식 글자·총 대수)가 저장할 문서에 그대로 들어감');
ok(r.payload.items[0].amount === 6160 && r.payload.items[0].qty === 13 && r.payload.items[0].price === 474, '항목의 수량·단가·금액은 기존처럼 저장');
const plain = build([Object.assign(blankItem(), { name: '일반 품목', qty: 2, price: 100, amount: 200 })]);
ok(plain.ok && !('calc' in plain.payload.items[0]) && Object.keys(plain.payload.items[0]).sort().join() === 'amount,name,price,qty,remark,spec', '★ 산식을 안 쓴 항목은 문서 모양이 예전과 똑같음(calc 키 자체가 없음 — undefined 가 Firestore 에 들어가지 않게)');
const empty = build([Object.assign(blankItem(), { name: '빈 산식', qty: 1, price: 10, amount: 10, calc: newCalc() })]); ok(empty.ok && !('calc' in empty.payload.items[0]), '★ 아무것도 안 쓴 산식 표는 저장하지 않음(키 없음)');
const junk = build([Object.assign(blankItem(), { name: '이상한 값', qty: 1, price: 10, amount: 10, calc: 'text' }), Object.assign(blankItem(), { name: '배열', qty: 1, price: 10, amount: 10, calc: [1, 2] }), Object.assign(blankItem(), { name: '숫자', qty: 1, price: 10, amount: 10, calc: 5 })]); ok(junk.ok && junk.payload.items.every((x) => !('calc' in x)), '모양이 틀린 calc(문자열·배열·숫자)는 오류 없이 버림 — 견적 저장이 깨지지 않음');
const dirty = build([Object.assign(blankItem(), { name: '오염', qty: 1, price: 10, amount: 10, calc: Object.assign(calc(), { evil: '<script>', rows: calc().rows.map((x) => Object.assign({ hack: 1 }, x)) }) })]); const dc = dirty.ok && dirty.payload.items[0].calc; ok(!!dc && Object.keys(dc).sort().join() === 'count,markup,rows,unit' && !('hack' in dc.rows[0]), '알 수 없는 필드는 저장하지 않음');
const named = build([Object.assign(blankItem(), { name: '   ', qty: 1, price: 1, amount: 1, calc: calc() }), Object.assign(blankItem(), { name: '정상', qty: 1, price: 1, amount: 1 })]); ok(named.ok && named.payload.items.length === 1 && !('calc' in named.payload.items[0]), '품명이 빈 항목은 기존처럼 빠지고, 그 항목의 산식 표도 같이 빠짐');
const two = build([Object.assign(blankItem(), { name: '가', qty: 1, price: 1, amount: 1, calc: calc() }), Object.assign(blankItem(), { name: '나', qty: 1, price: 1, amount: 1 }), Object.assign(blankItem(), { name: '다', qty: 1, price: 1, amount: 1, calc: calc() })]); ok(two.ok && two.payload.items[0].calc && !('calc' in two.payload.items[1]) && two.payload.items[2].calc, '항목마다 따로 저장(1번·3번만 산식, 2번은 없음)');

console.log('── 문서 크기 한도');
const rows60 = () => Array.from({ length: 60 }, (_, i) => row({ name: 'n' + i, qty: '1', price: '1' }));
const four = build([1, 2, 3, 4].map((n) => Object.assign(blankItem(), { name: '항목' + n, qty: 1, price: 1, amount: 1, calc: { rows: rows60(), markup: '10', unit: '1', count: '1' } }))); ok(four.ok === true, '행 60개짜리 산식 4개(240행)까지는 저장');
const six = build([1, 2, 3, 4, 5, 6].map((n) => Object.assign(blankItem(), { name: '항목' + n, qty: 1, price: 1, amount: 1, calc: { rows: rows60(), markup: '10', unit: '1', count: '1' } }))); ok(six.ok === false && /산식/.test(six.errors[0]), '★ 한 견적의 산식 행 합이 300행을 넘으면 저장 거부(문서 크기 한도 대비) — 이유 문구에 "산식"');
ok(JSON.stringify(four.payload).length < 400000, '최대 한도 근처의 문서도 약 400KB 아래(Firestore 문서 한도 1MB 의 절반 이하)');

console.log('── 개정 초안: 저장된 산식 표가 다시 열림');
const saved = Object.assign({ id: 'e1' }, r.payload); const rev = draftFromEstimate(saved, { me: { name: 'x' }, companies: comps, today: '2026-10-05' });
ok(rev.items[0].calc && rev.items[0].calc.rows.length === 2 && rev.items[0].calc.rows[0].qty === '=2*18' && rev.items[0].calc.count === '13', '★ 개정 초안의 항목에 저장해 둔 산식 표가 그대로 복원됨(수식 글자 포함)');
ok(rev.items[0].qty === 13 && rev.items[0].amount === 6160, '항목의 수량·금액도 그대로');
ok(calcSheet(rev.items[0].calc).price === 6160 && calcSheet(rev.items[0].calc).count === 13, '복원한 표를 다시 계산하면 같은 견적가·대수');
const oldDoc = draftFromEstimate({ id: 'old', no: 'EST-2026-001', baseNo: 'EST-2026-001', rev: 1, items: [{ name: '옛 품목', qty: 2, price: 100, amount: 200 }], pjtId: 'p1', date: '2026-01-01', title: '옛 견적', clientId: 'c2', issuerId: 'c1' }, { me: { name: 'x' }, companies: comps }); ok(!('calc' in oldDoc.items[0]), '★ 산식이 없던 옛 견적을 개정해도 calc 키가 생기지 않음(기존 견적 모양 유지)');
const badDoc = draftFromEstimate({ id: 'b', no: 'EST-2026-002', baseNo: 'EST-2026-002', rev: 1, items: [{ name: '이상', qty: 1, price: 1, amount: 1, calc: 'garbage' }, { name: '배열', qty: 1, price: 1, amount: 1, calc: [1] }], pjtId: 'p1', date: '2026-01-01', title: 't', clientId: 'c2', issuerId: 'c1' }, { me: { name: 'x' }, companies: comps }); ok(badDoc.items.every((x) => !('calc' in x)), '저장돼 있던 calc 가 망가졌어도 개정 초안이 열림(오류 없이 버림)');
const evilDoc = JSON.parse('{"id":"e","no":"EST-2026-003","baseNo":"EST-2026-003","rev":1,"pjtId":"p1","date":"2026-01-01","title":"t","clientId":"c2","issuerId":"c1","items":[{"name":"a","qty":1,"price":1,"amount":1,"calc":{"rows":[{"name":"a","qty":"1","price":"1","__proto__":{"polluted":true}}],"markup":"10","unit":"1","count":"1","__proto__":{"polluted2":true}}}]}'); draftFromEstimate(evilDoc, { me: { name: 'x' }, companies: comps }); ok(({}).polluted === undefined && ({}).polluted2 === undefined, '★ __proto__ 가 담긴 저장 문서를 읽어도 객체 기본 속성이 오염되지 않음');

console.log('── 왕복(저장 → 개정 초안 → 다시 저장)');
const r2 = buildEstimate(rev, { estimates: [saved], companies: comps, now: 2, me: { uid: 'u1' } });
ok(r2.ok === true && JSON.stringify(r2.payload.items[0].calc) === JSON.stringify(r.payload.items[0].calc), '★ 저장 → 개정 → 다시 저장해도 산식 표가 한 글자도 달라지지 않음');
ok(r2.rev === 2 && r2.voidPatch && r2.voidPatch.id === 'e1', '개정 규칙(r2 발행·원본 폐기)은 기존 그대로');
const edited = JSON.parse(JSON.stringify(rev)); const hasRows = !!(edited.items[0].calc && edited.items[0].calc.rows && edited.items[0].calc.rows[1]); if (hasRows) edited.items[0].calc.rows[1].qty = '25';
const r3 = buildEstimate(edited, { estimates: [saved], companies: comps, now: 3, me: { uid: 'u1' } }); const c3 = r3.ok && r3.payload.items[0].calc, c1 = r.payload.items[0].calc; ok(hasRows && !!c3 && !!c1 && c3.rows[1].qty === '25' && c1.rows[1].qty === '20', '개정에서 고친 값은 개정본에만 반영되고 원본 문서의 산식은 그대로');
ok(itemAmt(r2.payload.items[0]) === 6160, '합계 계산(itemAmt)은 산식 표와 무관하게 저장된 금액을 씀');

ok(pass + fail >= 18, '★ 시험 전체가 끝까지 실행됨(' + (pass + fail) + '건 ≥ 18) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
