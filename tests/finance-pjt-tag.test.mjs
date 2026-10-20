// 재무회계 "프로젝트 표시" 대기 목록 계산 시험 — 가짜 데이터만 쓴다(이 저장소는 공개이므로 실제 금액·거래처·직원 이름을 시험에 넣지 않는다).
// 계산 함수: app/modules/finance/pjt-tag-logic.js (순수 함수, Firestore 를 읽지 않음). 서버 규칙(비공개 저장소 functions/ledger-pjt-tags.js)과 같은 대상 판정을 쓴다.
import { taggableReason, buildPendingRows, groupByMonth, monthPreview, confirmItems, pairKey, autoProposeAfterImport, splitDraft, splitLeftText } from '../app/modules/finance/pjt-tag-logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const E = (id, date, memo, lines, extra) => Object.assign({ id, no: id.toUpperCase(), date, memo, lines, source: { kind: 'manual' } }, extra || {});
const ln = (account, side, amount, partner) => ({ account, side, amount, partner: partner || '' });

console.log('── 대상 줄 판정(서버와 같은 규칙)');
ok(taggableReason(ln('4010', 'C', 100)) === null && taggableReason(ln('4010', 'D', 100)) === null && taggableReason(ln('4090', 'C', 5)) === null, '매출 4xxx 는 대변·차변 모두 대상(마이너스 수정세금계산서는 차변)');
ok(['5010', '5210', '5320', '5340', '5370'].every((a) => taggableReason(ln(a, 'D', 100)) === null) && ['5010', '5210', '5320', '5340', '5370'].every((a) => taggableReason(ln(a, 'C', 100)) !== null), '직접원가 5010·5210·5320·5340·5370 은 차변만 대상(대변은 아님)');
ok(['5110', '5350', '5360', '5380', '1100', '2040', '6010', '9999'].every((a) => taggableReason(ln(a, 'D', 100)) !== null) && taggableReason(null) !== null && taggableReason(undefined) !== null, '공수 배분 5110·5350·회사 공통비 5360·5380·자산·부채·판관비·없는 줄은 대상이 아님');

console.log('── 대기 목록 만들기');
const entries = [
  E('e1', '2026-07-31', '매출 가짜회사 · 2026년 07월 용역비', [ln('1100', 'D', 1000, '가짜회사'), ln('4010', 'C', 1000, '가짜회사')]),
  E('e2', '2026-07-31', '매입 가짜외주', [ln('5210', 'D', 500, '가짜외주'), ln('2020', 'C', 500, '가짜외주')]),
  E('e3', '2026-07-31', '차량', [ln('5360', 'D', 70), ln('2020', 'C', 70)]),
  E('e4', '2026-08-01', '역분개', [ln('5210', 'C', 500, '가짜외주'), ln('2020', 'D', 500, '가짜외주')], { reverses: 'e2' }),
  E('e5', '2026-08-02', '매입 확정된 건', [ln('5210', 'D', 300, '가짜외주'), ln('2020', 'C', 300)]),
];
const props = { 'e1_1': { entryId: 'e1', lineIdx: 1, method: '공수비율', splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }], status: 'proposed', basisMonth: '2026-07', warn: '' }, 'e2_0': { entryId: 'e2', lineIdx: 0, method: '수동', splits: [], status: 'proposed', note: '2026-08 공수 없음', basisMonth: '2026-08', warn: '' } };
const tags = { 'e5_0': { entryId: 'e5', lineIdx: 0, status: 'confirmed', splits: [{ pjt: 'pA', amount: 300 }], method: '직접' } };
const rows = buildPendingRows(entries, props, tags);
ok(rows.length === 2 && eq(rows.map((r) => r.id).sort(), ['e1_1', 'e2_0']), '★ 대상 줄 중 확정 태그가 없는 줄만 — 대상 아닌 줄(5360·1100·2020)·역분개 전표·이미 확정된 줄은 빠짐');
const r1 = rows.find((r) => r.id === 'e1_1'), r2 = rows.find((r) => r.id === 'e2_0');
ok(r1.entryId === 'e1' && r1.lineIdx === 1 && r1.amount === 1000 && r1.side === 'C' && r1.account === '4010' && r1.date === '2026-07-31' && r1.no === 'E1' && r1.partner === '가짜회사', '줄 정보(전표·줄번호·금액·차대·계정·일자·거래처)가 전표에서 옴');
ok(r1.method === '공수비율' && eq(r1.splits, [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }]) && r1.hasProposal === true && r1.confirmable === true, '제안이 있고 분할이 있으면 확정할 수 있음(confirmable)');
ok(r2.method === '수동' && r2.splits.length === 0 && r2.hasProposal === true && r2.confirmable === false && /공수/.test(r2.note), '"수동" 제안(공수 없음)은 확정할 수 없고 이유를 보여 줌');
const noProp = buildPendingRows([E('e9', '2026-09-10', '매입 어딘가', [ln('5340', 'D', 40, '어딘가'), ln('2020', 'C', 40)])], {}, {});
ok(noProp.length === 1 && noProp[0].hasProposal === false && noProp[0].confirmable === false && noProp[0].method === '' && noProp[0].splits.length === 0, '제안이 없는 대상 줄도 대기 목록에 나옴(사람이 직접 지정) — 확정은 불가');
ok(buildPendingRows([E('x', '2026-07-31', 'm', [ln('4010', 'C', 100, 'p')])], {}, { x_0: { status: 'cleared', splits: [] } }).length === 1, '해제(cleared)된 태그는 확정이 아니므로 다시 대기 목록에 나옴');
ok(buildPendingRows([E('x', '2026-07-31', 'm', [ln('4010', 'C', 100, 'p')])], { x_0: { entryId: 'x', lineIdx: 0, method: '제외', splits: [], status: 'proposed', note: '정산 차액' } }, {})[0].confirmable === true, '"제외" 제안은 분할이 없어도 확정할 수 있음(프로젝트에 붙이지 않는다는 결정)');
ok(buildPendingRows([E('rv', '2026-08-03', '역분개된 매출', [ln('4010', 'D', 800, 'p'), ln('1100', 'C', 800, 'p')], { reverses: 'e1' })], {}, {}).length === 0, '★ 역분개 전표 안의 대상 줄(차변 매출)도 대기 목록에서 빠짐 — 원 전표의 지정이 기준');
ok(buildPendingRows([E('cm', '2026-08-03', '차량', [ln('5360', 'D', 70), ln('5380', 'D', 30), ln('5110', 'D', 5), ln('5350', 'D', 6)])], {}, {}).length === 0, '★ 회사 공통비 5360·5380 과 공수 배분 5110·5350 은 대기 목록에 나오지 않음');
ok(taggableReason(ln('5360', 'D', 1)).includes('공통') && taggableReason(ln('5380', 'D', 1)).includes('공통') && taggableReason(ln('5110', 'D', 1)).includes('공수'), '대상이 아닌 이유 문구가 계정 종류에 맞음(공통비 vs 공수 배분)');
ok(buildPendingRows([E('mm', '2026-08-03', 'm', [ln('5210', 'D', 9, 'p')])], { mm_0: { entryId: 'mm', lineIdx: 0, method: '수동', splits: [{ pjt: 'pA', amount: 9 }], status: 'proposed' } }, {})[0].confirmable === false, '★ 방식이 "수동"이면 분할이 들어 있어도 확정 불가(사람이 직접 정해야 하는 제안)');
ok(buildPendingRows([E('nn', '2026-08-03', 'm', [ln('5210', 'D', 9, 'p')])], { nn_0: { entryId: 'nn', lineIdx: 0, method: '직접', splits: [], status: 'proposed' } }, {})[0].confirmable === false, '★ 방식이 "직접"인데 분할이 비었으면 확정 불가');
ok(buildPendingRows(null, null, null).length === 0 && buildPendingRows([], {}, {}).length === 0, '빈 입력·null 은 빈 목록(오류 없음)');

console.log('── 월 묶음');
const g = groupByMonth(rows);
ok(eq(g.map((x) => x.month), ['2026-07', '2026-08']) && g[0].rows.length === 1 && g[1].rows.length === 1, '★ 제안의 기준월(basisMonth)로 묶음 — 같은 전표 일자(7/31)라도 기준월이 다르면 다른 달');
const g2 = groupByMonth(noProp);
ok(eq(g2.map((x) => x.month), ['2026-09']), '제안이 없으면 전표 일자의 달로 묶음(메모를 읽지 않음 — 서버와 규칙이 두 벌이 되지 않게)');
ok(g[0].confirmableCount === 1 && g[1].confirmableCount === 0 && g[0].count === 1, '달마다 전체 줄 수와 확정 가능한 줄 수를 알려 줌');
ok(eq(groupByMonth(rows).map((x) => x.month), groupByMonth(rows.slice().reverse()).map((x) => x.month)), '입력 순서와 무관하게 달 순서가 같음(오름차순)');

console.log('── 월 미리보기(확정하면 프로젝트별 순액)');
const pv = monthPreview([{ side: 'C', amount: 1000, account: '4010', splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }] }, { side: 'D', amount: 200, account: '4010', splits: [{ pjt: 'pA', amount: 200 }] }, { side: 'D', amount: 500, account: '5210', splits: [{ pjt: 'pA', amount: 300 }, { pjt: 'pB', amount: 200 }] }]);
ok(pv.revenue.pA === 400 && pv.revenue.pB === 400 && pv.revenueTotal === 800, '★ 매출 순액 = 대변 − 차변(마이너스 수정세금계산서가 원본을 상쇄)');
ok(pv.cost.pA === 300 && pv.cost.pB === 200 && pv.costTotal === 500, '직접원가는 프로젝트별 합');
ok(eq(monthPreview([]).revenue, {}) && monthPreview([]).revenueTotal === 0 && monthPreview([{ side: 'C', amount: 5, account: '4010', splits: [] }]).revenueTotal === 0, '분할이 없는 줄(제외·수동)은 미리보기 합에 넣지 않음, 빈 입력은 0');
const sumPv = monthPreview([{ side: 'C', amount: 1200, account: '4010', splits: [{ pjt: 'a', amount: 700 }, { pjt: 'b', amount: 300 }, { pjt: 'c', amount: 200 }] }, { side: 'D', amount: 1200, account: '4010', splits: [{ pjt: 'a', amount: 700 }, { pjt: 'b', amount: 300 }, { pjt: 'c', amount: 200 }] }, { side: 'C', amount: 1100, account: '4010', splits: [{ pjt: 'a', amount: 650 }, { pjt: 'b', amount: 280 }, { pjt: 'c', amount: 170 }] }]);
ok(sumPv.revenueTotal === 1100 && sumPv.revenue.a === 650 && sumPv.revenue.b === 280 && sumPv.revenue.c === 170, '★ 수정세금계산서 원본(+)·마이너스(−)·재발행(+) 세 줄이 같이 있으면 순액이 재발행 금액과 같음');

console.log('── 같이 확정할 묶음(수정세금계산서)');
const k = (memo, acct) => pairKey({ memo, account: acct });
ok(k('매출 가짜 · 25년 3월 용역비', '4010') === k('매출 가짜 · 25년 3월 용역비 (수정)', '4010') && k('매출 가짜 · 25년 3월 용역비', '4010') !== k('매출 가짜 · 25년 4월 용역비', '4010') && k('매출 가짜 · 25년 3월 용역비', '4010') !== k('매출 가짜 · 25년 3월 용역비', '4090'), '★ "(수정)" 표시를 뺀 메모와 계정이 같으면 같은 묶음, 다른 달·다른 계정은 다른 묶음');
const grp = buildPendingRows([E('a', '2026-08-01', '매출 가짜 · 26년 7월 용역비', [ln('4010', 'C', 100, 'p')]), E('b', '2026-08-01', '매출 가짜 · 26년 7월 용역비 (수정)', [ln('4010', 'D', 100, 'p')]), E('c', '2026-08-01', '매출 가짜 · 26년 7월 용역비 (수정)', [ln('4010', 'C', 90, 'p')]), E('d', '2026-08-01', '매출 다른 · 26년 7월 용역비', [ln('4010', 'C', 5, 'q')])], {}, {});
ok(grp.filter((r) => r.pair === grp[0].pair).length === 3 && grp.find((r) => r.entryId === 'd').pair !== grp[0].pair, '대기 줄마다 묶음 표시(pair)가 붙어 같은 묶음 줄을 알 수 있음');

console.log('── 확정 요청 만들기(서버 pjtTagBatch 형식)');
const conf = confirmItems([{ id: 'e1_1', entryId: 'e1', lineIdx: 1, method: '공수비율', splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }], note: '', basisMonth: '2026-07', confirmable: true }, { id: 'e2_0', entryId: 'e2', lineIdx: 0, method: '수동', splits: [], confirmable: false }, { id: 'e3_0', entryId: 'e3', lineIdx: 0, method: '제외', splits: [], note: '정산 차액', confirmable: true }]);
ok(conf.length === 2 && eq(conf.map((c) => c.entryId), ['e1', 'e3']), '확정할 수 없는 줄(수동·제안 없음)은 요청에 넣지 않음');
ok(eq(conf[0], { entryId: 'e1', lineIdx: 1, method: '공수비율', splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }], note: '', basis: { month: '2026-07', note: '대기 목록에서 확정' } }), '요청 한 건의 모양이 서버 pjtTagBatch 가 받는 항목과 같음(필요한 필드만)');
ok(eq(conf[1].splits, []) && conf[1].method === '제외' && conf[1].note === '정산 차액', '"제외"는 분할 없이 방식과 이유만 보냄');
ok(confirmItems([]).length === 0 && confirmItems(null).length === 0, '빈 입력은 빈 요청');
const big = confirmItems(Array.from({ length: 250 }, (_, i) => ({ id: 'x' + i, entryId: 'x' + i, lineIdx: 0, method: '직접', splits: [{ pjt: 'p', amount: 1 }], confirmable: true })));
ok(big.length === 250, '요청 목록은 자르지 않음(100건씩 나누는 일은 data.js 가 함)');

// ── 가져오기 직후 자동 제안 — 새 전표가 저장됐을 때만 서버 pjtProposeNew 를 한 번 부르고, 실패해도 가져오기 결과를 막지 않는다(결정 2026-10-20 "ㅇㅇ" = 자동)
const mkCall = (resp, spy) => async (payload) => { spy.push(JSON.parse(JSON.stringify(payload))); if (resp instanceof Error) throw resp; return resp; };
const run = async (resp, posted) => { const spy = []; const r = await autoProposeAfterImport(mkCall(resp, spy), posted); return { r, spy }; };
{ const { r, spy } = await run({ ok: true, created: 4, skippedExisting: 0 }, 6);
  ok(spy.length === 1 && eq(spy[0], { action: 'pjtProposeNew', dryRun: false }), '★ 새 전표가 저장됐으면(posted 6) 서버에 pjtProposeNew 를 정확히 한 번(dryRun false) 요청 (실제: ' + JSON.stringify(spy) + ')');
  ok(r.created === 4 && /4건/.test(r.note) && /프로젝트 표시/.test(r.note), '★ 만든 제안이 있으면 안내 문구에 "프로젝트 표시 … 4건"이 들어간다 (실제: ' + r.note + ')'); }
{ const { r, spy } = await run({ ok: true, created: 4 }, 0); ok(spy.length === 0 && r.note === '' && r.created === 0, '★ 새로 저장된 전표가 없으면(posted 0) 서버를 부르지 않고 안내도 없다'); }
for (const bad of [undefined, null, -1, NaN, '3', {}]) { const { r, spy } = await run({ ok: true, created: 1 }, bad); ok(spy.length === 0 && r.note === '', '★ posted 가 숫자가 아니거나 0 이하(' + String(bad) + ')이면 서버를 부르지 않는다'); }
{ const { r } = await run({ ok: true, created: 0, skippedExisting: 5 }, 3); ok(r.note === '' && r.created === 0, '만들 제안이 없으면(created 0) 굳이 알리지 않는다'); }
{ const { r, spy } = await run(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }), 2);
  ok(spy.length === 1 && r.created === 0 && typeof r.note === 'string' && /제안/.test(r.note) && /다시|나중|프로젝트 표시/.test(r.note), '★ 서버가 실패해도 던지지 않고(가져오기 결과는 그대로) 짧은 안내만 남긴다 (실제: ' + r.note + ')'); }
for (const [nm, bad] of [['null', null], ['undefined', undefined], ['ok 없음', { created: 3 }], ['created 문자열', { ok: true, created: '3' }], ['created 음수', { ok: true, created: -2 }], ['created NaN', { ok: true, created: NaN }], ['빈 객체', {}]]) { const { r } = await run(bad, 2); ok(r && r.created === 0 && !/NaN|undefined|-2/.test(r.note), '★ 서버 응답이 이상해도(' + nm + ') 던지지 않고 숫자를 지어내지 않는다 (created ' + (r && r.created) + ')'); }
{ const { spy } = await run({ ok: true, created: 1 }, 1000000); ok(spy.length === 1, '저장 건수가 아무리 많아도 호출은 한 번이다(건별 호출 금지)'); }
{ const { r } = await run({ ok: true, created: 7 }, 7); ok(!/원|₩|거래처/.test(r.note), '안내 문구에 금액·거래처가 없다(건수만)'); }
// ── 줄 직접 지정 입력 검사(서버 cleanSplits 와 같은 규칙을 앱에서 먼저 알려 준다): splitDraft(줄 금액, [{ pjt, amount(입력 글자) }]) → { ok, splits, method, remaining, error }
const sd = (amt, rows) => splitDraft(amt, rows);
{ const r = sd(1000000, [{ pjt: 'a', amount: '1,000,000' }]); ok(r.ok && eq(r.splits, [{ pjt: 'a', amount: 1000000 }]) && r.method === '직접' && r.remaining === 0, '★ 한 칸에 전액(쉼표 입력)이면 통과·방식은 "직접"·남은 금액 0'); }
{ const r = sd(1000000, [{ pjt: 'a', amount: '600000' }, { pjt: 'b', amount: ' 400,000 ' }]); ok(r.ok && eq(r.splits, [{ pjt: 'a', amount: 600000 }, { pjt: 'b', amount: 400000 }]) && r.method === '수동', '★ 두 칸의 합이 줄 금액이면 통과·방식은 "수동"(여러 프로젝트로 나눔)·공백·쉼표 정리'); }
{ const r = sd(1000000, [{ pjt: 'a', amount: '600000' }, { pjt: 'b', amount: '300000' }]); ok(!r.ok && r.remaining === 100000 && /100,000/.test(r.error), '★ 합이 모자라면 거절·남은 금액이 정확히 100,000(양수)이고 문구에 보인다 (실제: ' + r.remaining + ' · ' + r.error + ')'); }
{ const r = sd(1000000, [{ pjt: 'a', amount: '700000' }, { pjt: 'b', amount: '400000' }]); ok(!r.ok && r.remaining === -100000 && /100,000/.test(r.error), '★ 합이 넘치면 거절·남은 금액이 −100,000(음수)이고 문구에 보인다'); }
for (const [nm, rows] of [['프로젝트 미선택', [{ pjt: '', amount: '1000000' }]], ['같은 프로젝트 두 번', [{ pjt: 'a', amount: '500000' }, { pjt: 'a', amount: '500000' }]], ['금액 0', [{ pjt: 'a', amount: '0' }, { pjt: 'b', amount: '1000000' }]], ['금액 음수', [{ pjt: 'a', amount: '-500' }, { pjt: 'b', amount: '1000500' }]], ['금액 소수', [{ pjt: 'a', amount: '1000000.5' }]], ['금액 빈칸', [{ pjt: 'a', amount: '' }]], ['금액 글자', [{ pjt: 'a', amount: '백만' }]], ['금액 NaN 문자열', [{ pjt: 'a', amount: 'NaN' }]], ['빈 목록', []], ['목록이 아님', null]]) { const r = sd(1000000, rows); ok(!r.ok && typeof r.error === 'string' && r.error.length > 0 && eq(r.splits, []), '★ ' + nm + ' → 거절·이유 문구 있음·splits 비어 있음 (실제 ok=' + r.ok + ')'); }
{ const many = Array.from({ length: 13 }, (_, i) => ({ pjt: 'p' + i, amount: '1' })); const r = sd(13, many); ok(!r.ok && /12/.test(r.error), '★ 13칸이면 거절(한 줄은 최대 12개 프로젝트) — 문구에 12'); const r12 = sd(12, many.slice(0, 12)); ok(r12.ok && r12.splits.length === 12, '12칸은 통과'); }
{ const r = sd(1000000, [{ pjt: 'a', amount: '1000000' }]); ok(r.splits.every((x) => Number.isInteger(x.amount) && x.amount > 0), '결과 금액은 모두 양의 정수'); }
{ const r = sd(0, [{ pjt: 'a', amount: '0' }]); ok(!r.ok, '줄 금액이 0 이하이면 지정할 수 없다'); const r2 = sd(-5, [{ pjt: 'a', amount: '5' }]); ok(!r2.ok, '줄 금액이 음수여도 거절(줄 금액은 항상 양수 — 화면의 − 는 표시일 뿐)'); }
{ const r = sd(1000000, [{ pjt: 'a', amount: '1000000' }, { pjt: '', amount: '' }]); ok(r.ok && r.splits.length === 1, '★ 칸을 추가만 하고 비워 둔 줄(프로젝트·금액 둘 다 빈 칸)은 무시한다'); const r2 = sd(1000000, [{ pjt: 'a', amount: '1000000' }, { pjt: 'b', amount: '' }]); ok(!r2.ok, '프로젝트만 고르고 금액을 비운 칸은 거절(실수 방지)'); }
{ const r = sd(1000000, [{ pjt: ' a ', amount: '1000000' }]); ok(r.ok && r.splits[0].pjt === 'a', '프로젝트 id 앞뒤 공백은 정리'); }
// ── 남은 금액 문구(패널 처음 그릴 때와 입력 중 갱신이 같은 함수를 쓴다): splitLeftText(줄 금액, 칸들)
{ const L = splitLeftText; ok(L(1000, []) === '남은 금액 1,000원' && L(1000, [{ pjt: 'a', amount: '' }]) === '남은 금액 1,000원', '★ 아무것도 안 채웠으면 남은 금액은 줄 금액 그대로');
  ok(L(1000, [{ pjt: 'a', amount: '600' }, { pjt: 'b', amount: '400' }]) === '남은 금액 0원', '★ 합이 맞으면 남은 금액 0원');
  ok(L(1000, [{ pjt: 'a', amount: '300' }]) === '남은 금액 700원' && L(1000, [{ pjt: 'a', amount: ' 1, 000 ' }]) === '남은 금액 0원', '★ 일부만 채우면 남은 금액을 센다(쉼표·공백 정리)');
  ok(L(1000, [{ pjt: 'a', amount: '1200' }]) === '200원 넘침', '★ 합이 넘치면 "N원 넘침"(음수 표기 아님)');
  ok(L(1000, [{ pjt: 'a', amount: '글자' }, { pjt: 'b', amount: '-5' }, { pjt: 'c', amount: '1.5' }, { pjt: 'd', amount: 'NaN' }]) === '남은 금액 1,000원', '★ 숫자가 아닌 칸(글자·음수·소수·NaN)은 0으로 세고 NaN·undefined 글자가 나오지 않는다');
  ok(L(1000, null) === '남은 금액 1,000원' && L(1000, undefined) === '남은 금액 1,000원', '칸 목록이 없어도 던지지 않는다');
  ok(L(-1000, [{ pjt: 'a', amount: '300' }]) === '남은 금액 700원', '줄 금액이 음수로 들어와도 절댓값 기준으로 센다(방어)'); }
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
