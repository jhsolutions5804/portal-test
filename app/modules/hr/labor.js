/* 근로계약서 — 구포털(hr) 근로계약서 작성·조회 규칙을 옮겼다(순수 함수). 연봉계약서(annual.js)와 같은 틀이고 다른 점만 둔다:
 * 계약기간은 시작일·종료일을 직접 입력(자동 1년 아님), 담당업무·연락처를 받고, 임금 지급 방식(포괄/비포괄)은 근로계약서에 없다.
 * 저장: labor_contracts/{근로자}/contracts/{계약일 YYYYMMDD}. 출력은 동결 양식(근로계약서 v0~v5, v4부터 개인정보 제3자 제공 동의서(별지) 자동 첨부)으로, 저장 당시 양식으로만 그린다. */
import { annualSalary } from './offer.js?v=20261031f';
import { contractJumin } from './annual.js?v=20261031f';
import { CONTRACT_V7, v7Calc, periodEndOf, periodTypeOf } from './contract-v7.js?v=20261031f';
export const laborNewForm = () => ({ workerId: '', name: '', jumin: '', phone: '', address: '', dept: '', rank: '', job: '', empType: 'field', startDate: '', endDate: '', contractDate: '', hourly: '', salary: '', signData: null, payBasis: 'hourly', payInput: '', contractType: '', periodType: 'range', projectId: '', projectName: '', expectedEnd: '', workPlace: '', assignedTo: '' });
/** 근로자 선택: 인적사항·직무만 채운다(급여 입력은 건드리지 않음 — 구포털과 같음) */
export const laborFillFromWorker = (f, w) => Object.assign({}, f, { workerId: w.id, name: w.name || '', jumin: contractJumin(w), phone: w.phone || '', address: w.address || '', dept: w.dept || '', rank: w.rank || '', job: w.job || '', empType: w.empType || 'field' });
/** 저장 문서: 계약연봉은 시급으로 다시 계산해 넣고 저장 시각·저장자·양식 버전을 붙인다 */
export const laborRecord = (f, now) => Object.assign({}, f, { endDate: periodEndOf(f), periodType: periodTypeOf(f), salary: annualSalary(Number(f.hourly || 0)).annual, savedAt: now || new Date().toISOString(), savedBy: 'admin', tplVer: CONTRACT_V7 });   // v7: 정규직/계약직·계약기간 방식·근무지(종료일은 기간 지정일 때만)
