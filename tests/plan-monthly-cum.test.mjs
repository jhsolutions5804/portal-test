import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const M = await import('../app/modules/plan/monthly-mgmt.js?v=' + VER);
/* 영업기획 월간 보고서 — 누적 마진율 병기(대기열 1-2-8, 대표님 2026-10-22 "누적 병기"). 실제 테섭에서 월 마진율이 99.7%·100% 와 합계 −193.8% 사이를 오가는 것을 보고 정함 —
 * 원가(지급예정서 발행 월)와 매출(완결 월)의 시점이 어긋나면 한 달 값이 널뛰므로 "그 달까지 누계" 마진율을 같이 보여 준다.
 * 규칙: 누계 완결 = 완결(status done) 청구서 중 완결 시각(doneAt, 한국 시간)의 월이 그 달 이하인 것의 프로젝트 몫(월 마감과 같은 기준) · 누계 원가 = 그 달까지 발행한 지급예정서 + 서버 누계 현장경비 + 서버 누계 자체 직접노무비
 * (원가 달성률의 실제 원가와 같은 정의) · 누적 마진율 = (누계 완결 − 누계 원가) ÷ 누계 완결, 완결이 0 이하이면 null, 원가를 모르면(연결 없음·서버 응답 없음) null. 공개 저장소라 가짜 값만 쓴다. 기대값은 손으로 계산했다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const P1 = { id: 'p1', code: 'A1', name: '현장1', linkPjt: 'r1' }, P2 = { id: 'p2', code: 'A2', name: '연결 없음' }, P4 = { id: 'p4', code: 'A4', name: '적자', linkPjt: 'r4' };
const inv = (o) => Object.assign({ docType: 'invoice', status: 'done', pjtId: 'p1', pjtIds: ['p1'], amount: 0, supply: 0, issueDate: '2026-06-01', doneAt: '' }, o);
const pay = (o) => Object.assign({ docType: 'payment', status: 'active', pjtId: 'p1', pjtIds: ['p1'], amount: 0, supply: 0, issueDate: '2026-06-01' }, o);
const S = [inv({ amount: 8000, supply: 8000, doneAt: '2026-07-20T03:00:00Z' }), inv({ amount: 400, supply: 400, doneAt: '2026-07-31T15:30:00Z' }), inv({ amount: 5000, supply: 5000, doneAt: '2026-08-10T03:00:00Z' }), inv({ amount: 3000, supply: 3000, doneAt: '2026-09-05T03:00:00Z' }),
  inv({ amount: 9999, supply: 9999, status: 'active' }), inv({ amount: 9999, supply: 9999, status: 'active', doneAt: '2026-07-20T03:00:00Z' }), inv({ amount: 700, supply: 700, doneAt: '' }), inv({ amount: 123, supply: 123, status: 'void', doneAt: '2026-07-21T03:00:00Z' }),
  pay({ amount: 2000, supply: 2000, issueDate: '2026-07-05' }), pay({ amount: 1000, supply: 1000, issueDate: '2026-08-12' }), pay({ amount: 500, supply: 500, issueDate: '2026-10-01' }), pay({ amount: 300, supply: 300, status: 'void', issueDate: '2026-07-06' }), pay({ amount: 77, supply: 77, issueDate: undefined }),
  inv({ pjtId: 'p4', pjtIds: ['p4'], amount: 1000, supply: 1000, doneAt: '2026-07-10T03:00:00Z' }), pay({ pjtId: 'p4', pjtIds: ['p4'], amount: 3000, supply: 3000, issueDate: '2026-07-08' }),
  inv({ pjtId: 'p2', pjtIds: ['p2'], amount: 600, supply: 600, doneAt: '2026-07-12T03:00:00Z' })];
const REPC = (ym, rows) => ({ ok: true, upTo: ym, projects: rows, estimated: true, employerRate: 0.1 });
const C07 = REPC('2026-07', [{ pjt: 'r1', overhead: 100, ownLabor: 200, laborWage: 200, laborInsurance: 0 }, { pjt: 'r4', overhead: 0, ownLabor: 0, laborWage: 0, laborInsurance: 0 }]), C08 = REPC('2026-08', [{ pjt: 'r1', overhead: 400, ownLabor: 600, laborWage: 600, laborInsurance: 0 }, { pjt: 'r4', overhead: 0, ownLabor: 0, laborWage: 0, laborInsurance: 0 }]), C06 = REPC('2026-06', [{ pjt: 'r1', overhead: 0, ownLabor: 0, laborWage: 0, laborInsurance: 0 }]);
console.log('── cumRow: 그 달까지 누계 완결·누계 원가·누적 마진율');
{ const r = M.cumRow(P1, S, C07, '2026-07'); eq([r.status, r.collected, r.payIssued, r.direct, r.ownLabor, r.cost, r.margin], ['ok', 8000, 2077, 100, 200, 2377, 70.3], '★ 7월 말: 누계 완결 8,000(8/1 KST 완결 400 은 아직 아님)·지급 발행 2,000+77(발행일 없는 지급예정서는 달 제한 없이 포함 — 원가 달성률과 같은 규칙)·현장경비 100·노무 200 → 원가 2,377 → (8,000−2,377)÷8,000 = 70.29 → 70.3'); }
{ const r = M.cumRow(P1, S, C08, '2026-08'); eq([r.collected, r.payIssued, r.cost, r.margin], [13400, 3077, 4077, 69.6], '★ 8월 말: 누계 완결 8,000+400(KST 8/1 00:30)+5,000 = 13,400·지급 발행 2,000+1,000+77 = 3,077·원가 3,077+400+600 = 4,077 → 9,323÷13,400 = 69.58 → 69.6'); }
{ const r = M.cumRow(P1, S, C08, '2026-09'); eq([r.collected, r.payIssued], [16400, 3077], '9월 말: 누계 완결 16,400(9월 3,000 포함)·지급 발행 3,077(10월 발행분은 아직 아님) — 서버 누계는 8월 응답을 줬으니 원가는 8월 값 그대로(응답이 그 달 것이라는 약속은 호출부 몫)'); }
{ const r = M.cumRow(P1, S, C06, '2026-06'); eq([r.collected, r.payIssued, r.cost, r.margin], [0, 77, 77, null], '★ 6월 말: 완결이 아직 없으면 누적 마진율은 null(0 으로 꾸미지 않음)'); }
eq(M.cumRow(P1, S, C07, '2026-07').collected, 8000, '(점검) 완결 시각이 없는 700·완결이 아닌 9,999(완결 시각이 있는 것과 없는 것 둘 다)·취소된 123 은 빠진다');
{ const r = M.cumRow(P4, S, C07, '2026-07'); eq([r.collected, r.payIssued, r.cost, r.margin], [1000, 3000, 3000, -200], '★ 음수 마진율은 숫자로: (1,000−3,000)÷1,000 = −200.0'); }
{ const r = M.cumRow(P2, S, C07, '2026-07'); eq([r.status, r.collected, r.cost, r.margin, r.direct], ['nolink', 600, null, null, null], '★ 연결 없는 프로젝트: 누계 완결은 그대로(600)이고 원가·누적 마진율은 null(모르는 원가를 0 으로 두지 않음)'); }
for (const [lab, cur] of [['서버 응답 없음(null)', null], ['응답 실패(ok 아님)', { ok: false }]]) { const r = M.cumRow(P1, S, cur, '2026-07'); eq([r.status, r.cost, r.margin, r.collected], ['nocost', null, null, 8000], '★ ' + lab + ': 원가를 모르니 누적 마진율 null(지급 발행만으로 마진을 내면 부풀려진다), 누계 완결은 그대로'); }
{ const r = M.cumRow(P1, S, REPC('2026-07', [{ pjt: 'zzz', overhead: 1, ownLabor: 1, laborWage: 1, laborInsurance: 0 }]), '2026-07'); eq([r.status, r.direct, r.ownLabor, r.cost, r.margin], ['ok', 0, 0, 2077, 74], '★ 서버가 성공했는데 그 프로젝트가 응답에 없으면 현장경비·노무 0(margin-link 규칙: 정말 없는 프로젝트) → 원가는 지급 발행 2,077 뿐 → (8,000−2,077)÷8,000 = 74.04 → 74.0'); }
for (const ym of ['x', '', null, undefined, '2026-13', 3]) { const r = M.cumRow(P1, S, C07, ym); ok(r.margin === null && r.cost === null && !/NaN|Infinity|undefined/.test(JSON.stringify(r)), '월이 이상해도(' + JSON.stringify(ym) + ') 던지지 않고 누적 마진율 null — ' + r.status); }
for (const bad of [null, undefined, 'x', 3, [], {}]) { const r = M.cumRow(bad, S, C07, '2026-07'); ok(r.status === 'nolink' && r.margin === null, '프로젝트가 이상해도(' + JSON.stringify(bad) + ') 던지지 않는다'); }
for (const bad of [null, undefined, 'x', 3, {}, [null, 3, 'x', {}]]) { const r = M.cumRow(P1, bad, C07, '2026-07'); ok(r.collected === 0 && r.margin === null && !/NaN/.test(JSON.stringify(r)), '정산서 목록이 이상해도(' + JSON.stringify(bad) + ') 던지지 않는다'); }
{ const a = JSON.stringify(S), b = JSON.stringify(C07), c = JSON.stringify(P1); M.cumRow(P1, S, C07, '2026-07'); ok(JSON.stringify(S) === a && JSON.stringify(C07) === b && JSON.stringify(P1) === c, '입력을 바꾸지 않는다'); }
{ const odd = [inv({ amount: NaN, doneAt: '2026-07-20T03:00:00Z' }), inv({ amount: 'x', doneAt: '2026-07-20T03:00:00Z' }), inv({ amount: 500, doneAt: { seconds: Date.parse('2026-07-15T03:00:00Z') / 1000 } }), inv({ amount: 70, doneAt: Date.parse('2026-07-16T03:00:00Z') })]; const r = M.cumRow(P1, odd, C07, '2026-07'); ok(Number.isFinite(r.collected) && !/NaN/.test(JSON.stringify(r)), '금액이 NaN·글자여도 합계가 NaN 이 되지 않는다'); eq(M.cumRow(P1, [odd[2], odd[3]], C07, '2026-07').collected, 570, '완결 시각이 Timestamp({seconds})·숫자(ms)여도 월을 알아본다 — 500+70 = 570'); }
console.log('── cumRows: 프로젝트마다 한 행(입력 순서 그대로)');
{ const rows = M.cumRows([P1, P2, P4], S, C07, '2026-07'); eq(rows.map((r) => [r.id, r.status, r.margin]), [['p1', 'ok', 70.3], ['p2', 'nolink', null], ['p4', 'ok', -200]], '★ 프로젝트 3개 → 행 3개(연결 없음 포함), 각자 자기 값 — 행 값이 서로 번지지 않는다'); eq(M.cumRows([P1, null, 3, 'x'], S, C07, '2026-07').length, 1, '이상한 프로젝트는 건너뜀'); for (const v of [null, undefined, 'x', 3, {}]) eq(M.cumRows(v, S, C07, '2026-07'), [], '프로젝트 목록이 이상하면 빈 목록: ' + JSON.stringify(v)); }
console.log('── cumTotals: 합계(원가를 모르는 프로젝트가 있으면 마진율을 비운다)');
{ const t = M.cumTotals(M.cumRows([P1, P4], S, C07, '2026-07')); eq([t.collected, t.cost, t.margin, t.unknown], [9000, 5377, 40.3, 0], '★ p1(8,000·2,377)+p4(1,000·3,000) → 완결 9,000·원가 5,377 → (9,000−5,377)÷9,000 = 40.26 → 40.3'); }
{ const t = M.cumTotals(M.cumRows([P1, P2, P4], S, C07, '2026-07')); eq([t.margin, t.cost, t.unknown], [null, null, 1], '★ 연결 없는 프로젝트가 하나 끼면 합계 누적 마진율·원가를 비운다(그 프로젝트의 완결만 분모에 들어가 마진이 부풀려지지 않게) — unknown 1'); eq(t.collected, 9600, '그래도 누계 완결 합계는 낸다(8,000+1,000+600)'); }
{ const t = M.cumTotals(M.cumRows([P1], S, C06, '2026-06')); eq([t.collected, t.margin], [0, null], '완결 합계가 0 이면 마진율 null'); }
for (const v of [[], null, undefined, 'x', 3, {}, [null, 3]]) { const t = M.cumTotals(v); ok(t.margin === null && t.collected === 0 && !/NaN|Infinity|undefined/.test(JSON.stringify(t)), '합계 입력이 이상해도(' + JSON.stringify(v) + ') 던지지 않고 마진율 null'); }
ok(pass + fail >= 49, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
