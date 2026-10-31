/* 캡스(ADT캡스 액세스가드) 근태 파일 → 포털 근태 기록(worker_attendance_log) — 화면·네트워크 없는 순수 함수(시험: tests/hr-caps-import.test.mjs). 대기열 1-3-25.
 * 규칙(대표님 확정): ①캡스 값 우선 ②캡스에 비어 있는 칸(출근만·퇴근만 찍힌 날)은 포털 기록으로 보충, 포털에도 없으면 확인 필요 ③직원은 이름으로 매칭(같은 이름의 캡스 ID 여러 개는 한 명으로 병합,
 * 포털에 없거나 동명이인이면 반영하지 않고 목록으로 표시) ④반영 전 미리보기. 저장 모양은 관리자 입력과 같다(buildAttRecord).
 * 파일에서 확인한 읽기 규칙: 시각은 H:MM·HH:MM(·HH:MM:SS) 혼재, 퇴근 칸의 "+HH:MM" 은 다음 날 퇴근(야간 근무) — 포털은 시작한 날짜 하나에 checkIn·checkOut(출근보다 이르거나 같으면 익일)로 저장한다.
 * 캡스의 기본·연장·총합·인정 칸과 근무일명칭은 쓰지 않는다(근무시간은 포털 규칙으로 다시 계산). */
import { buildAttRecord, attKey } from './attendance.js?v=20261031f';
export const CAPS_TOL_MIN = 10; // 이 이내 차이는 같은 값으로 본다
const pad2 = (n) => String(n).padStart(2, '0');
const isoOk = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
/** 캡스 시각 한 칸 → { hhmm, min, next } | null(빈 칸) | { bad }(읽을 수 없음). 숫자(엑셀 시간 값 0~1)도 받는다 */
export function parseCapsTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { if (!(v >= 0 && v < 1)) return { bad: String(v) }; const mn = Math.round(v * 1440) % 1440; return { hhmm: pad2(Math.floor(mn / 60)) + ':' + pad2(mn % 60), min: mn, next: false }; }
  const s = String(v).trim(); if (!s) return null; const m = /^(\+?)(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s); if (!m) return { bad: s };
  const h = Number(m[2]), mi = Number(m[3]); if (h > 23 || mi > 59) return { bad: s }; return { hhmm: pad2(h) + ':' + pad2(mi), min: h * 60 + mi, next: m[1] === '+' };
}
/** 캡스 날짜 한 칸("2026/01/05"·"2026-01-05"·엑셀 날짜 번호) → "YYYY-MM-DD" | '' */
export function parseCapsDate(v) {
  if (typeof v === 'number') { if (!(v > 20000 && v < 80000)) return ''; return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10); }
  const m = /^\s*(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})\s*$/.exec(String(v == null ? '' : v)); if (!m) return ''; const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]); return isoOk(y, mo, d) ? y + '-' + pad2(mo) + '-' + pad2(d) : '';
}
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const later = (a, b) => (a.min + (a.next ? 1440 : 0)) >= (b.min + (b.next ? 1440 : 0)) ? a : b;
/** 시트 줄(2차원 배열) → 기록 목록. 머리줄은 위쪽 15줄 안에서 이름·근무일자·출근·퇴근 칸으로 찾는다 */
export function parseCapsRows(rows) {
  const R = Array.isArray(rows) ? rows : []; let hi = -1, col = {};
  for (let i = 0; i < Math.min(R.length, 15) && hi < 0; i++) { const cells = (R[i] || []).map(norm); const ix = (n) => cells.indexOf(n); if (ix('이름') >= 0 && ix('근무일자') >= 0 && ix('출근') >= 0 && ix('퇴근') >= 0) { hi = i; col = { name: ix('이름'), date: ix('근무일자'), in: ix('출근'), out: ix('퇴근'), id: ix('사용자ID') }; } }
  if (hi < 0) return { ok: false, error: '캡스 근태 파일 형식이 아닙니다 — 이름·근무일자·출근·퇴근 칸을 찾지 못했습니다. ACServer 근태조회에서 엑셀로 내보낸 파일인지 확인해 주세요.', records: [], problems: [] };
  const byKey = new Map(); const problems = []; const ids = new Set(); const names = new Set(); let dataRows = 0, mergedIds = 0;
  for (let i = hi + 1; i < R.length; i++) {
    const r = R[i] || []; const name = norm(r[col.name]); const dateRaw = r[col.date]; if (!name && (dateRaw == null || dateRaw === '')) continue; if (!name) { problems.push({ row: i + 1, reason: '이름이 비어 있습니다.' }); continue; }
    dataRows++; names.add(name); const date = parseCapsDate(dateRaw); if (!date) { problems.push({ row: i + 1, name, reason: '근무일자를 읽지 못했습니다(' + norm(dateRaw) + ').' }); continue; }
    const pin = parseCapsTime(r[col.in]), pout = parseCapsTime(r[col.out]); const capsId = col.id >= 0 ? norm(r[col.id]) : ''; if (capsId) ids.add(capsId);
    if ((pin && pin.bad) || (pout && pout.bad)) { problems.push({ row: i + 1, name, date, reason: '출퇴근 시각을 읽지 못했습니다(' + norm((pin && pin.bad) || (pout && pout.bad)) + ').' }); continue; }
    if (pin && pin.next) { problems.push({ row: i + 1, name, date, reason: '출근 칸에 다음 날 표시(+)가 있습니다.' }); continue; }
    if (!pin && !pout) continue;
    const key = name + '|' + date; const ex = byKey.get(key);
    if (!ex) byKey.set(key, { name, date, capsId, in: pin, out: pout, row: i + 1 });
    else { if (capsId && ex.capsId !== capsId) mergedIds++; if (pin && (!ex.in || pin.min < ex.in.min)) ex.in = pin; if (pout && (!ex.out || later(pout, ex.out) === pout)) ex.out = pout; }
  }
  const records = [...byKey.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); const dates = records.map((x) => x.date).sort();
  return { ok: true, error: '', records, problems, stats: { dataRows, records: records.length, ids: ids.size, names: names.size, mergedIds, from: dates[0] || '', to: dates[dates.length - 1] || '' } };
}
/** 이름으로 근로자 매칭 — { byName: Map(이름→근로자), unmatched: [이름], duplicated: [이름] } */
export function matchCapsWorkers(records, workers) {
  const idx = new Map(); (workers || []).forEach((w) => { const k = norm(w && w.name); if (!k) return; (idx.get(k) || idx.set(k, []).get(k)).push(w); });
  const byName = new Map(), unmatched = [], duplicated = []; [...new Set((records || []).map((r) => r.name))].forEach((n) => { const l = idx.get(n); if (!l) unmatched.push(n); else if (l.length > 1) duplicated.push(n); else byName.set(n, l[0]); });
  return { byName, unmatched, duplicated };
}
/** 반영에 필요한 달(YYYY-MM) 목록 — from~to 사이 */
export function capsMonths(from, to) { const out = []; if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || from > to) return out; let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)); const ey = Number(to.slice(0, 4)), em = Number(to.slice(5, 7)); while (y < ey || (y === ey && m <= em)) { out.push(y + '-' + pad2(m)); m++; if (m > 12) { m = 1; y++; } } return out; }
const hmin = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const near = (a, b) => { const x = hmin(a), y = hmin(b); if (x == null || y == null) return false; const d = Math.abs(x - y); return Math.min(d, 1440 - d) <= CAPS_TOL_MIN; };
/** 반영 계획 — existing 은 { 문서키 → 포털 근태 문서 }. 기간(from~to)·오늘 이후는 제외. status: 신규·변경·보충·동일·확인 */
export function buildCapsPlan({ records, workers, existing, from, to, today }) {
  const { byName, unmatched, duplicated } = matchCapsWorkers(records, workers); const items = []; const skipped = { 기간밖: 0, 미매칭: {}, 동명이인: {}, 미래: 0 };
  const ex = existing instanceof Map ? existing : new Map(Object.entries(existing || {}));
  (records || []).forEach((rec) => {
    if ((from && rec.date < from) || (to && rec.date > to)) { skipped.기간밖++; return; } if (today && rec.date > today) { skipped.미래++; return; }
    if (unmatched.includes(rec.name)) { skipped.미매칭[rec.name] = (skipped.미매칭[rec.name] || 0) + 1; return; } if (duplicated.includes(rec.name)) { skipped.동명이인[rec.name] = (skipped.동명이인[rec.name] || 0) + 1; return; }
    const w = byName.get(rec.name); const key = attKey(w.id, rec.date); const e = ex.get(key) || null; const base = { key, workerId: w.id, name: w.name, date: rec.date, caps: { in: rec.in ? rec.in.hhmm : '', out: rec.out ? (rec.out.next ? '+' : '') + rec.out.hhmm : '' }, before: e ? { in: e.checkIn || '', out: e.checkOut || '', hours: Number(e.workHours) || 0, src: e.source || '' } : null };
    const clearable = !!(e && e.needsReview === true && rec.in && rec.out);   // 캡스에 출근·퇴근 지문이 모두 있으면 본인 출근의 증거이므로 NFC·버튼이 남긴 "확인 필요" 표시를 해제한다(1-3-26 설계: 캡스와 만날 때)
    const CLEAR = { needsReview: false, reviewedByName: '캡스 지문', reviewNote: '캡스 지문으로 확인됨' };
    const flag = (reason) => items.push(Object.assign(base, { status: '확인', write: false, reason }));
    let nIn, nOut, status;
    if (rec.in && rec.out) {
      if (!rec.out.next && rec.out.min <= rec.in.min) return flag('퇴근(' + rec.out.hhmm + ')이 출근(' + rec.in.hhmm + ')보다 이르거나 같은데 다음 날 표시(+)가 없습니다. 캡스 원본을 확인해 주세요.');
      if (rec.out.next && rec.out.min >= rec.in.min) return flag('다음 날 퇴근(+' + rec.out.hhmm + ')이 출근(' + rec.in.hhmm + ') 이후 시각이라 24시간을 넘습니다. 캡스 원본을 확인해 주세요.');
      nIn = rec.in.hhmm; nOut = rec.out.hhmm; status = e ? '변경' : '신규';
      if (e && near(e.checkIn, nIn) && near(e.checkOut, nOut)) status = '동일';
    } else if (rec.in) {
      if (!e || !e.checkOut) return flag('퇴근 지문이 없고 포털에도 퇴근 기록이 없어 근무시간을 만들 수 없습니다.');
      nIn = rec.in.hhmm; nOut = e.checkOut; status = near(e.checkIn, nIn) ? '동일' : '보충';
    } else {
      if (!e || !e.checkIn) return flag('출근 지문이 없고 포털에도 출근 기록이 없어 근무시간을 만들 수 없습니다.');
      nIn = e.checkIn; nOut = rec.out.hhmm; if (!rec.out.next && rec.out.min <= (hmin(nIn) || 0)) return flag('포털 출근(' + nIn + ')보다 퇴근(' + rec.out.hhmm + ')이 이르거나 같습니다. 확인해 주세요.');
      status = near(e.checkOut, nOut) ? '동일' : '보충';
    }
    if (status === '동일') {
      if (clearable) { items.push(Object.assign(base, { status, write: true, cleared: true, after: { in: e.checkIn || '', out: e.checkOut || '', brk: Number.isInteger(e.breakMinutes) ? e.breakMinutes : '', hours: Number(e.workHours) || 0 }, data: Object.assign({}, CLEAR) })); return; }   // 시각은 같고 확인 필요 표시만 푼다
      items.push(Object.assign(base, { status, write: false, after: null })); return;
    }
    const r = buildAttRecord(w.id, w.name, rec.date, { checkIn: nIn, checkOut: nOut, breakMinutes: e && Number.isInteger(e.breakMinutes) ? e.breakMinutes : '', isBusinessTrip: !!(e && e.isBusinessTrip), tripType: e ? e.tripType : '' });
    if (!r.ok) return flag(r.errors[0]);
    items.push(Object.assign(base, { status, write: true, cleared: clearable, after: { in: r.data.checkIn, out: r.data.checkOut, brk: r.data.breakMinutes, hours: r.data.workHours }, data: clearable ? Object.assign({}, r.data, CLEAR) : r.data }));
  });
  const counts = { 신규: 0, 변경: 0, 보충: 0, 동일: 0, 확인: 0 }; items.forEach((i) => { counts[i.status]++; });
  const cleared = items.filter((i) => i.cleared).length;   // 캡스 지문으로 "확인 필요" 가 풀리는 날
  const overwritten = items.filter((i) => i.write && i.status === '변경' && i.before && (i.before.src === 'nfc' || i.before.src === 'clock')).length;   // 캡스가 시각을 덮는 NFC·버튼 기록
  return { items, counts, writes: items.filter((i) => i.write), unmatched, duplicated, skipped, cleared, overwritten };
}
/** 한 사람의 이름이 아닌 숫자 요약 — 미리보기 위쪽 칩 */
export const capsSummaryText = (plan) => { const c = plan.counts; return '반영 ' + (c.신규 + c.변경 + c.보충) + '건(신규 ' + c.신규 + '·변경 ' + c.변경 + '·보충 ' + c.보충 + ') · 같은 값 ' + c.동일 + '건 · 확인 필요 ' + c.확인 + '건' + (plan.cleared ? ' · NFC 확인 필요 해제 ' + plan.cleared + '건' : '') + (plan.overwritten ? ' · 덮어쓰는 NFC·버튼 기록 ' + plan.overwritten + '건' : ''); };
