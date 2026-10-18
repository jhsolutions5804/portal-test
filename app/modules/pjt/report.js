/* PJT 공사일보 — 순수 규칙(화면·네트워크 없이 시험 가능). 모든 프로젝트 같은 양식: 작성자·근무시간·금일 작업·명일 예정·투입 인원·1인당 공수·사용 장비·특이사항.
 * 저장(동결): 날짜 키 문서 하나(어댑터 P.reports/<날짜>), 모든 프로젝트 같은 형식(fmt 2).
 * 옛 형식 문서(구포털 일보의 today·count·remarks 필드)는 읽을 때 새 양식으로 환산해 보여 주고(옛 양식 표시), 고쳐 저장하면 새 형식으로 바뀐다 — 문서의 나이에 따른 처리이며 프로젝트 종류와 무관하다. */
export const REPORT_FMT = 2;
/** 근무시간 구분(대표님 지정 2026-10-14): 고르면 시작·종료 시간이 채워지고, 그 뒤 시·분을 직접 고칠 수 있다. 시간이 구분과 정확히 맞으면 구분 이름이 표시되고, 고쳐서 맞지 않으면 시간만 남는다 */
export const WORK_SHIFTS = [{ name: '주간', from: '07:00', to: '17:00' }, { name: '조출', from: '05:00', to: '07:00' }, { name: '연장', from: '17:00', to: '19:00' }, { name: '야간', from: '19:00', to: '21:00' }, { name: '조출주간', from: '05:00', to: '17:00' }, { name: '주간연장', from: '07:00', to: '19:00' }, { name: '철야', from: '19:00', to: '05:00' }];
export const shiftOf = (checkIn, checkOut) => { const s = WORK_SHIFTS.find((x) => x.from === checkIn && x.to === checkOut); return s ? s.name : ''; };
/** 사용 장비: 지게차·크레인은 버튼으로 (둘 다 고를 수 있음), 장비 번호 등 그 밖의 장비는 직접 입력해 칩으로 더한다(대표님 지정 2026-10-14) */
export const EQUIPS = ['지게차', '크레인'];
export const normalizeEquip = (v) => splitEquip(v);   // 쉼표로 나눈 장비 이름들("—" 제외)
/** 장비 한 항목 끝의 사용 시간 "4시간"·"2.5시간"(대표님 2026-10-18: 장비마다 사용 시간 수) → { rest, hrs } — 시간이 없으면 전과 같다(옛 문서 호환) */
export const HRS_RE = /\s*(\d+(?:\.\d+)?)\s*시간$/;
export const cleanHrs = (v) => { const t = String(v == null ? '' : v).trim(); if (/^-/.test(t)) return ''; const n = Math.round(Number(t.replace(/[^\d.]/g, '')) * 2) / 2; return n > 0 && n <= 24 ? String(n) : ''; };   // 0.5 시간 단위로 반올림, 24 이하, 음수·0·빈 값·숫자 아님은 없음(음수 부호가 지워져 양수로 둔갑하지 않게)
const splitHrs = (e) => { const m = String(e).match(HRS_RE); return m ? { rest: String(e).slice(0, m.index).trim(), hrs: cleanHrs(m[1]) } : { rest: String(e).trim(), hrs: '' }; };
/** 저장된 장비 문구 → { equip: [고른 장비 이름들], eqNo: { 지게차: '차량번호' }, eqHrs: { 지게차: '4' } } — "지게차 (12가3456) 4시간, 크레인" 처럼 장비마다 차량번호·사용 시간이 붙은 형태를 읽는다(옛 문서의 "지게차 (00가0000)" 칩도 같은 방식) */
export function parseEquip(v) {
  const equip = [], eqNo = {}, eqHrs = {};   // 같은 장비에 번호가 둘 이상이면(옛 일보) 첫 번호만 칸에 넣고 나머지는 장비 칩으로 남겨 번호가 사라지지 않게 한다
  normalizeEquip(v).forEach((raw) => {
    const sh = splitHrs(raw), e = sh.rest;
    const hit = EQUIPS.find((n) => e === n || (e.indexOf(n + ' (') === 0 && /\)$/.test(e))); if (!hit) { if (equip.indexOf(raw) === -1) equip.push(raw); return; }   // 지게차·크레인이 아닌 장비는 입력한 글자 그대로(시간도 글자의 일부)
    if (equip.indexOf(hit) === -1) equip.push(hit); if (sh.hrs && !eqHrs[hit]) eqHrs[hit] = sh.hrs; const mm = e.match(/^[^(]+\((.*)\)$/); const no = mm && mm[1].trim() ? mm[1].trim() : '';
    if (no) { if (!eqNo[hit]) eqNo[hit] = no; else if (eqNo[hit] !== no && equip.indexOf(e) === -1) equip.push(e); }
  });
  return { equip, eqNo, eqHrs };
}
/** 화면 모델 → 표시·저장용 장비 목록: 지게차·크레인은 고른 것만 "지게차 (차량번호) 4시간"(번호·시간이 없으면 있는 것만), 그 밖의 장비는 입력한 그대로 */
export function equipList(m) {
  const given = (m && m.eqNo) || {}, givenH = (m && m.eqHrs) || {}; const sel = [], others = [], combined = {}, hrsIn = {};   // combined = 장비 이름에 번호가 붙어 들어온 것("지게차 (A)") — 옛 일보·옛 칩
  normalizeEquip(m && m.equip).forEach((raw) => {
    const sh = splitHrs(raw), e = sh.rest;
    const hit = EQUIPS.find((n) => e === n || (e.indexOf(n + ' (') === 0 && /\)$/.test(e))); if (!hit) { if (others.indexOf(raw) === -1) others.push(raw); return; }
    if (sel.indexOf(hit) === -1) sel.push(hit); if (sh.hrs && !hrsIn[hit]) hrsIn[hit] = sh.hrs; const mm = e.match(/^[^(]+\((.*)\)$/); if (mm && mm[1].trim()) (combined[hit] = combined[hit] || []).push(mm[1].trim());
  });
  const clean = (v) => String(v || '').trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim(); const out = [];
  EQUIPS.forEach((n) => { if (sel.indexOf(n) === -1) return; const list = combined[n] || []; const slot = clean(given[n]) || clean(list[0]);   // 번호 칸 = 입력한 값, 없으면 이름에 붙어 온 첫 번호
    const hrs = cleanHrs(givenH[n]) || hrsIn[n] || '';   // 시간 칸 = 입력한 값, 없으면 이름에 붙어 온 시간
    out.push((slot ? n + ' (' + slot + ')' : n) + (hrs ? ' ' + hrs + '시간' : '')); list.forEach((v) => { const full = n + ' (' + v + ')'; if (clean(v) !== slot && others.indexOf(full) === -1) others.push(full); }); });   // 번호가 다른 나머지는 그대로 남겨 사라지지 않게
  others.forEach((e) => { if (out.indexOf(e) === -1) out.push(e); });
  return out;
}
/** 작성자는 로그인한 계정 정보에서 가져온다: "이름 직급" */
export const authorLabel = (me) => String((me && me.name) || '').trim() + (me && me.rank ? ' ' + String(me.rank).trim() : '');
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const splitEquip = (v) => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map((s) => String(s).trim()).filter((s) => s && s !== '—');
/** 저장 시각(ISO) → 한국 시간 "7/2 15:30" */
export const fmtAt = (iso) => { const t = Date.parse(iso); if (isNaN(t)) return ''; const d = new Date(t + 9 * 3600000); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
/** 수정자 기록: 최초 작성자와 다른 사람이 고치면 수정자에 더한다(같은 사람이 계속 고치면 마지막 시각만 갱신, 최초 작성자가 직접 고치면 기록하지 않음). now = ISO 문자열 */
export function withEditor(editors, author, me, now) {
  const list = (editors || []).map((e) => ({ by: e.by, at: e.at })); const by = String(me || '').trim(); if (!by || by === String(author || '').trim()) return list; const last = list[list.length - 1];
  if (last && last.by === by) last.at = now; else list.push({ by, at: now }); return list.slice(-20);
}
/** 'YYYY-MM-DD' → '2026. 9. 2 (수)' (구포털 일보의 날짜 문구) */
export function dateText(k) { const [y, m, d] = k.split('-').map(Number); return y + '. ' + m + '. ' + d + ' (' + DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ')'; }
/** 옛 형식(Ph2·Ph4 일보)인가: 새 형식 표시(fmt)·새 필드(content)가 없고 옛 필드(today·count·remarks)가 있다. 경량 일보는 새 필드를 이미 쓴다 */
export function isLegacyDoc(d) { return !!d && d.fmt == null && d.content === undefined && (d.today !== undefined || d.remarks !== undefined || d.count !== undefined); }
/** 저장된 문서 → 화면 모델(옛 형식이면 환산) */
export function fromStored(d) {
  const x = d || {}; const legacy = isLegacyDoc(x);
  const headcount = legacy ? (parseInt(x.count, 10) || 0) : (parseInt(x.headcount, 10) || 0); const per = legacy ? 0 : r1(x.manday); const total = legacy ? 0 : (x.mandayTotal != null ? r1(x.mandayTotal) : r1(headcount * per));
  return { legacy, author: String(x.author || ''), checkIn: String(x.checkIn || ''), checkOut: String(x.checkOut || ''), shift: shiftOf(String(x.checkIn || ''), String(x.checkOut || '')), content: String((legacy ? x.today : x.content) || ''), tomorrow: String(x.tomorrow || ''), headcount, manday: per, mandayTotal: total, equip: parseEquip(x.equip).equip, eqNo: parseEquip(x.equip).eqNo, eqHrs: parseEquip(x.equip).eqHrs, equipText: legacy ? splitEquip(x.equip).join(', ') : '', editors: Array.isArray(x.editors) ? x.editors.filter((e) => e && e.by).map((e) => ({ by: String(e.by), at: String(e.at || '') })) : [], note: String((legacy ? x.remarks : x.note) || '') };   // 옛 형식은 장비 번호가 든 원래 문구를 equipText 로 보여 주고(고치면 칩으로 이어짐), editors = 최초 작성자 외에 고친 사람들(수정자 기록)
}
/** 화면 모델 → 저장할 문서(fmt 2). 모든 프로젝트 같은 형식 — 날짜 키 문서(pjt_registry/<id>/reports/<날짜>)에 쓴다 */
export function toStored(m, ctx) {
  const c = ctx || {}; const headcount = parseInt(m.headcount, 10) || 0; const manday = r1(m.manday); const total = r1(headcount * manday); const equip = equipList(m);
  return { fmt: REPORT_FMT, dateKey: c.dateKey, date: c.dateKey, site: c.site || '', author: String(m.author || '').trim(), checkIn: m.checkIn || '', checkOut: m.checkOut || '', shift: shiftOf(m.checkIn || '', m.checkOut || ''),
    content: String(m.content || '').trim(), tomorrow: String(m.tomorrow || '').trim(), headcount, manday, mandayTotal: total, equip: equip.join(', '), note: String(m.note || '').trim(), editors: (m.editors || []).slice(-20) };
}
export const totalOf = (headcount, per) => r1((parseInt(headcount, 10) || 0) * (Number(per) || 0));
export const perPersonOf = (total, headcount) => ((parseInt(headcount, 10) || 0) > 0 ? r1(total / headcount) : 0);
/** 그날 출역·공수 요약: 출역 인원(체크됐거나 공수가 있는 사람, activeIds 가 있으면 그 대상자만)과 그 인원들의 공수 합계·1인당 평균 */
export function attendanceSummary(checks, md, activeIds) {
  const act = activeIds ? new Set(activeIds) : null; const ids = new Set((checks || []).concat(Object.keys(md || {}).filter((k) => (parseFloat((md || {})[k]) || 0) > 0))); const counted = [...ids].filter((id) => !act || act.has(id));
  const total = r1(counted.reduce((s, id) => s + (parseFloat((md || {})[id]) || 0), 0)); return { headcount: counted.length, mandayTotal: total, manday: perPersonOf(total, counted.length) };
}
/** 장비 번호 범위 표기(구포털 formatEqRange): 숫자는 연속 구간을 "801~803"으로 묶고 끝에 "호기", 숫자가 아니면 이름을 쉼표로 */
export function formatRange(names) {
  const a = (names || []).map(String); if (!a.length) return ''; const nums = a.map((e) => parseInt(e, 10)); if (nums.every((n) => !isNaN(n)) && a.every((e) => /^\d+$/.test(e))) {
    nums.sort((x, y) => x - y); const out = []; let s = nums[0], e = nums[0]; for (let i = 1; i < nums.length; i++) { if (nums[i] === e + 1) e = nums[i]; else { out.push(s === e ? String(s) : s + '~' + e); s = e = nums[i]; } } out.push(s === e ? String(s) : s + '~' + e); return out.join(', ') + '호기'; }
  return a.join(', ');
}
/** 금일 작업 자동 채우기: 그날 새로 체크한 항목을 섹터마다 한 줄 — "[3F FIZ] 반입 3개 (801~803호기), 입고검사 2개 (…)". newByGroup = { 섹터 id: { '<품목>_<단계>': true } }, 단계는 구조의 열 순서(합성 단계 설치는 하위 열 그대로) */
export function autoContent(structure, newByGroup) {
  const lines = []; structure.groups.forEach((g) => { const m = (newByGroup || {})[g.id] || {}; const parts = [];
    structure.leafCols.forEach((col) => { const items = g.items.filter((it) => m[it.id + '_' + col]); if (items.length) parts.push(col + ' ' + items.length + '개 (' + formatRange(items.map((it) => it.name)) + ')'); });
    if (parts.length) lines.push('[' + (g.name || '전체') + '] ' + parts.join(', ')); });
  return lines.join('\n');
}
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 인쇄·미리보기용 문서(A4 표): 현장명·작성일자·작성자·(근무시간)·금일 작업·명일 예정·투입 인원·공수·사용 장비·특이사항 */
export function docHtml(m, ctx) {
  const c = ctx || {}; const td = 'style="border:1px solid #ccc;padding:8px 12px;white-space:pre-wrap"', th = 'style="border:1px solid #ccc;padding:8px 12px;background:#f5f5f5;width:110px;text-align:left"'; const row = (k, v) => '<tr><th ' + th + '>' + k + '</th><td ' + td + '>' + (esc(v) || '—') + '</td></tr>';
  const people = m.headcount || m.headcount === 0 ? m.headcount + '명' + (m.manday ? ' × ' + r1(m.manday).toFixed(1) + '공수 = 합계 ' + r1((parseInt(m.headcount, 10) || 0) * m.manday).toFixed(1) : '') : '—';   // 합계는 항상 인원 × 1인당 공수(저장하는 값과 같음)
  return '<div style="text-align:center;margin-bottom:20px"><h2 style="font-size:22px;font-weight:700;letter-spacing:4px">공 사 일 보</h2><p style="font-size:12px;color:#555;margin-top:4px">' + esc(c.site || '') + (c.client ? ' · ' + esc(c.client) : '') + '</p></div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px">' + row('현장명', c.site) + row('작성일자', c.dateKey ? dateText(c.dateKey) : '') + row('작성자', m.author) + (m.checkIn || m.checkOut ? row('근무시간', (shiftOf(m.checkIn, m.checkOut) ? shiftOf(m.checkIn, m.checkOut) + ' (' : '') + (m.checkIn || '—') + ' ~ ' + (m.checkOut || '—') + (shiftOf(m.checkIn, m.checkOut) ? ')' : '')) : '')
    + row('금일 작업', m.content) + row('명일 예정', m.tomorrow) + '<tr><th ' + th + '>투입 인원 · 공수</th><td ' + td + '>' + esc(people) + '</td></tr>' + row('사용 장비', m.equipText || equipList(m).join(', ')) + row('특이사항', m.note) + ((m.editors || []).length ? row('수정자', m.editors.map((e) => e.by + (e.at ? ' (' + fmtAt(e.at) + ')' : '')).join(', ')) : '') + '</table>';
}
/** 일보 파일 이름(인쇄 제목): 20260902_<프로젝트>_공사일보 */
export const docTitle = (dateKey, site) => dateKey.replace(/-/g, '') + (site ? '_' + String(site).replace(/\s+/g, '') : '') + '_공사일보';
