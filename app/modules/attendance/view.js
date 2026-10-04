import { esc } from '../../core/ui.js?v=20261004m';
import { sourceLabel, dayLabel, fmtH, monthTotals } from './logic.js?v=20261004m';

const head = (t, link) => '<div class="jh-panel__head"><h3>' + t + '</h3>' + (link || '') + '</div>';
const note = (tone, text) => '<div class="jh-form"><div class="jh-alert" data-tone="' + tone + '"' + (tone === 'danger' ? ' role="alert"' : '') + '>' + esc(text) + '</div></div>';
const LINK = '<a class="jh-link" href="#/attendance/input">기록 확인·수정 ›</a>';

/** 플랫폼 홈의 출퇴근 위젯 — 원터치 출근·퇴근 */
export function clockWidgetHtml(m) {
  const h = head('⏰ 출퇴근', m.state === 'ok' ? LINK : '');
  if (m.state === 'loading') return '<div class="jh-panel jh-card">' + h + '<div class="jh-empty">불러오는 중…</div></div>';
  if (m.state === 'unlinked') return '<div class="jh-panel jh-card">' + h + note('info', '계정이 근무자 명부와 연동되어 있지 않아 출퇴근을 기록할 수 없습니다. 인사 담당자에게 연동을 요청해 주세요.') + '</div>';
  if (m.state === 'error') return '<div class="jh-panel jh-card">' + h + note('danger', '출퇴근 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') + '<div class="jh-form"><button type="button" class="jh-btn" data-variant="secondary" data-clock-retry>다시 불러오기</button></div></div>';
  const c = m.clock; const t = c.target;
  let chip = '<span class="jh-chip">출근 전</span>';
  if (c.state === 'working') chip = '<span class="jh-chip" data-tone="accent">근무 중 · 출근 ' + esc(t.checkIn) + (c.overnight ? ' (어제부터)' : '') + '</span>';
  if (c.state === 'done') chip = '<span class="jh-chip">퇴근 완료 · ' + esc(t.checkIn) + ' ~ ' + esc(t.checkOut) + ' · ' + fmtH(t.workHours) + '</span>';
  const miss = c.missing ? '<div class="jh-alert" data-tone="warn" role="status">어제(' + esc(dayLabel(c.missing.date)) + ') 퇴근 기록이 없습니다. "기록 확인·수정"에서 확인해 주세요.</div>' : '';
  const pct = m.standard > 0 ? Math.max(0, Math.min(100, Math.round((m.monthHours / m.standard) * 100))) : 0;
  return '<div class="jh-panel jh-card">' + h + '<div class="jh-form">' +
    '<div class="jh-clock"><span class="jh-clock__date">' + esc(m.dateText) + '</span><span class="jh-clock__time" data-clock-time>' + esc(m.nowText) + '</span>' + chip + '</div>' + miss +
    '<div class="jh-clock__actions">' +
      '<button type="button" class="jh-btn" data-variant="primary" data-clock="in"' + (c.state === 'ready' && !m.busy ? '' : ' disabled') + '>출근</button>' +
      '<button type="button" class="jh-btn" data-variant="secondary" data-clock="out"' + (c.state === 'working' && !m.busy ? '' : ' disabled') + '>퇴근</button></div>' +
    '<div class="jh-progress" role="img" aria-label="이번 달 소정근로시간 ' + fmtH(m.standard) + ' 중 ' + fmtH(m.monthHours) + '"><span class="jh-progress__bar" style="--p:' + pct + '%"></span></div>' +
    '<span class="jh-field__hint">이번 달 출퇴근 기록 ' + fmtH(m.monthHours) + ' / 소정 ' + fmtH(m.standard) + ' · 휴게 점심 2시간 고정 · 기록 시각은 10분 단위</span></div></div>';
}

const rowHtml = (r, sel) => '<button type="button" class="jh-docrow' + (r.date === sel ? ' is-selected' : '') + '" data-edit="' + esc(r.date) + '">' +
  '<span class="jh-docrow__main"><span class="jh-docrow__title">' + esc(dayLabel(r.date)) + ' · ' + esc(r.checkIn || '--:--') + ' ~ ' + esc(r.checkOut || '--:--') + '</span>' +
  '<span class="jh-docrow__summary">근무 ' + fmtH(r.workHours) + ' · 휴게 ' + r.breakMinutes + '분' + (r.checkIn && !r.checkOut ? ' · 퇴근 기록 없음' : '') + '</span></span>' +
  '<span class="jh-docrow__side"><span class="jh-chip">' + esc(sourceLabel(r.source)) + '</span></span></button>';

/** 권한 안내 + (일반 직원이 지난 날짜를 고른 경우) 결재 요청 작성 버튼 */
export function msgHtml(perm, f) {
  if (perm.ok) return '';
  const dis = perm.code === 'needs-approval' && f && /^\d{2}:\d{2}$/.test(f.checkIn || '') && /^\d{2}:\d{2}$/.test(f.checkOut || '') ? '' : (perm.code === 'needs-approval' ? ' disabled' : '');
  return '<div class="jh-alert" data-tone="info" role="status">' + esc(perm.reason) + '</div>' +
    (perm.code === 'needs-approval' ? '<div><button type="button" class="jh-btn" data-variant="secondary" data-att-request' + dis + '>이 내용으로 결재 요청 작성</button>' + (dis ? '<span class="jh-field__hint"> 출근·퇴근 시각을 먼저 입력하면 요청서에 그대로 채워집니다.</span>' : '') + '</div>' : '');
}

/** 출퇴근 기록 화면: 한 달 요약 · 직접 입력/수정 · 기록 목록 */
export function inputPageHtml(m) {
  const me = m.me; const tot = monthTotals(m.rows);
  const monthOpts = m.months.map((x) => '<option value="' + x + '"' + (x === m.ym ? ' selected' : '') + '>' + x.replace('-', '년 ') + '월</option>').join('');
  const workerSel = me.admin ? '<label class="jh-field" data-field="worker"><span class="jh-field__label">근로자 (관리자)</span><select class="jh-select" data-worker>' + m.workers.map((w) => '<option value="' + esc(w.id) + '"' + (w.id === m.worker.id ? ' selected' : '') + '>' + esc(w.name + (w.rank ? ' ' + w.rank : '')) + '</option>').join('') + '</select></label>' : '';
  const perm = m.perm; const f = m.form;
  const msg = msgHtml(perm, f);
  return '<div class="jh-dashboard">' +
    '<div class="jh-pagehead"><header class="jh-form__head"><h2 class="jh-form__title">출퇴근 기록</h2><p class="jh-form__sub">' + (me.admin ? '관리자는 모든 근로자의 기록을 날짜에 상관없이 입력·수정할 수 있습니다.' : '오늘 기록은 직접 입력·수정할 수 있고, 지난 날짜는 결재 요청 또는 관리자 입력으로 처리합니다.') + '</p></header>' +
      '<label class="jh-field"><span class="jh-field__label">월</span><select class="jh-select" data-month>' + monthOpts + '</select></label></div>' +
    '<div class="jh-kpi-grid" data-cols="3"><div class="jh-kpi" data-tone="accent"><span class="jh-kpi__label">기록 일수</span><span class="jh-kpi__value">' + tot.days + '<small> 일</small></span></div>' +
      '<div class="jh-kpi"><span class="jh-kpi__label">근무시간 합계</span><span class="jh-kpi__value">' + fmtH(tot.hours) + '</span></div>' +
      '<div class="jh-kpi"><span class="jh-kpi__label">소정근로시간</span><span class="jh-kpi__value">' + fmtH(m.standard) + '</span></div></div>' +
    '<section class="jh-panel jh-card">' + head('✍️ 직접 입력 · 수정') + '<div class="jh-form" data-att-form>' + workerSel +
      '<div class="jh-form__row" data-cols="3">' +
        '<label class="jh-field" data-field="date"><span class="jh-field__label">날짜</span><input class="jh-input" type="date" data-att="date" max="' + esc(m.today) + '" value="' + esc(f.date) + '"></label>' +
        '<label class="jh-field" data-field="checkIn"><span class="jh-field__label">출근</span><input class="jh-input" type="time" step="600" data-att="checkIn" value="' + esc(f.checkIn) + '"></label>' +
        '<label class="jh-field" data-field="checkOut"><span class="jh-field__label">퇴근</span><input class="jh-input" type="time" step="600" data-att="checkOut" value="' + esc(f.checkOut) + '"></label></div>' +
      '<div data-att-msg>' + msg + '</div>' +
      '<div class="jh-kpi" data-tone="accent"><span class="jh-kpi__label">근무시간 (휴게 점심 2시간 제외)</span><span class="jh-kpi__value" data-att-hours>' + fmtH(f.hours) + '</span></div>' +
      '<div><button type="button" class="jh-btn" data-variant="primary" data-att-save' + (perm.ok ? '' : ' disabled') + '>저장</button></div></div></section>' +
    '<section class="jh-panel jh-card">' + head('🗓️ ' + esc(m.ym.replace('-', '년 ')) + '월 기록' + (me.admin ? ' · ' + esc(m.worker.name) : '')) +
      '<div class="jh-doclist">' + (m.rows.length ? m.rows.map((r) => rowHtml(r, f.date)).join('') : '<div class="jh-empty">해당 월 기록이 없습니다.</div>') + '</div></section></div>';
}
