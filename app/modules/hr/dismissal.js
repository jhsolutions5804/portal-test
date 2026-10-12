/* 해고예고통지서 — 구포털(hr)과 같은 규칙·서식(d1). 근로기준법 제26조(30일 전 예고·예고수당)·제27조(사유·시기 서면통지) 절차 서류 작성을 돕는 도구다.
 * ⚠️ 해고는 정당한 이유가 있어야 유효하며(제23조) 이 서류만으로 정당해지지 않는다. 서면은 종이 교부가 원칙이라 이메일·문자 발송 기능은 두지 않는다. 실제 해고 전 노무사 확인을 권장한다.
 * 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다(DOM·Firebase 를 쓰지 않는다). */
export const DS_REASON = { discipline: '징계해고', management: '경영상 이유에 의한 해고', ordinary: '통상해고 (근로능력 부족·직무 부적합 등)', other: '기타' };
export const DS_EXEMPT = { under3m: '계속 근로한 기간이 3개월 미만인 경우', disaster: '천재·사변, 그 밖의 부득이한 사유로 사업을 계속하는 것이 불가능한 경우', willful: '근로자가 고의로 사업에 막대한 지장을 초래하거나 재산상 손해를 끼친 경우 (고용노동부령으로 정하는 사유)' };
export const DS_DELIVERY = ['직접 교부(수령 서명)', '내용증명 우편', '기타'];
export const DS_TPL_VER = 'd1';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = (s) => { if (!s) return null; const t = String(s).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null; const d = new Date(t + 'T00:00:00'); return Number.isNaN(d.getTime()) || ymd(d) !== t ? null : d; };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000);
export const korDate = (s) => { const d = parse(s); return d ? d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일' : '____년 __월 __일'; };
export const wonText = (v) => '₩' + Math.round(Number(v) || 0).toLocaleString('ko-KR');

export const dsNewForm = (today) => { const t = today || ymd(new Date()); return { id: '', workerId: '', noticeDate: t, dismissalDate: ymd(addDays(parse(t), 30)), reasonType: 'discipline', reasonDetail: '', ruleRef: '', exemptType: '', hourly: '', deliveryMethod: DS_DELIVERY[0], note: '' }; };
/** 통상시급 자동 조회: 연봉계약서 → 근로계약서 순으로 시급이 있는 가장 최근 계약(계약일, 없으면 문서 번호 기준)의 시급 */
export function dsFindHourly(annual, labor) {
  for (const list of [annual, labor]) { let best = null; (list || []).forEach((v) => { const key = String(v.contractDate || v.id || ''); if (Number(v.hourly) && (!best || key > best.key)) best = { key, hourly: Number(v.hourly) }; }); if (best) return best.hourly; }
  return 0;
}
/** 예고기간(통지일 다음 날 ~ 해고일, 초일불산입)·부족일수·해고예고수당 */
export function dsCalc(f, worker) {
  const n = parse(f.noticeDate), d = parse(f.dismissalDate); if (!n || !d) return { ok: false };
  const days = diffDays(n, d); const hourly = Number(f.hourly) || 0, daily = Math.round(hourly * 8); const exempt = !!f.exemptType; const shortDays = exempt ? 0 : Math.max(0, 30 - days);
  const hd = worker ? parse(worker.hireDate) : null; const tenureMonths = hd ? (n.getFullYear() - hd.getFullYear()) * 12 + (n.getMonth() - hd.getMonth()) - (n.getDate() < hd.getDate() ? 1 : 0) : null;
  return { ok: true, days, hourly, daily, exempt, shortDays, allowance: shortDays * daily, tenureMonths };
}
/** 계산 결과 안내 줄: [{tone: bad|warn|ok|info, html}] */
export function dsMessages(c) {
  if (!c.ok) return [{ tone: 'mute', html: '통지일과 해고일을 입력하면 예고기간이 계산됩니다.' }];
  const out = []; out.push(c.days <= 0 ? { tone: 'bad', html: '❌ 해고일은 통지일 이후여야 합니다.' } : { tone: 'info', html: '예고기간 <b>' + c.days + '일</b> (통지일 다음 날 ~ 해고일, 초일불산입)' });
  if (c.tenureMonths != null && c.tenureMonths < 3) out.push({ tone: 'warn', html: '근속 ' + Math.max(c.tenureMonths, 0) + '개월 — <b>3개월 미만</b>이면 해고예고 적용 예외(제26조 제1호)일 수 있습니다. 아래 예외 사유에서 선택하세요.' });
  if (c.days > 0) {
    if (c.exempt) out.push({ tone: 'ok', html: '✅ 예고 예외 적용 — 해고예고수당 없음' }); else if (c.days >= 30) out.push({ tone: 'ok', html: '✅ 30일 이상 예고 — 해고예고수당 없음' });
    else if (c.daily) out.push({ tone: 'warn', html: '⚠️ 예고기간 ' + c.shortDays + '일 부족 → <b>해고예고수당 ' + wonText(c.allowance) + '</b> (통상일급 ' + wonText(c.daily) + ' × ' + c.shortDays + '일)' });
    else out.push({ tone: 'warn', html: '⚠️ 예고기간 ' + c.shortDays + '일 부족 — 해고예고수당 산정을 위해 통상시급을 입력하세요.' });
  }
  return out;
}
/** 저장·발행 전 검사. issue=true(발행)이면 사유 구체성·수당 산정 가능 여부까지 확인 */
export function dsValidate(f, worker, c, issue) {
  if (!worker) return { ok: false, error: '대상 근로자를 선택해 주세요.' };
  if (!c.ok || c.days <= 0) return { ok: false, error: '통지일과 해고일을 확인해 주세요. 해고일은 통지일 이후여야 합니다.' };
  if (issue) {
    if (String(f.reasonDetail || '').trim().length < 15) return { ok: false, error: '해고 사유를 구체적으로 적어 주세요. (근로자가 사유를 알 수 있을 정도로 구체적인 사실이 필요합니다)' };
    if (!f.exemptType && c.days < 30 && !c.daily) return { ok: false, error: '예고기간이 30일 미만입니다. 해고예고수당 산정을 위해 통상시급을 입력해 주세요.' };
  }
  return { ok: true, error: '' };
}
/** 저장할 문서(양식 버전 d1 동결) */
export function dsBuildData(f, w, c, issue) {
  return { workerId: w.id, workerName: w.name || '', empNo: w.empNo || '', dept: w.dept || '', rank: w.rank || '', hireDate: w.hireDate || '', noticeDate: f.noticeDate, dismissalDate: f.dismissalDate, reasonType: f.reasonType, reasonDetail: String(f.reasonDetail || '').trim(), ruleRef: String(f.ruleRef || '').trim(), exemptType: f.exemptType || '', hourly: c.hourly, dailyWage: c.daily, noticeDays: c.days, shortDays: c.shortDays, allowance: c.allowance, deliveryMethod: f.deliveryMethod, note: String(f.note || '').trim(), status: issue ? 'issued' : 'draft', tplVer: DS_TPL_VER };
}
/** 임시저장 → 이어쓰기 양식 */
export function dsFormFromDraft(d, today) { const t = today || ymd(new Date()); return { id: d.id, workerId: d.workerId || '', noticeDate: d.noticeDate || t, dismissalDate: d.dismissalDate || '', reasonType: d.reasonType || 'discipline', reasonDetail: d.reasonDetail || '', ruleRef: d.ruleRef || '', exemptType: d.exemptType || '', hourly: d.hourly ? String(d.hourly) : '', deliveryMethod: d.deliveryMethod || DS_DELIVERY[0], note: d.note || '' }; }
/** 통지서 A4 (양식 d1) — ctx.stamp: 직인 이미지 data URL(없으면 점선 (인)) */
export function dsHtmlD1(d, ctx) {
  const c = ctx || {}; const ck = (on, t) => (on ? '☑' : '☐') + ' ' + t; const dm = String(d.deliveryMethod || ''); const reasonLabel = DS_REASON[d.reasonType] || '';
  let allowTxt; if (d.exemptType) allowTxt = '해당 없음 — ' + esc(DS_EXEMPT[d.exemptType] || '') + ' (근로기준법 제26조 단서)'; else if (Number(d.noticeDays) >= 30) allowTxt = '해당 없음 (30일 이상 전에 예고함)';
  else allowTxt = '예고기간이 30일에 ' + (Number(d.shortDays) || 0) + '일 부족하여, 통상임금 ' + (Number(d.shortDays) || 0) + '일분 <b>' + wonText(d.allowance) + '</b> (통상일급 ' + wonText(d.dailyWage) + ' × ' + (Number(d.shortDays) || 0) + '일)을 해고일에 지급합니다.';
  const sig = c.stamp ? '<img src="' + esc(c.stamp) + '" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:.9;">' : '<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>';
  const company = '<div style="margin-top:26px;text-align:right;line-height:2;"><p style="margin:0;">사업체명 : 제이에이치솔루션</p><p style="margin:0;">대&nbsp;&nbsp;&nbsp;표 : 김 종 화 &nbsp;' + sig + '</p><p style="margin:0;">사업자번호 : 383-09-02847</p></div>';
  const body = '<h1>해 고 예 고 통 지 서</h1><div class="ul"></div><table class="kv"><tr><th>성 명</th><td>' + esc(d.workerName) + '</td><th style="width:90px;">사원번호</th><td>' + (esc(d.empNo) || '-') + '</td></tr><tr><th>소속 · 직급</th><td>' + (esc(d.dept) || '-') + ' / ' + (esc(d.rank) || '-') + '</td><th>입사일</th><td>' + korDate(d.hireDate) + '</td></tr></table>'
    + '<p style="margin:16px 0 8px;">귀하에 대하여 「근로기준법」 제26조에 따라 아래와 같이 해고를 예고하며, 같은 법 제27조에 따라 해고사유와 해고시기를 서면으로 통지합니다.</p>'
    + '<table class="kv"><tr><th>통 지 일</th><td>' + korDate(d.noticeDate) + '</td></tr><tr><th>해고 시기<br>(해고일)</th><td>' + korDate(d.dismissalDate) + ' <span style="color:#555;">(통지일로부터 ' + (Number(d.noticeDays) || 0) + '일 후)</span></td></tr><tr><th>해고 사유</th><td><b>' + esc(reasonLabel) + '</b><div style="white-space:pre-wrap;margin-top:6px;">' + esc(d.reasonDetail) + '</div></td></tr>' + (d.ruleRef ? '<tr><th>근거 규정</th><td>' + esc(d.ruleRef) + '</td></tr>' : '') + '<tr><th>해고예고수당</th><td>' + allowTxt + '</td></tr></table>'
    + '<p style="font-size:10pt;color:#333;margin:10px 0 0;">※ 본 통지서는 「근로기준법」 제26조에 따른 해고의 예고와 제27조에 따른 해고사유·해고시기의 서면통지를 겸합니다.</p>' + company
    + '<div class="box"><div style="font-weight:700;">수령 확인</div>위 해고예고통지서를 수령하였음을 확인합니다.<br>수령일 : ________년 ____월 ____일 &nbsp;&nbsp;&nbsp; 성명 : ____________________ (서명 또는 인)<div style="margin-top:6px;font-size:9.5pt;color:#333;">교부 방법 : ' + ck(/직접/.test(dm), '직접 교부') + ' &nbsp; ' + ck(/우편/.test(dm), '내용증명 우편') + ' &nbsp; ' + ck(!/직접|우편/.test(dm), '기타') + '</div><div style="margin-top:6px;font-size:9.5pt;color:#333;">※ 수령을 거부한 경우 — 교부 일시·장소 : ______________________ / 입회인 : ____________ (서명)</div></div>';
  const title = '해고예고통지서 - ' + (d.workerName || '');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(title) + "</title><style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.8;color:#1A2540;box-sizing:border-box;}h1{text-align:center;font-size:20pt;letter-spacing:6px;margin:0 0 6px;}.ul{width:60px;height:2px;background:#333;margin:8px auto 24px;}table.kv{width:100%;border-collapse:collapse;margin:10px 0;}table.kv th{border:1px solid #333;background:#F0F3F8;padding:7px 10px;width:130px;text-align:left;font-size:10pt;vertical-align:top;}table.kv td{border:1px solid #333;padding:7px 10px;font-size:10pt;vertical-align:top;}.box{border:1px solid #333;padding:10px 14px;margin-top:18px;font-size:10pt;line-height:2;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style></head><body><div class=\"toolbar\" style=\"margin-bottom:12px;display:flex;gap:8px;\"><button onclick=\"window.close()\" style=\"padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;\">← 닫기</button><button onclick=\"window.print()\" style=\"padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;\">🖨 인쇄/PDF</button></div><div class=\"a4\">" + body + '</div></body></html>';
}
/** 저장된 양식 버전으로 출력(옛 버전을 나중에 바꿔도 이미 발행한 서류는 그대로 — 양식 동결) */
const TPL = { d1: dsHtmlD1 };
export const dsHtmlByVer = (d, ctx) => (TPL[d.tplVer] || TPL.d1)(d, ctx);
