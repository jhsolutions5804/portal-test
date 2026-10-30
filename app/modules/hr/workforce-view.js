/* 인력 현황 위젯 화면 — HTML 만 만드는 순수 함수(시험: tests/hr-workforce-view.test.mjs). 막대는 비율(%)로 그리고 숫자도 함께 적는다. */
import { esc } from '../../core/ui.js?v=20261030a';

const card = (title, body) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3></div>' + body + '</section>';
function bars(title, pairs, unit) {
  const max = Math.max(1, ...pairs.map((p) => p[1]));
  return '<div class="jh-field"><div class="jh-field__label">' + esc(title) + '</div>' + (pairs.length ? pairs.map(([l, n]) => '<div style="display:flex;align-items:center;gap:.5rem;margin:.15rem 0"><span style="min-width:5.2rem;font-size:.85em">' + esc(l) + '</span><div style="flex:1;background:var(--c-line,#e5e7eb);border-radius:3px;height:.6rem" role="img" aria-label="' + esc(l + ' ' + n + unit) + '"><div data-w-bar style="width:' + Math.round((n / max) * 100) + '%;height:100%;background:var(--c-accent,#2563eb);border-radius:3px"></div></div><span style="min-width:2.6rem;text-align:right">' + n + unit + '</span></div>').join('') : '<div class="jh-field__hint">자료 없음</div>') + '</div>';
}
/** 인사 홈 "👥 인력 현황" 카드. s = workforceStats 결과, null 이면 불러오는 중 */
export function workforceHtml(s) {
  if (!s) return '<div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div>';
  if (!s.headcount) return card('👥 인력 현황', '<div class="jh-hr__pad"><div class="jh-empty">재직 중인 직원이 없습니다.</div></div>');
  const head = '<div class="jh-field__hint" style="margin-bottom:.4rem">재직 <b>' + s.headcount + '명</b>' + (s.avgTenure === null ? '' : ' · 평균 근속 <b>' + s.avgTenure + '년</b>') + (s.resignedTotal ? ' · 퇴직 처리된 직원 ' + s.resignedTotal + '명' : '') + '</div>';
  return card('👥 인력 현황', '<div class="jh-hr__pad" data-w-work>' + head + bars('직급', s.ranks, '명') + bars('직원 구분', s.types, '명') + bars('근속(재직자)', s.tenure, '명') + (s.noHireDate ? '<div class="jh-field__hint">입사일이 없는 재직자 ' + s.noHireDate + '명은 근속에서 뺐습니다.</div>' : '') + bars('입사 연도(퇴직자 포함)', s.hires, '명') + bars('퇴직 연도', s.exits, '명') + '<div class="jh-field__hint">명부 기준입니다. 인건비 추이는 재무 장부가 본섭에 들어온 뒤 추가합니다.</div></div>');
}
