/* 연차 부여·사용·잔여 계산(회계연도 기준) — 전자결재 홈과 인사(근로자 명부·연차 현황)가 같은 계산을 쓰도록 공용으로 둔다.
 * 기준: 입사 첫 1년 = 1개월 개근당 1일(최대 11일), 입사 다음 해 1/1 = 첫해 재직일수 비례(15일×재직일수/365, 올림), 이후 매년 1/1 = 15일 + 3년 이상 2년마다 +1일(최대 25일). 구포털 인사 화면과 같은 규칙을 그대로 옮겼다. */
export function jhLvDate(s) { if (!s) return null; const d = new Date(String(s).slice(0,10) + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
export function jhLvAddMonths(d, n) { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)); }
export function jhLvDiffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
export function jhLeaveIsAnnual(type) { const t = String(type || '').trim(); return !t || t.startsWith('연차') || t.startsWith('반차'); }
export function jhLeaveFyGrant(hire, Y) {
  if (hire.getFullYear() === Y - 1) {
    const days = jhLvDiffDays(hire, new Date(Y - 1, 11, 31)) + 1;
    return { granted: Math.min(15, Math.ceil(15 * days / 365)), basis: `입사 첫해 비례 (${days}일/365일)` };
  }
  const jan1 = new Date(Y, 0, 1);
  let years = Y - hire.getFullYear();
  while (years > 0 && jhLvAddMonths(hire, 12 * years) > jan1) years--;
  const g = years >= 3 ? Math.min(15 + Math.floor((years - 1) / 2), 25) : 15;
  return { granted: g, basis: `근속 ${years}년 (1.1 기준)` };
}
// 기준일(asOf)에 유효한 연차 구간: y0(입사 첫 1년 월 개근분, 입사일 기준) · y1(해당 회계연도 연차)
export function jhLeaveTracks(hireDateStr, asOf) {
  const hire = jhLvDate(hireDateStr); if (!hire) return [];
  const base = asOf ? new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()) : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  if (base < hire) return [];
  const Y = base.getFullYear(), out = [], ann1 = jhLvAddMonths(hire, 12);
  if (base < ann1) {
    const months = Math.max((base.getFullYear() - hire.getFullYear()) * 12 + (base.getMonth() - hire.getMonth()) - (base.getDate() < hire.getDate() ? 1 : 0), 0);
    out.push({ cat:'y0', title:'입사 첫 1년 (월 개근분)', start:hire, end:new Date(ann1.getFullYear(), ann1.getMonth(), ann1.getDate() - 1), granted:Math.min(months, 11), months, basis:`입사 ${months}개월 · 1개월 개근당 1일` });
  }
  if (hire.getFullYear() < Y) {
    const g = jhLeaveFyGrant(hire, Y);
    out.push({ cat:'y1', title:`${Y}년 회계연도`, start:new Date(Y,0,1), end:new Date(Y,11,31), granted:g.granted, basis:g.basis });
  }
  return out;
}
// 근로자 1인의 연차 문서 → 구간별 사용일수 배분. asOf 이후 시작분은 '예정'
export function jhLeaveAllocate(tracks, docs, asOf) {
  const list = [];
  for (const lv of (docs || [])) {
    if (lv.status !== 'posted' && lv.status !== 'approved') continue;
    if (!jhLeaveIsAnnual(lv.leaveType)) continue;
    const sd = jhLvDate(lv.startDate || lv.sdate); if (!sd) continue;
    let d = parseFloat(lv.days || lv.leaveDays || 0); if (isNaN(d) || d <= 0) d = String(lv.leaveType || '').startsWith('반차') ? 0.5 : 1;
    list.push({ sd, d });
  }
  list.sort((a, b) => a.sd - b.sd);
  const y0 = tracks.find(t => t.cat === 'y0'), y1 = tracks.find(t => t.cat === 'y1');
  const res = { y0:{ used:0, planned:0 }, y1:{ used:0, planned:0 } };
  let y0Taken = 0;
  for (const it of list) {
    let d = it.d; const key = it.sd > asOf ? 'planned' : 'used';
    if (y0 && it.sd >= y0.start && it.sd <= y0.end) {
      const take = Math.min(d, Math.max(11 - y0Taken, 0)); // 월 개근분은 발생 전에 미리 쓴 경우도 이 구간 사용으로 본다(최대 11일)
      if (take > 0) { res.y0[key] += take; y0Taken += take; d -= take; }
    }
    if (d > 0 && y1 && it.sd >= y1.start && it.sd <= y1.end) res.y1[key] += d;
  }
  return res;
}
// 연차 부여·사용·잔여 (docs = 해당 근로자의 연차신청서 목록)
export function calcLeaveBalance(hireDateStr, docs, baseDateStr) {
  const hire = jhLvDate(hireDateStr);
  if (!hire) return { granted:0, used:0, usedPast:0, planned:0, remain:0, years:0, months:0, detail:'입사일 미등록', tracks:[] };
  const asOf = baseDateStr ? (jhLvDate(baseDateStr) || new Date()) : new Date();
  const base = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const tracks = jhLeaveTracks(hireDateStr, base);
  if (!tracks.length) return { granted:0, used:0, usedPast:0, planned:0, remain:0, years:0, months:0, detail:'-', tracks:[] };
  const alloc = jhLeaveAllocate(tracks, docs, base);
  let granted = 0, usedPast = 0, planned = 0;
  for (const t of tracks) { granted += t.granted; usedPast += alloc[t.cat].used; planned += alloc[t.cat].planned; }
  const used = usedPast + planned;
  let years = base.getFullYear() - hire.getFullYear();
  if (base.getMonth() < hire.getMonth() || (base.getMonth() === hire.getMonth() && base.getDate() < hire.getDate())) years--;
  const y0 = tracks.find(t => t.cat === 'y0'), y1 = tracks.find(t => t.cat === 'y1');
  const detail = (y0 && y1) ? `${y1.title} ${y1.granted}일 (${y1.basis}) + 입사 첫 1년 월 개근분 ${y0.granted}일`
    : y1 ? `${y1.title} · ${y1.basis}` : `입사 ${y0.months}개월 (월 1일, 최대 11일)`;
  return { granted, used, usedPast, planned, remain:Math.max(granted - used, 0), years:Math.max(years, 0), months:y0 ? y0.months : Math.max((base.getFullYear() - hire.getFullYear()) * 12 + (base.getMonth() - hire.getMonth()), 0), detail, tracks, alloc };
}
