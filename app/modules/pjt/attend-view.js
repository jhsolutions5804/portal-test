import { esc } from '../../core/ui.js?v=20261030a';
import { dayTotals, mdSum, activeWorkersForDate, canWorkOn, hasManday, monthlyMatrix } from './attendance.js?v=20261030a';
import { holidayName, isWeekend } from '../../shared/holidays.js?v=20261030a';
import { monthGrid } from './schedule.js?v=20261030a';
const f1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
const chip = (t, tone) => '<span class="jh-pjt__chip" data-tone="' + esc(tone || '') + '">' + esc(t) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const sel = (attr, val, opts) => '<select class="jh-select" ' + attr + '>' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
const dow = (d) => '일월화수목금토'[new Date(d + 'T12:00:00Z').getUTCDay()];
/** 쉬는 날 종류: 일요일·공휴일(빨간날) 'red', 토요일 'sat', 평일 '' — 집계표 열과 날짜 머리글에 색으로 표시 */
export const offKind = (d) => { const hol = holidayName(d); const w = new Date(d + 'T12:00:00Z').getUTCDay(); return hol || w === 0 ? 'red' : w === 6 ? 'sat' : ''; };
/** 오늘 일(출역·공수) 목록의 대상 인원: 퇴사 전이고 투입 중인 사람 + 그날 이미 기록된 사람 */
export function dayWorkers(st) {
  const rec = { checks: st.att, md: st.md }; const act = activeWorkersForDate(st.roster, st.resigned, st.date, rec);
  return act.filter((w) => w.active !== false || st.att.indexOf(w.id) !== -1 || (st.md[w.id] || 0) > 0);
}
const rowHtml = (st, w) => {
  const can = canWorkOn(st.me, w, st.teamMasterIds) && !st.readonly; const md = st.md[w.id] || 0; const on = st.att.indexOf(w.id) !== -1 || md > 0; const dis = can ? '' : ' disabled';
  const resignedNote = (() => { const info = (st.resigned || {})[w.id] || (st.resigned || {})[w.masterId]; return info && info.resigned && info.resignedDate && info.resignedDate <= st.date ? chip('퇴사 ' + info.resignedDate, 'amber') : (info && info.resigned && info.resignedDate ? chip(info.resignedDate + ' 퇴사', 'gray') : ''); })();
  return '<div class="jh-pjt__row" data-on="' + on + '"><button type="button" class="jh-pjt__tog" data-pa-tog="' + esc(w.id) + '" aria-pressed="' + on + '" aria-label="' + esc(w.name) + ' 출역"' + dis + '>' + (on ? '✓' : '') + '</button><span class="jh-pjt__name"><strong>' + esc(w.name || w.id) + '</strong>' + (w.role ? ' <span class="jh-field__hint">' + esc(w.role) + '</span>' : '') + (w.active === false ? ' ' + chip('투입 종료', 'gray') : '') + ' ' + resignedNote + '</span>'
    + '<span class="jh-pjt__md"><button type="button" class="jh-btn" data-variant="ghost" data-pa-adj="' + esc(w.id) + ':-0.5" aria-label="공수 0.5 감소"' + dis + '>−</button><input class="jh-input jh-pjt__mdin" inputmode="decimal" data-pa-md="' + esc(w.id) + '" value="' + (md ? f1(md) : '') + '" placeholder="0.0" aria-label="' + esc(w.name) + ' 공수"' + dis + '><button type="button" class="jh-btn" data-variant="ghost" data-pa-adj="' + esc(w.id) + ':0.5" aria-label="공수 0.5 증가"' + dis + '>＋</button></span></div>';
};
/** 근태·공수(일) 화면: 프로젝트·날짜 고르기, 요약, 일괄 처리, 인원별 출역 체크와 공수, 명부에 없는 공수, 최근 7일, 집계표·누적·명단 관리 열기 */
export function attendHtml(st) {
  if (!st.proj) return '<div class="jh-pjt"><div class="jh-alert" data-tone="warn" role="status">이 프로젝트를 열 수 없습니다. 위 메뉴에서 프로젝트를 고른 뒤 "출역·공수" 탭을 여세요(참여자로 지정된 프로젝트만 열립니다).</div></div>';
  const ws = dayWorkers(st); const ids = ws.map((w) => w.id); const T = dayTotals(st.att, st.md, null); const orphanIds = Object.keys(st.md).filter((k) => (st.md[k] || 0) > 0 && !st.roster.some((w) => w.id === k)); const orphanSum = orphanIds.reduce((s, k) => s + st.md[k], 0);
  const attended = ws.filter((w) => st.att.indexOf(w.id) !== -1 || (st.md[w.id] || 0) > 0).length;
  const projLabel = (st.projects.find((p) => p.key === st.proj) || {}).label || '';   // 프로젝트는 위 메뉴에서 이미 정해져 있다 — 여기서 다시 고르게 하지 않고(팀장 실수 방지) 이름만 크게 보여 준다
  // 위쪽 한 줄(전체 폭): 프로젝트 이름 | 날짜 이동 + 날짜·휴일 표시 | 출역·공수 합계 — 아래는 왼쪽 인원별 입력, 오른쪽 집계표
  const dateLbl = '<span class="jh-pjt__date" data-off="' + offKind(st.date) + '">' + esc(st.date) + ' (' + dow(st.date) + ')</span>' + (holidayName(st.date) ? ' ' + chip(holidayName(st.date), 'red') : isWeekend(st.date) ? ' ' + chip(dow(st.date) === '토' ? '토요일' : '일요일', dow(st.date) === '토' ? 'blue' : 'red') : '');
  const top = '<div class="jh-pjt__wide jh-pa__top"><div class="jh-pa__id"><span class="jh-pjt__projlabel">🏗️ ' + esc(projLabel) + '</span><span class="jh-field__hint">출역·공수</span></div><span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="prev" aria-label="전날">‹</button><input class="jh-input" type="date" data-pa-date value="' + esc(st.date) + '"><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="next" aria-label="다음날">›</button><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="today">오늘</button></span><span class="jh-pa__dl">' + dateLbl + '</span><div class="jh-pa__kpis"><div class="jh-pa__kpi"><span class="jh-field__hint">출역</span><strong>' + attended + '명</strong></div><div class="jh-pa__kpi"><span class="jh-field__hint">공수 합계</span><strong>' + f1(T.manday) + '</strong></div></div></div>';
  const orphan = orphanIds.length ? '<div class="jh-alert" data-tone="warn" role="status">명부에 없는 근로자의 공수 ' + f1(orphanSum) + '이(가) 이 날짜에 기록돼 있습니다(' + esc(orphanIds.join(', ')) + '). 합계에는 포함되고, 월 집계표에 "(명부에 없음)"으로 나옵니다.</div>' : '';
  const canAny = !st.readonly && ws.some((w) => canWorkOn(st.me, w, st.teamMasterIds));
  const bulk = '<div class="jh-pjt__bulk"><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="all"' + (canAny ? '' : ' disabled') + '>전체 출역 체크/해제</button><span class="jh-pjt__bulkmd"><input class="jh-input jh-pjt__mdin" inputmode="decimal" data-pa-bulk placeholder="공수"' + (canAny ? '' : ' disabled') + '><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="bulk"' + (canAny ? '' : ' disabled') + '>전원 적용</button></span></div>';
  const rows = ws.length ? ws.map((w) => rowHtml(st, w)).join('') : '<div class="jh-empty">이 날짜에 투입된 인원이 없습니다.</div>';
  const note = '<div class="jh-field__hint">공수를 입력하면 출역도 함께 체크되고, 출역을 해제하면 그 사람의 공수도 비워집니다. 퇴사일 전날까지는 공수가 나오고 퇴사일부터는 입력 대상에서 빠집니다.</div>';
  const tabs = [['sheet', '이달 공수 집계표'], ['cum', '월별 누적 공수'], ['recent', '최근 7일']].concat(st.manage ? [['manage', '명단 관리']] : []);
  const tabBar = '<div class="jh-ro__ftabs" role="tablist" aria-label="공수 보기">' + tabs.map(([k, l]) => '<button type="button" role="tab" class="jh-ro__ftab" data-pa-tab="' + k + '" aria-selected="' + (st.panel === k) + '">' + esc(l) + '</button>').join('') + '</div>';
  const panel = st.panel === 'cum' ? cumHtml(st) : st.panel === 'recent' ? recentHtml(st) : st.panel === 'manage' && st.manage ? manageHtml(st) : sheetHtml(st);
  // 넓은 화면: 위쪽 한 줄 아래 왼쪽은 인원별 입력(좁게), 오른쪽은 공수 집계표·인원별 누적·최근 7일·명단 관리를 탭으로 항상 보여 준다(입력하면 바로 갱신). 폰은 한 열
  return '<div class="jh-pjt jh-pa">' + top + '<div class="jh-pjt__main">' + card('인원별 출역·공수', '<div class="jh-pjt__pad">' + orphan + bulk + '<div class="jh-pjt__list">' + rows + '</div>' + note + '</div>') + '</div><div class="jh-pjt__side">' + tabBar + '<div id="pa-panel">' + panel + '</div></div></div>';
}
/** 최근 7일 공수 합계(선택한 날짜까지) */
export function recentHtml(st) {
  const recent = st.recent.map((r) => '<div class="jh-pjt__rec"><span>' + esc(r.date.slice(5)) + ' (' + dow(r.date) + ')</span><strong>' + f1(r.sum) + '</strong></div>').join('');
  return card('최근 7일 공수 합계', '<div class="jh-pjt__pad jh-pjt__recent">' + recent + '</div>');
}
/** 이달 공수: 월 달력(칸마다 그날 공수 합계·출역 인원, 날짜를 누르면 그 날짜 입력으로 이동) + 인원별 이달 합계. 옆으로 스크롤되는 31열 표 대신 */
export function sheetHtml(st) {
  const s = st.sheet; if (!s) return card('이달 공수', '<div class="jh-pjt__pad"><div class="jh-empty">불러오는 중...</div></div>');
  const at = {}; s.keys.forEach((k, i) => { at[k] = i; });
  const day = (k) => { const i = at[k]; if (i == null) return { md: 0, n: 0 }; return { md: s.dayTotals[i] || 0, n: s.rows.filter((r) => (r.values[i] || 0) > 0).length }; };
  const dowH = ['일', '월', '화', '수', '목', '금', '토'].map((d, i) => '<div class="jh-pjt__calh" data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</div>').join('');
  const cells = monthGrid(st.month.y, st.month.m).flat().map((k) => { if (!k) return '<div class="jh-pjt__calc" data-empty="1"></div>'; const d = day(k); const hn = holidayName(k);
    return '<button type="button" class="jh-pjt__calc jh-pa__calc" data-pa-goday="' + k + '" data-sel="' + (k === st.date) + '" data-off="' + offKind(k) + '" title="' + esc(hn || '') + '"><span class="jh-pjt__calnum">' + Number(k.slice(8)) + '</span>' + (d.md > 0 ? '<strong class="jh-pa__md">' + f1(d.md) + '</strong><span class="jh-field__hint">' + d.n + '명</span>' : '') + '</button>'; }).join('');
  const people = s.rows.map((r) => { const days = r.values.filter((v) => v > 0).length; return '<tr' + (r.orphan ? ' data-orphan="1"' : '') + '><td>' + esc(r.name) + '</td><td class="jh-pjt__num">' + days + '일</td><td class="jh-pjt__num"><strong>' + f1(r.total) + '</strong></td></tr>'; }).join('');
  const right = '<span class="jh-pjt__tools"><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="mprev" aria-label="이전 달">‹</button><strong>' + st.month.y + '년 ' + (st.month.m + 1) + '월</strong><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="mnext" aria-label="다음 달">›</button></span>';
  return card('이달 공수', '<div class="jh-pjt__pad"><div class="jh-pjt__calgrid">' + dowH + cells + '</div><div class="jh-field__hint">칸의 숫자는 그날 공수 합계와 출역 인원입니다. 날짜를 누르면 그 날짜의 출역·공수 입력으로 이동합니다. 그 달 1일에 재직 중이던 인원(월 중 퇴사자 포함)과, 명부에서 빠졌어도 공수가 기록된 사람이 모두 나옵니다.</div>'
    + '<div class="jh-pjt__scroll"><table class="jh-pjt__table jh-pa__people"><thead><tr><th>이름</th><th class="jh-pjt__num">출역</th><th class="jh-pjt__num">이달 공수</th></tr></thead><tbody>' + people + '<tr><td><strong>합계</strong></td><td></td><td class="jh-pjt__num"><strong>' + f1(s.grand) + '</strong></td></tr></tbody></table></div></div>', right);
}
/** 월별 누적 공수(프로젝트 전체 기간): 사람 × 달, 오른쪽 합계·아래 월 합계. 보고 있는 날짜의 달 열을 강조 */
export function cumHtml(st) {
  if (!st.cumDocs) return card('월별 누적 공수', '<div class="jh-pjt__pad"><div class="jh-empty">불러오는 중...</div></div>');
  const m = monthlyMatrix(st.roster, st.cumDocs); const cur = st.date.slice(0, 7);
  if (!m.months.length) return card('월별 누적 공수', '<div class="jh-pjt__pad"><div class="jh-empty">공수 기록이 없습니다.</div></div>');
  const head = '<tr><th>이름</th>' + m.months.map((k) => '<th class="jh-pjt__num" data-cur="' + (k === cur) + '">' + esc(k.slice(2).replace('-', '.')) + '</th>').join('') + '<th class="jh-pjt__num">합계</th></tr>';
  const body = m.rows.map((r) => '<tr' + (r.orphan ? ' data-orphan="1"' : '') + '><td>' + esc(r.name) + '</td>' + r.values.map((x, i) => '<td class="jh-pjt__num" data-cur="' + (m.months[i] === cur) + '">' + (x ? f1(x) : '') + '</td>').join('') + '<td class="jh-pjt__num"><strong>' + f1(r.total) + '</strong></td></tr>').join('') + '<tr><td><strong>월 합계</strong></td>' + m.monthTotals.map((x, i) => '<td class="jh-pjt__num" data-cur="' + (m.months[i] === cur) + '"><strong>' + f1(x) + '</strong></td>').join('') + '<td class="jh-pjt__num"><strong>' + f1(m.grand) + '</strong></td></tr>';
  return card('월별 누적 공수', '<div class="jh-pjt__pad"><div class="jh-pjt__scroll"><table class="jh-pjt__table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div><div class="jh-field__hint">이 프로젝트의 달별 공수와 합계입니다. 열 머리글은 연.월이고 보고 있는 날짜의 달이 강조됩니다.</div></div>');
}
/** 명단 관리: 마스터 명부에서 투입, 투입 종료/재투입(명단에서 지우지 않는다 — 공수 기록이 사라지지 않게) */
export function manageHtml(st) {
  const have = new Set(st.roster.map((w) => w.id));
  const opts = [['', '— 마스터 명부에서 선택 —']].concat(Object.keys(st.masters).filter((id) => !have.has(id) && !st.masters[id].resigned && st.masters[id].name).map((id) => [id, st.masters[id].name + ' (' + (st.masters[id].birth || '생년월일 없음') + ')']));
  const list = st.roster.map((w) => '<div class="jh-pjt__rec"><span>' + esc(w.name || w.id) + (w.active === false ? ' ' + chip('투입 종료', 'gray') : '') + '</span>' + (w.active === false ? '<button type="button" class="jh-btn" data-variant="ghost" data-pa-rejoin="' + esc(w.id) + '">재투입</button>' : '<button type="button" class="jh-btn" data-variant="ghost" data-pa-end="' + esc(w.id) + '">투입 종료</button>') + '</div>').join('');
  return card('명단 관리', '<div class="jh-pjt__pad"><div class="jh-pjt__bar">' + sel('data-pa-addsel', '', opts) + '<button type="button" class="jh-btn" data-variant="primary" data-pa-act="add">투입</button></div>' + (list || '<div class="jh-empty">명단이 비어 있습니다.</div>') + '<div class="jh-field__hint">투입할 사람은 <a href="#/pjt/roster">근로자 연명부</a>(마스터 명부)에 있는 사람 중에서 고릅니다. 이름·생년월일 같은 정보는 연명부에서 고치고, 이 프로젝트의 명단은 여기서 투입·종료만 합니다(프로젝트마다 따로). "투입 종료"는 명단에서 지우지 않고 더 이상 입력 대상에서만 뺍니다. 지금까지의 출역·공수는 그대로 남아 집계표에 나옵니다.</div></div>');
}
