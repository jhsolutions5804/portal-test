/* 모바일 PJT "공사일보" — 새 모바일 공사일보(대표님 2026-10-18: "새거 만들면서 장비 사용 시간도 넣자").
 * pjt.html 이 불러 쓰는 별도 파일 — 불러오기·실행이 실패해도 기존 공정·일정·근태·이력 화면은 그대로 동작하도록 pjt.html 쪽에서 감싼다.
 * 저장 형식·규칙은 **PC 와 완전히 같다**: PC 의 순수 규칙(app/modules/pjt/report.js · daily-note.js · adapter.js)을 그대로 불러 쓴다 — 모바일이 따로 만드는 규칙은 없고,
 * 여기서 하는 일은 ①서버에서 읽은 값으로 그날의 폼 모델을 만들고(저장된 일보가 있으면 그대로, 없으면 공정 체크·출역·공수로 미리 채움) ②모바일 입력칸의 값을 모델에 담아 저장 문서로 바꾸고 ③모바일 모양의 화면 문자열을 만드는 것이다.
 * 서버 읽기·쓰기는 호출하는 쪽(pjt.html)이 함수로 넘긴다(createMobileReport 의 io) — 이 파일은 Firestore 를 직접 부르지 않아 노드에서 시험한다. */
import { REPORT_FMT, WORK_SHIFTS, EQUIPS, cleanHrs, shiftOf, fromStored, toStored, isLegacyDoc, authorLabel, withEditor, dateText, attendanceSummary, autoContent, totalOf, perPersonOf, fmtAt } from '../app/modules/pjt/report.js?v=20261018b';
import { dayDoc, isDateKey } from '../app/modules/pjt/adapter.js?v=20261018b';

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 모바일 사이트 키 → 서버 프로젝트 id (경량 프로젝트 키는 reg_<문서id>, 고정 프로젝트 p4ph2·p4ph4 는 그대로) — 이력(pjt-log.js)과 같은 규칙 */
export const pjtIdOf = (siteKey) => (String(siteKey || '').indexOf('reg_') === 0 ? String(siteKey).slice(4) : String(siteKey || ''));
/** 그날의 일보가 저장되는 위치 [컬렉션, 문서 id] — PC 와 같은 어댑터. 잘못된 프로젝트·날짜면 null(쓰지 않는다) */
export const reportDoc = (siteKey, dateKey) => dayDoc(pjtIdOf(siteKey), 'report', dateKey);

/** 새 일보의 빈 폼(저장된 일보가 없을 때) — PC 의 loadDay 와 같은 값: 작성자는 로그인 계정, 내용은 그날 공정 체크로, 인원·공수는 출역·공수로 미리 채운다 */
export function newForm(me, att, structure, newChecks) {
  const a = att || {};
  return { legacy: false, author: authorLabel(me), checkIn: '', checkOut: '', shift: '', equipText: '', content: structure ? autoContent(structure, newChecks || {}) : '', tomorrow: '', headcount: a.headcount || 0, manday: a.manday || 0, mandayTotal: a.mandayTotal || 0, equip: [], eqNo: {}, eqHrs: {}, note: '' };
}
/** 저장된 일보가 있으면 그것을(작성자가 비어 있으면 로그인 계정으로), 없으면 새 폼 */
export function formFor(stored, me, att, structure, newChecks) {
  if (stored) { const f = fromStored(stored); if (!f.author) f.author = authorLabel(me); return f; }
  return newForm(me, att, structure, newChecks);
}
/** 모바일 입력칸에서 읽은 값 → 모델에 반영. 옛 형식(legacy)은 고치지 않는다. 시간(시:분)·장비별 차량번호·사용 시간까지 PC 의 readForm 과 같은 규칙 */
export function applyInputs(form, v) {
  const f = Object.assign({}, form); if (!f || f.legacy) return f; const x = v || {};
  ['author', 'content', 'tomorrow', 'note'].forEach((k) => { if (x[k] !== undefined) f[k] = String(x[k]); });
  if (x.headcount !== undefined) f.headcount = parseInt(x.headcount, 10) || 0;
  if (x.manday !== undefined) f.manday = parseFloat(x.manday) || 0;
  const hm = (h, m) => (h && m ? h + ':' + m : (h ? h + ':00' : ''));
  if (x.ciH !== undefined || x.ciM !== undefined) f.checkIn = hm(x.ciH, x.ciM);
  if (x.coH !== undefined || x.coM !== undefined) f.checkOut = hm(x.coH, x.coM);
  if (x.eqNo) f.eqNo = Object.assign({}, f.eqNo, x.eqNo);
  if (x.eqHrs) f.eqHrs = Object.assign({}, f.eqHrs, x.eqHrs);
  f.shift = ''; f.mandayTotal = totalOf(f.headcount, f.manday); return f;
}
/** 저장할 문서 — PC 와 같은 toStored. 이미 있는 일보를 최초 작성자가 아닌 사람이 고치면 수정자로 기록(PC 와 같은 withEditor) */
export function docToSave(form, ctx, exists, me, nowIso) {
  const f = Object.assign({}, form);
  if (exists) f.editors = withEditor(f.editors, f.author, authorLabel(me), nowIso);
  return toStored(f, ctx);
}
/** 장비 하나를 켜거나 끈다(지게차·크레인) — 끄면 그 장비의 번호·시간도 비운다(PC 의 장비 버튼과 같은 동작) */
export function toggleEquip(form, name) {
  if (EQUIPS.indexOf(name) === -1) return form; const f = Object.assign({}, form); const on = (f.equip || []).indexOf(name) !== -1;
  f.equip = on ? f.equip.filter((e) => e !== name) : (f.equip || []).concat(name);
  if (on) { f.eqNo = Object.assign({}, f.eqNo); delete f.eqNo[name]; f.eqHrs = Object.assign({}, f.eqHrs); delete f.eqHrs[name]; }
  return f;
}

export { REPORT_FMT, WORK_SHIFTS, EQUIPS, cleanHrs, shiftOf, fromStored, toStored, isLegacyDoc, authorLabel, withEditor, dateText, attendanceSummary, totalOf, perPersonOf, fmtAt, isDateKey, esc };
