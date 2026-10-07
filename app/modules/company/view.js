import { esc } from '../../core/ui.js?v=20261007g';
import { fmtTel, telHref, mailHref } from './logic.js?v=20261007g';
import { renderMarkdown } from '../../shared/markdown.js?v=20261007g';

export const tabsHtml = (cur, isAdmin) => '<div class="jh-segmented jh-company__tabs" role="group" aria-label="회사 정보">' + [['org', '조직도'], ['rules', '규정']].concat(isAdmin ? [['staff', '직원 관리']] : []).map(([k, l]) => '<a class="jh-segmented__item" href="#/company/' + k + '" aria-pressed="' + (k === cur) + '">' + l + '</a>').join('') + '</div>';
export function orgHtml(groups, total, query) {
  const body = groups.length ? groups.map((g) => '<section class="jh-card jh-company__dept"><div class="jh-panel__head"><h3>📂 ' + esc(g.dept) + '</h3><span class="jh-chip">' + g.people.length + '명</span></div><div class="jh-company__people">' +
    g.people.map((u, i) => {
      const t = telHref(u.phone), m = mailHref(u.email);
      return '<div class="jh-company__person"><div class="jh-company__name"><strong>' + esc(u.name || '-') + '</strong> <span class="jh-chip">' + esc(u.rank || '-') + '</span></div><div class="jh-company__meta"><span>' + esc(u.empNo || String(i + 1).padStart(3, '0')) + '</span>' +
        (u.phone ? (t ? '<a class="jh-link" href="' + esc(t) + '">' + esc(fmtTel(u.phone)) + '</a>' : '<span>' + esc(u.phone) + '</span>') : '<span>-</span>') + (u.email ? (m ? '<a class="jh-link" href="' + esc(m) + '">' + esc(u.email) + '</a>' : '<span>' + esc(u.email) + '</span>') : '<span>-</span>') + '</div></div>';
    }).join('') + '</div></section>').join('') : '<div class="jh-empty">' + (query ? '검색 결과가 없습니다.' : '등록된 직원이 없습니다.') + '</div>';
  return '<div class="jh-company__bar"><label class="jh-field jh-company__search"><span class="jh-field__label">검색</span><input class="jh-input" id="org-q" type="search" placeholder="이름·부서·직급·전화" value="' + esc(query || '') + '"></label><span class="jh-field__hint">승인된 직원 ' + total + '명</span></div><div data-org-list>' + body + '</div>';
}
export function rulesHtml(policies, cur) {
  if (!policies.length) return '<div class="jh-empty">등록된 규정이 없습니다.</div>';
  const p = policies.find((x) => x.id === cur) || policies[0];
  return '<div class="jh-company__ruletabs" role="tablist" aria-label="규정 목록">' + policies.map((x) => '<a class="jh-company__ruletab" role="tab" href="#/company/rules?doc=' + encodeURIComponent(x.id) + '" aria-selected="' + (x.id === p.id) + '">' + esc(x.title || x.id) + '</a>').join('') + '</div>' +
    '<article class="jh-card jh-form jh-md" aria-label="' + esc(p.title || p.id) + '">' + renderMarkdown(p.markdown) + '</article>';
}

/* ── 조직도 다이어그램 ── */
const chip = (u) => '<button type="button" class="jh-org__p" data-uid="' + esc(u.uid || '') + '" title="' + esc((u.name || '') + ' ' + (u.rank || '') + ' — 눌러서 연락처 보기') + '"><strong>' + esc(u.name || '-') + '</strong><span>' + esc(u.rank || '') + '</span></button>';
const box = (title, people, cls) => '<div class="jh-org__node ' + (cls || '') + '"><div class="jh-org__title">' + esc(title) + '</div>' + (people.length ? '<div class="jh-org__people">' + people.map(chip).join('') + '</div>' : '<div class="jh-org__empty">인원 없음</div>') + '</div>';
export function orgChartHtml(tree) {
  if (!tree.total) return '<div class="jh-empty">등록된 직원이 없습니다.</div>';
  const kids = tree.branches.map((b) => '<li>' + box(b.dept, b.people, 'jh-org__node--hq') + '<ul>' + b.teams.map((t) => '<li>' + box(t.dept, t.people, '') + '</li>').join('') + '</ul></li>')
    .concat(tree.extras.map((e) => '<li>' + box(e.dept, e.people, 'jh-org__node--extra') + '</li>'));
  const rootBox = '<div class="jh-org__node jh-org__node--ceo"><div class="jh-org__title">JH솔루션즈</div>' + (tree.top.length ? '<div class="jh-org__people">' + tree.top.map(chip).join('') + '</div>' : '') + '</div>';
  return '<div class="jh-org" role="group" aria-label="조직도 다이어그램"><ul><li>' + rootBox + '<ul>' + kids.join('') + '</ul></li></ul></div><div class="jh-field__hint">직원 ' + tree.total + '명 · 이름을 누르면 연락처가 보입니다.</div>';
}
export function personCardHtml(u) {
  const t = telHref(u.phone), m = mailHref(u.email);
  return '<dl class="jh-profile__dl"><dt>이름</dt><dd>' + esc(u.name || '-') + ' ' + esc(u.rank || '') + '</dd><dt>부서</dt><dd>' + esc(u.dept || '-') + '</dd><dt>사번</dt><dd>' + esc(u.empNo || '-') + '</dd><dt>전화</dt><dd>' + (u.phone ? (t ? '<a class="jh-link" href="' + esc(t) + '">' + esc(fmtTel(u.phone)) + '</a>' : esc(u.phone)) : '-') + '</dd><dt>메일</dt><dd>' + (u.email ? (m ? '<a class="jh-link" href="' + esc(m) + '">' + esc(u.email) + '</a>' : esc(u.email)) : '-') + '</dd></dl>';
}
export const orgViewHtml = (cur) => '<div class="jh-segmented jh-company__views" role="group" aria-label="보기 방식">' + [['chart', '다이어그램'], ['list', '목록']].map(([k, l]) => '<button type="button" class="jh-segmented__item" data-org-view="' + k + '" aria-pressed="' + (k === cur) + '">' + l + '</button>').join('') + '</div>';
