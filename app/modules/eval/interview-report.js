/* 인사평가 면담 기록서(인쇄용) — 면담에서 합의한 실행 계획을 한 장으로. 직원·면담자 서명란이 있다.
 * 결과 통보서와 같은 방식으로 새 창에 문서를 쓰고 인쇄한다(result-report.js 의 resultPrintHtml 이 제목·인쇄 스크립트를 더한다). 이 문서는 점수·연봉을 약속하는 문서가 아니다. */
import { esc } from '../../core/ui.js?v=20261109m';
import { docFileName } from '../../shared/doc-filename.js?v=20261109m';
import { RC_LABELS, REVIEW_STATUS_TEXT } from './interview-logic.js?v=20261109m';
export const REVIEW_TITLE = '인사평가 면담 기록서';
/** 문서 이름 — 종류 - 이름 - 평가 연도(점수·부서·직급은 넣지 않는다) */
export function reviewPrintTitle(d) { const x = d && typeof d === 'object' ? d : {}; const w = x.worker && typeof x.worker === 'object' ? x.worker : {}; return docFileName({ group: 'person', kind: REVIEW_TITLE, name: w.name, year: x.year }); }
const CSS = 'body{margin:0;padding:24px;font-family:-apple-system,"Malgun Gothic","Noto Sans KR",sans-serif;color:#1f2937;line-height:1.6;background:#fff}.w{max-width:720px;margin:0 auto}h1{font-size:20px;margin:0 0 4px;color:#0f2a5c}h2{font-size:14px;margin:18px 0 6px;color:#0f2a5c}.sub{color:#64748b;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9;width:22%}.box{border:1px solid #cbd5e1;background:#f8fafc;padding:10px 12px;white-space:pre-wrap;font-size:14px;min-height:22px}.sig{display:flex;gap:24px;margin-top:34px}.sig div{flex:1;border-top:1px solid #64748b;padding-top:4px;font-size:12px;color:#475569;text-align:center}.note{margin-top:18px;font-size:12px;color:#64748b}@media print{body{padding:0}}';
/** d = { year, worker:{name, dept, rank}, record, status } → 한 장짜리 HTML 문서 */
export function reviewHtml(d) {
  const x = d && typeof d === 'object' ? d : {}; const w = x.worker && typeof x.worker === 'object' ? x.worker : {}; const r = x.record && typeof x.record === 'object' ? x.record : {};
  const box = (label, v) => '<h2>' + esc(label) + '</h2><div class="box">' + (String(v || '').trim() ? esc(v) : '—') + '</div>';
  const title = reviewPrintTitle(x);
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body><div class="w"><h1>' + esc(REVIEW_TITLE) + '</h1><div class="sub">' + esc(x.year) + '년 인사평가 · 면담에서 합의한 실행 계획</div>' +
    '<table><tr><th>직원</th><td>' + esc(w.name || '') + '</td><th>소속·직급</th><td>' + esc([w.dept, w.rank].filter(Boolean).join(' · ')) + '</td></tr><tr><th>' + esc(RC_LABELS.date) + '</th><td>' + esc(r.date || '') + '</td><th>' + esc(RC_LABELS.interviewer) + '</th><td>' + esc(r.interviewer || '') + '</td></tr><tr><th>상태</th><td>' + esc(REVIEW_STATUS_TEXT[x.status] || '') + '</td><th>' + esc(RC_LABELS.checkDate) + '</th><td>' + esc(r.checkDate || '') + '</td></tr></table>' +
    box(RC_LABELS.summary, r.summary) + box(RC_LABELS.employeeAction, r.employeeAction) + box(RC_LABELS.measure, r.measure) + box(RC_LABELS.support, r.support) + box(RC_LABELS.disagreement, r.disagreement) +
    '<div class="sig"><div>직원 확인 (서명)</div><div>면담자 확인 (서명)</div></div><div class="note">이 문서는 면담에서 합의한 실행 계획을 기록한 것이며, 평가 점수나 연봉 결정을 약속하는 문서가 아닙니다. 평가 결과는 올해 참고자료로 활용합니다.</div></div></body></html>';
}
