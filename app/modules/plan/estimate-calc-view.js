/* 견적 항목 "산식" 표 화면 — 항목 줄 바로 아래에 끼워 넣는 표 행(<tr>) HTML. 계산은 estimate-calc.js, 수식은 formula.js, 연결(열기·행 추가·삭제·입력·항목에 넣기)은 index.js. 시험: tests/estimate-calc-view.test.mjs
 * 입력칸: 표의 셀은 data-ec-c="<열>" data-ec-r="<행 번호>", 아래의 가산율·내림 단위·총 대수는 data-ec-m="<이름>". 모든 값은 esc 로 이스케이프한다.
 * 입력할 때는 요약 영역(calcSummaryHtml)과 해당 행의 합계 표시만 다시 그려 입력 중인 커서가 유지된다. 행 추가·삭제는 표 본문(tableBodyHtml)을 다시 그린다. */
import { esc } from '../../core/ui.js?v=20261031f';
import { won } from './ui.js?v=20261031f';
/** 열 정의 — 번호(자동)·내역·단위·수량·단가·합계·비고 (대표님 지정, 2026-10-19) */
export const COLS = [
  { key: 'no', label: '번호' }, { key: 'name', label: '내역', col: 'A', ph: '예: 구역 A 설치' }, { key: 'unit', label: '단위', col: 'B', ph: '인·일' },
  { key: 'qty', label: '수량', col: 'C', ph: '숫자 또는 =수식', num: true }, { key: 'price', label: '단가', col: 'D', ph: '숫자 또는 =수식', num: true }, { key: 'total', label: '합계', col: 'E', num: true }, { key: 'remark', label: '비고', col: 'F', ph: '' },
];
const fmtN = (v) => (Number.isInteger(v) ? v.toLocaleString('ko-KR') : String(Math.round(v * 100) / 100));
const cell = (r, k, i, v, extra) => '<input class="jh-input' + (k === 'qty' || k === 'price' || k === 'total' ? ' jh-plan__num' : '') + '" data-ec-c="' + k + '" data-ec-r="' + r + '" data-ec-row="' + i + '" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>';
/** 표 본문(행들) — i = 항목 번호, calc = 표, res = calcSheet 결과 */
export function tableBodyHtml(i, calc, res) {
  const rows = (calc && Array.isArray(calc.rows)) ? calc.rows : []; const rr = (res && Array.isArray(res.rows)) ? res.rows : [];
  return rows.map((row, r) => {
    const x = rr[r] || {}; const raw = String((row && row.total) == null ? '' : row.total).trim(); const fixed = raw !== ''; const err = x.ok === false;
    const auto = !fixed && x.ok === true && !x.blank ? ' placeholder="' + esc(fmtN(x.total)) + '"' : '';
    const tot = cell(r, 'total', i, fixed ? row.total : '', ' data-ec-auto="' + (!fixed) + '"' + (fixed ? ' data-ec-fixed="true"' : '') + auto + (err ? ' aria-invalid="true"' : ''));
    return '<tr data-ec-r="' + r + '"' + (err ? ' data-ec-err="true"' : '') + '><td class="jh-plan__ecno">' + (r + 1) + '</td><td>' + cell(r, 'name', i, row && row.name, ' placeholder="' + esc(COLS[1].ph) + '"') + '</td><td>' + cell(r, 'unit', i, row && row.unit, ' placeholder="' + esc(COLS[2].ph) + '"') + '</td><td>' + cell(r, 'qty', i, row && row.qty, ' placeholder="' + esc(COLS[3].ph) + '"' + (err ? ' aria-invalid="true"' : '')) + '</td><td>' + cell(r, 'price', i, row && row.price, ' placeholder="' + esc(COLS[4].ph) + '"') + '</td><td>' + tot + '</td><td>' + cell(r, 'remark', i, row && row.remark, '') + '</td><td><button type="button" class="jh-btn" data-variant="ghost" data-ec-del="' + r + '" aria-label="행 삭제">×</button></td></tr>'
      + (err ? '<tr data-ec-errrow="' + r + '"><td></td><td colspan="7"><div class="jh-alert" data-tone="warn" role="alert">' + esc(x.error || '입력을 확인해 주세요.') + '</div></td></tr>' : '');
  }).join('');
}
/** 요약 영역(소계·견적가·대당 금액·오류·버튼) — 입력칸은 없다. 입력할 때마다 이 부분만 다시 그린다. info = 항목에 현재 들어 있는 { qty, amount } (계산 결과와 다르면 알림) */
export function calcSummaryHtml(res, i, info) {
  const good = !!(res && res.ok === true);
  // 총 장비 대수만 없는 경우(소계·견적가는 이미 나옴): 내역을 쌓는 동안 중간 합계를 볼 수 있게 숫자를 보여 주고 대당 금액만 안내한다. 행 오류·내역 없음·내림 단위 문제는 숫자 없이 이유만 — 틀린 줄을 뺀 합계가 사실처럼 보이면 안 된다
  const partial = !good && !!res && typeof res.price === 'number' && typeof res.subtotal === 'number' && typeof res.badRow !== 'number';
  const cell = (label, v) => '<div><span class="jh-field__hint">' + label + '</span> <strong>' + v + '</strong></div>';
  let out;
  if (good || partial) {
    const stale = good && !!info && (Number(info.amount) !== res.price || Number(info.qty) !== res.count);
    out = '<div class="jh-plan__calcres">' + cell('소계', esc(won(res.subtotal))) + cell('견적가', esc(won(res.price))) + cell('대당 금액', good ? esc(won(res.perUnit)) : '<span class="jh-field__hint">총 장비 대수를 넣으면 계산됩니다</span>') + '</div>'
      + (partial ? '<div class="jh-alert" data-tone="warn" role="alert">' + esc(res.error) + '</div>' : '')
      + (stale ? '<div class="jh-field__hint" data-ec-stale="true" role="status">항목의 수량·금액이 이 계산 결과와 다릅니다. "항목에 넣기"를 눌러야 반영됩니다.</div>' : '');
  } else out = '<div class="jh-alert" data-tone="warn" role="alert">' + esc(res && typeof res.badRow === 'number' ? (res.badRow + 1) + '번 행을 확인해 주세요. (이유는 그 행 아래에 있습니다)' : (res && res.error) || '내역을 입력해 주세요.') + '</div>';
  const actions = '<div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="primary" data-ec-apply="' + i + '"' + (good ? '' : ' disabled') + '>항목에 넣기</button><button type="button" class="jh-btn" data-ec-close="' + i + '">닫기</button></div>';
  return out + actions;
}
/** i = 항목 번호, calc = { rows, markup, unit, count }, res = calcSheet 결과, info = 항목의 { qty, amount }(선택).
 *  항목 표 안의 <tr> 이 아니라 표 밖(#es-calc)에 놓는 <div> 블록이다 — 항목 표는 폰에서 가로로 넓어지는데 그 안의 행은 같은 폭을 따라가 가산율·버튼이 화면 밖으로 밀리기 때문. 제목에 어느 품목의 계산인지 보인다 */
export function calcBoxHtml(i, calc, res, info) {
  const c = calc && typeof calc === 'object' ? calc : { rows: [], markup: '', unit: '', count: '' };
  const head = '<thead><tr>' + COLS.map((x) => '<th' + (x.num ? ' class="jh-plan__num"' : '') + '>' + esc(x.label) + (x.col ? ' <span class="jh-plan__ecletter">' + x.col + '</span>' : '') + '</th>').join('') + '<th></th></tr></thead>';
  const mi = (k, label, hint) => '<div class="jh-field"><label class="jh-field__label">' + esc(label) + '</label><input class="jh-input jh-plan__num" inputmode="decimal" data-ec-m="' + k + '" data-ec-row="' + i + '" value="' + esc(c[k] == null ? '' : c[k]) + '"' + (hint ? ' placeholder="' + esc(hint) + '"' : '') + '></div>';
  const title = '품목 ' + (Number(i) + 1) + ' 산식';
  return '<div class="jh-plan__calc" data-ec-box="' + i + '" role="region" aria-label="' + esc(title) + '"><div class="jh-plan__calchead"><strong>' + esc(title) + '</strong><span class="jh-field__hint">내역을 쌓아 견적가를 만들고 "항목에 넣기"로 반영합니다</span></div>'
    + '<div class="jh-plan__scroll"><table class="jh-plan__table jh-plan__ectable">' + head + '<tbody data-ec-body="' + i + '">' + tableBodyHtml(i, c, res) + '</tbody></table></div>'
    + '<div><button type="button" class="jh-btn" data-ec-add="' + i + '">+ 행 추가</button></div>'
    + '<div class="jh-field__hint" data-ec-hint="' + i + '">칸을 가리킬 수 있습니다 — 열: ' + COLS.filter((x) => x.col).map((x) => x.col + ' ' + x.label).join(' · ') + ', 행: 왼쪽 번호. 예) =E1*C2 · =SUM(E1:E3) · =ROUND(E1*1.1,-2) · 함수: SUM AVERAGE MIN MAX ROUND ROUNDUP ROUNDDOWN ABS</div>'
    + '<div class="jh-plan__grid3">' + mi('markup', '가산율(%)', '설치비에 더함') + mi('unit', '내림 단위(원)', '견적가를 이 단위로 내림') + mi('count', '총 장비 대수', '대당 금액 = 견적가 ÷ 대수') + '</div>'
    + '<div data-ec-sum="' + i + '">' + calcSummaryHtml(res, i, info) + '</div></div>';
}
