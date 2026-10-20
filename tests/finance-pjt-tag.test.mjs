// 재무회계 "프로젝트 표시" 대기 목록 계산 시험 — 가짜 데이터만 쓴다(이 저장소는 공개이므로 실제 금액·거래처·직원 이름을 시험에 넣지 않는다).
// 계산 함수: app/modules/finance/pjt-tag-logic.js (순수 함수, Firestore 를 읽지 않음). 서버 규칙(비공개 저장소 functions/ledger-pjt-tags.js)과 같은 대상 판정을 쓴다.
import { taggableReason, buildPendingRows, groupByMonth, monthPreview, confirmItems, pairKey, autoProposeAfterImport, splitDraft, splitLeftText, buildConfirmedRows, ruleDraft, RULE_ACCOUNTS } from '../app/modules/finance/pjt-tag-logic.js';
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
// ── 확정된 줄 목록(수정·해제용): buildConfirmedRows(전표들, 태그들) — 확정 태그가 있는 줄만, 최신 달부터 달별로 묶는다(대기 줄 계산과 반대 방향)
const CE = (id, no, date, memo, lines, extra) => Object.assign({ id, no, date, memo, lines }, extra || {});
const cl = (account, side, amount, partner) => ({ account, side, amount, partner: partner || '' });
const cEntries = [
  CE('c1', '2026-0001', '2026-07-31', '매출 가짜회사 · 7월 용역비', [cl('1100', 'D', 1000, '가짜회사'), cl('4010', 'C', 1000, '가짜회사')]),
  CE('c2', '2026-0002', '2026-08-31', '매입 가짜외주', [cl('5210', 'D', 500, '가짜외주'), cl('2020', 'C', 500, '')]),
  CE('c3', '2026-0003', '2026-08-15', '매입 가짜소모품', [cl('5340', 'D', 40, '가짜소모품'), cl('2020', 'C', 40, '')]),
  CE('c4', '2026-0004', '2026-09-02', '매출 취소', [cl('1100', 'C', 900, '가짜회사'), cl('4010', 'D', 900, '가짜회사')], { reverses: 'c1' }),
  CE('c5', '2026-0005', '2026-09-05', '급여', [cl('5110', 'D', 300, ''), cl('1010', 'C', 300, '')]),
];
const cTags = {
  c1_1: { status: 'confirmed', entryId: 'c1', lineIdx: 1, splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }], method: '수동', note: '대표님 지정', setByName: '가짜관리자', basis: { month: '2026-07', note: '' } },
  c2_0: { status: 'confirmed', entryId: 'c2', lineIdx: 0, splits: [{ pjt: 'pA', amount: 500 }], method: '직접', note: '', setByName: '가짜관리자', basis: { month: '2026-08' } },
  c3_0: { status: 'cleared', entryId: 'c3', lineIdx: 0, splits: [], method: '', note: '' },
  c4_1: { status: 'confirmed', entryId: 'c4', lineIdx: 1, splits: [{ pjt: 'pA', amount: 900 }], method: '직접' },
  c5_0: { status: 'confirmed', entryId: 'c5', lineIdx: 0, splits: [{ pjt: 'pA', amount: 300 }], method: '직접' },
  zz_0: { status: 'confirmed', entryId: 'zz', lineIdx: 0, splits: [{ pjt: 'pA', amount: 1 }], method: '직접' },
  c1_9: { status: 'confirmed', entryId: 'c1', lineIdx: 9, splits: [{ pjt: 'pA', amount: 1 }], method: '직접' },
};
{ const rows = buildConfirmedRows(cEntries, cTags); const ids = rows.map((r) => r.id).sort();
  ok(eq(ids, ['c1_1', 'c2_0']), '★ 확정 태그가 있는 줄만 나온다 — 해제된 줄(c3_0)·취소 전표 줄(c4_1)·대상이 아닌 계정(c5_0 인건비 배분)·전표가 없는 태그(zz_0)·줄 번호 범위 밖(c1_9)은 제외 (실제: ' + ids.join(',') + ')');
  const r1 = rows.find((r) => r.id === 'c1_1'); ok(r1 && eq(r1.splits, [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }]) && r1.method === '수동' && r1.note === '대표님 지정' && r1.setByName === '가짜관리자' && r1.amount === 1000 && r1.no === '2026-0001' && r1.partner === '가짜회사', '★ 행에 분할·방식·메모·지정한 사람·줄 정보(번호·금액·거래처)가 담긴다');
  ok(r1.entryId === 'c1' && r1.lineIdx === 1, '행에 전표 id·줄 번호가 있어 수정·해제 요청에 그대로 쓸 수 있다'); }
{ const g = buildConfirmedRows(cEntries, cTags, { grouped: true }); ok(Array.isArray(g) && g.length === 2 && eq(g.map((x) => x.month), ['2026-08', '2026-07']) && g[0].rows.length === 1 && g[0].count === 1, '★ 달별로 묶고 최신 달부터 나온다(2026-08 → 2026-07)'); }
{ const t2 = { c1_1: Object.assign({}, cTags.c1_1, { basis: { month: '2026-06' } }) }; const g = buildConfirmedRows(cEntries, t2, { grouped: true }); ok(g.length === 1 && g[0].month === '2026-06', '★ 태그에 기준월(basis.month)이 있으면 전표 일자가 아니라 그 달로 묶는다(7월 31일 전표를 6월분으로)');
  const t3 = { c1_1: Object.assign({}, cTags.c1_1, { basis: undefined }) }; const g3 = buildConfirmedRows(cEntries, t3, { grouped: true }); ok(g3.length === 1 && g3[0].month === '2026-07', '기준월이 없으면 전표 일자의 달'); }
{ for (const [nm, e, t] of [['전표 없음', null, cTags], ['태그 없음', cEntries, null], ['둘 다 없음', undefined, undefined], ['빈 값', [], {}], ['전표 안의 null', [null, cEntries[0]], { c1_1: cTags.c1_1 }], ['태그 값이 null', cEntries, { c1_1: null }], ['lines 없는 전표', [{ id: 'x', no: 'X' }], { x_0: { status: 'confirmed' } }]]) { let r; try { r = buildConfirmedRows(e, t); } catch (er) { r = 'THROW ' + er.message; } ok(Array.isArray(r) && r.every((x) => x && x.id), '★ 입력이 이상해도(' + nm + ') 던지지 않고 배열을 돌려준다'); } }
{ for (const bad of ['2026-6', 'abc', '', 202607, null, {}, '2026-07-31']) { const t = { c1_1: Object.assign({}, cTags.c1_1, { basis: { month: bad } }) }; const g = buildConfirmedRows(cEntries, t, { grouped: true }); ok(g.length === 1 && g[0].month === '2026-07', '★ 기준월이 깨진 값(' + JSON.stringify(bad) + ')이면 무시하고 전표 일자의 달(2026-07)로 묶는다 — 쓰레기 달이 생기지 않음 (실제 ' + (g[0] && g[0].month) + ')'); } }
{ const tg = JSON.parse(JSON.stringify(cTags)); const rows = buildConfirmedRows(cEntries, tg); rows.find((r) => r.id === 'c1_1').splits[0].amount = 999999; rows.find((r) => r.id === 'c1_1').splits.push({ pjt: 'zz', amount: 1 }); ok(tg.c1_1.splits.length === 2 && tg.c1_1.splits[0].amount === 600, '★ 돌려준 행의 분할을 고쳐도 입력 태그는 변하지 않는다(참조를 공유하지 않음)'); }
{ const same = [CE('s1', '2026-0010', '2026-08-20', 'b', [cl('5210', 'D', 1, 'b')]), CE('s2', '2026-0011', '2026-08-10', 'a', [cl('5210', 'D', 1, 'a')])]; const r = buildConfirmedRows(same, { s1_0: { status: 'confirmed', splits: [{ pjt: 'pA', amount: 1 }] }, s2_0: { status: 'confirmed', splits: [{ pjt: 'pA', amount: 1 }] } }, { grouped: true }); ok(r[0].rows.map((x) => x.id).join() === 's2_0,s1_0', '같은 달 안에서는 일자 오름차순(8/10 → 8/20)'); }
// ── 거래처 규칙 입력 검사(서버 pjtRuleSave 와 같은 규칙을 앱에서 먼저 알려 준다): ruleDraft({ partner, accounts, mode, pjt, note, active }) → { ok, rule, error }
const RD = (o) => ruleDraft(Object.assign({ partner: '가짜외주', accounts: ['5210'], mode: 'single', pjt: 'pA', note: '', active: true }, o || {}));
{ const r = RD(); ok(r.ok && eq(r.rule, { partner: '가짜외주', accounts: ['5210'], mode: 'single', pjt: 'pA', note: '', active: true }) && r.error === '', '★ 올바른 입력(프로젝트 하나)은 그대로 통과한다');
  ok(eq(RULE_ACCOUNTS, ['4010', '5010', '5210', '5320', '5340', '5370']), '★ 고를 수 있는 계정은 서버 허용 목록(4010·5010·5210·5320·5340·5370)과 같다 — 공수 배분 5110·5350, 회사 공통비 5360·5380 은 없다');
  ok(RD({ partner: ' 가짜 외주\n' }).rule.partner === '가짜외주', '★ 거래처 이름은 안의 공백·줄바꿈까지 지운다(공백만 다른 이름이 두 규칙이 되지 않게 — 서버 cleanPartner 와 같음)');
  for (const [nm, v] of [['빈 값', ''], ['공백만', '   '], ['한 글자', '가'], ['41글자', '가'.repeat(41)], ['글자 아님', null], ['숫자', 12]]) { const r = RD({ partner: v }); ok(!r.ok && /거래처/.test(r.error) && r.rule === null, '★ 거래처가 ' + nm + ' 이면 거절·이유에 "거래처" (실제 ' + r.error + ')'); }
  ok(RD({ partner: '가나' }).ok && RD({ partner: '가'.repeat(40) }).ok, '2글자와 40글자는 통과(경계값)');
  for (const [nm, v] of [['빈 목록', []], ['목록 아님', '5210'], ['없음', undefined], ['null', null]]) { const r = RD({ accounts: v }); ok(!r.ok && /계정/.test(r.error), '★ 계정이 ' + nm + ' 이면 거절·이유에 "계정"'); }
  for (const bad of ['5110', '5350', '5360', '5380', '1100', '9999', '']) { const r = RD({ accounts: ['5210', bad] }); ok(!r.ok && /계정/.test(r.error) && (bad === '' || r.error.includes(bad)), '★ 허용 밖 계정(' + JSON.stringify(bad) + ')이 하나라도 있으면 거절하고 이유에 그 계정 번호가 보인다'); }
  ok(eq(RD({ accounts: ['5340', '5210', '5340', 5210] }).rule.accounts, ['5210', '5340']), '★ 계정은 중복을 없애고(숫자 5210 도 글자와 같게) 정렬한다');
  for (const bad of ['', 'both', 'SINGLE', null, undefined, 1]) { const r = RD({ mode: bad }); ok(!r.ok && /방식/.test(r.error), '★ 방식이 ' + JSON.stringify(bad) + ' 이면 거절·이유에 "방식"'); }
  { const r = RD({ mode: 'single', pjt: '' }); ok(!r.ok && /프로젝트/.test(r.error), '★ "프로젝트 하나" 방식인데 프로젝트가 없으면 거절'); const r2 = RD({ mode: 'single', pjt: '   ' }); ok(!r2.ok, '프로젝트가 공백뿐이어도 거절'); }
  { const r = RD({ mode: 'manday', pjt: 'pA' }); ok(r.ok && r.rule.mode === 'manday' && r.rule.pjt === '', '★ "공수 비율" 방식은 프로젝트를 비워서 저장한다(고른 프로젝트가 남아 있어도 — 서버도 manday 일 때 프로젝트를 저장하지 않음)'); }
  ok(RD({ pjt: ' pA ' }).rule.pjt === 'pA', '프로젝트 id 앞뒤 공백은 정리');
  ok(RD({ note: '가'.repeat(300) }).rule.note.length === 200 && RD({ note: '  메모  ' }).rule.note === '메모' && RD({ note: null }).rule.note === '', '메모는 앞뒤 공백을 지우고 200자까지만, 글자가 아니면 빈 값');
  ok(RD({ active: undefined }).rule.active === true && RD({ active: false }).rule.active === false && RD({ active: 0 }).rule.active === true, '활성은 명시적으로 false 일 때만 꺼진다(서버와 같음)');
  for (const bad of [null, undefined, 'x', 3, []]) { let r; try { r = ruleDraft(bad); } catch (e) { r = { threw: e.message }; } ok(r && r.ok === false && !r.threw && typeof r.error === 'string', '★ 입력 자체가 이상해도(' + JSON.stringify(bad) + ') 던지지 않고 거절한다'); } }
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
