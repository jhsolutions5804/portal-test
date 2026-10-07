/* 폰 하단 막대 구성(순수 함수 — 화면 없이 시험한다).
 * 홈 + 모듈이 manifest.mobileTab({ order, label, icon })로 요청한 칸(order 순, 기본 최대 2칸) + 더보기.
 * 칸을 얻지 못한 보이는 모듈(사이드바에 없는 출퇴근·일정 포함)은 모두 더보기 시트에 들어간다. */
export function phoneTabs(mods, maxTabs) {
  const max = maxTabs == null ? 2 : maxTabs;
  const want = (mods || []).filter((m) => m.mobileTab).sort((a, b) => (a.mobileTab.order || 0) - (b.mobileTab.order || 0));
  const tabs = want.slice(0, max); const more = (mods || []).filter((m) => tabs.indexOf(m) === -1);
  return { tabs, more };
}
