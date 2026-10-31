/* 근로계약서 작성 화면의 "단시간 근로자" 칸 — HTML 만 만드는 순수 함수(시험: tests/hr-short-view.test.mjs). 입력 연결은 index.js 의 계약서 화면이 한다.
 * data-an-ftype(근로 형태)·data-an-sday(요일 켜기)·data-an-sf="요일:칸"(시작·종료·휴게)·data-an-f(근무장소·초과 한도·지급일·특약)·data-an-pay(시급).
 * 연봉계약서가 쓰는 data-an-wt 와 겹치지 않게 이름을 따로 썼다. */
import { esc } from '../../core/ui.js?v=20261031f';
import { DAYS, MIN_HOURLY, shortCheck } from './short-doc.js?v=20261031f';
const card = (title, body) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3></div>' + body + '</section>';
export const FORM_TYPES = [['regular', '일반 근로자'], ['short', '단시간 근로자 (주 40시간 미만)']];
/** 근로자를 고른 뒤 맨 위에 나오는 근로 형태 선택 */
export function shortTypeCardHtml(f) {
  const short = !!f && f.workType === 'short';
  return card('🧾 근로 형태', '<div class="jh-hr__pad"><div class="jh-segmented" role="group" aria-label="근로 형태">' + FORM_TYPES.map(([k, l]) => '<button type="button" class="jh-segmented__item" data-an-ftype="' + k + '" aria-pressed="' + ((k === 'short') === short) + '">' + esc(l) + '</button>').join('') + '</div><div class="jh-field__hint">단시간 근로자는 <b>근로일(요일)과 근로일별 근로시간</b>을 계약서에 적어야 합니다(기간제법 제17조, 위반 시 과태료).</div></div>');
}
const dayRow = (r) => {
  const on = !!r.on; const dis = on ? '' : ' disabled';
  return '<div class="jh-hr__line" data-an-dayrow="' + esc(r.day) + '" style="display:flex;flex-wrap:wrap;gap:var(--sp-2);align-items:center"><button type="button" class="jh-segmented__item" style="min-width:4.5rem" data-an-sday="' + esc(r.day) + '" aria-pressed="' + on + '">' + esc(r.day) + '요일</button>'
    + '<input class="jh-input" type="time" style="max-width:8.5rem" data-an-sf="' + esc(r.day) + ':start" value="' + esc(r.start) + '" aria-label="' + esc(r.day) + '요일 시작 시각"' + dis + '><span aria-hidden="true">~</span>'
    + '<input class="jh-input" type="time" style="max-width:8.5rem" data-an-sf="' + esc(r.day) + ':end" value="' + esc(r.end) + '" aria-label="' + esc(r.day) + '요일 종료 시각"' + dis + '>'
    + '<input class="jh-input" type="number" min="0" step="5" inputmode="numeric" style="max-width:6rem" data-an-sf="' + esc(r.day) + ':breakMin" value="' + esc(on ? (r.breakMin || 0) : '') + '" aria-label="' + esc(r.day) + '요일 휴게시간(분)" placeholder="휴게(분)"' + dis + '></div>';
};
/** 근로일 표 아래 합계·안내 문구 — 시각 칸을 바꿀 때 화면을 다시 그리지 않고 이 부분만 제자리에서 바꾼다(포커스·입력 유지) */
export function shortSummaryHtml(f) {
  const x = f || {}; const sched = Array.isArray(x.sched) && x.sched.length === 7 ? x.sched : DAYS.map((d) => ({ day: d, on: false, start: '', end: '', breakMin: 0 })); const chk = shortCheck(Object.assign({}, x, { sched }));
  const sum = chk.weeklyHours > 0 ? '<div class="jh-field__hint" data-an-sum><b>주 소정근로시간 ' + esc(String(Math.round(chk.weeklyHours * 10) / 10)) + '시간</b> · 월 환산 약 ' + esc(String(chk.monthlyHours)) + '시간</div>' : '<div class="jh-field__hint" data-an-sum>근로일을 눌러 켜고 시작·종료 시각을 입력하세요(HH:MM).</div>';
  const notes = chk.warnings.length ? '<ul class="jh-field__hint" data-an-notes>' + chk.warnings.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '';
  return sum + notes;
}
/** 단시간 근로자일 때 일반 "급여 입력" 카드 자리에 들어가는 칸들(근로일 표·초과 한도·지급일·특약·시급). errs 는 저장 때 막힌 이유 목록 */
export function shortFormCardsHtml(f, errs) {
  const x = f || {}; const sched = Array.isArray(x.sched) && x.sched.length === 7 ? x.sched : DAYS.map((d) => ({ day: d, on: false, start: '', end: '', breakMin: 0 }));
  const errHtml = errs && errs.length ? '<div class="jh-alert" data-tone="danger" role="alert"><b>저장하기 전에 고쳐 주세요</b><ul>' + errs.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul></div>' : '';
  const days = card('🕒 근로일 및 근로일별 근로시간', '<div class="jh-hr__pad"><div class="jh-field__hint">근로하는 요일을 눌러 켜고 시작·종료 시각과 휴게시간(분)을 입력합니다. 4시간 이상이면 휴게 30분, 8시간 이상이면 1시간 이상입니다.</div>' + sched.map(dayRow).join('') + '<div data-an-sumwrap>' + shortSummaryHtml(Object.assign({}, x, { sched })) + '</div></div>');
  const terms = card('📋 근무장소·초과근로·지급일·특약', '<div class="jh-hr__pad"><div class="jh-field"><label class="jh-field__label">근무 장소</label><input class="jh-input" data-an-f="workPlace" value="' + esc(x.workPlace) + '"></div>'
    + '<div class="jh-hr__grid"><div class="jh-field"><label class="jh-field__label">초과근로 한도 (주 시간, 선택)</label><input class="jh-input" type="number" min="0" step="0.5" inputmode="decimal" data-an-f="maxWeekly" value="' + esc(x.maxWeekly) + '" placeholder="예: 14" style="max-width:9rem"></div>'
    + '<div class="jh-field"><label class="jh-field__label">임금 지급일</label><input class="jh-input" data-an-f="payDay" value="' + esc(x.payDay) + '" placeholder="예: 익월 10일"></div></div>'
    + '<div class="jh-field"><label class="jh-field__label">특약·기타 (선택)</label><textarea class="jh-input" rows="3" data-an-f="extra" placeholder="계약서 제11조에 그대로 들어갑니다">' + esc(x.extra) + '</textarea></div></div>');
  const yr = Number(String(x.startDate || '').slice(0, 4)); const hint = MIN_HOURLY[yr] ? yr + '년 최저시급 ' + MIN_HOURLY[yr].toLocaleString('ko-KR') + '원 이상이어야 합니다.' : '해당 연도의 최저시급 이상이어야 합니다.';
  const pay = card('💰 시급', '<div class="jh-hr__pad"><div class="jh-field"><label class="jh-field__label">시급 (원)</label><input class="jh-input" inputmode="numeric" data-an-pay value="' + (x.hourly ? esc(Number(x.hourly).toLocaleString('ko-KR')) : '') + '" placeholder="숫자만" style="text-align:right"></div><div class="jh-field__hint">' + esc(hint) + ' 단시간 근로자는 시급으로 계산합니다(월급·연봉 환산 없음).</div></div>');
  return errHtml + days + terms + pay;
}
