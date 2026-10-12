/* 연봉 제안서 — 연봉 또는 시급 하나만 입력 → 급여 구성 자동 산출 → A4 2쪽(제안서 + 회신서) 출력(PDF 저장). 구포털(hr v2.7.0)과 같은 산식·서식.
 * · 산식은 연봉계약서와 같다: 기본근로수당 = 시급×8×5×4.345, 주휴수당 = 시급×8×4.345 (월 환산 208.56시간)
 * · 출력은 미리보기일 뿐 저장되지 않는다. 저장(salary_offers)할 때만 지난 제안서·인사 캘린더(회신기한)에 반영된다.
 * 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다(이 파일은 DOM·Firebase 를 쓰지 않는다). */
export const OFFER_CO = 'JH솔루션';
export const OFFER_CEO = '김종화';
export const OFFER_HB = 8 * 5 * 4.345;          // 173.8h  (월 소정근로)
export const OFFER_HW = 8 * 4.345;              // 34.76h  (월 주휴)
export const OFFER_HF = OFFER_HB + OFFER_HW;    // 208.56h (월 환산 시간)
export const OFFER_KIND = { new: '신규 입사', renew: '재계약', adjust: '연봉 조정' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

export function offerNewForm(today) {
  const t = today || ymd(new Date());
  return { kind: 'new', workerId: '', applicantId: '', name: '', empNo: '', dept: '', rank: '', hireDate: '', job: '', site: '', empKind: 'regular', startDate: '', endDate: '', hoursDay: '8', hoursWeek: '40', probation: '', mode: 'annual', amount: '', wageType: 'noncomprehensive', fixedOT: '', fixedNight: '', etcName: '', etc: '', curSalary: '', curRank: '', payDay: '익월 말일', bonus: '', special: '', sepNote: true, offerDate: t, replyDue: addDays(t, 7) };
}
/** 연봉계약서 산식 그대로(포괄임금제 폐지 — 고정연장·야간은 0) */
export function annualSalary(hourly) {
  if (!hourly) return { basic: 0, fixedOt: 0, fixedNight: 0, weekly: 0, total: 0, annual: 0 }; const h = Number(hourly);
  const basic = Math.round(h * 8 * 5 * 4.345), weekly = Math.round(h * 8 * 4.345), total = basic + weekly; return { basic, fixedOt: 0, fixedNight: 0, weekly, total, annual: total * 12 };
}
/** 연봉 입력 시 시급은 반올림하지 않고 소수 그대로 역산(근로·연봉계약서 "급여 입력 기준"과 같은 방식) → 계약서와 원 단위까지 일치 */
export function offerCalc(f) {
  const R = (v) => Math.max(0, Math.round(Number(v) || 0)); const wc = f.wageType === 'comprehensive';
  const fx = { fixedOT: wc ? R(f.fixedOT) : 0, fixedNight: wc ? R(f.fixedNight) : 0, etc: R(f.etc) }; const exTotal = fx.fixedOT + fx.fixedNight + fx.etc; const amt = Number(f.amount) || 0;
  const r = Object.assign({ ok: false, err: '', exTotal, hourly: 0, basic: 0, weekly: 0, base: 0, monthly: 0, annual: 0, note: '' }, fx);
  if (!(amt > 0)) return r;
  let h; if (f.mode === 'hourly') h = amt; else { const base = amt / 12 - exTotal; if (base <= 0) { r.err = '월 지급액이 기타·고정수당 합계보다 커야 합니다.'; return r; } h = base / OFFER_HF; }
  const s = annualSalary(h); r.hourly = h; r.basic = s.basic; r.weekly = s.weekly; r.base = s.basic + s.weekly; r.monthly = r.base + exTotal; r.annual = r.monthly * 12;
  if (f.mode === 'annual') { const diff = r.annual - Math.round(amt); if (diff !== 0) r.note = '입력 연봉 대비 ' + (diff > 0 ? '+' : '−') + '₩' + Math.abs(diff).toLocaleString('ko-KR') + ' · 원 단위 반올림 차이 (제안서에는 월 지급액×12로 표기)'; }
  r.ok = true; return r;
}
/** 연봉 ↔ 시급 전환: 입력 중이던 값을 다른 단위로 환산해 이어받고, 환산값을 건드리지 않고 되돌리면 처음 입력값 그대로 복원(반올림 오차 방지) */
export function offerSwitchMode(f0, m) {
  const f = Object.assign({}, f0); if (f.mode === m) return f; f._saved = false; const sw = f._swap;
  if (sw && sw.toMode === f.mode && sw.fromMode === m && String(f.amount) === String(sw.convAmount)) f.amount = sw.origAmount;
  else { const r = offerCalc(f); const conv = r.ok ? String(m === 'hourly' ? Math.round(r.hourly * 100) / 100 : r.annual) : ''; f._swap = { fromMode: f.mode, toMode: m, origAmount: f.amount, convAmount: conv }; f.amount = conv; }
  f.mode = m; return f;
}
export function offerPayload(f) { const o = {}; Object.keys(f).forEach((k) => { if (k[0] !== '_') o[k] = f[k]; }); return o; }
/** 저장된 제안서 → 폼(열어서 수정): id·시각 필드는 빼고, 같은 문서를 덮어쓰도록 _id 를 단다 */
export function offerFormFromSaved(o, today) { const rest = Object.assign({}, o); delete rest.id; delete rest.createdAt; delete rest.updatedAt; return Object.assign(offerNewForm(today), rest, { _id: o.id, _saved: true }); }
/** 저장한 제안서의 회신기한 → 인사 캘린더(offerreply_<제안서 번호>, 제안서 1건 = 일정 1건). 회신기한이 올바르지 않으면 일정 삭제 */
export function offerCalendar(f) {
  if (!f._id) return null; const id = 'offerreply_' + f._id; if (!isDate(f.replyDue)) return { id, remove: true };
  return { id, remove: false, data: { type: 'offerreply', title: '[연봉제안서 회신] ' + (f.name || ''), person: f.name || '', date: f.replyDue, time: '', endTime: '', note: (OFFER_KIND[f.kind] ? OFFER_KIND[f.kind] + ' · ' : '') + '제안일 ' + (f.offerDate || '-') + ' (연봉 제안서 저장 시 자동 등록)', source: 'offer', srcId: f._id } };
}
/** 최근 연봉계약서(계약일 기준)로 현재 연봉·직급·재계약 시작일 채우기 */
export function offerFillCurrent(f0, contracts) {
  const f = Object.assign({}, f0); if (f.kind === 'new' || !f.workerId) return { form: f, hint: '' };
  let best = null; (contracts || []).forEach((d) => { if (!best || String(d.contractDate || '') > String(best.contractDate || '')) best = d; });
  if (!best) return { form: f, hint: '연봉계약서 기록이 없습니다. 현재 연봉을 직접 입력해 주세요.' };
  const sal = Number(best.salary) || (best.hourly ? annualSalary(Number(best.hourly)).annual : 0); if (sal) f.curSalary = String(Math.round(sal)); if (!f.curRank) f.curRank = best.rank || f.rank || '';
  if (f.kind === 'renew' && best.endDate && !f.startDate) { f.startDate = addDays(best.endDate, 1); f.endDate = addDays(f.startDate, 364); }
  return { form: f, hint: '최근 연봉계약서(' + (best.contractDate || '-') + ') 기준으로 자동 입력했습니다.' };
}
const fw = (v) => '₩' + Math.round(v).toLocaleString('ko-KR');
const fwh = (v) => '₩' + Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
/** 계산 결과 패널의 안내 문구 */
export function offerNotes(f, r, ctx) {
  const c = ctx || {}; const notes = []; if (r.note) notes.push(r.note);
  if (c.minWage && r.hourly < c.minWage) notes.push('⚠️ 통상시급 ' + fwh(r.hourly) + '이 설정된 법정 최저시급 ' + fw(c.minWage) + '에 미달합니다.');
  const cur = Number(f.curSalary) || 0; if (f.kind !== 'new' && cur > 0) { const d = r.annual - cur; notes.push('현재 연봉 ' + fw(cur) + ' 대비 ' + (d >= 0 ? '+' : '−') + fw(Math.abs(d)).replace('₩', '') + '원 (' + (d >= 0 ? '+' : '−') + Math.abs(d / cur * 100).toFixed(1) + '%)'); }
  const certN = c.worker ? (c.worker.certifications || []).filter((x) => x && String(x).trim()).length : 0; const per = c.perCert || 50000;
  if (c.worker && certN > 0) notes.push('선택한 근로자는 기술수당 별도 대상입니다 — 자격증 ' + certN + '개 × ' + fw(per) + '원 = 월 ' + fw(certN * per) + '원 (연봉과 별도, 출력 시 표시됨)');
  notes.push('기준: 월 소정근로 ' + OFFER_HB.toFixed(1) + 'h + 주휴 ' + OFFER_HW.toFixed(2) + 'h = ' + OFFER_HF.toFixed(2) + 'h'); return notes;
}
/** 출력용 A4 2쪽 — ctx: { worker(선택한 근로자), perCert(기술수당 단가), stamp(직인 이미지 data URL), logo(로고 이미지 주소) } */
export function offerBuildHtml(f, r, ctx) {
  const c = ctx || {}; const nb = '&nbsp;'; const w = (v) => Math.round(v).toLocaleString('ko-KR'); const wh = (v) => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  const dLong = (s) => { if (!s) return '20' + nb.repeat(6) + '년' + nb.repeat(4) + '월' + nb.repeat(4) + '일'; const d = new Date(s + 'T00:00:00'); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };
  const dShort = (s) => { if (!s) return nb.repeat(14); const d = new Date(s + 'T00:00:00'); return d.getFullYear() + '. ' + String(d.getMonth() + 1).padStart(2, '0') + '. ' + String(d.getDate()).padStart(2, '0'); };
  const ck = (on, label) => (on ? '☑' : '☐') + ' ' + label; const ul = (v, mw) => '<span class="ul" style="min-width:' + (mw || 90) + 'px;">' + (v ? esc(v) : nb) + '</span>'; const cell = (v) => (v === '' || v == null ? nb : esc(v));
  const wc = f.wageType === 'comprehensive'; const isNew = f.kind === 'new'; let sec = 0; const H = (t) => '<h2>' + (++sec) + '. ' + t + '</h2>';
  const items = [['통상임금', '기본근로수당', r.basic, '통상시급 ' + wh(r.hourly) + '원 × ' + OFFER_HB.toFixed(1) + '시간'], ['통상임금', '주휴수당', r.weekly, '통상시급 ' + wh(r.hourly) + '원 × ' + OFFER_HW.toFixed(2) + '시간']];
  if (r.etc) items.push(['고정수당', f.etcName ? esc(f.etcName) : '기타 고정수당', r.etc, '']); if (wc && r.fixedOT) items.push(['고정수당', '고정연장수당', r.fixedOT, '포괄 · 실근로와 무관하게 고정 지급']); if (wc && r.fixedNight) items.push(['고정수당', '고정야간수당', r.fixedNight, '포괄 · 실근로와 무관하게 고정 지급']);
  const grp = {}; items.forEach((i) => { grp[i[0]] = (grp[i[0]] || 0) + 1; }); const seen = {};
  const payRows = items.map((i) => { const first = !seen[i[0]]; seen[i[0]] = true; return '<tr>' + (first ? '<td class="c" rowspan="' + grp[i[0]] + '">' + i[0] + '</td>' : '') + '<td>' + i[1] + '</td><td class="r">' + w(i[2]) + '</td><td class="r">' + w(i[2] * 12) + '</td><td class="s">' + i[3] + '</td></tr>'; }).join('');
  const cmp = () => { if (isNew) return ''; const cur = Number(f.curSalary) || 0; const dlt = (a, b) => (b > 0 ? ((a - b >= 0 ? '+' : '−') + w(Math.abs(a - b))) : nb); const pct = (a, b) => (b > 0 ? ((a - b >= 0 ? '+' : '−') + Math.abs((a - b) / b * 100).toFixed(1) + '%') : nb); const curM = cur > 0 ? Math.round(cur / 12) : 0;
    return H('변경 내용 비교') + '<table class="f"><tr><th width="20%">항 목</th><th width="20%">현 재</th><th width="20%">제 안</th><th width="20%">증 감</th><th width="20%">증감률</th></tr><tr><td class="c">연봉 총액</td><td class="r">' + (cur > 0 ? w(cur) : nb) + '</td><td class="r">' + w(r.annual) + '</td><td class="r">' + dlt(r.annual, cur) + '</td><td class="r">' + pct(r.annual, cur) + '</td></tr><tr><td class="c">월 지급 총액</td><td class="r">' + (curM > 0 ? w(curM) : nb) + '</td><td class="r">' + w(r.monthly) + '</td><td class="r">' + dlt(r.monthly, curM) + '</td><td class="r">' + pct(r.monthly, curM) + '</td></tr><tr><td class="c">직위 / 직급</td><td class="c">' + cell(f.curRank) + '</td><td class="c">' + cell(f.rank) + '</td><td class="c" colspan="2">' + nb + '</td></tr></table>'; };
  const per = c.perCert || 50000; const certN = c.worker ? (c.worker.certifications || []).filter((x) => x && String(x).trim()).length : 0;
  const techLine = c.worker && certN > 0 ? '기술수당 : 보유 자격증 ' + certN + '개 × ' + w(per) + '원 = <b>월 ' + w(certN * per) + '원</b> (근로자 명부 자격증 등록 기준, 급여명세서 작성 시 자동 반영)' : '기술수당 : 국가기술자격증을 보유하고 해당 업무에 종사하는 경우 자격증 1개당 월 ' + w(per) + '원 지급 (상한 없음)';
  const travelLine = '여비교통비 : 실비변상적 성격으로 별도 지급 — 개인차량 40km 이내 1만원/일, 40km 초과 2만원/일, 회사차량 1만원/일(거리무관), 지방 장기출장 왕복교통비 실비(주 1회 한도)';
  const sepRow = f.sepNote ? '<tr><th>별도 지급</th><td>' + techLine + '<br>' + travelLine + '<div class="note" style="margin-top:4px;">※ 위 두 항목은 연봉 총액에 포함되지 않으며, 실제 지급액은 매월 급여명세서 작성 시 자동 계산됩니다.</div></td></tr>' : '';
  const ovt = wc ? '고정연장·고정야간수당은 실제 근로 여부와 관계없이 매월 고정 지급되며, 약정 시간을 초과한 근로에 대해서는 관계 법령에 따라 별도 정산합니다.' : '연장·야간·휴일근로수당은 위 연봉에 포함되어 있지 않으며, 실제 근무기록을 기준으로 매월 급여 정산 시 별도 산정하여 지급합니다.';
  const stamp = c.stamp ? '<img src="' + esc(c.stamp) + '" style="width:46px;height:46px;object-fit:contain;vertical-align:middle;margin-left:6px;">' : '';
  const probTxt = f.probation ? ck(false, '없음') + ' &nbsp; ' + ck(true, '있음 (' + esc(f.probation) + '개월)') : ck(true, '없음') + ' &nbsp; ' + ck(false, '있음 (' + nb.repeat(3) + '개월)');
  const hd = (n) => '<table class="hdr"><tr><td class="brand">' + (c.logo ? '<img src="' + esc(c.logo) + '" style="height:28px;width:auto;display:block;" alt="JH Solutions">' : 'JH SOLUTIONS') + '</td><td class="rt">' + n + '</td></tr></table>';
  const css = "@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#888;font-family:'Malgun Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif;color:#1A2540;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;align-items:center;gap:12px;padding:10px;background:#1A2540;color:#fff;font-size:13px}.toolbar button{background:#1D5BA6;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer}.a4{width:210mm;height:296mm;background:#fff;padding:13mm 16mm;margin:14px auto;box-shadow:0 4px 24px rgba(0,0,0,.25);overflow:hidden;font-size:9.5pt;line-height:1.5}.hdr{width:100%;border-collapse:collapse;margin-bottom:2px}.hdr td{font-size:8.5pt;color:#555;padding:0}.brand{font-weight:700;letter-spacing:2px;color:#1F3A5F;font-size:10pt!important}.rt{text-align:right}h1{text-align:center;font-size:22pt;letter-spacing:12px;margin:8px 0 4px;color:#1F3A5F;padding-bottom:8px;border-bottom:3px double #1F3A5F;font-weight:700}h2{font-size:10.5pt;margin:13px 0 5px;color:#1F3A5F;border-left:4px solid #1F3A5F;padding-left:7px;font-weight:700}.date{text-align:right;margin:6px 0 4px;font-size:9.5pt}table.f{width:100%;border-collapse:collapse}table.f th,table.f td{border:1px solid #888;padding:5px 7px;font-size:9.5pt;vertical-align:middle}table.f th{background:#E9EEF5;font-weight:700;text-align:center;color:#1F3A5F;white-space:nowrap}td.r{text-align:right}td.c{text-align:center}td.s{font-size:8pt;color:#555}tr.tot td{background:#F4F6F9;font-weight:700}tr.grand td{background:#1F3A5F;color:#fff;font-weight:700;font-size:10.5pt;border-color:#1F3A5F}.note{font-size:8pt;color:#666;margin:3px 0 0}.ul{display:inline-block;border-bottom:1px solid #555;text-align:center;padding:0 3px}ol.terms{margin:4px 0 0 16px;padding:0}ol.terms li{margin-bottom:3px;font-size:9pt}.box{border:1px solid #888;padding:9px 12px}.cut{border-top:1px dashed #777;margin:16px 0 8px;text-align:center;font-size:8pt;color:#777;padding-top:2px}.foot{text-align:center;font-size:8pt;color:#888;margin-top:8px}@media print{body{background:#fff}.toolbar{display:none}.a4{margin:0;box-shadow:none;page-break-after:always}.a4:last-child{page-break-after:auto}}";
  const page1 = '<div class="a4">' + hd('문서번호 : ' + ul('', 110)) + '<h1>연 봉 제 안 서</h1><div class="date">제안일 : ' + dLong(f.offerDate) + '</div>'
    + H('제안 구분') + '<table class="f"><tr><td style="padding:7px 12px;">' + ck(f.kind === 'new', '신규 입사') + ' &nbsp;&nbsp;&nbsp; ' + ck(f.kind === 'renew', '재계약') + ' &nbsp;&nbsp;&nbsp; ' + ck(f.kind === 'adjust', '연봉 조정 (인상 · 인하)') + '</td></tr></table>'
    + H('대상자 정보') + '<table class="f"><tr><th width="16%">성 명</th><td width="34%">' + cell(f.name) + '</td><th width="16%">소속 / 부서</th><td width="34%">' + cell(f.dept) + '</td></tr><tr><th>직위 / 직급</th><td>' + cell(f.rank) + '</td><th>' + (isNew ? '입사 예정일' : '입사일') + '</th><td>' + (f.hireDate ? dShort(f.hireDate) : nb) + '</td></tr><tr><th>담당 업무</th><td colspan="3">' + cell(f.job) + '</td></tr><tr><th>근무 현장</th><td colspan="3">' + cell(f.site) + '</td></tr></table>'
    + H('계약 조건') + '<table class="f"><tr><th width="16%">고용 형태</th><td colspan="3">' + ck(f.empKind === 'regular', '정규직') + ' &nbsp;&nbsp; ' + ck(f.empKind === 'contract', '계약직') + '</td></tr><tr><th>적용 기간</th><td width="34%">' + (f.startDate ? dShort(f.startDate) : nb.repeat(8)) + ' ~ ' + (f.endDate ? dShort(f.endDate) : nb.repeat(8)) + '</td><th width="16%">소정 근로</th><td>1일 ' + esc(f.hoursDay || '') + '시간 / 주 ' + esc(f.hoursWeek || '') + '시간</td></tr><tr><th>임금 형태</th><td>' + ck(!wc, '비포괄임금제') + ' &nbsp; ' + ck(wc, '포괄임금제') + '</td><th>수습 기간</th><td>' + probTxt + '</td></tr></table>'
    + H('연봉 내역 (세전)') + '<table class="f"><tr><th width="14%">구 분</th><th width="26%">항 목</th><th width="19%">월 지급액 (원)</th><th width="19%">연 환산액 (원)</th><th width="22%">비 고</th></tr>' + payRows + '<tr class="tot"><td class="c" colspan="2">합 계</td><td class="r">' + w(r.monthly) + '</td><td class="r">' + w(r.annual) + '</td><td>' + nb + '</td></tr><tr class="grand"><td class="c" colspan="2">연봉 총액 (세전)</td><td class="r" colspan="3">금 ' + w(r.annual) + ' 원 정</td></tr></table>'
    + '<div class="note">※ 통상시급 ' + wh(r.hourly) + '원 기준 · 월 소정근로 ' + OFFER_HB.toFixed(1) + '시간 + 주휴 ' + OFFER_HW.toFixed(2) + '시간 = ' + OFFER_HF.toFixed(2) + '시간. 연 환산액 = 월 지급액 × 12.</div>' + cmp() + '</div>';
  const page2 = '<div class="a4">' + hd('연봉 제안서 (2/2)') + H('기타 조건') + '<table class="f"><tr><th width="18%">급여 지급</th><td>연봉을 12개월로 균등 분할하여 ' + esc(f.payDay || '익월 말일') + '에 지급 (제세공과금 원천징수 후 급여 계좌 입금)</td></tr><tr><th>상여 · 성과급</th><td>' + (f.bonus ? esc(f.bonus) : ck(true, '없음')) + '</td></tr><tr><th>4대보험 · 퇴직금</th><td>관계 법령에 따라 가입 및 지급합니다.</td></tr><tr><th>휴일 · 휴가</th><td>근로기준법 및 회사 규정에 따릅니다.</td></tr>' + sepRow + '<tr><th>특약 사항</th><td style="height:' + (f.special ? 'auto' : '56px') + ';vertical-align:top;white-space:pre-wrap;">' + (f.special ? esc(f.special) : nb) + '</td></tr></table>'
    + H('유의 사항') + '<ol class="terms"><li>본 제안서는 연봉 조건을 안내하기 위한 문서이며, 정식 근로계약서 및 연봉계약서 체결 시 효력이 발생합니다.</li><li>연봉은 세전 금액이며, 소득세 · 4대보험료 등 법정 공제 후 지급됩니다.</li><li>본 제안 내용은 대상자와 회사 담당자 외에는 공개하지 않으며, 대상자 또한 타인에게 누설하지 않도록 협조하여 주시기 바랍니다.</li><li>회신 기한 : ' + dLong(f.replyDue) + '까지. 기한 내 회신이 없는 경우 본 제안은 철회된 것으로 볼 수 있습니다.</li><li>' + ovt + '</li></ol>'
    + H('제안자 (회사)') + '<div class="box"><table style="width:100%;border-collapse:collapse;font-size:10pt;"><tr><td width="18%" style="padding:4px 0;">회 사 명</td><td>' + esc(OFFER_CO) + '</td></tr><tr><td style="padding:4px 0;">대&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;표</td><td>' + esc(OFFER_CEO) + '&nbsp;&nbsp;&nbsp;&nbsp;(인)' + stamp + '</td></tr></table></div>'
    + '<div class="cut">✂ - - - - - - - - - - - - - - - - - - - - - 절 취 선 - - - - - - - - - - - - - - - - - - - - -</div><h1 style="font-size:17pt;letter-spacing:8px;margin-top:4px;">연 봉 제 안 회 신 서</h1><div class="box" style="margin-top:10px;"><p style="margin:2px 0 10px;">본인은 ' + esc(OFFER_CO) + '이(가) 제시한 연봉 제안 내용(연봉 총액 금 <b>' + w(r.annual) + '</b> 원, 세전)을 충분히 검토하였으며, 아래와 같이 회신합니다.</p><p style="text-align:center;margin:12px 0;">' + ck(false, '수락합니다') + ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ' + ck(false, '수락하지 않습니다') + '</p><table class="f" style="margin-top:8px;"><tr><th width="18%">의견 (선택)</th><td style="height:44px;">' + nb + '</td></tr></table><table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:10pt;"><tr><td width="18%" style="padding:4px 0;">회신일</td><td>' + dLong('') + '</td></tr><tr><td style="padding:4px 0;">성&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</td><td>' + ul(f.name, 150) + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(서명 또는 인)</td></tr></table></div><div class="foot">' + esc(OFFER_CO) + ' &nbsp;|&nbsp; 본 문서는 대외비입니다.</div></div>';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉 제안서' + (f.name ? ' - ' + esc(f.name) : '') + '</title><style>' + css + '</style></head><body><div class="toolbar"><button onclick="window.print()">🖨 인쇄 / PDF로 저장</button><span>인쇄 창에서 대상을 “PDF로 저장”으로 선택하세요 (A4 · 여백 없음 · 배경 그래픽 켜기)</span></div>' + page1 + page2 + '</body></html>';
}
