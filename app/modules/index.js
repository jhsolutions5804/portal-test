/* 플랫폼에 꽂는 모듈 목록 — 모듈을 더하거나 빼는 일은 이 파일 한 곳만 고친다.
 * 각 항목은 { manifest, mount }. 핵심부(core/)는 모듈 폴더를 직접 알지 못하고 이 목록만 읽는다. */
import * as edoc from './edoc/index.js?v=20261013k';
import * as attendance from './attendance/index.js?v=20261013k';
import * as calendar from './calendar/index.js?v=20261013k';
import * as company from './company/index.js?v=20261013k';
import * as finance from './finance/index.js?v=20261013k';
import * as general from './general/index.js?v=20261013k';
import * as hr from './hr/index.js?v=20261013k';
import { modules as legacy, hostNative } from './legacy/index.js?v=20261013k';

export const MODULES = [
  { manifest: edoc.manifest, mount: edoc.mount },
  { manifest: attendance.manifest, mount: attendance.mount },
  { manifest: calendar.manifest, mount: calendar.mount },
  { manifest: company.manifest, mount: company.mount },
  { manifest: finance.manifest, mount: finance.mount }
].concat(legacy);   // 옛 모듈(기획·인사·PJT·내 팀 공수표)은 어댑터로 입주 — 새 모듈로 바뀌면 이 줄에서 빠지고 위 목록으로 옮긴다
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
hostNative('hr', 'annualc', hr.mountAnnual);   // 연봉계약서 새 화면(원격 서명 링크·QR·메일만 기존 '연봉계약서'에서)
hostNative('hr', 'laborc', hr.mountLabor);   // 근로계약서 새 화면(원격 서명 링크·QR·메일만 기존 '근로계약서'에서)
hostNative('hr', 'leavepromo', hr.mountLeavePromo);   // 연차사용촉진 새 화면
hostNative('hr', 'home', hr.mountHome);   // 인사 홈 새 화면(요약 카드·인사 캘린더·서명/도장 관리)
