import { esc } from '../../core/ui.js?v=20261030a';
import { won, card, chip } from './ui.js?v=20261030a';
import { buildTeams, monthLabel } from './teamlabor.js?v=20261030a';
const sumCell = (label, v) => '<div class="jh-plan__sumcell"><span class="jh-field__hint">' + esc(label) + '</span><strong>' + v + '</strong></div>';
/** 팀별 노무비: 월 이동, 합계 카드, 팀마다 공수·팀 단가·노무비·프로젝트별 공수·구성원 공수 */
export function teamLaborHtml(st) {
  const nav = '<div class="jh-plan__bar"><span class="jh-plan__line"><button type="button" class="jh-btn" data-variant="ghost" data-tl-act="prev" aria-label="이전 달">‹</button><strong class="jh-plan__big">' + esc(monthLabel(st.ym)) + '</strong><button type="button" class="jh-btn" data-variant="ghost" data-tl-act="next" aria-label="다음 달">›</button></span><button type="button" class="jh-btn" data-variant="ghost" data-tl-act="reload">↻ 다시 계산</button></div>';
  const wrap = (inner) => '<div class="jh-plan">' + card('팀별 노무비', '<div class="jh-plan__pad">' + nav + inner + '</div>') + '</div>';
  if (st.err) return wrap('<div class="jh-empty">불러오기 실패: ' + esc(st.err) + '</div>');
  if (!st.data) return wrap('<div class="jh-empty">불러오는 중...</div>');
  const { masters, rate, pmap, failed } = st.data; const T = buildTeams(masters, rate, pmap);
  const warn = (failed.length ? '<div class="jh-alert" data-tone="warn" role="status">⚠️ 일부 데이터를 불러오지 못해 집계에서 빠졌을 수 있습니다: ' + esc(failed.join(', ')) + '</div>' : '')
    + (T.unassigned.length ? '<div class="jh-alert" data-tone="warn" role="status">ℹ️ 팀(마스터 근로자)에 속하지 않은 인원의 공수 ' + T.unMd.toFixed(1) + '공수는 팀별 합계에 포함되지 않았습니다: ' + esc(T.unassigned.map((p) => p.name + (p.birth ? '' : '(생년월일 없음)')).join(', ')) + '. [PJT관리 > 근로자 연명부 > 기존 인원 마이그레이션]에서 등록하면 팀에 포함됩니다.</div>' : '');
  const teams = T.teams.length ? T.teams.map((t) => {
    const chips = Object.keys(t.byPjt).map((pn) => chip(pn + ' ' + t.byPjt[pn].toFixed(1) + '공수 · ' + won(t.byPjt[pn] * t.r) + '원', 'blue')).join(' ');
    const rows = t.people.map((x, i) => '<div class="jh-plan__bar"><span>' + (i === 0 ? '<strong>' : '') + esc(x.m.name) + (i === 0 ? ' (팀장 본인)' : '') + (x.m.resigned ? ' <span class="jh-field__hint">퇴사</span>' : '') + (i === 0 ? '</strong>' : '') + '</span><span>' + x.md.toFixed(1) + '공수</span></div>').join('');
    const editing = st.editing === t.l.id; const rateUi = editing ? '<input class="jh-input jh-plan__num jh-plan__supply" inputmode="numeric" data-tl-rate value="' + esc(t.r) + '"><button type="button" class="jh-btn" data-variant="primary" data-tl-act="rate-save" data-tl-leader="' + esc(t.l.id) + '">저장</button><button type="button" class="jh-btn" data-variant="ghost" data-tl-act="rate-cancel">취소</button>' : '팀단가 ' + won(t.r) + '원 <button type="button" class="jh-btn" data-variant="ghost" data-tl-act="rate-edit" data-tl-leader="' + esc(t.l.id) + '" title="팀 단가 설정" aria-label="팀 단가 설정">✏️</button>';
    return '<div class="jh-plan__party"><div class="jh-plan__bar"><strong>👑 ' + esc(t.l.name) + ' 팀 <span class="jh-field__hint">(' + t.members.length + '명)</span></strong><span class="jh-plan__line">' + t.md.toFixed(1) + '공수 · ' + rateUi + (editing ? '' : ' · <strong>' + won(t.amt) + '원</strong>') + '</span></div>' + (chips ? '<div class="jh-plan__line">' + chips + '</div>' : '') + rows + '</div>'; }).join('') : '<div class="jh-empty">등록된 팀이 없습니다. (PJT관리 > 근로자 연명부에서 팀장을 등록하세요)</div>';
  return wrap('<div class="jh-plan__sum jh-plan__sum--3">' + sumCell('팀 노무비 합계', won(T.grandAmt) + '원') + sumCell('팀 공수 합계', T.grandMd.toFixed(1)) + sumCell('팀 수', T.teams.length) + '</div>' + warn + teams + '<div class="jh-field__hint">팀 노무비 = 팀 공수(팀장+팀원) × 팀 단가. 팀 단가는 관리자만 조회·수정할 수 있는 별도 문서에 저장됩니다. 공수는 PJT관리 근태(FAB·SUP·경량PJT)의 월 합계입니다.</div>');
}
