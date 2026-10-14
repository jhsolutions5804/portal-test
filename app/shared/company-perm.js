/* 회사 영역 사용 권한 — 회사 모듈과 공용 틀(옛 모듈 어댑터) 정의가 같은 판단을 쓴다(GUEST 계정은 연락처·내부 규정이 있어 제외). 순수 함수 */
export const companyPerm = (me) => !!me && !me.isGuest;
