/* 평가 결과 화면(관리자·인사팀) — 마크업만. 확정된 직원을 골라 결과 통보서를 미리 보고, 본인 확인 링크를 만들어 메일로 보낸다. 읽기·발송은 result-io.js */
import { esc } from '../../core/ui.js?v=20261030a';
import { resultHtml } from './result-report.js?v=20261030a';
const chip = (t, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(t) + '</span>';

/** st.rs = { year, rows:[{ id, name, dept, rank, ok, reason, final, grade }], sel, preview:{ data, html }, sent:{ [workerId]: '발송 시각 문구' }, canSend, mailOn, busy } */
export function resultBoardHtml(st) {
  const rs = st.rs; const rows = rs.rows || []; const okN = rows.filter((r) => r.ok).length;
  const head = '<div class="jh-card"><div class="jh-panel__head"><h3>평가 결과 통보 — ' + esc(rs.year) + '년</h3></div><div class="jh-hr__pad">'
    + '<div class="jh-hr__bar">' + chip('확정 ' + okN + '명 / 대상 ' + rows.length + '명', okN ? 'accent' : 'muted') + '</div>'
    + '<div class="jh-field__hint">확정된 평가만 통보할 수 있습니다. 직원에게는 <strong>점수가 아니라 본인 확인 링크</strong>가 메일로 나갑니다 — 링크를 열면 등록된 휴대폰 번호로 문자 인증을 통과한 본인만 결과를 봅니다. 올해 결과는 연봉협상 면담의 참고자료입니다.</div>'
    + (rs.canSend ? '' : '<div class="jh-field__hint" data-tone="warn">통보서 발송은 관리자 계정만 할 수 있습니다(링크 생성이 관리자 전용입니다). 지금 계정은 미리보기만 가능합니다.</div>')
    + (rs.mailOn ? '' : '<div class="jh-field__hint" data-tone="warn">테섭에서는 메일 발송이 꺼져 있습니다(시험 중 실제 직원에게 메일이 나가지 않게). "링크 만들기"로 링크와 QR 을 확인하세요. 본섭에서는 발송됩니다.</div>')
    + '</div></div>';
  const table = '<div class="jh-card"><div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>이름</th><th>팀 · 직급</th><th>최종</th><th>등급</th><th>상태</th><th></th></tr></thead><tbody>'
    + (rows.length ? rows.map((r) => '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.dept) + ' · ' + esc(r.rank) + '</td><td>' + (r.ok ? esc(r.final) : '-') + '</td><td>' + (r.ok ? esc(r.grade) : '-') + '</td><td>'
      + (r.ok ? (rs.sent && rs.sent[r.id] ? chip('발송함 ' + rs.sent[r.id], 'accent') : chip('통보 가능', 'muted')) : '<span class="jh-field__hint">' + esc(r.reason) + '</span>')
      + '</td><td>' + (r.ok ? '<button type="button" class="jh-btn" data-variant="secondary" data-rs-open="' + esc(r.id) + '">보기</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="6"><div class="jh-empty">평가 대상 직원이 없습니다.</div></td></tr>')
    + '</tbody></table></div></div>';
  return head + table;
}
export function resultPanelHtml(st) {
  const rs = st.rs; const p = rs.preview; if (!p) return resultBoardHtml(st);
  const dis = !rs.canSend || rs.busy ? ' disabled' : '';
  const bar = '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="secondary" data-rs-act="back">← 목록</button><strong>' + esc(p.data.worker.name) + '님 결과 통보서</strong></div>'
    + '<div class="jh-field__hint">아래가 직원이 보게 될 문서입니다(저장본). 사장단 개인 점수·코멘트·동료 개별 점수는 들어 있지 않습니다. 보내기 전에 내용을 확인해 주세요.</div>'
    + (rs.canSend ? '' : '<div class="jh-field__hint" data-tone="warn">통보서 발송은 관리자 계정만 할 수 있습니다. 지금 계정은 미리보기만 가능합니다.</div>')
    + (rs.mailOn ? '' : '<div class="jh-field__hint" data-tone="warn">테섭에서는 메일 발송이 꺼져 있습니다. "링크 만들기"로 링크와 QR 을 확인하세요(본섭에서는 메일이 발송됩니다).</div>')
    + '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-rs-act="mail"' + dis + (rs.mailOn ? '' : ' title="테섭에서는 메일 발송이 꺼져 있습니다"') + '>메일로 발송</button>'
    + '<button type="button" class="jh-btn" data-variant="secondary" data-rs-act="link"' + dis + '>링크 만들기(복사·QR)</button>'
    + '<button type="button" class="jh-btn" data-variant="secondary" data-rs-act="print">인쇄 · PDF</button></div>';
  const frame = '<iframe class="jh-rs-frame" data-rs-frame sandbox="" title="결과 통보서 미리보기" style="width:100%;min-height:70vh;border:1px solid var(--c-line,#cbd5e1);background:#fff"></iframe>';
  return '<div class="jh-card"><div class="jh-hr__pad">' + bar + frame + '</div></div>';
}
/** 미리보기 문서(HTML 문자열) — 화면과 발송이 같은 함수를 쓴다 */
export const previewHtml = (data, today) => resultHtml(data, { today });
