/* 근로계약서·연봉계약서 v7 입력 화면 조각 — 구분·계약기간 방식(프로젝트 선택)·근무지·고정연장 시간·지급 항목·특약 (순수 HTML 문자열, 이벤트는 index.js 의 계약서 컨트롤러가 data-c7-* / data-an-act="c7-*" 로 처리) */
import { esc } from '../../core/ui.js?v=20261031h';
import { TYPE_LABEL, PERIOD_LABEL, MAX_EXTRA, MAX_TERMS, typeOf, periodTypeOf, v7Calc } from './contract-v7.js?v=20261031h';
const card = (title, body) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3></div>' + body + '</section>';
const won = (n) => '₩' + Math.round(Number(n) || 0).toLocaleString('ko-KR');
const fmtN = (v) => (v === '' || v == null || !Number(v) ? '' : Number(v).toLocaleString('ko-KR'));
const radio = (attr, name, val, label, cur, disabled) => '<label class="jh-field__hint" style="margin-right:var(--sp-3)"><input type="radio" name="' + name + '" ' + attr + '="' + val + '"' + (cur === val ? ' checked' : '') + (disabled ? ' disabled' : '') + '> ' + label + '</label>';
const inp = (label, attrs, val, extra) => '<div class="jh-field"><label class="jh-field__label">' + label + '</label><input class="jh-input" ' + attrs + ' value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></div>';

/** 정규직/계약직 구분 */
export function c7TypeCardHtml(f) {
  const t = typeOf(f);
  return card('🏷 근로계약 구분 *', '<div class="jh-hr__pad"><div>' + radio('data-c7-type', 'c7-type', 'regular', TYPE_LABEL.regular + ' (기간의 정함이 없는 근로계약)', t) + radio('data-c7-type', 'c7-type', 'fixed', TYPE_LABEL.fixed + ' (기간제 근로계약)', t) + '</div>'
    + '<div class="jh-field__hint">' + (t === 'fixed' ? '계약직은 기간제 근로계약입니다. 계약기간(기간 지정 또는 프로젝트 종료 시)과 근무지를 꼭 적어 주세요.' : t === 'regular' ? '정규직은 기간의 정함이 없는 근로계약입니다.' : '정규직/계약직을 선택해 주세요. 선택해야 저장할 수 있습니다.') + '</div></div>');
}
/** 계약기간 — 기간 지정 / 기간의 정함 없음 / 프로젝트 종료 시(프로젝트는 목록에서 선택) */
export function c7PeriodCardHtml(st, kind) {
  const f = st.aForm; const t = typeOf(f); const p = periodTypeOf(f); const annual = kind === 'annual';
  const allow = { range: annual || t !== 'regular', open: annual || t !== 'fixed', project: annual || t !== 'regular' };   // 근로계약: 정규직은 정함 없음만, 계약직은 지정·프로젝트만
  const kinds = '<div style="display:flex;flex-wrap:wrap;gap:var(--sp-4);align-items:center">' + ['range', 'project', 'open'].map((k) => radio('data-c7-ptype', 'c7-ptype', k, PERIOD_LABEL[k], p, !allow[k] && !!t)).join('') + '</div>';
  const start = inp('시작일 *', annual ? 'type="date" data-an-start' : 'type="date" data-an-f="startDate"', f.startDate);
  const projects = Array.isArray(st.aProjects) ? st.aProjects : []; const known = projects.some((x) => x.id === f.projectId);
  const projCtl = projects.length
    ? '<div class="jh-field"><label class="jh-field__label">프로젝트 *</label><select class="jh-select" data-c7-proj><option value="">프로젝트를 선택하세요</option>' + projects.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === f.projectId ? ' selected' : '') + '>' + esc(x.label || x.name) + '</option>').join('') + (f.projectName && !known ? '<option value="" selected>' + esc(f.projectName) + ' (저장된 값)</option>' : '') + '</select></div>'
    : inp('프로젝트 이름 *', 'data-c7-f="projectName"', f.projectName, ' placeholder="프로젝트 이름 입력"');
  const contract = inp('계약 체결일 *', 'type="date" data-an-f="contractDate"', f.contractDate);
  const row = (cells) => '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--sp-3)">' + cells + '</div>';   // 한 줄에 모아 놓고, 좁은 화면에서만 줄바꿈
  const body = p === 'range' ? row(start + inp('종료일 *', 'type="date" data-an-f="endDate"', f.endDate) + contract) + (annual ? '<div class="jh-field__hint">연봉계약 기본 기간은 시작일부터 1년이며, 종료일은 직접 바꿀 수 있습니다.</div>' : '')
    : p === 'open' ? row(start + contract) + '<div class="jh-field__hint">종료일 없이 시작일만 적습니다. 정규직 근로계약은 기간의 정함이 없는 계약입니다.</div>'
    : row(start + projCtl + inp('종료 예정일 (선택)', 'type="date" data-c7-f="expectedEnd"', f.expectedEnd) + contract) + '<div class="jh-field__hint">예정일은 참고용이며, 실제 종료일은 프로젝트가 끝날 때 회사가 통지합니다. 프로젝트가 끝나면 계약도 끝납니다.</div>';
  return card('📅 계약 기간', '<div class="jh-hr__pad">' + kinds + body + '</div>');
}
/** 근무지(근로계약서) — 계약직은 필수 */
export function c7PlaceCardHtml(f) {
  const t = typeOf(f);
  return card('📍 근무지', '<div class="jh-hr__pad">' + inp('근무지' + (t === 'fixed' ? ' *' : ' (선택)'), 'data-c7-f="workPlace"', f.workPlace, ' placeholder="예) 평택 고덕 P4 현장"') + inp('투입처 (선택)', 'data-c7-f="assignedTo" maxlength="40"', f.assignedTo, ' placeholder="업무를 수행하는 현장의 업체명"') + '<div class="jh-field__hint">' + (t === 'fixed' ? '계약직은 근무지를 적어야 저장할 수 있습니다.' : '정규직은 비워 두면 "회사가 제공하는 근무장소" 문구가 들어갑니다.') + '</div></div>');
}
/** 포괄 선택 시 고정연장·야간 산정 시간(월) 입력 */
export const c7HoursHtml = (f) => '<div class="jh-hr__grid">' + inp('고정연장 산정 시간 (월, 시간) *', 'inputmode="decimal" data-c7-f="fixedOTHours"', f.fixedOTHours, ' style="text-align:right"') + inp('고정야간 산정 시간 (월, 시간)', 'inputmode="decimal" data-c7-f="fixedNightHours"', f.fixedNightHours, ' style="text-align:right"') + '</div><div class="jh-field__hint">계약서에 "월 ○시간분의 대가"라는 문구가 들어갑니다. 고정액이 있으면 시간을 꼭 적어 주세요.</div>';
/** 월 지급계 구성 요약(입력하는 동안 이 부분만 다시 그린다) */
export function c7SumHtml(f) {
  const c = v7Calc(f); if (!c.hourly) return '<div class="jh-field__hint">시급(또는 월급·연봉)을 입력하면 월 지급계가 계산됩니다.</div>';
  const line = (l, v, b) => '<div class="jh-hr__line"><span class="jh-hr__label">' + l + '</span>' + (b ? '<strong>' + won(v) + '</strong>' : '<span>' + won(v) + '</span>') + '</div>';
  return '<div class="jh-hr__post"><div><strong>월 지급계 구성</strong></div>' + line('기본근로수당', c.basic) + line('주휴수당', c.weekly) + (c.fixedOT ? line('고정연장수당', c.fixedOT) : '') + (c.fixedNight ? line('고정야간수당', c.fixedNight) : '') + c.extras.map((r) => line(esc(r.name) + (r.ordinary ? ' (통상임금 포함)' : ''), r.amount)).join('') + line('월 지급계', c.total, true) + line('계약연봉 (월×12)', c.annual, true)
    + (c.ordinaryExtra ? '<div class="jh-field__hint">통상시급(연장·야간·휴일·주휴 단가) ' + won(c.ordinaryHourly) + ' — 기본·주휴·통상임금 포함 항목 ÷ 208.56시간</div>' : '') + '</div>';
}
/** 연봉계약서 — 지급 항목 추가·삭제, 특약 */
export function c7ItemsCardHtml(st) {
  const f = st.aForm; const rows = Array.isArray(f.extraItems) ? f.extraItems : [];
  const row = (r, i) => '<div class="jh-field" style="border:var(--u-1) solid var(--c-line);border-radius:var(--radius);padding:var(--sp-2)"><div class="jh-hr__grid">' + inp('항목명', 'data-c7-row="' + i + '|name" maxlength="20" placeholder="예) 직책수당"', r.name) + inp('월 금액 (원)', 'inputmode="numeric" data-c7-row="' + i + '|amount"', fmtN(r.amount), ' style="text-align:right"') + '</div><div class="jh-hr__grid">' + inp('비고 (선택)', 'data-c7-row="' + i + '|note" maxlength="40"', r.note)
    + '<div class="jh-field"><label class="jh-field__label">통상임금</label><label class="jh-field__hint"><input type="checkbox" data-c7-row="' + i + '|ordinary"' + (r.ordinary ? ' checked' : '') + '> 통상임금에 포함</label> <button type="button" class="jh-btn" data-variant="ghost" data-an-act="c7-del" data-idx="' + i + '">삭제</button></div></div></div>';
  const terms = String(f.specialTerms || '');
  return card('➕ 지급 항목 추가 · 특약', '<div class="jh-hr__pad">' + (rows.length ? rows.map(row).join('') : '<div class="jh-field__hint">추가로 지급할 항목(직책수당, 식대, 현장 숙소비 등)이 있으면 아래 단추로 넣으세요. 기본근로수당·주휴수당은 자동으로 들어갑니다.</div>')
    + '<div><button type="button" class="jh-btn" data-variant="secondary" data-an-act="c7-add"' + (rows.length >= MAX_EXTRA ? ' disabled' : '') + '>+ 항목 추가</button></div>'
    + '<div class="jh-field__hint">"통상임금에 포함"으로 체크한 항목은 연장·야간·휴일근로수당과 주휴수당의 단가(통상시급)에 들어갑니다. 식대·실비처럼 근로의 대가가 아닌 것은 체크하지 마세요.</div>'
    + '<div class="jh-field"><label class="jh-field__label">특약사항 (선택, ' + MAX_TERMS + '자 이내)</label><textarea class="jh-input" rows="4" maxlength="' + MAX_TERMS + '" data-c7-f="specialTerms" placeholder="예) 현장 숙소는 회사가 제공한다.">' + esc(terms) + '</textarea></div>'
    + '<div class="jh-field__hint">근로기준법에 어긋나는 내용(퇴직금 불지급, 손해배상액 예정·위약금, 임금 임의 공제·상계)은 특약으로 쓸 수 없고, 쓰면 저장되지 않습니다.</div>'
    + '<div data-c7-sum>' + c7SumHtml(f) + '</div></div>');
}
