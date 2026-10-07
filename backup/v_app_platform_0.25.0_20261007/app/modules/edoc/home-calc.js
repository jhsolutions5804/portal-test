/* 전자결재 홈 계산 — 연차 부여·사용·잔여, 이번 달 근로시간(소정근로시간·유급휴가 반영).
 * 기존 전자결재(edoc/index.html)·인사(hr)와 같은 기준이며 로직은 그대로 옮겼다. 기준이 바뀌면 hr·edoc·m/edoc·이 파일을 함께 고친다.
 * 공휴일은 holidays.js(단일 출처)의 날짜 목록을 받아서 쓴다. */
function jhLvDate(s) { if (!s) return null; const d = new Date(String(s).slice(0,10) + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }
function jhLvAddMonths(d, n) { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)); }
function jhLvDiffDays(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function jhLeaveIsAnnual(type) { const t = String(type || '').trim(); return !t || t.startsWith('연차') || t.startsWith('반차'); }
function jhLeaveFyGrant(hire, Y) {
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
function jhLeaveTracks(hireDateStr, asOf) {
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
function jhLeaveAllocate(tracks, docs, asOf) {
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

const LEAVE_PAID_MAP = {
  '연차': true, '반차-오전': true, '반차-오후': true, '반차': true,
  '생리휴가': false,
  '출산전후휴가': true, '배우자출산휴가': true, '유산·사산휴가': true,
  '육아휴직': false, '가족돌봄휴가': false,
  '병가': false, // 무급 전환(2026-08-30)
  '예비군/민방위': true,
  '경조사': true, // 예전 방식 휴가명 — 유급 처리(재확인 필요)
};
export function isLeavePaid(leaveType) {
  const base = (leaveType || '').replace(/\(.+?\)/g, '').trim();
  if (base in LEAVE_PAID_MAP) return LEAVE_PAID_MAP[base];
  return /\(유급\)/.test(leaveType || '');
}

export function computeLeaveHoursForMonth(leaveDocs, workerName, year, month) {
  const ym = year + '-' + String(month).padStart(2,'0');
  let hours = 0;
  for (const lv of leaveDocs) {
    const nm = lv.authorName || lv.name || '';
    if (nm !== workerName) continue;
    if (lv.status !== 'posted' && lv.status !== 'approved') continue;
    if (!isLeavePaid(lv.leaveType)) continue; // 무급 휴가 제외
    if (!lv.startDate || !lv.endDate) continue;
    const perDay = (/반차/.test(lv.leaveType || '') || lv.days === 0.5 || lv.leaveDays === 0.5) ? 4 : 8;
    const cur = new Date(lv.startDate);
    const end = new Date(lv.endDate);
    while (cur <= end) {
      const key = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0');
      if (key === ym) hours += perDay;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return hours;
}

export const leaveDocsOf = (docs, me) => (docs || []).filter((d) => d.dtype === 'leave' && (d.authorUid === me.uid || (!d.authorUid && (d.authorName || d.name) === me.name)));

/** 연차에서 차감되는 휴가인지(연차·반차, 종류가 비어 있는 옛 문서 포함) */
export function isAnnualType(type) { const t = String(type || '').trim(); return !t || t.startsWith('연차') || t.startsWith('반차'); }

export { monthlyStandardHours, monthlyMaxOvertimeHours, worktimeSummary, findWorker } from '../../shared/worktime.js?v=20261007l';
