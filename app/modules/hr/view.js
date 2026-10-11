import { esc } from '../../core/ui.js?v=20261011x';
import { isOffDay } from '../../shared/holidays.js?v=20261011x';
import { RANK_ORDER, deptOptions } from '../../shared/org.js?v=20261011x';
import { counts, filterWorkers, stepNow, workPeriod, maskJumin, maskAccount, birthText, contractState, isResigned, EMP_TYPES, historyText } from './logic.js?v=20261011x';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const fmtD = (d) => (d ? String(d).slice(2).replace(/-/g, '.') : '');
const empBadge = (t) => (t === 'field' ? chip('현장', 'warn') : t === 'office' ? chip('사무', 'accent') : chip('미지정', 'muted'));

export function tableHtml(st) {
  const list = filterWorkers(st.workers, { view: st.view, q: st.q });
  if (!list.length) return '<div class="jh-empty">' + (st.view === 'resigned' ? '퇴사 처리된 근로자가 없습니다.' : '조건에 맞는 근로자가 없습니다.') + '</div>';
  const rows = list.map((w) => {
    const c = st.contracts[w.id] || {}; const lb = contractState(c.laborEnd, c.laborN, st.today); const an = contractState(c.annualEnd, c.annualN, st.today); const s = stepNow(w);
    return '<tr class="jh-hr__row" data-w-open="' + esc(w.id) + '"><td>' + esc(w.empNo || '-') + '</td><td><strong>' + esc(w.name || '-') + '</strong>' + (isResigned(w) ? ' ' + chip('퇴직 ' + (w.resignDate || ''), 'danger') : '') + '</td><td>' + esc(w.dept || '-') + '</td><td>' + esc(w.rank || '-') + '</td><td class="num">' + (s == null ? '-' : s + '호봉') + '</td><td>' + empBadge(w.empType) + '</td><td>' + esc(birthText(w.jumin)) + '</td><td>' + esc(w.phone || '-') + '</td><td>' + chip(lb.text + (lb.end ? ' ' + fmtD(lb.end) : ''), lb.tone) + '</td><td>' + chip(an.text + (an.end ? ' ' + fmtD(an.end) : ''), an.tone) + '</td><td>' + (w.portalUid ? chip('연동', 'accent') : chip('미연동', 'muted')) + '</td></tr>';
  }).join('');
  return '<div class="jh-hr__scroll"><table class="jh-hr-table jh-hr-table--click"><thead><tr><th>사원번호</th><th>이름</th><th>소속</th><th>직급</th><th class="num">호봉</th><th>구분</th><th>생년월일</th><th>휴대폰</th><th>근로계약</th><th>연봉계약</th><th>포털</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
export function listHtml(st) {
  const c = counts(st.workers);
  const seg = '<div class="jh-segmented" role="group" aria-label="구분"><button type="button" class="jh-segmented__item" data-w-view="active" aria-pressed="' + (st.view === 'active') + '">재직자 (' + c.active + ')</button><button type="button" class="jh-segmented__item" data-w-view="resigned" aria-pressed="' + (st.view === 'resigned') + '">퇴사자 (' + c.resigned + ')</button></div>';
  const bar = '<div class="jh-hr__pad"><div class="jh-hr__bar">' + seg + '<input class="jh-input jh-hr__q" data-w-q placeholder="이름·사번·소속·직급·휴대폰 검색" value="' + esc(st.q || '') + '" aria-label="검색"><a class="jh-btn" data-variant="secondary" href="#/hr/roster">신규 등록·퇴사 처리·삭제(기존 화면)</a></div></div>';
  return (st.sel ? detailHtml(st) : '') + card('근로자 명부', bar + '<div id="w-table">' + tableHtml(st) + '</div><div class="jh-field__hint jh-hr__pad">사원번호·이름을 눌러 상세·수정을 엽니다. 직급·소속을 바꾸면 변경 이력이 남고, 직급이 바뀌면 호봉이 1로 초기화됩니다(호봉을 직접 고치면 그 값). 신규 등록·퇴사 처리·삭제·주민번호 수정은 아직 기존 화면에서 합니다.</div>');
}
const row = (label, html) => '<div class="jh-hr__line"><span class="jh-hr__label">' + esc(label) + '</span><span class="jh-hr__val">' + html + '</span></div>';
const inp = (key, val, attr) => '<input class="jh-input" data-w-f="' + key + '" value="' + esc(val == null ? '' : val) + '" ' + (attr || '') + '>';
export function detailHtml(st) {
  const w = st.sel.orig; const f = st.sel.form; const res = isResigned(w); const p = workPeriod(f.hireDate, res ? w.resignDate : '', st.today, isOffDay);
  const depts = deptOptions(st.workers.map((x) => ({ dept: x.dept }))); if (f.dept && !depts.includes(f.dept)) depts.push(f.dept);
  const ranks = RANK_ORDER.slice(); if (f.rank && !ranks.includes(f.rank)) ranks.push(f.rank);
  const sel = (key, opts, cur) => '<select class="jh-select" data-w-f="' + key + '">' + opts.map((o) => '<option value="' + esc(Array.isArray(o) ? o[0] : o) + '"' + ((Array.isArray(o) ? o[0] : o) === cur ? ' selected' : '') + '>' + esc(Array.isArray(o) ? o[1] : o) + '</option>').join('') + '</select>';
  const head = '<div class="jh-hr__bar"><strong>' + esc(w.name || '') + '</strong> ' + esc((w.dept || '') + ' · ' + (w.rank || '')) + ' ' + empBadge(w.empType) + ' ' + (res ? chip('퇴직 ' + (w.resignDate || '-'), 'danger') : chip('재직중', 'accent')) + (w.portalUid ? ' ' + chip('포털 연동', 'accent') : '') + '</div>';
  const period = '<h4 class="jh-hr__sub">재직 정보</h4>' + row('최초 입사일', '<input class="jh-input" type="date" data-w-f="hireDate" value="' + esc(f.hireDate || '') + '">') + row('재직 기간', p ? esc((p.years > 0 ? p.years + '년 ' : '') + p.months + '개월 (' + p.calDays + '일)') : '-') + row('실 근무일수(주말·공휴일 제외)', p ? '<strong>' + p.days.toLocaleString('ko-KR') + '일</strong>' : '-') + (res ? row('퇴직일', esc(w.resignDate || '-')) : '');
  const basic = '<h4 class="jh-hr__sub">기본 정보</h4><div class="jh-hr__grid">'
    + '<div class="jh-field"><label class="jh-field__label">이름</label>' + inp('name', f.name) + '</div><div class="jh-field"><label class="jh-field__label">사원번호</label>' + inp('empNo', f.empNo) + '</div>'
    + '<div class="jh-field"><label class="jh-field__label">소속</label>' + sel('dept', [''].concat(depts).map((d) => [d, d || '(미지정)']), f.dept) + '</div><div class="jh-field"><label class="jh-field__label">직급</label>' + sel('rank', [''].concat(ranks).map((d) => [d, d || '(미지정)']), f.rank) + '</div>'
    + '<div class="jh-field"><label class="jh-field__label">직원 구분</label>' + sel('empType', EMP_TYPES, f.empType) + '</div><div class="jh-field"><label class="jh-field__label">담당업무</label>' + inp('job', f.job) + '</div>'
    + '<div class="jh-field"><label class="jh-field__label">호봉</label>' + inp('step', f.step, 'inputmode="numeric"') + '<div class="jh-field__hint">직접 고치지 않으면 자동 계산값(' + (stepNow(w) == null ? '-' : stepNow(w) + '호봉') + ')을 씁니다.</div></div><div class="jh-field"><label class="jh-field__label">휴대폰</label>' + inp('phone', f.phone) + '</div>'
    + '<div class="jh-field"><label class="jh-field__label">이메일</label>' + inp('email', f.email) + '</div><div class="jh-field"><label class="jh-field__label">주소</label>' + inp('address', f.address) + '</div>'
    + '<div class="jh-field"><label class="jh-field__label">계좌번호</label>' + inp('bankAccount', f.bankAccount) + '<div class="jh-field__hint">저장하지 않으면 그대로 유지됩니다. 현재: ' + esc(maskAccount(w.bankAccount) || '없음') + '</div></div><div class="jh-field"><label class="jh-field__label">주민등록번호</label><input class="jh-input" value="' + esc(maskJumin(w.jumin) || '없음') + '" disabled><div class="jh-field__hint">수정은 기존 화면에서 합니다.</div></div></div>'
    + '<div class="jh-field"><label class="jh-field__label">직급·소속 변경 사유(바꾼 경우에만 이력에 함께 저장)</label><textarea class="jh-textarea" data-w-f="reason" rows="2" placeholder="선택 입력">' + esc(f.reason || '') + '</textarea></div>';
  const hist = st.sel.history ? '<h4 class="jh-hr__sub">직급·소속 변경 이력</h4>' + (st.sel.history.length ? '<ul class="jh-hr__hist">' + st.sel.history.map((h) => '<li><span class="jh-field__hint">' + esc(h.date) + '</span> ' + esc(historyText(h)) + (h.reason ? '<div class="jh-field__hint">' + esc(h.reason) + '</div>' : '') + '</li>').join('') + '</ul>' : '<div class="jh-field__hint">변경 이력이 없습니다.</div>') : '';
  const foot = '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-w-act="save">저장</button><button type="button" class="jh-btn" data-variant="ghost" data-w-act="close">닫기</button><button type="button" class="jh-btn" data-variant="ghost" data-w-act="history">변경 이력 보기</button><a class="jh-btn" data-variant="ghost" href="#/hr/labor">근로계약서</a><a class="jh-btn" data-variant="ghost" href="#/hr/annual">연봉계약서</a></div>';
  return card((w.name || '근로자') + ' 상세·수정', '<div class="jh-hr__pad">' + head + period + basic + hist + foot + '</div>');
}
