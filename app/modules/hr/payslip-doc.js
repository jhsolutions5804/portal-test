/* 급여명세서 서식 v7 — 4대보험 요율 표기를 "그 급여 월의 법정 요율"로 인쇄한다(2026-10-13~).
 * 동결 양식(frozen-docs.js, 원본 그대로·수정 금지)의 v6 출력을 그대로 쓰되, 요율이 글자로 박힌 문구(공제 비고 4곳, 산출식 1줄)만 저장 문서의 insRates 로 바꾼다.
 * 이미 저장된 v0~v6 명세서는 저장 당시 양식 그대로(옛 요율 표기) 출력된다 — 서명·저장된 서류는 바뀌지 않는다는 원칙.
 * 새 양식이 필요하면 이 방식(동결본 위에 덧씌우기)으로 v8… 을 따로 추가한다. */
import { __PS_TPL, docHtmlByVer } from './frozen-docs.js?v=20261030a';
const pct = (r) => String(parseFloat((Number(r) * 100).toFixed(3)));
const OLD = { pension: '4.5', health: '3.545', ltcare: '12.81', employ: '0.9' };
const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** 연봉계약서(v7)의 추가 지급 항목 행 — 기술수당 행 바로 아래(없으면 그대로) */
function withContractItems(h, d) { const items = d && Array.isArray(d.contractItems) ? d.contractItems.filter((r) => r && r.name && Number(r.amount) > 0) : []; if (!items.length) return h; const i = h.indexOf('기술수당</td>'); if (i < 0) return h; const end = h.indexOf('</tr>', i) + 5; const cell = 'padding:8px 10px;border:1px solid #E4EAF2;'; const rows = items.map((r) => '<tr><td style="' + cell + 'font-size:10pt;white-space:nowrap;">' + esc(r.name) + '</td><td style="' + cell + 'text-align:right;font-size:10pt;font-weight:700;white-space:nowrap;">₩' + Math.round(Number(r.amount)).toLocaleString('ko-KR') + '</td><td style="' + cell + 'font-size:8.5pt;color:#8A96A8;">연봉계약서 지급 항목' + (r.ordinary ? ' · 통상임금 포함' : '') + '</td></tr>').join(''); return h.slice(0, end) + rows + h.slice(end); }
export function psHtmlV7(d) {
  const base = __PS_TPL.v6(d); const r = d && d.insRates; if (!r) return withContractItems(base, d); let h = base; const rep = (a, b) => { h = h.split(a).join(b); };
  rep('월 보수액 × ' + OLD.pension + '%', '월 보수액 × ' + pct(r.pension) + '%'); rep('월 보수액 × ' + OLD.health + '%', '월 보수액 × ' + pct(r.health) + '%'); rep('건강보험 × ' + OLD.ltcare + '%', '건강보험 × ' + pct(r.ltcare) + '%'); rep('월 보수액 × ' + OLD.employ + '%', '월 보수액 × ' + pct(r.employ) + '%');
  rep('국민연금: 지급계×' + OLD.pension + '%', '국민연금: 지급계×' + pct(r.pension) + '%'); rep('건강보험: 지급계×' + OLD.health + '%', '건강보험: 지급계×' + pct(r.health) + '%'); rep('장기요양: 건강보험×' + OLD.ltcare + '%', '장기요양: 건강보험×' + pct(r.ltcare) + '%'); rep('고용보험: 지급계×' + OLD.employ + '%', '고용보험: 지급계×' + pct(r.employ) + '%');
  return withContractItems(h, d);
}
/** 급여명세서 출력: 저장 당시 양식(tplVer)으로 — v7 은 위 함수, 그 밖은 동결 양식 그대로 */
export const psHtml = (d) => (d && d.tplVer === 'v7' ? psHtmlV7(d) : docHtmlByVer(__PS_TPL, d));
/** 양식 변경 이력에 덧붙일 v7 행(동결 이력 DOC_TPL_HISTORY 뒤에) */
export const PS_HISTORY_V7 = { ver: 'v7', from: '2026-10-13T09:00:00+09:00', payslip: '4대보험 요율을 급여 월의 법정 요율로 계산·표기(2026년: 국민연금 4.75%·건강보험 3.595%·장기요양 건강보험료×13.14%·고용보험 0.9%). 저장 문서에 사용한 요율(insRates)을 함께 기록', labor: '내용 변경 없음(v6 유지)', annual: '내용 변경 없음(v6 유지)' };
