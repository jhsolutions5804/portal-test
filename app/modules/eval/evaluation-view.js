/* 인사평가 — 정기평가 운영 화면(테섭 미리보기). 마크업만 만든다(저장·불러오기는 evaluation-io.js). 설계서 docs/hr-evaluation-design.md */
import { withManage } from '../../shared/eval-perm.js?v=20261030a';
import { esc } from '../../core/ui.js?v=20261030a';
import { DEPT_ORDER } from '../../shared/org.js?v=20261030a';
import { evalPeriod, teamCriteria, teamTypeOf, areaItems, AREA_LABELS, WEIGHTS_BY, cycleSummary, peerAggNote, leadAreasOf, leadNote, emptyCycle, STATUS_LABEL, gradeOf, teamLeaderOf, evalAccess } from './evaluation.js?v=20261030a';
const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const gtone = (g) => (g === 'S' || g === 'A' ? 'accent' : g === 'C' ? 'danger' : 'muted');
const stone = (s) => (s === 'confirmed' ? 'accent' : s === 'team_done' ? 'accent' : s === 'rating' ? 'warn' : 'muted');
const fmt = (n) => (n == null ? '-' : String(n));
export const LEVEL_LABEL = { exec: '사장단', hr: '인사팀', self: '본인', none: '권한 없음' };

/** 팀별 보드: 팀(부서)마다 팀장·대상자·진행 상태·점수 */
export function evalBoardHtml(st) {
  const ec = st.ec; const per = evalPeriod(ec.year); const acc = evalAccess(withManage(ec.me), { id: '' }, {});
  const note = '<div class="jh-hr__pad"><div class="jh-hr__bar">' + chip('평가 기간 ' + per.from + ' ~ ' + per.to, 'muted') + chip('올해(' + ec.year + ')는 참고자료로만 사용', 'warn') + chip('내 권한: ' + LEVEL_LABEL[acc.level], acc.level === 'none' ? 'danger' : 'accent') + '</div>'
    + '<div class="jh-field__hint">미리보기(테섭): 실제 운영에서는 팀장·동료·직원이 각자 로그인해 입력합니다. 여기서는 사장단 계정이 대신 입력해 화면과 계산을 확인합니다. 팀장은 <strong>직원 관리 → 팀장</strong>에서 팀마다 지정하고, 지정이 없으면 팀 최상급자가 1차 평가자가 됩니다. 평가 대상은 평가 기간 끝(' + per.to + ') 이전 입사자이며 올해 4분기 입사자는 제외됩니다.</div></div>';
  if (acc.level === 'none') return card('정기평가 ' + ec.year, note + '<div class="jh-empty">인사평가를 볼 수 있는 권한이 없습니다. 직원 관리에서 "인사평가" 권한을 받으면 열람할 수 있습니다.</div>');
  const byDept = new Map(); (ec.eligible || []).forEach((w) => { const d = String(w.dept || '').trim() || '(미지정)'; if (!byDept.has(d)) byDept.set(d, []); byDept.get(d).push(w); });
  const order = [...byDept.keys()].sort((a, b) => { const ia = DEPT_ORDER.indexOf(a), ib = DEPT_ORDER.indexOf(b); return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, 'ko'); });
  const teams = order.map((d) => {
    const mem = byDept.get(d); const type = teamTypeOf(d); const lead = teamLeaderOf(d, mem, ec.users);
    const leader = lead.source === 'none' ? chip('팀장 없음', 'danger') : chip('팀장(1차 평가자) ' + (lead.name || '-') + (lead.source === 'rank' ? ' · 최상급자 자동' : ''), lead.source === 'flag' ? 'accent' : 'muted');
    const rows = mem.map((w) => { const cy = ec.cycles[w.id]; const items = areaItems(w.dept, w.rank); const sm = cycleSummary(cy, { teamType: type, items });
      return '<tr><td><strong>' + esc(w.name || '-') + '</strong> <span class="jh-field__hint">' + esc(w.rank || '') + '</span>' + (lead.workerId === w.id ? ' ' + chip('팀장', 'accent') : '') + '</td><td>' + chip(STATUS_LABEL[sm.status], stone(sm.status)) + '</td><td>' + esc(fmt(sm.teamScore)) + '</td><td>' + esc(fmt(sm.final)) + (sm.grade ? ' ' + chip(sm.grade, gtone(sm.grade)) : '') + '</td><td><button type="button" class="jh-btn" data-variant="secondary" data-ec-open="' + esc(w.id) + '">' + (acc.edit ? '평가' : '보기') + '</button></td></tr>'; }).join('');
    const w = WEIGHTS_BY(type); const wt = '업적 ' + w.achievement + ' · 역량 ' + w.competency + ' · 태도·근태·안전 ' + w.conduct + (w.peer ? ' · 동료 ' + w.peer : '');
    return card(d + ' · ' + mem.length + '명', '<div class="jh-hr__pad"><div class="jh-hr__bar">' + chip(type === 'pjt' ? 'PJT팀 — 팀장 + 동료평가' : '비프로젝트 팀 — 사장단 평가', 'muted') + leader + '<span class="jh-field__hint">' + esc(wt) + '</span></div></div><div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>이름</th><th>진행</th><th>팀 점수</th><th>최종 · 등급</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }).join('');
  return card('정기평가 ' + ec.year, note) + (teams || '<div class="jh-empty">평가 대상자가 없습니다(근로자 명부의 입사일·직급·소속을 확인해 주세요).</div>');
}
/** 5점 척도 한 줄 */
function rateRow(label, vals, idx, key, disabled) {
  const cur = vals ? vals[idx] : null; let dots = '';
  for (let n = 1; n <= 5; n++) dots += '<button type="button" class="jh-hr-ev__dot" data-ec-score="' + esc(key + '|' + idx + '|' + n) + '" aria-pressed="' + (cur === n) + '"' + (disabled ? ' disabled' : '') + '>' + n + '</button>';
  return '<div class="jh-hr-ev__rate"><span>' + esc(label) + '</span><span class="jh-hr-ev__dots" role="group" aria-label="' + esc(label) + ' 점수">' + dots + '</span></div>';
}
function areasHtml(areas, items, prefix, disabled) {
  return ['achievement', 'competency', 'conduct'].map((k) => '<div class="jh-hr-ev__area"><div class="jh-hr__label">' + esc(AREA_LABELS[k]) + '</div>' + items[k].map((l, i) => rateRow(l, areas && areas[k], i, prefix + k, disabled)).join('') + '</div>').join('');
}
const cell = (label, value, sub) => '<div class="jh-hr-ev__cell"><span class="jh-field__hint">' + esc(label) + '</span><strong>' + esc(value) + '</strong>' + (sub ? '<span class="jh-field__hint">' + esc(sub) + '</span>' : '') + '</div>';
/** 대상자 한 명의 평가 패널 */
export function evalPanelHtml(st) {
  const ec = st.ec; const w = (ec.eligible || []).find((x) => x.id === ec.sel); if (!w) return '';
  const d = ec.draft || emptyCycle(w, ec.year); const type = teamTypeOf(w.dept); const items = areaItems(w.dept, w.rank);
  const acc = evalAccess(withManage(ec.me), { id: ec.meWorkerId || '' }, {}); const lock = d.confirmed === true; const canEdit = acc.edit && !lock; const dis = !canEdit;
  const sm = cycleSummary(d, { teamType: type, items }); const mem = (ec.eligible || []).filter((x) => String(x.dept || '').trim() === String(w.dept || '').trim());
  const lead = teamLeaderOf(w.dept, mem, ec.users); const meUid = (ec.me && ec.me.uid) || '';
  const execAreas = (d.exec && d.exec[meUid] && d.exec[meUid].areas) || null;
  const leadAreas = type === 'pjt' ? leadAreasOf(d.leadAgg, items) : null; const ln = leadNote(sm, st.ca && st.ca.cycle && st.ca.cycle.status);
  const main = type === 'pjt'
    ? '<div class="jh-hr__sub">1차 평가 — 팀장' + (lead.name ? ' ' + esc(lead.name) : '') + ' <span class="jh-field__hint">' + (leadAreas ? '(팀장이 "내 평가"에서 제출한 영역 점수 — 서버가 마감 후 집계, 읽기 전용)' : '(팀장이 아직 제출·집계되지 않았으면 사장단 계정이 대신 입력할 수 있습니다)') + '</span></div>' + '<div class="jh-field__hint" data-tone="' + ln.tone + '">' + esc(ln.text) + '</div>' + areasHtml(leadAreas || (d.team && d.team.areas), items, 'team:', dis || !!leadAreas)
    : '<div class="jh-hr__sub">사장단 평가 — ' + esc((ec.me && ec.me.name) || '내 평가') + ' <span class="jh-field__hint">(사장단 3명이 각자 평가하고 평균을 팀 점수로 사용 · 현재 완료 ' + sm.raters + '명)</span></div>' + areasHtml(execAreas, items, 'exec:', dis);
  const pn = peerAggNote(sm, st.ca && st.ca.cycle && st.ca.cycle.status); const peerBlock = type === 'pjt' ? '<div class="jh-hr-ev__area"><div class="jh-hr__sub">동료평가 <span class="jh-field__hint">같은 팀 안에서만 · 직원이 "내 평가"에서 직접 입력 · 평가자별 점수는 누구도 볼 수 없고 평균만 반영(2명 미만이면 반영 안 함)</span></div><div class="jh-field__hint" data-tone="' + pn.tone + '">' + esc(pn.text) + '</div></div>' : '';
  const selfBlock = '<div class="jh-field"><label class="jh-field__label">자기평가 <span class="jh-field__hint">점수에 넣지 않고 면담 자료로 씁니다 (올해 성과·성장·개선 요청)</span></label><textarea class="jh-textarea" rows="3" data-ec-self' + (dis ? ' disabled' : '') + ' placeholder="미리보기: 직원이 직접 쓰는 칸입니다">' + esc((d.self && d.self.text) || '') + '</textarea></div>';
  const ceo = d.ceo || {}; const base = sm.teamScore;
  const ceoBlock = '<div class="jh-hr-ev__area"><div class="jh-hr__sub">최종 확정 — 대표 <span class="jh-field__hint">팀 점수 50% + 대표 점수 50% · "그대로 승인"이면 팀 점수 그대로</span></div>'
    + '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-ec-act="approve"' + (acc.confirm && !lock && base != null ? '' : ' disabled') + '>팀 결과 그대로 승인</button>'
    + '<input class="jh-input" style="max-width:8rem" inputmode="decimal" data-ec-ceo="score" placeholder="대표 점수(0~100)" value="' + esc(ceo.score == null ? '' : ceo.score) + '"' + (acc.confirm && !lock ? '' : ' disabled') + '>'
    + '<input class="jh-input" style="max-width:22rem" data-ec-ceo="comment" placeholder="대표 코멘트(선택)" value="' + esc(ceo.comment || '') + '"' + (acc.confirm && !lock ? '' : ' disabled') + '>'
    + '<button type="button" class="jh-btn" data-variant="secondary" data-ec-act="confirm"' + (acc.confirm && !lock && base != null ? '' : ' disabled') + '>점수로 확정</button>' + (lock && acc.confirm ? '<button type="button" class="jh-btn" data-variant="ghost" data-ec-act="unconfirm">확정 취소</button>' : '') + '</div>'
    + (acc.confirm ? '' : '<div class="jh-field__hint">최종 확정은 대표만 할 수 있습니다' + (acc.level === 'hr' ? ' (인사팀은 열람·운영만)' : '') + '.</div>') + '</div>';
  const result = '<div class="jh-hr-ev__score">' + cell('팀 점수', fmt(sm.teamScore), type === 'pjt' ? '팀장 평가 + 동료' : '사장단 ' + sm.raters + '명 평균') + cell('대표 점수', ceo.approved ? '그대로 승인' : fmt(sm.ceoScore)) + cell('최종 점수', fmt(sm.final), lock ? '확정됨' : '확정 전') + cell('등급', sm.grade || '-', sm.grade ? '' : 'S 90↑ · A 80↑ · B 65↑ · C') + '</div>';
  const actions = '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-ec-act="save"' + (canEdit || (acc.confirm && !lock) ? '' : ' disabled') + '>저장</button><button type="button" class="jh-btn" data-variant="ghost" data-ec-act="back">← 팀 목록</button>' + (acc.level === 'hr' ? '<span class="jh-field__hint">인사팀은 열람·운영만 가능하고 평가 입력·확정은 사장단이 합니다.</span>' : '') + (lock ? '<span class="jh-field__hint">확정된 평가는 수정할 수 없습니다(대표가 확정 취소 후 수정).</span>' : '') + '</div>';
  return card((w.name || '') + ' · ' + (w.dept || '') + ' · ' + (w.rank || ''), '<div class="jh-hr__pad">' + result + main + peerBlock + selfBlock + ceoBlock + actions + '</div>', chip(STATUS_LABEL[sm.status], stone(sm.status)));
}
