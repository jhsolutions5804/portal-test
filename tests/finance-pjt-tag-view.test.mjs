// 재무회계 "프로젝트 표시" 대기 목록 화면(HTML 문자열) 시험 — 가짜 데이터만 쓴다(공개 저장소). 화면 함수: app/modules/finance/view.js 의 pjtTagHtml
import { pjtTagHtml } from '../app/modules/finance/view.js';
import { buildPendingRows, groupByMonth, monthPreview } from '../app/modules/finance/pjt-tag-logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const has = (h, s) => h.includes(s); const count = (h, re) => (h.match(re) || []).length;
const E = (id, date, memo, lines) => ({ id, no: id.toUpperCase(), date, memo, lines, source: { kind: 'manual' } });
const ln = (account, side, amount, partner) => ({ account, side, amount, partner: partner || '' });
const entries = [
  E('e1', '2026-07-31', '매출 가짜회사 · 2026년 07월 용역비', [ln('1100', 'D', 1000, '가짜회사'), ln('4010', 'C', 1000, '가짜회사')]),
  E('e2', '2026-07-31', '매입 가짜외주', [ln('5210', 'D', 500, '가짜외주'), ln('2020', 'C', 500)]),
  E('e3', '2026-08-02', '매출 가짜회사 · 2026년 08월 용역비', [ln('1100', 'D', 900, '가짜회사'), ln('4010', 'C', 900, '가짜회사')]),
  E('e4', '2026-08-02', '매출 가짜회사 · 2026년 08월 용역비 (수정)', [ln('1100', 'C', 900, '가짜회사'), ln('4010', 'D', 900, '가짜회사')]),
];
const proposals = {
  e1_1: { entryId: 'e1', lineIdx: 1, method: '공수비율', splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }], status: 'proposed', basisMonth: '2026-07', warn: '' },
  e2_0: { entryId: 'e2', lineIdx: 0, method: '수동', splits: [], status: 'proposed', note: '2026-07 공수 없음 — 직접 지정해 주세요', basisMonth: '2026-07', warn: '' },
  e3_1: { entryId: 'e3', lineIdx: 1, method: '공수비율', splits: [{ pjt: 'pA', amount: 900 }], status: 'proposed', basisMonth: '2026-08', warn: '2026-08 공수 합 8이 다른 달보다 크게 적습니다' },
  e4_1: { entryId: 'e4', lineIdx: 1, method: '공수비율', splits: [{ pjt: 'pA', amount: 900 }], status: 'proposed', basisMonth: '2026-08', warn: '' },
};
const names = { pA: '가짜 프로젝트 A', pB: '가짜 프로젝트 B' };
const base = () => { const rows = buildPendingRows(entries, proposals, {}); return { rows, months: groupByMonth(rows), names, busy: false, msg: '', open: {}, sel: {} }; };
const html = pjtTagHtml(base());

console.log('── 구조');
ok(has(html, 'jh-fin__pjttag') && count(html, /<section class="jh-card"/g) >= 2, '달마다 카드(section.jh-card)가 하나씩 — 2개월 데이터에서 카드 2개 이상');
ok(html.indexOf('2026-07') !== -1 && html.indexOf('2026-08') !== -1 && html.indexOf('2026-07') < html.indexOf('2026-08'), '달이 오름차순으로 나옴');
ok(has(html, '대기 4줄') && has(html, '확정할 수 있는 3줄'), '★ 맨 위에 대기 줄 수(4)와 확정할 수 있는 줄 수(3)를 정확히 보여 줌');
console.log('── 줄');
ok(has(html, 'E1') && has(html, '가짜회사') && has(html, '1,000'), '전표번호·거래처·금액이 보임(금액은 천 단위 쉼표)');
ok(has(html, '가짜 프로젝트 A') && has(html, '가짜 프로젝트 B') && has(html, '60%') && has(html, '40%'), '★ 분할 칩에 프로젝트 이름과 비율이 보임(프로젝트 id 가 아니라 이름)');
ok(has(html, '−900') || has(html, '-900'), '마이너스(차변) 매출은 음수로 표시');
const rowBlocks = html.split('<div class="jh-fin__ptrow').slice(1); const row2 = rowBlocks.find((b) => b.includes('data-pt-row="e2_0"')) || '';
ok(row2.length > 0 && has(row2, 'disabled') && has(row2, '공수 없음'), '★ 확정할 수 없는 "수동" 줄은 체크박스가 비활성이고 이유가 보임');
ok(count(html, /<input type="checkbox"[^>]*data-pt-row/g) === 4 && count(html, /data-pt-row[^>]*disabled/g) + count(html, /disabled[^>]*data-pt-row/g) === 1, '체크박스 4개 중 확정 불가 1개만 비활성');
ok(has(html, '공수 합 8이 다른 달보다 크게 적습니다'), '★ 공수 불완전 달의 경고(warn)가 줄 옆에 보임');
ok(has(html, 'jh-fin__pair') && count(html, /data-pt-pair="/g) >= 2, '수정세금계산서 묶음(같은 메모, 수정 제외)이 표시되고 묶음 키가 붙음');
console.log('── 달 미리보기와 확정 버튼');
const preview = monthPreview(base().months[1].rows);
ok(preview.revenueTotal === 0 && has(html, '미리보기') && has(html, 'data-pt-confirm-month="2026-08"') && has(html, 'data-pt-confirm-month="2026-07"'), '달마다 "이 달 전부 확정" 버튼과 미리보기');
ok(has(html, 'data-pt-confirm-sel') && has(html, '선택한 줄 확정'), '"선택한 줄 확정" 버튼');
const jul = html.slice(html.indexOf('data-pt-month="2026-07"'), html.indexOf('data-pt-month="2026-08"'));
ok(has(jul, '600') && has(jul, '400') && has(jul, '1,000'), '2026-07 미리보기에 프로젝트별 매출 순액(600·400)과 합계(1,000)가 계산 모듈 값대로 나옴');
const aug = html.slice(html.indexOf('data-pt-month="2026-08"'));
ok(/매출 순액<\/?[^>]*>\s*[^<]*0원|매출 순액[^<]*0/.test(aug) || has(aug, 'data-pt-net="0"'), '★ 2026-08 은 원본(+900)과 마이너스(−900)가 같이 있어 매출 순액이 정확히 0 으로 상쇄돼 보임(data-pt-net 값으로 확인)');
console.log('── 안전');
const evilRows = buildPendingRows([E('x1', '2026-07-31', '<img src=x onerror=alert(1)> 매출', [ln('4010', 'C', 5, '"><script>alert(2)</script>')])], { x1_0: { entryId: 'x1', lineIdx: 0, method: '직접', splits: [{ pjt: 'pZ', amount: 5 }], status: 'proposed', basisMonth: '2026-07' } }, {});
const evil = pjtTagHtml({ rows: evilRows, months: groupByMonth(evilRows), names: { pZ: '<b>이름</b>' }, busy: false, msg: '', open: {}, sel: {} });
ok(!has(evil, '<img src=x') && !has(evil, '<script>alert') && !has(evil, '<b>이름</b>') && has(evil, '&lt;img') , '★ 메모·거래처·프로젝트 이름의 HTML 은 이스케이프됨(주입 불가)');
console.log('── 빈 상태·진행 중');
const empty = pjtTagHtml({ rows: [], months: [], names: {}, busy: false, msg: '', open: {}, sel: {} });
ok(has(empty, '대기 중인 줄이 없습니다') && !has(empty, 'data-pt-confirm-month'), '대기 줄이 없으면 안내만 보이고 확정 버튼은 없음');
const btnTags = (h) => (h.match(/<button[^>]*data-pt-confirm-(?:month|sel)[^>]*>/g) || []);
const busy = pjtTagHtml(Object.assign(base(), { busy: true }));
ok(has(busy, 'aria-busy="true"') && btnTags(busy).length === 3 && btnTags(busy).every((t) => /\sdisabled/.test(t)), '★ 처리 중에는 확정 버튼 3개(달 2 + 선택 1)가 모두 disabled — 중복 확정 방지');
ok(btnTags(html).length === 3 && btnTags(html).filter((t) => /\sdisabled/.test(t)).length === 0, '평소에는 확정 버튼이 비활성이 아님(확정 가능한 줄이 있는 달)');
const onlyManualRows = buildPendingRows([E('m1', '2026-09-05', '매입 가짜', [ln('5210', 'D', 70, '가짜외주'), ln('2020', 'C', 70)])], { m1_0: { entryId: 'm1', lineIdx: 0, method: '수동', splits: [], status: 'proposed', note: '2026-09 공수 없음', basisMonth: '2026-09' } }, {});
const manual = pjtTagHtml({ rows: onlyManualRows, months: groupByMonth(onlyManualRows), names, busy: false, msg: '', open: {}, sel: {} });
ok(btnTags(manual).filter((t) => has(t, 'data-pt-confirm-month')).every((t) => /\sdisabled/.test(t)) && has(manual, '확정 가능 0줄'), '★ 확정할 수 있는 줄이 하나도 없는 달(수동 줄만)은 "이 달 전부 확정" 버튼이 비활성');

const withMsg = pjtTagHtml(Object.assign(base(), { msg: '3줄을 확정했습니다.' })); ok(has(withMsg, '3줄을 확정했습니다.') && has(withMsg, 'role="status"'), '처리 결과 메시지가 role=status 로 보임');
const noProj = pjtTagHtml(Object.assign(base(), { names: {} })); ok(has(noProj, 'pA') && has(noProj, 'pB'), '프로젝트 이름을 못 읽었으면 id 로라도 표시(칩이 비지 않음)');

console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
