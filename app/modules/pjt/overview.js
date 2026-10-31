/* PJT 전체 홈·종료 PJT — 순수 규칙(화면·네트워크 없이 시험 가능). 모든 프로젝트 같은 규칙.
 * 전체 홈 = 내가 열 수 있는 프로젝트 카드(공정율·D+·누적 공수·오늘 출역) + 프로젝트 통합 일정(2주 / 월간, 프로젝트별 색) + 신규 프로젝트.
 * 종료 PJT = 종료된 프로젝트 목록(재개·완전삭제는 관리자). 프로젝트 문서는 pjt_registry/<id> 하나씩이다(설계서 ⑬). */
import { weekDays, addDays, itemsForKey } from './schedule.js?v=20261031d';
import { dday } from './home.js?v=20261031d';
import { buildData } from './settings.js?v=20261031d';
import { isDateKey } from './adapter.js?v=20261031d';
export const PALETTE = ['#1D5BA6', '#2e7d32', '#e67e22', '#5e35b1', '#00695C', '#c0392b', '#8D6E00', '#d81b60'];   // 프로젝트별 색(등록 순서대로, 8개를 돌려 쓴다)
export const colorOf = (keys, key) => PALETTE[Math.max(0, (keys || []).indexOf(key)) % PALETTE.length];
/** 통합 일정(주간) — 이번 주 월요일부터 14일 블록, offset 만큼 블록 단위로 이동 */
export const blockDays = (today, offset) => weekDays(addDays(today, (offset || 0) * 14), 14);
const md = (k) => { const [, m, d] = k.split('-').map(Number); return m + '/' + d; };
export const blockLabel = (days, offset) => md(days[0]) + ' ~ ' + md(days[days.length - 1]) + (offset === 0 ? ' · 이번 주 + 다음 주' : '');
export const monthLabel = (y, m) => y + '년 ' + (m + 1) + '월';
export const shiftMonth = (y, m, delta) => { const t = y * 12 + m + delta; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; };
/** 여러 프로젝트의 일정 문서(각각 pjtKey·pjtName 을 붙인 것) → 날짜별 목록(시간순). 여러 날 일정은 걸친 모든 날에 나온다 */
export function groupByDay(items, days) {
  const out = {}; days.forEach((k) => { out[k] = itemsForKey(items, k).slice().sort((a, b) => String(a.stime || '').localeCompare(String(b.stime || ''))); }); return out;
}
/** 범례: 보이는 기간에 일정이 있는 프로젝트만(등록 순) */
export function legendOf(map, projects) { const seen = new Set(); Object.keys(map || {}).forEach((k) => (map[k] || []).forEach((x) => seen.add(x.pjtKey))); return (projects || []).filter((p) => seen.has(p.key)); }
/** 공수 문서들 [{ 직원id: 공수 }…] 의 총합(숫자가 아닌 칸은 무시) */
export function totalManday(mdMaps) { let t = 0; (mdMaps || []).forEach((m) => Object.keys(m || {}).forEach((id) => { const v = parseFloat(m[id]); if (isFinite(v)) t += v; })); return Math.round(t * 10) / 10; }
export const fmtDplus = (dd) => (dd == null ? '미설정' : dd >= 0 ? 'D+' + dd : 'D' + dd);
/** 프로젝트 카드 한 장의 표시값. stats 는 늦게 도착하므로 없으면 null 로 두어 화면이 "—"를 보인다 */
export function cardOf(project, stats, today) {
  const d = (project && project.doc) || {}; const dd = dday(d.startDate, today);
  return { key: project.key, name: project.label || d.name || 'PJT', info: [d.client, d.site].filter(Boolean), content: d.content || '', dplus: fmtDplus(dd), pct: stats && typeof stats.pct === 'number' ? stats.pct : null, total: stats && typeof stats.total === 'number' ? stats.total : null, headcount: stats && typeof stats.headcount === 'number' ? stats.headcount : null };
}
/** 종료 PJT 목록: 종료일 최근 순 */
export const endedSorted = (docs) => (docs || []).slice().sort((a, b) => (((b.endedAt && b.endedAt.seconds) || 0) - ((a.endedAt && a.endedAt.seconds) || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
/** 완전삭제 확인: 프로젝트 이름을 그대로 다시 입력해야 한다(모든 프로젝트 같은 규칙) */
export const deleteConfirmed = (name, typed) => { const n = String(name || '').trim(); return !!n && String(typed || '').trim() === n; };
/** 신규 프로젝트 → 저장할 문서(생성 시각은 저장할 때 서버 시각으로). 입력 검증은 설정 탭과 같다 */
export function newProjectData(form) { const r = buildData(form); if (r.error) return { error: r.error }; return { data: Object.assign({}, r.data, { status: 'active', progress: 0 }) }; }
/** PJT 전체 홈에서 일정 항목을 눌렀을 때 가는 주소: 그 프로젝트의 일정 탭 — 홈에서 날짜를 골라 둔 상태면 그 날짜로 연다(2026-10-26 대표님: 8/3 일정을 눌렀는데 오늘 달이 열리던 문제) */
export const schedHash = (key, sel) => '#/pjt/' + encodeURIComponent(String(key == null ? '' : key)) + '/schedule' + (isDateKey(sel) ? '/' + sel : '');
