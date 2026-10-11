/* 인사 — 근로자 명부(새 화면). 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 데이터: workers/{id}(일반 정보) + worker_private/{id}(주민번호·계좌·주소·서명, 읽을 때 합쳐 쓰고 저장할 때 다시 가른다)
 *         labor_contracts/{id}/contracts · annual_contracts/{id}/contracts(endDate), workers/{id}/history(직급·부서 변경 이력) */
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
  if (errors.length) return { ok: false, errors };
  const year = (opt && opt.year) || Number(kstToday().slice(0, 4));
  if (stepEdited) { pub.step = stepIn; pub.stepYear = year; } else if (rankChanged) { pub.step = 1; pub.stepYear = year; }
  const history = rankChanged || deptChanged ? { type: rankChanged && deptChanged ? 'both' : rankChanged ? 'rank' : 'dept', fromRank: o.rank || '', toRank: rank, fromDept: o.dept || '', toDept: dept, reason: String((f.reason || '')).trim().slice(0, 300) } : null;
  const portal = o.portalUid ? { uid: o.portalUid, fields: { name, rank, dept, ...(empNo !== (o.empNo || '') ? { empNo } : {}) } } : null;
  return { ok: true, errors: [], pub, priv, history, portal, stepReset: !stepEdited && rankChanged, empNoChanged: empNo !== (o.empNo || '') };
}
/** 변경 이력 줄 글 */
export function historyText(h) { const out = []; if ((h.fromRank || '') !== (h.toRank || '')) out.push('직급 ' + (h.fromRank || '-') + ' → ' + (h.toRank || '-')); if ((h.fromDept || '') !== (h.toDept || '')) out.push('소속 ' + (h.fromDept || '-') + ' → ' + (h.toDept || '-')); return out.join(' · '); }
