/* 내 팀 공수표 화면(표시만). 규칙은 team.js, 불러오기·저장은 team-index.js. */
import { esc } from '../../core/ui.js?v=20261031a';
import { monthLabel } from './overview.js?v=20261031a';
import { won, summaryOf, calendarOf } from './team.js?v=20261031a';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const wrap = (inner) => '<div class="jh-pjt jh-pjt--prog jh-tm"><div class="jh-pjt__main jh-pjt__mainwide"><div class="jh-pjt__proj"><span class="jh-pjt__projlabel">👷 내 팀 공수표</span></div>' + inner + '</div></div>';
const cell = (l, v, cls) => '<div class="jh-ro__kpi"><span>' + l + '</span><strong' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</strong></div>';
/** 개인 공수표(달력) 창 */
function sheetHtml(st) {
  const v = st.view[st.sheet.ti]; const x = v && v.people[st.sheet.pi]; if (!x) return '';
  const weeks = calendarOf(st.y, st.m, x.byDate); const title = x.m.name + '님 ' + monthLabel(st.y, st.m) + ' 공수표';
  const head = DOW.map((d, i) => '<span data-off="' + (i === 0 ? 'red' : i === 6 ? 'sat' : '') + '">' + d + '</span>').join('');
  const cells = weeks.flat().map((c) => (c.k ? '<div class="jh-tm__day"' + (c.total > 0 ? ' data-on="1"' : '') + '><b>' + (+c.k.slice(8)) + '</b>' + (c.total > 0 ? '<strong>' + f1(c.total) + '</strong>' + c.lines.map((l) => '<small title="' + esc(l.pjt) + '">' + esc(l.abbr) + ' ' + f1(l.amount) + '</small>').join('') : '') + '</div>' : '<div class="jh-tm__day" data-empty="1"></div>')).join('');
  return '<div class="jh-dialog" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="jh-dialog__backdrop" data-tm-close></div><div class="jh-dialog__panel jh-tm__sheet"><h3 class="jh-dialog__title">📋 ' + esc(title) + '</h3><div class="jh-dialog__body"><div class="jh-ov__legend">' + (Object.keys(x.byPjt).length ? Object.keys(x.byPjt).map((pn) => '<span class="jh-pjt__chip" data-tone="gray">' + esc(pn) + ' ' + f1(x.byPjt[pn]) + '</span>').join(' ') : '<span class="jh-field__hint">기록 없음</span>') + '</div><div class="jh-ov__dow">' + head + '</div><div class="jh-tm__cal">' + cells + '</div><div class="jh-tm__tot"><span>이번 달 합계</span><strong>' + f1(x.total) + ' 공수</strong></div></div><div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="secondary" data-tm-png>📷 이미지로 저장</button><button type="button" class="jh-btn" data-variant="primary" data-tm-close>닫기</button></div></div></div>';
}
export function teamHtml(st) {
  if (!st.allowed) return wrap('<div class="jh-alert" data-tone="warn" role="status">👥 팀장 전용 화면입니다. 팀장으로 지정된 계정에서만 볼 수 있어요.<br>(팀장 지정은 관리자가 연명부에서 합니다.)</div>');
  const tool = '<div class="jh-ov__tool"><span class="jh-field__hint">' + esc(st.who) + '</span><span class="jh-ov__sp"></span><button type="button" class="jh-btn" data-variant="secondary" data-tm-shift="-1" aria-label="이전 달">‹</button><strong>' + monthLabel(st.y, st.m) + '</strong><button type="button" class="jh-btn" data-variant="secondary" data-tm-shift="1" aria-label="다음 달">›</button></div>';
  if (!st.ready) return wrap(tool + (st.err ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(st.err) + '</div>' : '<div class="jh-empty">불러오는 중...</div>'));
  const S = summaryOf(st.view); const sum = st.view.length >= 2 ? '<div class="jh-ro__kpis">' + cell('전체 팀 공수 (' + S.teams + '팀)', f1(S.md)) + cell('노무비 합계' + (S.priced < S.teams ? ' (단가 있는 ' + S.priced + '팀)' : ''), won(S.amount) + '원') + '</div>' : '';
  const warn = st.failed.length ? '<div class="jh-alert" data-tone="warn" role="status">일부 데이터를 불러오지 못해 집계에서 빠졌을 수 있습니다: ' + st.failed.map(esc).join(', ') + '</div>' : '';
  const teams = st.view.length ? st.view.map((v, ti) => {
    const t = v.t; const rate = t.rate == null ? (t.rateErr ? '조회 불가' : '미설정') : won(t.rate) + '원';
    const chips = Object.keys(v.byPjt).map((pn) => '<span class="jh-pjt__chip" data-tone="gray">' + esc(pn) + ' ' + f1(v.byPjt[pn]) + '공수' + (t.rate == null ? '' : ' · ' + won(v.byPjt[pn] * t.rate) + '원') + '</span>').join(' ');
    const rows = v.people.map((x, pi) => '<div class="jh-tm__mem"><div><strong>' + esc(x.m.name) + '</strong>' + (x.isLeader ? ' <span class="jh-pjt__chip" data-tone="blue">팀장</span>' : '') + (x.m.resigned ? ' <span class="jh-pjt__chip" data-tone="gray">퇴사' + (x.m.resignedDate ? ' ' + esc(x.m.resignedDate) : '') + '</span>' : '') + '<div class="jh-field__hint">' + (Object.keys(x.byPjt).map((pn) => esc(pn) + ' ' + f1(x.byPjt[pn])).join(' · ') || '기록 없음') + '</div></div><span class="jh-tm__md">' + f1(x.total) + '</span><button type="button" class="jh-btn" data-variant="secondary" data-tm-sheet="' + ti + '|' + pi + '">📋 공수표</button></div>').join('');
    return '<section class="jh-card"><div class="jh-panel__head"><h3>👑 ' + esc(t.leader.name) + ' 팀</h3><span class="jh-field__hint">팀원 ' + t.members.length + '명 (팀장 포함 ' + v.people.length + '명)</span></div><div class="jh-ro__kpis">' + cell('팀 공수', f1(v.md)) + '<div class="jh-ro__kpi"><span>팀 단가' + (st.admin ? ' <button type="button" class="jh-btn" data-variant="secondary" data-tm-rate="' + ti + '" title="팀 단가 설정">✏️</button>' : '') + '</span><strong>' + rate + '</strong></div>' + cell('노무비', v.amount == null ? '—' : won(v.amount) + '원', 'jh-tm__money') + '</div>' + (chips ? '<div class="jh-ro__pad">' + chips + '</div>' : '') + rows + '</section>';
  }).join('') : '<div class="jh-empty">표시할 팀이 없습니다.</div>';
  return wrap(tool + sum + warn + teams) + (st.sheet ? sheetHtml(st) : '');
}
