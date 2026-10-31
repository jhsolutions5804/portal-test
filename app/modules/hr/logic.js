/* 인사 — 근로자 명부(새 화면). 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 데이터: workers/{id}(일반 정보) + worker_private/{id}(주민번호·계좌·주소·서명, 읽을 때 합쳐 쓰고 저장할 때 다시 가른다)
 *         labor_contracts/{id}/contracts · annual_contracts/{id}/contracts(endDate), workers/{id}/history(직급·부서 변경 이력) */
import { calcLeaveBalance, jhLeaveIsAnnual } from '../../shared/leave-calc.js?v=20261031f';
export const WP_FIELDS = ['bankAccount', 'address', 'signData', 'taxFamily', 'taxChildren', 'taxRate'];   // worker_private 에 따로 두는 필드 — 주민번호(jumin)는 더 이상 여기 두지 않는다(테섭 2026-10-08): 서버 함수(identityAct)가 암호문으로 보관하고 마스킹 값(juminMasked)만 worker_private 에 남는다
export const WP_NEVER_WRITE = ['jumin', 'juminMasked', 'juminUpdatedAt', 'birth6'];   // 화면에서 합쳐 만든 값·서버 전용 값은 문서에 쓰지 않는다
/** 보유 자격증 목록(기술수당 1개당): 저장된 배열, 없으면 옛 hasCertification 표시를 한 개로 */
export const certsFromWorker = (w) => (w && Array.isArray(w.certifications) && w.certifications.length ? w.certifications.map((c) => String(c == null ? '' : c)) : (w && w.hasCertification ? ['(마이그레이션 필요) 기존 자격증'] : []));
export const MAX_CERTS = 30;
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const num = (v) => (v === '' || v == null ? null : Number(v));

/** 저장 문서를 일반 / 개인정보 두 갈래로 가른다 */
export function splitWorker(data) { const pub = {}, priv = {}; Object.keys(data || {}).forEach((k) => { if (WP_NEVER_WRITE.includes(k)) return; (WP_FIELDS.includes(k) ? priv : pub)[k] = data[k]; }); return { pub, priv }; }
/** 일반 정보 + 개인정보 문서를 합친 모양. 주민번호 전체는 없고(마스킹 값 juminMasked 와 생년월일 6자리 birth6 만), 이전 전 평문이 남아 있어도 화면 메모리에서는 버린다 */
export function mergeWorker(pub, priv) { const x = Object.assign({}, pub, priv || {}); const src = x.juminMasked || x.jumin || ''; x.birth6 = String(src).replace(/\D/g, '').slice(0, 6); delete x.jumin; return x; }
/** 같은 사람인지 비교용: 생년월일 6자리 + 성별 자리(마스킹 값 앞 7자리) — 전체 번호는 서버에만 있어 비교하지 않는다 */
export const juminHead = (w) => String((w && (w.juminMasked || w.jumin)) || '').replace(/\D/g, '').slice(0, 7);

/** 소득세(간이세액표) 입력: 공제대상 가족 수(본인 포함, 1~15)·그중 8~20세 자녀 수(0~가족 수−1)·원천징수 비율(80·100·120). 빈 칸은 기본값(1·0·100) */
export const TAX_RATES = [80, 100, 120];
export function taxInfoFromForm(f) {
  const x = f || {}; const errors = []; const toInt = (v, d) => (v === '' || v == null ? d : Number(v));
  const fam = toInt(x.taxFamily, 1), kids = toInt(x.taxChildren, 0), rate = toInt(x.taxRate, 100);
  if (!(Number.isInteger(fam) && fam >= 1 && fam <= 15)) errors.push('공제대상 가족 수는 본인을 포함해 1~15 사이의 정수로 입력해 주세요.');
  else if (!(Number.isInteger(kids) && kids >= 0 && kids <= fam - 1)) errors.push('8~20세 자녀 수는 0 이상이고 공제대상 가족 수(본인 포함)보다 작아야 합니다.');
  if (!TAX_RATES.includes(rate)) errors.push('원천징수 비율은 80·100·120 중에서 골라 주세요.');
  return { errors, values: { taxFamily: fam, taxChildren: kids, taxRate: rate } };
}
/** 저장된 근로자 문서 → 소득세용 값(없으면 기본 1·0·100) */
export const taxInfoOf = (w) => { const x = w || {}; const fam = Number(x.taxFamily), kids = Number(x.taxChildren), rate = Number(x.taxRate); return { family: fam >= 1 ? fam : 1, children: kids >= 0 ? kids : 0, rate: TAX_RATES.includes(rate) ? rate : 100 }; };
/** 급여 작성 화면의 "소득세에 쓴 값" 안내 — 명부(worker_private)에 공제대상 가족 수가 없거나 올바르지 않으면 조용히 1명으로 계산하지 않고 경고한다(대기열 1-3 간이세액표). 가족 수만 입력 여부의 기준이다(자녀 0명·비율 100% 는 정상 기본값). 반환: { text, warn } */
export const taxBasisNote = (w) => {
  const x = w || {}; const fam = Number(x.taxFamily); const entered = x.taxFamily !== '' && x.taxFamily != null && Number.isInteger(fam) && fam >= 1 && fam <= 15;
  const t = taxInfoOf(x); const rate = '원천징수 ' + t.rate + '%';
  if (!entered) return { text: '공제대상 가족 수가 명부에 없어(또는 올바르지 않아) 가족 1명으로 계산했습니다 · ' + rate + ' — 직원 정보(명부)에서 입력하세요', warn: true };
  const kids = t.children > 0 ? '(그중 8~20세 자녀 ' + t.children + '명)' : ''; const me = t.family === 1 ? '(본인)' : '';
  return { text: '공제대상 가족 ' + t.family + '명' + me + kids + ' · ' + rate, warn: false };
};

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
export function contractState(endDate, count, today, period) { const t = today || kstToday(); if (!endDate && (period === 'open' || period === 'project')) return { text: period === 'open' ? '정함 없음' : '프로젝트 종료 시', tone: 'accent', end: '' };   /* v7: 종료일 없는 계약 */ if (endDate) return endDate < t ? { text: '만료', tone: 'danger', end: endDate } : { text: '유효', tone: 'accent', end: endDate };
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
  const certs = (Array.isArray(f.certs) ? f.certs : certsFromWorker(o)).map((c) => String(c == null ? '' : c).trim()).filter(Boolean); if (certs.length > MAX_CERTS) errors.push('자격증은 ' + MAX_CERTS + '개까지 등록할 수 있습니다.'); if (certs.some((c) => c.length > 60)) errors.push('자격증 이름은 60자 이내로 입력해 주세요.');
  const pub = { name, empNo, hireDate: hire, email, phone, empType, rank, dept, job: T(f.job, 60, '담당업무'), certifications: certs, hasCertification: /* 옛 자격증 1개 표시는 새 목록으로 대체 — false 로 두어 모두 지웠을 때 기술수당이 남지 않게 */ false }; const priv = { address: T(f.address, 120, '주소'), bankAccount: T(f.bankAccount, 60, '계좌번호') };
  const tx = taxInfoFromForm(f); tx.errors.forEach((e) => errors.push(e)); Object.assign(priv, tx.values);   // 소득세(간이세액표)용: 공제대상 가족 수·8~20세 자녀 수·원천징수 비율 — 급여 계산 연결은 간이세액표 도입 때
  let newJumin = ''; const jIn = String(f.jumin || '').replace(/[^0-9]/g, ''); if (jIn) { if (jIn.length !== 13) errors.push('주민등록번호 13자리를 입력해 주세요(바꾸지 않으려면 비워 두세요).'); else { const dupJ = ((opt && opt.others) || []).find((x) => x.id !== o.id && x.name === name && juminHead(x) === jIn.slice(0, 7)); if (dupJ) errors.push('같은 이름·주민번호의 근로자가 이미 있습니다.'); else newJumin = jIn; } }   // 번호는 문서에 쓰지 않고 저장 뒤 서버 함수로 암호화 보관(newJumin)
  if (errors.length) return { ok: false, errors };
  const year = (opt && opt.year) || Number(kstToday().slice(0, 4));
  if (stepEdited) { pub.step = stepIn; pub.stepYear = year; } else if (rankChanged) { pub.step = 1; pub.stepYear = year; }
  const history = rankChanged || deptChanged ? { type: rankChanged && deptChanged ? 'both' : rankChanged ? 'rank' : 'dept', fromRank: o.rank || '', toRank: rank, fromDept: o.dept || '', toDept: dept, reason: String((f.reason || '')).trim().slice(0, 300) } : null;
  const portal = o.portalUid ? { uid: o.portalUid, fields: { name, rank, dept, ...(empNo !== (o.empNo || '') ? { empNo } : {}) } } : null;
  return { ok: true, errors: [], pub, priv, newJumin, history, portal, stepReset: !stepEdited && rankChanged, empNoChanged: empNo !== (o.empNo || '') };
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
  const dup = (list || []).find((w) => w.name === name && jd.length === 13 && juminHead(w) === jd.slice(0, 7)); /* 같은 이름 + 생년월일·성별 자리가 같으면 중복(전체 번호는 서버에만 있어 비교하지 않음) */ if (dup) errors.push('이미 명부에 등록된 근로자입니다(사번 ' + (dup.empNo || '-') + (isResigned(dup) ? ', 퇴사 처리됨 — 재직 복구를 쓰세요' : '') + ').');
  if (errors.length) return { ok: false, errors };
  const empNo = nextEmpNo(list, hire);
  return { ok: true, errors: [], empNo, jumin: jd, pub: { name, phone, email, dept: T(f.dept, 40, '소속'), rank: T(f.rank, 20, '직급'), job: T(f.job, 60, '담당업무'), empType, hireDate: hire, empNo, registeredAt: (opt && opt.nowIso) || new Date().toISOString() }, priv: { address: T(f.address, 120, '주소'), bankAccount: T(f.bankAccount, 60, '계좌번호') } };   // jumin(숫자 13자리)은 문서에 쓰지 않고 호출한 쪽이 서버 함수로 암호화 저장
}
/** 퇴직 처리 때 포털 계정이 언제 사용 중지되는가 — 퇴직일 당일까지는 재직이므로 "다음 날"부터. 서버(resign-sweep.js)와 같은 기준. today·date 는 YYYY-MM-DD */
export function resignAccountPlan(date, today) {
  const d = String(date || '').trim(), t = String(today || '').trim(); if (!isDate(d)) return { when: 'invalid', text: '' };
  const next = new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  if (d < t) return { when: 'now', stopFrom: next, text: '포털 계정도 바로 사용 중지됩니다(로그인이 막히고 열려 있는 로그인이 끊깁니다).' };
  return { when: 'later', stopFrom: next, text: '퇴직일이 오늘이거나 아직 지나지 않아, 포털 계정은 ' + next + ' 새벽에 자동으로 사용 중지됩니다. 퇴직일을 잘못 입력하면 일하는 직원의 로그인이 막힐 수 있으니 날짜를 한 번 더 확인해 주세요.' };
}
/** 서버(adminAct syncResigned)의 응답을 사람이 읽는 한 줄로. r = { suspended:[{name}], failed:[{name}], skippedAdmin:[], ambiguous:[{name,why}], noDate:[] }, name = 퇴직 처리한 직원 이름 */
export function resignSyncMessage(r, name) {
  const x = r || {}; const has = (a) => (x[a] || []).some((v) => (typeof v === 'string' ? v : v && v.name) === name);
  if (has('suspended')) return { ok: true, text: name + '님의 포털 계정을 사용 중지했습니다.' };
  if (has('failed')) return { ok: false, text: name + '님의 포털 계정을 사용 중지하지 못했습니다. 직원 관리에서 직접 사용 중지해 주세요.' };
  if (has('skippedAdmin')) return { ok: false, text: name + '님은 관리자 계정이라 자동으로 중지하지 않았습니다. 직원 관리에서 직접 처리해 주세요.' };
  if ((x.ambiguous || []).some((a) => a && a.name === name)) return { ok: false, text: name + '님의 포털 계정을 확실하게 찾지 못해 건드리지 않았습니다(' + x.ambiguous.find((a) => a.name === name).why + '). 직원 관리에서 확인해 주세요.' };
  if (x.alreadyOff) return { ok: true, text: '' };
  return { ok: true, text: '' };
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
export const leaveEntries = (docs) => (docs || []).map((d) => ({ id: d.id, status: d.status === 'posted' ? '게시' : '승인', title: d.title || d.leaveType || '-', type: d.leaveType || '', start: d.startDate || d.sdate || '', end: d.endDate || d.edate || '', days: parseFloat(d.days || d.leaveDays || 0) || 0, annual: jhLeaveIsAnnual(d.leaveType), admin: !!d.adminCreated, reason: d.reason || '', note: d.note || '' })).sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
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

/* ───────── 공고 관리 — job_postings(홈페이지 recruit-jobs·recruit 가 open 공고만 읽어 보여 준다) ─────────
 * 경력·고용형태·근무일시는 선택지로 고르고, 저장할 때 홈페이지 표시 문장으로 조합해 career/empType/workTime 에 저장(선택값은 opt 에 보관) — 구포털과 같은 규칙.
 * 학력은 공고에 요건으로 두지 않는다(대표님 결정 2026-10-12 — 학력 차별 소지 검토). 지원서에서는 학력 사항을 그대로 받는다. education 키는 홈페이지 호환을 위해 빈 값으로만 남긴다. */
export const JOB_HOME_BASE = 'https://jhsol.kr';   // 본섭 홈페이지(채용 소개·공고·지원 폼) 본주소
export const JOB_HOME_BASE_TEST = 'https://jhsol.kr/portal-test/recruit-test';   // 테섭: 테섭 DB 에 연결된 사본 페이지(테섭에서 낸 공고·지원서가 본섭 홈페이지로 새지 않게)
export const jobHomeBase = (isTest) => (isTest ? JOB_HOME_BASE_TEST : JOB_HOME_BASE);
export const JOB_PAGES = [{ file: 'careers.html', icon: '🌐', name: '채용 소개 (랜딩)', desc: '인재상·EVP 소개 첫 화면' }, { file: 'recruit-jobs.html', icon: '📋', name: '채용 공고', desc: '진행 중인 공고 목록' }, { file: 'recruit.html', icon: '✍️', name: '지원 폼', desc: '지원서 입력 화면' }];
export const JOB_STATUS = { open: '게시 중', closed: '마감', draft: '임시저장' };
export const JOB_OPT = { career: ['경력무관', '신입', '경력', '신입·경력'], emp: ['정규직', '계약직', '일용직', '인턴', '프리랜서', '아르바이트'], days: ['주 5일 (월~금)', '주 6일 (월~토)', '주 4일', '주 3일', '주 2일', '교대근무', '격주 근무', '요일 협의'], probation: ['1', '2', '3', '6'], contract: ['1', '2', '3', '6', '9', '12'] };
export const JOB_OPT_DEFAULT = () => ({ careerType: '경력무관', careerMin: '', careerMax: '', careerNote: '', emp: ['정규직', '계약직'], probation: '3', contractMonths: '3', convert: true, empNote: '', days: '주 5일 (월~금)', start: '07:00', end: '17:00', timeNeg: false, workNote: '' });
/** 새 공고에 자동으로 채우는 기본 문구(공고마다 수정). 공통 복지는 홈페이지 채용 소개에 있어 비워 둔다 */
export const JOB_DEFAULTS = { salary: '면접 후 결정', location: '경기 평택시 고덕중앙로 320 원희캐슬고덕 지식산업센터', duties: '공조설비 납품 일정과 공정 관리해요\n입고 현황을 관리해요\n협력사와 품질 사항 점검해요', requirements: '경력 무관 (신입 지원 가능)\n현장 소통을 원활히 하시는 분\n도면과 시방서 이해할 수 있는 분\n일정·자재를 꼼꼼히 관리하시는 분\n기본 문서작성과 보고가 가능하신 분\n안전수칙을 준수하며 일하시는 분', preferred: '공조·냉동 설비 유관 경험 가진 분\n납품·설치 프로젝트 참여해보신 분\n협력사 관리와 조율에 익숙하신 분', benefits: '', process: '서류전형 → 면접 → 최종합격', documents: '홈페이지 지원서 (입력하신 정보로 이력서 자동 생성)', notes: '합격자에 한 해 연락 드립니다.\n입사지원 서류에 허위사실이 발견될 경우, 채용확정 이후라도 채용이 취소될 수 있습니다.' };
/** 선택값(opt) → 홈페이지 표시 문장 */
export function jobCompose(o) {
  const yrs = o.careerMin && o.careerMax ? o.careerMin + '~' + o.careerMax + '년' : o.careerMin ? o.careerMin + '년 이상' : o.careerMax ? o.careerMax + '년 이하' : '';
  let career = o.careerType === '경력무관' ? '경력무관 (신입 포함)' : (o.careerType || ''); if (o.careerType === '경력') career = '경력' + (yrs ? ' ' + yrs : ''); if (o.careerType === '신입·경력') career = '신입·경력' + (yrs ? ' (경력 ' + yrs + ')' : ''); if (o.careerNote) career += ' · ' + o.careerNote;
  const emp = JOB_OPT.emp.filter((t) => (o.emp || []).includes(t)).map((t) => { if (t === '정규직') return '정규직' + (o.probation ? '(수습 ' + o.probation + '개월)' : ''); if (t === '계약직') return '계약직' + (o.contractMonths ? ' ' + o.contractMonths + '개월' : '') + '(' + [o.convert ? '정규직 전환 가능' : '', '기간제'].filter(Boolean).join(', ') + ')'; return t; });
  let empType = emp.join(', '); if (o.empNote) empType += (empType ? ' · ' : '') + o.empNote;
  let workTime = [o.days, o.start && o.end ? o.start + '~' + o.end : ''].filter(Boolean).join(' '); if (o.timeNeg) workTime += ' (시간 협의 가능)'; if (o.workNote) workTime += (workTime ? ' · ' : '') + o.workNote;
  return { career, education: '', empType, workTime };   // education 은 홈페이지 호환을 위한 빈 값(학력 요건은 두지 않음)
}
/** 선택값 없이 저장된 옛 공고 → 문구에서 선택값 추정(수정 화면을 열 때만) */
export function jobParseLegacy(j) {
  const o = JOB_OPT_DEFAULT(); const t = (x) => String(x || ''); const c = t(j.career);
  if (c.includes('무관')) o.careerType = '경력무관'; else if (c.includes('신입') && c.includes('경력')) o.careerType = '신입·경력'; else if (c.includes('신입')) o.careerType = '신입'; else if (c.includes('경력')) o.careerType = '경력';
  const yr = c.match(/(\d+)\s*~\s*(\d+)\s*년/), yu = c.match(/(\d+)\s*년\s*이상/), yd = c.match(/(\d+)\s*년\s*이하/); if (yr) { o.careerMin = yr[1]; o.careerMax = yr[2]; } else if (yu) o.careerMin = yu[1]; else if (yd) o.careerMax = yd[1];
  const m = t(j.empType); o.emp = JOB_OPT.emp.filter((x) => m.includes(x)); o.probation = (m.match(/수습\s*(\d+)\s*개월/) || [])[1] || ''; o.contractMonths = (m.match(/계약직\s*(\d+)\s*개월/) || [])[1] || ''; o.convert = m.includes('전환 가능');
  const w = t(j.workTime); o.days = JOB_OPT.days.find((x) => w.includes(x.replace(/ /g, '')) || w.includes(x)) || ''; const tm = w.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/); o.start = tm ? tm[1].padStart(2, '0') + ':' + tm[2] : ''; o.end = tm ? tm[3].padStart(2, '0') + ':' + tm[4] : ''; o.timeNeg = w.includes('협의');
  return o;
}
/** 화면에서 읽은 선택값을 정리 — 해당하지 않는 항목은 비움 */
export function normalizeOpt(o0) {
  const o = Object.assign(JOB_OPT_DEFAULT(), o0 || {}); o.emp = Array.isArray(o.emp) ? o.emp.slice() : [];
  ['eduLevel', 'eduAbove', 'eduGrad', 'eduNote'].forEach((k) => { delete o[k]; });   // 옛 공고에 남아 있던 학력 선택값은 저장할 때 정리
  if (!['경력', '신입·경력'].includes(o.careerType)) { o.careerMin = ''; o.careerMax = ''; } if (!o.emp.includes('정규직')) o.probation = ''; if (!o.emp.includes('계약직')) { o.contractMonths = ''; o.convert = false; } return o;
}
const JOB_TEXT = ['title', 'team', 'salary', 'location', 'duties', 'requirements', 'preferred', 'benefits', 'process', 'documents', 'notes', 'startDate', 'deadline'];
export function jobFormOf(j) { const isNew = !j || !j.id; const f = { status: isNew ? 'open' : (j.status || 'open') }; JOB_TEXT.forEach((k) => { f[k] = isNew ? (JOB_DEFAULTS[k] != null ? JOB_DEFAULTS[k] : '') : (j[k] == null ? '' : String(j[k])); }); if (isNew) { f.title = ''; f.team = ''; f.startDate = ''; f.deadline = ''; } return { f, o: isNew ? JOB_OPT_DEFAULT() : (j.opt ? Object.assign(JOB_OPT_DEFAULT(), j.opt) : jobParseLegacy(j)) }; }
export function buildJob(f, o0) {
  const errors = []; const v = (k) => String((f && f[k]) == null ? '' : f[k]).trim(); if (!v('title')) errors.push('모집 제목을 입력해 주세요.');
  if (v('startDate') && !isDate(v('startDate'))) errors.push('접수 시작일 형식이 올바르지 않습니다.'); if (v('deadline') && !isDate(v('deadline'))) errors.push('접수 마감일 형식이 올바르지 않습니다.'); if (isDate(v('startDate')) && isDate(v('deadline')) && v('deadline') < v('startDate')) errors.push('접수 마감일이 시작일보다 빠릅니다.');
  const opt = normalizeOpt(o0); if (!opt.careerType) errors.push('경력을 선택해 주세요.'); const st = v('status') || 'open'; if (!JOB_STATUS[st]) errors.push('상태가 올바르지 않습니다.');
  if (errors.length) return { ok: false, errors }; const data = Object.assign({ status: st, opt }, jobCompose(opt)); JOB_TEXT.forEach((k) => { data[k] = v(k); }); return { ok: true, errors: [], data };
}
export const jobOrder = (list) => (list || []).slice().sort((a, b) => ({ open: 0, draft: 1, closed: 2 }[a.status] ?? 3) - ({ open: 0, draft: 1, closed: 2 }[b.status] ?? 3) || ((b.createdMs || 0) - (a.createdMs || 0)));
export const jobMeta = (j) => [j.career, j.education, j.empType, j.location, j.startDate || j.deadline ? '접수 ' + (j.startDate || '') + ' ~ ' + (j.deadline || '상시') : '상시 모집'].filter(Boolean).join(' · ');

/* ───────── 근로자 면담 — interviews/{근로자}/records/{id}: 면담일·내용·후속조치 ───────── */
export const NEW_INTERVIEW = (today) => ({ date: today || kstToday(), memo: '', followUp: false });
export function buildInterview(form, today) {
  const f = form || {}; const errors = []; const date = String(f.date || '').trim(); if (!isDate(date)) errors.push('면담일을 입력해 주세요.'); else if (date > (today || kstToday())) errors.push('면담일이 오늘보다 뒤입니다.');
  const memo = String(f.memo == null ? '' : f.memo).trim(); if (memo.length > 4000) errors.push('면담 내용은 4,000자 이내로 입력해 주세요.');
  if (errors.length) return { ok: false, errors }; return { ok: true, errors: [], data: { date, memo, followUp: !!f.followUp } };
}
/** 면담 기록을 최신순으로 */
export const interviewsSorted = (list) => (list || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.createdMs) || 0) - (Number(a.createdMs) || 0));
/** 근로자 목록의 "최근 면담" 칸 */
export const latestInterview = (records) => interviewsSorted(records)[0] || null;

/* ───────── 휴직/퇴직 원서 — 전자결재(edoc_resign)에서 상신된 원서를 인사 담당자가 확인·출력 ───────── */
export const RRQ_STATUS = { draft: '임시저장', pending: '결재중', reviewing: '검토중', approved: '승인', posted: '승인·게시', done: '완료', rejected: '반려' };
export const rrqKindOf = (d) => (d && d.leaveKind) || '퇴직';
export const rrqDone = (d) => ['approved', 'posted', 'done'].includes(d && d.status);
const rrqInStat = (d, stat) => (stat === 'all' ? true : stat === 'active' ? !['draft', 'rejected'].includes(d.status) : d.status === stat);
export const rrqFilter = (docs, kind, stat) => (docs || []).filter((d) => (kind === 'all' || rrqKindOf(d) === kind) && rrqInStat(d, stat));
/** 구분·상태 버튼에 붙는 개수(서로의 선택을 반영) */
export function rrqCounts(docs, kind, stat) {
  const all = docs || []; const byKind = {}; ['all', '퇴직', '휴직'].forEach((k) => { byKind[k] = all.filter((d) => (k === 'all' || rrqKindOf(d) === k) && rrqInStat(d, stat)).length; });
  const byStat = {}; ['active', 'rejected', 'draft', 'all'].forEach((s2) => { byStat[s2] = all.filter((d) => (kind === 'all' || rrqKindOf(d) === kind) && rrqInStat(d, s2)).length; }); return { byKind, byStat };
}
/** 원서 작성자 → 근로자 명부(포털 계정 우선, 없으면 이름) */
export const rrqFindWorker = (workers, d) => (workers || []).find((x) => d.authorUid && x.portalUid === d.authorUid) || (workers || []).find((x) => x.name === d.authorName) || null;
export const korDate = (s) => { const m = String(s || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? Number(m[1]) + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일' : '____년 __월 __일'; };
export const dotDate = (s) => { const m = String(s || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[1] + '.' + m[2] + '.' + m[3] : '-'; };
const hx = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 퇴직원·휴직원 A4 서식(구포털과 같은 문구) — 새 창에 써서 인쇄/PDF 로 저장한다. filedDate: 접수일(YYYY-MM-DD, 없으면 today) */
export function resignPrintHtml(d, worker, filedDate, today) {
  const k = rrqKindOf(d); const dept = d.authorDept || (worker && worker.dept) || '', rank = d.authorRank || (worker && worker.rank) || '';
  const row = (th, td) => '<tr><th>' + th + '</th><td>' + td + '</td></tr>'; const title = k === '휴직' ? '휴 직 원' : '퇴 직 원';
  const period = k === '휴직' ? row('휴직 기간', korDate(d.lastDate) + ' 부터' + (d.returnDate ? ' &nbsp;(복직 예정일 ' + korDate(d.returnDate) + ')' : '')) : row('퇴직 예정일', korDate(d.lastDate));
  const stLabel = (a) => (a.status === 'approved' ? '승인' : a.status === 'rejected' ? '반려' : '결재중'); const line = (d.approvalLine || []).filter((a) => a && a.role);
  const apv = line.length ? '<table style="border-collapse:collapse;margin:26px 0 0 auto;font-size:9.5pt;text-align:center;"><tr>' + line.map((a) => '<th style="border:1px solid #333;background:#F0F3F8;padding:4px 14px;min-width:78px;">' + hx(a.role) + '</th>').join('') + '</tr><tr>' + line.map((a) => '<td style="border:1px solid #333;padding:8px 6px;height:34px;"><b>' + hx(a.name || '') + '</b><br><span style="font-size:8.5pt;color:#555;">' + hx(a.rank || '') + '</span></td>').join('') + '</tr><tr>' + line.map((a) => '<td style="border:1px solid #333;padding:4px 6px;font-size:8.5pt;color:' + (a.status === 'approved' ? '#166534' : a.status === 'rejected' ? '#B91C1C' : '#92400E') + ';">' + stLabel(a) + (a.approvedDate ? '<br>' + dotDate(a.approvedDate) : '') + '</td>').join('') + '</tr></table>' : '';
  const filed = filedDate && filedDate !== '-' ? filedDate : ''; const body = '<h1>' + title + '</h1><div class="ul"></div><table class="kv">' + row('소&nbsp;&nbsp;&nbsp;&nbsp;속', hx(dept) || '-') + row('직&nbsp;&nbsp;&nbsp;&nbsp;급', hx(rank) || '-') + row('성&nbsp;&nbsp;&nbsp;&nbsp;명', hx(d.authorName) || '-') + (worker && worker.empNo ? row('사&nbsp;&nbsp;&nbsp;&nbsp;번', hx(worker.empNo)) : '') + (worker && worker.hireDate ? row('입&nbsp;사&nbsp;일', korDate(worker.hireDate)) : '') + period + row('사&nbsp;&nbsp;&nbsp;&nbsp;유', '<div style="white-space:pre-wrap;min-height:70px;">' + (hx(d.reason) || '-') + '</div>') + '</table>'
    + '<p style="text-align:center;margin:34px 0 8px;font-size:11pt;">위와 같은 사유로 ' + (k === '휴직' ? '휴직' : '퇴직') + '하고자 하오니 허락하여 주시기 바랍니다.</p><p style="text-align:center;margin:18px 0 0;font-size:11pt;">' + korDate(filed || today) + '</p><p style="text-align:right;margin:26px 0 0;font-size:11pt;">작성자 : <b>' + (hx(d.authorName) || '') + '</b> &nbsp;(서명)</p><p style="margin:34px 0 0;font-size:12pt;font-weight:700;">제이에이치솔루션 대표 귀하</p>' + apv + '<p style="margin:22px 0 0;font-size:8.5pt;color:#777;">※ 전자결재 상태: ' + (RRQ_STATUS[d.status] || d.status || '-') + ' · 접수일 ' + (filed || '-') + '</p>';
  const docTitle = hx((k === '휴직' ? '휴직원' : '퇴직원') + '_' + (d.authorName || ''));
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + docTitle + '</title><style>body{margin:0;font-family:\'Malgun Gothic\',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.8;color:#1A2540;box-sizing:border-box;}h1{text-align:center;font-size:20pt;letter-spacing:6px;margin:0 0 6px;}.ul{width:60px;height:2px;background:#333;margin:8px auto 24px;}table.kv{width:100%;border-collapse:collapse;margin:10px 0;}table.kv th{border:1px solid #333;background:#F0F3F8;padding:7px 10px;width:130px;text-align:left;font-size:10pt;vertical-align:top;}table.kv td{border:1px solid #333;padding:7px 10px;font-size:10.5pt;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style></head><body><div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;"><button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button><button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button></div><div class="a4">' + body + '</div></body></html>';
}

/* ───────── 인사 캘린더 — hr_calendar_events(지정 담당자만, 규칙에서도 같은 목록으로 막음) + 연차(company_schedules, 읽기만) ───────── */
export const HC_TYPES = { interview: '면접', offerreply: '연봉제안서 회신', salarynego: '연봉협상', eval: '인사평가', resign: '퇴사', etc: '기타' };
const pad2 = (n) => String(n).padStart(2, '0');
export const hcMonthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return { a: ym + '-01', b: ym + '-' + pad2(new Date(y, m, 0).getDate()) }; };
export const hcMove = (ym, delta) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
/** 달력 칸: 앞쪽 빈 칸(요일 수)과 날짜 칸 — dow 0=일 */
export function hcGrid(ym, today) { const [y, m] = ym.split('-').map(Number); const first = new Date(y, m - 1, 1).getDay(); const days = new Date(y, m, 0).getDate(); const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= days; d++) { const ds = ym + '-' + pad2(d); cells.push({ ds, d, dow: new Date(y, m - 1, d).getDay(), today: ds === today }); } return cells; }
export function hcByDate(events) { const m = {}; (events || []).forEach((e) => { (m[e.date] = m[e.date] || []).push(e); }); Object.keys(m).forEach((k) => m[k].sort((p, q) => String(p.time || '99').localeCompare(String(q.time || '99')))); return m; }
export const hcSort = (events) => (events || []).slice().sort((p, q) => String(p.date || '').localeCompare(String(q.date || '')) || String(p.time || '99').localeCompare(String(q.time || '99')));
export function hcValidate(f) {
  const g = (k) => String((f && f[k]) == null ? '' : f[k]).trim(); const errors = [];
  if (!HC_TYPES[g('type')]) errors.push('구분을 선택해 주세요.'); if (!g('title')) errors.push('제목을 입력해 주세요.'); if (!isDate(g('date'))) errors.push('날짜를 입력해 주세요.');
  if (g('endTime') && !g('time')) errors.push('종료 시간은 시작 시간과 함께 입력해 주세요.'); else if (g('endTime') && g('endTime') <= g('time')) errors.push('종료 시간이 시작 시간보다 늦어야 합니다.');
  if (g('title').length > 100) errors.push('제목은 100자 이내로 입력해 주세요.'); if (g('note').length > 1000) errors.push('메모는 1,000자 이내로 입력해 주세요.');
  if (errors.length) return { ok: false, errors }; return { ok: true, errors: [], data: { type: g('type'), title: g('title'), person: g('person').slice(0, 40), date: g('date'), time: g('time'), endTime: g('endTime'), note: g('note') } };
}
/** 연차: company_schedules(분류 off·leave)를 날짜별로 펼친다. 2일 이상 이어진 연차는 주말·공휴일을 건너뛴다 */
export function hcExpandLeaves(schedules, monthStart, monthEnd, isHol) {
  const out = {}; (schedules || []).forEach((x) => {
    if (!['off', 'leave'].includes(x.tag) || !x.sdate) return; const sd = x.sdate, ed = x.edate && x.edate >= x.sdate ? x.edate : x.sdate; if (ed < monthStart) return; const multi = ed > sd;
    const from = sd > monthStart ? sd : monthStart; const to = ed < monthEnd ? ed : monthEnd; let cur = Date.parse(from + 'T00:00:00Z'); const end = Date.parse(to + 'T00:00:00Z');
    for (; cur <= end; cur += 86400000) { const dt = new Date(cur); const ds = dt.toISOString().slice(0, 10); const dow = dt.getUTCDay(); if (multi && (dow === 0 || dow === 6 || (isHol && isHol(ds)))) continue; (out[ds] = out[ds] || []).push({ name: x.att || '', kind: x.tagLabel || '연차', text: x.text || '', sdate: sd, edate: ed }); }
  });
  Object.keys(out).forEach((k) => out[k].sort((p, q) => p.name.localeCompare(q.name, 'ko'))); return out;
}
/** 승인된 퇴직원서(edoc_resign) → 인사 캘린더 '퇴사' 일정 계획. 일정 번호를 resign_<원서번호>로 고정해 같은 원서는 중복되지 않고, 승인이 풀리면 자동 등록분만 지운다 */
export function hcResignPlan(docs, existing) {
  const upserts = [], deletes = []; (docs || []).forEach((d) => {
    if ((d.leaveKind || '퇴직') !== '퇴직') return; const id = 'resign_' + d.id; const ok = ['approved', 'posted', 'done'].includes(d.status) && /^\d{4}-\d{2}-\d{2}$/.test(d.lastDate || ''); const old = (existing || {})[id] || null;
    if (ok) { const data = { type: 'resign', title: (d.authorName || '') + ' 퇴사', person: d.authorName || '', date: d.lastDate, time: '', endTime: '', note: '전자결재 퇴직원서 승인', auto: true, sourceId: d.id }; if (old && old.date === data.date && old.person === data.person && old.type === 'resign') return; upserts.push({ id, data }); }
    else if (old && old.auto) deletes.push(id);
  }); return { upserts, deletes };
}

/* ───────── 인사평가 — evaluations/{근로자}/records: 정기평가(연 1회, 연봉협상 이전)·수시평가(PJT 동료평가 취합), 등급 S·A·B·C, 초안→확정 ───────── */
export const EVAL_GRADES = { S: '탁월', A: '우수', B: '보통', C: '미흡' };
export const gradeLabel = (g) => (EVAL_GRADES[g] ? g + '(' + EVAL_GRADES[g] + ')' : String(g || '-'));
export const NEW_EVAL = (year) => ({ type: 'regular', year: year || Number(kstToday().slice(0, 4)), pjtName: '', grade: 'B', comment: '' });
export function buildEval(form, confirmed) {
  const f = form || {}; const errors = []; const type = f.type === 'adhoc' ? 'adhoc' : 'regular'; const year = Number(f.year);
  if (type === 'regular' && !(Number.isInteger(year) && year >= 2000 && year <= 2100)) errors.push('평가연도를 입력해 주세요(2000~2100).');
  const pjt = String(f.pjtName || '').trim(); if (type === 'adhoc' && !pjt) errors.push('관련 PJT명을 입력해 주세요.'); if (pjt.length > 80) errors.push('PJT명은 80자 이내로 입력해 주세요.');
  if (!EVAL_GRADES[f.grade]) errors.push('평가등급을 선택해 주세요.'); const comment = String(f.comment == null ? '' : f.comment).trim(); if (comment.length > 2000) errors.push('코멘트는 2,000자 이내로 입력해 주세요.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], confirmed: !!confirmed, data: { type, year: type === 'regular' ? year : Number(kstToday().slice(0, 4)), pjtName: type === 'adhoc' ? pjt : '', grade: f.grade, comment, status: confirmed ? 'confirmed' : 'draft' } };
}
/** 평가 기록: 연도 최신순(같은 해는 나중에 쓴 것이 위) */
export const evalSorted = (list) => (list || []).slice().sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || (Number(b.createdMs) || 0) - (Number(a.createdMs) || 0));
/** 근로자 목록의 "최근 정기평가" */
export const evalLatestRegular = (list) => evalSorted((list || []).filter((r) => r.type === 'regular'))[0] || null;
/** 호봉 직접 입력: 비우면 자동 계산으로 되돌림(기준값 삭제), 1~60 정수만 */
export function buildStepInput(val, year) { const s = String(val == null ? '' : val).trim(); const y = year || Number(kstToday().slice(0, 4)); if (s === '') return { ok: true, patch: { step: null, stepYear: y } }; const n = Number(s); if (!(Number.isInteger(n) && n >= 1 && n <= 60)) return { ok: false, error: '호봉은 1~60 사이의 정수여야 합니다.' }; return { ok: true, patch: { step: n, stepYear: y } }; }

/* ───────── 채용 지원자 — recruit_applicants(홈페이지 지원 폼 → 비로그인 저장, 읽기·수정·삭제는 관리자) ───────── */
export const APP_STATUS = { new: '신규', review: '검토중', pass: '합격', fail: '불합격' };
export const appStatusOf = (a) => (a && a.status && APP_STATUS[a.status] ? a.status : 'new');
export const appFilter = (list, f) => (!f || f === 'all' ? (list || []) : (list || []).filter((a) => appStatusOf(a) === f));
export function appCounts(list) { const c = { all: (list || []).length, new: 0, review: 0, pass: 0, fail: 0 }; (list || []).forEach((a) => { c[appStatusOf(a)]++; }); return c; }
/** 면접 일시: 날짜 + 24시간 시간 두 칸 → 'YYYY-MM-DDTHH:MM'. 둘 다 올바를 때만 만든다 */
export function joinInterview(d, t) { const date = String(d || '').trim(), time = String(t || '').trim(); if (!isDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null; return date + 'T' + time; }
export function splitInterview(v) { const [d, t] = String(v || '').split('T'); return { date: d || '', time: t ? t.slice(0, 5) : '' }; }
/** 면접 일정 → 인사 캘린더(hr_calendar_events/interview_<지원자번호>). 일시를 비우면 일정을 지운다 */
export function interviewCalendar(a, v) {
  const id = 'interview_' + a.id; if (!v) return { id, remove: true }; const { date, time } = splitInterview(v);
  return { id, remove: false, data: { type: 'interview', title: '[면접] ' + (a.name || '') + (a.jobTitle ? ' · ' + a.jobTitle : ''), person: a.name || '', date, time: time || '', endTime: '', note: '채용 지원자 화면에서 자동 등록', source: 'applicant', srcId: a.id } };
}
export const prefillFromApplicant = (a) => ({ name: a.name || '', phone: a.phone || '', email: a.email || '', address: a.address || '' });
/** 이력서 한 줄 목록(학력·경력·자격) */
const RESUME_SECTIONS = [['학 력 사 항', 'educations', [['기간', 'period'], ['학교명/전공', 'school'], ['소재지', 'location'], ['졸업구분', 'grad']]], ['경 력 사 항', 'careers', [['근무기간', 'period'], ['근무처', 'company'], ['담당업무', 'duty'], ['직위', 'position']]], ['자격 및 면허사항', 'certs', [['취득일자', 'date'], ['자격/면허명', 'name'], ['발행처', 'issuer'], ['등급', 'grade']]]];
export const resumeSections = (a) => RESUME_SECTIONS.map(([title, key, cols]) => ({ title, cols: cols.map((c) => c[0]), rows: (a[key] || []).map((it) => cols.map((c) => String(it[c[1]] == null ? '' : it[c[1]]))) }));
/** 이력서 A4 — 새 창에 써서 인쇄/PDF 로 저장(구포털과 같은 구성) */
export function resumePrintHtml(a) {
  const e = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); const m = a.military || {};
  const td = (v, cs) => '<td' + (cs ? ' colspan="' + cs + '"' : '') + ' style="padding:6px 8px;border:1px solid #ccc;">' + e(v) + '</td>'; const th = (l) => '<th style="padding:6px 8px;border:1px solid #ccc;background:#EAF3FD;color:#1D5BA6;font-size:12px;white-space:nowrap;">' + l + '</th>';
  const sec = (l) => '<div style="background:#1D5BA6;color:#fff;font-weight:700;padding:6px 10px;font-size:12px;margin-top:14px;">' + l + '</div>';
  const tables = resumeSections(a).map((s2) => sec(s2.title) + '<table><tr>' + s2.cols.map(th).join('') + '</tr>' + (s2.rows.length ? s2.rows.map((r) => '<tr>' + r.map((x) => td(x)).join('') + '</tr>').join('') : '<tr><td colspan="' + s2.cols.length + '" style="padding:6px 8px;border:1px solid #ccc;color:#999;font-style:italic;">입력된 내용이 없습니다</td></tr>') + '</table>').join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + e(a.name) + ' 이력서</title><style>body{margin:0;font-family:\'Noto Sans KR\',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.toolbar{margin-bottom:12px;display:flex;gap:8px;}.toolbar button{padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;border:none;}.btn-print{background:#1D5BA6;color:#fff;font-weight:700;}.btn-back{background:#fff;border:1px solid #DDE4EF !important;}.a4{width:794px;min-height:1123px;background:#fff;padding:50px 60px;box-shadow:0 4px 24px rgba(0,0,0,0.2);box-sizing:border-box;}table{width:100%;border-collapse:collapse;font-size:12px;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:30px 40px;width:auto;}}</style></head><body><div class="toolbar"><button class="btn-back" onclick="window.close()">← 돌아가기</button><button class="btn-print" onclick="window.print()">🖨 인쇄 / PDF 저장</button></div><div class="a4"><div style="text-align:center;margin-bottom:28px;"><div style="font-size:22px;font-weight:800;color:#1D5BA6;letter-spacing:6px;">이 력 서</div></div>'
    + sec('인 적 사 항') + '<table><tr>' + th('성명') + td(a.name) + th('생년월일') + td(a.birth) + '</tr><tr>' + th('연락처') + td(a.phone) + th('성별') + td(a.gender) + '</tr><tr>' + th('이메일') + td(a.email) + th('최종학력') + td(a.eduLevel) + '</tr><tr>' + th('주소') + td(a.address, 3) + '</tr>' + (a.notes ? '<tr>' + th('특이사항') + td(a.notes, 3) + '</tr>' : '') + '</table>' + tables
    + sec('병 역 사 항') + '<table><tr>' + th('군별') + td(m.branch) + th('제대구분') + td(m.discharge) + '</tr><tr>' + th('복무기간') + td(m.period) + th('비고') + td(m.exempt) + '</tr></table></div></body></html>';
}

/* ───────── 급여테이블 — 회사 내규(참고용 호봉표): 시급이 기준값, 연봉 = 시급×209시간×12개월 ─────────
 * 사원 1호봉 시급 = 법정 최저시급 고정. 호봉마다 표준 인상률로 복리 인상, 직급이 바뀌어도 호봉은 이어서 계산. 학력에 따른 차등은 두지 않는다(2026-10-12 대표님 결정 — 구포털의 학력 트랙·학력 차등 제거).
 * 저장: company_settings/salaryTable. 여기서 고쳐도 급여명세서 자동계산에는 영향을 주지 않는다(구포털과 같음). */
export const SAL_POSITIONS = ['사원', '대리', '과장', '차장'];
const clone = (x) => JSON.parse(JSON.stringify(x));
export const salDefault = () => ({ minWage: 10320, standardRate: 3.5, perfRateMin: 2.0, perfRateMax: 5.0, techAllowancePerCert: 50000, tenure: { '사원': 3, '대리': 4, '과장': 5, '차장': 3 }, tracks: [{ id: 'standard', label: '표준', pinned: true, cellsHourly: {} }] });
export const salAnnual = (hourly) => Math.round((Number(hourly) || 0) * 209 * 12);
const trackStart = (track, d) => Number(d.minWage) || 0;   // 모든 호봉표는 최저시급에서 시작
function buildTrack(track, d, all) {
  const rate = 1 + ((Number(d.standardRate) || 0) / 100); let cur = trackStart(track, d); const cells = {};
  SAL_POSITIONS.forEach((pos) => { const years = Math.max(1, Number(d.tenure && d.tenure[pos]) || 1); for (let step = 1; step <= years; step++) { const key = pos + '-' + step; cells[key] = track.cellsHourly && track.cellsHourly[key] != null ? track.cellsHourly[key] : Math.round(cur); cur *= rate; } });
  return cells;
}
/** 표 만들기: force 가 아니면 직접 고친 칸은 그대로 두고 빈 칸만 표준 공식으로 채운다. 고정 트랙(표준)의 사원 1호봉은 항상 법정 최저시급 */
export function salRegenerate(data, force) {
  const d = clone(data); if (force) d.tracks.forEach((t) => { t.cellsHourly = {}; }); d.tracks.forEach((t) => { t.cellsHourly = buildTrack(t, d, d.tracks); }); d.tracks.forEach((t) => { if (t.pinned) t.cellsHourly['사원-1'] = Number(d.minWage) || 0; }); return d;
}
/** 저장된 문서(없으면 기본값) → 화면용 데이터. 옛 문서의 학력 트랙(고졸·비전공대졸·전공대졸)은 기준이던 첫 트랙(고정 트랙) 하나만 "표준"으로 남기고 나머지와 학력 차등 설정(eduGapRate)은 버린다 */
export function salNormalize(raw) {
  if (raw && Array.isArray(raw.tracks) && raw.tracks.some((t) => t && t.cellsHourly)) {
    const d = Object.assign(salDefault(), clone(raw)); delete d.eduGapRate; d.tenure = Object.assign(salDefault().tenure, d.tenure || {});
    const base = d.tracks.find((t) => t && t.pinned && t.cellsHourly) || d.tracks.find((t) => t && t.cellsHourly); d.tracks = [{ id: 'standard', label: '표준', pinned: true, cellsHourly: Object.assign({}, base.cellsHourly) }]; return salRegenerate(d, false);
  }
  return salRegenerate(salDefault(), false);
}
export function salSetField(data, field, value) { if (!['minWage', 'standardRate', 'perfRateMin', 'perfRateMax', 'techAllowancePerCert'].includes(field)) return data; const d = clone(data); d[field] = Number(value) || 0; return ['minWage', 'standardRate'].includes(field) ? salRegenerate(d, false) : d; }
export function salSetTenure(data, pos, value) { if (!SAL_POSITIONS.includes(pos)) return data; const d = clone(data); d.tenure = d.tenure || {}; d.tenure[pos] = Math.max(1, Math.min(30, Math.floor(Number(value)) || 1)); return salRegenerate(d, false); }
export function salEditCell(data, tid, key, value) { const d = clone(data); const t = d.tracks.find((x) => x.id === tid); if (!t || (t.pinned && key === '사원-1')) return data; const n = Number(value); t.cellsHourly[key] = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; return d; }
/** 세로 배치용 표: 직급을 열(사원·대리·과장·차장), 호봉을 행(1호봉~)으로. 체류연한보다 큰 호봉 칸은 없음(exists=false) */
export function salMatrix(d) {
  const t = (d.tracks && d.tracks[0]) || { id: 'standard', cellsHourly: {} }; const cols = SAL_POSITIONS.map((pos) => ({ pos, years: Math.max(1, Number(d.tenure && d.tenure[pos]) || 1) })); const max = Math.max.apply(null, cols.map((c) => c.years)); const rows = [];
  for (let step = 1; step <= max; step++) rows.push({ step, cells: cols.map((c) => { if (step > c.years) return { exists: false }; const key = c.pos + '-' + step; const hourly = Number(t.cellsHourly && t.cellsHourly[key]) || 0; return { exists: true, tid: t.id, key, hourly, annual: salAnnual(hourly), pinned: !!(t.pinned && key === '사원-1'), below: hourly > 0 && hourly < (Number(d.minWage) || 0) }; }) });
  return { cols, rows };
}
/** 표 줄(직급·호봉)과 칸(시급·연봉·최저임금 미달 여부) */
export function salRows(d) { const out = []; SAL_POSITIONS.forEach((pos, pi) => { const years = Math.max(1, Number(d.tenure && d.tenure[pos]) || 1); for (let step = 1; step <= years; step++) { const key = pos + '-' + step; out.push({ pos, step, key, band: pi % 2, cells: d.tracks.map((t) => { const hourly = Number(t.cellsHourly && t.cellsHourly[key]) || 0; return { tid: t.id, hourly, annual: salAnnual(hourly), pinned: !!(t.pinned && key === '사원-1'), below: hourly > 0 && hourly < (Number(d.minWage) || 0) }; }) }); } }); return out; }
