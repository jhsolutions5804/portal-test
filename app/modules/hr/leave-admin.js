/* 연차 관리자 등록·수정·삭제 — 구포털(hr) openLeaveAdminForm·saveLeaveAdmin·deleteLeaveAdmin·editLeaveEntry·saveLeaveEntryEdit 규칙을 옮겼다(순수 함수).
 * 데이터: edoc_leave 문서(관리자가 만든 것은 dtype:'leave', status:'posted', adminCreated:true). 근로자는 이름(authorName)으로 연결된다(전자결재 연차와 같은 방식). */
export const ADMIN_LEAVE_TYPES = ['연차', '반차(오전)', '반차(오후)', '특별휴가', '병가'];
export const ENTRY_LEAVE_TYPES = ['연차(유급)', '반차(유급)', '경조사(유급)', '병가(무급)', '기타(무급)'];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/** 휴가 종류를 바꾸면 일수 기본값: 반차 0.5, 그 외 1 */
export const defaultDays = (type) => (String(type || '').includes('반차') ? 0.5 : 1);
export const adminLeaveNew = (preset) => { const p = preset || {}; return { id: '', workerName: p.workerName || '', leaveType: '연차', startDate: p.date || '', endDate: p.date || '', days: 1, note: '' }; };
/** 저장된 연차 문서 → 관리자 양식(수정) */
export const adminLeaveFromDoc = (d) => ({ id: d.id, workerName: d.authorName || d.name || '', leaveType: d.leaveType || '연차', startDate: d.startDate || d.sdate || '', endDate: d.endDate || d.edate || '', days: Number(d.days || d.leaveDays || 1) || 1, note: d.note || '' });
/** 관리자 등록·수정 저장 내용. 날짜 순서·일수를 검사한다(구포털은 종료일이 앞서는 것을 막지 않았으나 계산이 틀어져 거부) */
export function buildAdminLeave(f, createdAtField) {
  const x = f || {}; const errors = []; const days = parseFloat(x.days);
  if (!x.workerName) errors.push('근로자를 선택해 주세요.'); if (!isDate(x.startDate) || !isDate(x.endDate)) errors.push('시작일·종료일을 입력해 주세요.'); else if (x.endDate < x.startDate) errors.push('종료일이 시작일보다 빠를 수 없습니다.');
  if (!(days > 0)) errors.push('일수를 입력해 주세요(0.5 이상).'); else if (days > 366) errors.push('일수가 너무 큽니다.');
  if (errors.length) return { ok: false, errors };
  const data = { dtype: 'leave', status: 'posted', authorName: x.workerName, leaveType: x.leaveType, startDate: x.startDate, endDate: x.endDate, days, note: String(x.note || ''), adminCreated: true, title: x.startDate.replace(/-/g, '') + ' ' + x.workerName + ' ' + x.leaveType + ' 신청서' };
  if (createdAtField !== undefined) data.createdAt = createdAtField; return { ok: true, errors: [], data };
}
/** 평일(월~금) 수 — 공휴일은 세지 않는다(구포털 연차 내역 수정과 같은 계산). 반차는 0.5 */
export function weekdayDays(start, end, type) { if (type && String(type).includes('반차')) return 0.5; if (!isDate(start) || !isDate(end)) return 0; let n = 0; for (let c = new Date(start + 'T00:00:00Z'); c <= new Date(end + 'T00:00:00Z'); c.setUTCDate(c.getUTCDate() + 1)) { const dow = c.getUTCDay(); if (dow !== 0 && dow !== 6) n++; } return n; }
export const entryEditFromDoc = (d) => ({ id: d.id, leaveType: d.leaveType || ENTRY_LEAVE_TYPES[0], startDate: d.startDate || d.sdate || '', endDate: d.endDate || d.edate || '', reason: d.reason || '', adminCreated: !!d.adminCreated });
/** 기존 연차 내역 수정(결재라인·게시 상태는 건드리지 않고 종류·기간·일수·사유만): 종류·기간으로 일수를 다시 계산 */
export function buildEntryEdit(f) {
  const x = f || {}; if (!isDate(x.startDate) || !isDate(x.endDate)) return { ok: false, errors: ['시작일/종료일을 입력해주세요.'] }; if (x.endDate < x.startDate) return { ok: false, errors: ['종료일이 시작일보다 빠를 수 없습니다.'] };
  return { ok: true, errors: [], data: { leaveType: x.leaveType, startDate: x.startDate, endDate: x.endDate, days: weekdayDays(x.startDate, x.endDate, x.leaveType), reason: String(x.reason || '').trim() } };
}
