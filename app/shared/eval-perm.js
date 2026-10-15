/* 평가 메뉴 접근 판정 — 공용 틀(legacy/list.js)·평가 모듈·인사평가 규칙이 같은 기준을 쓰도록 shared 에 둔다(설계서 docs/hr-evaluation-design.md 9-1절).
 * 메뉴를 인사 모듈에서 분리한 이유: 인사 모듈은 모듈 전체가 관리자 전용이고 화면 단위 권한이 없어, 비관리자(인사총무팀 일부)에게 열면 급여·계약서·주민번호 화면이 주소로 열릴 수 있다.
 *   - 내 평가(mine): 로그인한 정직원(GUEST 제외) 누구나 — 본인에게 배정된 과제만 보인다(데이터는 보안 규칙이 막는다)
 *   - 평가 운영(ops): 사장단(대표·부사장 직급) · 관리자 · 직원 관리에서 "인사평가" 권한을 받은 사람(인사총무팀) */
const EXEC = ['대표', '부사장'];
export const isEvalOps = (me) => !!me && !me.isGuest && (me.admin === true || EXEC.indexOf(String(me.rank || '').trim()) !== -1 || !!(me.perms && me.perms.hrEval === true));
export const isEvalUser = (me) => !!me && !me.isGuest;
/** 평가 회차 관리(시작·마감·공개·과제 배정·집계)를 할 수 있는 사장단 3명의 계정 식별자(uid). 보안 규칙(isCycleManager)·서버(functions/eval-act.js)와 같은 목록이어야 하며 tests/eval-managers.test.mjs 가 대조한다.
 *  직급·이름은 직원 관리에서 바뀌는 값이라 쓰지 않는다. 목록을 바꾸려면 규칙 게시·서버 배포·이 파일을 함께 고쳐야 한다. */
export const CYCLE_MANAGERS = [
  { uid: '202TPNudKZghsTPAeeG206f8vbJ3', name: '송지훈' },   // 대표
  { uid: '8KuOuhqirGWmrYKw8eOCPnqtYBr2', name: '김종화' },   // 부사장
  { uid: 'muButMmunGX91id0HmHZVBMDq6B3', name: '김영희' },   // 부사장
];
/** 평가 회차 관리(시작·마감·공개·과제 배정·집계): 사장단 3명의 계정(CYCLE_MANAGERS)이면서 관리자 계정이어야 한다.
 *  - 보안 규칙(eval_cycles 쓰기)은 isAdmin()(관리자 계정)만 확인하므로, 화면이 관리자 계정을 요구하지 않으면 "버튼은 켜졌는데 저장이 거부"된다.
 *  - 직급만으로는 인사팀 관리자(대리급)가 빠지지만, 직급은 직원 관리에서 바뀔 수 있는 값이라 보안 경계가 아니다 → 규칙 쪽을 사장단 이메일 목록으로 좁히는 것은 대표님 결정 사항(docs/hr-evaluation-design.md 9-1). */
export const canManageCycle = (me) => !!me && !me.isGuest && me.admin === true && !!me.uid && CYCLE_MANAGERS.some((m) => m.uid === me.uid);
/** 로그인 사용자(me)에 canManage(사장단 계정 여부)를 붙여 evalAccess 에 넘긴다 — 순수 규칙 모듈(evaluation.js)이 계정 목록을 알 필요 없게 한다 */
export const withManage = (me) => Object.assign({}, me || {}, { canManage: canManageCycle(me) });
