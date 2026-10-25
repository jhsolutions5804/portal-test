/* 단시간 근로자 근로계약서 양식 s1 (대기열 1-3-23, 2026-10-26~) — 순수 함수(시험: tests/hr-short-doc.test.mjs).
 * 법정 서면 명시 사항(기간제 및 단시간근로자 보호 등에 관한 법률 제17조: 근로계약기간·근로시간·휴게·임금의 구성항목·계산방법·지불방법·휴일·휴가·취업 장소와 업무·
 * 근로일 및 근로일별 근로시간, 근로기준법 제17조)을 양식이 빠뜨리지 못하게 저장 전 shortCheck 로 막는다. 문구는 고용노동부 표준 단시간근로자 근로계약서의 구성을 따른 것이며
 * 최종 문구는 노무사 확인 대상이다. 동결 양식(frozen-docs.js)은 건드리지 않는다 — 저장된 서류는 저장 당시 양식(tplVer)으로만 그린다. */
export const SHORT_TPL_VER = 's1';
/** 공개 서명 페이지(sign.html)는 근로계약서를 항상 일반 양식 v6 로 그려서, 단시간 계약서(s1)로 원격 서명을 받으면 서명하는 사람이 단시간 조항이 없는 다른 문서를 보게 된다 — 서명 페이지가 s1 을 그릴 수 있게 되기 전까지 막는다 */
export const SHORT_SIGN_ERROR = '단시간 근로계약서는 아직 원격 서명 링크·이메일 서명 요청을 쓸 수 없습니다(서명 화면이 단시간 양식을 그리지 못해 다른 문서가 보입니다). 미리보기에서 인쇄(PDF)해 서명을 받으시고, 확인용으로는 "열람 전용 링크"를 쓸 수 있습니다.';
export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export const MIN_HOURLY = { 2026: 10320 }; // 연도별 최저시급 — 모르는 연도는 확인 안내만 한다
export const WEEKS_PER_MONTH = 4.345; // 급여 계산과 같은 월 환산 주 수
export const FULL_TIME_WEEKLY = 40; // 이 시간 이상이면 단시간 근로자가 아니다(통상 근로자 소정근로시간)
export const COMPANY = { name: '제이에이치솔루션', rep: '김종화', address: '경기 평택시 고덕중앙로 320 원희캐슬고덕 지식산업센터' };
let _seal = {}; let _logo = '';
export function configureShortDoc(o) { const x = o || {}; if (x.signatures !== undefined) _seal = x.signatures || {}; if (x.logo !== undefined) _logo = x.logo || ''; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); if (!m) return NaN; const h = Number(m[1]), mi = Number(m[2]); return h > 23 || mi > 59 ? NaN : h * 60 + mi; };
const hh = (min) => { const h = min / 60; return Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10); };
export const shortNewSched = () => DAYS.map((d) => ({ day: d, on: false, start: '', end: '', breakMin: 0 }));
/** 일반 근로계약서 입력 상태에 단시간 칸을 덧붙인다(이미 있으면 그대로) */
export const shortInit = (f) => Object.assign({ workType: 'short', sched: shortNewSched(), maxWeekly: '', payDay: '', extra: '', workPlace: '회사 사무실 (' + COMPANY.address + ')' }, f, { workType: 'short', sched: Array.isArray(f && f.sched) && f.sched.length === 7 ? f.sched : shortNewSched(), payBasis: 'hourly' });
export const dayMinutes = (r) => { const s = toMin(r.start), e = toMin(r.end), b = Number(r.breakMin || 0); return Number.isFinite(s) && Number.isFinite(e) && e > s && Number.isFinite(b) && b >= 0 ? e - s - b : NaN; };
export const selectedDays = (f) => (Array.isArray(f && f.sched) ? f.sched.filter((r) => r && r.on) : []);
export const weeklyMinutes = (f) => selectedDays(f).reduce((a, r) => a + (Number.isFinite(dayMinutes(r)) ? dayMinutes(r) : 0), 0);
export const weeklyHours = (f) => weeklyMinutes(f) / 60;
export const monthlyHours = (f) => Math.round(weeklyHours(f) * WEEKS_PER_MONTH * 10) / 10;
/** 4대보험 판단 — 월 소정근로시간 60시간 미만이면 연금·건강·고용 제외(산재는 항상 가입). 최종 판단은 신고 때 확인 */
export const shortInsurance = (f) => { const m = monthlyHours(f); const exempt = weeklyHours(f) * WEEKS_PER_MONTH < 60; /* 반올림한 표시값이 아니라 실제 값으로 판단(59.96 → 60.0 으로 올라가 가입 대상으로 잘못 분류되는 것을 막는다) */ return { monthly: m, exempt, pension: !exempt, health: !exempt, employ: !exempt, accident: true }; };
/** 저장 전 검사 — errors 가 있으면 저장하지 않는다, warnings 는 안내만 */
export function shortCheck(f) {
  const errors = [], warnings = []; const x = f || {}; const days = selectedDays(x);
  if (!x.workerId && !x.name) errors.push('근로자를 선택해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.startDate || ''))) errors.push('계약 시작일을 입력해 주세요.');
  if (x.endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(x.startDate || '')) && x.endDate < x.startDate) errors.push('계약 종료일이 시작일보다 앞입니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.contractDate || ''))) errors.push('계약서 작성일(서명일)을 입력해 주세요.');
  if (!String(x.job || '').trim()) errors.push('담당 업무를 입력해 주세요.');
  if (!String(x.workPlace || '').trim()) errors.push('근무 장소를 입력해 주세요.');
  if (!days.length) errors.push('근로일(요일)을 하나 이상 선택해 주세요 — 단시간 근로자는 근로일과 근로일별 근로시간을 서면에 적어야 합니다(기간제법 제17조).');
  days.forEach((r) => {
    const s = toMin(r.start), e = toMin(r.end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) { errors.push(r.day + '요일: 시작·종료 시각을 HH:MM 으로 입력해 주세요.'); return; }
    if (e <= s) { errors.push(r.day + '요일: 종료 시각이 시작 시각보다 늦어야 합니다.'); return; }
    const b = Number(r.breakMin || 0); if (!Number.isInteger(b) || b < 0 || b >= e - s) { errors.push(r.day + '요일: 휴게시간(분)이 올바르지 않습니다.'); return; }
    const w = e - s - b; if (w >= 480 && b < 60) errors.push(r.day + '요일: 근로시간 8시간 이상이면 휴게 1시간 이상이 필요합니다(근로기준법 제54조).'); else if (w >= 240 && b < 30) errors.push(r.day + '요일: 근로시간 4시간 이상이면 휴게 30분 이상이 필요합니다(근로기준법 제54조).');
  });
  const wk = weeklyHours(x);
  if (days.length && wk >= FULL_TIME_WEEKLY) errors.push('주 소정근로시간이 ' + hh(wk * 60) + '시간이라 단시간 근로자가 아닙니다(통상 근로자 ' + FULL_TIME_WEEKLY + '시간 이상) — 일반 근로계약서를 쓰세요.');
  const hourly = Number(x.hourly || 0); if (!(hourly > 0)) errors.push('시급을 입력해 주세요.');
  else { const yr = Number(String(x.startDate || '').slice(0, 4)); if (MIN_HOURLY[yr] && hourly < MIN_HOURLY[yr]) errors.push('시급이 ' + yr + '년 최저시급 ' + MIN_HOURLY[yr].toLocaleString('ko-KR') + '원보다 낮습니다.'); else if (!MIN_HOURLY[yr] && yr) warnings.push(yr + '년 최저시급은 이 화면에 없습니다 — 직접 확인해 주세요.'); }
  if (!String(x.payDay || '').trim()) errors.push('임금 지급일을 입력해 주세요(예: 익월 10일).');
  const mw = x.maxWeekly === '' || x.maxWeekly == null ? null : Number(x.maxWeekly); if (mw != null) { if (!(mw > 0)) errors.push('초과근로 한도(주 시간)가 올바르지 않습니다.'); else if (days.length && mw < wk) errors.push('초과근로 한도(주 ' + mw + '시간)가 주 소정근로시간(' + hh(wk * 60) + '시간)보다 작습니다.'); else if (mw - wk > 12) warnings.push('초과근로가 주 12시간을 넘습니다 — 단시간 근로자의 초과근로는 합의가 있어야 하고 1주 12시간 한도입니다(기간제법 제6조, 노무사 확인).'); }
  if (days.length && wk > 0 && wk < 15) warnings.push('주 소정근로시간이 15시간 미만이라 주휴일·연차유급휴가 대상이 아닙니다(계약서에 그렇게 적습니다).');
  if (days.length && wk > 0) { const ins = shortInsurance(x); warnings.push(ins.exempt ? '월 환산 ' + ins.monthly + '시간(60시간 미만) — 국민연금·건강보험·고용보험은 가입 제외, 산재보험만 가입으로 적습니다.' : '월 환산 ' + ins.monthly + '시간(60시간 이상) — 4대보험 가입 대상으로 적습니다.'); }
  return { ok: errors.length === 0, errors, warnings, weeklyHours: wk, monthlyHours: monthlyHours(x) };
}
/** 저장 문서 — 선택한 요일만, 근로시간(시간)을 계산해 넣고 양식 버전 s1 을 붙인다. 계약연봉은 의미가 없어 0 */
export function shortRecord(f, now) {
  const x = f || {}; const rows = selectedDays(x).map((r) => ({ day: r.day, start: r.start, end: r.end, breakMin: Number(r.breakMin || 0), hours: Math.round(dayMinutes(r) / 6) / 10 })); const ins = shortInsurance(x);
  const out = Object.assign({}, x, { workType: 'short', tplVer: SHORT_TPL_VER, schedule: rows, weeklyHours: Math.round(weeklyHours(x) * 10) / 10, monthlyHours: ins.monthly, insurance: { pension: ins.pension, health: ins.health, employ: ins.employ, accident: true }, maxWeekly: x.maxWeekly === '' || x.maxWeekly == null ? null : Number(x.maxWeekly), salary: 0, payBasis: 'hourly', savedAt: now || new Date().toISOString(), savedBy: 'admin' }); delete out.sched; return out;
}
const dateKo = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[1] + '년 ' + m[2] + '월 ' + m[3] + '일' : '____년 __월 __일'; };
const IMG_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** 출력용 HTML(A4) — 저장 문서 d(shortRecord 결과)로 그린다 */
export function shortHtml(d) {
  const x = d || {}; const rows = Array.isArray(x.schedule) ? x.schedule : []; const wk = Number(x.weeklyHours || 0); const mo = Number(x.monthlyHours || 0); const ins = x.insurance || { pension: false, health: false, employ: false, accident: true };
  const ul = (v, w) => '<span style="display:inline-block;min-width:' + (w || 80) + 'px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">' + esc(v) + '</span>';
  const tr = (cells, head) => '<tr>' + cells.map((c) => '<' + (head ? 'th' : 'td') + ' style="border:1px solid #333;padding:4px 8px;text-align:center;' + (head ? 'background:#f2f4f8;' : '') + '">' + c + '</' + (head ? 'th' : 'td') + '>').join('') + '</tr>';
  const table = '<table style="border-collapse:collapse;width:100%;margin:6px 0;font-size:10pt;">' + tr(['근로일(요일)', '시업', '종업', '휴게시간', '근로시간'], true) + rows.map((r) => tr([esc(r.day) + '요일', esc(r.start), esc(r.end), esc(r.breakMin) + '분', esc(r.hours) + '시간'])).join('') + tr(['합 계', '', '', '', '주 ' + esc(wk) + '시간'], false).replace(/<td/g, '<td').replace('padding:4px 8px;text-align:center;"', 'padding:4px 8px;text-align:center;font-weight:700;"') + '</table>';
  const hol = wk >= 15 ? '을이 1주 소정근로일을 개근하면 1일의 유급휴일(주휴일)을 준다. 근로자의 날 등 그 밖의 법정 휴일은 관계 법령에 따른다.' : '주 소정근로시간이 15시간 미만이므로 주휴일과 연차유급휴가는 부여하지 않는다(근로기준법 제18조 제3항). 근로자의 날 등 그 밖의 법정 휴일은 관계 법령에 따른다.';
  const leave = wk >= 15 ? '근로기준법에 따라 통상 근로자의 소정근로시간에 비례하여 연차유급휴가를 준다.' : '주 소정근로시간이 15시간 미만이므로 연차유급휴가는 부여하지 않는다.';
  const ot = x.maxWeekly ? '갑은 을과 합의한 경우에만 소정근로시간을 넘겨 근로하게 할 수 있고, 이 경우에도 1주 총 근로시간은 ' + esc(x.maxWeekly) + '시간을 넘지 않는다. 초과근로에는 통상임금의 50%를 가산하여 지급한다.' : '갑은 을과 합의한 경우에만 소정근로시간을 넘겨 근로하게 할 수 있으며, 초과근로에는 통상임금의 50%를 가산하여 지급한다.';
  const insTxt = ins.pension ? '국민연금·건강보험·고용보험·산업재해보상보험에 관계 법령에 따라 가입한다(월 소정근로시간 약 ' + esc(mo) + '시간).' : '월 소정근로시간이 약 ' + esc(mo) + '시간(60시간 미만)이므로 국민연금·건강보험·고용보험은 가입 대상에서 제외하고, 산업재해보상보험은 근로시간과 관계없이 근로 시작일부터 가입한다. 소정근로시간이 늘어 월 60시간 이상이 되면 관계 법령에 따라 가입한다.';
  const period = x.endDate ? dateKo(x.startDate) + ' 부터 ' + dateKo(x.endDate) + ' 까지' : dateKo(x.startDate) + ' 부터 (종료일을 정하지 않음)';
  const birth = String(x.jumin || '').replace(/\D/g, '').slice(0, 6);
  const sealImg = _seal && _seal.kjh && IMG_OK.test(String(_seal.kjh)) ? '<img src="' + _seal.kjh + '" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;"/>' : '';
  const signImg = x.signData && IMG_OK.test(String(x.signData)) ? '<img src="' + x.signData + '" style="width:100px;height:40px;object-fit:contain;vertical-align:middle;"/>' : '<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>';
  const art = (t, body) => '<p style="font-weight:700;margin:14px 0 4px;">' + t + '</p><div style="margin:0 0 4px 8px;">' + body + '</div>';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>단시간 근로계약서 - ' + esc(x.name) + '</title><style>body{margin:0;font-family:\'Malgun Gothic\',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10pt;line-height:1.8;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style></head><body>'
    + '<div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;"><button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button><button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button></div>'
    + '<div class="a4"><div style="text-align:center;margin-bottom:22px;"><div style="font-size:19pt;font-weight:800;letter-spacing:4px;">단시간 근로자 근로계약서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>'
    + '<p>' + esc(COMPANY.name) + '(이하 "갑")과 근로자 ' + ul(x.name, 80) + '(이하 "을")은 다음과 같이 단시간 근로계약을 체결한다. <span style="color:#555;">(생년월일 ' + esc(birth) + ' · 연락처 ' + esc(x.phone) + ' · 주소 ' + esc(x.address) + ')</span></p>'
    + art('제1조 (근로계약기간)', esc(period) + '로 한다.') + art('제2조 (근무장소 및 업무)', '근무장소: ' + esc(x.workPlace) + '<br>업무내용: ' + esc(x.job))
    + art('제3조 (근로일 및 근로일별 근로시간)', '을의 근로일과 근로일별 근로시간은 아래와 같다. 아래에 없는 요일은 근로일이 아니다.' + table + '근로일·근로시간을 바꾸려면 갑과 을이 서면(문자·메신저 포함)으로 합의하며, 합의 내용은 이 계약의 일부로 본다.')
    + art('제4조 (초과근로)', ot) + art('제5조 (휴게시간)', '1일 근로시간이 4시간 이상이면 30분 이상, 8시간 이상이면 1시간 이상의 휴게시간을 근로시간 도중에 준다. 일별 휴게시간은 제3조 표와 같다.') + art('제6조 (휴일)', hol)
    + art('제7조 (임금)', '① 시급: ' + ul(Number(x.hourly || 0).toLocaleString('ko-KR'), 70) + '원 (최저임금 이상). 임금은 실제 근로한 시간에 시급을 곱해 계산한다.<br>② 지급일: ' + esc(x.payDay) + ', 근로자 명의 계좌로 이체한다. 근로관계가 끝난 때에는 그 날부터 14일 이내에 지급한다(근로기준법 제36조).<br>③ 시급 외 별도 수당은 없다. 연장·야간·휴일 근로를 한 경우 법정 가산수당을 지급한다. 법령에 따른 공제 외의 임의 공제는 하지 않는다.')
    + art('제8조 (사회보험)', insTxt) + art('제9조 (연차유급휴가)', leave) + art('제10조 (근태 기록)', '을은 매 근로일의 출근·퇴근 시각을 갑이 정한 방법으로 기록하고, 월말에 확인한다.')
    + art('제11조 (기타)', (x.extra ? esc(x.extra) + '<br>' : '') + '이 계약에 정하지 않은 사항은 근로기준법, 기간제 및 단시간근로자 보호 등에 관한 법률 등 관계 법령에 따른다. 이 계약서는 2부를 작성하여 갑과 을이 각 1부씩 보관(교부)한다.')
    + '<p style="margin-top:22px;text-align:center;">' + esc(dateKo(x.contractDate)) + '</p>'
    + '<table style="width:100%;margin-top:10px;font-size:10.5pt;"><tr><td style="width:50%;vertical-align:top;"><b>(갑) 사업주</b><br>' + esc(COMPANY.name) + '<br>' + esc(COMPANY.address) + '<br>대표 ' + esc(COMPANY.rep) + ' ' + sealImg + '</td><td style="vertical-align:top;"><b>(을) 근로자</b><br>성명: ' + esc(x.name) + '<br>주소: ' + esc(x.address) + '<br>서명: ' + signImg + '</td></tr></table>'
    + '<p style="margin-top:16px;font-size:8.5pt;color:#555;">※ 이 계약서는 「기간제 및 단시간근로자 보호 등에 관한 법률」 제17조와 근로기준법 제17조의 서면 명시 사항(계약기간, 근로시간·휴게, 임금, 휴일·휴가, 근무장소·업무, 근로일 및 근로일별 근로시간)을 담고 있다.</p></div></body></html>';
}
