/* 지원서 개인정보 파기 관리 화면 — HTML 만 만드는 순수 함수(시험: tests/hr-recruit-purge-view.test.mjs). 지원자 화면의 카드·행 칩과 인사 홈 신호 칸. */
import { esc } from '../../core/ui.js?v=20261031a';
import { JOB_STATUS } from './logic.js?v=20261031a';
import { PURGE_STATES, RET_DEFAULT, RET_MIN, RET_MAX, purgeInfo, purgeDayText, retentionOf } from './recruit-purge.js?v=20261031a';
import { addDaysStr } from './home.js?v=20261031a';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
/** 지원자 표의 칩 — 파기 상태와 예정일 */
export function purgeChipHtml(info) {
  if (!info || !PURGE_STATES[info.state] || info.state === 'done') return '';
  const s = PURGE_STATES[info.state]; const extra = info.dueDate ? ' ' + info.dueDate + ' (' + purgeDayText(info) + ')' : '';
  return '<div>' + chip((s.mark ? s.mark + ' ' : '') + s.label + extra, s.tone) + '</div>';
}
const NOTE = '지원서는 채용 확정일부터 보관기간(14~180일, 기본 ' + RET_DEFAULT + '일)이 지나면 파기해야 합니다(채용절차법 제11조·개인정보보호법 제21조, 노무사 확인 대기). 파기하면 이름·연락처·주소·생년월일·이력이 모두 지워지고 접수일·공고·파기일·파기한 사람만 남으며 되돌릴 수 없습니다. 합격자는 파기하지 않습니다. 지원 페이지에는 반환·보관·파기 안내(채용절차법 제11조 제6항)를 올려 두어야 합니다.';
/** 지원자 화면 위의 관리 카드. rep = purgeReport 결과 */
export function purgeCardHtml(rep) {
  if (!rep) return '';
  const c = rep.counts; const due = c.due;
  const run = '<button type="button" class="jh-btn" data-variant="' + (due ? 'primary' : 'secondary') + '" data-pg-run' + (due ? '' : ' disabled') + '>🗑 기한 지난 ' + due + '건 파기</button>';
  const rows = rep.byPosting.map((b) => {
    const p = b.posting; const id = b.postingId; if (!p) return '<tr><td>' + esc('(공고 없음)') + '</td><td>' + b.total + '</td><td colspan="4"><span class="jh-field__hint">공고가 지워진 지원서입니다. 개별 삭제로 정리하세요.</span></td></tr>';
    const ret = retentionOf(p); const due0 = /^\d{4}-\d{2}-\d{2}$/.test(p.decidedDate || '') ? addDaysStr(p.decidedDate, ret) : '';
    return '<tr><td><strong>' + esc(p.title || '(제목 없음)') + '</strong> ' + chip(JOB_STATUS[p.status] || p.status || '-', 'muted') + '</td><td>' + b.total + (b.due ? ' <span class="jh-field__hint">(기한 지남 ' + b.due + ')</span>' : '') + '</td>'
      + '<td><input class="jh-input" type="date" data-pg-date="' + esc(id) + '" value="' + esc(p.decidedDate || '') + '" aria-label="채용 확정일"></td>'
      + '<td><input class="jh-input" type="number" inputmode="numeric" min="' + RET_MIN + '" max="' + RET_MAX + '" data-pg-days="' + esc(id) + '" value="' + esc(p.retentionDays || '') + '" placeholder="' + RET_DEFAULT + '" aria-label="보관기간(일)" style="max-width:5.5rem"></td>'
      + '<td>' + (due0 ? esc(due0) : '<span class="jh-field__hint">확정일 입력 필요</span>') + '</td><td><button type="button" class="jh-btn" data-variant="secondary" data-pg-save="' + esc(id) + '">저장</button></td></tr>';
  }).join('');
  const head = '<div class="jh-hr__bar">' + run + '<span class="jh-field__hint">기한 지남 ' + c.due + ' · 임박 ' + c.soon + ' · 확정일 미입력 ' + c.nodate + (c.nolink ? ' · 공고 없음 ' + c.nolink : '') + ' · 합격자 제외 ' + c.kept + (c.done ? ' · 파기 완료 ' + c.done : '') + '</span></div>';
  return card('🗑 지원서 개인정보 파기 관리', '<div class="jh-hr__pad">' + head + (rows ? '<div class="jh-hr__scroll" style="overflow-x:auto"><table class="jh-hr-table" data-pg-table><thead><tr><th>공고</th><th>지원서</th><th>채용 확정일</th><th>보관(일)</th><th>파기 예정일</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">공고가 없습니다.</div>') + '<div class="jh-field__hint" style="margin-top:.5rem">' + esc(NOTE) + '</div></div>');
}
/** 인사 홈 신호 칸 — 기한이 지났거나 임박했거나 확정일 입력이 필요한 지원서가 있을 때만 크게, 없으면 한 줄 */
export function purgeHomeHtml(rep) {
  if (!rep) return '<div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div>';
  const c = rep.counts; if (!rep.rows.length) return '';
  if (!rep.pending) return card('🗑 지원서 파기 기한', '<div class="jh-hr__pad"><div class="jh-field__hint">파기가 필요한 지원서가 없습니다(예정 ' + c.ok + '건 · 합격자 제외 ' + c.kept + '건).</div></div>');
  const alert = c.due ? '<div class="jh-alert" data-tone="danger" role="alert"><b>🔴 파기 기한이 지난 지원서 ' + c.due + '건</b> — 보관기간이 끝났습니다. 확인 후 파기해 주세요.</div>' : '';
  return card('🗑 지원서 파기 기한', '<div class="jh-hr__pad" data-pg-home>' + alert + '<div class="jh-field__hint">기한 지남 ' + c.due + ' · 임박(14일 이내) ' + c.soon + ' · 채용 확정일 미입력 ' + c.nodate + (c.nolink ? ' · 공고 연결 없음 ' + c.nolink : '') + '</div><div class="jh-hr__bar"><a class="jh-btn" data-variant="' + (c.due ? 'primary' : 'secondary') + '" href="#/hr/applicants">지원자 화면에서 확인 ›</a></div></div>');
}
