import { esc } from '../../core/ui.js?v=20261011z';
import { isOffDay } from '../../shared/holidays.js?v=20261011z';
import { RANK_ORDER, deptOptions } from '../../shared/org.js?v=20261011z';
import { counts, filterWorkers, stepNow, workPeriod, maskJumin, maskAccount, birthText, contractState, isResigned, EMP_TYPES, historyText, nextEmpNo, kstToday, leaveRows, leaveEntries, leaveTotals } from './logic.js?v=20261011z';

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
  const bar = '<div class="jh-hr__pad"><div class="jh-hr__bar">' + seg + '<input class="jh-input jh-hr__q" data-w-q placeholder="이름·사번·소속·직급·휴대폰 검색" value="' + esc(st.q || '') + '" aria-label="검색"><button type="button" class="jh-btn" data-variant="primary" data-w-act="reg-new">신규 등록</button></div></div>';
  return (st.reg ? registerHtml(st) : '') + (st.sel ? detailHtml(st) : '') + card('근로자 명부', bar + '<div id="w-table">' + tableHtml(st) + '</div><div class="jh-field__hint jh-hr__pad">사원번호·이름을 눌러 상세·수정을 엽니다. 직급·소속을 바꾸면 변경 이력이 남고, 직급이 바뀌면 호봉이 1로 초기화됩니다(호봉을 직접 고치면 그 값). 퇴직 처리·재직 복구·포털 연동·삭제는 상세 아래쪽 버튼에 있습니다.</div>');
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
    + '<div class="jh-field"><label class="jh-field__label">계좌번호</label>' + inp('bankAccount', f.bankAccount) + '<div class="jh-field__hint">저장하지 않으면 그대로 유지됩니다. 현재: ' + esc(maskAccount(w.bankAccount) || '없음') + '</div></div><div class="jh-field"><label class="jh-field__label">주민등록번호</label><input class="jh-input" value="' + esc(maskJumin(w.jumin) || '없음') + '" disabled><div class="jh-field__hint">바꾸려면 아래에 새 번호를 입력하세요.</div></div><div class="jh-field"><label class="jh-field__label">주민등록번호 변경(선택)</label>' + inp('jumin', f.jumin, 'placeholder="000000-0000000" autocomplete="off"') + '</div></div>'
    + '<div class="jh-field"><label class="jh-field__label">직급·소속 변경 사유(바꾼 경우에만 이력에 함께 저장)</label><textarea class="jh-textarea" data-w-f="reason" rows="2" placeholder="선택 입력">' + esc(f.reason || '') + '</textarea></div>';
  const hist = st.sel.history ? '<h4 class="jh-hr__sub">직급·소속 변경 이력</h4>' + (st.sel.history.length ? '<ul class="jh-hr__hist">' + st.sel.history.map((h) => '<li><span class="jh-field__hint">' + esc(h.date) + '</span> ' + esc(historyText(h)) + (h.reason ? '<div class="jh-field__hint">' + esc(h.reason) + '</div>' : '') + '</li>').join('') + '</ul>' : '<div class="jh-field__hint">변경 이력이 없습니다.</div>') : '';
  const manage = '<h4 class="jh-hr__sub">관리</h4><div class="jh-hr__bar">' + (res ? '<button type="button" class="jh-btn" data-variant="secondary" data-w-act="unresign">재직 상태로 복구</button>' : '<input class="jh-input" type="date" data-w-f="resignDate" value="' + esc(f.resignDate || st.today) + '" aria-label="퇴직일" style="max-width:11rem"><button type="button" class="jh-btn" data-variant="secondary" data-w-act="resign">퇴직 처리</button>') + (w.portalUid ? '' : '<button type="button" class="jh-btn" data-variant="secondary" data-w-act="link">포털 계정 연동</button>') + '<button type="button" class="jh-btn" data-variant="ghost" data-w-act="delete">명부에서 삭제</button></div><div class="jh-field__hint">퇴직 처리는 명부에서 지우지 않고 "퇴직"으로 표시합니다. 삭제하면 명부에서만 지워지고 계약서 자료는 남습니다.</div>';
  const foot = manage + '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-w-act="save">저장</button><button type="button" class="jh-btn" data-variant="ghost" data-w-act="close">닫기</button><button type="button" class="jh-btn" data-variant="ghost" data-w-act="history">변경 이력 보기</button><a class="jh-btn" data-variant="ghost" href="#/hr/labor">근로계약서</a><a class="jh-btn" data-variant="ghost" href="#/hr/annual">연봉계약서</a></div>';
  return card((w.name || '근로자') + ' 상세·수정', '<div class="jh-hr__pad">' + head + period + basic + hist + foot + '</div>');
}

/** 신규 등록 */
export function registerHtml(st) {
  const f = st.reg.form; const depts = deptOptions(st.workers.map((x) => ({ dept: x.dept }))); const ranks = RANK_ORDER.slice();
  const sel = (key, opts, cur) => '<select class="jh-select" data-w-rf="' + key + '">' + opts.map((o) => '<option value="' + esc(Array.isArray(o) ? o[0] : o) + '"' + ((Array.isArray(o) ? o[0] : o) === cur ? ' selected' : '') + '>' + esc(Array.isArray(o) ? o[1] : o) + '</option>').join('') + '</select>';
  const i = (key, label, attr, req) => '<div class="jh-field"><label class="jh-field__label">' + esc(label) + (req ? ' *' : '') + '</label><input class="jh-input" data-w-rf="' + key + '" value="' + esc(f[key] || '') + '" ' + (attr || '') + '></div>';
  const body = '<div class="jh-hr__pad">' + (st.reg.prefill ? '<div class="jh-alert" data-tone="info" role="status">채용 지원자 정보를 불러왔습니다. 나머지 항목을 입력해 등록을 완료하세요.</div>' : '') + '<div class="jh-hr__grid">' + i('name', '이름', '', true) + i('jumin', '주민등록번호', 'placeholder="000000-0000000" autocomplete="off" maxlength="14"', true) + i('phone', '휴대폰', 'placeholder="010-0000-0000"') + i('email', '이메일(문서 발송용)', 'placeholder="example@jhsol.kr"')
    + '<div class="jh-field"><label class="jh-field__label">소속</label>' + sel('dept', [''].concat(depts).map((d) => [d, d || '선택하세요']), f.dept) + '</div><div class="jh-field"><label class="jh-field__label">직급</label>' + sel('rank', [''].concat(ranks).map((d) => [d, d || '선택하세요']), f.rank) + '</div><div class="jh-field"><label class="jh-field__label">직원 구분</label>' + sel('empType', EMP_TYPES, f.empType) + '</div>' + i('hireDate', '최초 입사일', 'type="date"') + i('job', '담당업무') + i('address', '주소') + i('bankAccount', '계좌번호') + '</div>'
    + '<div class="jh-field__hint">사원번호는 입사 연도 2자리 + 그 해 순번 3자리로 자동 부여됩니다(이번 입사일 기준 다음 번호: <strong>' + esc(nextEmpNo(st.workers, f.hireDate || kstToday())) + '</strong>). 이름과 같은 포털 계정이 한 개면 자동으로 연동합니다.</div><div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="primary" data-w-act="reg-save">등록</button><button type="button" class="jh-btn" data-variant="ghost" data-w-act="reg-cancel">취소</button></div></div>';
  return card('근로자 등록', body);
}

/** 연차 현황 */
const n1 = (x) => (x == null ? '-' : String(Math.round(x * 10) / 10));
export function leaveTableHtml(st) {
  const rows = st.leaveRows; if (!rows.length) return '<div class="jh-empty">등록된 근로자가 없습니다.</div>';
  return '<div class="jh-hr__scroll"><table class="jh-hr-table jh-hr-table--click"><thead><tr><th>이름</th><th>소속</th><th>직급</th><th>최초 입사일</th><th>산정 기준(회계연도)</th><th class="num">부여</th><th class="num">사용</th><th class="num">잔여</th></tr></thead><tbody>' + rows.map((r) => '<tr class="jh-hr__row" data-l-open="' + esc(r.id) + '"><td><strong>' + esc(r.name || '-') + '</strong>' + (r.resigned ? ' ' + chip('퇴직', 'danger') : '') + '</td><td>' + esc(r.dept || '-') + '</td><td>' + esc(r.rank || '-') + '</td><td>' + (r.hireDate ? esc(r.hireDate) : '<span style="color:var(--c-danger)">미등록</span>') + '</td><td class="jh-hr__cell">' + esc(r.detail || '-') + '</td><td class="num">' + n1(r.granted) + '</td><td class="num">' + n1(r.used) + (r.planned ? ' <span class="jh-field__hint">(예정 ' + n1(r.planned) + ')</span>' : '') + '</td><td class="num"><strong>' + n1(r.remain) + '</strong></td></tr>').join('') + '</tbody></table></div>';
}
export function leaveDetailHtml(st) {
  const r = st.leaveRows.find((x) => x.id === st.leaveSel); if (!r) return '';
  const entries = leaveEntries(r.docs);
  const kpi = '<div class="jh-kpi-grid"><div class="jh-kpi"><span class="jh-kpi__label">부여</span><span class="jh-kpi__value">' + n1(r.granted) + '일</span></div><div class="jh-kpi"><span class="jh-kpi__label">사용</span><span class="jh-kpi__value">' + n1(r.used) + '일</span><span class="jh-kpi__hint">' + (r.planned ? '예정 ' + n1(r.planned) + '일 포함' : '') + '</span></div><div class="jh-kpi"><span class="jh-kpi__label">잔여</span><span class="jh-kpi__value">' + n1(r.remain) + '일</span></div></div>';
  const tracks = r.tracks.length ? '<ul class="jh-hr__hist">' + r.tracks.map((t) => '<li><strong>' + esc(t.title) + '</strong> — 부여 ' + n1(t.granted) + '일 <span class="jh-field__hint">(' + esc(t.basis) + ')</span></li>').join('') + '</ul>' : '';
  const list = entries.length ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>상태</th><th>종류</th><th>기간</th><th class="num">일수</th></tr></thead><tbody>' + entries.map((e) => '<tr><td>' + chip(e.status, 'muted') + '</td><td>' + esc(e.title) + (e.annual ? '' : ' <span class="jh-field__hint">(연차 차감 안 함)</span>') + '</td><td>' + esc(e.start + (e.end && e.end !== e.start ? ' ~ ' + e.end : '')) + '</td><td class="num">' + n1(e.days) + '일</td></tr>').join('') + '</tbody></table></div>' : '<div class="jh-empty">승인·게시된 연차 문서가 없습니다.</div>';
  return card(r.name + ' 연차 상세', '<div class="jh-hr__pad"><div class="jh-field__hint">입사일 ' + esc(r.hireDate || '미등록') + ' · ' + esc(r.detail || '-') + '</div>' + kpi + tracks + '<h4 class="jh-hr__sub">사용 내역(승인·게시)</h4>' + list + '<div class="jh-hr__bar"><button type="button" class="jh-btn" data-variant="ghost" data-l-close>닫기</button><a class="jh-btn" data-variant="ghost" href="#/hr/leave">연차 등록·수정·사용촉진(기존 화면)</a></div></div>');
}
export function leaveHtml(st) {
  const t = leaveTotals(st.leaveRows);
  const bar = '<div class="jh-hr__pad"><div class="jh-hr__bar"><label class="jh-field__hint"><input type="checkbox" data-l-all' + (st.leaveAll ? ' checked' : '') + '> 퇴직자 포함</label></div><div class="jh-kpi-grid"><div class="jh-kpi"><span class="jh-kpi__label">대상</span><span class="jh-kpi__value">' + t.n + '명</span><span class="jh-kpi__hint">' + (t.noHire ? '입사일 미등록 ' + t.noHire + '명' : '') + '</span></div><div class="jh-kpi"><span class="jh-kpi__label">부여 합계</span><span class="jh-kpi__value">' + n1(t.granted) + '일</span></div><div class="jh-kpi"><span class="jh-kpi__label">사용 합계</span><span class="jh-kpi__value">' + n1(t.used) + '일</span></div><div class="jh-kpi"><span class="jh-kpi__label">잔여 합계</span><span class="jh-kpi__value">' + n1(t.remain) + '일</span></div></div></div>';
  return (st.leaveSel ? leaveDetailHtml(st) : '') + card('전체 직원 연차 현황', bar + leaveTableHtml(st) + '<div class="jh-field__hint jh-hr__pad">회계연도(1.1~12.31) 기준·근로기준법 자동 산정입니다. 입사 첫 1년은 1개월 개근당 1일(최대 11일), 입사 다음 해 1/1은 첫해 재직일수 비례, 이후 매년 1/1에 15일 + 3년 이상 2년마다 +1일(최대 25일). 사용일수는 해당 연차 구간에 시작한 승인·게시 연차·반차만 차감하며(병가·생리휴가 등은 차감 안 함) 승인된 미래 일정도 사용으로 봅니다. 입사일이 미등록인 직원은 근로자 명부에서 입사일을 입력해 주세요.</div>');
}
