import { esc } from '../../core/ui.js?v=20261006f';
import { fmtTel, telHref, mailHref } from './logic.js?v=20261006f';
import { renderMarkdown } from '../../shared/markdown.js?v=20261006f';

export const tabsHtml = (cur) => '<div class="jh-segmented jh-company__tabs" role="group" aria-label="회사 정보">' + [['org', '조직도'], ['rules', '규정']].map(([k, l]) => '<a class="jh-segmented__item" href="#/company/' + k + '" aria-pressed="' + (k === cur) + '">' + l + '</a>').join('') + '</div>';
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
