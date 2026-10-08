import { esc } from '../../core/ui.js?v=20261008i';
import { MAX_FILES, ACCEPT, fmtSize } from './attach-logic.js?v=20261008i';
import { isAnnualType } from './home-calc.js?v=20261008i';
import { COMPOSE_TYPES, composeType, fieldRows, emptyItem, isLocked, guideStatus, lineIssues, MAX_APPROVERS, MAX_CC } from './compose.js?v=20261008i';

const uname = (ctx, uid) => { const u = ctx.byUid[uid]; return u ? esc(u.name) + (u.rank ? ' <small>' + esc(u.rank) + '</small>' : '') : '(알 수 없음)'; };

/** 새 문서 종류 고르기 */
export function chooserHtml() {
  return '<div class="jh-form"><header class="jh-form__head"><h2 class="jh-form__title">새 문서</h2><p class="jh-form__sub">작성할 문서 종류를 고르세요.</p></header>' +
    '<div class="jh-doclist">' + COMPOSE_TYPES.map((t) =>
      '<button type="button" class="jh-docrow" data-new-type="' + esc(t.key) + '"><span class="jh-docrow__main"><span class="jh-docrow__title">' + esc(t.icon) + ' ' + esc(t.label) + '</span>' +
      '<span class="jh-docrow__meta">' + esc(t.desc) + '</span></span><span class="jh-docrow__side"><span class="jh-chip" data-tone="accent">작성</span></span></button>').join('') +
    '</div><div class="jh-form__foot"><button type="button" class="jh-btn" data-variant="ghost" data-act="cancel">닫기</button></div></div>';
}

function control(f, v, errs, ctx) {
  const id = 'f-' + f.key; const val = v[f.key] == null ? '' : v[f.key];
  const common = ' id="' + id + '" data-input="' + esc(f.key) + '"' + (f.required ? ' aria-required="true"' : '');
  if (f.type === 'textarea') return '<textarea class="jh-textarea"' + common + ' placeholder="' + esc(f.ph || '') + '">' + esc(val) + '</textarea>';
  if (f.type === 'select') return '<select class="jh-select"' + common + '>' + f.opts.map((o) => '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
  if (f.type === 'person') return '<select class="jh-select"' + common + '><option value="">대리인을 선택하세요</option>' + (ctx.users || []).filter((u) => u.uid !== ctx.me.uid && !/^guest/i.test(u.empNo || '')).map((u) => '<option value="' + esc(u.uid) + '"' + (u.uid === val ? ' selected' : '') + '>' + esc(u.name + (u.rank ? ' ' + u.rank : '') + (u.dept ? ' · ' + u.dept : '')) + '</option>').join('') + '</select>';
  if (f.type === 'project') return '<select class="jh-select"' + common + '><option value="">프로젝트를 선택하세요</option>' + (f.allowCommon ? '<option value="common"' + (val === 'common' ? ' selected' : '') + '>공통 · 프로젝트 무관(본사 경비)</option>' : '') + (ctx.projects || []).map((p) => '<option value="' + esc(p.id) + '"' + (p.id === val ? ' selected' : '') + '>' + esc((p.code ? p.code + ' · ' : '') + p.name) + '</option>').join('') + '</select>';
  if (f.type === 'date') return '<input class="jh-input" type="date"' + common + ' value="' + esc(val) + '">';
  if (f.type === 'time') return '<input class="jh-input" type="time" step="600"' + common + ' value="' + esc(val) + '">';
  if (f.type === 'number') return '<input class="jh-input" type="number" inputmode="decimal" step="0.5" min="0"' + common + ' value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '">';
  if (f.type === 'money') return '<input class="jh-input" type="text" inputmode="numeric"' + common + ' value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '">';
  return '<input class="jh-input" type="text"' + common + ' value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '" maxlength="200">';
}
function fieldHtml(f, v, errs, ctx) {
  const e = errs[f.key];
  return '<div class="jh-field" data-field="' + esc(f.key) + '"' + (e ? ' data-invalid="true"' : '') + '>' +
    '<label class="jh-field__label" for="f-' + esc(f.key) + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label>' + control(f, v, errs, ctx) +
    (f.hint ? '<span class="jh-field__hint">' + esc(f.hint) + '</span>' : '') + '<span class="jh-field__error">' + esc(e || '') + '</span></div>';
}
function itemsHtml(f, v, errs) {
  const rows = v.items && v.items.length ? v.items : [];
  const itemErr = (i, k) => errs['items.' + i + '.' + k];
  const cell = (i, k, label, type, ph, val) => '<div class="jh-field"' + (itemErr(i, k) ? ' data-invalid="true"' : '') + '><label class="jh-field__label">' + label + '</label><input class="jh-input" type="' + type + '" data-item="' + i + '.' + k + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph) + '"' + (type === 'number' ? ' inputmode="decimal" min="0"' : '') + '><span class="jh-field__error">' + esc(itemErr(i, k) || '') + '</span></div>';
  return '<div class="jh-form__section" data-field="items"' + (errs.items ? ' data-invalid="true"' : '') + '><h3 class="jh-form__h">' + esc(f.label) + '</h3>' +
    rows.map((r, i) => '<div class="jh-form__section"><div class="jh-panel__head"><h3>품목 ' + (i + 1) + '</h3><button type="button" class="jh-iconbtn" data-remove-item="' + i + '" aria-label="품목 ' + (i + 1) + ' 삭제">×</button></div>' +
      '<div class="jh-form__row">' + cell(i, 'name', '품목명 *', 'text', '품목명', r.name) + cell(i, 'link', '참고 링크', 'text', 'https://', r.link) + '</div>' +
      '<div class="jh-form__row">' + cell(i, 'qty', '수량', 'number', '1', r.qty) + cell(i, 'unitPrice', '단가 (원)', 'number', '0', r.unitPrice) + '</div></div>').join('') +
    (errs.items ? '<div class="jh-field" data-invalid="true"><span class="jh-field__error">' + esc(errs.items) + '</span></div>' : '') +
    '<div><button type="button" class="jh-btn" data-variant="secondary" data-add-item' + (rows.length >= 20 ? ' disabled' : '') + '>+ 품목 추가</button></div></div>';
}
function fieldsBlock(type, v, errs, ctx) {
  return fieldRows(type, v).map((row) => {
    if (row.items) return itemsHtml(row.fields[0], v, errs);
    return '<div class="jh-form__row" data-cols="' + (row.layout || row.cols) + '">' + row.fields.map((f) => fieldHtml(f, v, errs, ctx)).join('') + '</div>';
  }).join('');
}

/** 검색 결과 목록 — 입력창과 따로 갱신한다(입력 중인 한글이 끊기지 않게) */
export function suggestHtml(line, ctx, ui) {
  const q = (ui && ui.search) || ''; const picked = ui && ui.picked;
  const taken = new Set([ctx.me.uid].concat(line.approvers, line.cc));
  const cands = q ? ctx.users.filter((u) => !taken.has(u.uid) && (u.name.indexOf(q) !== -1 || (u.dept || '').indexOf(q) !== -1)).slice(0, 8) : [];
  return cands.length ? '<ul class="jh-suggest" role="listbox">' + cands.map((u) => '<li class="jh-suggest__item" role="option" data-pick="' + esc(u.uid) + '" aria-selected="' + (u.uid === picked) + '"><span>' + esc(u.name) + ' <small>' + esc(u.rank) + '</small></span><span>' + esc(u.dept) + '</span></li>').join('') + '</ul>'
    : (q ? '<div class="jh-field__hint">검색 결과가 없습니다.</div>' : '');
}
export function lineEditorHtml(line, ctx, ui) {
  const me = ctx.me; const gs = guideStatus(line, ctx);
  const issues = lineIssues(line, ctx);
  const approverItems = line.approvers.map((uid, i) => {
    const locked = isLocked(uid, ctx);
    return '<li class="jh-line-item" data-kind="approver" data-uid="' + esc(uid) + '"' + (locked ? ' data-locked="true"' : '') + '>' +
      '<span class="jh-line-item__handle" aria-hidden="true">⋮⋮</span><span class="jh-line-item__order">결재' + (line.approvers.length > 1 ? (i + 1) : '') + '</span>' +
      '<span class="jh-line-item__name">' + uname(ctx, uid) + '</span>' + (locked ? '<span class="jh-line-item__tag">필수</span>' : '') +
      '<span class="jh-line-item__actions">' +
        '<button type="button" class="jh-iconbtn" data-move="' + esc(uid) + ':-1" aria-label="위로"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="jh-iconbtn" data-move="' + esc(uid) + ':1" aria-label="아래로"' + (i === line.approvers.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="jh-iconbtn" data-remove="' + esc(uid) + '" aria-label="빼기"' + (locked ? ' disabled' : '') + '>×</button></span></li>';
  }).join('');
  const ccItems = line.cc.map((uid) => { const dep = !!ctx.deputy && uid === ctx.deputy;
    return '<li class="jh-line-item" data-kind="cc" data-uid="' + esc(uid) + '"' + (dep ? ' data-locked="true"' : '') + '><span class="jh-line-item__order">참조</span><span class="jh-line-item__name">' + uname(ctx, uid) + '</span><span class="jh-line-item__tag">' + (dep ? '업무대리' : '열람') + '</span>' +
    '<span class="jh-line-item__actions"><button type="button" class="jh-iconbtn" data-remove="' + esc(uid) + '" aria-label="빼기"' + (dep ? ' disabled' : '') + '>×</button></span></li>'; }).join('');
  const q = (ui && ui.search) || '';
  const picked = ui && ui.picked;
  const guide = gs.hasGuide ? '<div class="jh-guide"' + (gs.matches ? '' : ' data-diff="true"') + '><div class="jh-guide__title">권장 결재선</div><div class="jh-guide__line">' +
      gs.names.map((n, i) => (i ? '<span class="jh-guide__arrow" aria-hidden="true">→</span>' : '') + '<span class="jh-guide__step">' + esc(n) + '</span>').join('') + '</div>' +
      (gs.note ? '<p class="jh-guide__note">' + esc(gs.note) + '</p>' : '') +
      '<p class="jh-guide__diff">현재 결재선이 권장과 다릅니다. (차단되지는 않습니다)</p>' +
      (gs.matches ? '' : '<div><button type="button" class="jh-btn" data-variant="secondary" data-act="apply-guide">권장대로 적용</button></div>') + '</div>' : '';
  return '<div class="jh-line-editor"><ol class="jh-line-editor__list">' +
      '<li class="jh-line-item" data-kind="author"><span class="jh-line-item__order">작성</span><span class="jh-line-item__name">' + esc(me.name) + (me.rank ? ' <small>' + esc(me.rank) + '</small>' : '') + '</span><span class="jh-line-item__tag">작성자</span></li>' +
      approverItems + ccItems + '</ol>' +
    '<div class="jh-line-editor__add"><input class="jh-input" type="search" data-line-search placeholder="이름 또는 부서로 직원 검색" value="' + esc(q) + '" aria-label="결재선에 추가할 직원 검색" autocomplete="off">' +
      '<button type="button" class="jh-btn" data-variant="secondary" data-add="approver"' + (picked && line.approvers.length < MAX_APPROVERS ? '' : ' disabled') + '>결재자로 추가</button>' +
      '<button type="button" class="jh-btn" data-variant="secondary" data-add="cc"' + (picked && line.cc.length < MAX_CC ? '' : ' disabled') + '>참조로 추가</button></div>' +
    '<div data-suggest-box>' + suggestHtml(line, ctx, ui) + '</div>' +
    (ui && ui.lineError ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(ui.lineError) + '</div>' : '') +
    (issues.length ? '<div class="jh-alert" data-tone="warn" role="alert">' + issues.map(esc).join('<br>') + '</div>' : '') + guide + '</div>';
}

/** 연차 신청 화면의 잔여 연차 안내 — 신청 일수를 넣으면 신청 후 잔여를 바로 보여 준다(막지는 않음) */
export function balanceHintHtml(b, req, type) {
  if (!b) return '';
  if (!isAnnualType(type)) return '<div class="jh-alert" data-tone="info">이 휴가는 연차에서 차감되지 않습니다.</div>';
  const n = Number(req) || 0; const after = b.remain - n; const over = n > 0 && after < 0;
  return '<div class="jh-alert" data-tone="' + (over ? 'warn' : 'info') + '" role="status">내 연차 — 부여 ' + b.granted + '일 · 사용 ' + b.used + '일 · 잔여 ' + b.remain + '일' +
    (n > 0 ? ' · 이번 신청 ' + n + '일 → 신청 후 잔여 ' + Math.max(after, 0) + '일' : '') + (over ? '. 잔여 연차를 ' + (-after) + '일 초과합니다. 사유에 이유를 적어 주세요.' : '') + '</div>';
}

/** 근태 기록 수정 요청 화면의 안내: 계산된 근무시간 + 그 날의 현재 기록 */
export function attendHintHtml(a) {
  if (!a) return '';
  const cur = a.current ? '현재 기록: ' + (a.current.checkIn || '--:--') + ' ~ ' + (a.current.checkOut || '--:--') + ' (' + (Number(a.current.workHours) || 0).toFixed(1) + 'h) — 승인되면 이 값이 요청 내용으로 바뀝니다.' : (a.date ? '그 날짜에는 기록이 없습니다. 승인되면 새로 만들어집니다.' : '');
  const hrs = a.hours != null ? '요청 근무시간 ' + a.hours.toFixed(1) + 'h (점심 2시간 제외 · 5시간 이하는 제외 안 함, 시각은 10분 단위로 맞춰집니다)' : '';
  if (!cur && !hrs) return '';
  return '<div class="jh-alert" data-tone="info" role="status">' + [hrs, cur].filter(Boolean).map(esc).join('<br>') + '</div>';
}

/** 첨부파일 영역: 붙은 파일, 올리는 중인 파일(진행률), 오류 */
export function attachHtml(s) {
  const files = s.files || []; const up = s.uploading || []; const full = files.length + up.length >= MAX_FILES;
  const rows = files.map((f) => '<li class="jh-attach__item" data-file-id="' + esc(f.id) + '"><span class="jh-attach__name">📎 ' + esc(f.name) + '</span><span class="jh-attach__size">' + esc(fmtSize(f.size)) + '</span>' +
    '<span class="jh-attach__actions"><button type="button" class="jh-iconbtn" data-attach-open="' + esc(f.path) + '" aria-label="열기">↗</button><button type="button" class="jh-iconbtn" data-attach-remove="' + esc(f.id) + '" aria-label="지우기"' + (s.busy ? ' disabled' : '') + '>×</button></span></li>').join('') +
    up.map((u) => '<li class="jh-attach__item" data-uploading="true"><span class="jh-attach__name">⏳ ' + esc(u.name) + '</span><span class="jh-attach__size">' + esc(String(u.pct)) + '%</span></li>').join('');
  return '<h3 class="jh-form__h">첨부파일 <small>' + files.length + '/' + MAX_FILES + '</small></h3>' +
    (rows ? '<ul class="jh-attach">' + rows + '</ul>' : '<p class="jh-field__hint">증빙 자료가 있으면 붙여 주세요. (선택)</p>') +
    '<div class="jh-attach__add"><input type="file" id="edoc-file-input" data-attach-input multiple accept="' + esc(ACCEPT) + '" hidden>' +
    '<button type="button" class="jh-btn" data-variant="secondary" data-attach-pick' + (full || s.busy || up.length ? ' disabled' : '') + '>＋ 파일 붙이기</button>' +
    '<span class="jh-field__hint">파일당 10MB · 최대 ' + MAX_FILES + '개 · PDF·이미지·오피스·한글·압축·텍스트</span></div>' +
    (s.attachError ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(s.attachError) + '</div>' : '');
}

export function composeHtml(s) {
  const { type, values, errors, ctx, edit, rejectReason } = s; const t = composeType(type);
  const kind = type === 'spend' ? '<div class="jh-form__section"><div class="jh-segmented" role="group" aria-label="구분">' +
      ['purchase:구매품의', 'expense:지출결의'].map((x) => { const [k, l] = x.split(':'); return '<button type="button" class="jh-segmented__item" data-kind="' + k + '" aria-pressed="' + (values.kind === k) + '"' + (edit && values.kind !== k ? ' disabled' : '') + '>' + l + '</button>'; }).join('') +
      '</div>' + (edit ? '<span class="jh-field__hint">작성한 문서의 구분은 바꿀 수 없습니다.</span>' : '') + '</div>' : '';
  return '<form class="jh-form" data-compose="' + esc(type) + '" novalidate autocomplete="off">' +
    '<header class="jh-form__head"><h2 class="jh-form__title">' + esc(t ? t.label : '') + (edit ? ' 수정' : ' 작성') + '</h2><p class="jh-form__sub">작성자: ' + esc(ctx.me.name) + (ctx.me.rank ? ' ' + esc(ctx.me.rank) : '') + (ctx.me.dept ? ' · ' + esc(ctx.me.dept) : '') + '</p></header>' +
    (rejectReason ? '<div class="jh-alert" data-tone="danger" role="alert"><strong>반려 사유</strong><br>' + esc(rejectReason).replace(/\n/g, '<br>') + '</div>' : '') +
    kind + '<section class="jh-form__section"><h3 class="jh-form__h">내용</h3>' + fieldsBlock(type, values, errors || {}, ctx) + (type === 'leave' ? '<div id="edoc-balance" aria-live="polite">' + balanceHintHtml(s.balance, values.days, values.leaveType) + '</div>' : '') + (type === 'attend' ? '<div id="edoc-attend-hint" aria-live="polite">' + attendHintHtml(s.attend) + '</div>' : '') + '</section>' +
    '<section class="jh-form__section" id="edoc-attach">' + attachHtml(s) + '</section>' +
    '<section class="jh-form__section" id="edoc-line-section"><h3 class="jh-form__h">결재선</h3>' + lineEditorHtml(s.line, ctx, s.ui) + '</section>' +
    (s.formError ? '<div class="jh-alert" data-tone="danger" role="alert" id="edoc-form-error">' + esc(s.formError) + '</div>' : '') +
    '<div class="jh-form__foot"><button type="button" class="jh-btn" data-variant="ghost" data-act="cancel">취소</button>' +
      '<button type="button" class="jh-btn" data-act="save"' + (s.busy ? ' disabled' : '') + '>임시저장</button>' +
      '<button type="button" class="jh-btn" data-variant="primary" data-act="submit"' + (s.busy ? ' disabled' : '') + '>' + (s.busy ? '처리 중…' : '결재 상신') + '</button></div></form>';
}
export { emptyItem };

/** 상세 하단 처리 버튼 줄 */
export function actionbarHtml(actions) {
  if (!actions.length) return '';
  const grp = (g) => actions.filter((a) => a.group === g).map((a) => '<button type="button" class="jh-btn" data-variant="' + a.variant + '" data-do="' + a.key + '">' + esc(a.label) + '</button>').join('');
  return '<div class="jh-actionbar"><div class="jh-actionbar__primary">' + grp('primary') + '</div><div class="jh-actionbar__danger">' + grp('danger') + '</div><div class="jh-actionbar__secondary">' + grp('secondary') + '</div></div>';
}
