import { esc, escMultiline, money } from '../../core/ui.js';
import {
  TYPE_LABEL, TYPE_GROUPS, STATUS_LABEL, STATUS_GROUPS, tabDefs, tabCounts, filterDocs, summaryOf,
  myTurn, canProxy, currentStepIndex, stepState, fmtDate, fmtDateTime, fmtYmd, isPassive, tabsOf
} from './logic.js';
import { FORMS } from './forms.js';

export function badgeHtml(status) {
  return '<span class="jh-badge" data-status="' + esc(status) + '">' + esc(STATUS_LABEL[status] || status || '-') + '</span>';
}
function optionList(groups, current) {
  return groups.map(g => '<option value="' + esc(g.key) + '"' + (g.key === (current || 'all') ? ' selected' : '') + '>' + esc(g.label) + '</option>').join('');
}

export function listHtml(ctx) {
  const { docs, me, query, selectedKey } = ctx;
  const tab = query.tab || 'todo';
  const counts = tabCounts(docs, me);
  const tabs = tabDefs(me).map(t =>
    '<button type="button" class="jh-tab' + (t.key === tab ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
    esc(t.label) + '<span class="jh-tab__count">' + counts[t.key] + '</span></button>').join('');
  const rows = filterDocs(docs, me, query);
  const body = rows.length ? rows.map(d => {
    const key = d.dtype + '/' + d.id;
    const mine = myTurn(d, me);
    return '<button type="button" class="jh-docrow' + (key === selectedKey ? ' is-selected' : '') + '" data-open="' + esc(key) + '">' +
      '<span class="jh-docrow__main">' +
        '<span class="jh-docrow__title">' + esc(d.title || '(제목 없음)') + '</span>' +
        '<span class="jh-docrow__summary">' + esc(summaryOf(d)) + '</span>' +
        '<span class="jh-docrow__meta">' + esc(TYPE_LABEL[d.dtype] || d.dtype) + ' · ' + esc(d.authorName || '-') +
          (d.authorDept ? ' · ' + esc(d.authorDept) : '') + ' · ' + fmtDate(d._ms) + '</span>' +
      '</span>' +
      '<span class="jh-docrow__side">' + (mine ? '<span class="jh-chip" data-tone="accent">내 차례</span>' : '') + badgeHtml(d.status) + '</span>' +
    '</button>';
  }).join('') : '<div class="jh-empty">조건에 맞는 문서가 없습니다.</div>';
  return '<div class="jh-edoc-tabs" role="tablist">' + tabs + '</div>' +
    '<div class="jh-filters">' +
      '<select class="jh-select" data-filter="type" aria-label="문서 종류">' + optionList(TYPE_GROUPS, query.type) + '</select>' +
      '<select class="jh-select" data-filter="status" aria-label="상태">' + optionList(STATUS_GROUPS, query.status) + '</select>' +
      '<input class="jh-input" type="search" data-filter="q" placeholder="제목·작성자 검색" value="' + esc(query.q || '') + '" aria-label="검색">' +
      '<button type="button" class="jh-btn" data-variant="ghost" data-refresh>새로고침</button>' +
    '</div>' +
    '<div class="jh-doclist">' + body + '</div>';
}

function fmtValue(row, d) {
  const raw = row.get ? row.get(d) : d[row.key];
  if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) return '';
  switch (row.fmt) {
    case 'multiline': return escMultiline(raw);
    case 'date': return esc(fmtYmd(raw));
    case 'dateRange': return esc(String(raw).split(' ~ ').map(fmtYmd).join(' ~ '));
    case 'money': return esc(money(raw));
    case 'days': return esc(raw) + '일';
    case 'list': return (Array.isArray(raw) ? raw : [raw]).map(u => '<span class="jh-kv__item">' + esc(u) + '</span>').join('');
    default: return esc(raw);
  }
}

export function timelineHtml(d) {
  const line = Array.isArray(d.approvalLine) ? d.approvalLine : [];
  if (!line.length) return '<div class="jh-empty">결재선 정보가 없습니다.</div>';
  const label = { done: '완료', current: '결재 차례', pending: '대기', rejected: '반려', ref: '열람' };
  return '<ol class="jh-timeline">' + line.map((s, i) => {
    const st = stepState(d, i);
    const when = s.approvedAt ? fmtDateTime(s.approvedAt) : '';
    return '<li class="jh-step" data-state="' + st + '">' +
      '<span class="jh-step__role">' + esc(s.role || '') + '</span>' +
      '<span class="jh-step__name">' + esc(s.name || '미지정') + (s.rank ? ' <small>' + esc(s.rank) + '</small>' : '') + '</span>' +
      '<span class="jh-step__state">' + esc(st === 'done' && s.role === '작성' ? '작성' : label[st]) + '</span>' +
      (when ? '<span class="jh-step__time">' + esc(when) + '</span>' : '') +
    '</li>';
  }).join('') + '</ol>';
}

export function detailHtml(ctx) {
  const { doc: d, me } = ctx;
  if (ctx.loading) return '<div class="jh-empty">불러오는 중…</div>';
  if (!d) return '<div class="jh-empty">왼쪽 목록에서 문서를 선택하세요.</div>';
  const form = FORMS[d.dtype] || { rows: [] };
  const rows = form.rows.map(r => { const v = fmtValue(r, d); return v ? '<div class="jh-kv__row"><dt>' + esc(r.label) + '</dt><dd>' + v + '</dd></div>' : ''; }).join('');
  const notes = [];
  if (myTurn(d, me)) notes.push('<span class="jh-chip" data-tone="accent">내 차례</span>');
  else if (canProxy(d, me)) notes.push('<span class="jh-chip">관리자 대리 승인 대상</span>');
  return '<article class="jh-detail">' +
    '<button type="button" class="jh-btn jh-detail__back" data-variant="ghost" data-back>← 목록</button>' +
    '<header class="jh-detail__head">' +
      '<div class="jh-detail__type">' + esc(TYPE_LABEL[d.dtype] || d.dtype) + '</div>' +
      '<h2 class="jh-detail__title">' + esc(d.title || '(제목 없음)') + '</h2>' +
      '<div class="jh-detail__meta">' + esc(d.authorName || '-') + (d.authorRank ? ' ' + esc(d.authorRank) : '') +
        (d.authorDept ? ' · ' + esc(d.authorDept) : '') + ' · ' + fmtDateTime(d._ms) + '</div>' +
      '<div class="jh-detail__state">' + badgeHtml(d.status) + notes.join('') + '</div>' +
    '</header>' +
    '<section class="jh-detail__body"><dl class="jh-kv">' + (rows || '<div class="jh-empty">표시할 내용이 없습니다.</div>') + '</dl></section>' +
    '<section class="jh-detail__line"><h3 class="jh-detail__h">결재선</h3>' + timelineHtml(d) + '</section>' +
    '<footer class="jh-detail__foot">1단계(읽기 전용): 승인·반려·작성은 다음 단계에서 열립니다.</footer>' +
  '</article>';
}
