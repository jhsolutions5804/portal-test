import { esc } from '../../core/ui.js?v=20261007c';
import { summaryText, userLabel } from './logic.js?v=20261007c';

export const tabsHtml = (cur) => '<div class="jh-segmented jh-admin__tabs" role="group" aria-label="포털 관리">' + [['pjt', 'PJT 참여']].map(([k, l]) => '<a class="jh-segmented__item" href="#/admin/' + k + '" aria-pressed="' + (k === cur) + '">' + l + '</a>').join('') + '</div>';
const chipBtn = (t, on) => '<button type="button" class="jh-admin__chip" data-team="' + esc(t) + '" aria-pressed="' + on + '">' + esc(t) + '</button>';
export function projectCardHtml(p, usersByUid, editing, users, depts) {
  const head = '<div class="jh-panel__head"><h3>' + (p.kind === 'fixed' ? '🏗️ ' : '📐 ') + esc(p.name) + '</h3>' + (p.status === 'ended' ? '<span class="jh-chip">종료</span>' : '') + '</div>';
  const sum = '<p class="jh-admin__sum">' + esc(summaryText(editing ? editing.draft : p.participants, usersByUid)) + '</p>';
  if (!editing) return '<section class="jh-card jh-admin__proj" data-pid="' + esc(p.key) + '">' + head + '<div class="jh-form">' + sum + '<div><button type="button" class="jh-btn" data-variant="secondary" data-edit>참여 부서·개인 지정</button></div></div></section>';
  const d = editing.draft; const taken = new Set(d.members);
  const mem = d.members.length ? d.members.map((id) => '<span class="jh-admin__member">' + esc(usersByUid[id] ? usersByUid[id].name : '(알 수 없는 계정)') + '<button type="button" class="jh-iconbtn" data-del-member="' + esc(id) + '" aria-label="' + esc((usersByUid[id] ? usersByUid[id].name : '') + ' 지정 해제') + '">✕</button></span>').join('') : '<span class="jh-field__hint">지정한 개인이 없습니다.</span>';
  const opts = users.filter((u) => !taken.has(u.uid)).map((u) => '<option value="' + esc(u.uid) + '">' + esc(userLabel(u)) + '</option>').join('');
  return '<section class="jh-card jh-admin__proj" data-pid="' + esc(p.key) + '" data-editing="true">' + head + '<div class="jh-form">' + sum +
    '<div class="jh-field"><span class="jh-field__label">참여 부서 <small>(눌러서 선택·해제)</small></span><div class="jh-admin__chips">' + depts.map((t) => chipBtn(t, d.teams.indexOf(t) !== -1)).join('') + '</div></div>' +
    '<div class="jh-field"><span class="jh-field__label">참여 개인 <small>(부서와 따로 한 사람씩 추가)</small></span><div class="jh-admin__members">' + mem + '</div><div class="jh-admin__add"><select class="jh-input" data-member-pick aria-label="추가할 직원"><option value="">직원 선택…</option>' + opts + '</select><button type="button" class="jh-btn" data-variant="secondary" data-add-member>추가</button></div></div>' +
    '<p class="jh-field__hint">비워 두면 지금까지처럼 <strong>PJT 권한이 있는 사람 모두</strong>가 이 프로젝트에 들어갑니다. 하나라도 지정하면 <strong>지정된 부서·개인(과 관리자)만</strong> 들어갈 수 있습니다. 연명부는 이 지정과 별개로 PJT 권한자·관리자만 봅니다.</p>' +
    '<div class="jh-admin__actions"><button type="button" class="jh-btn" data-variant="primary" data-save>저장</button><button type="button" class="jh-btn" data-variant="ghost" data-cancel>취소</button><button type="button" class="jh-btn" data-variant="ghost" data-clear>지정 모두 해제</button></div></div></section>';
}
