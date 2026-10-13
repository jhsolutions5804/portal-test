import { esc } from '../../core/ui.js?v=20261013zd';
import { dayTotals, mdSum, activeWorkersForDate, canWorkOn, hasManday } from './attendance.js?v=20261013zd';
const f1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1);
const chip = (t, tone) => '<span class="jh-pjt__chip" data-tone="' + esc(tone || '') + '">' + esc(t) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const sel = (attr, val, opts) => '<select class="jh-select" ' + attr + '>' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
const dow = (d) => '일월화수목금토'[new Date(d + 'T12:00:00Z').getUTCDay()];
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
  if (!st.projects.length) return '<div class="jh-pjt"><div class="jh-empty">열 수 있는 프로젝트가 없습니다.</div></div>';
  const ws = dayWorkers(st); const ids = ws.map((w) => w.id); const T = dayTotals(st.att, st.md, null); const orphanIds = Object.keys(st.md).filter((k) => (st.md[k] || 0) > 0 && !st.roster.some((w) => w.id === k)); const orphanSum = orphanIds.reduce((s, k) => s + st.md[k], 0);
  const attended = ws.filter((w) => st.att.indexOf(w.id) !== -1 || (st.md[w.id] || 0) > 0).length;
  const bar = '<div class="jh-pjt__bar">' + sel('data-pa-proj', st.proj, st.projects.map((p) => [p.key, p.label])) + '<span class="jh-pjt__datenav"><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="prev" aria-label="전날">‹</button><input class="jh-input" type="date" data-pa-date value="' + esc(st.date) + '"><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="next" aria-label="다음날">›</button><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="today">오늘</button></span></div>';
  const sum = '<div class="jh-pjt__sum"><div><span class="jh-field__hint">' + esc(st.date) + ' (' + dow(st.date) + ')</span></div><div class="jh-pjt__cells"><div><span class="jh-field__hint">출역</span><strong>' + attended + '명</strong></div><div><span class="jh-field__hint">공수 합계</span><strong>' + f1(T.manday) + '</strong></div></div></div>'
    + (orphanIds.length ? '<div class="jh-alert" data-tone="warn" role="status">명부에 없는 근로자의 공수 ' + f1(orphanSum) + '이(가) 이 날짜에 기록돼 있습니다(' + esc(orphanIds.join(', ')) + '). 합계에는 포함되고, 월 집계표에 "(명부에 없음)"으로 나옵니다.</div>' : '');
  const canAny = !st.readonly && ws.some((w) => canWorkOn(st.me, w, st.teamMasterIds));
  const bulk = '<div class="jh-pjt__bulk"><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="all"' + (canAny ? '' : ' disabled') + '>전체 출역 체크/해제</button><span class="jh-pjt__bulkmd"><input class="jh-input jh-pjt__mdin" inputmode="decimal" data-pa-bulk placeholder="공수"' + (canAny ? '' : ' disabled') + '><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="bulk"' + (canAny ? '' : ' disabled') + '>전원 적용</button></span></div>';
  const rows = ws.length ? ws.map((w) => rowHtml(st, w)).join('') : '<div class="jh-empty">이 날짜에 투입된 인원이 없습니다.</div>';
  const note = '<div class="jh-field__hint">공수를 입력하면 출역도 함께 체크되고, 출역을 해제하면 그 사람의 공수도 비워집니다. 퇴사일 전날까지는 공수가 나오고 퇴사일부터는 입력 대상에서 빠집니다.</div>';
  const recent = st.recent.map((r) => '<div class="jh-pjt__rec"><span>' + esc(r.date.slice(5)) + ' (' + dow(r.date) + ')</span><strong>' + f1(r.sum) + '</strong></div>').join('');
  const tools = '<div class="jh-pjt__bar"><span class="jh-pjt__tools"><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="sheet">📋 이달 공수 집계표</button><button type="button" class="jh-btn" data-variant="secondary" data-pa-act="cum">👤 인원별 누적 공수</button></span>' + (st.manage ? '<button type="button" class="jh-btn" data-variant="ghost" data-pa-act="manage">⚙️ 명단 관리</button>' : '') + '</div>';
  return '<div class="jh-pjt">' + bar + card('👷 출역·공수', '<div class="jh-pjt__pad">' + sum + bulk + '<div class="jh-pjt__list">' + rows + '</div>' + note + '</div>') + card('최근 7일 공수 합계', '<div class="jh-pjt__pad jh-pjt__recent">' + recent + '</div>') + '<div class="jh-pjt__pad">' + tools + '</div><div id="pa-panel">' + (st.panel === 'sheet' ? sheetHtml(st) : st.panel === 'cum' ? cumHtml(st) : st.panel === 'manage' ? manageHtml(st) : '') + '</div></div>';
}
/** 월 공수 집계표: 월 이동, 인원별 날짜별 공수와 합계 */
export function sheetHtml(st) {
  const s = st.sheet; if (!s) return card('이달 공수 집계표', '<div class="jh-pjt__pad"><div class="jh-empty">불러오는 중...</div></div>');
  const head = '<tr><th>이름</th>' + s.keys.map((k, i) => '<th class="jh-pjt__num">' + (i + 1) + '</th>').join('') + '<th class="jh-pjt__num">합계</th></tr>';
  const body = s.rows.map((r) => '<tr' + (r.orphan ? ' data-orphan="1"' : '') + '><td>' + esc(r.name) + '</td>' + r.values.map((v) => '<td class="jh-pjt__num">' + (v ? f1(v) : '') + '</td>').join('') + '<td class="jh-pjt__num"><strong>' + f1(r.total) + '</strong></td></tr>').join('') + '<tr><td><strong>합계</strong></td>' + s.dayTotals.map((v) => '<td class="jh-pjt__num">' + (v ? f1(v) : '') + '</td>').join('') + '<td class="jh-pjt__num"><strong>' + f1(s.grand) + '</strong></td></tr>';
  const right = '<span class="jh-pjt__tools"><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="mprev" aria-label="이전 달">‹</button><strong>' + st.month.y + '년 ' + (st.month.m + 1) + '월</strong><button type="button" class="jh-btn" data-variant="ghost" data-pa-act="mnext" aria-label="다음 달">›</button></span>';
  return card('이달 공수 집계표', '<div class="jh-pjt__pad"><div class="jh-pjt__scroll"><table class="jh-pjt__table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div><div class="jh-field__hint">그 달 1일에 재직 중이던 인원(월 중 퇴사자 포함)과, 명부에서 빠졌어도 공수가 기록된 사람이 모두 나옵니다.</div></div>', right);
}
/** 인원별 누적 공수(프로젝트 전체 기간) */
export function cumHtml(st) {
  if (!st.cum) return card('인원별 누적 공수', '<div class="jh-pjt__pad"><div class="jh-empty">불러오는 중...</div></div>');
  const name = (id) => { const w = st.roster.find((x) => x.id === id); return w ? w.name || id : '(명부에 없음) ' + id; };
  const rows = Object.keys(st.cum).filter((k) => st.cum[k] > 0).sort((a, b) => st.cum[b] - st.cum[a]).map((k) => '<div class="jh-pjt__rec"><span>' + esc(name(k)) + '</span><strong>' + f1(st.cum[k]) + '</strong></div>').join('');
  return card('인원별 누적 공수', '<div class="jh-pjt__pad jh-pjt__recent">' + (rows || '<div class="jh-empty">공수 기록이 없습니다.</div>') + '</div>');
}
/** 명단 관리: 마스터 명부에서 투입, 투입 종료/재투입(명단에서 지우지 않는다 — 공수 기록이 사라지지 않게) */
export function manageHtml(st) {
  const have = new Set(st.roster.map((w) => w.id));
  const opts = [['', '— 마스터 명부에서 선택 —']].concat(Object.keys(st.masters).filter((id) => !have.has(id) && !st.masters[id].resigned && st.masters[id].name).map((id) => [id, st.masters[id].name + ' (' + (st.masters[id].birth || '생년월일 없음') + ')']));
  const list = st.roster.map((w) => '<div class="jh-pjt__rec"><span>' + esc(w.name || w.id) + (w.active === false ? ' ' + chip('투입 종료', 'gray') : '') + '</span>' + (w.active === false ? '<button type="button" class="jh-btn" data-variant="ghost" data-pa-rejoin="' + esc(w.id) + '">재투입</button>' : '<button type="button" class="jh-btn" data-variant="ghost" data-pa-end="' + esc(w.id) + '">투입 종료</button>') + '</div>').join('');
  return card('명단 관리', '<div class="jh-pjt__pad"><div class="jh-pjt__bar">' + sel('data-pa-addsel', '', opts) + '<button type="button" class="jh-btn" data-variant="primary" data-pa-act="add">투입</button></div>' + (list || '<div class="jh-empty">명단이 비어 있습니다.</div>') + '<div class="jh-field__hint">"투입 종료"는 명단에서 지우지 않고 더 이상 입력 대상에서만 뺍니다. 지금까지의 출역·공수는 그대로 남아 집계표에 나옵니다.</div></div>');
}
