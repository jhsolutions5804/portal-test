/* 주 단위 근로시간 화면 — HTML 만 만드는 순수 함수(시험: tests/hr-weekly-view.test.mjs). 달력 아래 "주별 근로시간" 카드와 인사 홈 신호 칸. */
import { esc } from '../../core/ui.js?v=20261031d';
import { isHoliday } from '../../shared/holidays.js?v=20261031d';
import { WEEK_STAGES, WEEK_LEGAL, WEEK_OT_LIMIT, weeksOfMonth, weekSummary, weekDetail, weekStart, weekLabel } from './weekly.js?v=20261031d';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const hh = (v) => (v === null || v === undefined ? '—' : String(v));
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const stageChip = (stage) => (stage ? chip((WEEK_STAGES[stage].mark ? WEEK_STAGES[stage].mark + ' ' : '') + WEEK_STAGES[stage].label, WEEK_STAGES[stage].tone) : '<span class="jh-field__hint">자료 없음</span>');
const NOTE = '출퇴근 기록 기준(휴게 제외 실근로, 평일·주말 합산, 연차 등 휴가 시간은 제외). 법정은 주 40시간 + 연장 12시간 = 52시간이고 연장은 40시간 초과분으로 셉니다. 자정을 넘긴 근무는 출근한 날의 주에 합산합니다. 경고만 표시하며 급여 계산은 바뀌지 않습니다.';

/** 달력 아래 카드. st: { y, m, rows(그 달 + 앞·뒤 달 기록), selWeek, today } */
export function weeklyCardHtml(st) {
  const weeks = weeksOfMonth(st.y, st.m), cur = weekStart(st.today || '');
  const sums = weeks.map((s) => weekSummary(st.rows, s));
  const body = sums.map((s) => '<tr' + (s.start === st.selWeek ? ' class="jh-hr__sum"' : '') + '><td>' + esc(weekLabel(s.start)) + (s.start === cur ? ' ' + chip('이번 주', 'accent') : '') + '</td><td style="text-align:right">' + hh(s.total) + '</td><td style="text-align:right">' + (s.ot === null ? '—' : s.ot + ' / ' + WEEK_OT_LIMIT) + '</td><td>' + stageChip(s.stage) + (s.suspect ? ' <span class="jh-field__hint">⚠️ 기록 확인 ' + s.suspect + '건</span>' : '') + '</td><td>' + (s.total === null ? '' : '<button type="button" class="jh-btn" data-variant="ghost" data-ac-week="' + esc(s.start) + '">' + (s.start === st.selWeek ? '닫기' : '일별') + '</button>') + '</td></tr>').join('');
  const sel = sums.find((s) => s.start === st.selWeek && s.total !== null);
  return card('주별 근로시간 (월~일)', '<div class="jh-hr__pad"><div class="jh-hr__scroll" style="overflow-x:auto"><table class="jh-hr-table" data-w-table><thead><tr><th>주</th><th>근로시간</th><th>연장(40h 초과)</th><th>단계</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div><div class="jh-field__hint" style="margin-top:.5rem">' + esc(NOTE) + '</div></div>')
    + (sel ? weekDetailHtml(st.rows, sel) : '');
}
function weekDetailHtml(rows, sum) {
  const days = weekDetail(rows, sum.start, isHoliday);
  const tr = days.map((d) => '<tr><td>' + esc(d.date.slice(5)) + ' (' + DOW[d.dow] + ')' + (d.off ? ' <span class="jh-field__hint">휴일</span>' : '') + '</td><td>' + (d.rec ? esc(d.checkIn) + ' ~ ' + esc(d.checkOut) : '<span class="jh-field__hint">—</span>') + '</td><td style="text-align:right">' + (d.rec ? d.breakMinutes + '분' : '') + '</td><td style="text-align:right">' + (d.rec ? d.hours : '') + '</td><td>' + (d.trip ? '✈️ 출장' : '') + (d.suspect ? ' ⚠️ 확인 필요' : '') + '</td></tr>').join('');
  const sus = days.filter((d) => d.suspect).length;
  return card(weekLabel(sum.start) + ' 일별 내역 — 합계 ' + sum.total + 'h', '<div class="jh-hr__pad"><div class="jh-hr__scroll" style="overflow-x:auto"><table class="jh-hr-table" data-w-detail><thead><tr><th>날짜</th><th>출근~퇴근</th><th>휴게</th><th>근로시간</th><th></th></tr></thead><tbody>' + tr + '<tr class="jh-hr__sum"><td>합계</td><td></td><td></td><td style="text-align:right">' + sum.total + '</td><td>' + stageChip(sum.stage) + '</td></tr></tbody></table></div><div class="jh-field__hint">주말 근로 ' + sum.holidayHours + 'h 포함 · 법정 ' + WEEK_LEGAL + 'h + 연장 ' + sum.ot + 'h(남은 연장 ' + sum.otRemain + 'h)</div>' + (sus ? '<div class="jh-alert" data-tone="warn" role="status">⚠️ 하루 16시간을 넘거나 출근·퇴근 시각이 같은 기록이 ' + sus + '건 있습니다. 퇴근 시각이 빠졌을 수 있어 합계가 실제보다 클 수 있습니다 — 달력에서 그 날을 열어 확인해 주세요.</div>' : '') + '</div>');
}

/** 인사 홈 신호 칸. rep = weeklyReport 결과. null 이면 불러오는 중 */
export function weeklyHomeHtml(rep) {
  if (!rep) return '<div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div>';
  const lbl = { this: '이번 주', last: '지난주' };
  const rows = rep.items.map((it) => '<tr><td><button type="button" class="jh-btn" data-variant="ghost" data-hm-week="' + esc(it.workerId + '|' + it.start) + '" style="padding:0 .25rem">' + esc(it.name) + '</button></td><td>' + lbl[it.which] + ' <span class="jh-field__hint">' + esc(weekLabel(it.start)) + '</span></td><td style="text-align:right">' + it.total + 'h' + (it.suspect ? ' ⚠️' : '') + '</td><td style="text-align:right">' + it.ot + ' / ' + WEEK_OT_LIMIT + '</td><td>' + stageChip(it.stage) + '</td></tr>').join('');
  const over = rep.items.filter((i) => i.stage === 'over').length;
  const head = over ? '<div class="jh-alert" data-tone="danger" role="alert"><b>🔴 주 52시간을 넘은 직원 ' + over + '명</b> — 연장근로 한도(주 12시간) 초과 위험입니다.</div>' : '';
  const empty = !rep.withData ? '<div class="jh-field__hint">이번 주·지난주 출퇴근 기록이 없습니다(출퇴근 기록은 2026-08부터 쌓입니다).</div>' : '<div class="jh-field__hint">이번 주·지난주에 44시간 이상 일한 직원이 없습니다. (기록이 있는 직원 ' + rep.withData + '명 확인)</div>';
  return card('⏱ 주 근로시간 (이번 주·지난주)', '<div class="jh-hr__pad">' + head + (rep.items.length ? '<div class="jh-hr__scroll" style="overflow-x:auto"><table class="jh-hr-table" data-w-home><thead><tr><th>직원</th><th>주</th><th>근로시간</th><th>연장</th><th>단계</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="jh-field__hint" style="margin-top:.5rem">이름을 누르면 그 직원의 출퇴근 달력이 열립니다. 이번 주는 오늘까지 기록 기준입니다. 44h 주의 · 48h 경고 · 52h 초과.</div>' : empty) + '</div>');
}
