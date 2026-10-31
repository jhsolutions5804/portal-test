/* 4대보험 월별 대조 화면(대기열 1-3-17 1단계) — HTML 만 만드는 순수 함수(시험: tests/hr-insurance-view.test.mjs). 급여명세서 근로자 공제 합과 공단 고지금액을 월별로 맞춰 보여 준다. */
import { pageTableHtml } from '../../shared/pager.js?v=20261031h';
import { esc } from '../../core/ui.js?v=20261031h';
import { reconcile } from './insurance-recon.js?v=20261031h';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
export const FLAGS = { noBill: ['고지서 없음', 'accent'], noPayslip: ['명세서 없음', 'accent'], pensionRatioOff: ['연금 비율 이탈', 'warn'], healthRatioOff: ['건강 비율 이탈', 'warn'], employOff: ['고용보험 검산 차이', 'warn'], unpaid: ['미납', 'warn'], jump: ['전월 대비 급증', 'warn'] };
const FLAG_HELP = { noBill: '이 달 명세서는 있는데 공단 고지금액을 아직 입력하지 않았습니다.', noPayslip: '고지금액은 있는데 해당 달 급여명세서가 없습니다(귀속월 차이를 확인).', pensionRatioOff: '근로자 연금 공제가 고지의 절반에서 10%p 넘게 벗어났습니다(상한·미가입자·신규 가입·소급 정산 가능).', healthRatioOff: '근로자 건강보험 공제가 고지의 절반에서 10%p 넘게 벗어났습니다.', employOff: '근로자 고용보험 공제가 총지급×0.9%와 5% 넘게 다릅니다.', unpaid: '고지서에 미납액이 있습니다.', jump: '고지금액이 전월의 1.8배를 넘었습니다.' };
export const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('ko-KR'));
const pct = (r) => (r === null || r === undefined ? '—' : (r * 100).toFixed(1) + '%');
const sum = (...v) => (v.some((x) => x === null || x === undefined) ? null : v.reduce((a, b) => a + b, 0));
export const NOTE = '급여명세서 합계는 화면을 열 때 계산하고(새로 저장하지 않음), 공단 고지금액은 회사 월 합계만 저장합니다(개인별 값·개인정보 없음). 연금·건강은 비과세를 뺀 과세 보수 기준이라 명세서 총지급과 정확히 맞지 않고, 고용·산재 고지는 연초 개산이라 내년 3월 확정 정산에서 오를 수 있습니다. 신고서 작성은 다음 단계입니다.';

/** st: { loading, error, busy, data:{payslips,bills}, offset, form:{ym,pension,health,ltcare,unpaid,exists}|null } */
function insurancePageHtml_list(st) {
  if (st.loading && !st.data) return '<div class="jh-skeleton" style="height:var(--u-220)" aria-busy="true"></div>';
  if (st.error) return '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc(st.error) + '</div>';
  const d = st.data || { payslips: {}, bills: {} }; const off = Number.isInteger(st.offset) ? st.offset : 0; const rec = reconcile({ payslips: d.payslips, bills: d.bills, offset: off });
  const flagged = rec.rows.filter((r) => r.flags.some((f) => f !== 'noBill' && f !== 'noPayslip')); const missing = rec.rows.filter((r) => r.flags.includes('noBill')).length;
  const alerts = (flagged.length ? '<div class="jh-alert" data-tone="warn" role="status"><b>확인이 필요한 달 ' + flagged.length + '개</b> — ' + esc(flagged.map((r) => r.month).join(', ')) + '</div>' : '') + (missing ? '<div class="jh-alert" data-tone="info" role="status">공단 고지금액이 아직 없는 달이 ' + missing + '개 있습니다. 아래에서 입력하면 바로 대조됩니다.</div>' : '');
  const offSel = '<label class="jh-field__label" for="ins-off">고지월 = 급여월 +</label> <select class="jh-select" id="ins-off" data-ins-offset aria-label="고지월과 급여월의 차이">' + [0, 1, -1].map((o) => '<option value="' + o + '"' + (o === off ? ' selected' : '') + '>' + (o === 0 ? '0개월(같은 달)' : o > 0 ? o + '개월(다음 달 고지)' : '−' + -o + '개월') + '</option>').join('') + '</select>';
  const rows = rec.rows.slice().reverse().map((r) => {
    const empSum = r.payslip ? sum(r.pension.employee, r.health.employee, r.ltcare.employee) : null; const billSum = r.bill ? sum(r.bill.pension, r.bill.health, r.bill.ltcare) : null;
    const employer = empSum !== null && billSum !== null ? billSum - empSum : null;
    const fl = r.flags.map((f) => '<span title="' + esc(FLAG_HELP[f] || '') + '">' + chip((FLAGS[f] || [f, 'muted'])[0], (FLAGS[f] || [f, 'muted'])[1]) + '</span>').join(' ');
    return '<tr' + (r.flags.some((f) => f !== 'noBill' && f !== 'noPayslip') ? ' class="jh-hr__sum"' : '') + '><td><strong>' + esc(r.month) + '</strong><div class="jh-field__hint">고지 ' + esc(r.billMonth) + '</div></td>'
      + '<td style="text-align:right">' + (r.payslip ? r.payslip.count + '명<div class="jh-field__hint">' + fmt(r.payslip.gross) + '</div>' : '—') + '</td>'
      + '<td style="text-align:right">' + fmt(empSum) + '</td><td style="text-align:right">' + fmt(billSum) + (r.unpaid > 0 ? '<div class="jh-field__hint">미납 ' + fmt(r.unpaid) + '</div>' : '') + '</td>'
      + '<td style="text-align:right">' + fmt(employer) + '</td><td style="text-align:right">' + (r.payslip ? fmt(r.employ.employee) + '<div class="jh-field__hint">기대 ' + fmt(r.employ.expected) + '</div>' : '—') + '</td>'
      + '<td>' + (fl || '<span class="jh-field__hint">이상 없음</span>') + '</td>'
      + '<td><button type="button" class="jh-btn" data-variant="secondary" data-ins-edit="' + esc(r.billMonth) + '">' + (r.bill ? '고지 수정' : '고지 입력') + '</button></td></tr>';
  }).join('');
  const T = rec.totals;
  const tot = T.monthsCompared ? '<div class="jh-field__hint" data-ins-total style="margin-top:.5rem">대조한 ' + T.monthsCompared + '개월 합계 — 명세서 근로자 공제 ' + fmt(T.employee) + '원 · 공단 고지 ' + fmt(T.bill) + '원 · <b>사업주 실부담 ' + fmt(T.employerByBill) + '원</b> · 근로자 공제/총지급 ' + pct(T.employeeShareOfGross) + ' · 고지의 절반/총지급 ' + pct(T.billHalfShareOfGross) + (T.unpaid ? ' · 미납 ' + fmt(T.unpaid) + '원' : '') + '</div>' : '';
  const table = rec.rows.length ? '<div class="jh-hr__scroll" style="overflow-x:auto"><table class="jh-hr-table" data-ins-table><thead><tr><th>급여월</th><th>명세서</th><th>근로자 공제(연금·건강·요양)</th><th>공단 고지 합</th><th>사업주 실부담</th><th>고용보험 공제</th><th>점검</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' + tot : '<div class="jh-empty">급여명세서도 공단 고지금액도 아직 없습니다. 아래에서 고지금액을 입력해 주세요.</div>';
  const f = st.form; const inp = (k, label, ph) => '<div class="jh-field"><label class="jh-field__label">' + label + '</label><input class="jh-input" inputmode="numeric" autocomplete="off" data-ins-f="' + k + '" value="' + esc(f[k] == null ? '' : f[k]) + '" placeholder="' + esc(ph || '') + '" style="text-align:right"></div>';
  const form = f ? card((f.exists ? '고지금액 수정 — ' : '고지금액 입력 — ') + f.ym, '<div class="jh-hr__pad" data-ins-form><div class="jh-field"><label class="jh-field__label">고지월</label><input class="jh-input" type="month" data-ins-f="ym" value="' + esc(f.ym) + '"' + (f.exists ? ' disabled' : '') + '></div>' + inp('pension', '국민연금 고지 합계(원)', '예: 838,060') + inp('health', '건강보험 고지 합계(원)', '예: 700,000') + inp('ltcare', '장기요양 고지 합계(원)', '없으면 0') + inp('unpaid', '미납액(원)', '없으면 비워 두세요')
    + '<div class="jh-field__hint">공단 고지서에 적힌 <b>근로자+사업주 합계</b>를 그대로 넣습니다. 이 달 고지가 없으면 0을 넣어 주세요.</div><div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-ins-act="save"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '저장 중…' : '저장') + '</button><button type="button" class="jh-btn" data-variant="ghost" data-ins-act="cancel"' + (st.busy ? ' disabled' : '') + '>취소</button>' + (f.exists ? '<button type="button" class="jh-btn" data-variant="danger" data-ins-act="delete"' + (st.busy ? ' disabled' : '') + '>이 달 고지금액 삭제</button>' : '') + '</div></div>') : '';
  return alerts + card('월별 4대보험 대조', '<div class="jh-hr__pad"><div class="jh-hr__bar">' + offSel + '<button type="button" class="jh-btn" data-variant="primary" data-ins-edit="" >＋ 고지금액 입력</button></div>' + table + '<div class="jh-field__hint" style="margin-top:.5rem">' + esc(NOTE) + '</div></div>') + form;
}

/* ── 목록 페이지 나누기(shared/pager.js) — NAME_list 의 결과에 쪽 나누기를 씌운 함수 ── */
export function insurancePageHtml(st) { return pageTableHtml(insurancePageHtml_list(st), st.pg || (st.pg = {}), 'hr-insurance', String(st && st.ym || '')); }
