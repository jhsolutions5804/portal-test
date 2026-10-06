/* 자동 로그아웃의 순수 판정(화면·저장소 없음) — 단위 시험이 이 파일을 직접 불러온다. */
export const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;   // 2시간 무동작(대표님 결정 2026-10-06, 처음 안은 30분)
export const IDLE_WARN_MS = 60 * 1000;

/** 순수 판정: idle = now - last. limit 이상이면 만료, limit - warn 이상이면 경고, 아니면 활동 중 */
export function idleStatus(now, last, limit, warn) {
  const idle = now - last;
  if (idle >= limit) return { state: 'expired', remainMs: 0 };
  if (idle >= limit - warn) return { state: 'warn', remainMs: limit - idle };
  return { state: 'active', remainMs: limit - idle };
}
/** 시계·저장소·알림을 주입받는 감시기 — 화면 없이 시험한다. tick() 은 1초마다(또는 창이 다시 보일 때) 부른다 */
export function createIdleWatch(o) {
  let state = 'active'; let stopped = false;
  const touch = () => {
    if (stopped) return; const t = o.now();
    if (state === 'warn' || t - o.getLast() >= 1000) o.setLast(t);   // 평소에는 1초에 한 번만 기록(마우스 이동마다 쓰지 않음)
    if (state === 'warn') { state = 'active'; o.onActive(); }
  };
  const tick = () => {
    if (stopped) return state; const s = idleStatus(o.now(), o.getLast(), o.limitMs, o.warnMs);
    if (s.state === 'expired') { stopped = true; o.onExpire(); return 'expired'; }
    if (s.state === 'warn') { state = 'warn'; o.onWarn(s.remainMs); } else if (state === 'warn') { state = 'active'; o.onActive(); }
    return s.state;
  };
  return { touch, tick, stop() { stopped = true; }, get state() { return state; } };
}
/** 시간 길이를 사람이 읽는 말로: 7200000 → "2시간", 1800000 → "30분", 9000 → "9초" */
export function durationText(ms) {
  if (ms >= 3600000 && ms % 3600000 === 0) return (ms / 3600000) + '시간';
  if (ms >= 60000 && ms % 60000 === 0) return (ms / 60000) + '분';
  return Math.max(1, Math.round(ms / 1000)) + '초';
}
