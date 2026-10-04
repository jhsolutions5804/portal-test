/* 출퇴근 기록 한 줄의 화면용 모양 — 전자결재·출퇴근 모듈이 함께 쓴다(모듈끼리 직접 참조하지 않기 위해 공용으로 둔다) */
import { BREAK_MINUTES } from './worktime.js?v=20261005a';

export function toMs(v) {
  if (v == null || v === '') return 0; if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis(); if (typeof v.seconds === 'number') return v.seconds * 1000;
  const t = Date.parse(v); return isNaN(t) ? 0 : t;
}
/** 파이어스토어 문서 → 화면용 기록 */
export function recordOf(id, d) {
  const x = d || {};
  return { id, date: x.date || '', checkIn: x.checkIn || '', checkOut: x.checkOut || '', breakMinutes: x.breakMinutes == null ? BREAK_MINUTES : Number(x.breakMinutes), workHours: Number(x.workHours) || 0, source: x.source || '', checkInAtMs: toMs(x.checkInAt), name: x.name || '' };
}
