/* 내 평가 화면(마크업만) — 폰 우선: 목록 → 작성 → 제출. 한 화면에 한 과제, 큰 버튼, 가로 스크롤 없음. 저장·불러오기는 mine-io.js */
import { esc } from '../../core/ui.js?v=20261113a';
import { KINDS, STATUS_TEXT, itemsOf, statusOf, progressOf, canSubmit, MAX_TEXT } from './mine-logic.js?v=20261113a';
import { parseSelf, LIMITS, MAX_TEXT as SELF_MAX } from './self-form.js?v=20261113a';
const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const stone = (s) => (s === 'submitted' ? 'accent' : s === 'draft' ? 'warn' : 'muted');

/** 평가 기간 안내 — status: open(작성 가능) | closed(마감) | published(공개) | 없음 */
export function periodNote(cycle, year) {
  const st = cycle && cycle.status;
  if (st === 'open') return '<div class="jh-field__hint">' + esc(year) + '년 평가 기간입니다. 점수를 누르면 자동으로 임시저장되고, <strong>제출하면 수정할 수 없습니다.</strong></div>';
  if (st === 'closed' || st === 'published') return '<div class="jh-field__hint" data-tone="warn">' + esc(year) + '년 평가 기간이 끝났습니다. 제출한 평가는 아래에서 볼 수 있고, 더 이상 작성·수정할 수 없습니다.</div>';
  return '<div class="jh-field__hint" data-tone="warn">' + esc(year) + '년 평가가 아직 열리지 않았습니다. 평가 기간이 시작되면 이곳에 알림이 나타납니다.</div>';
}
/** 목록: 내게 배정된 평가 */
export function mineListHtml(st) {
  const m = st.mine; const prog = progressOf(m.tasks, m.subs); const open = m.cycle && m.cycle.status === 'open';
  const head = '<section class="jh-card"><div class="jh-panel__head"><h3>내 평가 ' + esc(m.year) + '</h3>' + (m.tasks.length ? chip('제출 ' + prog.done + ' / ' + prog.total, prog.left === 0 ? 'accent' : 'warn') : '') + '</div><div class="jh-hr__pad">' + periodNote(m.cycle, m.year)
    + '<div class="jh-field__hint">동료평가는 <strong>익명</strong>입니다 — 누가 어떤 점수를 줬는지는 사장단·인사팀·관리자도 볼 수 없고, 평균만 반영됩니다(평가자가 2명 미만이면 반영하지 않습니다). 올해 평가는 참고자료로만 쓰입니다.</div></div></section>';
  if (!m.worker) return head + '<section class="jh-card"><div class="jh-empty">내 계정이 근로자 명부와 연결되어 있지 않습니다. 인사총무팀에 연결을 요청해 주세요.</div></section>';
  if (!m.tasks.length) return head + '<section class="jh-card"><div class="jh-empty">나에게 배정된 평가가 없습니다.' + (open ? '' : ' 평가 기간이 시작되면 배정됩니다.') + '</div></section>';
  const groups = ['self', 'lead', 'peer'].map((k) => { const ts = m.tasks.filter((t) => t.kind === k); if (!ts.length) return ''; return '<div class="jh-eval-group"><div class="jh-hr__label">' + esc(KINDS[k]) + '</div>' + ts.map((t) => { const s = statusOf(m.subs[t.key]); return '<button type="button" class="jh-eval-item" data-ev-open="' + esc(t.key) + '"><span class="jh-eval-item__name">' + esc(k === 'self' ? '나의 자기평가' : t.name) + '</span>' + chip(STATUS_TEXT[s], stone(s)) + '</button>'; }).join('') + '</div>'; }).join('');
  return head + '<section class="jh-card"><div class="jh-hr__pad">' + groups + '</div></section>';
}
/** 점수 한 줄: 5개의 큰 버튼 */
function rateRow(item, cur, locked) {
  let dots = ''; for (let n = 1; n <= 5; n++) dots += '<button type="button" class="jh-eval-dot" data-ev-score="' + esc(item.key + '|' + n) + '" aria-pressed="' + (cur === n) + '" aria-label="' + esc(item.label + ' ' + n + '점') + '"' + (locked ? ' disabled' : '') + '>' + n + '</button>';
  return '<div class="jh-eval-rate"><div class="jh-eval-rate__q"><strong>' + esc(item.label) + '</strong><span class="jh-field__hint">' + esc(item.hint || '') + '</span></div><div class="jh-eval-dots" role="group" aria-label="' + esc(item.label) + ' 점수">' + dots + '</div><div class="jh-eval-scale"><span>1 매우 아쉬움</span><span>5 매우 좋음</span></div></div>';
}
/** 자기평가 칸별 입력(성과 3 · 아쉬운 점 2 · 성장 목표 · 필요한 지원 · 그 밖에) — 저장은 mine-io 가 칸 값을 self-form.composeSelf 로 text 한 필드에 합친다 */
export function selfFieldsHtml(text, locked) {
  const p = parseSelf(text); const dis = locked ? ' disabled' : '';
  const inp = (k, v, ph, lim, label) => '<input class="jh-input" type="text" data-ev-self="' + k + '" maxlength="' + lim + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '"' + dis + '>';
  const area = (k, v, ph, lim, label) => '<textarea class="jh-textarea" rows="2" data-ev-self="' + k + '" maxlength="' + lim + '" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '"' + dis + '>' + esc(v) + '</textarea>';
  const field = (label, hint, body) => '<div class="jh-field"><label class="jh-field__label">' + label + ' <span class="jh-field__hint">' + hint + '</span></label>' + body + '</div>';
  const wins = ['예) 10월 A동 설치 일정을 예정보다 2일 앞당겼다', '예) 신입 2명의 현장 교육을 맡아 투입 시기를 줄였다', '예) 안전점검 지적 사항 없이 한 해를 마쳤다'].map((ph, i) => inp('wins.' + i, p.wins[i], ph, LIMITS.win, '올해 성과 ' + (i + 1))).join('');
  const gaps = ['예) 자재 입고 일정 공유가 늦어 대기 시간이 생겼다', '예) 작업일보 제출이 며칠 밀린 때가 있었다'].map((ph, i) => inp('gaps.' + i, p.gaps[i], ph, LIMITS.gap, '아쉬운 점 ' + (i + 1))).join('');
  return '<div data-ev-selfform>' + field('올해 성과', '최대 3개 · 한 가지 이상 필수', '<div class="jh-eval-slots">' + wins + '</div>') + field('아쉬운 점', '최대 2개 · 숨기지 말고 솔직하게', '<div class="jh-eval-slots">' + gaps + '</div>') +
    field('내년 성장 목표', '1개 · 무엇을 어떻게 키우고 싶은지', area('goal', p.goal, '예) 배관 도면을 혼자 읽고 현장에서 수정 제안까지 할 수 있게 되기', LIMITS.goal, '내년 성장 목표')) +
    field('회사나 팀장에게 필요한 지원', '선택', area('support', p.support, '예) 월 1회 도면 해석 교육, 작업 일정 사전 공유', LIMITS.support, '필요한 지원')) +
    field('그 밖에 하고 싶은 말', '선택', area('etc', p.etc, '면담에서 꼭 이야기하고 싶은 것', LIMITS.etc, '그 밖에 하고 싶은 말')) + '<div class="jh-field__hint">최대 ' + SELF_MAX + '자 · 칸을 비워 둬도 됩니다(올해 성과만 한 가지 이상 필요)</div></div>';
}

/** 작성 화면: 한 과제 */
export function mineFormHtml(st) {
  const m = st.mine; const t = m.tasks.find((x) => x.key === m.sel); if (!t) return '';
  const sub = m.draft || { scores: {}, text: '' }; const stat = statusOf(m.subs[t.key]); const locked = stat === 'submitted' || !(m.cycle && m.cycle.status === 'open');
  const can = canSubmit(t.kind, sub); const items = itemsOf(t.kind);
  const title = t.kind === 'self' ? '나의 자기평가' : KINDS[t.kind] + ' — ' + esc(t.name);
  const guide = t.kind === 'peer' ? '같은 팀 동료로서 함께 일하며 본 모습을 평가해 주세요. <strong>익명</strong>으로 처리됩니다.' : t.kind === 'lead' ? '팀장으로서 이 팀원의 한 해를 영역별로 평가해 주세요. 사장단이 확인합니다.' : '올해 성과 3개 · 아쉬운 점 2개 · 내년 성장 목표 1개를 중심으로 써 주세요. 점수에 반영되지 않고 면담 자료로 쓰입니다.';
  const scores = items.map((i) => rateRow(i, sub.scores ? sub.scores[i.key] : null, locked)).join('');
  const textLabel = '남기고 싶은 말(선택)';
  const textBox = '<div class="jh-field"><label class="jh-field__label" for="ev-text">' + textLabel + '</label><textarea id="ev-text" class="jh-textarea" rows="5" maxlength="' + MAX_TEXT + '" data-ev-text' + (locked ? ' disabled' : '') + '>' + esc(sub.text || '') + '</textarea><div class="jh-field__hint">' + (t.kind === 'peer' ? '이름이나 사적인 내용은 쓰지 마세요. 서술은 평균에 반영되지 않으며 본인만 볼 수 있습니다.' : '') + ' 최대 ' + MAX_TEXT + '자</div></div>';
  const text = t.kind === 'self' ? selfFieldsHtml(sub.text, locked) : textBox;
  const bar = '<div class="jh-eval-bar"><button type="button" class="jh-btn" data-variant="ghost" data-ev-act="back">← 목록</button>' + (locked ? '' : '<button type="button" class="jh-btn" data-variant="secondary" data-ev-act="save">임시저장</button><button type="button" class="jh-btn" data-variant="primary" data-ev-act="submit"' + (can.ok ? '' : ' aria-disabled="true"') + '>제출</button>') + '</div>';
  const note = stat === 'submitted' ? '<div class="jh-field__hint" data-tone="accent">제출했습니다. 수정할 수 없습니다.</div>' : locked ? '<div class="jh-field__hint" data-tone="warn">지금은 작성할 수 없습니다(평가 기간이 아닙니다).</div>' : can.ok ? '<div class="jh-field__hint">제출할 수 있습니다. 제출하면 수정할 수 없으니 한 번 더 확인해 주세요.</div>' : '<div class="jh-field__hint">' + esc(can.reason) + '</div>';
  return '<section class="jh-card"><div class="jh-panel__head"><h3>' + title + '</h3>' + chip(STATUS_TEXT[stat], stone(stat)) + '</div><div class="jh-hr__pad"><div class="jh-field__hint">' + guide + '</div>' + scores + text + note + bar + '</div></section>';
}
