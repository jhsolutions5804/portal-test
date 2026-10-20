// 재무회계 "프로젝트 표시" 대기 목록 화면(HTML 문자열) 시험 — 가짜 데이터만 쓴다(공개 저장소). 화면 함수: app/modules/finance/view.js 의 pjtTagHtml
import { pjtTagHtml, pjtSplitDialogHtml, pjtRuleDialogHtml } from '../app/modules/finance/view.js';
import { readFileSync, readdirSync } from 'node:fs';
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
console.log('── 스타일 클래스');
const cssAll = readdirSync(new URL('../app/theme/', import.meta.url)).filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL('../app/theme/' + f, import.meta.url), 'utf8')).join('\n');
const usedCls = [...new Set((html + pjtTagHtml(Object.assign(base(), { busy: true, msg: 'x' }))).match(/class="[^"]+"/g).flatMap((c) => c.slice(7, -1).split(/\s+/)))].filter((c) => c.startsWith('jh-'));
const undef = usedCls.filter((c) => !cssAll.includes('.' + c));
ok(usedCls.length >= 15 && undef.length === 0, '★ 화면이 쓰는 jh- 클래스 ' + usedCls.length + '개가 전부 스타일 파일에 정의됨(정의 안 된 이름 ' + JSON.stringify(undef) + ' — jh-btn--primary 처럼 효과 없는 이름 방지)');
ok(count(html, /data-variant="primary"/g) === 1 && count(html, /data-pt-confirm-month[^>]*>/g) === count(html, /data-variant="secondary" data-pt-confirm-month/g), '★ 주 버튼은 화면에 하나(선택한 줄 확정), 달마다 있는 "이 달 전부 확정"은 보조 버튼');
console.log('── 선택 바(맨 위 고정)');
const iBar = html.indexOf('data-pt-bar'), iFirst = html.indexOf('data-pt-month=');
ok(iBar !== -1 && iBar < iFirst, '★ 선택 바가 달 카드보다 위(맨 위)에 있음 — 긴 목록 맨 아래에 숨어 있지 않음');
const barHtml = iBar === -1 ? '' : html.slice(iBar, iFirst);
ok(has(barHtml, 'data-pt-confirm-sel') && has(barHtml, '선택한 줄 확정') && has(barHtml, 'data-pt-clear'), '★ "선택한 줄 확정"과 "선택 해제" 버튼이 선택 바 안에 있음');
ok(count(html, /data-pt-confirm-sel/g) === 1, '"선택한 줄 확정" 버튼은 한 곳에만(맨 아래 중복 없음)');
ok(has(barHtml, 'data-pt-selcount') && has(barHtml, '선택 0줄'), '아무것도 고르지 않으면 "선택 0줄"');
const sel2 = pjtTagHtml(Object.assign(base(), { sel: { e1_1: true, e3_1: true } })); ok(has(sel2.slice(sel2.indexOf('data-pt-bar'), sel2.indexOf('data-pt-month=')), '선택 2줄'), '고른 줄 수가 선택 바에 보임(2줄)');
const selStale = pjtTagHtml(Object.assign(base(), { sel: { zzz_9: true } })); ok(has(selStale.slice(selStale.indexOf('data-pt-bar'), selStale.indexOf('data-pt-month=')), '선택 0줄'), '목록에 없는 줄의 선택 기록은 세지 않음(확정되어 사라진 줄)');
const busyBar = pjtTagHtml(Object.assign(base(), { busy: true })); const bb = busyBar.slice(busyBar.indexOf('data-pt-bar'), busyBar.indexOf('data-pt-month=')); const bbBtns = bb.match(/<button[^>]*>/g) || []; ok(bbBtns.length === 2 && bbBtns.every((t) => /\sdisabled/.test(t)), '★ 처리 중에는 선택 바의 버튼 2개(선택 해제·선택한 줄 확정)가 모두 비활성 — 버튼이 0개여도 참이 되는 빈 목록 함정 방지');
console.log('── 안전');
const evilRows = buildPendingRows([E('x1', '2026-07-31', '<img src=x onerror=alert(1)> 매출', [ln('4010', 'C', 5, '"><script>alert(2)</script>')])], { x1_0: { entryId: 'x1', lineIdx: 0, method: '직접', splits: [{ pjt: 'pZ', amount: 5 }], status: 'proposed', basisMonth: '2026-07' } }, {});
const evil = pjtTagHtml({ rows: evilRows, months: groupByMonth(evilRows), names: { pZ: '<b>이름</b>' }, busy: false, msg: '', open: {}, sel: {} });
ok(!has(evil, '<img src=x') && !has(evil, '<script>alert') && !has(evil, '<b>이름</b>') && has(evil, '&lt;img') , '★ 메모·거래처·프로젝트 이름의 HTML 은 이스케이프됨(주입 불가)');
console.log('── 빈 상태·진행 중');
const empty = pjtTagHtml({ rows: [], months: [], names: {}, busy: false, msg: '', open: {}, sel: {} });
ok(has(empty, '대기 중인 줄이 없습니다') && !has(empty, 'data-pt-confirm-month'), '대기 줄이 없으면 안내만 보이고 확정 버튼은 없음');
ok(!has(empty, 'data-pt-bar'), '대기 줄이 없으면 선택 바도 없음');
const btnTags = (h) => (h.match(/<button[^>]*data-pt-confirm-(?:month|sel)[^>]*>/g) || []);
const busy = pjtTagHtml(Object.assign(base(), { busy: true }));
ok(has(busy, 'aria-busy="true"') && btnTags(busy).length === 3 && btnTags(busy).every((t) => /\sdisabled/.test(t)), '★ 처리 중에는 확정 버튼 3개(달 2 + 선택 1)가 모두 disabled — 중복 확정 방지');
ok(btnTags(html).length === 3 && btnTags(html).filter((t) => /\sdisabled/.test(t)).length === 0, '평소에는 확정 버튼이 비활성이 아님(확정 가능한 줄이 있는 달)');
const onlyManualRows = buildPendingRows([E('m1', '2026-09-05', '매입 가짜', [ln('5210', 'D', 70, '가짜외주'), ln('2020', 'C', 70)])], { m1_0: { entryId: 'm1', lineIdx: 0, method: '수동', splits: [], status: 'proposed', note: '2026-09 공수 없음', basisMonth: '2026-09' } }, {});
const manual = pjtTagHtml({ rows: onlyManualRows, months: groupByMonth(onlyManualRows), names, busy: false, msg: '', open: {}, sel: {} });
ok(btnTags(manual).filter((t) => has(t, 'data-pt-confirm-month')).every((t) => /\sdisabled/.test(t)) && has(manual, '확정 가능 0줄'), '★ 확정할 수 있는 줄이 하나도 없는 달(수동 줄만)은 "이 달 전부 확정" 버튼이 비활성');

const withMsg = pjtTagHtml(Object.assign(base(), { msg: '3줄을 확정했습니다.' })); ok(has(withMsg, '3줄을 확정했습니다.') && has(withMsg, 'role="status"'), '처리 결과 메시지가 role=status 로 보임');
const noProj = pjtTagHtml(Object.assign(base(), { names: {} })); ok(has(noProj, 'pA') && has(noProj, 'pB'), '프로젝트 이름을 못 읽었으면 id 로라도 표시(칩이 비지 않음)');

console.log('── 이 달 전체 선택 버튼');
const pickBtns = (h) => (h.match(/<button[^>]*data-pt-pick-month[^>]*>/g) || []); const isDis = (t) => /\sdisabled/.test(t);
ok(pickBtns(html).length === 2 && has(html, 'data-pt-pick-month="2026-07"') && has(html, 'data-pt-pick-month="2026-08"') && has(html, '이 달 전체 선택'), '★ 달 카드마다 "이 달 전체 선택" 버튼이 하나씩(2개월 → 2개)');
ok(pickBtns(html).every((t) => !isDis(t)), '확정할 줄이 있는 달의 버튼은 눌림');
ok(pickBtns(manual).length === 1 && isDis(pickBtns(manual)[0]), '★ 확정할 수 있는 줄이 하나도 없는 달(수동 줄만)의 "이 달 전체 선택"은 비활성');
ok(pickBtns(busy).length === 2 && pickBtns(busy).every(isDis), '처리 중에는 "이 달 전체 선택"도 비활성');
ok(count(html, /data-variant="primary"/g) === 1 && pickBtns(html).length === 2 && pickBtns(html).every((t) => !has(t, 'data-variant')), '★ 주 버튼은 여전히 하나("선택한 줄 확정"), 이 달 전체 선택 버튼 2개는 기본 버튼 — 버튼이 없어도 참이 되는 빈 목록 함정 방지');
console.log('── 줄 직접 지정: 버튼과 패널 화면');
const editBtns = (h) => h.match(/<button[^>]*data-pt-edit="[^"]*"[^>]*>.*?<\/button>/g) || [];
const hEdit = pjtTagHtml(base()); const nRows = count(hEdit, /data-pt-row="/g);
ok(editBtns(hEdit).length === nRows && nRows > 0 && new Set(editBtns(hEdit).map((b) => b.match(/data-pt-edit="([^"]*)"/)[1])).size === nRows, '★ 대기 줄마다 "직접 지정" 버튼이 정확히 한 개씩(서로 다른 줄 id) — 줄 ' + nRows + '개 · 버튼 ' + editBtns(hEdit).length + '개');
ok(editBtns(hEdit).every((b) => /직접 지정/.test(b)), '버튼 글자가 "직접 지정"');
ok(editBtns(hEdit).every((b) => !/data-variant="primary"/.test(b)) && count(hEdit, /data-variant="primary"/g) === 1, '★ 새 버튼은 기본 버튼이라 주 버튼(선택한 줄 확정)은 여전히 하나 — 위계 유지');
const hBusy = pjtTagHtml(Object.assign(base(), { busy: true })); ok(editBtns(hBusy).length === nRows && editBtns(hBusy).every((b) => /\sdisabled/.test(b)), '★ 처리 중에는 직접 지정 버튼도 모두 비활성(개수도 확인 — 빈 목록 함정 방지)');
{ const h = pjtTagHtml(base()); const noProp = h.match(/<div class="jh-fin__ptrow[^>]*>(?:(?!<div class="jh-fin__ptrow).)*제안 없음(?:(?!<div class="jh-fin__ptrow).)*/s); ok(!noProp || /data-pt-edit=/.test(noProp[0]), '★ "제안 없음 — 직접 지정 필요" 줄에도 직접 지정 버튼이 있다(이 기능이 필요한 바로 그 줄)'); }
const ROW = { id: 'e1_1', entryId: 'e1', lineIdx: 1, no: 'E1', date: '2026-07-31', partner: '가짜회사', memo: '매출 가짜회사', account: '4010', side: 'C', amount: 1000000, splits: [{ pjt: 'pA', amount: 600000 }, { pjt: 'pB', amount: 400000 }], method: '공수비율', hasProposal: true };
const NAMES = { pA: '가짜 프로젝트 A', pB: '가짜 프로젝트 B', pC: '가짜 프로젝트 C' };
const dlg = pjtSplitDialogHtml(ROW, NAMES);
ok(has(dlg, 'E1') && has(dlg, '2026-07-31') && has(dlg, '가짜회사') && has(dlg, '1,000,000'), '★ 패널에 줄 정보(번호·일자·거래처·금액 1,000,000원)가 보인다');
const sels = dlg.match(/<select[^>]*data-sp-pjt[^>]*>.*?<\/select>/gs) || [];
ok(sels.length === 2, '★ 제안이 두 칸(A·B)이면 프로젝트 칸이 두 개로 채워져 열린다 (실제 ' + sels.length + ')');
ok(sels.every((x) => has(x, '>가짜 프로젝트 A<') && has(x, '>가짜 프로젝트 B<') && has(x, '>가짜 프로젝트 C<') && has(x, 'value="pA"') && has(x, 'value="pC"')), '★ 선택지는 프로젝트 이름으로 보이고 값은 id(pA·pB·pC) — 모든 칸에 같은 목록');
ok(has(sels[0], 'value="pA" selected') && has(sels[1], 'value="pB" selected'), '★ 제안의 프로젝트(A·B)가 각 칸에 미리 선택돼 있다');
const amts = dlg.match(/data-sp-amt[^>]*value="([^"]*)"/g) || []; ok(amts.length === 2 && /value="600,000"/.test(amts[0]) && /value="400,000"/.test(amts[1]), '★ 금액 칸도 제안 금액(600,000·400,000, 쉼표 서식)으로 채워져 있다 (실제 ' + amts.join(' ') + ')');
ok(has(dlg, 'data-sp-left') && has(dlg, 'data-sp-add') && has(dlg, 'data-sp-note'), '★ 남은 금액 표시 칸·칸 추가 버튼·메모 칸이 있다');
const dEmpty = pjtSplitDialogHtml(Object.assign({}, ROW, { splits: [], hasProposal: false }), NAMES); ok((dEmpty.match(/data-sp-pjt/g) || []).length === 1 && !/value="pA" selected/.test(dEmpty) && /value=""/.test(dEmpty), '★ 제안이 없으면 빈 칸 하나로 열린다(미선택·금액 비어 있음)');
const dMine = pjtSplitDialogHtml(ROW, NAMES, [{ pjt: 'pC', amount: '1000000' }]); ok((dMine.match(/data-sp-pjt/g) || []).length === 1 && has(dMine, 'value="pC" selected'), '입력 중이던 칸(draft)이 있으면 제안보다 그것을 그대로 그린다(다시 그려도 입력이 사라지지 않음)');
const evilDlg = pjtSplitDialogHtml(Object.assign({}, ROW, { partner: '<img src=x onerror=1>', memo: '"><script>1</script>' }), { pA: '<b>굵게</b>' });
ok(!has(evilDlg, '<img src=x') && !has(evilDlg, '<script>1') && !has(evilDlg, '<b>굵게</b>') && has(evilDlg, '&lt;'), '★ 거래처·메모·프로젝트 이름의 태그는 이스케이프된다(주입 방지)');
const dUnknown = pjtSplitDialogHtml(Object.assign({}, ROW, { splits: [{ pjt: 'zzz_unknown', amount: 1000000 }] }), NAMES); ok(has(dUnknown, 'zzz_unknown'), '프로젝트 목록에 없는 id(이미 지워진 프로젝트)도 칸에서 사라지지 않고 표시된다(몰래 바뀌지 않게)');
ok(!has(dlg, 'NaN') && !has(dlg, 'undefined') && !has(dlg, 'null'), '패널 어디에도 NaN·undefined·null 글자가 없다');
const dSide = pjtSplitDialogHtml(Object.assign({}, ROW, { side: 'D', account: '4010' }), NAMES); ok(has(dSide, '1,000,000') && !has(dSide, '-1,000,000'), '매출 차변(수정세금계산서 마이너스) 줄도 금액은 양수로 보여 준다(부호는 줄 목록의 − 표시)');
{ const allDlg = dlg + dEmpty + dMine + dUnknown; const usedDlg = [...new Set((allDlg.match(/class="[^"]+"/g) || []).flatMap((c) => c.slice(7, -1).split(/\s+/)))].filter((c) => c.startsWith('jh-')); const undefDlg = usedDlg.filter((c) => !new RegExp('\\.' + c.replace(/[-_]/g, (m) => '\\' + m) + '(?![\\w-])').test(cssAll));
  ok(usedDlg.length >= 8 && undefDlg.length === 0, '★ 패널이 쓰는 jh- 클래스 ' + usedDlg.length + '개가 전부 스타일 파일에 정의됨(정의 안 된 이름 ' + JSON.stringify(undefDlg) + ') — 개수도 확인해 빈 목록이 우연히 통과하지 않게'); }
{ const dNeg = pjtSplitDialogHtml(Object.assign({}, ROW, { amount: -1000000, splits: [] }), NAMES); ok(has(dNeg, '줄 금액 1,000,000원') && !has(dNeg, '-1,000,000') && !has(dNeg, '−1,000,000') && has(dNeg, 'data-sp-total="1000000"') && has(dNeg, '남은 금액 1,000,000원'), '★ 줄 금액이 음수로 들어와도(방어) 화면과 합계 기준(data-sp-total)은 양수 1,000,000 — 음수 금액에서 입력 검사가 모든 분할을 거절하는 일 방지'); }
{ const lf = (h) => { const m = h.match(/data-sp-left[^>]*>([^<]*)</); return m ? m[1] : ''; }; const row1000 = Object.assign({}, ROW, { amount: 1000 });
  ok(lf(pjtSplitDialogHtml(Object.assign({}, row1000, { splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }] }), NAMES)) === '남은 금액 0원', '★ 제안이 채워져(600+400=1,000) 열리면 남은 금액은 0원이다 — 채워진 칸의 합을 반영(전에는 1,000원으로 보여 실제 앱에서 발견) (실제: ' + lf(pjtSplitDialogHtml(Object.assign({}, row1000, { splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }] }), NAMES)) + ')');
  ok(lf(pjtSplitDialogHtml(row1000, NAMES, [{ pjt: 'pA', amount: '300' }])) === '남은 금액 700원', '★ 일부만 채운 칸(300)이면 남은 금액 700원');
  ok(lf(pjtSplitDialogHtml(row1000, NAMES, [{ pjt: 'pA', amount: '1,200' }])) === '200원 넘침', '★ 합이 줄 금액을 넘으면 "200원 넘침"(음수 표기 아님)');
  ok(lf(pjtSplitDialogHtml(Object.assign({}, row1000, { splits: [], hasProposal: false }), NAMES)) === '남은 금액 1,000원', '빈 칸이면 남은 금액은 줄 금액 그대로(1,000원)');
  ok(lf(pjtSplitDialogHtml(row1000, NAMES, [{ pjt: 'pA', amount: '글자' }, { pjt: 'pB', amount: '' }])) === '남은 금액 1,000원', '금액 칸에 숫자가 아닌 글자가 있어도 NaN 없이 그 칸은 0으로 센다'); }
console.log('── 확정된 줄(수정·해제) 구역');
const DONE = [{ month: '2026-08', count: 1, rows: [{ id: 'd2_0', entryId: 'd2', lineIdx: 0, no: '2026-0002', date: '2026-08-31', memo: '매입 가짜외주', account: '5210', side: 'D', amount: 500, partner: '가짜외주', splits: [{ pjt: 'pA', amount: 500 }], method: '직접', note: '', setByName: '가짜관리자', month: '2026-08' }] },
  { month: '2026-07', count: 2, rows: [{ id: 'd1_1', entryId: 'd1', lineIdx: 1, no: '2026-0001', date: '2026-07-31', memo: '매출 가짜회사', account: '4010', side: 'C', amount: 1000, partner: '가짜회사', splits: [{ pjt: 'pA', amount: 600 }, { pjt: 'pB', amount: 400 }], method: '수동', note: '대표님 지정', setByName: '가짜관리자', month: '2026-07' }, { id: 'd3_0', entryId: 'd3', lineIdx: 0, no: '2026-0003', date: '2026-07-20', memo: '매입', account: '5340', side: 'D', amount: 40, partner: '', splits: [{ pjt: 'pB', amount: 40 }], method: '직접', note: '', setByName: '', month: '2026-07' }] }];
const dsec = (h) => { const i = h.indexOf('data-pt-done'); return i < 0 ? '' : h.slice(i); };
const hClosed = pjtTagHtml(Object.assign(base(), { doneGroups: DONE, doneOpen: false }));
ok(has(hClosed, 'data-pt-done-toggle') && has(dsec(hClosed), '확정된 줄 3줄'), '★ 확정 구역이 있고 토글에 확정된 줄 수(3줄)가 보인다');
ok(!has(hClosed, 'data-pt-redo') && !has(hClosed, 'data-pt-undo') && !has(hClosed, '가짜외주 · 가짜 프로젝트 A'), '★ 처음에는 접혀 있어 줄·수정·해제 버튼이 없다');
const hOpen = pjtTagHtml(Object.assign(base(), { doneGroups: DONE, doneOpen: true }));
const redoB = hOpen.match(/<button[^>]*data-pt-redo="[^"]*"[^>]*>.*?<\/button>/g) || [], undoB = hOpen.match(/<button[^>]*data-pt-undo="[^"]*"[^>]*>.*?<\/button>/g) || [];
ok(redoB.length === 3 && undoB.length === 3 && new Set(redoB.map((b) => b.match(/data-pt-redo="([^"]*)"/)[1])).size === 3, '★ 펼치면 줄마다 [수정]·[해제] 버튼이 정확히 한 개씩(3줄 → 3 + 3, 서로 다른 줄 id)');
ok(redoB.every((b) => /수정/.test(b)) && undoB.every((b) => /해제/.test(b)), '버튼 글자는 "수정"·"해제"');
ok(dsec(hOpen).indexOf('2026-08') < dsec(hOpen).indexOf('2026-07'), '★ 달은 최신 달부터(2026-08 → 2026-07)');
ok(has(dsec(hOpen), '가짜 프로젝트 A') && has(dsec(hOpen), '60%') && has(dsec(hOpen), '가짜 프로젝트 B') && has(dsec(hOpen), '40%'), '★ 줄마다 프로젝트 이름과 비율 칩이 보인다(A 60%·B 40%)');
ok(has(dsec(hOpen), '대표님 지정') && has(dsec(hOpen), '가짜관리자'), '메모와 지정한 사람이 보인다');
const hBusyD = pjtTagHtml(Object.assign(base(), { doneGroups: DONE, doneOpen: true, busy: true })); const bb2 = (hBusyD.match(/<button[^>]*data-pt-(?:redo|undo)="[^"]*"[^>]*>/g) || []);
ok(bb2.length === 6 && bb2.every((b) => /\sdisabled/.test(b)), '★ 처리 중에는 수정·해제 버튼 6개가 모두 비활성(개수 확인 — 빈 목록 함정 방지) (' + bb2.length + '개)');
ok(has(dsec(hOpen), '마진율') && has(dsec(hOpen), '기록'), '★ 안내문: 수정·해제하면 마진율 등에 영향이 있고 이전 지정은 기록에 남는다고 알린다');
const noPending = pjtTagHtml({ rows: [], months: [], names, busy: false, msg: '', open: {}, sel: {}, doneGroups: DONE, doneOpen: true });
ok(has(noPending, '대기 중인 줄이 없습니다') && has(noPending, 'data-pt-redo'), '★ 대기 줄이 0줄이어도 확정된 줄 구역은 나온다(빈 목록에서 일찍 끝나는 함정)');
ok(!has(pjtTagHtml(Object.assign(base(), { doneGroups: [], doneOpen: true })), 'data-pt-done') && !has(pjtTagHtml(base()), 'data-pt-done'), '★ 확정된 줄이 하나도 없으면(빈 목록·상태 없음) 구역 자체를 그리지 않는다');
const evilD = pjtTagHtml(Object.assign(base(), { doneOpen: true, doneGroups: [{ month: '2026-07', count: 1, rows: [Object.assign({}, DONE[1].rows[0], { memo: '<img src=x onerror=1>', partner: '<b>거래처</b>', note: '"><script>1</script>', setByName: '<i>x</i>', splits: [{ pjt: 'pZ', amount: 1000 }] })] }] }));
ok(!has(evilD, '<img src=x') && !has(evilD, '<b>거래처</b>') && !has(evilD, '<script>1') && !has(evilD, '<i>x</i>') && has(dsec(evilD), '&lt;'), '★ 확정 줄의 메모·거래처·비고·지정한 사람 태그는 이스케이프된다');
ok(count(hOpen, /data-variant="primary"/g) === 1, '★ 주 버튼(선택한 줄 확정)은 여전히 하나 — 새 버튼은 기본 버튼이라 위계 유지');
ok(has(hOpen, 'aria-expanded="true"') && has(hClosed, 'aria-expanded="false"'), '토글은 펼침 상태를 aria-expanded 로 알린다');
ok(!has(hOpen, 'NaN') && !has(hOpen, 'undefined'), '화면 어디에도 NaN·undefined 글자가 없다');
{ const usedD = [...new Set((dsec(hOpen).match(/class="[^"]+"/g) || []).flatMap((c) => c.slice(7, -1).split(/\s+/)))].filter((c) => c.startsWith('jh-')); const undefD = usedD.filter((c) => !new RegExp('\\.' + c.replace(/[-_]/g, (m) => '\\' + m) + '(?![\\w-])').test(cssAll));
  ok(usedD.length >= 6 && undefD.length === 0, '★ 확정 구역(data-pt-done 이후)이 쓰는 jh- 클래스 ' + usedD.length + '개가 전부 스타일에 정의됨(정의 안 된 이름 ' + JSON.stringify(undefD) + ') — 구역 안만 검사하고 개수도 확인해 구역이 없을 때 우연히 통과하지 않게'); }
console.log('── 거래처 규칙 구역');
const RULES = [{ id: 'rule__가짜외주', partner: '가짜외주', accounts: ['5210'], mode: 'single', pjt: 'pA', active: true, note: '대표님 지정', setByName: '가짜관리자' },
  { id: 'rule__가짜회사', partner: '가짜회사', accounts: ['4010'], mode: 'manday', pjt: '', active: true, note: '' },
  { id: 'rule__가짜', partner: '가짜', accounts: ['4010', '5340'], mode: 'single', pjt: 'pB', active: false, note: '' }];
const WARN = [{ partners: ['가짜회사', '가짜'], accounts: ['4010'] }];
const rs = (o) => Object.assign(base(), { ruleOpen: true, ruleState: 'ok', rules: RULES, ruleWarnings: WARN }, o || {});
const rsec = (h) => { const i = h.indexOf('data-pt-rules'); return i < 0 ? '' : h.slice(i); };
const rClosed = pjtTagHtml(Object.assign(base(), { ruleOpen: false }));
ok(has(rClosed, 'data-pt-rules-toggle') && has(rsec(rClosed), '거래처 규칙') && has(rClosed, 'aria-expanded="false"'), '★ 거래처 규칙 구역이 있고 처음에는 접혀 있다(토글)');
ok(!has(rClosed, 'data-pt-rule-edit') && !has(rClosed, 'data-pt-rule-add'), '★ 접혀 있으면 규칙 행·[규칙 추가] 버튼이 없다');
ok(has(pjtTagHtml(rs({ ruleState: 'loading', rules: [] })), '불러오는 중') && !has(pjtTagHtml(rs({ ruleState: 'loading', rules: [] })), 'data-pt-rule-edit'), '★ 불러오는 중에는 "불러오는 중"만 보이고 목록·추가 버튼은 없다');
const rErr = pjtTagHtml(rs({ ruleState: 'error', rules: [] })); ok(has(rErr, '불러오지 못했습니다') && has(rErr, 'data-pt-rules-retry') && !has(rErr, '규칙이 없습니다'), '★ 불러오지 못하면 "불러오지 못했습니다"와 [다시 불러오기]가 보이고 "규칙이 없습니다"로 오해되지 않는다');
const rOpen = pjtTagHtml(rs());
const eB = rOpen.match(/<button[^>]*data-pt-rule-edit="[^"]*"[^>]*>.*?<\/button>/g) || [], tB = rOpen.match(/<button[^>]*data-pt-rule-toggle="[^"]*"[^>]*>.*?<\/button>/g) || [];
ok(eB.length === 3 && tB.length === 3 && new Set(eB.map((b) => b.match(/data-pt-rule-edit="([^"]*)"/)[1])).size === 3, '★ 규칙마다 [수정]·[끄기/켜기] 버튼이 정확히 한 개씩(3개 → 3 + 3, 서로 다른 규칙 id)');
ok(has(rsec(rOpen), '가짜외주') && has(rsec(rOpen), '가짜회사') && has(rsec(rOpen), '대표님 지정'), '거래처와 메모가 보인다');
ok(has(rsec(rOpen), '가짜 프로젝트 A') && has(rsec(rOpen), '공수 비율'), '★ 방식 문구: "프로젝트 하나"는 프로젝트 이름(가짜 프로젝트 A), "공수 비율"은 그 달 공수 비율로 보인다');
ok(has(rsec(rOpen), '외주공사비') && has(rsec(rOpen), '공사수입') && has(rsec(rOpen), '안전관리비·현장소모품'), '★ 계정은 코드가 아니라 이름(외주공사비·공사수입·안전관리비·현장소모품)으로 보인다');
ok(tB.filter((b) => /끄기/.test(b)).length === 2 && tB.filter((b) => /켜기/.test(b)).length === 1 && /rule__가짜"/.test(tB.find((b) => /켜기/.test(b))), '★ 켜진 규칙 2개는 [끄기], 꺼진 규칙 1개(가짜)는 [켜기]');
ok(count(rOpen, /jh-fin__rule--off/g) === 1 && /jh-fin__rule--off[^>]*data-pt-rule="rule__가짜"|data-pt-rule="rule__가짜"[^>]*jh-fin__rule--off/.test(rOpen), '★ 꺼진 규칙 1개만 흐리게(--off) 표시된다');
{ const wm = (rsec(rOpen).match(/jh-fin__rulewarn[\s\S]*?<\/div><\/div>/) || [''])[0]; ok(has(wm, '겹침') && has(wm, '가짜회사') && has(wm, '가짜') && has(wm, '공사수입') && has(wm, '이름이 더 긴 규칙이 우선'), '★ 겹침 경고 칸에 두 거래처(가짜회사·가짜)와 공통 계정 이름(공사수입)과 우선순위 안내가 함께 나온다'); }
ok(!has(pjtTagHtml(rs({ ruleWarnings: [] })), 'jh-fin__rulewarn'), '겹침이 없으면 경고 칸이 없다');
const r0 = pjtTagHtml(rs({ rules: [], ruleWarnings: [] })); ok(has(r0, '규칙이 없습니다') && has(r0, 'data-pt-rule-add') && !has(r0, 'data-pt-rule-edit'), '★ 규칙이 0개면 "규칙이 없습니다" 안내와 [규칙 추가]가 보인다');
ok(count(rOpen, /data-pt-rule-add/g) === 1, '★ 규칙이 있어도 [규칙 추가] 버튼은 하나 있다');
const rBusy = pjtTagHtml(rs({ busy: true })); const rb = rBusy.match(/<button[^>]*data-pt-rule-(?:edit|toggle|add)[^>]*>/g) || []; ok(rb.length === 7 && rb.every((b) => /\sdisabled/.test(b)), '★ 처리 중에는 규칙 버튼 7개(수정 3 + 끄기/켜기 3 + 추가 1)가 모두 비활성이다(' + rb.length + '개)');
const rEvil = pjtTagHtml(rs({ rules: [Object.assign({}, RULES[0], { partner: '<img src=x onerror=1>거래처', note: '"><script>1</script>', pjt: 'pZ', setByName: '<i>x</i>' })] })); ok(!has(rEvil, '<img src=x') && !has(rEvil, '<script>1') && !has(rEvil, '<i>x</i>') && has(rsec(rEvil), '&lt;'), '★ 거래처·메모·지정한 사람의 태그는 이스케이프된다');
ok(count(rOpen, /data-variant="primary"/g) === 1, '★ 주 버튼은 여전히 하나(선택한 줄 확정) — 규칙 버튼은 기본 버튼');
ok(!has(rOpen, 'NaN') && !has(rOpen, 'undefined') && !has(rOpen, 'null'), '규칙 구역 어디에도 NaN·undefined·null 글자가 없다');
{ const usedR = [...new Set((rsec(rOpen).match(/class="[^"]+"/g) || []).flatMap((c) => c.slice(7, -1).split(/\s+/)))].filter((c) => c.startsWith('jh-')); const undefR = usedR.filter((c) => !new RegExp('\\.' + c.replace(/[-_]/g, (m) => '\\' + m) + '(?![\\w-])').test(cssAll));
  ok(usedR.length >= 6 && undefR.length === 0, '★ 규칙 구역(data-pt-rules 이후)이 쓰는 jh- 클래스 ' + usedR.length + '개가 전부 스타일에 정의됨(정의 안 된 이름 ' + JSON.stringify(undefR) + ')'); }
console.log('── 거래처 규칙 패널');
const dNew = pjtRuleDialogHtml(null, NAMES), dEdit = pjtRuleDialogHtml(RULES[0], NAMES), dMan = pjtRuleDialogHtml(RULES[1], NAMES);
const dChecks = (h) => h.match(/<input[^>]*data-rd-acc[^>]*>/g) || [];
ok(dChecks(dNew).length === 6 && ['4010', '5010', '5210', '5320', '5340', '5370'].every((c) => dChecks(dNew).some((x) => x.includes('value="' + c + '"'))) && !dChecks(dNew).some((x) => /5110|5350|5360|5380/.test(x)), '★ 계정 체크박스는 허용 6개(4010·5010·5210·5320·5340·5370)뿐이다 — 공수 배분·공통비 계정은 없다');
ok(dChecks(dEdit).filter((x) => /\schecked/.test(x)).length === 1 && /value="5210"[^>]*checked|checked[^>]*value="5210"/.test(dChecks(dEdit).join(' ')), '★ 수정 패널은 현재 규칙의 계정(5210)만 체크돼 있다');
ok(has(dNew, 'data-rd-partner') && !/data-rd-partner[^>]*\sdisabled|disabled[^>]*data-rd-partner/.test(dNew.match(/<input[^>]*data-rd-partner[^>]*>/)[0]), '★ 새 규칙 패널은 거래처 칸이 열려 있다');
ok(/\sdisabled|readonly/.test(dEdit.match(/<input[^>]*data-rd-partner[^>]*>/)[0]) && has(dEdit, '가짜외주'), '★ 수정 패널은 거래처 칸이 잠겨 있다(거래처를 바꾸면 새 규칙이 되어 옛 규칙이 남기 때문)');
const modes = (h) => h.match(/<input[^>]*data-rd-mode[^>]*>/g) || []; ok(modes(dNew).length === 2 && modes(dNew).some((x) => /value="single"[^>]*checked|checked[^>]*value="single"/.test(x)), '★ 방식은 2개(프로젝트 하나·공수 비율)이고 새 규칙은 "프로젝트 하나"가 기본이다');
ok(modes(dMan).some((x) => /value="manday"[^>]*checked|checked[^>]*value="manday"/.test(x)), '"공수 비율" 규칙의 수정 패널은 공수 비율이 선택돼 있다');
const sel = dEdit.match(/<select[^>]*data-rd-pjt[^>]*>[\s\S]*?<\/select>/)[0]; ok(has(sel, 'value="pA" selected') && has(sel, '>가짜 프로젝트 A<') && has(sel, 'value="pB"'), '★ single 규칙의 수정 패널은 프로젝트 선택이 현재 프로젝트(A)로 채워져 있고 목록은 이름으로 보인다');
ok(has(dEdit, 'data-rd-note') && has(dEdit, '대표님 지정') && has(dEdit, 'data-rd-active'), '메모 칸(현재 메모)과 켬/끔 칸이 있다');
ok(has(dMan, 'data-rd-pjtbox') && /data-rd-pjtbox[^>]*(hidden|display:\s*none)/.test(dMan), '★ "공수 비율" 규칙은 프로젝트 선택 칸이 숨겨져 있다(방식이 single 일 때만 보임)');
ok(!/data-rd-pjtbox[^>]*(hidden|display:\s*none)/.test(dEdit), 'single 규칙은 프로젝트 선택 칸이 보인다');
ok(/\[data-rd-pjtbox\]\[hidden\]\s*\{[^}]*display:\s*none/.test(cssAll), '★ 스타일이 hidden 속성을 무력화하지 않는다 — .jh-field 의 display: block 이 브라우저 기본의 숨김을 덮어써 "공수 비율"을 골라도 프로젝트 칸이 계속 보이던 실제 결함(실제 앱 시험이 발견)의 재발 방지');
const dEv = pjtRuleDialogHtml(Object.assign({}, RULES[0], { partner: '<b>이름</b>', note: '"><script>1</script>' }), { pA: '<i>x</i>' }); ok(!has(dEv, '<b>이름</b>') && !has(dEv, '<script>1') && !has(dEv, '<i>x</i>'), '★ 패널의 거래처·메모·프로젝트 이름은 이스케이프된다');
{ const usedP = [...new Set(((dNew + dEdit + dMan).match(/class="[^"]+"/g) || []).flatMap((c) => c.slice(7, -1).split(/\s+/)))].filter((c) => c.startsWith('jh-')); const undefP = usedP.filter((c) => !new RegExp('\\.' + c.replace(/[-_]/g, (m) => '\\' + m) + '(?![\\w-])').test(cssAll)); ok(usedP.length >= 4 && undefP.length === 0, '★ 패널이 쓰는 jh- 클래스 ' + usedP.length + '개가 전부 스타일에 정의됨(정의 안 된 이름 ' + JSON.stringify(undefP) + ')'); }
ok(pass + fail >= 105, '★ 시험 전체가 끝까지 실행됨(실행 ' + (pass + fail) + '건 ≥ 28) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
