/* 재무회계 사용 권한 — 재무회계 모듈과 공용 틀(옛 모듈 어댑터) 정의가 같은 판단을 쓴다. 순수 함수 */
export const financePerm = (me) => !!me && !me.isGuest && (me.admin === true || me.dept === '재무회계팀' || !!(me.perms && me.perms.finance === true));
