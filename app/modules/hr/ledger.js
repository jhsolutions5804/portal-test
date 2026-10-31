/* 임금대장 — 급여명세서(payslips/{근로자}/months/{YYYY-MM})를 법정 임금대장(근로기준법 제48조·시행령 제27조) 행으로 정리하고, 마감 점검·표·CSV·인쇄용 HTML·마감 문서를 만든다.
 * 순수 함수만 둔다(화면·네트워크 없음). 시험: tests/hr-ledger.test.mjs. 설계: app-docs/payroll-ledger-design.md (서버 저장소, 비공개).
 * 근로시간은 급여명세서에 이미 저장된 값(attHours·leaveHours·nightHours·otHours·holidayHours)을 그대로 쓴다 — 실제 지급 기준과 같은 값. 없는 것은 근로일수뿐(workDays, 없으면 출퇴근 기록에서 센 값을 받는다). */
import { csvText } from '../../shared/csv.js?v=20261031f';

const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(N(v) * 100) / 100;
/** 검산 허용 오차(원) — 급여명세서 엑셀 파서와 같은 ±10원 */
export const LEDGER_TOL = 10;
export const LEDGER_PAY = [['basic', '기본급'], ['fixedOt', '연장수당'], ['fixedNight', '야간수당'], ['weekly', '주휴수당'], ['holidayPay', '휴일수당'], ['bonus', '상여'], ['specialBonus', '특별상여'], ['extraPay', '기타수당'], ['techAllowance', '기술수당'], ['travelAllowance', '여비교통비']];
export const LEDGER_DEDUCT = [['pension', '국민연금'], ['health', '건강보험'], ['ltcare', '장기요양'], ['employ', '고용보험'], ['dormitory', '기숙사비'], ['incomeTax', '소득세'], ['localTax', '지방소득세']];
/** 급여명세서의 지급합(grossPay)을 이루는 항목 — 여비교통비(비과세)는 실지급에만 더해지므로 제외(payslipCalc: totalPay, netPay = totalPay − 공제 + 여비) */
const GROSS_KEYS = ['basic', 'fixedOt', 'fixedNight', 'weekly', 'holidayPay', 'bonus', 'specialBonus', 'extraPay', 'techAllowance'];
export const isYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const monthStart = (ym) => ym + '-01';
const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return ym + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0'); };

/** 그 달에 급여를 받았어야 하는 직원인가 — 입사일이 그 달 말일 뒤이거나 퇴사일이 그 달 1일 앞이면 아니다. 날짜가 없으면 포함, 퇴사 상태인데 퇴사일이 없으면 판단할 수 없어 제외 */
export function expectedForMonth(worker, ym) {
  const w = worker || {}; if (!isYm(ym)) return false;
  if (isDate(w.hireDate) && w.hireDate > monthEnd(ym)) return false;
  if (isDate(w.resignDate)) return w.resignDate >= monthStart(ym);
  return w.status !== 'resigned';
}

/** 급여명세서 문서 한 건 → 임금대장 한 줄. workDaysFallback: 명세서에 workDays 가 없을 때 출퇴근 기록에서 센 출근일(없으면 null = 자료 없음) */
export function ledgerRow(slip, worker, workDaysFallback) {
  const s = slip || {}, w = worker || {};
  const pay = {}; LEDGER_PAY.forEach(([k]) => { pay[k] = N(s[k]); });
  const ded = {}; LEDGER_DEDUCT.forEach(([k]) => { ded[k] = N(s[k]); });
  const hasSlipDays = s.workDays !== undefined && s.workDays !== null && s.workDays !== '';
  const fb = workDaysFallback === undefined || workDaysFallback === null ? null : N(workDaysFallback);
  return {
    workerId: s.workerId || w.id || '', month: s.month || '', name: s.name || w.name || '', empNo: s.empNo || w.empNo || '', dept: s.dept || w.dept || '', rank: s.rank || w.rank || '',
    hireDate: w.hireDate || '', job: w.job || '',
    workDays: hasSlipDays ? N(s.workDays) : fb, workDaysFrom: hasSlipDays ? 'slip' : (fb === null ? '' : 'attendance'),
    workHours: r2(N(s.attHours) + N(s.holidayHours)), holidayHours: r2(s.holidayHours), leaveHours: r2(s.leaveHours), otHours: r2(s.otHours), nightHours: r2(s.nightHours),
    pay, grossPay: N(s.grossPay), ded, totalDeduct: N(s.totalDeduct), netPay: N(s.netPay)
  };
}

/** 마감 전 점검. slips: { 근로자id: 급여명세서 문서 } — blockers 가 하나라도 있으면 마감할 수 없다, warnings 는 확인하고 진행할 수 있다 */
export function closeChecks(ym, workers, slips, rows) {
  const blockers = [], warnings = []; const S = slips || {};
  if (!isYm(ym)) { blockers.push({ code: 'ym', msg: '귀속월이 올바르지 않습니다.' }); return { ok: false, blockers, warnings }; }
  const ids = Object.keys(S);
  if (!ids.length) blockers.push({ code: 'no-slips', msg: ym + ' 급여명세서가 한 건도 없습니다.' });
  ids.forEach((id) => {
    const s = S[id] || {}; const nm = s.name || id;
    if (s.month && s.month !== ym) blockers.push({ code: 'month', workerId: id, msg: nm + ': 급여명세서 귀속월(' + s.month + ')이 ' + ym + ' 이 아닙니다.' });
    const gross = GROSS_KEYS.reduce((t, k) => t + N(s[k]), 0), ded = LEDGER_DEDUCT.reduce((t, [k]) => t + N(s[k]), 0);
    if (Math.abs(gross - N(s.grossPay)) > LEDGER_TOL) blockers.push({ code: 'sum-gross', workerId: id, msg: nm + ': 지급 항목 합(' + gross + ')과 지급합계(' + N(s.grossPay) + ')가 다릅니다.' });
    if (Math.abs(ded - N(s.totalDeduct)) > LEDGER_TOL) blockers.push({ code: 'sum-deduct', workerId: id, msg: nm + ': 공제 항목 합(' + ded + ')과 공제합계(' + N(s.totalDeduct) + ')가 다릅니다.' });
    const net = N(s.grossPay) - N(s.totalDeduct) + N(s.travelAllowance);
    if (Math.abs(net - N(s.netPay)) > LEDGER_TOL) blockers.push({ code: 'net', workerId: id, msg: nm + ': 지급합계 − 공제합계 + 여비교통비(' + net + ')와 실지급액(' + N(s.netPay) + ')이 다릅니다.' });
  });
  (workers || []).forEach((w) => { if (w && w.id && expectedForMonth(w, ym) && !S[w.id]) warnings.push({ code: 'missing-slip', workerId: w.id, msg: (w.name || w.id) + ': ' + ym + ' 급여명세서가 없습니다(그 달 급여가 없으면 무시해도 됩니다).' }); });
  (rows || []).forEach((r) => {
    if (r.workDays === null) warnings.push({ code: 'no-workdays', workerId: r.workerId, msg: r.name + ': 근로일수 자료가 없습니다(출퇴근 기록 없음).' });
    if (r.grossPay > 0 && r.workHours === 0 && r.leaveHours === 0) warnings.push({ code: 'no-hours', workerId: r.workerId, msg: r.name + ': 지급은 있는데 근로시간이 0입니다.' });
  });
  return { ok: blockers.length === 0, blockers, warnings };
}

export function ledgerTotals(rows) {
  const t = { count: 0, workDays: 0, workHours: 0, holidayHours: 0, leaveHours: 0, otHours: 0, nightHours: 0, pay: {}, grossPay: 0, ded: {}, totalDeduct: 0, netPay: 0 };
  LEDGER_PAY.forEach(([k]) => { t.pay[k] = 0; }); LEDGER_DEDUCT.forEach(([k]) => { t.ded[k] = 0; });
  (rows || []).forEach((r) => { t.count++; t.workDays += N(r.workDays); ['workHours', 'holidayHours', 'leaveHours', 'otHours', 'nightHours'].forEach((k) => { t[k] = r2(t[k] + N(r[k])); }); LEDGER_PAY.forEach(([k]) => { t.pay[k] += N(r.pay && r.pay[k]); }); LEDGER_DEDUCT.forEach(([k]) => { t.ded[k] += N(r.ded && r.ded[k]); }); t.grossPay += N(r.grossPay); t.totalDeduct += N(r.totalDeduct); t.netPay += N(r.netPay); });
  return t;
}

export const LEDGER_HEAD = ['성명', '사번', '부서', '직위', '고용일', '종사업무', '근로일수', '근로시간(실근로)', '휴일근로', '휴가 환산', '연장', '야간'].concat(LEDGER_PAY.map((x) => x[1]), ['지급합계'], LEDGER_DEDUCT.map((x) => x[1]), ['공제합계', '실지급액']);
const rowCells = (r) => [r.name, r.empNo, r.dept, r.rank, r.hireDate, r.job, r.workDays === null ? '' : r.workDays, r.workHours, r.holidayHours, r.leaveHours, r.otHours, r.nightHours].concat(LEDGER_PAY.map(([k]) => r.pay[k]), [r.grossPay], LEDGER_DEDUCT.map(([k]) => r.ded[k]), [r.totalDeduct, r.netPay]);
const totalCells = (t) => ['합계(' + t.count + '명)', '', '', '', '', '', t.workDays, t.workHours, t.holidayHours, t.leaveHours, t.otHours, t.nightHours].concat(LEDGER_PAY.map(([k]) => t.pay[k]), [t.grossPay], LEDGER_DEDUCT.map(([k]) => t.ded[k]), [t.totalDeduct, t.netPay]);

/** 엑셀로 여는 파일(CSV) — 제목 줄, 빈 줄, 머리글, 직원 줄, 합계 줄. 모든 글자는 공용 csvText 가 수식 주입을 막는다 */
export function ledgerCsv(rows, ym, company) {
  const t = ledgerTotals(rows);
  return csvText([[(company || 'JH솔루션') + ' 임금대장 — ' + ym + ' (근로기준법 제48조)'], [], LEDGER_HEAD].concat((rows || []).map(rowCells), [totalCells(t)]));
}

const esc = (v) => String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const won = (v) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : esc(v));
/** 인쇄(PDF 저장)용 A4 가로 문서 — 한 줄에 많은 칸이 있어 글자를 작게 한다 */
export function ledgerHtml(rows, ym, company) {
  const t = ledgerTotals(rows);
  const th = LEDGER_HEAD.map((h) => '<th>' + esc(h) + '</th>').join('');
  const tr = (cells, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map((c) => '<td' + (typeof c === 'number' ? ' class="n"' : '') + '>' + won(c) + '</td>').join('') + '</tr>';
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>임금대장 ' + esc(ym) + '</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:7pt;color:#111}h1{font-size:12pt;margin:0 0 2mm}p{margin:0 0 3mm;color:#555}table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:1px 2px;white-space:nowrap}th{background:#eee}td.n{text-align:right}tr.sum td{font-weight:700;background:#f5f5f5}</style></head><body><h1>'
    + esc(company || 'JH솔루션') + ' 임금대장 — ' + esc(ym) + '</h1><p>근로기준법 제48조·시행령 제27조 기재사항. 근로시간은 지급 때 기준으로 저장된 급여명세서 값입니다. 보존기간 3년.</p><table><thead><tr>' + th + '</tr></thead><tbody>'
    + (rows || []).map((r) => tr(rowCells(r))).join('') + tr(totalCells(t), 'sum') + '</tbody></table></body></html>';
}

export const isClosed = (doc) => !!doc && doc.status === 'closed';
/** 마감 문서(payroll_close/{ym}) — 직원별 스냅샷은 versions/{n} 문서(versionDoc)에 따로 둔다 */
export function closeDoc(ym, rows, checks, by, now, version, prev) {
  const t = ledgerTotals(rows); const p = prev || {};
  return { ym, status: 'closed', version: N(version) || 1, closedAt: now, closedBy: by || '', rowCount: t.count, totals: { grossPay: t.grossPay, totalDeduct: t.totalDeduct, netPay: t.netPay }, warningCount: ((checks && checks.warnings) || []).length, unlockLog: Array.isArray(p.unlockLog) ? p.unlockLog.slice() : [] };
}
export const versionDoc = (ym, rows, version, by, now) => ({ ym, version: N(version) || 1, at: now, by: by || '', rows: (rows || []).map((r) => JSON.parse(JSON.stringify(r))) });
/** 마감 해제 — 사유 필수, 이력(unlockLog)에 한 줄 추가. 그 밖의 칸은 건드리지 않는다 */
export function unlockPatch(doc, by, reason, now) {
  if (!isClosed(doc)) return { ok: false, error: '마감된 달이 아닙니다.' };
  const why = String(reason || '').trim(); if (!why) return { ok: false, error: '해제 사유를 적어 주세요.' };
  return { ok: true, patch: { status: 'open', unlockLog: (Array.isArray(doc.unlockLog) ? doc.unlockLog : []).concat([{ at: now, by: by || '', reason: why }]) } };
}
/** 마감 해제 권한(화면용 — 실제 강제는 보안 규칙): 관리자 + 인사 일정 담당자 목록(hr_calendar_access/config.emails) */
export const canUnlock = (isAdmin, email, hrEmails) => !!isAdmin || (!!email && Array.isArray(hrEmails) && hrEmails.map((x) => String(x).toLowerCase()).includes(String(email).toLowerCase()));
/** 화면·파일이 같은 열 구성을 쓰도록 내보낸다 */
export const ledgerRowCells = rowCells;
export const ledgerTotalCells = totalCells;
