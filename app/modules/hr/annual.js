/* 연봉계약서 — 구포털(hr) 연봉계약서 작성·조회 규칙을 옮겼다(순수 함수, 화면·네트워크 없음).
 * 저장: annual_contracts/{근로자}/contracts/{계약일 YYYYMMDD} — 같은 계약일은 덮어쓴다. 출력은 동결 양식(frozen-docs.js)으로, 저장 당시 양식 버전(tplVer)으로만 그린다.
 * 급여 입력은 시급·월급(월 지급계)·연봉 중 하나로 하고, 월급·연봉은 시급으로 역산해 계산한다(시급 = 월 지급계 ÷ 208.56시간, 소수 그대로 — 연봉계약서·제안서와 같은 산식). */
import { annualSalary } from './offer.js?v=20261031f';
import { CONTRACT_V7, v7Calc, periodEndOf, periodTypeOf } from './contract-v7.js?v=20261031f';
export const PAY_BASIS_LABELS = { hourly: '시급', monthly: '월급', annual: '연봉' };
export const PAY_MONTH_FACTOR = 8 * 5 * 4.345 + 8 * 4.345;
/** 계약서에 찍는 주민번호는 마스킹 값(앞 6자리-성별 자리******)만 — 전체 번호는 서버에만 있다. 옛 평문(jumin)이 남아 있어도 마스킹해서 쓴다 */
export const contractJumin = (w) => { if (w && w.juminMasked) return w.juminMasked; const s = String((w && w.jumin) || '').replace(/\D/g, ''); return s.length >= 7 ? s.slice(0, 6) + '-' + s[6] + '******' : ''; };
const pad = (n) => String(n).padStart(2, '0');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const ymdLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
/** 시작일 + 1년 − 1일 (2/29 시작은 다음 해 2/28 → 2/27 이 아니라 다음 해 같은 날의 하루 전) */
export function annualEnd(start) { if (!isDate(start)) return ''; const [y, m, d] = start.split('-').map(Number); const e = new Date(y + 1, m - 1, d); e.setDate(e.getDate() - 1); return ymdLocal(e); }
export function annualNewForm(today) { const t = today || ymdLocal(new Date()); return { workerId: '', name: '', jumin: '', address: '', dept: '', rank: '', empType: 'field', startDate: t, endDate: annualEnd(t), contractDate: '', hourly: '', salary: '', signData: null, payBasis: 'hourly', payInput: '', wageType: 'noncomprehensive', fixedOT: '', fixedNight: '', fixedOTHours: '', fixedNightHours: '', contractType: '', periodType: 'range', projectId: '', projectName: '', expectedEnd: '', workPlace: '', extraItems: [], specialTerms: '' }; }
export function payToHourly(basis, value) { const v = Number(value || 0); if (!(v > 0)) return 0; if (basis === 'monthly') return v / PAY_MONTH_FACTOR; if (basis === 'annual') return v / 12 / PAY_MONTH_FACTOR; return v; }
/** 급여 기준을 바꿀 때: 시급은 그대로 두고 새 기준의 표시값만 현재 시급으로 채운다 */
export function payBasisChange(f, basis) { if ((f.payBasis || 'hourly') === basis) return f; const sal = annualSalary(Number(f.hourly || 0)); return Object.assign({}, f, { payBasis: basis, payInput: basis === 'monthly' ? (sal.total || '') : basis === 'annual' ? (sal.annual || '') : '' }); }
/** 급여 값을 입력할 때(숫자만) */
export function payValueInput(f, value) { const v = String(value == null ? '' : value).replace(/[^0-9.]/g, ''); const basis = f.payBasis || 'hourly'; const o = Object.assign({}, f); if (basis === 'hourly') { o.hourly = v; o.payInput = ''; } else { o.payInput = v; o.hourly = payToHourly(basis, v) || ''; } return o; }
/** 월급·연봉 입력의 환산 안내: 환산 시급, 실제 월 지급계/계약연봉, 입력과의 차이 */
export function payConv(f) { const basis = f.payBasis || 'hourly'; const h = Number(f.hourly || 0); if (basis === 'hourly' || !h) return null; const sal = annualSalary(h); const actual = basis === 'monthly' ? sal.total : sal.annual; return { basis, hourly: h, actual, diff: Math.round(actual - Number(f.payInput || 0)) }; }
/** 근로자 선택: 인적사항을 채우고, 급여는 비운 뒤 최근 근로계약서(계약일 기준)의 시급·급여 기준을 이어받는다 */
export function annualFillFromWorker(f, w, laborContracts) {
  const o = Object.assign({}, f, { workerId: w.id, name: w.name || '', jumin: contractJumin(w), address: w.address || '', dept: w.dept || '', rank: w.rank || '', empType: w.empType || 'field', hourly: '', payBasis: 'hourly', payInput: '', salary: '', wageType: 'noncomprehensive', fixedOT: '', fixedNight: '', fixedOTHours: '', fixedNightHours: '', contractType: '', periodType: 'range', projectId: '', projectName: '', expectedEnd: '', workPlace: '', extraItems: [], specialTerms: '' });
  let latest = ''; (laborContracts || []).forEach((dd) => { if ((dd.contractDate || '') > latest) { latest = dd.contractDate || ''; if (dd.hourly) { o.hourly = dd.hourly; const pb = dd.payBasis, pi = Number(dd.payInput || 0); o.payBasis = (pb === 'monthly' || pb === 'annual') && pi ? pb : 'hourly'; o.payInput = o.payBasis === 'hourly' ? '' : pi; } if (dd.salary) o.salary = dd.salary; if (dd.contractType === 'regular' || dd.contractType === 'fixed') o.contractType = dd.contractType; } }); return o;
}
export const annualContractId = (contractDate) => String(contractDate || '').replace(/-/g, '');
/** 저장 전 검사. requirePeriod=true 면 계약기간(시작일·종료일)도 필수 — 근로계약서는 계약기간이 필수 명시사항이라 비우면 저장하지 못한다(2026-10-13 대표님 결정; 구포털은 비워도 저장됐음) */
export function annualValidate(f, requirePeriod) { const errors = []; if (!f.workerId) errors.push('근로자를 선택해 주세요.'); if (!isDate(f.contractDate)) errors.push('계약일자를 입력해 주세요.'); if (requirePeriod) { if (!isDate(f.startDate) || !isDate(f.endDate)) errors.push('계약기간(시작일·종료일)을 입력해 주세요.'); else if (f.endDate < f.startDate) errors.push('계약 종료일이 시작일보다 빠릅니다.'); } return { ok: !errors.length, errors }; }
/** 저장 문서(구포털과 같은 필드 + 저장 시각·양식 버전). 계약연봉은 시급으로 다시 계산해 넣는다 */
export function annualRecord(f, now) { const c = v7Calc(f); const clean = (f.workType === 'short') ? {} : { endDate: periodEndOf(f), periodType: periodTypeOf(f), extraItems: c.extras, fixedOT: f.wageType === 'comprehensive' ? c.fixedOT : '', fixedNight: f.wageType === 'comprehensive' ? c.fixedNight : '', monthlyTotal: c.total, ordinaryHourly: Math.round(c.ordinaryHourly * 100) / 100 }; return Object.assign({}, f, clean, { salary: c.annual, savedAt: now || new Date().toISOString(), savedBy: 'admin', tplVer: CONTRACT_V7 }); }   // v7: 계약연봉에 고정연장·야간·추가 지급 항목까지 합산(표의 합계 × 12), 종료일은 기간 지정일 때만
/** 근로자별 최신 계약 정보 → 목록의 상태 칸 */
export function annualStatus(info, today) { const c = info || {}; const e = c.endDate || ''; if (!e && (c.period === 'open' || c.period === 'project')) return { key: 'valid', text: c.period === 'open' ? '✅ 기간의 정함 없음' : '✅ 프로젝트 종료 시' }; if (e) return e < today ? { key: 'expired', text: '⚠️ 만료' } : { key: 'valid', text: '✅ ' + e.replace(/-/g, '.') }; return c.cnt ? { key: 'check', text: '확인필요' } : { key: 'none', text: '미작성' }; }
export function annualSummary(docs) { let lE = '', lC = '', lp = ''; (docs || []).forEach((c) => { const e = c.endDate || '', cd = c.contractDate || ''; if (e > lE) lE = e; if (cd >= lC) { lC = cd; lp = (c.periodType === 'open' || c.periodType === 'project') ? c.periodType : ''; } }); /* 가장 최근 계약이 종료일 없는 계약(정함 없음·프로젝트 종료 시)이면 그 방식을 상태로 쓴다 */ return { endDate: lp ? '' : lE, contractDate: lC, cnt: (docs || []).length, period: lp }; }
export const annualSorted = (docs) => (docs || []).slice().sort((a, b) => String(b.contractDate || b.id).localeCompare(String(a.contractDate || a.id)));
