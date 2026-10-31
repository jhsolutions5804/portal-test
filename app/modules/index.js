/* 플랫폼에 꽂는 모듈 목록 — 모듈을 더하거나 빼는 일은 이 파일 한 곳만 고친다.
 * 각 항목은 { manifest, mount }. 핵심부(core/)는 모듈 폴더를 직접 알지 못하고 이 목록만 읽는다. */
import * as edoc from './edoc/index.js?v=20261031c';
import * as attendance from './attendance/index.js?v=20261031c';
import * as calendar from './calendar/index.js?v=20261031c';
import * as company from './company/index.js?v=20261031c';
import * as evalm from './eval/index.js?v=20261031c';
import * as finance from './finance/index.js?v=20261031c';
import * as plan from './plan/index.js?v=20261031c';
import * as general from './general/index.js?v=20261031c';
import * as hr from './hr/index.js?v=20261031c';
import * as pjt from './pjt/index.js?v=20261031c';
import { modules as legacy, hostNative } from './legacy/index.js?v=20261031c';

export const MODULES = [
  { manifest: edoc.manifest, mount: edoc.mount },
  { manifest: attendance.manifest, mount: attendance.mount },
  { manifest: calendar.manifest, mount: calendar.mount },
].concat(legacy);   // 옛 모듈(기획·인사·PJT·내 팀 공수표)은 어댑터로 입주 — 새 모듈로 바뀌면 이 줄에서 빠지고 위 목록으로 옮긴다
['home', 'entries', 'expense', 'import', 'reports', 'monthly', 'forecast', 'gap', 'rules', 'opening', 'settings', 'pjt'].forEach((k) => hostNative('finance', k, (root, route, ctx) => finance.mount(root, { segs: [k], query: (route && route.query) || {} }, ctx)));   // 재무회계: 인사총무와 같은 공용 틀(사이드바·내용 영역) 안의 새 화면
['org', 'rules', 'staff', 'alog'].forEach((k) => hostNative('company', k, (root, route, ctx) => company.mount(root, { segs: [k].concat((route && route.segs) || []), query: (route && route.query) || {} }, ctx)));   // 회사: 인사총무와 같은 공용 틀(사이드바·내용 영역) 안의 새 화면
// 평가 결과 통보(result)의 발송 기능은 인사 모듈의 기존 "본인 확인 링크" 흐름을 쓴다 — 평가 모듈이 인사 모듈을 직접 가져오지 않도록 여기서 한 번만 연결해 주입한다.
const resultExtra = {   // 메일 발송은 본섭에서만(테섭은 시험 중 실제 직원에게 메일이 나가지 않게 꺼 둠) — 테섭 여부는 평가 모듈(ops.js)이 판단한다
  sendResult: ({ workerId, workerName, html, title, year }) => hr.sendDocLinkByEmail({ kind: 'worker', id: workerId, toName: workerName, docLabel: title, linkParams: { docType: 'evalresult', viewOnly: true, workerId, contractId: String(year), html, title } }),
  makeResultLink: (x) => hr.createResultLink(x), showLink: (token, name) => hr.showLinkModal(token, name, { view: true, label: '평가 결과 통보서' }) };
['mine', 'cycle', 'adhoc', 'result'].forEach((k) => hostNative('eval', k, (root, route, ctx) => evalm.mount(root, { segs: [k].concat((route && route.segs) || []), query: (route && route.query) || {} }, ctx, k === 'result' ? resultExtra : undefined)));   // 평가(내 평가·정기평가 운영·수시평가·평가 결과 통보) — 인사 모듈에서 분리
hostNative('pjt', 'roster', pjt.mountRoster);   // 근로자 연명부(새 화면 — 목록·상세 조회)
hostNative('pjt', 'settings', pjt.mountSettings);   // PJT 새 모듈 — 설정(관리자 전용)
hostNative('myteam', 'main', pjt.mountTeam);   // 내 팀 공수표 — 새 화면(통일된 저장 구조만 읽음)
hostNative('pjt', 'ended', pjt.mountEnded);   // PJT 새 모듈 — 종료 PJT(재개·완전삭제)
hostNative('pjt', 'home', pjt.mountHome);   // PJT 새 모듈 — 프로젝트 홈(프로젝트를 고르면 처음 보이는 화면)
hostNative('pjt', 'report', pjt.mountReport);   // PJT 새 모듈 — 공사일보(프로젝트 아래 탭)
hostNative('pjt', 'schedule', pjt.mountSchedule);   // PJT 새 모듈 — 일정(프로젝트 아래 탭)
hostNative('pjt', 'monthly', pjt.mountMonthly);   // PJT 새 모듈 — 월간 보고서(현장 층, 프로젝트 아래 탭, 서버 함수 monthlyReportAct 만 사용)
hostNative('pjt', 'log', pjt.mountLog);   // PJT 새 모듈 — 이력: 변경·결정·요청 로그(프로젝트 아래 탭, 서버 함수 pjtLogAct 만 사용)
hostNative('pjt', 'progress', pjt.mountProgress);   // PJT 새 모듈 — 공정(프로젝트 아래 탭)
hostNative('pjt', 'attend', pjt.mountAttend);   // PJT 새 모듈의 첫 화면 — 출역·공수(구포털 PJT 메뉴 안에서 열린다)
hostNative('plan', 'home', plan.mountHome);   // 영업기획 홈 새 화면
hostNative('plan', 'acct', plan.mountAcct);   // 비용장부 대조(재무회계 이관) 새 화면
hostNative('plan', 'closing', plan.mountClosing);   // 월말 마감(신규)
hostNative('plan', 'monthly', plan.mountMonthlyMgmt);   // 월간 보고서(경영 층 — 그 달 청구·완결·원가·마진율·노무 수율, 서버 마진 집계를 그 달까지·전달까지 두 번 불러 차이, 저장 없음)
hostNative('plan', 'projects', plan.mountProjects);   // 프로젝트(허브) 새 화면
hostNative('plan', 'billing', plan.mountBilling);   // 청구·수금 새 화면(정산서 중 대금청구서)
hostNative('plan', 'payout', plan.mountPayout);   // 지급·정산 새 화면(정산서 중 지급예정서)
hostNative('plan', 'teamlabor', plan.mountTeamLabor);   // 팀별 노무비 새 화면
hostNative('plan', 'est', plan.mountEstimates);   // 견적 새 화면(개정 이력·비교)
hostNative('plan', 'comp', plan.mountCompanies);   // 거래처 새 화면 — 구포털 기획을 탭 하나씩 옮기는 중
hostNative('plan', 'partners', plan.mountPartners);   // 협력사(지급 대상) 새 화면
hostNative('plan', 'contracts', plan.mountContracts);   // 협력사 위탁(하도급) 계약서(신규)
hostNative('hr', 'general', general.mountSection);   // 총무는 사이드바에 따로 두지 않고 인사총무 안의 구역으로 연다
hostNative('hr', 'workers', hr.mountWorkers);   // 근로자 명부 새 화면 — 구포털 인사 화면을 탭 하나씩 옮기는 중(옮기는 동안 기존 화면도 그대로 쓸 수 있다)
hostNative('hr', 'leaves', hr.mountLeaves);   // 연차 현황 새 화면
hostNative('hr', 'change', hr.mountChange);   // 인사 변동 새 화면
hostNative('hr', 'postings', hr.mountPostings);   // 공고 관리 새 화면
hostNative('hr', 'interviews', hr.mountInterviews);   // 근로자 면담 새 화면
hostNative('hr', 'resignreqs', hr.mountResignReq);   // 휴직/퇴직 원서 새 화면
hostNative('hr', 'hrcal', hr.mountCalendar);   // 인사 캘린더 새 화면(구포털의 hrcal 탭 키를 그대로 씀 — 일정·캘린더 링크가 새 화면으로 열린다)
hostNative('hr', 'evals', hr.mountEvals);   // 인사평가 새 화면
hostNative('hr', 'applicants', hr.mountApplicants);   // 채용 지원자 새 화면(구포털 탭 키 그대로 — 지원자 링크가 새 화면으로 열린다)
hostNative('hr', 'salarytable', hr.mountSalary);   // 급여테이블 새 화면(구포털 탭 키 그대로)
hostNative('hr', 'offers', hr.mountOffers);   // 연봉 제안서 새 화면(이메일 발송만 기존 '연봉 제안서' 화면에서)
hostNative('hr', 'retire', hr.mountRetire);   // 퇴직금 정산 새 화면(구포털 탭 키 그대로 — 휴직/퇴직 원서의 '퇴직금 정산으로'가 새 화면으로 열린다)
hostNative('hr', 'dismissal', hr.mountDismissal);   // 해고예고통지서 새 화면(구포털 탭 키 그대로)
hostNative('hr', 'overtimes', hr.mountOvertime);   // 초과근로 현황 새 화면(근로시간 1단계 — 전자결재 자동연동 포함)
hostNative('hr', 'attendcal', hr.mountAttendCal);   // 출퇴근 달력 새 화면(근로시간 2단계)
hostNative('hr', 'payslips', hr.mountPayslip);   // 급여명세서 새 화면(메일 발송·링크/QR 만 기존 '급여명세서'에서)
hostNative('hr', 'ledger', hr.mountLedger); // 임금대장·급여 마감(근로기준법 제48조, 대기열 1-3-16 ①)
hostNative('hr', 'insurance', hr.mountInsurance); // 4대보험 월별 대조(대기열 1-3-17 1단계)
hostNative('hr', 'annualc', hr.mountAnnual);   // 연봉계약서 새 화면(원격 서명 링크·QR·메일만 기존 '연봉계약서'에서)
hostNative('hr', 'laborc', hr.mountLabor);   // 근로계약서 새 화면(원격 서명 링크·QR·메일만 기존 '근로계약서'에서)
hostNative('hr', 'leavepromo', hr.mountLeavePromo);   // 연차사용촉진 새 화면
hostNative('hr', 'home', hr.mountHome);   // 인사 홈 새 화면(요약 카드·인사 캘린더·서명/도장 관리)

/** 셸에 붙는 보조 패널들을 설치한다(로그인 뒤 boot.js 가 한 번 부름) — 돌려주는 함수로 정리한다. 지금은 PJT 자료 패널(SharePoint 파일 패널) 하나. 화면(작업 탭)이 아니라 셸에 붙으므로 화면이 다시 만들어지든 말든 사라지지 않는다. 실패해도 셸은 그대로 둔다. */
export function installShellDocks(shell, me) {
  const offs = []; try { const d = shell && shell.dock ? pjt.installFilesDock(shell.dock, me) : null; if (d) offs.push(d.dispose); } catch (e) { console.warn('[자료 패널] 설치하지 못함', (e && e.message) || e); }
  return () => offs.forEach((f) => { try { f(); } catch (e) { /* 정리 실패는 무시 */ } });
}
