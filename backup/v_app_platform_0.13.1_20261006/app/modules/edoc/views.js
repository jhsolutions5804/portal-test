import { esc, escMultiline, money } from '../../core/ui.js?v=20261005g';
import {
  TYPE_LABEL, TYPE_GROUPS, STATUS_LABEL, STATUS_GROUPS, tabDefs, tabCounts, filterDocs, summaryOf,
  myTurn, canProxy, currentStepIndex, stepState, fmtDate, fmtDateTime, fmtYmd, isPassive, tabsOf, docTitle,
  PAGE_SIZES, normalizeSize, paginate, pageNumbers, pageOfIndex, legacyCurrentStep, availableActions
} from './logic.js?v=20261005g';
import { actionbarHtml } from './compose-view.js?v=20261005g';
import { FORMS } from './forms.js?v=20261005g';
import { fmtSize as fmtFileSize } from './attach-logic.js?v=20261005g';

export function badgeHtml(status) {
  return '<span class="jh-badge" data-status="' + esc(status) + '">' + esc(STATUS_LABEL[status] || status || '-') + '</span>';
}
function optionList(groups, current) {
  return groups.map(g => '<option value="' + esc(g.key) + '"' + (g.key === (current || 'all') ? ' selected' : '') + '>' + esc(g.label) + '</option>').join('');
}

export function pagerHtml(p) {
  if (!p.total) return '';
  const info = '<span class="jh-pager__info">총 ' + p.total + '건 · ' + p.from + '–' + p.to + '</span>';
  const size = '<label class="jh-pager__size"><span>페이지당</span><select class="jh-select" data-pagesize aria-label="페이지당 건수">' +
    PAGE_SIZES.map(n => '<option value="' + n + '"' + (n === p.size ? ' selected' : '') + '>' + n + '건</option>').join('') + '</select></label>';
  if (p.pages <= 1) return '<div class="jh-pager">' + info + size + '</div>';
  const btn = (label, to, off) => '<button type="button" class="jh-pager__btn" data-page="' + to + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
  const nums = pageNumbers(p.page, p.pages).map(n => n === '…'
    ? '<span class="jh-pager__gap" aria-hidden="true">…</span>'
    : '<button type="button" class="jh-pager__page" data-page="' + n + '"' + (n === p.page ? ' aria-current="page"' : '') + ' aria-label="' + n + '페이지">' + n + '</button>').join('');
  return '<div class="jh-pager">' + info +
    '<nav class="jh-pager__nav" aria-label="페이지">' + btn('이전', p.page - 1, p.page <= 1) + nums +
      '<span class="jh-pager__status">' + p.page + ' / ' + p.pages + '</span>' + btn('다음', p.page + 1, p.page >= p.pages) + '</nav>' + size + '</div>';
}

/** 문서 목록 한 줄 — 결재함과 전자결재 홈이 함께 쓴다 */
export function docRowHtml(d, me, selectedKey) {
  const key = d.dtype + '/' + d.id;
  const mine = myTurn(d, me) || canProxy(d, me);
  return '<button type="button" class="jh-docrow' + (key === selectedKey ? ' is-selected' : '') + '" data-open="' + esc(key) + '">' +
    '<span class="jh-docrow__main">' +
      '<span class="jh-docrow__title">' + esc(docTitle(d) || '(제목 없음)') + '</span>' +
      '<span class="jh-docrow__summary">' + esc(summaryOf(d)) + '</span>' +
      '<span class="jh-docrow__meta">' + esc(TYPE_LABEL[d.dtype] || d.dtype) + ' · ' + esc(d.authorName || '-') +
        (d.authorDept ? ' · ' + esc(d.authorDept) : '') + ' · ' + fmtDate(d._ms) + '</span>' +
    '</span>' +
    '<span class="jh-docrow__side">' + (mine ? '<span class="jh-chip" data-tone="accent">' + (myTurn(d, me) ? '내 차례' : '대리 가능') + '</span>' : '') + badgeHtml(d.status) + '</span>' +
  '</button>';
}

export function listHtml(ctx) {
  const { docs, me, query, selectedKey } = ctx;
  const tab = query.tab || 'todo';
  const counts = tabCounts(docs, me);
  const tabs = tabDefs(me).map(t =>
    '<button type="button" class="jh-tab' + (t.key === tab ? ' is-active' : '') + '" data-tab="' + t.key + '">' +
    esc(t.label) + '<span class="jh-tab__count">' + counts[t.key] + '</span></button>').join('');
  const all = filterDocs(docs, me, query);
  // 주소로 문서를 바로 열었는데 page 가 없으면, 그 문서가 있는 페이지를 보여준다
  const size = normalizeSize(query.size);
  let want = query.page;
  if (!want && selectedKey) want = pageOfIndex(all.findIndex(d => d.dtype + '/' + d.id === selectedKey), size);
  const pg = paginate(all, want, size);
  const rows = pg.rows;
  const body = rows.length ? rows.map(d => docRowHtml(d, me, selectedKey)).join('') : '<div class="jh-empty">조건에 맞는 문서가 없습니다.</div>';
  return '<div class="jh-edoc-tabs" role="tablist">' + tabs + '</div>' +
    '<div class="jh-filters">' +
      '<button type="button" class="jh-btn" data-variant="ghost" data-home>‹ 전자결재 홈</button>' +
      '<button type="button" class="jh-btn" data-variant="primary" data-new>＋ 새 문서 작성</button>' +
      '<select class="jh-select" data-filter="type" aria-label="문서 종류">' + optionList(TYPE_GROUPS, query.type) + '</select>' +
      '<select class="jh-select" data-filter="status" aria-label="상태">' + optionList(STATUS_GROUPS, query.status) + '</select>' +
      '<input class="jh-input" type="search" data-filter="q" placeholder="제목·작성자 검색" value="' + esc(query.q || '') + '" aria-label="검색">' +
      '<button type="button" class="jh-btn" data-variant="ghost" data-refresh>새로고침</button>' +
    '</div>' +
    '<div class="jh-doclist">' + body + '</div>' + pagerHtml(pg);
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
  const label = { done: '완료', current: '결재 차례', pending: '대기', rejected: '반려', ref: '열람', skipped: '전결 생략' };
  return '<ol class="jh-timeline">' + line.map((s, i) => {
    const st = stepState(d, i);
    const when = s.approvedAt ? fmtDateTime(s.approvedAt) : '';
    return '<li class="jh-step" data-state="' + st + '">' +
      '<span class="jh-step__role">' + esc(s.role || '') + (s.deputy ? '·업무대리' : '') + '</span>' +
      '<span class="jh-step__name">' + esc(s.name || '미지정') + (s.rank ? ' <small>' + esc(s.rank) + '</small>' : '') + '</span>' +
      '<span class="jh-step__state">' + esc(st === 'done' && s.role === '작성' ? '작성' : label[st]) + '</span>' +
      (when ? '<span class="jh-step__time">' + esc(when) + '</span>' : '') +
    '</li>';
  }).join('') + '</ol>';
}

/** 결재 의견: 승인·반려 때 남긴 글을 단계별로 모아 보여 준다(반려 사유는 상단 경고에도 나오므로 여기서는 반려 의견만 표시하지 않고 승인 의견 위주) */
export function commentsHtml(d) {
  const line = Array.isArray(d.approvalLine) ? d.approvalLine : [];
  const rows = line.filter((s) => s.comment && String(s.comment).trim() && s.status === 'approved');
  if (!rows.length) return '';
  return '<section class="jh-detail__comments"><h3 class="jh-detail__h">결재 의견</h3><ul class="jh-comments">' + rows.map((s) =>
    '<li class="jh-comment"><div class="jh-comment__head"><strong>' + esc(s.name || s.approvedBy || '') + '</strong>' + (s.rank ? ' <small>' + esc(s.rank) + '</small>' : '') +
    '<span class="jh-comment__meta">' + esc(s.role || '') + (s.proxyByName ? ' · 대리 ' + esc(s.proxyByName) : '') + (s.approvedAt ? ' · ' + esc(fmtDateTime(s.approvedAt)) : '') + '</span></div>' +
    '<div class="jh-comment__body">' + escMultiline(s.comment) + '</div></li>').join('') + '</ul></section>';
}

/** 상세의 첨부파일 목록(열기는 저장소 권한을 거쳐 새 창으로) */
export function attachmentsHtml(d) {
  const list = Array.isArray(d.attachments) ? d.attachments.filter((a) => a && a.path) : [];
  if (!list.length) return '';
  return '<section class="jh-detail__attach"><h3 class="jh-detail__h">첨부파일 <small>' + list.length + '개</small></h3><ul class="jh-attach">' + list.map((a) =>
    '<li class="jh-attach__item"><span class="jh-attach__name">📎 ' + esc(a.name || '파일') + '</span><span class="jh-attach__size">' + esc(fmtFileSize(a.size)) + '</span><span class="jh-attach__actions"><button type="button" class="jh-btn" data-variant="secondary" data-file="' + esc(a.path) + '">열기</button></span></li>').join('') + '</ul></section>';
}

export function detailHtml(ctx) {
  const { doc: d, me } = ctx;
  if (ctx.loading) return '<div class="jh-empty">불러오는 중…</div>';
  if (!d) return '<div class="jh-empty">왼쪽 목록에서 문서를 선택하세요.</div>';
  const form = FORMS[d.dtype] || { rows: [] };
  const rows = form.rows.map(r => { const v = fmtValue(r, d); return v ? '<div class="jh-kv__row"><dt>' + esc(r.label) + '</dt><dd>' + v + '</dd></div>' : ''; }).join('');
  const notes = [];
  if (myTurn(d, me)) notes.push('<span class="jh-chip" data-tone="accent">내 차례</span>');
  else if (canProxy(d, me)) notes.push('<span class="jh-chip">대리 승인 가능</span>');
  if (legacyCurrentStep(d)) notes.push('<span class="jh-chip" data-tone="warn">계정 정보 없는 구 문서 · 관리자 확인 필요</span>');
  return '<article class="jh-detail">' +
    '<button type="button" class="jh-btn jh-detail__back" data-variant="ghost" data-back>← 목록</button>' +
    '<header class="jh-detail__head">' +
      '<div class="jh-detail__type">' + esc(TYPE_LABEL[d.dtype] || d.dtype) + '</div>' +
      '<h2 class="jh-detail__title">' + esc(docTitle(d) || '(제목 없음)') + '</h2>' +
      '<div class="jh-detail__meta">' + esc(d.authorName || '-') + (d.authorRank ? ' ' + esc(d.authorRank) : '') +
        (d.authorDept ? ' · ' + esc(d.authorDept) : '') + ' · ' + fmtDateTime(d._ms) + '</div>' +
      '<div class="jh-detail__state">' + badgeHtml(d.status) + notes.join('') + '</div>' +
    '</header>' +
    (d.status === 'rejected' && d.rejectReason ? '<div class="jh-alert" data-tone="danger" role="alert"><strong>반려 사유</strong><br>' + escMultiline(d.rejectReason) + '</div>' : '') +
    '<section class="jh-detail__body"><dl class="jh-kv">' + (rows || '<div class="jh-empty">표시할 내용이 없습니다.</div>') + '</dl></section>' +
    attachmentsHtml(d) + '<section class="jh-detail__line"><h3 class="jh-detail__h">결재선</h3>' + timelineHtml(d) + '</section>' + commentsHtml(d) +
    actionbarHtml(availableActions(d, me)) +
  '</article>';
}
