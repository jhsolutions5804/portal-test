/* 홈 전자결재 카드의 "업무일지" 구역 — 오늘 작성 여부 + 최근 5건. 화면·네트워크 없이 시험한다 */
import { summaryOf } from './logic.js?v=20261008b';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
/** 한국 날짜(YYYY-MM-DD) — 기기 시간대와 상관없이 한국 시각 기준 */
export const kstKey = (ms) => new Date((typeof ms === 'number' ? ms : Date.now()) + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const dayOfWeek = (key) => { const p = String(key || '').split('-').map(Number); return p.length === 3 && p.every((x) => isFinite(x)) ? new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() : 0; };
export const isWeekendKey = (key) => { const w = dayOfWeek(key); return w === 0 || w === 6; };
export const dateLabel = (key) => (/^\d{4}-\d{2}-\d{2}/.test(String(key || '')) ? String(key).slice(5, 10).replace('-', '/') + '(' + WD[dayOfWeek(String(key).slice(0, 10))] + ')' : '');
const dkey = (d) => String(d.date || '').slice(0, 10);
/** 내가 쓴 업무일지(공사일보 연동으로 올라온 것 포함). 남이 쓴 것·참조로 받은 것은 제외 */
export const dailyOf = (docs, me) => (docs || []).filter((d) => d && d.dtype === 'daily' && me && d.authorUid === me.uid);
/** 오늘 날짜의 내 업무일지(여럿이면 가장 나중에 만든 것) */
export const dailyToday = (docs, me, key) => dailyOf(docs, me).filter((d) => dkey(d) === key).sort((a, b) => (b._ms || 0) - (a._ms || 0))[0] || null;
/** 최근 n건: 날짜 내림차순, 같은 날이면 나중에 만든 순 */
export const recentDaily = (docs, me, n) => dailyOf(docs, me).slice().sort((a, b) => dkey(b).localeCompare(dkey(a)) || (b._ms || 0) - (a._ms || 0)).slice(0, n || 5);
/** 오늘 상태 안내: { label, tone(ok|warn|none), doc, action(new|open) } */
/** off = 쉬는 날(토·일·공휴일) 여부. 주면 그대로 쓰고, 안 주면 토·일만 쉬는 날로 본다 */
export function dailyState(docs, me, key, off) {
  const t = dailyToday(docs, me, key); const rest = typeof off === 'boolean' ? off : isWeekendKey(key);
  if (!t) return { label: rest ? '오늘은 쉬는 날 — 작성 전' : '오늘 업무일지 작성 전', tone: rest ? 'none' : 'warn', doc: null, action: 'new' };
  if (t.status === 'draft') return { label: '오늘 업무일지 임시저장 — 상신 전', tone: 'warn', doc: t, action: 'open' };
  if (t.status === 'rejected') return { label: '오늘 업무일지 반려 — 수정 필요', tone: 'warn', doc: t, action: 'open' };
  return { label: '오늘 업무일지 작성 완료', tone: 'ok', doc: t, action: 'open' };
}
export const rowSummary = (d) => summaryOf(d) || String(d.todayWork || '').replace(/\s+/g, ' ').trim().slice(0, 30);
