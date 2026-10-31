/* 연차사용촉진(근로기준법 제61조) — 구포털(hr) 일정·진행 상태·촉진서 발행 규칙을 그대로 옮겼다(순수 함수).
 * 회계연도(1.1~12.31) 연차: 7/1~7/10 1차 서면 촉구 → 근로자가 10일 안에 사용 시기를 통보하지 않으면 10/31까지 2차 사용시기 지정 서면 통보.
 * 입사 첫 1년의 월 개근분(제2항): 최초 1년 종료 3개월 전 기준 10일 이내 1차 → 종료 1개월 전까지 2차, 1차 이후 발생분은 종료 1개월 전 기준 5일 이내 추가 1차 → 종료 10일 전까지 2차.
 * 저장: leave_promotions/{근로자}/records/{번호}(양식 버전 tplVer 로 동결). 대표는 근로기준법상 근로자가 아니라 제외한다.
 * ⚠️ 일정·일수는 위 기준으로 자동 계산한 참고값이다. 법률 자문이 아니며 실제 적용 전 노무사 확인을 권장한다. */
import { jhLeaveTracks, jhLeaveAllocate } from '../../shared/leave-calc.js?v=20261031c';
import { _hzParse, _hzYmd, _hzAddDays, _hzAddMonths, _hzDiffDays, _hzDot } from './leave-promo-docs.js?v=20261031c';
export const LP_STAGE = { p1: '1차 촉진', p1x: '추가 1차', p2: '2차 지정통보' };
export const LP_METHODS = ['직접 교부(수령 서명)', '이메일 + 수령 확인', '우편(내용증명)', '기타'];
export const lpDay = (s) => { const d = _hzParse(s); return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null; };
/** 촉진 대상 연차 구간 = 공용 구간(jhLeaveTracks) + 촉진 일정(1차 기간·2차 기한) */
export function lpTracks(w, today) {
  return jhLeaveTracks(w.hireDate, today).map((t) => {
    if (t.cat === 'y0') { const b1 = _hzAddMonths(t.start, 9), bx = _hzAddMonths(t.start, 11); return Object.assign({}, t, { p1s: b1, p1e: _hzAddDays(b1, 9), pxs: bx, pxe: _hzAddDays(bx, 4), dl2: _hzAddDays(bx, -1), dl2x: _hzAddDays(t.end, -10) }); }
    const b1 = _hzAddMonths(t.start, 6); return Object.assign({}, t, { p1s: b1, p1e: _hzAddDays(b1, 9), dl2: _hzAddDays(_hzAddMonths(t.start, 10), -1) });
  });
}
export function lpUsageByTrack(w, leaves, tracks, asOf) { const mine = (leaves || []).filter((lv) => (lv.authorName || lv.name || '') === w.name || (w.portalUid && lv.authorUid === w.portalUid)); return jhLeaveAllocate(tracks, mine, asOf); }
/** 구간 하나의 진행 상태. state: none·wait·now·missed·waitreply·need2·miss2·replied·done / tone·urgent(3 지금 조치·1 경과) */
export function lpEvalTrack(w, p, usage, today, recs) {
  const u = (usage || {})[p.cat] || { used: 0, planned: 0 }; const granted = p.granted, used = u.used, planned = u.planned, remain = Math.max(granted - used, 0); const startStr = _hzYmd(p.start);
  const rr = (recs || []).filter((r) => r.category === p.cat && r.periodStart === startStr); const r1 = rr.filter((r) => r.stage === 'p1').sort((a, b) => String(a.noticeDate).localeCompare(String(b.noticeDate)))[0]; const r2 = rr.find((r) => r.stage === 'p2'); const D = (d) => _hzDiffDays(today, d);
  let state = '', tone = 'gray', urgent = 0, label = '';
  if (!r1) {
    if (remain <= 0) { state = 'none'; label = '대상 아님 (잔여 0일)'; tone = 'gray'; }
    else if (today < p.p1s) { const n = D(p.p1s); state = 'wait'; label = '1차 촉진 시작 D-' + n; tone = n <= 45 ? 'blue' : 'gray'; urgent = n <= 45 ? 2 : 0; }
    else if (today <= p.p1e) { const n = D(p.p1e); state = 'now'; label = '🔔 지금 1차 촉진 기간 (마감 D-' + n + ')'; tone = 'red'; urgent = 3; }
    else { state = 'missed'; label = '⚠️ 1차 촉진 기간 경과 · 미실시'; tone = 'orange'; urgent = 1; }
  } else if (r2) { state = 'done'; label = '✅ 2차 지정 통보 완료'; tone = 'green'; }
  else if (r1.replyStatus === 'all') { state = 'replied'; label = '✅ 회신 완료 (사용계획 수립)'; tone = 'green'; }
  else {
    const due = _hzAddDays(_hzParse(r1.noticeDate), 10);
    if (today <= due) { state = 'waitreply'; label = '1차 통보 완료 · 회신 대기 (~' + _hzDot(due) + ')'; tone = 'blue'; }
    else if (today <= p.dl2) { const n = D(p.dl2); state = 'need2'; label = '🔔 2차 지정통보 필요 (기한 D-' + n + ')'; tone = 'red'; urgent = 3; }
    else { state = 'miss2'; label = '⚠️ 2차 통보 기한 경과'; tone = 'orange'; urgent = 1; }
  }
  return { p, granted, used, planned, remain, recs: rr, r1, r2, state, tone, label, urgent };
}
export function lpEvalWorker(w, today, leaves, recs) { if (!_hzParse(w.hireDate)) return { skip: '입사일 미등록' }; const tracks = lpTracks(w, today), usage = lpUsageByTrack(w, leaves, tracks, today); return { list: tracks.map((p) => lpEvalTrack(w, p, usage, today, recs)) }; }
export const lpTargets = (workers) => (workers || []).filter((w) => w.status !== 'resigned' && !/대표/.test(w.rank || '')).sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || '')));
/** 목록 행(근로자×구간)과 요약 카드 */
export function lpItems(workers, today, leaves, recsByWorker) { const items = []; (workers || []).forEach((w) => { const r = lpEvalWorker(w, today, leaves, (recsByWorker || {})[w.id] || []); if (r.skip) items.push({ w, skip: r.skip }); else r.list.forEach((e) => items.push({ w, e })); }); return items; }
export function lpSummary(items) { const ok = (items || []).filter((x) => x.e); const cnt = (f) => ok.filter((x) => f(x.e)).length; const missed = ok.filter((x) => x.e.urgent === 1 && x.e.state === 'missed'); return { now: cnt((e) => e.urgent === 3), soon: cnt((e) => e.state === 'wait' && e.urgent > 0), overdue: cnt((e) => e.urgent === 1), done: cnt((e) => e.tone === 'green'), missedNames: missed.map((x) => x.w.name).filter((v, i, a) => a.indexOf(v) === i) }; }
export const lpFormNew = (wid, stage, cat, todayStr) => ({ wid, stage, cat: cat || 'y1', noticeDate: todayStr, method: LP_METHODS[0], dates: [''], memo: '', recordOnly: false });
/** 촉진서 작성 맥락: 통보일 기준 구간·사용일수·1차 기록·회신·필요한 지정 일수·법정 기간 */
export function lpFormCtx(f, w, leaves, recs, todayDate) {
  const n = _hzParse(f.noticeDate) || todayDate || new Date(); const tracks = lpTracks(w, n), p = tracks.find((t) => t.cat === f.cat); if (!p) return { f, w, n, p: null };
  const usage = lpUsageByTrack(w, leaves, tracks, n), u = usage[p.cat] || { used: 0, planned: 0 }; const granted = p.granted, used = u.used, planned = u.planned, unused = Math.max(granted - used, 0);
  const rr = (recs || []).filter((r) => r.category === p.cat && r.periodStart === _hzYmd(p.start)); const r1 = rr.filter((r) => r.stage === 'p1').sort((a, b) => String(a.noticeDate).localeCompare(String(b.noticeDate)))[0]; const replied = r1 && r1.replyDates ? r1.replyDates : []; const need = f.stage === 'p2' ? Math.max(unused - replied.length, 0) : 0;
  let win = null, dl = null; if (f.stage === 'p1') win = [p.p1s, p.p1e]; else if (f.stage === 'p1x') win = [p.pxs, p.pxe]; if (f.stage === 'p2') dl = p.dl2; return { f, w, n, p, granted, used, planned, unused, recs: rr, r1, replied, need, win, dl };
}
/** 작성 화면의 안내 상자들: [{tone: info|warn|bad, html}] */
export function lpFormInfo(c) {
  if (!c.p) return [{ tone: 'warn', html: '⚠️ 이 통보일 기준으로는 해당 연차 구간이 없습니다. 통보일을 확인해 주세요.' }];
  const out = [{ tone: 'info', html: c.p.title + ' · ' + _hzDot(c.p.start) + ' ~ ' + _hzDot(c.p.end) + ' · 발생 <b>' + c.granted + '</b>일 (' + c.p.basis + ') · 사용 <b>' + c.used + '</b>일 · 미사용 <b>' + c.unused + '</b>일' + (c.planned ? ' · (사용 예정 ' + c.planned + '일 별도)' : '') }];
  if (c.win) { const inWin = c.n >= c.win[0] && c.n <= c.win[1]; out.push({ tone: inWin ? 'info' : 'warn', html: inWin ? '✅ 통보일이 법정 촉진 기간(' + _hzDot(c.win[0]) + ' ~ ' + _hzDot(c.win[1]) + ') 안에 있습니다.' : '⚠️ 법정 촉진 기간은 <b>' + _hzDot(c.win[0]) + ' ~ ' + _hzDot(c.win[1]) + '</b> 입니다. 이 밖의 통보는 촉진 효력을 인정받지 못할 수 있습니다.' }); }
  if (c.f.stage === 'p2') {
    if (!c.r1) out.push({ tone: 'warn', html: '⚠️ 이 연차 구간의 <b>1차 촉진 기록이 없습니다.</b> 1차 촉구 없이 한 2차 통보는 효력이 없을 수 있습니다.' });
    else { const due = _hzAddDays(_hzParse(c.r1.noticeDate), 10); out.push({ tone: c.n <= due ? 'warn' : 'info', html: '1차 통보일 ' + _hzDot(c.r1.noticeDate) + ' · 회신 기한 ' + _hzDot(due) + (c.replied.length ? ' · 근로자 회신 사용일 ' + c.replied.length + '일(' + c.replied.map(_hzDot).join(', ') + ')' : ' · 회신 없음/미기록') }); if (c.n <= due) out.push({ tone: 'warn', html: '⚠️ 근로자의 회신 기한(10일)이 지나지 않았습니다. 기한 후에 2차 통보를 하세요.' }); }
    out.push({ tone: c.n > c.dl ? 'bad' : 'info', html: '2차 통보 기한: <b>' + _hzDot(c.dl) + '</b>까지' + (c.p.cat === 'y0' ? ' (1차 이후 발생분은 ' + _hzDot(c.p.dl2x) + '까지)' : '') + (c.n > c.dl ? ' — <b>기한이 지났습니다</b>' : '') });
    const filled = c.f.dates.filter(Boolean).length; out.push({ tone: filled === c.need ? 'info' : 'warn', html: '지정할 사용일: 필요 <b>' + c.need + '</b>일 / 입력 <b>' + filled + '</b>일' + (filled !== c.need ? ' — 일수를 맞춰 주세요' : '') });
  }
  return out;
}
/** 발행(또는 기록 등록) 전 검사: errors 는 막고, warns 는 확인을 받는다. 통과하면 지정 사용일(정렬)을 돌려준다 */
export function lpValidateIssue(c) {
  const f = c.f; const errors = [], warns = []; let dates = [];
  if (!c.p) return { ok: false, errors: ['통보일 기준으로 해당 연차 구간이 없습니다. 통보일을 확인해 주세요.'], warns, dates };
  if (!f.noticeDate) return { ok: false, errors: ['통보일을 입력해 주세요.'], warns, dates }; if (c.unused <= 0) return { ok: false, errors: ['미사용 연차가 없어 촉진 대상이 아닙니다.'], warns, dates };
  if (c.win && !(c.n >= c.win[0] && c.n <= c.win[1])) warns.push('통보일이 법정 촉진 기간을 벗어났습니다.');
  if (f.stage === 'p2') {
    dates = f.dates.filter(Boolean).sort(); if (!dates.length) return { ok: false, errors: ['지정할 사용일을 1개 이상 입력해 주세요.'], warns, dates }; if (new Set(dates).size !== dates.length) return { ok: false, errors: ['중복된 날짜가 있습니다.'], warns, dates };
    for (const d of dates) { const x = _hzParse(d); if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, errors: [d + ' — 날짜 형식이 올바르지 않습니다.'], warns, dates }; if (x <= c.n || x > c.p.end) return { ok: false, errors: [d + ' — 사용일은 통보일 이후, 연차 기간(' + _hzDot(c.p.end) + ') 이내여야 합니다.'], warns, dates }; }
    if (dates.length !== c.need) warns.push('지정 일수(' + dates.length + '일)가 필요한 일수(' + c.need + '일)와 다릅니다.'); if (!c.r1) warns.push('이 연차 구간의 1차 촉진 기록이 없습니다.'); if (c.n > c.dl) warns.push('2차 통보 기한이 지났습니다.');
    const wk = dates.filter((d) => { const g = _hzParse(d).getDay(); return g === 0 || g === 6; }); if (wk.length) warns.push('주말이 포함되어 있습니다 (' + wk.join(', ') + ').');
  }
  return { ok: true, errors, warns, dates };
}
/** 저장할 촉진 기록(양식 l1 동결) */
export function lpBuildRecord(c, dates) { const f = c.f; return { stage: f.stage, category: c.p.cat, periodStart: _hzYmd(c.p.start), periodEnd: _hzYmd(c.p.end), noticeDate: f.noticeDate, grantDays: c.granted, usedDays: c.used, unusedDays: c.unused, replyDue: f.stage === 'p2' ? '' : _hzYmd(_hzAddDays(c.n, 10)), designatedDates: dates, p1NoticeDate: c.r1 ? c.r1.noticeDate : '', priorReplyDates: c.replied || [], method: f.method, memo: (f.memo || '').trim(), tplVer: 'l1', replyStatus: '', replyDates: [], receivedAt: '', recordOnly: !!f.recordOnly, workerName: c.w.name || '', dept: c.w.dept || '', rank: c.w.rank || '', empNo: c.w.empNo || '' }; }
/** 근로자 회신 기록: 쉼표로 구분한 날짜 → 회신 상태(없음/일부/전부) */
export function lpReplyUpdate(r, text) { const dates = String(text == null ? '' : text).split(',').map((s) => s.trim()).filter(Boolean); for (const d of dates) { if (!_hzParse(d) || !/^\d{4}-\d{2}-\d{2}$/.test(d) || _hzYmd(_hzParse(d)) !== d) return { ok: false, error: '날짜 형식이 올바르지 않습니다: ' + d }; } return { ok: true, patch: { replyDates: dates, replyStatus: !dates.length ? 'none' : (dates.length >= Number(r.unusedDays || 0) ? 'all' : 'partial') } }; }
export function lpReceivedUpdate(v) { const t = String(v == null ? '' : v).trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !_hzParse(t) || _hzYmd(_hzParse(t)) !== t) return { ok: false, error: '날짜 형식이 올바르지 않습니다.' }; return { ok: true, patch: { receivedAt: t } }; }
export const lpRecsSorted = (recs) => (recs || []).slice().sort((a, b) => String(b.noticeDate).localeCompare(String(a.noticeDate)));
export const LP_REPLY_LABEL = { all: '전부 회신', partial: '일부 회신', none: '회신 없음' };
