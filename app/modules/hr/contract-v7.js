/* 근로계약서·연봉계약서 양식 v7 (대표님 요청 2026-10-29, 전환 전 반영) — 순수 함수(화면·네트워크 없음, 의존 모듈 없음 → 원격 서명 페이지(sign.html)도 그대로 불러 쓴다).
 * 동결 원칙: frozen-docs.js 의 v0~v6 은 건드리지 않는다. 이미 만든 계약서는 저장 당시 양식(tplVer)으로만 그린다 — v7 은 새로 저장하는 계약서부터.
 * 바뀐 점: ①정규직/계약직 구분 ②계약기간 방식(기간 지정 · 기간의 정함 없음 · 프로젝트 종료 시) ③계약직 근무지 ④포괄 고정연장수당(월 시간 표기·초과분 별도 지급 문구)
 *         ⑤연봉계약서 지급 항목 추가·삭제(통상임금 포함 여부) + 특약 ⑥급여명세서가 불러다 쓸 값(v7Calc).
 * ※ 법적 문구(프로젝트 종료 시 기간 명시, 포괄 고정연장 시간·초과분 별도 지급, 통상시급 산정, 특약 안내)는 노무사 확인 대상이다. */
export const CONTRACT_V7 = 'v7';
export const TYPE_LABEL = { regular: '정규직', fixed: '계약직' };
export const PERIOD_LABEL = { range: '기간 지정', open: '기간의 정함 없음', project: '프로젝트 종료 시' };
export const MAX_EXTRA = 10, MAX_TERMS = 600;
export const PAY_FACTOR = 8 * 5 * 4.345 + 8 * 4.345;   // 월 환산 시간 208.56(시급 → 월 지급계 환산, annual.js PAY_MONTH_FACTOR 와 같은 값)
let _seal = {};
export function configureContractV7(o) { const x = o || {}; if (x.signatures !== undefined) _seal = x.signatures || {}; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const R = (v) => Math.max(0, Math.round(N(v)));
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && Number(String(s).slice(0, 4)) >= 1900 && Number(String(s).slice(0, 4)) <= 2100 && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;   // 날짜 칸이 연도를 한 글자씩 칠 때 걸리는 0002-… 값은 날짜로 보지 않는다
const fmtDp = (s) => { if (!isYmd(s)) return '____년 __월 __일'; const [y, m, d] = s.split('-'); return y + '년 ' + m + '월 ' + d + '일'; };
const ul = (v, w) => '<span style="display:inline-block;min-width:' + (w || 80) + 'px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">' + esc(v) + '</span>';
const won = (v) => (v ? '₩' + Math.round(v).toLocaleString('ko-KR') : '');

/** 계약서 종류 값 정리 — 옛 문서(v6 이하)에는 없다 */
export const typeOf = (f) => (f && (f.contractType === 'regular' || f.contractType === 'fixed') ? f.contractType : '');
export const periodTypeOf = (f) => (f && (f.periodType === 'open' || f.periodType === 'project') ? f.periodType : 'range');
/** 계약기간 한 줄(계약서·목록·동의서 공통) */
export function periodText(f) {
  const p = periodTypeOf(f); const s = fmtDp(f && f.startDate);
  if (p === 'open') return s + ' 부터 (기간의 정함이 없음)';
  if (p === 'project') return s + ' 부터 「' + esc((f && f.projectName) || '____') + '」 프로젝트 종료 시까지' + (isYmd(f && f.expectedEnd) ? ' (종료 예정일 ' + fmtDp(f.expectedEnd) + ', 예정일은 변경될 수 있음)' : '');
  return s + ' ~ ' + fmtDp(f && f.endDate);
}
/** 목록 상태 칸용 종료일: 프로젝트 종료 시·기간의 정함 없음은 종료일이 없다 */
export const periodEndOf = (f) => (periodTypeOf(f) === 'range' ? ((f && f.endDate) || '') : '');

/** 월 지급 구성 계산 — 급여명세서가 계약서에서 불러다 쓰는 값이기도 하다(통상시급 = (기본+주휴+통상임금 포함 항목) ÷ 208.56) */
export function v7Calc(f) {
  const x = f || {}; const h = N(x.hourly); const comp = x.wageType === 'comprehensive';
  const basic = h ? Math.round(h * 8 * 5 * 4.345) : 0, weekly = h ? Math.round(h * 8 * 4.345) : 0;
  const fixedOT = comp ? R(x.fixedOT) : 0, fixedNight = comp ? R(x.fixedNight) : 0;
  const extras = (Array.isArray(x.extraItems) ? x.extraItems : []).map((r) => ({ name: String((r && r.name) || '').trim(), amount: R(r && r.amount), ordinary: !!(r && r.ordinary), note: String((r && r.note) || '').trim() })).filter((r) => r.name && r.amount > 0);
  const extraTotal = extras.reduce((a, r) => a + r.amount, 0), ordinaryExtra = extras.filter((r) => r.ordinary).reduce((a, r) => a + r.amount, 0);
  const total = basic + weekly + fixedOT + fixedNight + extraTotal; const ordinaryMonthly = basic + weekly + ordinaryExtra;
  return { hourly: h, basic, weekly, fixedOT, fixedNight, extras, extraTotal, ordinaryExtra, total, annual: total * 12, ordinaryMonthly, ordinaryHourly: ordinaryMonthly / PAY_FACTOR, fixedTotal: fixedOT + fixedNight + extraTotal };
}
/** 월급·연봉으로 입력했을 때의 시급 — 고정수당·추가 항목은 입력액에서 먼저 빼고 남은 금액으로 역산한다(연봉 제안서와 같은 방식) */
export function v7HourlyFromPay(f) {
  const x = f || {}; const basis = x.payBasis || 'hourly'; if (basis === 'hourly') return N(x.hourly);
  const input = N(x.payInput); if (!(input > 0)) return 0; const monthly = basis === 'annual' ? input / 12 : input;
  const c = v7Calc(Object.assign({}, x, { hourly: 0 })); const base = monthly - c.fixedTotal; return base > 0 ? base / PAY_FACTOR : 0;
}
const FORBIDDEN = [/퇴직금[^.\n]{0,14}(지급하지|불지급|미지급|지급되지)/, /손해배상[^.\n]{0,12}(미리|예정|정액)|위약금|위약벌/, /(임금|급여)[^.\n]{0,12}(상계|임의\s*공제|일방적으로\s*공제)/];
export const termsProblem = (s) => (FORBIDDEN.some((re) => re.test(String(s || ''))) ? '특약에는 근로기준법에 어긋나는 내용(퇴직금 불지급, 손해배상액 예정·위약금, 임금 임의 공제·상계)을 쓸 수 없습니다. 표현을 바꾸거나 삭제해 주세요.' : '');

/** 저장 전 검사(v7 입력 항목만). kind = 'labor' | 'annual' */
export function v7Check(f, kind) {
  const x = f || {}; const e = []; const t = typeOf(x); const p = periodTypeOf(x);
  if (!t) e.push('정규직/계약직을 선택해 주세요.');
  if (t === 'fixed' && p === 'open') e.push('계약직은 기간의 정함 없음을 선택할 수 없습니다. 기간 지정 또는 프로젝트 종료 시를 선택해 주세요.');
  if (kind === 'labor' && t === 'regular' && p !== 'open') e.push('정규직 근로계약은 기간의 정함이 없는 계약입니다. 기간의 정함 없음을 선택해 주세요.');
  if (!isYmd(x.startDate)) e.push('계약 시작일을 입력해 주세요.');
  if (p === 'range') { if (!isYmd(x.endDate)) e.push('계약 종료일을 입력해 주세요.'); else if (isYmd(x.startDate) && x.endDate < x.startDate) e.push('계약 종료일이 시작일보다 빠릅니다.'); }
  if (p === 'project') { if (!String(x.projectName || '').trim()) e.push('프로젝트를 선택해 주세요.'); if (x.expectedEnd && (!isYmd(x.expectedEnd) || (isYmd(x.startDate) && x.expectedEnd < x.startDate))) e.push('프로젝트 종료 예정일이 올바르지 않습니다.'); }
  if (kind === 'labor' && t === 'fixed' && !String(x.workPlace || '').trim()) e.push('계약직은 근무지를 입력해 주세요.');
  if (kind === 'annual') {
    if (x.wageType === 'comprehensive') { if (R(x.fixedOT) > 0 && !(N(x.fixedOTHours) > 0)) e.push('포괄 고정연장수당은 월 몇 시간분인지(산정 시간)를 입력해 주세요.'); if (R(x.fixedNight) > 0 && !(N(x.fixedNightHours) > 0)) e.push('포괄 고정야간수당은 월 몇 시간분인지(산정 시간)를 입력해 주세요.'); }
    const rows = Array.isArray(x.extraItems) ? x.extraItems : []; if (rows.length > MAX_EXTRA) e.push('추가 지급 항목은 ' + MAX_EXTRA + '개까지입니다.');
    const names = new Set(); rows.forEach((r, i) => { const nm = String((r && r.name) || '').trim(); const am = N(r && r.amount); if (!nm && am > 0) e.push('추가 지급 항목 ' + (i + 1) + '번의 항목명을 입력해 주세요.'); if (nm && !(am > 0)) e.push('추가 지급 항목 "' + nm + '"의 월 금액을 입력해 주세요.'); if (nm.length > 20) e.push('추가 지급 항목명은 20자 이내입니다.'); if (nm) { if (names.has(nm)) e.push('추가 지급 항목 "' + nm + '"이 중복되었습니다.'); names.add(nm); } });
    if (String(x.specialTerms || '').length > MAX_TERMS) e.push('특약은 ' + MAX_TERMS + '자 이내로 써 주세요.'); const tp = termsProblem(x.specialTerms); if (tp) e.push(tp);
  }
  return { ok: !e.length, errors: e };
}

const HEAD = (title, extraStyle) => '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title><style>body{margin:0;font-family:\'Malgun Gothic\',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:' + (extraStyle || '10pt') + ';line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style></head><body>';
const sealHtml = () => (_seal && _seal.kjh ? '<img src="' + _seal.kjh + '" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">' : '<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>');
const signImgOf = (f) => (f.signData ? '<img src="' + f.signData + '" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>' : '<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>');
const P = (t, mb) => '<p style="margin-bottom:' + (mb == null ? 4 : mb) + 'px;">' + t + '</p>';
const H = (t, mt) => '<p style="font-weight:700;margin:' + (mt || 12) + 'px 0 4px;">' + t + '</p>';

/** 근로계약서 v7 — v6 본문에서 정규직/계약직 문구·근로기간·근무장소·계약해지 문구만 바꿨다 */
export function laborHtmlV7(f0) {
  const f = f0 || {}; const t = typeOf(f); const p = periodTypeOf(f); const fixed = t === 'fixed'; const kindWord = fixed ? '계약직(기간제 근로계약)' : '정규직(기간의 정함이 없는 근로계약)';
  const own = fixed ? '계약직 근로자' : '정규직원';
  const period = P('1. 근로계약기간 : ' + periodText(f), 4) + (p === 'open' ? P('2. 본 계약은 기간의 정함이 없는 근로계약으로, 근로관계는 제17조 및 관계 법령에 따라 종료된다.', 8)
    : p === 'project' ? P('2. 위 프로젝트가 종료되면 본 근로계약은 종료된다. 프로젝트 종료일은 발주처와의 계약상 완료일 또는 \"갑\"이 \"을\"에게 서면(문자·메일 포함)으로 통지한 종료일로 하며, \"갑\"은 종료일이 확정되면 지체 없이 \"을\"에게 알린다.', 4) + P('3. 프로젝트 종료 후 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.', 8)
    : P('2. 계약기간이 만료되고 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.', 8));
  const place = f.workPlace ? P('1. \"을\"의 근무장소는 <b>' + esc(f.workPlace) + '</b>로 하며, \"갑\"은 업무상 필요한 경우 \"을\"과 협의하여 근무장소를 변경할 수 있다.', 4) : P('1. \"을\"은 \"갑\"이 제공하는 근무장소에서 근무하며, \"을\"은 이에 따른다.', 4);
  const assignee = String(f.assignedTo || '').trim() ? P('&nbsp;&nbsp;※ 업무 수행처(투입처) : ' + esc(f.assignedTo) + ' — "을"은 "갑"의 지휘·감독 아래 "갑"이 정한 업무를 수행한다.', 4) : '';
  const endNote = p === 'open' ? '재직 중' : '계약기간 내';
  return HEAD('근로계약서 - ' + esc(f.name)) + '<div class="a4">'
    + '<div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">근 로 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>'
    + P('제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ' + ul(f.name, 80) + ' (이하 "을"이라 한다.)는 다음과 같이 ' + kindWord + '을 체결한다.', 12)
    + H('제1조 【의 무】', 14) + P('"을"은 "갑"의 ' + own + '으로서 "갑"의 사규에 따른 제규정 및 취업규칙에 정해진 근로조건을 승인하고 근로를 성실히 이행할 의무를 진다.', 8)
    + H('제2조 【근로기간】', 14) + period
    + H('제3조 【근무장소 및 대상업무】', 14) + place + assignee + P('&nbsp;&nbsp;1) 소속 : ' + ul(f.dept, 180) + ' &nbsp; 직급 : ' + ul(f.rank, 60), 4) + P('&nbsp;&nbsp;2) 담당 업무 : ' + ul(f.job, 160), 8)
    + H('제4조 【임 금】', 14) + P('- 계약연봉 : ' + (f.salary ? '일금 ' + Number(f.salary).toLocaleString('ko-KR') + '원' : ul('', 180)), 4) + P('- 세부 지급 사항은 연봉계약서를 기준으로 한다. 임금 지급일 : 익월 말일', 8)   // 대표님 2026-10-29: 포괄임금에는 여비교통비·기술수당 문구가 없으므로 근로계약서에서 삭제
    + H('제5조 【사회보험】', 14) + P('☑ 고용보험 &nbsp; ☑ 산재보험 &nbsp; ☑ 국민연금 &nbsp; ☑ 건강보험', 8)
    + H('제6조 【근로시간】') + P('근로기준법 제50조에 따라 주 40시간 근로를 원칙으로 한다. 다만 현장 여건에 따라 근로기준법 제53조에 의거하여 최대 12시간까지 연장하여 근로할 수 있다. (식사 및 휴게시간은 근로시간에서 제외)', 6)
    + H('제7조 【휴게시간】') + P('4시간 근무마다 30분 휴식, 중식 1시간 의무지급을 원칙으로 한다. 다만, 현장 상황에 따라 유연하게 적용한다.', 6)
    + H('제8조 【퇴직금】') + P('"갑"은 "을"의 계속근로기간이 1년 이상이고 4주간을 평균하여 1주간의 소정근로시간이 15시간 이상인 경우, 근로자퇴직급여 보장법에 따라 퇴직금(퇴직 전 3개월 평균임금의 30일분 이상)을 지급한다.', 6)
    + H('제9조 【휴일 및 휴가】') + P('"을"의 휴일과 휴가는 근로자계약의 내용에 따라 결정되며, 회사는 연차휴가와 관련하여 근로자대표와의 합의에 의하여 특정일을 연차휴가로 대체할 수 있다.', 4) + P('- 계속 근로 1년 이상, 해당 기간 동안 80% 이상이 될 경우 15일의 유급휴가가 부여된다.', 4) + P('- "갑"은 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 부여한다.', 6)
    + H('제10조 【지휘감독 및 근로조건】') + P('"을"은 "갑"의 소속 ' + (fixed ? '계약직 근로자' : '근로자') + '로서 사업주의 지휘감독을 받으며, "갑"의 취업규칙 및 근무지의 제규정을 준수하여야 한다.', 6)
    + H('제11조 【귀책사유】') + ['직무상의 의무를 위반하거나 근무에 태만하였을 때', '"갑"의 이미지를 크게 손상하거나 재산상의 피해를 주었을 때', '비밀누설 및 폭행, 파업 등 규율과 질서를 문란케 하였을 때', '취업기간 중 형사상 유죄판결을 받았을 때', '채용조건에 구비된 각종문서가 위조 또는 변조, 허위사실 등이 기재되었을 때', '"갑"의 허가 없이 3일 이상 결근하였을 때', '무단지각, 조퇴, 외출을 월 3회 이상 하였을 때'].map((s, i) => P((i + 1) + '. ' + s, 2)).join('') + P('8. ' + endNote + '에 동종업체로 직접 계약 및 이직하였을 때', 6)
    + H('제12조 【손해배상】') + P('"을"의 고의 또는 중대한 과실로 "갑"에게 손해를 끼친 경우 "갑"은 실제 손해를 입증하여 민사상 배상을 청구할 수 있다. 손해액을 미리 정하거나 임금에서 일방적으로 공제하지 아니한다.', 6)
    + H('제13조 【재정보증】') + P('- "을"은 1명의 재정보증인을 설정 신고하거나 "갑"이 요구하는 금액의 신용보증보험에 가입하여야 한다.', 4) + P('- "갑"은 "을"에게 신용보증보험을 요구할 수 있으며, "을"은 회사의 요구 시 1주일 이내에 제출하여야 한다.', 6)
    + H('제14조 【안전 및 보건에 관한 사항】') + P('1. "갑"은 근로자의 안전 및 보건에 관하여 관계 법령이 정하는 바에 따라 필요한 조치를 강구한다.', 4) + P('2. "을"은 신규 입사 시 즉시 채용신체검사서를 제출하여야 하며, 정기 건강진단을 관련법령에 의거 실시하고 "을"은 이에 반드시 응해야 한다.', 4) + P('3. "을"은 제반 법규 및 "갑"이 정한 제반 안전 교육사항 및 안전수칙을 준수하여야 한다.', 6)
    + H('제15조 【취업 전 고지】') + P('"을"은 본 근로계약의 내용을 취업 전 충분히 숙지하고 이를 성실히 이행한다.', 6)
    + H('제16조 【근로조건의 결정】') + P('"을"은 본 근로계약의 내용에 이의를 제기하지 아니하며 "을"의 근로조건은 "갑"의 취업규칙 및 근로자계약 범위 내에서 결정되는 것에 동의한다.', 6)
    + H('제17조 【계약의 해지】') + P('다음 각 호에 해당하는 경우 갑과 을의 근로계약은 해지된다.', 4) + P('1. "갑"과 "을"의 상호 합의 하에 근무일을 지정하여 해당 날짜까지 근무 후 계약 종료', 4) + P('2. "을"의 계약종료 의사를 "갑"이 인지한 시점으로부터 당기 후의 1기가 지난 뒤 해지의 효력이 발생', 4) + P('3. 제11조 귀책사유 발생 시 "갑"은 일방적으로 "을"과의 근로계약을 해지할 수 있다.', 6)
    + H('제18조 【지급품의 반납】') + P('퇴직 시 "을"은 "갑"으로부터 지급받은 장비, 피복, 기타 이에 준하는 지급품을 반납하여야 한다. 반납하지 않은 경우 "갑"은 반환 또는 실비 배상을 청구할 수 있으며, 임금에서 임의로 공제하지 아니한다.', 6)
    + H('제19조 【근로기준법의 적용】') + P('본 계약에 명시되지 않은 사항은 회사의 취업규칙 및 근로기준법의 해석에 준하여 따른다.', 6)
    + H('제20조 【비밀유지】') + P('1. "을"은 자신의 계약내용을 관계인에게 누설하지 않는다.', 4) + P('2. "을"은 근무지에서 발생하는 인사문제를 관리자에게 보고하여야 하며 조치 받을 수 있도록 한다.', 4) + P('3. "을"은 "갑"에서 발생하는 문제를 외부에 누설하지 않는다.', 6)
    + H('제21조 【계약의 유지】') + P('"갑"과 "을"은 ' + (p === 'open' ? '제2조의 근로계약 내용' : '제2조의 계약기간') + '을 원칙으로 하며 "을"은 이에 동의한다. 위 계약내용이 당사자의 자유로운 의사에 의하여 원만히 체결되었음을 상호 확인하고 각 1통씩 보관한다.', 12)
    + '<p style="font-weight:600;margin:20px 0 16px;">계약일자 : ' + fmtDp(f.contractDate) + '</p>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;"><div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;' + sealHtml() + '</p><p>사업자번호 : 383-09-02847</p></div>'
    + '<div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(을)</p><p>주&nbsp;&nbsp;소 : ' + ul(f.address, 140) + '</p><p>이&nbsp;&nbsp;름 : ' + ul(f.name, 80) + '</p><p>주민등록번호 : ' + ul(f.jumin, 110) + '</p><div style="margin-top:8px;display:flex;align-items:center;gap:8px;"><span>(인)</span>' + signImgOf(f) + '</div></div></div></div>'
    + '<div class="a4" style="page-break-before:always;"><div style="text-align:center;margin-bottom:28px;"><div style="font-size:18pt;font-weight:800;letter-spacing:4px;">개인정보 제3자 제공 동의서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>'
    + '<p style="margin-bottom:16px;font-size:9.5pt;color:#556;">본 동의서는 근로계약서의 첨부서류로서, 근로계약 체결 시 근로계약서와 함께 작성합니다.</p>'
    + '<table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:16px;">' + [['제공받는 자', '회사가 "을"을 배치하는 모든 현장의 발주처 및 관계 기관'], ['제공 목적', '계약 이행에 따른 근로자 명부·자격증 확인, 출입증 발급 등 현장 출입·관리'], ['제공 항목', '성명, 생년월일, 소속, 자격증 사항, 그 밖에 발주처가 계약상 요구하는 최소한의 정보'], ['보유·이용 기간', '본 근로계약기간(제2조) 동안 : ' + periodText(f)]].map(([a, b]) => '<tr><td style="border:1px solid #333;padding:8px 10px;width:150px;background:#F5F7FA;font-weight:700;">' + a + '</td><td style="border:1px solid #333;padding:8px 10px;">' + b + '</td></tr>').join('') + '</table>'
    + '<p style="margin-bottom:14px;font-size:9.5pt;">귀하는 개인정보의 제3자 제공에 동의하지 않을 권리가 있습니다. 다만 위 정보는 발주처 현장 출입 및 계약 이행에 필요한 최소한의 정보이므로, 동의하지 않을 경우 현장 배치가 제한될 수 있습니다.</p><p style="margin-bottom:6px;">☐ 위 개인정보의 제3자 제공에 동의합니다.</p><p style="margin-bottom:24px;">☐ 위 개인정보의 제3자 제공에 동의하지 않습니다.</p>'
    + '<p style="text-align:right;margin-bottom:8px;">동의일자 : ' + fmtDp(f.contractDate) + '</p><p style="text-align:right;">근로자(정보주체) 성명 : ' + ul(f.name, 80) + ' &nbsp;&nbsp;(인) ' + signImgOf(f) + '</p></div></body></html>';
}

const tr = (l, a, b) => '<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">' + l + '</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">' + a + '</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">' + b + '</td></tr>';
/** 연봉계약서 v7 — v3~v6 본문에 구분·계약기간 방식·고정연장 시간·추가 지급 항목(통상임금 여부)·특약을 더했다 */
export function annualHtmlV7(f0) {
  const f = f0 || {}; const c = v7Calc(f); const comp = f.wageType === 'comprehensive'; const t = typeOf(f); const p = periodTypeOf(f);
  const typeLine = t ? P('※ 근로계약 구분 : ' + TYPE_LABEL[t] + (t === 'fixed' ? '(기간제 근로계약)' : '(기간의 정함이 없는 근로계약)'), 6) : '';
  const rows = tr('기본근로수당', won(c.basic), '시급×8×5×4.345') + tr('주휴수당', won(c.weekly), '시급×8×4.345')
    + (comp ? tr('고정연장수당', won(c.fixedOT), '포괄임금제 — 월 ' + esc(N(f.fixedOTHours) || '__') + '시간분의 연장근로 대가(고정 지급)') + tr('고정야간수당', won(c.fixedNight), '포괄임금제 — 월 ' + esc(N(f.fixedNightHours) || '__') + '시간분의 야간근로 대가(고정 지급)') : '')
    + c.extras.map((r) => tr(esc(r.name), won(r.amount), (r.ordinary ? '통상임금 포함' : '통상임금 제외') + (r.note ? ' · ' + esc(r.note) : ''))).join('')
    + tr('상여금', '', '회사 내규에 따름') + tr('특별성과급', '', '회사 내규에 따름') + tr('특근수당', '', '주말, 공휴일 출근 시 지급')
    + '<tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">' + won(c.total) + '</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr>';
  const wageNote = comp
    ? '<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용합니다. 근로자 본인의 선택에 따라 연장근로수당·야간근로수당을 위 표의 고정액으로 매월 실제 근무시간과 무관하게 지급하되, 위 고정액은 표에 적은 월 시간 이내의 근로에 대한 대가입니다. 다음 연봉계약 갱신 전까지 동일하게 적용합니다.</p>'
    : '<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용하지 않습니다. 기본근로수당은 월 209시간을 기준으로 산정하되, 연장근로수당(해당 월 소정근로시간 초과분에 대해 통상시급의 1.5배)과 야간근로수당(22:00~06:00 근로시간에 대해 통상시급의 0.5배 가산)은 매월 실제 근무기록을 기준으로 산정하여 별도 지급합니다.</p>';
  const ordNote = c.ordinaryExtra > 0 ? '<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 통상임금 : 기본근로수당·주휴수당과 위 표에서 "통상임금 포함"으로 표시한 항목의 월 합계(' + won(c.ordinaryMonthly) + ')를 월 환산 시간(208.56시간)으로 나눈 통상시급(' + won(c.ordinaryHourly) + ')을 연장·야간·휴일근로수당 및 주휴수당 산정에 적용합니다.</p>' : '';
  const terms = String(f.specialTerms || '').trim() ? H('제2조의3 (특약사항)', 14) + String(f.specialTerms).split(/\r?\n/).filter((s) => s.trim()).map((s) => P(esc(s), 2)).join('') + P('※ 특약이 근로기준법 등 관계 법령에 위반되는 경우 그 부분은 효력이 없다.', 10) : '';
  const periodLine = p === 'open' ? '① 직원의 연봉계약기간은 ' + fmtDp(f.startDate) + ' 부터이며, 연봉은 회사규정에 따라 갱신·조정할 때까지 적용한다.' : p === 'project' ? '① 직원의 연봉계약기간은 ' + fmtDp(f.startDate) + ' 부터 「' + esc(f.projectName || '____') + '」 프로젝트 종료 시까지로 한다.' + (isYmd(f.expectedEnd) ? ' (종료 예정일 ' + fmtDp(f.expectedEnd) + ', 예정일은 변경될 수 있다)' : '') : '① 직원의 연봉계약기간은 ' + fmtDp(f.startDate) + ' 부터 ' + fmtDp(f.endDate) + '까지로 한다.';
  return HEAD('연봉계약서 - ' + esc(f.name), '10.5pt') + '<div class="a4">'
    + '<div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>'
    + P('제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ' + ul(f.name, 100) + ' (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.', 12) + typeLine
    + H('제1조 (연봉계약기간)', 14) + P(periodLine, 4) + P('② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.', 4) + P('③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.', 10)
    + H('제2조 (연봉의 구성)', 14) + P('① 계약 연봉은 ' + (c.annual ? '금 ' + c.annual.toLocaleString('ko-KR') + '원' : '금 ____________원') + '으로 한다.', 6) + P('② 월급여 임금 구성:', 8)
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:6px;"><thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + wageNote + ordNote + '<p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>'
    + H('제2조의2 (여비교통비)', 14) + P('① 회사는 근로자가 업무상 이동에 소요한 비용을 실비변상적 성격의 여비교통비로 별도 지급한다. 이는 근로기준법 시행령상 임금(통상임금·평균임금)에 산입되지 않는 실비변상적 금품으로, 4대보험 산정 기준에서 제외한다.', 4) + P('② 여비교통비 지급 기준(개인차량 이용 시 사무실 기준 편도거리)은 다음과 같다: 40km 이내 1만원, 40km 초과 2만원. 회사차량 이용 시에는 이동거리와 무관하게 1만원을 고정 지급한다.', 4) + P('③ 지방 장기출장으로 회사가 숙소를 별도 지급하는 경우, 일비(1만원)를 지급하지 않는 대신 왕복 교통비(KTX 기준 실비)를 지급하며, 이는 <b>주 1회를 한도</b>로 한다.', 4)
    + terms
    + H('제3조 (지급시기 및 방법)', 14) + P('① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.', 4) + P('② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.', 4) + P('③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.', 10)
    + H('제4조 (기밀유지)', 14) + P('직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.', 10)
    + H('제5조 (계약의 효력정지 및 해지)', 14) + P('① "을"이 휴직, 정직 등 근로 제공이 정지되는 사유가 발생한 경우, 그 기간 동안 본 계약의 효력은 정지된다.', 4) + P('② 근로계약이 해지되거나 종료되는 경우, 본 연봉계약도 동시에 종료된 것으로 본다.', 10)
    + H('제6조 (기타사항)', 14) + P('① 본 계약에 명시되지 않은 사항은 근로기준법, 회사 취업규칙 및 관련 법령이 정하는 바에 따른다.', 4) + P('② 본 계약의 내용은 "갑"과 "을" 쌍방의 서면 합의에 의해서만 변경할 수 있다.', 10)
    + H('제7조 (계약서 교부)', 14) + P('본 계약서는 2부를 작성하여 "갑"과 "을"이 각각 서명 또는 날인한 후 1부씩 보관한다.', 20)
    + '<p style="font-weight:600;margin-bottom:20px;">계약일자 : ' + fmtDp(f.contractDate) + '</p>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;"><div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;' + sealHtml() + '</p><p>사업자번호 : 383-09-02847</p></div>'
    + '<div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ' + ul(f.address, 150) + '</p><p>이&nbsp;&nbsp;름 : ' + ul(f.name, 80) + '</p><p>주민등록번호 : ' + ul(f.jumin, 110) + '</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>' + signImgOf(f) + '</div></div></div></div></body></html>';
}
