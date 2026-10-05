import { esc } from '../../core/ui.js?v=20261006c';
import { GUIDE_TYPES, LIMITS, canEditPolicy, candidates, personLabel, guideNotes, isDirty } from './settings-logic.js?v=20261006c';

const itemHtml = (state, scope, uid, idx, len, opts) => {
  const o = opts || {};
  return '<li class="jh-line-item" data-uid="' + esc(uid) + '"' + (o.locked ? ' data-locked="true"' : '') + '>' +
    (o.order ? '<span class="jh-line-item__order">' + esc(o.order) + '</span>' : '') +
    '<span class="jh-line-item__name">' + esc(personLabel(state, uid)) + '</span>' + (o.tag ? '<span class="jh-line-item__tag">' + esc(o.tag) + '</span>' : '') +
    (o.readonly ? '' : '<span class="jh-line-item__actions">' +
      (o.move ? '<button type="button" class="jh-iconbtn" data-move="' + esc(scope) + ':' + esc(uid) + ':-1" aria-label="위로"' + (idx === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="jh-iconbtn" data-move="' + esc(scope) + ':' + esc(uid) + ':1" aria-label="아래로"' + (idx === len - 1 ? ' disabled' : '') + '>↓</button>' : '') +
      '<button type="button" class="jh-iconbtn" data-remove="' + esc(scope) + ':' + esc(uid) + '" aria-label="빼기">×</button></span>') + '</li>';
};
const listHtml = (state, scope, list, label, opts) => list.length
  ? '<ol class="jh-line-editor__list">' + list.map((u, i) => itemHtml(state, scope, u, i, list.length, Object.assign({}, opts, { order: opts && opts.numbered ? label + (list.length > 1 ? i + 1 : '') : label }))).join('') + '</ol>'
  : '<p class="jh-field__hint">지정된 사람이 없습니다.</p>';
const addRow = (state, scope, exclude, asApprover, disabled, id) => {
  const cands = candidates(state, exclude, asApprover);
  return '<div class="jh-admin__add"><select class="jh-select" data-add-sel="' + esc(scope) + '" aria-label="추가할 사람"' + (disabled ? ' disabled' : '') + '><option value="">사람 선택…</option>' +
    cands.map((u) => '<option value="' + esc(u.uid) + '">' + esc(u.name + (u.rank ? ' ' + u.rank : '') + (u.dept ? ' · ' + u.dept : '')) + '</option>').join('') + '</select>' +
    '<button type="button" class="jh-btn" data-variant="secondary" data-add="' + esc(scope) + '"' + (disabled ? ' disabled' : '') + '>추가</button></div>';
};
const saveBar = (state, section, key, dirty, disabled) => {
  const busy = state.saving === section + ':' + (key || '');
  return '<div class="jh-admin__save"><span class="jh-admin__state" data-dirty="' + (dirty ? 'true' : 'false') + '">' + (busy ? '저장 중…' : dirty ? '저장하지 않은 변경이 있습니다' : '변경 없음') + '</span>' +
    '<button type="button" class="jh-btn" data-variant="primary" data-save="' + esc(section + (key ? ':' + key : '')) + '"' + (!dirty || busy || disabled ? ' disabled' : '') + '>저장</button></div>';
};

export function policyHtml(state) {
  const editable = canEditPolicy(state.me, state.policy);
  const p = state.policy;
  return '<section class="jh-card jh-admin__section" id="adm-policy"><h3 class="jh-admin__h">필수 결재자 · 대리 승인(전결) 권한</h3>' +
    (editable ? '' : '<div class="jh-alert" data-tone="info" role="status">이 설정은 필수 결재자(대표)만 바꿀 수 있습니다. 지금은 보기만 가능합니다.</div>') +
    '<div class="jh-admin__group"><h4 class="jh-admin__h2">필수 결재자 <small>모든 결재선에 반드시 들어갑니다 (최대 ' + LIMITS.required + '명)</small></h4>' +
      listHtml(state, 'policy.required', p.required, '필수', { tag: '필수', locked: true, readonly: !editable }) + addRow(state, 'policy.required', p.required, true, !editable) + '</div>' +
    '<div class="jh-admin__group"><h4 class="jh-admin__h2">대리 승인 · 전결 권한자 <small>다른 결재자 차례에도 승인할 수 있고, 승인과 함께 게시(전결)할 수 있습니다 (최대 ' + LIMITS.proxy + '명)</small></h4>' +
      listHtml(state, 'policy.proxy', p.proxy, '권한', { tag: '전결', readonly: !editable }) + addRow(state, 'policy.proxy', p.proxy, true, !editable) + '</div>' +
    saveBar(state, 'policy', '', isDirty(state, 'policy'), !editable) + '</section>';
}
export function guideHtml(state, t) {
  const g = state.guides[t.key]; const open = state.open === t.key; const dirty = isDirty(state, 'guides', t.key);
  const notes = guideNotes(g, state.policy, state);
  const summary = g.steps.length ? g.steps.map((u) => personLabel(state, u)).join(' → ') + (g.cc.length ? ' (참조 ' + g.cc.length + ')' : '') : '권장 결재선 없음';
  return '<section class="jh-card jh-admin__section" data-guide="' + esc(t.key) + '"><button type="button" class="jh-admin__toggle" data-toggle="' + esc(t.key) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
    '<span class="jh-admin__title">' + esc(t.icon) + ' ' + esc(t.label) + (dirty ? ' <span class="jh-chip" data-tone="warn">변경됨</span>' : '') + '</span><span class="jh-admin__sum">' + esc(summary) + '</span></button>' +
    (open ? '<div class="jh-admin__body">' +
      '<div class="jh-admin__group"><h4 class="jh-admin__h2">결재 순서 <small>위에서 아래로 결재합니다 (최대 ' + LIMITS.approvers + '명)</small></h4>' + listHtml(state, t.key + '.steps', g.steps, '결재', { numbered: true, move: true }) + addRow(state, t.key + '.steps', g.steps.concat(g.cc), true, false) + '</div>' +
      '<div class="jh-admin__group"><h4 class="jh-admin__h2">참조 <small>열람만 합니다 (최대 ' + LIMITS.cc + '명)</small></h4>' + listHtml(state, t.key + '.cc', g.cc, '참조', {}) + addRow(state, t.key + '.cc', g.steps.concat(g.cc), false, false) + '</div>' +
      '<label class="jh-field"><span class="jh-field__label">메모 (작성 화면의 권장 결재선 아래에 보입니다)</span><input class="jh-input" data-note="' + esc(t.key) + '" maxlength="100" value="' + esc(g.note) + '" placeholder="예) 팀장 확인 후 대표님 결재"></label>' +
      notes.map((n) => '<p class="jh-field__hint">ℹ ' + esc(n) + '</p>').join('') +
      saveBar(state, 'guides', t.key, dirty, false) + '</div>' : '') + '</section>';
}
export function companyHtml(state) {
  const c = state.company; const f = (k, label, ph, max) => '<label class="jh-field"><span class="jh-field__label">' + label + '</span><input class="jh-input" data-co="' + k + '" maxlength="' + max + '" value="' + esc(c[k]) + '" placeholder="' + esc(ph) + '"></label>';
  return '<section class="jh-card jh-admin__section" id="adm-company"><h3 class="jh-admin__h">회사 정보 <small>재직증명서 등 인쇄 문서에 들어갑니다</small></h3>' +
    '<div class="jh-admin__grid">' + f('name', '상호', '제이에이치솔루션', 60) + f('ceo', '대표자', '김종화', 40) + f('bizNo', '사업자등록번호', '000-00-00000', 30) + '</div>' + f('address', '주소', '사업장 주소', 200) +
    saveBar(state, 'company', '', isDirty(state, 'company'), false) + '</section>';
}
export function adminHtml(state) {
  return '<div class="jh-admin"><div class="jh-pagehead"><header class="jh-form__head"><h2 class="jh-form__title">전자결재 관리자 설정</h2><p class="jh-form__sub">권장 결재선, 필수 결재자·전결 권한, 인쇄용 회사 정보를 관리합니다. 저장은 서버가 한 번 더 검증하며 이력이 남습니다.</p></header>' +
    '<button type="button" class="jh-btn" data-variant="secondary" data-back>← 전자결재 홈</button></div>' +
    policyHtml(state) + '<h3 class="jh-admin__h jh-admin__h--top">문서별 권장 결재선 <small>작성 화면에서 처음 채워지는 결재선입니다. 작성자가 바꿀 수 있고 차단되지는 않습니다.</small></h3>' +
    GUIDE_TYPES.map((t) => guideHtml(state, t)).join('') + companyHtml(state) + '</div>';
}
