/* 인사 — 근로자 명부(새 화면). 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 데이터: workers/{id}(일반 정보) + worker_private/{id}(주민번호·계좌·주소·서명, 읽을 때 합쳐 쓰고 저장할 때 다시 가른다)
 *         labor_contracts/{id}/contracts · annual_contracts/{id}/contracts(endDate), workers/{id}/history(직급·부서 변경 이력) */
import { calcLeaveBalance, jhLeaveIsAnnual } from '../../shared/leave-calc.js?v=20261012a';
export const WP_FIELDS = ['jumin', 'bankAccount', 'address', 'signData'];   // worker_private 에 따로 두는 필드
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const num = (v) => (v === '' || v == null ? null : Number(v));

/** 저장 문서를 일반 / 개인정보 두 갈래로 가른다 */
export function splitWorker(data) { const pub = {}, priv = {}; Object.keys(data || {}).forEach((k) => { (WP_FIELDS.includes(k) ? priv : pub)[k] = data[k]; }); return { pub, priv }; }

/** 호봉: 저장된 기준(step·stepYear)이 있으면 그 해부터 매년 +1, 없으면 입사일로 추정 — 입사한 해는 1호봉, 다음 해부터 1~3분기 입사 2호봉·4분기 입사 1호봉으로 시작해 매년 1/1 +1 (구포털 hr 2.24.2 규칙 그대로) */
export function stepSeed(hireDate) { if (!isDate(hireDate)) return null; const y = Number(hireDate.slice(0, 4)); const q = Math.ceil(Number(hireDate.slice(5, 7)) / 3); return { baseYear: y + 1, baseStep: q === 4 ? 1 : 2 }; }
export function stepNow(w, year) {
  const cur = year || Number(kstToday().slice(0, 4)); const base = w && w.step != null && w.stepYear != null ? { baseYear: Number(w.stepYear), baseStep: Number(w.step) } : stepSeed(w && w.hireDate);
  if (!base || !Number.isFinite(base.baseYear) || !Number.isFinite(base.baseStep)) return null; if (cur < base.baseYear) return 1; return base.baseStep + (cur - base.baseYear);
}
/** 재직 기간과 실 근무일수(주말·공휴일 제외). isOff(YYYY-MM-DD)는 화면이 공휴일 표를 넣어 준다 */
export function workPeriod(hireDate, endDate, today, isOff) {
  if (!isDate(hireDate)) return null; const end = isDate(endDate) ? endDate : (today || kstToday()); if (end < hireDate) return { calDays: 0, years: 0, months: 0, days: 0 };
  const a = Date.parse(hireDate + 'T00:00:00Z'), b = Date.parse(end + 'T00:00:00Z'); const total = Math.round((b - a) / 86400000);
  let work = 0; for (let t = a; t <= b; t += 86400000) { const key = new Date(t).toISOString().slice(0, 10); const dow = new Date(t).getUTCDay(); if (dow !== 0 && dow !== 6 && !(isOff && isOff(key))) work++; }
  return { calDays: total, years: Math.floor(total / 365), months: Math.floor((total % 365) / 30), days: work };
}
export const maskJumin = (j) => { const s = String(j || '').replace(/[^0-9]/g, ''); if (s.length < 7) return s ? '*'.repeat(s.length) : ''; return s.slice(0, 6) + '-' + s[6] + '******'; };
export const maskAccount = (a) => { const s = String(a || ''); const d = s.replace(/[^0-9]/g, ''); if (d.length < 5) return s ? '****' : ''; return s.slice(0, Math.max(0, s.length - 4)).replace(/[0-9]/g, '*') + s.slice(-4); };
export const birthText = (jumin) => { const b = String(jumin || '').replace(/[^0-9]/g, '').slice(0, 6); return b.length === 6 ? b.slice(0, 2) + '.' + b.slice(2, 4) + '.' + b.slice(4, 6) : '-'; };
export const fmtPhone = (v) => { const d = String(v || '').replace(/[^0-9]/g, '').slice(0, 11); if (d.length < 4) return d; if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3); if (d.length < 11) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6); return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7); };

/** 계약서 상태(마지막 종료일 기준): 종료일이 없고 문서가 있으면 확인필요, 아예 없으면 미작성 */
export function contractState(endDate, count, today) {
  const t = today || kstToday(); if (endDate) return endDate < t ? { text: '만료', tone: 'danger', end: endDate } : { text: '유효', tone: 'accent', end: endDate };
  return count ? { text: '확인필요', tone: 'warn', end: '' } : { text: '미작성', tone: 'muted', end: '' };
}
export const isResigned = (w) => !!w && w.status === 'resigned';
export function counts(list) { const r = (list || []).filter(isResigned).length; return { active: (list || []).length - r, resigned: r }; }
/** 목록: 재직/퇴사 거름 + 검색(이름·사번·소속·직급·휴대폰) + 사번 순 */
export function filterWorkers(list, f) {
  const q = String((f && f.q) || '').trim().toLowerCase().replace(/\s+/g, ''); const want = (f && f.view) === 'resigned';
  return (list || []).filter((w) => isResigned(w) === want && (!q || [w.name, w.empNo, w.dept, w.rank, w.phone].some((x) => String(x || '').toLowerCase().replace(/\s+/g, '').includes(q)))).sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz')));
}

/** 수정 양식 → 저장 내용. 직급·부서가 바뀌면 이력 한 건을 함께 만들고, 직급이 바뀌었는데 호봉을 손으로 안 고쳤으면 호봉을 1로 되돌린다(구포털 규칙) */
export const EMP_TYPES = [['', '미지정'], ['field', '현장직'], ['office', '사무직']];
export function buildEdit(orig, form, opt) {
  const o = orig || {}; const f = form || {}; const errors = []; const T = (v, max, label) => { const s = String(v == null ? '' : v).trim(); if (s.length > max) errors.push(label + '은(는) ' + max + '자 이내로 입력해 주세요.'); return s; };
  const name = T(f.name, 40, '이름'); if (!name) errors.push('이름을 입력해 주세요.');
  const empNo = T(f.empNo, 10, '사원번호'); if (!empNo) errors.push('사원번호를 입력해 주세요.'); else if (!/^[0-9A-Za-z-]+$/.test(empNo)) errors.push('사원번호는 숫자·영문·-만 쓸 수 있습니다.');
  const hire = String(f.hireDate || '').trim(); if (hire && !isDate(hire)) errors.push('입사일 형식이 올바르지 않습니다.');
  const email = T(f.email, 80, '이메일'); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('이메일 형식이 올바르지 않습니다.');
  const phone = fmtPhone(f.phone); if (String(f.phone || '').trim() && phone.replace(/-/g, '').length < 9) errors.push('휴대폰 번호가 올바르지 않습니다.');
  const empType = String(f.empType || ''); if (!EMP_TYPES.some((x) => x[0] === empType)) errors.push('직원 구분이 올바르지 않습니다.');
  const stepIn = f.step === '' || f.step == null ? null : Number(f.step); if (stepIn !== null && !(Number.isInteger(stepIn) && stepIn >= 1 && stepIn <= 60)) errors.push('호봉은 1~60 사이의 정수여야 합니다.');
  const rank = T(f.rank, 20, '직급'); const dept = T(f.dept, 40, '소속');
  const dup = ((opt && opt.others) || []).find((x) => x.id !== o.id && String(x.empNo || '') === empNo); if (empNo && dup) errors.push('같은 사원번호(' + empNo + ')를 쓰는 사람이 있습니다(' + (dup.name || '') + ').');
  if (errors.length) return { ok: false, errors };
  const rankChanged = String(o.rank || '').trim() !== '' && rank !== (o.rank || ''); const deptChanged = String(o.dept || '').trim() !== '' && dept !== (o.dept || '');
  const stepCur = stepNow(o, opt && opt.year); const stepEdited = stepIn !== null && stepIn !== stepCur;
  const pub = { name, empNo, hireDate: hire, email, phone, empType, rank, dept, job: T(f.job, 60, '담당업무') }; const priv = { address: T(f.address, 120, '주소'), bankAccount: T(f.bankAccount, 60, '계좌번호') };
  const jIn = String(f.jumin || '').replace(/[^0-9]/g, ''); if (jIn) { if (jIn.length !== 13) errors.push('주민등록번호 13자리를 입력해 주세요(바꾸지 않으려면 비워 두세요).'); else if (jIn !== String(o.jumin || '').replace(/[^0-9]/g, '')) { const dupJ = ((opt && opt.others) || []).find((x) => x.id !== o.id && x.name === name && String(x.jumin || '').replace(/[^0-9]/g, '') === jIn); if (dupJ) errors.push('같은 이름·주민번호의 근로자가 이미 있습니다.'); else priv.jumin = fmtJumin(jIn); } }
  if (errors.length) return { ok: false, errors };
  const year = (opt && opt.year) || Number(kstToday().slice(0, 4));
  if (stepEdited) { pub.step = stepIn; pub.stepYear = year; } else if (rankChanged) { pub.step = 1; pub.stepYear = year; }
  const history = rankChanged || deptChanged ? { type: rankChanged && deptChanged ? 'both' : rankChanged ? 'rank' : 'dept', fromRank: o.rank || '', toRank: rank, fromDept: o.dept || '', toDept: dept, reason: String((f.reason || '')).trim().slice(0, 300) } : null;
  const portal = o.portalUid ? { uid: o.portalUid, fields: { name, rank, dept, ...(empNo !== (o.empNo || '') ? { empNo } : {}) } } : null;
  return { ok: true, errors: [], pub, priv, history, portal, stepReset: !stepEdited && rankChanged, empNoChanged: empNo !== (o.empNo || '') };
}
/** 변경 이력 줄 글 */
export function historyText(h) { const out = []; if ((h.fromRank || '') !== (h.toRank || '')) out.push('직급 ' + (h.fromRank || '-') + ' → ' + (h.toRank || '-')); if ((h.fromDept || '') !== (h.toDept || '')) out.push('소속 ' + (h.fromDept || '-') + ' → ' + (h.toDept || '-')); return out.join(' · '); }

/* ───────── 신규 등록 · 퇴직 · 재직 복구 · 포털 연동 · 주민번호 ───────── */
export const fmtJumin = (v) => { const d = String(v || '').replace(/[^0-9]/g, '').slice(0, 13); return d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; };
const jDigits = (v) => String(v || '').replace(/[^0-9]/g, '');
/** 사원번호 규칙: 입사 연도 2자리 + 그 해 순번 3자리(yynnn) — 같은 해로 시작하는 5자리 사번의 최댓값 + 1 */
export function nextEmpNo(list, hireDate) {
  const yy = String(hireDate || kstToday()).slice(2, 4); let max = 0;
  (list || []).forEach((w) => { const no = String(w.empNo || ''); if (no.length === 5 && no.slice(0, 2) === yy) { const n = parseInt(no.slice(2), 10); if (n > max) max = n; } });
  return yy + String(max + 1).padStart(3, '0');
}
/** 주민번호가 들어가지 않는 임의 문서 번호: w_ + 16자리 16진수 */
export const newWorkerId = (rand) => 'w_' + Array.from(rand || [], (x) => (x & 255).toString(16).padStart(2, '0')).join('').slice(0, 16).padEnd(16, '0');
export const NEW_FORM = () => ({ name: '', jumin: '', phone: '', email: '', address: '', dept: '', rank: '', job: '', empType: '', hireDate: '', bankAccount: '' });
export function buildNew(form, list, opt) {
  const f = form || {}; const errors = []; const T = (v, max, label) => { const s = String(v == null ? '' : v).trim(); if (s.length > max) errors.push(label + '은(는) ' + max + '자 이내로 입력해 주세요.'); return s; };
  const name = T(f.name, 40, '이름'); if (!name) errors.push('이름을 입력해 주세요.');
  const jd = jDigits(f.jumin); if (jd.length !== 13) errors.push('주민등록번호 13자리를 입력해 주세요.');
  const hire = String(f.hireDate || '').trim() || ((opt && opt.today) || kstToday()); if (!isDate(hire)) errors.push('입사일 형식이 올바르지 않습니다.');
  const email = T(f.email, 80, '이메일'); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('이메일 형식이 올바르지 않습니다.');
  const phone = fmtPhone(f.phone); if (String(f.phone || '').trim() && phone.replace(/-/g, '').length < 9) errors.push('휴대폰 번호가 올바르지 않습니다.');
  const empType = String(f.empType || ''); if (!EMP_TYPES.some((x) => x[0] === empType)) errors.push('직원 구분이 올바르지 않습니다.');
  const dup = (list || []).find((w) => w.name === name && jDigits(w.jumin) === jd && jd.length === 13); if (dup) errors.push('이미 명부에 등록된 근로자입니다(사번 ' + (dup.empNo || '-') + (isResigned(dup) ? ', 퇴사 처리됨 — 재직 복구를 쓰세요' : '') + ').');
  if (errors.length) return { ok: false, errors };
  const empNo = nextEmpNo(list, hire);
  return { ok: true, errors: [], empNo, pub: { name, phone, email, dept: T(f.dept, 40, '소속'), rank: T(f.rank, 20, '직급'), job: T(f.job, 60, '담당업무'), empType, hireDate: hire, empNo, registeredAt: (opt && opt.nowIso) || new Date().toISOString() }, priv: { jumin: fmtJumin(f.jumin), address: T(f.address, 120, '주소'), bankAccount: T(f.bankAccount, 60, '계좌번호') } };
}
export function buildResign(date) { const d = String(date || '').trim(); if (!isDate(d)) return { ok: false, error: '퇴직일 형식이 올바르지 않습니다. 예: 2026-09-16' }; return { ok: true, patch: { status: 'resigned', resignDate: d } }; }
/** 포털 계정 연동 후보: 이름이 같은 승인 계정이 정확히 한 명일 때만 */
export function linkCandidate(users, name) {
  const m = (users || []).filter((u) => u.name === name); if (m.length === 0) return { state: 'none', message: '포털에 "' + name + '" 계정이 없습니다. 포털 관리에서 먼저 계정을 만들어 주세요.' };
  if (m.length > 1) return { state: 'multi', message: '"' + name + '" 이름의 포털 계정이 ' + m.length + '개입니다. 관리자에게 문의해 주세요.' };
  return { state: 'one', user: m[0] };
}

/* ───────── 연차 현황 — 근로자 명부의 입사일 + 전자결재 연차신청서(승인·게시)로 회계연도 기준 부여·사용·잔여 ───────── */
const LEAVE_OK = ['approved', 'posted'];
/** 근로자 한 명의 연차 문서(승인·게시만): 포털 계정이 연동돼 있으면 작성자 계정으로, 아니면 이름으로 찾는다 */
export function leaveDocsOf(worker, docs) {
  return (docs || []).filter((d) => LEAVE_OK.includes(d.status) && ((worker.portalUid && d.authorUid === worker.portalUid) || (!worker.portalUid || !d.authorUid) && (d.authorName || d.name || '') === worker.name));
}
export function leaveRows(workers, docs, today, includeResigned) {
  return (workers || []).filter((w) => includeResigned || !isResigned(w)).sort((a, b) => String(a.empNo || 'zzz').localeCompare(String(b.empNo || 'zzz'))).map((w) => {
    const mine = leaveDocsOf(w, docs); const noHire = !isDate(w.hireDate); const g = noHire ? null : calcLeaveBalance(w.hireDate, mine, today);
    return { id: w.id, name: w.name || '', empNo: w.empNo || '', dept: w.dept || '', rank: w.rank || '', hireDate: w.hireDate || '', resigned: isResigned(w), noHire, detail: noHire ? '' : g.detail, granted: noHire ? null : g.granted, used: noHire ? null : g.used, planned: noHire ? 0 : g.planned, remain: noHire ? null : g.remain, tracks: noHire ? [] : g.tracks, docs: mine };
  });
}
export const leaveEntries = (docs) => (docs || []).map((d) => ({ id: d.id, status: d.status === 'posted' ? '게시' : '승인', title: d.title || d.leaveType || '-', type: d.leaveType || '', start: d.startDate || d.sdate || '', end: d.endDate || d.edate || '', days: parseFloat(d.days || d.leaveDays || 0) || 0, annual: jhLeaveIsAnnual(d.leaveType) })).sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
export function leaveTotals(rows) { const r = (rows || []).filter((x) => !x.noHire); return { n: (rows || []).length, noHire: (rows || []).length - r.length, granted: r.reduce((s, x) => s + x.granted, 0), used: r.reduce((s, x) => s + x.used, 0), remain: r.reduce((s, x) => s + x.remain, 0) }; }

/* ───────── 인사 변동(직급·소속·연봉) ───────── */
export const wonText = (n) => (Number(n) ? Math.round(Number(n)).toLocaleString('ko-KR') + '원' : '-');
/** 변동 처리: 바뀐 직급·소속과 시행일(오늘 이전)을 검사하고 저장할 내용을 만든다. 직급이 바뀌면 호봉을 1로 초기화(구포털 규칙) */
export function buildChange(worker, form, today, year) {
  const w = worker || {}; const f = form || {}; const errors = []; const oldRank = w.rank || '', oldDept = w.dept || '';
  const newRank = String(f.rank || '').trim() || oldRank; const newDept = String(f.dept || '').trim() || oldDept;
  const rankChanged = newRank !== oldRank, deptChanged = newDept !== oldDept;
  if (!w.id) errors.push('근로자를 선택해 주세요.'); else if (!rankChanged && !deptChanged) errors.push('변경된 직급·소속이 없습니다.');
  const date = String(f.date || '').trim(); const t = today || kstToday();
  if (!isDate(date)) errors.push('시행일을 입력해 주세요.'); else if (date > t) errors.push('시행일은 오늘 이전 날짜만 입력할 수 있습니다(저장 즉시 명부에 반영됩니다).');
  if (errors.length) return { ok: false, errors };
  const y = year || Number(t.slice(0, 4)); const patch = {}; if (rankChanged) { patch.rank = newRank; patch.step = 1; patch.stepYear = y; } if (deptChanged) patch.dept = newDept;
  const history = { type: rankChanged && deptChanged ? 'both' : rankChanged ? 'rank' : 'dept', fromRank: oldRank, toRank: newRank, fromDept: oldDept, toDept: newDept, reason: String(f.reason || '').trim().slice(0, 300), effectiveDate: date };
  const label = [rankChanged ? '직급 ' + (oldRank || '-') + ' → ' + newRank : '', deptChanged ? '소속 ' + (oldDept || '-') + ' → ' + newDept : ''].filter(Boolean).join(' · ');
  return { ok: true, errors: [], patch, history, label, stepReset: rankChanged, portal: w.portalUid ? { uid: w.portalUid, fields: { name: w.name || '', rank: newRank, dept: newDept } } : null };
}
/** 연봉 변동: 저장된 연봉계약서의 계약연봉이 시행일 순으로 달라진 지점(같은 시행일은 나중에 저장한 것) — 별도 기록 없이 계약서에서 산출 */
export function salaryEvents(worker, contracts) {
  const raw = []; (contracts || []).forEach((c) => { const s = Number(c.salary || 0); if (s && c.startDate) raw.push({ start: c.startDate, salary: s, saved: String(c.savedAt || '') }); });
  raw.sort((a, b) => a.start.localeCompare(b.start) || a.saved.localeCompare(b.saved));
  const arr = []; raw.forEach((c) => { if (arr.length && arr[arr.length - 1].start === c.start) arr[arr.length - 1] = c; else arr.push(c); });
  const events = []; arr.forEach((c, i) => { if (i > 0 && c.salary !== arr[i - 1].salary) events.push({ wid: worker.id, name: worker.name || '', date: c.start, kind: 'salary', text: '연봉 ' + wonText(arr[i - 1].salary) + ' → ' + wonText(c.salary), reason: '' }); });
  return { events, current: arr.length ? arr[arr.length - 1].salary : null };
}
/** 직급·소속 변경 이력 → 변동 줄 (tsDate: 변경 시각을 YYYY.MM.DD 로 바꾼 값) */
export function historyEvent(worker, h, tsDate) {
  const parts = historyText(h); if (!parts) return null;
  return { wid: worker.id, name: worker.name || '', date: h.effectiveDate || tsDate || '', kind: h.type === 'both' ? 'both' : (h.type || 'rank'), text: parts, reason: h.reason || '' };
}
export function filterEvents(events, f) {
  const t = (f && f.type) || 'all'; return (events || []).filter((e) => { if (f && f.onlySel && f.sel && e.wid !== f.sel) return false; if (t === 'all') return true; if (t === 'rank') return e.kind === 'rank' || e.kind === 'both'; if (t === 'dept') return e.kind === 'dept' || e.kind === 'both'; return e.kind === t; }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 200);
}
