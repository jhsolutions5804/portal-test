/* 인사평가 면담 화면(마크업만) — 사장단·관리자 전용. 저장·불러오기는 interview-io.js, 규칙은 interview-logic.js.
 * 목록 → 직원 상세: ① 면담 전 준비 체크 · 직원 자기평가 보기 · ② 평가 근거 메모 · 면담 진행 안내 · ③ 면담 기록·실행 합의(완료하면 인사 면담 이력에도 남김). */
import { esc } from '../../core/ui.js?v=20261105a';
import { evalPeriod } from './evaluation.js?v=20261105a';
import { selfHtml } from './self-form.js?v=20261105a';
import { PREP_ITEMS, prepProgress, TONES, EV_LIMITS, EV_LABELS, RC_LIMITS, RC_LABELS, REVIEW_STATUS_TEXT, FLOW, FLOW_TOTAL_MIN, FEEDBACK, HARD_QUESTIONS, toneCounts, balanceNote, evidenceSorted, reviewStatusOf } from './interview-logic.js?v=20261105a';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const stone = (s) => (s === 'done' ? 'accent' : s === 'draft' ? 'warn' : 'muted');
const TONE_CHIP = { win: 'accent', gap: 'warn', extra: 'muted' };
const head = (t, right) => '<div class="jh-panel__head"><h3>' + t + '</h3>' + (right || '') + '</div>';
const field = (label, hint, control) => '<div class="jh-field"><label class="jh-field__label">' + label + (hint ? ' <span class="jh-field__hint">' + hint + '</span>' : '') + '</label>' + control + '</div>';
const area = (attr, v, rows, lim, label) => '<textarea class="jh-textarea" rows="' + rows + '" maxlength="' + lim + '" ' + attr + ' aria-label="' + esc(label) + '">' + esc(v) + '</textarea>';

export const NO_ACCESS = '<div class="jh-card"><div class="jh-empty">면담 기록은 사장단·관리자만 열 수 있습니다. 평가 면담 내용은 직원에게 공개되지 않는 인사 정보입니다.</div></div>';

/** 평가 대상자 목록 */
export function interviewBoardHtml(st) {
  const iv = st.iv; const p = evalPeriod(iv.year) || { from: '', to: '' };
  const rows = iv.rows.map((r) => {
    const ev = r.ev.total ? '성과 ' + r.ev.win + ' · 개선 ' + r.ev.gap + ' · 추가 ' + r.ev.extra : '<span class="jh-field__hint">없음</span>';
    return '<tr class="jh-hr__row" data-iv-open="' + esc(r.id) + '"><td>' + esc(r.empNo || '-') + '</td><td><strong>' + esc(r.name || '-') + '</strong></td><td>' + esc([r.dept, r.rank].filter(Boolean).join(' · ') || '-') + '</td><td>' + ev + '</td><td>' + r.prep.done + '/' + r.prep.total + '</td><td>' + chip(REVIEW_STATUS_TEXT[r.status], stone(r.status)) + (r.date ? ' ' + esc(r.date) : '') + '</td><td>' + esc(r.checkDate || '-') + '</td></tr>';
  }).join('');
  const body = iv.error ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(iv.error) + '</div>'
    : iv.rows.length ? '<div class="jh-hr__scroll"><table class="jh-hr-table jh-hr-table--click"><thead><tr><th>사번</th><th>이름</th><th>소속·직급</th><th>근거 메모</th><th>준비</th><th>면담</th><th>중간 확인일</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="jh-empty">' + esc(iv.year) + '년 평가 대상자가 없습니다.</div>';
  return '<section class="jh-card">' + head('면담 준비 · 기록 — ' + esc(iv.year) + '년 인사평가') + '<div class="jh-hr__pad"><div class="jh-field__hint">평가 기간 ' + esc(p.from) + ' ~ ' + esc(p.to) + ' · 이름을 누르면 면담 준비(근거 메모·체크)와 면담 기록·실행 합의를 작성합니다. 사번순입니다. 이 화면의 기록은 사장단·관리자만 볼 수 있고 직원에게는 공개되지 않습니다.</div>' + body + '</div></section>';
}

function prepCard(d) {
  const pr = prepProgress(d.rv.prep); const c = toneCounts(d.evidence); const note = balanceNote(c);
  const items = PREP_ITEMS.map((it) => '<label class="jh-iv-check"><input type="checkbox" data-iv-prep="' + it.key + '"' + (d.rv.prep[it.key] ? ' checked' : '') + '><span>' + esc(it.text) + (it.key === 'c2' ? '<span class="jh-field__hint" data-tone="' + (note ? 'warn' : 'accent') + '"> 지금 근거 메모: 성과 ' + c.win + ' · 개선 필요 ' + c.gap + ' · 추가 기여 ' + c.extra + (note ? ' — ' + esc(note) : ' — 균형이 맞습니다.') + '</span>' : '') + '</span></label>').join('');
  return '<section class="jh-card">' + head('면담 전 준비', chip(pr.done + '/' + pr.total, pr.done === pr.total ? 'accent' : 'muted')) + '<div class="jh-hr__pad">' + items + '<div class="jh-field__hint">체크는 면담 전에 스스로 점검하는 용도입니다. 누르면 바로 저장됩니다. 평가 기준은 평가 시작 전에 안내한 것만 씁니다.</div></div></section>';
}

function selfCard(d) {
  const s = d.self; const st = s && s.status === 'submitted' ? '제출 완료' : s ? '임시저장' : '없음';
  const body = s && String(s.text || '').trim() ? '<div class="jh-iv-self">' + selfHtml(s.text, esc) + '</div><div class="jh-field__hint">' + esc(s.source === 'admin' ? '사장단이 대신 입력한 자기평가입니다.' : '직원이 직접 쓴 자기평가입니다.') + ' 점수에는 반영되지 않고 면담 자료로만 씁니다.</div>' : '<div class="jh-field__hint">아직 자기평가가 없습니다. 평가 기간에 직원이 「내 평가」에서 제출하면 여기서 볼 수 있습니다.</div>';
  return '<section class="jh-card">' + head('직원 자기평가', chip(st, s ? (s.status === 'submitted' ? 'accent' : 'warn') : 'muted')) + '<div class="jh-hr__pad">' + body + '</div></section>';
}

function evidenceCard(d) {
  const list = evidenceSorted(d.evidence); const f = d.ef; const c = toneCounts(d.evidence);
  const items = list.length ? list.map((e) => '<div class="jh-iv-ev"><div class="jh-hr__bar"><strong>' + esc(e.date) + '</strong>' + chip(TONES[e.tone] || '', TONE_CHIP[e.tone] || 'muted') + '<button type="button" class="jh-btn" data-variant="ghost" data-iv-ev-del="' + esc(e.id) + '" aria-label="' + esc(e.date) + ' 근거 메모 삭제">삭제</button></div><dl class="jh-iv-kv">' +
    [[EV_LABELS.expected, e.expected], [EV_LABELS.actual, e.actual], [EV_LABELS.impact, e.impact], [EV_LABELS.said, e.said]].filter((x) => String(x[1] || '').trim()).map((x) => '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>').join('') + '</dl></div>').join('') : '<div class="jh-empty">아직 근거 메모가 없습니다.</div>';
  const tones = Object.keys(TONES).map((k) => '<button type="button" class="jh-btn" data-variant="' + (f.tone === k ? 'primary' : 'secondary') + '" data-iv-tone="' + k + '" aria-pressed="' + (f.tone === k) + '">' + esc(TONES[k]) + '</button>').join('');
  const form = '<div class="jh-iv-form"><div class="jh-iv-grid">' + field(EV_LABELS.date, '', '<input class="jh-input" type="date" data-iv-ef="date" max="' + esc(d.today) + '" value="' + esc(f.date) + '" aria-label="근거 메모 날짜">') + field('구분', '', '<div class="jh-hr__bar" role="group" aria-label="구분">' + tones + '</div>') + '</div>' +
    field(EV_LABELS.expected, '선택 · 목표·약속했던 기준', area('data-iv-ef="expected"', f.expected, 2, EV_LIMITS.expected, EV_LABELS.expected)) + field(EV_LABELS.actual, '필수 · 보이는 사실만', area('data-iv-ef="actual"', f.actual, 3, EV_LIMITS.actual, EV_LABELS.actual)) +
    field(EV_LABELS.impact, '선택', area('data-iv-ef="impact"', f.impact, 2, EV_LIMITS.impact, EV_LABELS.impact)) + field(EV_LABELS.said, '선택 · 직원이 한 말', area('data-iv-ef="said"', f.said, 2, EV_LIMITS.said, EV_LABELS.said)) +
    '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-iv-act="ev-add"' + (d.busy ? ' disabled' : '') + '>근거 메모 추가</button></div></div>';
  return '<section class="jh-card">' + head('평가 근거 메모', chip('성과 ' + c.win + ' · 개선 ' + c.gap + ' · 추가 ' + c.extra, 'muted')) + '<div class="jh-hr__pad"><div class="jh-field__hint">면담에서 설명할 수 있도록, 있었던 일을 날짜와 함께 그때그때 적어 둡니다. 성과·아쉬운 점·추가 기여를 고르게 남깁니다.</div>' + items + '<h4 class="jh-iv-h">새 근거 메모</h4>' + form + '</div></section>';
}

function guideCard() {
  const flow = '<table class="jh-hr-table"><thead><tr><th>시간</th><th>순서</th><th>이렇게 말을 꺼내 보세요</th></tr></thead><tbody>' + FLOW.map((x) => '<tr><td>' + x.min + '분</td><td><strong>' + esc(x.title) + '</strong></td><td>' + esc(x.say) + '</td></tr>').join('') + '</tbody></table>';
  const fb = '<div class="jh-iv-box"><strong>' + esc(FEEDBACK.title) + '</strong><div>' + esc(FEEDBACK.fact) + ' ' + esc(FEEDBACK.impact) + ' ' + esc(FEEDBACK.hope) + '</div><div class="jh-field__hint">예) ' + esc(FEEDBACK.example.fact) + ' ' + esc(FEEDBACK.example.impact) + ' ' + esc(FEEDBACK.example.hope) + '</div></div>';
  const hq = '<div class="jh-iv-box"><strong>어려운 질문이 나왔을 때</strong>' + HARD_QUESTIONS.map((x) => '<div class="jh-iv-q"><div class="jh-iv-q__q">“' + esc(x.q) + '”</div><div>' + esc(x.a) + '</div></div>').join('') + '</div>';
  return '<section class="jh-card">' + head('면담 진행 안내 · ' + FLOW_TOTAL_MIN + '분') + '<div class="jh-hr__pad"><details class="jh-iv-guide"><summary>펼쳐서 보기(진행 순서 · 말하는 순서 · 어려운 질문)</summary><div class="jh-iv-guide__body">' + flow + fb + hq + '<div class="jh-field__hint">평가 결과에 동의를 강요하지 않고 충분히 설명한 뒤, 다음 행동을 정하는 것이 목적입니다. 올해 결과는 참고자료이며 이 자리에서 연봉 금액을 약속하지 않습니다.</div></div></details></div></section>';
}

function recordCard(d) {
  const r = d.rv.record; const st = reviewStatusOf(d.rv); const done = st === 'done'; const rl = RC_LABELS;
  const row2 = '<div class="jh-iv-grid">' + field(rl.date, done ? '' : '완료할 때 필수', '<input class="jh-input" type="date" data-iv-rf="date" max="' + esc(d.today) + '" value="' + esc(r.date) + '" aria-label="' + esc(rl.date) + '">') + field(rl.interviewer, '', '<input class="jh-input" type="text" data-iv-rf="interviewer" maxlength="' + RC_LIMITS.interviewer + '" value="' + esc(r.interviewer) + '" aria-label="' + esc(rl.interviewer) + '">') + '</div>';
  const bar = done ? '<button type="button" class="jh-btn" data-variant="primary" data-iv-act="rv-done"' + (d.busy ? ' disabled' : '') + '>수정 저장</button><button type="button" class="jh-btn" data-variant="secondary" data-iv-act="rv-reopen"' + (d.busy ? ' disabled' : '') + '>완료 취소</button>'
    : '<button type="button" class="jh-btn" data-variant="secondary" data-iv-act="rv-save"' + (d.busy ? ' disabled' : '') + '>임시저장</button><button type="button" class="jh-btn" data-variant="primary" data-iv-act="rv-done"' + (d.busy ? ' disabled' : '') + '>완료 처리</button>';
  return '<section class="jh-card">' + head('면담 기록 · 실행 합의', chip(REVIEW_STATUS_TEXT[st], stone(st))) + '<div class="jh-hr__pad"><div class="jh-field__hint">면담이 끝나면 합의한 내용을 남깁니다. 「완료 처리」하면 인사 &gt; 근로자 면담 이력에도 한 건이 남습니다. 완료할 때는 면담일 · 직원이 시작할 행동 · 중간 확인일이 필요합니다.</div>' + row2 +
    field(rl.summary, '', area('data-iv-rf="summary"', r.summary, 3, RC_LIMITS.summary, rl.summary)) + field(rl.employeeAction, done ? '' : '완료할 때 필수 · 관찰할 수 있는 행동으로', area('data-iv-rf="employeeAction"', r.employeeAction, 3, RC_LIMITS.employeeAction, rl.employeeAction)) +
    field(rl.measure, '무엇을 보고 확인할지', area('data-iv-rf="measure"', r.measure, 2, RC_LIMITS.measure, rl.measure)) + field(rl.support, '회사·사장단이 도울 일', area('data-iv-rf="support"', r.support, 2, RC_LIMITS.support, rl.support)) +
    '<div class="jh-iv-grid">' + field(rl.checkDate, done ? '' : '완료할 때 필수 · 언제 무엇으로 확인할지', '<input class="jh-input" type="date" data-iv-rf="checkDate" value="' + esc(r.checkDate) + '" aria-label="' + esc(rl.checkDate) + '">') + '<div></div></div>' +
    field(rl.disagreement, '있으면 그대로 적어 둡니다(적으면 인사 이력에 후속 조치 표시)', area('data-iv-rf="disagreement"', r.disagreement, 3, RC_LIMITS.disagreement, rl.disagreement)) +
    '<div class="jh-hr__bar">' + bar + '<button type="button" class="jh-btn" data-variant="ghost" data-iv-act="rv-print">인쇄</button></div></div></section>';
}

/** 직원 한 명의 면담 준비·기록 */
export function interviewDetailHtml(st) {
  const iv = st.iv; const d = iv.d; const w = d.worker; const p = evalPeriod(iv.year) || { from: '', to: '' };
  const top = '<section class="jh-card">' + head(esc(w.name || '') + ' · 면담 준비·기록 (' + esc(iv.year) + '년 인사평가)', '<button type="button" class="jh-btn" data-variant="ghost" data-iv-act="back">← 목록</button>') + '<div class="jh-hr__pad"><div class="jh-field__hint">' + esc([w.dept, w.rank].filter(Boolean).join(' · ')) + ' · 평가 기간 ' + esc(p.from) + ' ~ ' + esc(p.to) + ' · 이 화면의 기록은 사장단·관리자만 볼 수 있고 직원에게는 공개되지 않습니다.</div></div></section>';
  return top + prepCard(d) + selfCard(d) + evidenceCard(d) + guideCard() + recordCard(d);
}
