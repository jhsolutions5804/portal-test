/* ⚠️ 자동 생성 파일 — 직접 수정 금지(동결). 생성기: scripts/dev/build_frozen_docs.mjs
 * 구포털 hr 의 "저장 서류 양식 동결" 블록(근로계약서·연봉계약서·급여명세서 v0~v5)을 원본 그대로 옮겼다.
 * 원칙(원문): 서명·저장이 끝난 서류는 어떠한 경우에도 내용이 바뀌면 안 된다 — 저장 서류는 "저장 당시 양식(tplVer)"으로만 그린다.
 * 새 양식이 필요하면 이 파일의 함수를 고치지 말고 새 버전(v6…)을 따로 추가하고 DOC_TPL_CURRENT 를 올린다.
 * 바깥 의존: 직인 이미지(_compSignatures: company_settings/signatures)·로고(JH_LOGO) — configureFrozenDocs() 로 넣는다. */
let _compSignatures = {};
let JH_LOGO = '';
const psWonR = v => '₩'+Math.round(v||0).toLocaleString();
const PS_TRAVEL_PER_DAY = { personal_near: 10000, personal_far: 20000, company_car: 10000 };
const PS_TRAVEL_TYPE_LABEL = {
  personal_near: '🚗 개인차량 · 40km 이내 (1만원/일)',
  personal_far: '🚗 개인차량 · 40km 초과 (2만원/일)',
  company_car: '🚙 회사차량 (거리무관 1만원/일)',
  longtrip: '🚄 지방장기출장 · 왕복KTX 실비',
};
/** 직인(company_settings/signatures 의 문서 내용)과 로고 이미지 주소를 넣는다 */
export function configureFrozenDocs(o) { const x = o || {}; if (x.signatures !== undefined) _compSignatures = x.signatures || {}; if (x.logo !== undefined) JH_LOGO = x.logo || ''; }
const DOC_TPL_CURRENT = 'v6';
const DOC_TPL_ERAS = [
  { ver:'v1', from:'2026-08-29T16:47:27+09:00' },
  { ver:'v2', from:'2026-09-01T11:33:06+09:00' },
  { ver:'v3', from:'2026-09-02T17:20:58+09:00' },
  { ver:'v4', from:'2026-09-23T18:00:00+09:00' },
  { ver:'v5', from:'2026-09-23T19:00:00+09:00' },
  { ver:'v6', from:'2026-10-01T18:00:50+09:00' },
];
const DOC_TPL_HISTORY = [
  { ver:'v0', from:null, payslip:'포괄임금제 양식 — 고정연장/고정야간수당 항목', labor:'포괄임금제 양식', annual:'포괄임금제 양식' },
  { ver:'v1', from:'2026-08-29T16:47:27+09:00', payslip:'실근무 기반 연장/야간/휴일수당 항목으로 전환(비포괄)', labor:'비포괄 전환', annual:'비포괄 안내문구 추가' },
  { ver:'v2', from:'2026-09-01T11:33:06+09:00', payslip:'기술수당·여비교통비 항목 추가', labor:'제2조의2·제4조(여비교통비/기술수당) 조항 보강', annual:'조항 보강' },
  { ver:'v3', from:'2026-09-02T17:20:58+09:00', payslip:'여비교통비 다중 유형 지원', labor:'포괄/비포괄 선택(wageType) 도입', annual:'포괄/비포괄 선택 도입' },
  { ver:'v4', from:'2026-09-23T18:00:00+09:00', payslip:'내용 변경 없음 (버전 동기화만)', labor:'개인정보 제3자 제공 동의서(별지) 자동 첨부', annual:'내용 변경 없음 (버전 동기화만)' },
  { ver:'v5', from:'2026-09-23T19:00:00+09:00', payslip:'내용 변경 없음 (버전 동기화만)', labor:'파견법 연상 표현("근로자보호 등에 관한 법률" 등) 삭제', annual:'내용 변경 없음 (버전 동기화만)' },
  { ver:'v6', from:'2026-10-01T18:00:50+09:00', payslip:'내용 변경 없음 (버전 동기화만)', labor:'제8조 퇴직금(4대보험 미가입 시 불지급 삭제·법정 요건 명시)·제12조 손해배상(월급 3배 예정 삭제)·제18조 지급품(급여 임의 공제 삭제) 정비', annual:'내용 변경 없음 (버전 동기화만)' },
];
function docTplVer(d) {
  if (d && d.tplVer) return d.tplVer;
  const t = Date.parse((d && d.savedAt) || '');
  if (isNaN(t)) return 'v0'; // 저장시각 없는 문서 = 비포괄 전환 이전에 작성된 문서
  let ver = 'v0';
  for (const e of DOC_TPL_ERAS) { if (t >= Date.parse(e.from)) ver = e.ver; }
  return ver;
}
function __psSavedPs(d) {
  const items = (d.travelItems && d.travelItems.length) ? d.travelItems
    : (d.travelType ? [d.travelType==='longtrip' ? {type:'longtrip',tripCount:d.travelTripCount||1,perTrip:d.travelPerTrip||0} : {type:d.travelType,days:d.travelDays||1}] : []);
  return {
    workerData: { name:d.name||'', dept:d.dept||'', rank:d.rank||'', empNo:d.empNo||'', hireDate:'', jumin:'', empType:d.empType||'field' },
    month:d.month||'', payDate:d.payDate||'', bankAccount:d.bankAccount||'',
    travelItems:items, _travelType:d.travelType||'', travelDays:d.travelDays||1, travelTripCount:d.travelTripCount||1, travelPerTrip:d.travelPerTrip||0,
  };
}
function __psSavedC(d) {
  const N = v => Number(v)||0;
  const sal = {
    basic:N(d.basic), fixedOt:N(d.fixedOt), fixedNight:N(d.fixedNight), weekly:N(d.weekly), holidayPay:N(d.holidayPay),
    total:N(d.basic)+N(d.fixedOt)+N(d.fixedNight)+N(d.weekly)+N(d.holidayPay),
    attHours:N(d.attHours), leaveHours:N(d.leaveHours), nightHours:N(d.nightHours), actualHours:N(d.actualHours), standardHours:d.standardHours,
    otHours:N(d.otHours), shortHours:N(d.shortHours), shortDeduct:N(d.shortDeduct), holidayHours:N(d.holidayHours),
    weeklyQualifyingWeeks:d.weeklyQualifyingWeeks, weeklyTotalWeeks:d.weeklyTotalWeeks,
    weeklyEstimated: d.weeklyEstimated!==undefined ? !!d.weeklyEstimated : (d.weeklyQualifyingWeeks==null),
  };
  return { sal, bonus:N(d.bonus), specialBonus:N(d.specialBonus), extraPay:N(d.extraPay), techAllowance:N(d.techAllowance), travelAllowance:N(d.travelAllowance),
    totalPay:N(d.grossPay), pension:N(d.pension), health:N(d.health), ltcare:N(d.ltcare), employ:N(d.employ), dormitory:N(d.dormitory),
    incomeTax:N(d.incomeTax), localTax:N(d.localTax), totalDeduct:N(d.totalDeduct), netPay:N(d.netPay) };
}
function __calcAnnualSalary_v0(hourly, empType) {
  if (!hourly) return { basic:0, fixedOt:0, fixedNight:0, weekly:0, total:0, annual:0 };
  const h = Number(hourly);
  if (empType === 'office') {
    const basic      = Math.round(h * 8 * 5 * 4.345);
    const fixedOt    = Math.round(h * 12 * 4.345);
    const fixedNight = 0;
    const weekly     = Math.round(h * 8 * 4.345);
    const total      = basic + fixedOt + fixedNight + weekly;
    return { basic, fixedOt, fixedNight, weekly, total, annual: total * 12 };
  } else {
    const basic      = Math.round(h * 8 * 5 * 4.345);
    const fixedOt    = 0;
    const fixedNight = Math.round(h * 0.5 * 8 * 5 * 4.345);
    const weekly     = Math.round(h * 8 * 4.345);
    const total      = basic + fixedOt + fixedNight + weekly;
    return { basic, fixedOt, fixedNight, weekly, total, annual: total * 12 };
  }
}
function __calcAnnualSalary_v1(hourly, empType) {
  if (!hourly) return { basic:0, fixedOt:0, fixedNight:0, weekly:0, total:0, annual:0 };
  const h = Number(hourly);
  // 포괄임금제 폐지: 고정연장·고정야간수당은 더 이상 연봉계약서에 고정값으로 포함하지 않는다.
  // 실제 연장·야간근로수당은 매달 실제 근무기록을 기준으로 급여명세서 작성 시 자동 계산된다 (psCalcAll 참고).
  const basic      = Math.round(h * 8 * 5 * 4.345);
  const fixedOt    = 0;
  const fixedNight = 0;
  const weekly     = Math.round(h * 8 * 4.345);
  const total       = basic + fixedOt + fixedNight + weekly;
  return { basic, fixedOt, fixedNight, weekly, total, annual: total * 12 };
}
function __annualHtml_v0(f0){
  const f=f0; const sal=__calcAnnualSalary_v0(Number(f.hourly||0), f.empType||'field');
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const tr=(l,a,b)=>`<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">${l}</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">${a}</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">${b}</td></tr>`;
  const w=v=>v?`₩${Number(v).toLocaleString()}`:'';
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,100)} (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 (연봉계약기간)</p>
      <p style="margin-bottom:4px;">① 직원의 연봉계약기간은 ${fmtDp(f.startDate)} 부터 ${fmtDp(f.endDate)}까지(12개월)로 한다.</p>
      <p style="margin-bottom:4px;">② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.</p>
      <p style="margin-bottom:10px;">③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 (연봉의 구성)</p>
      <p style="margin-bottom:6px;">① 계약 연봉은 ${f.salary?`금 ${Number(f.salary).toLocaleString()}원`:'금 ____________원'}으로 한다.</p>
      <p style="margin-bottom:8px;">② 월급여 임금 구성:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead>
        <tbody>${f.empType==='office'
          ? tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')+tr('고정연장수당',w(sal.fixedOt),'시급×12×4.345')+tr('고정야간수당','—','—')+tr('주휴수당',w(sal.weekly),'시급×8×4.345')
          : tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')+tr('고정연장수당','—','—')+tr('고정야간수당',w(sal.fixedNight),'시급×0.5×8×5×4.345')+tr('주휴수당',w(sal.weekly),'시급×8×4.345')
        }${tr('상여금','','회사 내규에 따름')}${tr('특별성과급','','회사 내규에 따름')}${tr('특근수당','','주말, 공휴일 출근 시 지급')}
        <tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">${w(sal.total)}</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr></tbody>
      </table>
      <p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 (지급시기 및 방법)</p>
      <p style="margin-bottom:4px;">① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.</p>
      <p style="margin-bottom:4px;">② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.</p>
      <p style="margin-bottom:10px;">③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 (기밀유지)</p>
      <p style="margin-bottom:10px;">직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 ~ 제7조</p>
      <p style="margin-bottom:20px;">효력정지, 기타사항, 근로계약서 교부에 관한 사항은 당사 취업규칙 및 근로기준법에 준한다.</p>
      <p style="font-weight:600;margin-bottom:20px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,150)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __annualHtml_v1(f0){
  const f=f0; const sal=__calcAnnualSalary_v1(Number(f.hourly||0), f.empType||'field');
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const tr=(l,a,b)=>`<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">${l}</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">${a}</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">${b}</td></tr>`;
  const w=v=>v?`₩${Number(v).toLocaleString()}`:'';
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,100)} (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 (연봉계약기간)</p>
      <p style="margin-bottom:4px;">① 직원의 연봉계약기간은 ${fmtDp(f.startDate)} 부터 ${fmtDp(f.endDate)}까지(12개월)로 한다.</p>
      <p style="margin-bottom:4px;">② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.</p>
      <p style="margin-bottom:10px;">③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 (연봉의 구성)</p>
      <p style="margin-bottom:6px;">① 계약 연봉은 ${f.salary?`금 ${Number(f.salary).toLocaleString()}원`:'금 ____________원'}으로 한다.</p>
      <p style="margin-bottom:8px;">② 월급여 임금 구성:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead>
        <tbody>${tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')}${tr('주휴수당',w(sal.weekly),'시급×8×4.345')
        }${tr('상여금','','회사 내규에 따름')}${tr('특별성과급','','회사 내규에 따름')}${tr('특근수당','','주말, 공휴일 출근 시 지급')}
        <tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">${w(sal.total)}</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr></tbody>
      </table>
      <p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용하지 않습니다. 기본근로수당은 월 209시간을 기준으로 산정하되, 연장근로수당(해당 월 소정근로시간 초과분에 대해 통상시급의 1.5배)과 야간근로수당(22:00~06:00 근로시간에 대해 통상시급의 0.5배 가산)은 매월 실제 근무기록을 기준으로 산정하여 별도 지급합니다.</p>
      <p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 (지급시기 및 방법)</p>
      <p style="margin-bottom:4px;">① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.</p>
      <p style="margin-bottom:4px;">② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.</p>
      <p style="margin-bottom:10px;">③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 (기밀유지)</p>
      <p style="margin-bottom:10px;">직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 ~ 제7조</p>
      <p style="margin-bottom:20px;">효력정지, 기타사항, 근로계약서 교부에 관한 사항은 당사 취업규칙 및 근로기준법에 준한다.</p>
      <p style="font-weight:600;margin-bottom:20px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,150)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __annualHtml_v2(f0){
  const f=f0; const sal=__calcAnnualSalary_v1(Number(f.hourly||0), f.empType||'field');
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const tr=(l,a,b)=>`<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">${l}</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">${a}</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">${b}</td></tr>`;
  const w=v=>v?`₩${Number(v).toLocaleString()}`:'';
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,100)} (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 (연봉계약기간)</p>
      <p style="margin-bottom:4px;">① 직원의 연봉계약기간은 ${fmtDp(f.startDate)} 부터 ${fmtDp(f.endDate)}까지(12개월)로 한다.</p>
      <p style="margin-bottom:4px;">② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.</p>
      <p style="margin-bottom:10px;">③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 (연봉의 구성)</p>
      <p style="margin-bottom:6px;">① 계약 연봉은 ${f.salary?`금 ${Number(f.salary).toLocaleString()}원`:'금 ____________원'}으로 한다.</p>
      <p style="margin-bottom:8px;">② 월급여 임금 구성:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead>
        <tbody>${tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')}${tr('주휴수당',w(sal.weekly),'시급×8×4.345')
        }${tr('상여금','','회사 내규에 따름')}${tr('특별성과급','','회사 내규에 따름')}${tr('특근수당','','주말, 공휴일 출근 시 지급')}
        <tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">${w(sal.total)}</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr></tbody>
      </table>
      <p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용하지 않습니다. 기본근로수당은 월 209시간을 기준으로 산정하되, 연장근로수당(해당 월 소정근로시간 초과분에 대해 통상시급의 1.5배)과 야간근로수당(22:00~06:00 근로시간에 대해 통상시급의 0.5배 가산)은 매월 실제 근무기록을 기준으로 산정하여 별도 지급합니다.</p>
      <p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조의2 (여비교통비 및 기술수당)</p>
      <p style="margin-bottom:4px;">① 회사는 근로자가 업무상 이동에 소요한 비용을 실비변상적 성격의 여비교통비로 별도 지급한다. 이는 근로기준법 시행령상 임금(통상임금·평균임금)에 산입되지 않는 실비변상적 금품으로, 4대보험 산정 기준에서 제외한다.</p>
      <p style="margin-bottom:4px;">② 여비교통비 지급 기준(개인차량 이용 시 사무실 기준 편도거리)은 다음과 같다: 40km 이내 1만원, 40km 초과 2만원. 회사차량 이용 시에는 이동거리와 무관하게 1만원을 고정 지급한다.</p>
      <p style="margin-bottom:4px;">③ 지방 장기출장으로 회사가 숙소를 별도 지급하는 경우, 일비(1만원)를 지급하지 않는 대신 왕복 교통비(KTX 기준 실비)를 지급하며, 이는 <b>주 1회를 한도</b>로 한다.</p>
      <p style="margin-bottom:4px;">④ 근로자가 관련 국가기술자격증을 보유하고 그 업무에 종사하는 경우, 회사는 월 5만원의 기술수당을 별도 지급한다. 자격증의 종류 및 인정 범위는 회사 내규에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 (지급시기 및 방법)</p>
      <p style="margin-bottom:4px;">① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.</p>
      <p style="margin-bottom:4px;">② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.</p>
      <p style="margin-bottom:10px;">③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 (기밀유지)</p>
      <p style="margin-bottom:10px;">직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 (계약의 효력정지 및 해지)</p>
      <p style="margin-bottom:4px;">① "을"이 휴직, 정직 등 근로 제공이 정지되는 사유가 발생한 경우, 그 기간 동안 본 계약의 효력은 정지된다.</p>
      <p style="margin-bottom:10px;">② 근로계약이 해지되거나 종료되는 경우, 본 연봉계약도 동시에 종료된 것으로 본다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제6조 (기타사항)</p>
      <p style="margin-bottom:4px;">① 본 계약에 명시되지 않은 사항은 근로기준법, 회사 취업규칙 및 관련 법령이 정하는 바에 따른다.</p>
      <p style="margin-bottom:10px;">② 본 계약의 내용은 "갑"과 "을" 쌍방의 서면 합의에 의해서만 변경할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제7조 (계약서 교부)</p>
      <p style="margin-bottom:20px;">본 계약서는 2부를 작성하여 "갑"과 "을"이 각각 서명 또는 날인한 후 1부씩 보관한다.</p>
      <p style="font-weight:600;margin-bottom:20px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,150)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __annualHtml_v3(f0){
  const f=f0; const sal=__calcAnnualSalary_v1(Number(f.hourly||0), f.empType||'field');
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const tr=(l,a,b)=>`<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">${l}</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">${a}</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">${b}</td></tr>`;
  const w=v=>v?`₩${Number(v).toLocaleString()}`:'';
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,100)} (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 (연봉계약기간)</p>
      <p style="margin-bottom:4px;">① 직원의 연봉계약기간은 ${fmtDp(f.startDate)} 부터 ${fmtDp(f.endDate)}까지(12개월)로 한다.</p>
      <p style="margin-bottom:4px;">② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.</p>
      <p style="margin-bottom:10px;">③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 (연봉의 구성)</p>
      <p style="margin-bottom:6px;">① 계약 연봉은 ${f.salary?`금 ${Number(f.salary).toLocaleString()}원`:'금 ____________원'}으로 한다.</p>
      <p style="margin-bottom:8px;">② 월급여 임금 구성:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead>
        <tbody>${tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')}${tr('주휴수당',w(sal.weekly),'시급×8×4.345')
        }${f.wageType==='comprehensive'?tr('고정연장수당',w(f.fixedOT),'포괄임금제 — 실근무와 무관하게 매월 고정 지급')+tr('고정야간수당',w(f.fixedNight),'포괄임금제 — 실근무와 무관하게 매월 고정 지급'):''
        }${tr('상여금','','회사 내규에 따름')}${tr('특별성과급','','회사 내규에 따름')}${tr('특근수당','','주말, 공휴일 출근 시 지급')}
        <tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">${w(f.wageType==='comprehensive'?(Number(sal.total||0)+Number(f.fixedOT||0)+Number(f.fixedNight||0)):sal.total)}</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr></tbody>
      </table>
      ${f.wageType==='comprehensive'
        ? `<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용합니다. 근로자 본인의 선택에 따라 연장근로수당·야간근로수당을 위 표의 고정액으로 매월 실제 근무시간과 무관하게 지급하며, 다음 연봉계약 갱신 전까지 동일하게 적용합니다.</p>`
        : `<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용하지 않습니다. 기본근로수당은 월 209시간을 기준으로 산정하되, 연장근로수당(해당 월 소정근로시간 초과분에 대해 통상시급의 1.5배)과 야간근로수당(22:00~06:00 근로시간에 대해 통상시급의 0.5배 가산)은 매월 실제 근무기록을 기준으로 산정하여 별도 지급합니다.</p>`}
      <p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조의2 (여비교통비 및 기술수당)</p>
      <p style="margin-bottom:4px;">① 회사는 근로자가 업무상 이동에 소요한 비용을 실비변상적 성격의 여비교통비로 별도 지급한다. 이는 근로기준법 시행령상 임금(통상임금·평균임금)에 산입되지 않는 실비변상적 금품으로, 4대보험 산정 기준에서 제외한다.</p>
      <p style="margin-bottom:4px;">② 여비교통비 지급 기준(개인차량 이용 시 사무실 기준 편도거리)은 다음과 같다: 40km 이내 1만원, 40km 초과 2만원. 회사차량 이용 시에는 이동거리와 무관하게 1만원을 고정 지급한다.</p>
      <p style="margin-bottom:4px;">③ 지방 장기출장으로 회사가 숙소를 별도 지급하는 경우, 일비(1만원)를 지급하지 않는 대신 왕복 교통비(KTX 기준 실비)를 지급하며, 이는 <b>주 1회를 한도</b>로 한다.</p>
      <p style="margin-bottom:4px;">④ 근로자가 관련 국가기술자격증을 보유하고 그 업무에 종사하는 경우, 회사는 월 5만원의 기술수당을 별도 지급한다. 자격증의 종류 및 인정 범위는 회사 내규에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 (지급시기 및 방법)</p>
      <p style="margin-bottom:4px;">① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.</p>
      <p style="margin-bottom:4px;">② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.</p>
      <p style="margin-bottom:10px;">③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 (기밀유지)</p>
      <p style="margin-bottom:10px;">직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 (계약의 효력정지 및 해지)</p>
      <p style="margin-bottom:4px;">① "을"이 휴직, 정직 등 근로 제공이 정지되는 사유가 발생한 경우, 그 기간 동안 본 계약의 효력은 정지된다.</p>
      <p style="margin-bottom:10px;">② 근로계약이 해지되거나 종료되는 경우, 본 연봉계약도 동시에 종료된 것으로 본다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제6조 (기타사항)</p>
      <p style="margin-bottom:4px;">① 본 계약에 명시되지 않은 사항은 근로기준법, 회사 취업규칙 및 관련 법령이 정하는 바에 따른다.</p>
      <p style="margin-bottom:10px;">② 본 계약의 내용은 "갑"과 "을" 쌍방의 서면 합의에 의해서만 변경할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제7조 (계약서 교부)</p>
      <p style="margin-bottom:20px;">본 계약서는 2부를 작성하여 "갑"과 "을"이 각각 서명 또는 날인한 후 1부씩 보관한다.</p>
      <p style="font-weight:600;margin-bottom:20px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,150)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __annualHtml_v4(f0){
  // v4: 내용 변경 없음(근로계약서 동의서 별지 추가에 따른 버전 동기화)
  const f=f0; const sal=__calcAnnualSalary_v1(Number(f.hourly||0), f.empType||'field');
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const tr=(l,a,b)=>`<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">${l}</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">${a}</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">${b}</td></tr>`;
  const w=v=>v?`₩${Number(v).toLocaleString()}`:'';
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,100)} (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 (연봉계약기간)</p>
      <p style="margin-bottom:4px;">① 직원의 연봉계약기간은 ${fmtDp(f.startDate)} 부터 ${fmtDp(f.endDate)}까지(12개월)로 한다.</p>
      <p style="margin-bottom:4px;">② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.</p>
      <p style="margin-bottom:10px;">③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 (연봉의 구성)</p>
      <p style="margin-bottom:6px;">① 계약 연봉은 ${f.salary?`금 ${Number(f.salary).toLocaleString()}원`:'금 ____________원'}으로 한다.</p>
      <p style="margin-bottom:8px;">② 월급여 임금 구성:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead>
        <tbody>${tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')}${tr('주휴수당',w(sal.weekly),'시급×8×4.345')
        }${f.wageType==='comprehensive'?tr('고정연장수당',w(f.fixedOT),'포괄임금제 — 실근무와 무관하게 매월 고정 지급')+tr('고정야간수당',w(f.fixedNight),'포괄임금제 — 실근무와 무관하게 매월 고정 지급'):''
        }${tr('상여금','','회사 내규에 따름')}${tr('특별성과급','','회사 내규에 따름')}${tr('특근수당','','주말, 공휴일 출근 시 지급')}
        <tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">${w(f.wageType==='comprehensive'?(Number(sal.total||0)+Number(f.fixedOT||0)+Number(f.fixedNight||0)):sal.total)}</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr></tbody>
      </table>
      ${f.wageType==='comprehensive'
        ? `<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용합니다. 근로자 본인의 선택에 따라 연장근로수당·야간근로수당을 위 표의 고정액으로 매월 실제 근무시간과 무관하게 지급하며, 다음 연봉계약 갱신 전까지 동일하게 적용합니다.</p>`
        : `<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용하지 않습니다. 기본근로수당은 월 209시간을 기준으로 산정하되, 연장근로수당(해당 월 소정근로시간 초과분에 대해 통상시급의 1.5배)과 야간근로수당(22:00~06:00 근로시간에 대해 통상시급의 0.5배 가산)은 매월 실제 근무기록을 기준으로 산정하여 별도 지급합니다.</p>`}
      <p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조의2 (여비교통비 및 기술수당)</p>
      <p style="margin-bottom:4px;">① 회사는 근로자가 업무상 이동에 소요한 비용을 실비변상적 성격의 여비교통비로 별도 지급한다. 이는 근로기준법 시행령상 임금(통상임금·평균임금)에 산입되지 않는 실비변상적 금품으로, 4대보험 산정 기준에서 제외한다.</p>
      <p style="margin-bottom:4px;">② 여비교통비 지급 기준(개인차량 이용 시 사무실 기준 편도거리)은 다음과 같다: 40km 이내 1만원, 40km 초과 2만원. 회사차량 이용 시에는 이동거리와 무관하게 1만원을 고정 지급한다.</p>
      <p style="margin-bottom:4px;">③ 지방 장기출장으로 회사가 숙소를 별도 지급하는 경우, 일비(1만원)를 지급하지 않는 대신 왕복 교통비(KTX 기준 실비)를 지급하며, 이는 <b>주 1회를 한도</b>로 한다.</p>
      <p style="margin-bottom:4px;">④ 근로자가 관련 국가기술자격증을 보유하고 그 업무에 종사하는 경우, 회사는 월 5만원의 기술수당을 별도 지급한다. 자격증의 종류 및 인정 범위는 회사 내규에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 (지급시기 및 방법)</p>
      <p style="margin-bottom:4px;">① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.</p>
      <p style="margin-bottom:4px;">② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.</p>
      <p style="margin-bottom:10px;">③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 (기밀유지)</p>
      <p style="margin-bottom:10px;">직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 (계약의 효력정지 및 해지)</p>
      <p style="margin-bottom:4px;">① "을"이 휴직, 정직 등 근로 제공이 정지되는 사유가 발생한 경우, 그 기간 동안 본 계약의 효력은 정지된다.</p>
      <p style="margin-bottom:10px;">② 근로계약이 해지되거나 종료되는 경우, 본 연봉계약도 동시에 종료된 것으로 본다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제6조 (기타사항)</p>
      <p style="margin-bottom:4px;">① 본 계약에 명시되지 않은 사항은 근로기준법, 회사 취업규칙 및 관련 법령이 정하는 바에 따른다.</p>
      <p style="margin-bottom:10px;">② 본 계약의 내용은 "갑"과 "을" 쌍방의 서면 합의에 의해서만 변경할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제7조 (계약서 교부)</p>
      <p style="margin-bottom:20px;">본 계약서는 2부를 작성하여 "갑"과 "을"이 각각 서명 또는 날인한 후 1부씩 보관한다.</p>
      <p style="font-weight:600;margin-bottom:20px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,150)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __annualHtml_v5(f0){
  // v5: 내용 변경 없음(근로계약서 문구 정리에 따른 버전 동기화)
  // v4: 내용 변경 없음(근로계약서 동의서 별지 추가에 따른 버전 동기화)
  const f=f0; const sal=__calcAnnualSalary_v1(Number(f.hourly||0), f.empType||'field');
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const tr=(l,a,b)=>`<tr><td style="border:1px solid #333;padding:5px 8px;font-size:10pt;">${l}</td><td style="border:1px solid #333;padding:5px 8px;text-align:right;font-size:10pt;">${a}</td><td style="border:1px solid #333;padding:5px 8px;font-size:9pt;color:#555;">${b}</td></tr>`;
  const w=v=>v?`₩${Number(v).toLocaleString()}`:'';
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>연봉계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">연 봉 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,100)} (이하 "을"이라 한다.)는 다음과 같은 조건으로 연봉계약을 체결하고, 이를 성실하게 준수할 것을 확인한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 (연봉계약기간)</p>
      <p style="margin-bottom:4px;">① 직원의 연봉계약기간은 ${fmtDp(f.startDate)} 부터 ${fmtDp(f.endDate)}까지(12개월)로 한다.</p>
      <p style="margin-bottom:4px;">② 연봉 계약 기간 중 회사규정에 따른 연봉의 증감 사유가 발생한 때에는 제1항의 계약 기간 중이라도 연봉을 조정할 수 있다.</p>
      <p style="margin-bottom:10px;">③ 근로 계약 해지 사유가 발생하여 근로계약이 종료되면 본 계약도 해지된 것으로 간주한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 (연봉의 구성)</p>
      <p style="margin-bottom:6px;">① 계약 연봉은 ${f.salary?`금 ${Number(f.salary).toLocaleString()}원`:'금 ____________원'}으로 한다.</p>
      <p style="margin-bottom:8px;">② 월급여 임금 구성:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <thead><tr style="background:#E8F0FB;"><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">항목</th><th style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10pt;">금액</th><th style="border:1px solid #333;padding:6px 8px;text-align:left;font-size:10pt;">산출근거</th></tr></thead>
        <tbody>${tr('기본근로수당',w(sal.basic),'시급×8×5×4.345')}${tr('주휴수당',w(sal.weekly),'시급×8×4.345')
        }${f.wageType==='comprehensive'?tr('고정연장수당',w(f.fixedOT),'포괄임금제 — 실근무와 무관하게 매월 고정 지급')+tr('고정야간수당',w(f.fixedNight),'포괄임금제 — 실근무와 무관하게 매월 고정 지급'):''
        }${tr('상여금','','회사 내규에 따름')}${tr('특별성과급','','회사 내규에 따름')}${tr('특근수당','','주말, 공휴일 출근 시 지급')}
        <tr style="background:#E8F0FB;"><td style="border:1px solid #333;padding:6px 8px;font-weight:700;font-size:10pt;">합계</td><td style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:700;font-size:10pt;">${w(f.wageType==='comprehensive'?(Number(sal.total||0)+Number(f.fixedOT||0)+Number(f.fixedNight||0)):sal.total)}</td><td style="border:1px solid #333;padding:6px 8px;"></td></tr></tbody>
      </table>
      ${f.wageType==='comprehensive'
        ? `<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용합니다. 근로자 본인의 선택에 따라 연장근로수당·야간근로수당을 위 표의 고정액으로 매월 실제 근무시간과 무관하게 지급하며, 다음 연봉계약 갱신 전까지 동일하게 적용합니다.</p>`
        : `<p style="font-size:9pt;color:#555;margin-bottom:4px;">※ 본 계약은 포괄임금제를 적용하지 않습니다. 기본근로수당은 월 209시간을 기준으로 산정하되, 연장근로수당(해당 월 소정근로시간 초과분에 대해 통상시급의 1.5배)과 야간근로수당(22:00~06:00 근로시간에 대해 통상시급의 0.5배 가산)은 매월 실제 근무기록을 기준으로 산정하여 별도 지급합니다.</p>`}
      <p style="font-size:9pt;color:#555;margin-bottom:10px;">※ 위 임금구성은 소정근로시간(주52시간)을 기준으로 작성됨</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조의2 (여비교통비 및 기술수당)</p>
      <p style="margin-bottom:4px;">① 회사는 근로자가 업무상 이동에 소요한 비용을 실비변상적 성격의 여비교통비로 별도 지급한다. 이는 근로기준법 시행령상 임금(통상임금·평균임금)에 산입되지 않는 실비변상적 금품으로, 4대보험 산정 기준에서 제외한다.</p>
      <p style="margin-bottom:4px;">② 여비교통비 지급 기준(개인차량 이용 시 사무실 기준 편도거리)은 다음과 같다: 40km 이내 1만원, 40km 초과 2만원. 회사차량 이용 시에는 이동거리와 무관하게 1만원을 고정 지급한다.</p>
      <p style="margin-bottom:4px;">③ 지방 장기출장으로 회사가 숙소를 별도 지급하는 경우, 일비(1만원)를 지급하지 않는 대신 왕복 교통비(KTX 기준 실비)를 지급하며, 이는 <b>주 1회를 한도</b>로 한다.</p>
      <p style="margin-bottom:4px;">④ 근로자가 관련 국가기술자격증을 보유하고 그 업무에 종사하는 경우, 회사는 월 5만원의 기술수당을 별도 지급한다. 자격증의 종류 및 인정 범위는 회사 내규에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 (지급시기 및 방법)</p>
      <p style="margin-bottom:4px;">① 연봉을 12개월로 균등 분할해 익월 말일에 지급한다.</p>
      <p style="margin-bottom:4px;">② 지급일이 휴일인 경우 다음 은행 영업일에 지급한다.</p>
      <p style="margin-bottom:10px;">③ 임금은 제세공과금 원천징수 후 급여 계좌로 입금한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 (기밀유지)</p>
      <p style="margin-bottom:10px;">직원은 본 계약 내용 및 타 직원 연봉에 관한 사항에 대하여 기밀을 유지하여야 한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 (계약의 효력정지 및 해지)</p>
      <p style="margin-bottom:4px;">① "을"이 휴직, 정직 등 근로 제공이 정지되는 사유가 발생한 경우, 그 기간 동안 본 계약의 효력은 정지된다.</p>
      <p style="margin-bottom:10px;">② 근로계약이 해지되거나 종료되는 경우, 본 연봉계약도 동시에 종료된 것으로 본다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제6조 (기타사항)</p>
      <p style="margin-bottom:4px;">① 본 계약에 명시되지 않은 사항은 근로기준법, 회사 취업규칙 및 관련 법령이 정하는 바에 따른다.</p>
      <p style="margin-bottom:10px;">② 본 계약의 내용은 "갑"과 "을" 쌍방의 서면 합의에 의해서만 변경할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제7조 (계약서 교부)</p>
      <p style="margin-bottom:20px;">본 계약서는 2부를 작성하여 "갑"과 "을"이 각각 서명 또는 날인한 후 1부씩 보관한다.</p>
      <p style="font-weight:600;margin-bottom:20px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:14px;"><p style="font-weight:700;margin-bottom:8px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,150)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:10px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __laborHtml_v0(f0) {
  const f=f0;
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>근로계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">근 로 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,80)} (이하 "을"이라 한다.)는 근로자보호 등에 관한 법률에 의거 다음과 같이 PJT 계약직 근로계약을 체결한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 【의 무】</p><p style="margin-bottom:8px;">"을"은 "갑"의 정규직원으로서 "갑"의 사규에 따른 제규정 및 취업규칙에 정해진 근로조건을 승인하고 근로를 성실히 이행할 의무를 진다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 【근로기간】</p><p style="margin-bottom:4px;">1. 근로계약기간 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</p><p style="margin-bottom:8px;">2. PJT계약근로기간이 만료되고 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 【근무장소 및 대상업무】</p><p style="margin-bottom:4px;">1. "을"은 "갑"이 제공하는 근무장소에서 근무하며, "을"은 이에 따른다.</p><p style="margin-bottom:4px;">&nbsp;&nbsp;1) 소속 : ${ul(f.dept,180)} &nbsp; 직급 : ${ul(f.rank,60)}</p><p style="margin-bottom:8px;">&nbsp;&nbsp;2) 담당 업무 : ${ul(f.job,160)}</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 【임 금】</p><p style="margin-bottom:4px;">- 계약연봉 : ${f.salary?`일금 ${Number(f.salary).toLocaleString()}원`:ul('',180)}</p><p style="margin-bottom:4px;">- 세부 지급 사항은 연봉계약서를 기준으로 한다. 임금 지급일 : 익월 말일</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 【사회보험】</p><p style="margin-bottom:8px;">☑ 고용보험 &nbsp; ☑ 산재보험 &nbsp; ☑ 국민연금 &nbsp; ☑ 건강보험</p>
      <p style="font-weight:700;margin:12px 0 4px;">제6조 【근로시간】</p>
      <p style="margin-bottom:6px;">근로기준법 제50조에 따라 주 40시간 근로를 원칙으로 한다. 다만 현장 여건에 따라 근로기준법 제53조에 의거하여 최대 12시간까지 연장하여 근로할 수 있다. (식사 및 휴게시간은 근로시간에서 제외)</p>
      <p style="font-weight:700;margin:12px 0 4px;">제7조 【휴게시간】</p>
      <p style="margin-bottom:6px;">4시간 근무마다 30분 휴식, 중식 1시간 의무지급을 원칙으로 한다. 다만, 현장 상황에 따라 유연하게 적용한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제8조 【퇴직금】</p>
      <p style="margin-bottom:4px;">1. "갑"은 "을"의 1년 이상 계속 근로에 대하여 퇴직 전 3개월 평균임금의 30일분을 퇴직금으로 지급한다. (단, 별도로 지급되는 수당은 퇴직금 계산에서 제외된다.)</p>
      <p style="margin-bottom:6px;">2. 4대보험 개인의 선택으로 가입하지 않을 시 퇴직금은 지급하지 아니한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제9조 【휴일 및 휴가】</p>
      <p style="margin-bottom:4px;">"을"의 휴일과 휴가는 근로자계약의 내용에 따라 결정되며, 회사는 연차휴가와 관련하여 근로자대표와의 합의에 의하여 특정일을 연차휴가로 대체할 수 있다.</p>
      <p style="margin-bottom:4px;">- 계속 근로 1년 이상, 해당 기간 동안 80% 이상이 될 경우 15일의 유급휴가가 부여된다.</p>
      <p style="margin-bottom:6px;">- "갑"은 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 부여한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제10조 【지휘감독 및 근로조건】</p>
      <p style="margin-bottom:6px;">"을"은 "갑"의 소속 단기계약근로자로서 사업주의 지휘감독을 받으며, "갑"의 취업규칙 및 근무지의 제규정을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제11조 【귀책사유】</p>
      <p style="margin-bottom:2px;">1. 직무상의 의무를 위반하거나 근무에 태만하였을 때</p>
      <p style="margin-bottom:2px;">2. "갑" 및 사용사업주의 이미지를 크게 손상하거나 재산상의 피해를 주었을 때</p>
      <p style="margin-bottom:2px;">3. 비밀누설 및 폭행, 파업 등 규율과 질서를 문란케 하였을 때</p>
      <p style="margin-bottom:2px;">4. 취업기간 중 형사상 유죄판결을 받았을 때</p>
      <p style="margin-bottom:2px;">5. 채용조건에 구비된 각종문서가 위조 또는 변조, 허위사실 등이 기재되었을 때</p>
      <p style="margin-bottom:2px;">6. 사용사업주의 허가 없이 3일 이상 결근하였을 때</p>
      <p style="margin-bottom:2px;">7. 무단지각, 조퇴, 외출을 월 3회 이상 하였을 때</p>
      <p style="margin-bottom:6px;">8. 계약기간 내에 동종업체로 직접 계약 및 이직하였을 때</p>
      <p style="font-weight:700;margin:12px 0 4px;">제12조 【손해배상】</p>
      <p style="margin-bottom:6px;">"을"의 제11조 귀책사유로 "갑" 및 사용사업주에게 재산상의 손해를 끼쳤을 경우에는 전적으로 "을"이 책임지며, 이를 지키지 않은 경우에는 "갑"은 "을" 또는 "을"의 보증인에게 월급의 3배의 책임을 물 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제13조 【재정보증】</p>
      <p style="margin-bottom:4px;">- "을"은 1명의 재정보증인을 설정 신고하거나 "갑"이 요구하는 금액의 신용보증보험에 가입하여야 한다.</p>
      <p style="margin-bottom:6px;">- "갑"은 "을"에게 신용보증보험을 요구할 수 있으며, "을"은 회사의 요구 시 1주일 이내에 제출하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제14조 【안전 및 보건에 관한 사항】</p>
      <p style="margin-bottom:4px;">1. "갑"은 근로자의 안전 및 보건에 관하여 관계 법령이 정하는 바에 따라 필요한 조치를 강구한다.</p>
      <p style="margin-bottom:4px;">2. "을"은 신규 입사 시 즉시 채용신체검사서를 제출하여야 하며, 정기 건강진단을 관련법령에 의거 실시하고 "을"은 이에 반드시 응해야 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 제반 법규 및 "갑"이 정한 제반 안전 교육사항 및 안전수칙을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제15조 【취업 전 고지】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용을 취업 전 충분히 숙지하고 이를 성실히 이행한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제16조 【파견근로계약 및 동의】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용에 이의를 제기하지 아니하며 "을"의 근로조건은 "갑"의 취업규칙 및 근로자계약 범위 내에서 결정되는 것에 동의한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제17조 【계약의 해지】</p>
      <p style="margin-bottom:4px;">다음 각 호에 해당하는 경우 갑과 을의 근로계약은 해지된다.</p>
      <p style="margin-bottom:4px;">1. "갑"과 "을"의 상호 합의 하에 근무일을 지정하여 해당 날짜까지 근무 후 계약 종료</p>
      <p style="margin-bottom:4px;">2. "을"의 계약종료 의사를 "갑"이 인지한 시점으로부터 당기 후의 1기가 지난 뒤 해지의 효력이 발생</p>
      <p style="margin-bottom:6px;">3. 제11조 귀책사유 발생 시 "갑"은 일방적으로 "을"과의 근로계약을 해지할 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제18조 【지급품의 반납】</p>
      <p style="margin-bottom:6px;">퇴직 시에는 "을"은 "갑"으로부터 지급받은 장비, 피복, 기타 이에 준하는 지급품은 필히 반납하여야 하며 반납치 않을 시에는 급여에서 공제한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제19조 【근로기준법의 적용】</p>
      <p style="margin-bottom:6px;">본 계약에 명시되지 않은 사항은 회사의 취업규칙 및 근로기준법의 해석에 준하여 따른다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제20조 【비밀유지】</p>
      <p style="margin-bottom:4px;">1. "을"은 자신의 계약내용을 관계인에게 누설하지 않는다.</p>
      <p style="margin-bottom:4px;">2. "을"은 근무지에서 발생하는 인사문제를 관리자에게 보고하여야 하며 조치 받을 수 있도록 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 "갑"에서 발생하는 문제를 외부에 누설하지 않는다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제21조 【계약의 유지】</p>
      <p style="margin-bottom:12px;">"갑"과 "을"은 제2조의 계약기간을 원칙으로 하며 "을"은 이에 동의한다. 위 계약내용이 당사자의 자유로운 의사에 의하여 원만히 체결되었음을 상호 확인하고 각 1통씩 보관한다.</p>
      <p style="font-weight:600;margin:20px 0 16px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,140)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:8px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __laborHtml_v2(f0) {
  const f=f0;
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>근로계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">근 로 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,80)} (이하 "을"이라 한다.)는 근로자보호 등에 관한 법률에 의거 다음과 같이 PJT 계약직 근로계약을 체결한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 【의 무】</p><p style="margin-bottom:8px;">"을"은 "갑"의 정규직원으로서 "갑"의 사규에 따른 제규정 및 취업규칙에 정해진 근로조건을 승인하고 근로를 성실히 이행할 의무를 진다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 【근로기간】</p><p style="margin-bottom:4px;">1. 근로계약기간 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</p><p style="margin-bottom:8px;">2. PJT계약근로기간이 만료되고 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 【근무장소 및 대상업무】</p><p style="margin-bottom:4px;">1. "을"은 "갑"이 제공하는 근무장소에서 근무하며, "을"은 이에 따른다.</p><p style="margin-bottom:4px;">&nbsp;&nbsp;1) 소속 : ${ul(f.dept,180)} &nbsp; 직급 : ${ul(f.rank,60)}</p><p style="margin-bottom:8px;">&nbsp;&nbsp;2) 담당 업무 : ${ul(f.job,160)}</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 【임 금】</p><p style="margin-bottom:4px;">- 계약연봉 : ${f.salary?`일금 ${Number(f.salary).toLocaleString()}원`:ul('',180)}</p><p style="margin-bottom:4px;">- 세부 지급 사항은 연봉계약서를 기준으로 한다. 임금 지급일 : 익월 말일</p><p style="margin-bottom:8px;">- 여비교통비(실비변상)와 국가기술자격증 보유에 따른 기술수당(월 5만원)은 임금과 별도로 지급하며, 세부 지급 기준은 연봉계약서 제2조의2에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 【사회보험】</p><p style="margin-bottom:8px;">☑ 고용보험 &nbsp; ☑ 산재보험 &nbsp; ☑ 국민연금 &nbsp; ☑ 건강보험</p>
      <p style="font-weight:700;margin:12px 0 4px;">제6조 【근로시간】</p>
      <p style="margin-bottom:6px;">근로기준법 제50조에 따라 주 40시간 근로를 원칙으로 한다. 다만 현장 여건에 따라 근로기준법 제53조에 의거하여 최대 12시간까지 연장하여 근로할 수 있다. (식사 및 휴게시간은 근로시간에서 제외)</p>
      <p style="font-weight:700;margin:12px 0 4px;">제7조 【휴게시간】</p>
      <p style="margin-bottom:6px;">4시간 근무마다 30분 휴식, 중식 1시간 의무지급을 원칙으로 한다. 다만, 현장 상황에 따라 유연하게 적용한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제8조 【퇴직금】</p>
      <p style="margin-bottom:4px;">1. "갑"은 "을"의 1년 이상 계속 근로에 대하여 퇴직 전 3개월 평균임금의 30일분을 퇴직금으로 지급한다. (단, 별도로 지급되는 수당은 퇴직금 계산에서 제외된다.)</p>
      <p style="margin-bottom:6px;">2. 4대보험 개인의 선택으로 가입하지 않을 시 퇴직금은 지급하지 아니한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제9조 【휴일 및 휴가】</p>
      <p style="margin-bottom:4px;">"을"의 휴일과 휴가는 근로자계약의 내용에 따라 결정되며, 회사는 연차휴가와 관련하여 근로자대표와의 합의에 의하여 특정일을 연차휴가로 대체할 수 있다.</p>
      <p style="margin-bottom:4px;">- 계속 근로 1년 이상, 해당 기간 동안 80% 이상이 될 경우 15일의 유급휴가가 부여된다.</p>
      <p style="margin-bottom:6px;">- "갑"은 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 부여한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제10조 【지휘감독 및 근로조건】</p>
      <p style="margin-bottom:6px;">"을"은 "갑"의 소속 단기계약근로자로서 사업주의 지휘감독을 받으며, "갑"의 취업규칙 및 근무지의 제규정을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제11조 【귀책사유】</p>
      <p style="margin-bottom:2px;">1. 직무상의 의무를 위반하거나 근무에 태만하였을 때</p>
      <p style="margin-bottom:2px;">2. "갑" 및 사용사업주의 이미지를 크게 손상하거나 재산상의 피해를 주었을 때</p>
      <p style="margin-bottom:2px;">3. 비밀누설 및 폭행, 파업 등 규율과 질서를 문란케 하였을 때</p>
      <p style="margin-bottom:2px;">4. 취업기간 중 형사상 유죄판결을 받았을 때</p>
      <p style="margin-bottom:2px;">5. 채용조건에 구비된 각종문서가 위조 또는 변조, 허위사실 등이 기재되었을 때</p>
      <p style="margin-bottom:2px;">6. 사용사업주의 허가 없이 3일 이상 결근하였을 때</p>
      <p style="margin-bottom:2px;">7. 무단지각, 조퇴, 외출을 월 3회 이상 하였을 때</p>
      <p style="margin-bottom:6px;">8. 계약기간 내에 동종업체로 직접 계약 및 이직하였을 때</p>
      <p style="font-weight:700;margin:12px 0 4px;">제12조 【손해배상】</p>
      <p style="margin-bottom:6px;">"을"의 제11조 귀책사유로 "갑" 및 사용사업주에게 재산상의 손해를 끼쳤을 경우에는 전적으로 "을"이 책임지며, 이를 지키지 않은 경우에는 "갑"은 "을" 또는 "을"의 보증인에게 월급의 3배의 책임을 물 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제13조 【재정보증】</p>
      <p style="margin-bottom:4px;">- "을"은 1명의 재정보증인을 설정 신고하거나 "갑"이 요구하는 금액의 신용보증보험에 가입하여야 한다.</p>
      <p style="margin-bottom:6px;">- "갑"은 "을"에게 신용보증보험을 요구할 수 있으며, "을"은 회사의 요구 시 1주일 이내에 제출하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제14조 【안전 및 보건에 관한 사항】</p>
      <p style="margin-bottom:4px;">1. "갑"은 근로자의 안전 및 보건에 관하여 관계 법령이 정하는 바에 따라 필요한 조치를 강구한다.</p>
      <p style="margin-bottom:4px;">2. "을"은 신규 입사 시 즉시 채용신체검사서를 제출하여야 하며, 정기 건강진단을 관련법령에 의거 실시하고 "을"은 이에 반드시 응해야 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 제반 법규 및 "갑"이 정한 제반 안전 교육사항 및 안전수칙을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제15조 【취업 전 고지】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용을 취업 전 충분히 숙지하고 이를 성실히 이행한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제16조 【파견근로계약 및 동의】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용에 이의를 제기하지 아니하며 "을"의 근로조건은 "갑"의 취업규칙 및 근로자계약 범위 내에서 결정되는 것에 동의한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제17조 【계약의 해지】</p>
      <p style="margin-bottom:4px;">다음 각 호에 해당하는 경우 갑과 을의 근로계약은 해지된다.</p>
      <p style="margin-bottom:4px;">1. "갑"과 "을"의 상호 합의 하에 근무일을 지정하여 해당 날짜까지 근무 후 계약 종료</p>
      <p style="margin-bottom:4px;">2. "을"의 계약종료 의사를 "갑"이 인지한 시점으로부터 당기 후의 1기가 지난 뒤 해지의 효력이 발생</p>
      <p style="margin-bottom:6px;">3. 제11조 귀책사유 발생 시 "갑"은 일방적으로 "을"과의 근로계약을 해지할 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제18조 【지급품의 반납】</p>
      <p style="margin-bottom:6px;">퇴직 시에는 "을"은 "갑"으로부터 지급받은 장비, 피복, 기타 이에 준하는 지급품은 필히 반납하여야 하며 반납치 않을 시에는 급여에서 공제한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제19조 【근로기준법의 적용】</p>
      <p style="margin-bottom:6px;">본 계약에 명시되지 않은 사항은 회사의 취업규칙 및 근로기준법의 해석에 준하여 따른다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제20조 【비밀유지】</p>
      <p style="margin-bottom:4px;">1. "을"은 자신의 계약내용을 관계인에게 누설하지 않는다.</p>
      <p style="margin-bottom:4px;">2. "을"은 근무지에서 발생하는 인사문제를 관리자에게 보고하여야 하며 조치 받을 수 있도록 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 "갑"에서 발생하는 문제를 외부에 누설하지 않는다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제21조 【계약의 유지】</p>
      <p style="margin-bottom:12px;">"갑"과 "을"은 제2조의 계약기간을 원칙으로 하며 "을"은 이에 동의한다. 위 계약내용이 당사자의 자유로운 의사에 의하여 원만히 체결되었음을 상호 확인하고 각 1통씩 보관한다.</p>
      <p style="font-weight:600;margin:20px 0 16px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,140)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:8px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    </body></html>`);
}
function __laborHtml_v4(f0) {
  // v4: 개인정보 제3자 제공 동의서(별지) 근로계약서 뒤에 첨부 — 2026-09-23 추가
  const f=f0;
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>근로계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">근 로 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,80)} (이하 "을"이라 한다.)는 근로자보호 등에 관한 법률에 의거 다음과 같이 PJT 계약직 근로계약을 체결한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 【의 무】</p><p style="margin-bottom:8px;">"을"은 "갑"의 정규직원으로서 "갑"의 사규에 따른 제규정 및 취업규칙에 정해진 근로조건을 승인하고 근로를 성실히 이행할 의무를 진다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 【근로기간】</p><p style="margin-bottom:4px;">1. 근로계약기간 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</p><p style="margin-bottom:8px;">2. PJT계약근로기간이 만료되고 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 【근무장소 및 대상업무】</p><p style="margin-bottom:4px;">1. "을"은 "갑"이 제공하는 근무장소에서 근무하며, "을"은 이에 따른다.</p><p style="margin-bottom:4px;">&nbsp;&nbsp;1) 소속 : ${ul(f.dept,180)} &nbsp; 직급 : ${ul(f.rank,60)}</p><p style="margin-bottom:8px;">&nbsp;&nbsp;2) 담당 업무 : ${ul(f.job,160)}</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 【임 금】</p><p style="margin-bottom:4px;">- 계약연봉 : ${f.salary?`일금 ${Number(f.salary).toLocaleString()}원`:ul('',180)}</p><p style="margin-bottom:4px;">- 세부 지급 사항은 연봉계약서를 기준으로 한다. 임금 지급일 : 익월 말일</p><p style="margin-bottom:8px;">- 여비교통비(실비변상)와 국가기술자격증 보유에 따른 기술수당(월 5만원)은 임금과 별도로 지급하며, 세부 지급 기준은 연봉계약서 제2조의2에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 【사회보험】</p><p style="margin-bottom:8px;">☑ 고용보험 &nbsp; ☑ 산재보험 &nbsp; ☑ 국민연금 &nbsp; ☑ 건강보험</p>
      <p style="font-weight:700;margin:12px 0 4px;">제6조 【근로시간】</p>
      <p style="margin-bottom:6px;">근로기준법 제50조에 따라 주 40시간 근로를 원칙으로 한다. 다만 현장 여건에 따라 근로기준법 제53조에 의거하여 최대 12시간까지 연장하여 근로할 수 있다. (식사 및 휴게시간은 근로시간에서 제외)</p>
      <p style="font-weight:700;margin:12px 0 4px;">제7조 【휴게시간】</p>
      <p style="margin-bottom:6px;">4시간 근무마다 30분 휴식, 중식 1시간 의무지급을 원칙으로 한다. 다만, 현장 상황에 따라 유연하게 적용한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제8조 【퇴직금】</p>
      <p style="margin-bottom:4px;">1. "갑"은 "을"의 1년 이상 계속 근로에 대하여 퇴직 전 3개월 평균임금의 30일분을 퇴직금으로 지급한다. (단, 별도로 지급되는 수당은 퇴직금 계산에서 제외된다.)</p>
      <p style="margin-bottom:6px;">2. 4대보험 개인의 선택으로 가입하지 않을 시 퇴직금은 지급하지 아니한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제9조 【휴일 및 휴가】</p>
      <p style="margin-bottom:4px;">"을"의 휴일과 휴가는 근로자계약의 내용에 따라 결정되며, 회사는 연차휴가와 관련하여 근로자대표와의 합의에 의하여 특정일을 연차휴가로 대체할 수 있다.</p>
      <p style="margin-bottom:4px;">- 계속 근로 1년 이상, 해당 기간 동안 80% 이상이 될 경우 15일의 유급휴가가 부여된다.</p>
      <p style="margin-bottom:6px;">- "갑"은 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 부여한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제10조 【지휘감독 및 근로조건】</p>
      <p style="margin-bottom:6px;">"을"은 "갑"의 소속 단기계약근로자로서 사업주의 지휘감독을 받으며, "갑"의 취업규칙 및 근무지의 제규정을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제11조 【귀책사유】</p>
      <p style="margin-bottom:2px;">1. 직무상의 의무를 위반하거나 근무에 태만하였을 때</p>
      <p style="margin-bottom:2px;">2. "갑" 및 사용사업주의 이미지를 크게 손상하거나 재산상의 피해를 주었을 때</p>
      <p style="margin-bottom:2px;">3. 비밀누설 및 폭행, 파업 등 규율과 질서를 문란케 하였을 때</p>
      <p style="margin-bottom:2px;">4. 취업기간 중 형사상 유죄판결을 받았을 때</p>
      <p style="margin-bottom:2px;">5. 채용조건에 구비된 각종문서가 위조 또는 변조, 허위사실 등이 기재되었을 때</p>
      <p style="margin-bottom:2px;">6. 사용사업주의 허가 없이 3일 이상 결근하였을 때</p>
      <p style="margin-bottom:2px;">7. 무단지각, 조퇴, 외출을 월 3회 이상 하였을 때</p>
      <p style="margin-bottom:6px;">8. 계약기간 내에 동종업체로 직접 계약 및 이직하였을 때</p>
      <p style="font-weight:700;margin:12px 0 4px;">제12조 【손해배상】</p>
      <p style="margin-bottom:6px;">"을"의 제11조 귀책사유로 "갑" 및 사용사업주에게 재산상의 손해를 끼쳤을 경우에는 전적으로 "을"이 책임지며, 이를 지키지 않은 경우에는 "갑"은 "을" 또는 "을"의 보증인에게 월급의 3배의 책임을 물 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제13조 【재정보증】</p>
      <p style="margin-bottom:4px;">- "을"은 1명의 재정보증인을 설정 신고하거나 "갑"이 요구하는 금액의 신용보증보험에 가입하여야 한다.</p>
      <p style="margin-bottom:6px;">- "갑"은 "을"에게 신용보증보험을 요구할 수 있으며, "을"은 회사의 요구 시 1주일 이내에 제출하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제14조 【안전 및 보건에 관한 사항】</p>
      <p style="margin-bottom:4px;">1. "갑"은 근로자의 안전 및 보건에 관하여 관계 법령이 정하는 바에 따라 필요한 조치를 강구한다.</p>
      <p style="margin-bottom:4px;">2. "을"은 신규 입사 시 즉시 채용신체검사서를 제출하여야 하며, 정기 건강진단을 관련법령에 의거 실시하고 "을"은 이에 반드시 응해야 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 제반 법규 및 "갑"이 정한 제반 안전 교육사항 및 안전수칙을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제15조 【취업 전 고지】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용을 취업 전 충분히 숙지하고 이를 성실히 이행한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제16조 【파견근로계약 및 동의】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용에 이의를 제기하지 아니하며 "을"의 근로조건은 "갑"의 취업규칙 및 근로자계약 범위 내에서 결정되는 것에 동의한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제17조 【계약의 해지】</p>
      <p style="margin-bottom:4px;">다음 각 호에 해당하는 경우 갑과 을의 근로계약은 해지된다.</p>
      <p style="margin-bottom:4px;">1. "갑"과 "을"의 상호 합의 하에 근무일을 지정하여 해당 날짜까지 근무 후 계약 종료</p>
      <p style="margin-bottom:4px;">2. "을"의 계약종료 의사를 "갑"이 인지한 시점으로부터 당기 후의 1기가 지난 뒤 해지의 효력이 발생</p>
      <p style="margin-bottom:6px;">3. 제11조 귀책사유 발생 시 "갑"은 일방적으로 "을"과의 근로계약을 해지할 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제18조 【지급품의 반납】</p>
      <p style="margin-bottom:6px;">퇴직 시에는 "을"은 "갑"으로부터 지급받은 장비, 피복, 기타 이에 준하는 지급품은 필히 반납하여야 하며 반납치 않을 시에는 급여에서 공제한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제19조 【근로기준법의 적용】</p>
      <p style="margin-bottom:6px;">본 계약에 명시되지 않은 사항은 회사의 취업규칙 및 근로기준법의 해석에 준하여 따른다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제20조 【비밀유지】</p>
      <p style="margin-bottom:4px;">1. "을"은 자신의 계약내용을 관계인에게 누설하지 않는다.</p>
      <p style="margin-bottom:4px;">2. "을"은 근무지에서 발생하는 인사문제를 관리자에게 보고하여야 하며 조치 받을 수 있도록 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 "갑"에서 발생하는 문제를 외부에 누설하지 않는다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제21조 【계약의 유지】</p>
      <p style="margin-bottom:12px;">"갑"과 "을"은 제2조의 계약기간을 원칙으로 하며 "을"은 이에 동의한다. 위 계약내용이 당사자의 자유로운 의사에 의하여 원만히 체결되었음을 상호 확인하고 각 1통씩 보관한다.</p>
      <p style="font-weight:600;margin:20px 0 16px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,140)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:8px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    <div class="a4" style="page-break-before:always;">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:18pt;font-weight:800;letter-spacing:4px;">개인정보 제3자 제공 동의서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:16px;font-size:9.5pt;color:#556;">본 동의서는 근로계약서의 첨부서류로서, 근로계약 체결 시 근로계약서와 함께 작성합니다.</p>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:16px;">
        <tr><td style="border:1px solid #333;padding:8px 10px;width:150px;background:#F5F7FA;font-weight:700;">제공받는 자</td><td style="border:1px solid #333;padding:8px 10px;">회사가 "을"을 파견·배치하는 모든 현장의 발주처 및 관계 기관</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">제공 목적</td><td style="border:1px solid #333;padding:8px 10px;">계약 이행에 따른 근로자 명부·자격증 확인, 출입증 발급 등 현장 출입·관리</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">제공 항목</td><td style="border:1px solid #333;padding:8px 10px;">성명, 생년월일, 소속, 자격증 사항, 그 밖에 발주처가 계약상 요구하는 최소한의 정보</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">보유·이용 기간</td><td style="border:1px solid #333;padding:8px 10px;">본 근로계약기간(제2조) 동안 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</td></tr>
      </table>
      <p style="margin-bottom:14px;font-size:9.5pt;">귀하는 개인정보의 제3자 제공에 동의하지 않을 권리가 있습니다. 다만 위 정보는 발주처 현장 출입 및 계약 이행에 필요한 최소한의 정보이므로, 동의하지 않을 경우 현장 배치가 제한될 수 있습니다.</p>
      <p style="margin-bottom:6px;">☐ 위 개인정보의 제3자 제공에 동의합니다.</p>
      <p style="margin-bottom:24px;">☐ 위 개인정보의 제3자 제공에 동의하지 않습니다.</p>
      <p style="text-align:right;margin-bottom:8px;">동의일자 : ${fmtDp(f.contractDate)}</p>
      <p style="text-align:right;">근로자(정보주체) 성명 : ${ul(f.name,80)} &nbsp;&nbsp;(인) ${signImg}</p>
    </div>
    </body></html>`);
}
function __laborHtml_v5(f0) {
  // v5: 근로자보호 등에 관한 법률·사용사업주 등 파견법 연상 문구 정리 — 2026-09-23 추가
  // v4: 개인정보 제3자 제공 동의서(별지) 근로계약서 뒤에 첨부 — 2026-09-23 추가
  const f=f0;
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>근로계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">근 로 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,80)} (이하 "을"이라 한다.)는 다음과 같이 PJT 계약직 근로계약을 체결한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 【의 무】</p><p style="margin-bottom:8px;">"을"은 "갑"의 정규직원으로서 "갑"의 사규에 따른 제규정 및 취업규칙에 정해진 근로조건을 승인하고 근로를 성실히 이행할 의무를 진다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 【근로기간】</p><p style="margin-bottom:4px;">1. 근로계약기간 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</p><p style="margin-bottom:8px;">2. PJT계약근로기간이 만료되고 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 【근무장소 및 대상업무】</p><p style="margin-bottom:4px;">1. "을"은 "갑"이 제공하는 근무장소에서 근무하며, "을"은 이에 따른다.</p><p style="margin-bottom:4px;">&nbsp;&nbsp;1) 소속 : ${ul(f.dept,180)} &nbsp; 직급 : ${ul(f.rank,60)}</p><p style="margin-bottom:8px;">&nbsp;&nbsp;2) 담당 업무 : ${ul(f.job,160)}</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 【임 금】</p><p style="margin-bottom:4px;">- 계약연봉 : ${f.salary?`일금 ${Number(f.salary).toLocaleString()}원`:ul('',180)}</p><p style="margin-bottom:4px;">- 세부 지급 사항은 연봉계약서를 기준으로 한다. 임금 지급일 : 익월 말일</p><p style="margin-bottom:8px;">- 여비교통비(실비변상)와 국가기술자격증 보유에 따른 기술수당(월 5만원)은 임금과 별도로 지급하며, 세부 지급 기준은 연봉계약서 제2조의2에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 【사회보험】</p><p style="margin-bottom:8px;">☑ 고용보험 &nbsp; ☑ 산재보험 &nbsp; ☑ 국민연금 &nbsp; ☑ 건강보험</p>
      <p style="font-weight:700;margin:12px 0 4px;">제6조 【근로시간】</p>
      <p style="margin-bottom:6px;">근로기준법 제50조에 따라 주 40시간 근로를 원칙으로 한다. 다만 현장 여건에 따라 근로기준법 제53조에 의거하여 최대 12시간까지 연장하여 근로할 수 있다. (식사 및 휴게시간은 근로시간에서 제외)</p>
      <p style="font-weight:700;margin:12px 0 4px;">제7조 【휴게시간】</p>
      <p style="margin-bottom:6px;">4시간 근무마다 30분 휴식, 중식 1시간 의무지급을 원칙으로 한다. 다만, 현장 상황에 따라 유연하게 적용한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제8조 【퇴직금】</p>
      <p style="margin-bottom:4px;">1. "갑"은 "을"의 1년 이상 계속 근로에 대하여 퇴직 전 3개월 평균임금의 30일분을 퇴직금으로 지급한다. (단, 별도로 지급되는 수당은 퇴직금 계산에서 제외된다.)</p>
      <p style="margin-bottom:6px;">2. 4대보험 개인의 선택으로 가입하지 않을 시 퇴직금은 지급하지 아니한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제9조 【휴일 및 휴가】</p>
      <p style="margin-bottom:4px;">"을"의 휴일과 휴가는 근로자계약의 내용에 따라 결정되며, 회사는 연차휴가와 관련하여 근로자대표와의 합의에 의하여 특정일을 연차휴가로 대체할 수 있다.</p>
      <p style="margin-bottom:4px;">- 계속 근로 1년 이상, 해당 기간 동안 80% 이상이 될 경우 15일의 유급휴가가 부여된다.</p>
      <p style="margin-bottom:6px;">- "갑"은 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 부여한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제10조 【지휘감독 및 근로조건】</p>
      <p style="margin-bottom:6px;">"을"은 "갑"의 소속 단기계약근로자로서 사업주의 지휘감독을 받으며, "갑"의 취업규칙 및 근무지의 제규정을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제11조 【귀책사유】</p>
      <p style="margin-bottom:2px;">1. 직무상의 의무를 위반하거나 근무에 태만하였을 때</p>
      <p style="margin-bottom:2px;">2. "갑"의 이미지를 크게 손상하거나 재산상의 피해를 주었을 때</p>
      <p style="margin-bottom:2px;">3. 비밀누설 및 폭행, 파업 등 규율과 질서를 문란케 하였을 때</p>
      <p style="margin-bottom:2px;">4. 취업기간 중 형사상 유죄판결을 받았을 때</p>
      <p style="margin-bottom:2px;">5. 채용조건에 구비된 각종문서가 위조 또는 변조, 허위사실 등이 기재되었을 때</p>
      <p style="margin-bottom:2px;">6. "갑"의 허가 없이 3일 이상 결근하였을 때</p>
      <p style="margin-bottom:2px;">7. 무단지각, 조퇴, 외출을 월 3회 이상 하였을 때</p>
      <p style="margin-bottom:6px;">8. 계약기간 내에 동종업체로 직접 계약 및 이직하였을 때</p>
      <p style="font-weight:700;margin:12px 0 4px;">제12조 【손해배상】</p>
      <p style="margin-bottom:6px;">"을"의 제11조 귀책사유로 "갑"에게 재산상의 손해를 끼쳤을 경우에는 전적으로 "을"이 책임지며, 이를 지키지 않은 경우에는 "갑"은 "을" 또는 "을"의 보증인에게 월급의 3배의 책임을 물 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제13조 【재정보증】</p>
      <p style="margin-bottom:4px;">- "을"은 1명의 재정보증인을 설정 신고하거나 "갑"이 요구하는 금액의 신용보증보험에 가입하여야 한다.</p>
      <p style="margin-bottom:6px;">- "갑"은 "을"에게 신용보증보험을 요구할 수 있으며, "을"은 회사의 요구 시 1주일 이내에 제출하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제14조 【안전 및 보건에 관한 사항】</p>
      <p style="margin-bottom:4px;">1. "갑"은 근로자의 안전 및 보건에 관하여 관계 법령이 정하는 바에 따라 필요한 조치를 강구한다.</p>
      <p style="margin-bottom:4px;">2. "을"은 신규 입사 시 즉시 채용신체검사서를 제출하여야 하며, 정기 건강진단을 관련법령에 의거 실시하고 "을"은 이에 반드시 응해야 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 제반 법규 및 "갑"이 정한 제반 안전 교육사항 및 안전수칙을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제15조 【취업 전 고지】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용을 취업 전 충분히 숙지하고 이를 성실히 이행한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제16조 【근로조건의 결정】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용에 이의를 제기하지 아니하며 "을"의 근로조건은 "갑"의 취업규칙 및 근로자계약 범위 내에서 결정되는 것에 동의한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제17조 【계약의 해지】</p>
      <p style="margin-bottom:4px;">다음 각 호에 해당하는 경우 갑과 을의 근로계약은 해지된다.</p>
      <p style="margin-bottom:4px;">1. "갑"과 "을"의 상호 합의 하에 근무일을 지정하여 해당 날짜까지 근무 후 계약 종료</p>
      <p style="margin-bottom:4px;">2. "을"의 계약종료 의사를 "갑"이 인지한 시점으로부터 당기 후의 1기가 지난 뒤 해지의 효력이 발생</p>
      <p style="margin-bottom:6px;">3. 제11조 귀책사유 발생 시 "갑"은 일방적으로 "을"과의 근로계약을 해지할 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제18조 【지급품의 반납】</p>
      <p style="margin-bottom:6px;">퇴직 시에는 "을"은 "갑"으로부터 지급받은 장비, 피복, 기타 이에 준하는 지급품은 필히 반납하여야 하며 반납치 않을 시에는 급여에서 공제한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제19조 【근로기준법의 적용】</p>
      <p style="margin-bottom:6px;">본 계약에 명시되지 않은 사항은 회사의 취업규칙 및 근로기준법의 해석에 준하여 따른다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제20조 【비밀유지】</p>
      <p style="margin-bottom:4px;">1. "을"은 자신의 계약내용을 관계인에게 누설하지 않는다.</p>
      <p style="margin-bottom:4px;">2. "을"은 근무지에서 발생하는 인사문제를 관리자에게 보고하여야 하며 조치 받을 수 있도록 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 "갑"에서 발생하는 문제를 외부에 누설하지 않는다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제21조 【계약의 유지】</p>
      <p style="margin-bottom:12px;">"갑"과 "을"은 제2조의 계약기간을 원칙으로 하며 "을"은 이에 동의한다. 위 계약내용이 당사자의 자유로운 의사에 의하여 원만히 체결되었음을 상호 확인하고 각 1통씩 보관한다.</p>
      <p style="font-weight:600;margin:20px 0 16px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,140)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:8px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    <div class="a4" style="page-break-before:always;">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:18pt;font-weight:800;letter-spacing:4px;">개인정보 제3자 제공 동의서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:16px;font-size:9.5pt;color:#556;">본 동의서는 근로계약서의 첨부서류로서, 근로계약 체결 시 근로계약서와 함께 작성합니다.</p>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:16px;">
        <tr><td style="border:1px solid #333;padding:8px 10px;width:150px;background:#F5F7FA;font-weight:700;">제공받는 자</td><td style="border:1px solid #333;padding:8px 10px;">회사가 "을"을 배치하는 모든 현장의 발주처 및 관계 기관</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">제공 목적</td><td style="border:1px solid #333;padding:8px 10px;">계약 이행에 따른 근로자 명부·자격증 확인, 출입증 발급 등 현장 출입·관리</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">제공 항목</td><td style="border:1px solid #333;padding:8px 10px;">성명, 생년월일, 소속, 자격증 사항, 그 밖에 발주처가 계약상 요구하는 최소한의 정보</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">보유·이용 기간</td><td style="border:1px solid #333;padding:8px 10px;">본 근로계약기간(제2조) 동안 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</td></tr>
      </table>
      <p style="margin-bottom:14px;font-size:9.5pt;">귀하는 개인정보의 제3자 제공에 동의하지 않을 권리가 있습니다. 다만 위 정보는 발주처 현장 출입 및 계약 이행에 필요한 최소한의 정보이므로, 동의하지 않을 경우 현장 배치가 제한될 수 있습니다.</p>
      <p style="margin-bottom:6px;">☐ 위 개인정보의 제3자 제공에 동의합니다.</p>
      <p style="margin-bottom:24px;">☐ 위 개인정보의 제3자 제공에 동의하지 않습니다.</p>
      <p style="text-align:right;margin-bottom:8px;">동의일자 : ${fmtDp(f.contractDate)}</p>
      <p style="text-align:right;">근로자(정보주체) 성명 : ${ul(f.name,80)} &nbsp;&nbsp;(인) ${signImg}</p>
    </div>
    </body></html>`);
}
function __psHtml_v0(d0) {
  const ps = __psSavedPs(d0);
  const d = ps;
  const w = d.workerData;
  const c = __psSavedC(d0);

  const [yr, mo] = (d.month||'').split('-');
  const monthLabel = yr && mo ? `${yr}년 ${mo}월` : '-';

  const payRow = (l, v, note='') => `
    <tr>
      <td style="padding:7px 10px;border:1px solid #DDE4EF;font-size:10pt;">${l}</td>
      <td style="padding:7px 10px;border:1px solid #DDE4EF;text-align:right;font-size:10pt;font-weight:600;">${v}</td>
      <td style="padding:7px 10px;border:1px solid #DDE4EF;font-size:9pt;color:#888;">${note}</td>
    </tr>`;

  const deductRow = (l, v, note='') => `
    <tr>
      <td style="padding:7px 10px;border:1px solid #DDE4EF;font-size:10pt;">${l}</td>
      <td style="padding:7px 10px;border:1px solid #DDE4EF;text-align:right;font-size:10pt;font-weight:600;color:#DC2626;">-${psWonR(v)}</td>
      <td style="padding:7px 10px;border:1px solid #DDE4EF;font-size:9pt;color:#888;">${note}</td>
    </tr>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>급여명세서 - ${w.name} ${monthLabel}</title>
    <style>
      body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
      .toolbar{margin-bottom:12px;display:flex;gap:8px;}
      .a4{width:210mm;background:#fff;padding:16mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-size:10pt;line-height:1.7;color:#1A2540;}
      @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:12mm 16mm;width:100%;}}
      table{width:100%;border-collapse:collapse;}
    </style></head><body>
    <div class="toolbar">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">

      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1D5BA6;">
        <div>
          <div style="font-size:20pt;font-weight:800;color:#1D5BA6;letter-spacing:2px;">급 여 명 세 서</div>
          <div style="font-size:12pt;color:#5C6F8A;margin-top:4px;">${monthLabel} &nbsp;·&nbsp; 지급일: ${d.payDate||'미기재'}</div>
        </div>
        <img src="${JH_LOGO}" style="height:44px;object-fit:contain;"/>
      </div>

      <!-- 근로자 기본 정보 -->
      <table style="margin-bottom:14px;">
        <thead><tr style="background:#E8F0FB;">
          <th colspan="4" style="padding:8px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">👤 근로자 기본 정보</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;font-weight:600;color:#5C6F8A;width:18%;">이름</td>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;width:32%;">${w.name||'-'}</td>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;font-weight:600;color:#5C6F8A;width:18%;">사번</td>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;width:32%;">${w.empNo||'-'}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;font-weight:600;color:#5C6F8A;">소속/직급</td>
            <td colspan="3" style="padding:7px 10px;border:1px solid #DDE4EF;">${(w.dept||'-')+' / '+(w.rank||'-')}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;font-weight:600;color:#5C6F8A;">입사일</td>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;">${w.hireDate||'-'}</td>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;font-weight:600;color:#5C6F8A;">생년월일</td>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;">${w.birth6?(w.birth6.slice(0,2)+'.'+w.birth6.slice(2,4)+'.'+w.birth6.slice(4,6)):'-'}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;border:1px solid #DDE4EF;font-weight:600;color:#5C6F8A;">계좌번호</td>
            <td colspan="3" style="padding:7px 10px;border:1px solid #DDE4EF;">${d.bankAccount||'-'}</td>
          </tr>
        </tbody>
      </table>

      <!-- 지급/공제 나란히 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <!-- 지급 내역 -->
        <table>
          <thead><tr style="background:#E8F0FB;">
            <th style="padding:8px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">지급 항목</th>
            <th style="padding:8px 10px;text-align:right;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">금액</th>
            <th style="padding:8px 10px;text-align:left;font-size:9pt;color:#1D5BA6;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${payRow('기본근로수당', psWonR(c.sal.basic), '시급×8×5×4.345')}
            ${payRow('고정연장수당', c.sal.fixedOt?psWonR(c.sal.fixedOt):'—', w.empType==='office'?'시급×12×4.345':'현장직 해당없음')}
            ${payRow('고정야간수당', c.sal.fixedNight?psWonR(c.sal.fixedNight):'—', w.empType==='field'?'시급×0.5×8×5×4.345':'사무직 해당없음')}
            ${payRow('주휴수당', psWonR(c.sal.weekly), '시급×8×4.345')}
            ${payRow('상여금', c.bonus?psWonR(c.bonus):'—', '')}
            ${payRow('특별성과급', c.specialBonus?psWonR(c.specialBonus):'—', '')}
            ${payRow('특근수당', c.extraPay?psWonR(c.extraPay):'—', '')}
            <tr style="background:#E8F0FB;">
              <td style="padding:8px 10px;border:1px solid #DDE4EF;font-weight:700;color:#1D5BA6;">지급계</td>
              <td style="padding:8px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:700;color:#1D5BA6;">${psWonR(c.totalPay)}</td>
              <td style="padding:8px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
        <!-- 공제 내역 -->
        <table>
          <thead><tr style="background:#FEE2E2;">
            <th style="padding:8px 10px;text-align:left;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;">공제 항목</th>
            <th style="padding:8px 10px;text-align:right;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;">금액</th>
            <th style="padding:8px 10px;text-align:left;font-size:9pt;color:#DC2626;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${deductRow('국민연금', c.pension, '월 보수액 × 4.5%')}
            ${deductRow('건강보험', c.health, '월 보수액 × 3.545%')}
            ${deductRow('장기요양보험', c.ltcare, '건강보험 × 12.81%')}
            ${deductRow('고용보험', c.employ, '월 보수액 × 0.9%')}
            ${deductRow('소득세', c.incomeTax, '간이세액표')}
            ${deductRow('지방소득세', c.localTax, '소득세 × 10%')}
            ${c.dormitory?deductRow('기숙사', c.dormitory, '직접 입력'):''}
            <tr style="background:#FEE2E2;">
              <td style="padding:8px 10px;border:1px solid #DDE4EF;font-weight:700;color:#DC2626;">공제계</td>
              <td style="padding:8px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:700;color:#DC2626;">-${psWonR(c.totalDeduct)}</td>
              <td style="padding:8px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 실지급액 -->
      <div style="background:#1D5BA6;border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:14pt;font-weight:700;color:#fff;">실 지급액</span>
        <span style="font-size:18pt;font-weight:800;color:#fff;">${psWonR(c.netPay)}</span>
      </div>

      <!-- 하단 산출식 + 회사 정보 -->
      <div style="border-top:1px solid #DDE4EF;padding-top:12px;">
        <div style="font-size:9pt;color:#888;margin-bottom:10px;line-height:1.8;">
          <strong>산출식</strong><br/>
          국민연금: 지급계×4.5% &nbsp;|&nbsp; 건강보험: 지급계×3.545% &nbsp;|&nbsp;
          장기요양: 건강보험×12.81% &nbsp;|&nbsp; 고용보험: 지급계×0.9%<br/>
          소득세: 간이세액표(부양가족 1인 기준) &nbsp;|&nbsp; 지방소득세: 소득세×10%<br/>
          '기본근로수당: 시급×8×5×4.345 | 연장수당: 시급×(10 또는 12)×4.345 | 주휴수당: 시급×8×4.345'
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:10pt;color:#5C6F8A;">
            <div style="font-weight:700;color:#1A2540;margin-bottom:2px;">제이에이치솔루션</div>
            <div>사업자번호: 383-09-02847 &nbsp;|&nbsp; 대표: 김 종 화</div>
          </div>
          <img src="${JH_LOGO}" style="height:36px;object-fit:contain;"/>
        </div>
      </div>
    </div></body></html>`);
}
function __psHtml_v1(d0) {
  const ps = __psSavedPs(d0);
  const d = ps;
  const w = d.workerData;
  const c = __psSavedC(d0);

  const [yr, mo] = (d.month||'').split('-');
  const monthLabel = yr && mo ? `${yr}년 ${mo}월` : '-';

  const payRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;white-space:nowrap;">${v}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  const deductRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;color:#DC2626;white-space:nowrap;">-${psWonR(v)}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>급여명세서 - ${w.name} ${monthLabel}</title>
    <style>
      body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
      .toolbar{margin-bottom:12px;display:flex;gap:8px;}
      .a4{width:210mm;background:#fff;padding:16mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-size:10pt;line-height:1.7;color:#1A2540;}
      @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:12mm 16mm;width:100%;}}
      table{width:100%;border-collapse:collapse;}
    </style></head><body>
    <div class="toolbar">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">

      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1D5BA6;">
        <div>
          <div style="font-size:20pt;font-weight:800;color:#1D5BA6;letter-spacing:2px;">급 여 명 세 서</div>
          <div style="font-size:12pt;color:#5C6F8A;margin-top:4px;">${monthLabel} &nbsp;·&nbsp; 지급일: ${d.payDate||'미기재'}</div>
        </div>
        <img src="${JH_LOGO}" style="height:44px;object-fit:contain;"/>
      </div>

      <!-- 근로자 기본 정보 -->
      <table style="margin-bottom:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <thead><tr style="background:#E8F0FB;">
          <th colspan="4" style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">👤 근로자 기본 정보</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">이름</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.name||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">사번</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.empNo||'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">소속/직급</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${(w.dept||'-')+' / '+(w.rank||'-')}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">입사일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.hireDate||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">생년월일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.birth6?(w.birth6.slice(0,2)+'.'+w.birth6.slice(2,4)+'.'+w.birth6.slice(4,6)):'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">계좌번호</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${d.bankAccount||'-'}</td>
          </tr>
        </tbody>
      </table>

      <!-- 지급/공제 나란히 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <!-- 지급 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#E8F0FB;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">지급 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#1D5BA6;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${payRow('기본근로수당', psWonR(c.sal.basic), `월소정 ${c.sal.standardHours||209}h 기준(실근무 ${(c.sal.actualHours||0).toFixed(1)}h)`)}
            ${payRow('연장근로수당', c.sal.fixedOt?psWonR(c.sal.fixedOt):'—', (c.sal.otHours||0)>0?`${c.sal.otHours.toFixed(1)}h×1.5`:'해당없음')}
            ${payRow('야간근로수당', c.sal.fixedNight?psWonR(c.sal.fixedNight):'—', (c.sal.nightHours||0)>0?`${c.sal.nightHours.toFixed(1)}h×0.5`:'해당없음')}
            ${payRow('주휴수당', psWonR(c.sal.weekly), c.sal.weeklyEstimated ? '시급×8×4.345(추정)' : `개근 ${c.sal.weeklyQualifyingWeeks}/${c.sal.weeklyTotalWeeks}주`)}
            ${payRow('휴일근로수당', c.sal.holidayPay?psWonR(c.sal.holidayPay):'—', (c.sal.holidayHours||0)>0?`${c.sal.holidayHours.toFixed(1)}h(8h초과분 2.0배)`:'해당없음')}
            ${payRow('상여금', c.bonus?psWonR(c.bonus):'—', '')}
            ${payRow('특별성과급', c.specialBonus?psWonR(c.specialBonus):'—', '')}
            ${payRow('특근수당', c.extraPay?psWonR(c.extraPay):'—', '')}
            <tr style="background:#E8F0FB;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#1D5BA6;white-space:nowrap;">지급계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#1D5BA6;white-space:nowrap;">${psWonR(c.totalPay)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
        <!-- 공제 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#FEE2E2;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">공제 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#DC2626;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${deductRow('국민연금', c.pension, '월 보수액 × 4.5%')}
            ${deductRow('건강보험', c.health, '월 보수액 × 3.545%')}
            ${deductRow('장기요양보험', c.ltcare, '건강보험 × 12.81%')}
            ${deductRow('고용보험', c.employ, '월 보수액 × 0.9%')}
            ${deductRow('소득세', c.incomeTax, '간이세액표')}
            ${deductRow('지방소득세', c.localTax, '소득세 × 10%')}
            ${c.dormitory?deductRow('기숙사', c.dormitory, '직접 입력'):''}
            <tr style="background:#FEE2E2;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#DC2626;white-space:nowrap;">공제계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#DC2626;white-space:nowrap;">-${psWonR(c.totalDeduct)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 실지급액 -->
      <div style="background:linear-gradient(135deg,#1D5BA6,#2E7DD1);border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(29,91,166,0.25);">
        <span style="font-size:14pt;font-weight:700;color:#fff;">실 지급액</span>
        <span style="font-size:18pt;font-weight:800;color:#fff;">${psWonR(c.netPay)}</span>
      </div>

      <!-- 하단 산출식 + 회사 정보 -->
      <div style="border-top:1px solid #DDE4EF;padding-top:12px;">
        <div style="font-size:9pt;color:#8A96A8;margin-bottom:10px;line-height:1.9;">
          <strong style="color:#5C6F8A;">산출식</strong><br/>
          국민연금: 지급계×4.5% &nbsp;|&nbsp; 건강보험: 지급계×3.545% &nbsp;|&nbsp;
          장기요양: 건강보험×12.81% &nbsp;|&nbsp; 고용보험: 지급계×0.9%<br/>
          소득세: 간이세액표(부양가족 1인 기준) &nbsp;|&nbsp; 지방소득세: 소득세×10%<br/>
          기본근로수당: 시급×209h(그 달 소정근로시간 대비 실근무 부족 시 부족분만큼 차감) &nbsp;|&nbsp;
          연장근로수당: 소정근로시간 초과분×시급×1.5<br/>
          야간근로수당: 22:00~06:00 실근무시간×시급×0.5 &nbsp;|&nbsp;
          휴일근로수당: 토·일·공휴일 근무시간 중 8h 이내×1.5, 8h 초과분×2.0<br/>
          주휴수당: 그 주 소정근로일 개근 시 1일(8h)분 지급 — 결근한 주는 미지급 (포괄임금제 미적용, 실제 근무기록 기준 매월 자동 산정)
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:10pt;color:#5C6F8A;">
            <div style="font-weight:700;color:#1A2540;margin-bottom:2px;">제이에이치솔루션</div>
            <div>사업자번호: 383-09-02847 &nbsp;|&nbsp; 대표: 김 종 화</div>
          </div>
          <img src="${JH_LOGO}" style="height:36px;object-fit:contain;"/>
        </div>
      </div>
    </div></body></html>`);
}
function __psHtml_v2(d0) {
  const ps = __psSavedPs(d0);
  const d = ps;
  const w = d.workerData;
  const c = __psSavedC(d0);

  const [yr, mo] = (d.month||'').split('-');
  const monthLabel = yr && mo ? `${yr}년 ${mo}월` : '-';

  const payRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;white-space:nowrap;">${v}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  const deductRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;color:#DC2626;white-space:nowrap;">-${psWonR(v)}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>급여명세서 - ${w.name} ${monthLabel}</title>
    <style>
      body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
      .toolbar{margin-bottom:12px;display:flex;gap:8px;}
      .a4{width:210mm;background:#fff;padding:16mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-size:10pt;line-height:1.7;color:#1A2540;}
      @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:12mm 16mm;width:100%;}}
      table{width:100%;border-collapse:collapse;}
    </style></head><body>
    <div class="toolbar">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">

      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1D5BA6;">
        <div>
          <div style="font-size:20pt;font-weight:800;color:#1D5BA6;letter-spacing:2px;">급 여 명 세 서</div>
          <div style="font-size:12pt;color:#5C6F8A;margin-top:4px;">${monthLabel} &nbsp;·&nbsp; 지급일: ${d.payDate||'미기재'}</div>
        </div>
        <img src="${JH_LOGO}" style="height:44px;object-fit:contain;"/>
      </div>

      <!-- 근로자 기본 정보 -->
      <table style="margin-bottom:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <thead><tr style="background:#E8F0FB;">
          <th colspan="4" style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">👤 근로자 기본 정보</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">이름</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.name||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">사번</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.empNo||'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">소속/직급</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${(w.dept||'-')+' / '+(w.rank||'-')}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">입사일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.hireDate||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">생년월일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.birth6?(w.birth6.slice(0,2)+'.'+w.birth6.slice(2,4)+'.'+w.birth6.slice(4,6)):'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">계좌번호</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${d.bankAccount||'-'}</td>
          </tr>
        </tbody>
      </table>

      <!-- 지급/공제 나란히 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <!-- 지급 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#E8F0FB;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">지급 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#1D5BA6;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${payRow('기본근로수당', psWonR(c.sal.basic), `월소정 ${c.sal.standardHours||209}h 기준(실근무 ${(c.sal.actualHours||0).toFixed(1)}h)`)}
            ${payRow('연장근로수당', c.sal.fixedOt?psWonR(c.sal.fixedOt):'—', (c.sal.otHours||0)>0?`${c.sal.otHours.toFixed(1)}h×1.5`:'해당없음')}
            ${payRow('야간근로수당', c.sal.fixedNight?psWonR(c.sal.fixedNight):'—', (c.sal.nightHours||0)>0?`${c.sal.nightHours.toFixed(1)}h×0.5`:'해당없음')}
            ${payRow('주휴수당', psWonR(c.sal.weekly), c.sal.weeklyEstimated ? '시급×8×4.345(추정)' : `개근 ${c.sal.weeklyQualifyingWeeks}/${c.sal.weeklyTotalWeeks}주`)}
            ${payRow('휴일근로수당', c.sal.holidayPay?psWonR(c.sal.holidayPay):'—', (c.sal.holidayHours||0)>0?`${c.sal.holidayHours.toFixed(1)}h(8h초과분 2.0배)`:'해당없음')}
            ${payRow('상여금', c.bonus?psWonR(c.bonus):'—', '')}
            ${payRow('특별성과급', c.specialBonus?psWonR(c.specialBonus):'—', '')}
            ${payRow('특근수당', c.extraPay?psWonR(c.extraPay):'—', '')}
            ${payRow('기술수당', c.techAllowance?psWonR(c.techAllowance):'—', c.techAllowance?'국가기술자격증 보유':'해당없음')}
            ${payRow('여비교통비', c.travelAllowance?psWonR(c.travelAllowance):'—', c.travelAllowance?(ps._travelType==='longtrip'?`${ps.travelTripCount||1}회 × ${psWonR(ps.travelPerTrip||0)}(왕복KTX, 주1회한도) · 비과세, 지급계 미포함`:ps._travelType?`${ps.travelDays||1}일 × ${psWonR(PS_TRAVEL_PER_DAY[ps._travelType]||0)} · 비과세, 지급계 미포함`:'비과세 · 지급계 미포함, 실지급액에 별도가산'):'해당없음')}
            <tr style="background:#E8F0FB;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#1D5BA6;white-space:nowrap;">지급계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#1D5BA6;white-space:nowrap;">${psWonR(c.totalPay)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
        <!-- 공제 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#FEE2E2;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">공제 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#DC2626;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${deductRow('국민연금', c.pension, '월 보수액 × 4.5%')}
            ${deductRow('건강보험', c.health, '월 보수액 × 3.545%')}
            ${deductRow('장기요양보험', c.ltcare, '건강보험 × 12.81%')}
            ${deductRow('고용보험', c.employ, '월 보수액 × 0.9%')}
            ${deductRow('소득세', c.incomeTax, '간이세액표')}
            ${deductRow('지방소득세', c.localTax, '소득세 × 10%')}
            ${c.dormitory?deductRow('기숙사', c.dormitory, '직접 입력'):''}
            <tr style="background:#FEE2E2;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#DC2626;white-space:nowrap;">공제계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#DC2626;white-space:nowrap;">-${psWonR(c.totalDeduct)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 실지급액 -->
      <div style="background:linear-gradient(135deg,#1D5BA6,#2E7DD1);border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(29,91,166,0.25);">
        <span style="font-size:14pt;font-weight:700;color:#fff;">실 지급액</span>
        <span style="font-size:18pt;font-weight:800;color:#fff;">${psWonR(c.netPay)}</span>
      </div>

      <!-- 하단 산출식 + 회사 정보 -->
      <div style="border-top:1px solid #DDE4EF;padding-top:12px;">
        <div style="font-size:9pt;color:#8A96A8;margin-bottom:10px;line-height:1.9;">
          <strong style="color:#5C6F8A;">산출식</strong><br/>
          국민연금: 지급계×4.5% &nbsp;|&nbsp; 건강보험: 지급계×3.545% &nbsp;|&nbsp;
          장기요양: 건강보험×12.81% &nbsp;|&nbsp; 고용보험: 지급계×0.9%<br/>
          소득세: 간이세액표(부양가족 1인 기준) &nbsp;|&nbsp; 지방소득세: 소득세×10%<br/>
          기본근로수당: 시급×209h(그 달 소정근로시간 대비 실근무 부족 시 부족분만큼 차감) &nbsp;|&nbsp;
          연장근로수당: 소정근로시간 초과분×시급×1.5<br/>
          야간근로수당: 22:00~06:00 실근무시간×시급×0.5 &nbsp;|&nbsp;
          휴일근로수당: 토·일·공휴일 근무시간 중 8h 이내×1.5, 8h 초과분×2.0<br/>
          주휴수당: 그 주 소정근로일 개근 시 1일(8h)분 지급 — 결근한 주는 미지급 (포괄임금제 미적용, 실제 근무기록 기준 매월 자동 산정)
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:10pt;color:#5C6F8A;">
            <div style="font-weight:700;color:#1A2540;margin-bottom:2px;">제이에이치솔루션</div>
            <div>사업자번호: 383-09-02847 &nbsp;|&nbsp; 대표: 김 종 화</div>
          </div>
          <img src="${JH_LOGO}" style="height:36px;object-fit:contain;"/>
        </div>
      </div>
    </div></body></html>`);
}
function __psHtml_v3(d0) {
  const ps = __psSavedPs(d0);
  const d = ps;
  const w = d.workerData;
  const c = __psSavedC(d0);

  const [yr, mo] = (d.month||'').split('-');
  const monthLabel = yr && mo ? `${yr}년 ${mo}월` : '-';

  const payRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;white-space:nowrap;">${v}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  const deductRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;color:#DC2626;white-space:nowrap;">-${psWonR(v)}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>급여명세서 - ${w.name} ${monthLabel}</title>
    <style>
      body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
      .toolbar{margin-bottom:12px;display:flex;gap:8px;}
      .a4{width:210mm;background:#fff;padding:16mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-size:10pt;line-height:1.7;color:#1A2540;}
      @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:12mm 16mm;width:100%;}}
      table{width:100%;border-collapse:collapse;}
    </style></head><body>
    <div class="toolbar">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">

      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1D5BA6;">
        <div>
          <div style="font-size:20pt;font-weight:800;color:#1D5BA6;letter-spacing:2px;">급 여 명 세 서</div>
          <div style="font-size:12pt;color:#5C6F8A;margin-top:4px;">${monthLabel} &nbsp;·&nbsp; 지급일: ${d.payDate||'미기재'}</div>
        </div>
        <img src="${JH_LOGO}" style="height:44px;object-fit:contain;"/>
      </div>

      <!-- 근로자 기본 정보 -->
      <table style="margin-bottom:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <thead><tr style="background:#E8F0FB;">
          <th colspan="4" style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">👤 근로자 기본 정보</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">이름</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.name||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">사번</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.empNo||'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">소속/직급</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${(w.dept||'-')+' / '+(w.rank||'-')}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">입사일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.hireDate||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">생년월일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.birth6?(w.birth6.slice(0,2)+'.'+w.birth6.slice(2,4)+'.'+w.birth6.slice(4,6)):'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">계좌번호</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${d.bankAccount||'-'}</td>
          </tr>
        </tbody>
      </table>

      <!-- 지급/공제 나란히 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <!-- 지급 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#E8F0FB;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">지급 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#1D5BA6;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${payRow('기본근로수당', psWonR(c.sal.basic), `월소정 ${c.sal.standardHours||209}h 기준(실근무 ${(c.sal.actualHours||0).toFixed(1)}h)`)}
            ${payRow('연장근로수당', c.sal.fixedOt?psWonR(c.sal.fixedOt):'—', (c.sal.otHours||0)>0?`${c.sal.otHours.toFixed(1)}h×1.5`:'해당없음')}
            ${payRow('야간근로수당', c.sal.fixedNight?psWonR(c.sal.fixedNight):'—', (c.sal.nightHours||0)>0?`${c.sal.nightHours.toFixed(1)}h×0.5`:'해당없음')}
            ${payRow('주휴수당', psWonR(c.sal.weekly), c.sal.weeklyEstimated ? '시급×8×4.345(추정)' : `개근 ${c.sal.weeklyQualifyingWeeks}/${c.sal.weeklyTotalWeeks}주`)}
            ${payRow('휴일근로수당', c.sal.holidayPay?psWonR(c.sal.holidayPay):'—', (c.sal.holidayHours||0)>0?`${c.sal.holidayHours.toFixed(1)}h(8h초과분 2.0배)`:'해당없음')}
            ${payRow('상여금', c.bonus?psWonR(c.bonus):'—', '')}
            ${payRow('특별성과급', c.specialBonus?psWonR(c.specialBonus):'—', '')}
            ${payRow('특근수당', c.extraPay?psWonR(c.extraPay):'—', '')}
            ${payRow('기술수당', c.techAllowance?psWonR(c.techAllowance):'—', c.techAllowance?'국가기술자격증 보유':'해당없음')}
            ${payRow('여비교통비', c.travelAllowance?psWonR(c.travelAllowance):'—', c.travelAllowance?((ps.travelItems||[]).map(it=>{
              if(it.type==='longtrip') return `${it.tripCount||1}회×${psWonR(it.perTrip||0)}(왕복KTX)`;
              if(it.type) return `${it.days||1}일×${psWonR(PS_TRAVEL_PER_DAY[it.type]||0)}(${PS_TRAVEL_TYPE_LABEL[it.type].replace(/[^가-힣]/g,'').slice(0,4)})`;
              return null;
            }).filter(Boolean).join(' + ') || '비과세, 지급계 미포함')+' · 비과세, 지급계 미포함':'해당없음')}
            <tr style="background:#E8F0FB;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#1D5BA6;white-space:nowrap;">지급계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#1D5BA6;white-space:nowrap;">${psWonR(c.totalPay)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
        <!-- 공제 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#FEE2E2;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">공제 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#DC2626;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${deductRow('국민연금', c.pension, '월 보수액 × 4.5%')}
            ${deductRow('건강보험', c.health, '월 보수액 × 3.545%')}
            ${deductRow('장기요양보험', c.ltcare, '건강보험 × 12.81%')}
            ${deductRow('고용보험', c.employ, '월 보수액 × 0.9%')}
            ${deductRow('소득세', c.incomeTax, '간이세액표')}
            ${deductRow('지방소득세', c.localTax, '소득세 × 10%')}
            ${c.dormitory?deductRow('기숙사', c.dormitory, '직접 입력'):''}
            <tr style="background:#FEE2E2;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#DC2626;white-space:nowrap;">공제계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#DC2626;white-space:nowrap;">-${psWonR(c.totalDeduct)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 실지급액 -->
      <div style="background:linear-gradient(135deg,#1D5BA6,#2E7DD1);border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(29,91,166,0.25);">
        <span style="font-size:14pt;font-weight:700;color:#fff;">실 지급액</span>
        <span style="font-size:18pt;font-weight:800;color:#fff;">${psWonR(c.netPay)}</span>
      </div>

      <!-- 하단 산출식 + 회사 정보 -->
      <div style="border-top:1px solid #DDE4EF;padding-top:12px;">
        <div style="font-size:9pt;color:#8A96A8;margin-bottom:10px;line-height:1.9;">
          <strong style="color:#5C6F8A;">산출식</strong><br/>
          국민연금: 지급계×4.5% &nbsp;|&nbsp; 건강보험: 지급계×3.545% &nbsp;|&nbsp;
          장기요양: 건강보험×12.81% &nbsp;|&nbsp; 고용보험: 지급계×0.9%<br/>
          소득세: 간이세액표(부양가족 1인 기준) &nbsp;|&nbsp; 지방소득세: 소득세×10%<br/>
          기본근로수당: 시급×209h(그 달 소정근로시간 대비 실근무 부족 시 부족분만큼 차감) &nbsp;|&nbsp;
          연장근로수당: 소정근로시간 초과분×시급×1.5<br/>
          야간근로수당: 22:00~06:00 실근무시간×시급×0.5 &nbsp;|&nbsp;
          휴일근로수당: 토·일·공휴일 근무시간 중 8h 이내×1.5, 8h 초과분×2.0<br/>
          주휴수당: 그 주 소정근로일 개근 시 1일(8h)분 지급 — 결근한 주는 미지급 (포괄임금제 미적용, 실제 근무기록 기준 매월 자동 산정)
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:10pt;color:#5C6F8A;">
            <div style="font-weight:700;color:#1A2540;margin-bottom:2px;">제이에이치솔루션</div>
            <div>사업자번호: 383-09-02847 &nbsp;|&nbsp; 대표: 김 종 화</div>
          </div>
          <img src="${JH_LOGO}" style="height:36px;object-fit:contain;"/>
        </div>
      </div>
    </div></body></html>`);
}
function __psHtml_v4(d0) {
  // v4: 내용 변경 없음(근로계약서 동의서 별지 추가에 따른 버전 동기화)
  const ps = __psSavedPs(d0);
  const d = ps;
  const w = d.workerData;
  const c = __psSavedC(d0);

  const [yr, mo] = (d.month||'').split('-');
  const monthLabel = yr && mo ? `${yr}년 ${mo}월` : '-';

  const payRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;white-space:nowrap;">${v}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  const deductRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;color:#DC2626;white-space:nowrap;">-${psWonR(v)}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>급여명세서 - ${w.name} ${monthLabel}</title>
    <style>
      body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
      .toolbar{margin-bottom:12px;display:flex;gap:8px;}
      .a4{width:210mm;background:#fff;padding:16mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-size:10pt;line-height:1.7;color:#1A2540;}
      @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:12mm 16mm;width:100%;}}
      table{width:100%;border-collapse:collapse;}
    </style></head><body>
    <div class="toolbar">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">

      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1D5BA6;">
        <div>
          <div style="font-size:20pt;font-weight:800;color:#1D5BA6;letter-spacing:2px;">급 여 명 세 서</div>
          <div style="font-size:12pt;color:#5C6F8A;margin-top:4px;">${monthLabel} &nbsp;·&nbsp; 지급일: ${d.payDate||'미기재'}</div>
        </div>
        <img src="${JH_LOGO}" style="height:44px;object-fit:contain;"/>
      </div>

      <!-- 근로자 기본 정보 -->
      <table style="margin-bottom:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <thead><tr style="background:#E8F0FB;">
          <th colspan="4" style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">👤 근로자 기본 정보</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">이름</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.name||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">사번</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.empNo||'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">소속/직급</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${(w.dept||'-')+' / '+(w.rank||'-')}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">입사일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.hireDate||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">생년월일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.birth6?(w.birth6.slice(0,2)+'.'+w.birth6.slice(2,4)+'.'+w.birth6.slice(4,6)):'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">계좌번호</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${d.bankAccount||'-'}</td>
          </tr>
        </tbody>
      </table>

      <!-- 지급/공제 나란히 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <!-- 지급 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#E8F0FB;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">지급 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#1D5BA6;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${payRow('기본근로수당', psWonR(c.sal.basic), `월소정 ${c.sal.standardHours||209}h 기준(실근무 ${(c.sal.actualHours||0).toFixed(1)}h)`)}
            ${payRow('연장근로수당', c.sal.fixedOt?psWonR(c.sal.fixedOt):'—', (c.sal.otHours||0)>0?`${c.sal.otHours.toFixed(1)}h×1.5`:'해당없음')}
            ${payRow('야간근로수당', c.sal.fixedNight?psWonR(c.sal.fixedNight):'—', (c.sal.nightHours||0)>0?`${c.sal.nightHours.toFixed(1)}h×0.5`:'해당없음')}
            ${payRow('주휴수당', psWonR(c.sal.weekly), c.sal.weeklyEstimated ? '시급×8×4.345(추정)' : `개근 ${c.sal.weeklyQualifyingWeeks}/${c.sal.weeklyTotalWeeks}주`)}
            ${payRow('휴일근로수당', c.sal.holidayPay?psWonR(c.sal.holidayPay):'—', (c.sal.holidayHours||0)>0?`${c.sal.holidayHours.toFixed(1)}h(8h초과분 2.0배)`:'해당없음')}
            ${payRow('상여금', c.bonus?psWonR(c.bonus):'—', '')}
            ${payRow('특별성과급', c.specialBonus?psWonR(c.specialBonus):'—', '')}
            ${payRow('특근수당', c.extraPay?psWonR(c.extraPay):'—', '')}
            ${payRow('기술수당', c.techAllowance?psWonR(c.techAllowance):'—', c.techAllowance?'국가기술자격증 보유':'해당없음')}
            ${payRow('여비교통비', c.travelAllowance?psWonR(c.travelAllowance):'—', c.travelAllowance?((ps.travelItems||[]).map(it=>{
              if(it.type==='longtrip') return `${it.tripCount||1}회×${psWonR(it.perTrip||0)}(왕복KTX)`;
              if(it.type) return `${it.days||1}일×${psWonR(PS_TRAVEL_PER_DAY[it.type]||0)}(${PS_TRAVEL_TYPE_LABEL[it.type].replace(/[^가-힣]/g,'').slice(0,4)})`;
              return null;
            }).filter(Boolean).join(' + ') || '비과세, 지급계 미포함')+' · 비과세, 지급계 미포함':'해당없음')}
            <tr style="background:#E8F0FB;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#1D5BA6;white-space:nowrap;">지급계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#1D5BA6;white-space:nowrap;">${psWonR(c.totalPay)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
        <!-- 공제 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#FEE2E2;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">공제 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#DC2626;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${deductRow('국민연금', c.pension, '월 보수액 × 4.5%')}
            ${deductRow('건강보험', c.health, '월 보수액 × 3.545%')}
            ${deductRow('장기요양보험', c.ltcare, '건강보험 × 12.81%')}
            ${deductRow('고용보험', c.employ, '월 보수액 × 0.9%')}
            ${deductRow('소득세', c.incomeTax, '간이세액표')}
            ${deductRow('지방소득세', c.localTax, '소득세 × 10%')}
            ${c.dormitory?deductRow('기숙사', c.dormitory, '직접 입력'):''}
            <tr style="background:#FEE2E2;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#DC2626;white-space:nowrap;">공제계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#DC2626;white-space:nowrap;">-${psWonR(c.totalDeduct)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 실지급액 -->
      <div style="background:linear-gradient(135deg,#1D5BA6,#2E7DD1);border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(29,91,166,0.25);">
        <span style="font-size:14pt;font-weight:700;color:#fff;">실 지급액</span>
        <span style="font-size:18pt;font-weight:800;color:#fff;">${psWonR(c.netPay)}</span>
      </div>

      <!-- 하단 산출식 + 회사 정보 -->
      <div style="border-top:1px solid #DDE4EF;padding-top:12px;">
        <div style="font-size:9pt;color:#8A96A8;margin-bottom:10px;line-height:1.9;">
          <strong style="color:#5C6F8A;">산출식</strong><br/>
          국민연금: 지급계×4.5% &nbsp;|&nbsp; 건강보험: 지급계×3.545% &nbsp;|&nbsp;
          장기요양: 건강보험×12.81% &nbsp;|&nbsp; 고용보험: 지급계×0.9%<br/>
          소득세: 간이세액표(부양가족 1인 기준) &nbsp;|&nbsp; 지방소득세: 소득세×10%<br/>
          기본근로수당: 시급×209h(그 달 소정근로시간 대비 실근무 부족 시 부족분만큼 차감) &nbsp;|&nbsp;
          연장근로수당: 소정근로시간 초과분×시급×1.5<br/>
          야간근로수당: 22:00~06:00 실근무시간×시급×0.5 &nbsp;|&nbsp;
          휴일근로수당: 토·일·공휴일 근무시간 중 8h 이내×1.5, 8h 초과분×2.0<br/>
          주휴수당: 그 주 소정근로일 개근 시 1일(8h)분 지급 — 결근한 주는 미지급 (포괄임금제 미적용, 실제 근무기록 기준 매월 자동 산정)
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:10pt;color:#5C6F8A;">
            <div style="font-weight:700;color:#1A2540;margin-bottom:2px;">제이에이치솔루션</div>
            <div>사업자번호: 383-09-02847 &nbsp;|&nbsp; 대표: 김 종 화</div>
          </div>
          <img src="${JH_LOGO}" style="height:36px;object-fit:contain;"/>
        </div>
      </div>
    </div></body></html>`);
}
function __psHtml_v5(d0) {
  // v5: 내용 변경 없음(근로계약서 문구 정리에 따른 버전 동기화)
  // v4: 내용 변경 없음(근로계약서 동의서 별지 추가에 따른 버전 동기화)
  const ps = __psSavedPs(d0);
  const d = ps;
  const w = d.workerData;
  const c = __psSavedC(d0);

  const [yr, mo] = (d.month||'').split('-');
  const monthLabel = yr && mo ? `${yr}년 ${mo}월` : '-';

  const payRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;white-space:nowrap;">${v}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  const deductRow = (l, v, note='') => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:10pt;white-space:nowrap;">${l}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:right;font-size:10pt;font-weight:700;color:#DC2626;white-space:nowrap;">-${psWonR(v)}</td>
      <td style="padding:8px 10px;border:1px solid #E4EAF2;font-size:8.5pt;color:#8A96A8;">${note}</td>
    </tr>`;

  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>급여명세서 - ${w.name} ${monthLabel}</title>
    <style>
      body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
      .toolbar{margin-bottom:12px;display:flex;gap:8px;}
      .a4{width:210mm;background:#fff;padding:16mm 18mm;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-size:10pt;line-height:1.7;color:#1A2540;}
      @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:12mm 16mm;width:100%;}}
      table{width:100%;border-collapse:collapse;}
    </style></head><body>
    <div class="toolbar">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">

      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1D5BA6;">
        <div>
          <div style="font-size:20pt;font-weight:800;color:#1D5BA6;letter-spacing:2px;">급 여 명 세 서</div>
          <div style="font-size:12pt;color:#5C6F8A;margin-top:4px;">${monthLabel} &nbsp;·&nbsp; 지급일: ${d.payDate||'미기재'}</div>
        </div>
        <img src="${JH_LOGO}" style="height:44px;object-fit:contain;"/>
      </div>

      <!-- 근로자 기본 정보 -->
      <table style="margin-bottom:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <thead><tr style="background:#E8F0FB;">
          <th colspan="4" style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;">👤 근로자 기본 정보</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">이름</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.name||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">사번</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.empNo||'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">소속/직급</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${(w.dept||'-')+' / '+(w.rank||'-')}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">입사일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.hireDate||'-'}</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">생년월일</td>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;">${w.birth6?(w.birth6.slice(0,2)+'.'+w.birth6.slice(2,4)+'.'+w.birth6.slice(4,6)):'-'}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#5C6F8A;white-space:nowrap;">계좌번호</td>
            <td colspan="3" style="padding:8px 10px;border:1px solid #E4EAF2;">${d.bankAccount||'-'}</td>
          </tr>
        </tbody>
      </table>

      <!-- 지급/공제 나란히 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <!-- 지급 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#E8F0FB;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">지급 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#1D5BA6;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#1D5BA6;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${payRow('기본근로수당', psWonR(c.sal.basic), `월소정 ${c.sal.standardHours||209}h 기준(실근무 ${(c.sal.actualHours||0).toFixed(1)}h)`)}
            ${payRow('연장근로수당', c.sal.fixedOt?psWonR(c.sal.fixedOt):'—', (c.sal.otHours||0)>0?`${c.sal.otHours.toFixed(1)}h×1.5`:'해당없음')}
            ${payRow('야간근로수당', c.sal.fixedNight?psWonR(c.sal.fixedNight):'—', (c.sal.nightHours||0)>0?`${c.sal.nightHours.toFixed(1)}h×0.5`:'해당없음')}
            ${payRow('주휴수당', psWonR(c.sal.weekly), c.sal.weeklyEstimated ? '시급×8×4.345(추정)' : `개근 ${c.sal.weeklyQualifyingWeeks}/${c.sal.weeklyTotalWeeks}주`)}
            ${payRow('휴일근로수당', c.sal.holidayPay?psWonR(c.sal.holidayPay):'—', (c.sal.holidayHours||0)>0?`${c.sal.holidayHours.toFixed(1)}h(8h초과분 2.0배)`:'해당없음')}
            ${payRow('상여금', c.bonus?psWonR(c.bonus):'—', '')}
            ${payRow('특별성과급', c.specialBonus?psWonR(c.specialBonus):'—', '')}
            ${payRow('특근수당', c.extraPay?psWonR(c.extraPay):'—', '')}
            ${payRow('기술수당', c.techAllowance?psWonR(c.techAllowance):'—', c.techAllowance?'국가기술자격증 보유':'해당없음')}
            ${payRow('여비교통비', c.travelAllowance?psWonR(c.travelAllowance):'—', c.travelAllowance?((ps.travelItems||[]).map(it=>{
              if(it.type==='longtrip') return `${it.tripCount||1}회×${psWonR(it.perTrip||0)}(왕복KTX)`;
              if(it.type) return `${it.days||1}일×${psWonR(PS_TRAVEL_PER_DAY[it.type]||0)}(${PS_TRAVEL_TYPE_LABEL[it.type].replace(/[^가-힣]/g,'').slice(0,4)})`;
              return null;
            }).filter(Boolean).join(' + ') || '비과세, 지급계 미포함')+' · 비과세, 지급계 미포함':'해당없음')}
            <tr style="background:#E8F0FB;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#1D5BA6;white-space:nowrap;">지급계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#1D5BA6;white-space:nowrap;">${psWonR(c.totalPay)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
        <!-- 공제 내역 -->
        <table style="border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <colgroup><col style="width:32%"><col style="width:30%"><col style="width:38%"></colgroup>
          <thead><tr style="background:#FEE2E2;">
            <th style="padding:9px 10px;text-align:left;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">공제 항목</th>
            <th style="padding:9px 10px;text-align:right;font-size:10pt;color:#DC2626;border:1px solid #DDE4EF;white-space:nowrap;">금액</th>
            <th style="padding:9px 10px;text-align:left;font-size:9pt;color:#DC2626;border:1px solid #DDE4EF;">비고</th>
          </tr></thead>
          <tbody>
            ${deductRow('국민연금', c.pension, '월 보수액 × 4.5%')}
            ${deductRow('건강보험', c.health, '월 보수액 × 3.545%')}
            ${deductRow('장기요양보험', c.ltcare, '건강보험 × 12.81%')}
            ${deductRow('고용보험', c.employ, '월 보수액 × 0.9%')}
            ${deductRow('소득세', c.incomeTax, '간이세액표')}
            ${deductRow('지방소득세', c.localTax, '소득세 × 10%')}
            ${c.dormitory?deductRow('기숙사', c.dormitory, '직접 입력'):''}
            <tr style="background:#FEE2E2;">
              <td style="padding:9px 10px;border:1px solid #DDE4EF;font-weight:800;color:#DC2626;white-space:nowrap;">공제계</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;text-align:right;font-weight:800;color:#DC2626;white-space:nowrap;">-${psWonR(c.totalDeduct)}</td>
              <td style="padding:9px 10px;border:1px solid #DDE4EF;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 실지급액 -->
      <div style="background:linear-gradient(135deg,#1D5BA6,#2E7DD1);border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(29,91,166,0.25);">
        <span style="font-size:14pt;font-weight:700;color:#fff;">실 지급액</span>
        <span style="font-size:18pt;font-weight:800;color:#fff;">${psWonR(c.netPay)}</span>
      </div>

      <!-- 하단 산출식 + 회사 정보 -->
      <div style="border-top:1px solid #DDE4EF;padding-top:12px;">
        <div style="font-size:9pt;color:#8A96A8;margin-bottom:10px;line-height:1.9;">
          <strong style="color:#5C6F8A;">산출식</strong><br/>
          국민연금: 지급계×4.5% &nbsp;|&nbsp; 건강보험: 지급계×3.545% &nbsp;|&nbsp;
          장기요양: 건강보험×12.81% &nbsp;|&nbsp; 고용보험: 지급계×0.9%<br/>
          소득세: 간이세액표(부양가족 1인 기준) &nbsp;|&nbsp; 지방소득세: 소득세×10%<br/>
          기본근로수당: 시급×209h(그 달 소정근로시간 대비 실근무 부족 시 부족분만큼 차감) &nbsp;|&nbsp;
          연장근로수당: 소정근로시간 초과분×시급×1.5<br/>
          야간근로수당: 22:00~06:00 실근무시간×시급×0.5 &nbsp;|&nbsp;
          휴일근로수당: 토·일·공휴일 근무시간 중 8h 이내×1.5, 8h 초과분×2.0<br/>
          주휴수당: 그 주 소정근로일 개근 시 1일(8h)분 지급 — 결근한 주는 미지급 (포괄임금제 미적용, 실제 근무기록 기준 매월 자동 산정)
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="font-size:10pt;color:#5C6F8A;">
            <div style="font-weight:700;color:#1A2540;margin-bottom:2px;">제이에이치솔루션</div>
            <div>사업자번호: 383-09-02847 &nbsp;|&nbsp; 대표: 김 종 화</div>
          </div>
          <img src="${JH_LOGO}" style="height:36px;object-fit:contain;"/>
        </div>
      </div>
    </div></body></html>`);
}
function __laborHtml_v6(f0) {
  // v5: 근로자보호 등에 관한 법률·사용사업주 등 파견법 연상 문구 정리 — 2026-09-23 추가
  // v4: 개인정보 제3자 제공 동의서(별지) 근로계약서 뒤에 첨부 — 2026-09-23 추가
  // v6: 제8조(퇴직금 2항 삭제·법정 요건 명시)·제12조(손해배상액 예정 삭제)·제18조(급여 임의 공제 삭제) 법정 요건 정비 — 2026-10-01 추가
  const f=f0;
  const fmtDp=s=>{if(!s)return'____년 __월 __일';const d=new Date(s);return`${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`;};
  const ul=(v,w)=>`<span style="display:inline-block;min-width:${w||80}px;border-bottom:1px solid #333;text-align:center;padding:0 2px;">${v||''}</span>`;
  const signImg=f.signData?`<img src="${f.signData}" style="width:100px;height:40px;object-fit:contain;opacity:0.9;vertical-align:middle;"/>`:`<span style="display:inline-block;width:100px;height:40px;border:1px dashed #ccc;vertical-align:middle;"></span>`;
  return (`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>근로계약서 - ${f.name}</title>
    <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}.a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10pt;line-height:1.9;color:#1A2540;}@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style>
    </head><body>
    <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
      <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
      <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
    </div>
    <div class="a4">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:20pt;font-weight:800;letter-spacing:6px;">근 로 계 약 서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:12px;">제이에이치솔루션 (이하"갑"이라 한다.)과 근로자 ${ul(f.name,80)} (이하 "을"이라 한다.)는 다음과 같이 PJT 계약직 근로계약을 체결한다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제1조 【의 무】</p><p style="margin-bottom:8px;">"을"은 "갑"의 정규직원으로서 "갑"의 사규에 따른 제규정 및 취업규칙에 정해진 근로조건을 승인하고 근로를 성실히 이행할 의무를 진다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제2조 【근로기간】</p><p style="margin-bottom:4px;">1. 근로계약기간 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</p><p style="margin-bottom:8px;">2. PJT계약근로기간이 만료되고 계속 근무의 필요가 있을 때에는 당사자간의 합의 하에 재계약 할 수 있다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제3조 【근무장소 및 대상업무】</p><p style="margin-bottom:4px;">1. "을"은 "갑"이 제공하는 근무장소에서 근무하며, "을"은 이에 따른다.</p><p style="margin-bottom:4px;">&nbsp;&nbsp;1) 소속 : ${ul(f.dept,180)} &nbsp; 직급 : ${ul(f.rank,60)}</p><p style="margin-bottom:8px;">&nbsp;&nbsp;2) 담당 업무 : ${ul(f.job,160)}</p>
      <p style="font-weight:700;margin:14px 0 5px;">제4조 【임 금】</p><p style="margin-bottom:4px;">- 계약연봉 : ${f.salary?`일금 ${Number(f.salary).toLocaleString()}원`:ul('',180)}</p><p style="margin-bottom:4px;">- 세부 지급 사항은 연봉계약서를 기준으로 한다. 임금 지급일 : 익월 말일</p><p style="margin-bottom:8px;">- 여비교통비(실비변상)와 국가기술자격증 보유에 따른 기술수당(월 5만원)은 임금과 별도로 지급하며, 세부 지급 기준은 연봉계약서 제2조의2에 따른다.</p>
      <p style="font-weight:700;margin:14px 0 5px;">제5조 【사회보험】</p><p style="margin-bottom:8px;">☑ 고용보험 &nbsp; ☑ 산재보험 &nbsp; ☑ 국민연금 &nbsp; ☑ 건강보험</p>
      <p style="font-weight:700;margin:12px 0 4px;">제6조 【근로시간】</p>
      <p style="margin-bottom:6px;">근로기준법 제50조에 따라 주 40시간 근로를 원칙으로 한다. 다만 현장 여건에 따라 근로기준법 제53조에 의거하여 최대 12시간까지 연장하여 근로할 수 있다. (식사 및 휴게시간은 근로시간에서 제외)</p>
      <p style="font-weight:700;margin:12px 0 4px;">제7조 【휴게시간】</p>
      <p style="margin-bottom:6px;">4시간 근무마다 30분 휴식, 중식 1시간 의무지급을 원칙으로 한다. 다만, 현장 상황에 따라 유연하게 적용한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제8조 【퇴직금】</p>
      <p style="margin-bottom:6px;">"갑"은 "을"의 계속근로기간이 1년 이상이고 4주간을 평균하여 1주간의 소정근로시간이 15시간 이상인 경우, 근로자퇴직급여 보장법에 따라 퇴직금(퇴직 전 3개월 평균임금의 30일분 이상)을 지급한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제9조 【휴일 및 휴가】</p>
      <p style="margin-bottom:4px;">"을"의 휴일과 휴가는 근로자계약의 내용에 따라 결정되며, 회사는 연차휴가와 관련하여 근로자대표와의 합의에 의하여 특정일을 연차휴가로 대체할 수 있다.</p>
      <p style="margin-bottom:4px;">- 계속 근로 1년 이상, 해당 기간 동안 80% 이상이 될 경우 15일의 유급휴가가 부여된다.</p>
      <p style="margin-bottom:6px;">- "갑"은 계속하여 근로한 기간이 1년 미만인 근로자에게 1개월 개근 시 1일의 유급휴가를 부여한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제10조 【지휘감독 및 근로조건】</p>
      <p style="margin-bottom:6px;">"을"은 "갑"의 소속 단기계약근로자로서 사업주의 지휘감독을 받으며, "갑"의 취업규칙 및 근무지의 제규정을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제11조 【귀책사유】</p>
      <p style="margin-bottom:2px;">1. 직무상의 의무를 위반하거나 근무에 태만하였을 때</p>
      <p style="margin-bottom:2px;">2. "갑"의 이미지를 크게 손상하거나 재산상의 피해를 주었을 때</p>
      <p style="margin-bottom:2px;">3. 비밀누설 및 폭행, 파업 등 규율과 질서를 문란케 하였을 때</p>
      <p style="margin-bottom:2px;">4. 취업기간 중 형사상 유죄판결을 받았을 때</p>
      <p style="margin-bottom:2px;">5. 채용조건에 구비된 각종문서가 위조 또는 변조, 허위사실 등이 기재되었을 때</p>
      <p style="margin-bottom:2px;">6. "갑"의 허가 없이 3일 이상 결근하였을 때</p>
      <p style="margin-bottom:2px;">7. 무단지각, 조퇴, 외출을 월 3회 이상 하였을 때</p>
      <p style="margin-bottom:6px;">8. 계약기간 내에 동종업체로 직접 계약 및 이직하였을 때</p>
      <p style="font-weight:700;margin:12px 0 4px;">제12조 【손해배상】</p>
      <p style="margin-bottom:6px;">"을"의 고의 또는 중대한 과실로 "갑"에게 손해를 끼친 경우 "갑"은 실제 손해를 입증하여 민사상 배상을 청구할 수 있다. 손해액을 미리 정하거나 임금에서 일방적으로 공제하지 아니한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제13조 【재정보증】</p>
      <p style="margin-bottom:4px;">- "을"은 1명의 재정보증인을 설정 신고하거나 "갑"이 요구하는 금액의 신용보증보험에 가입하여야 한다.</p>
      <p style="margin-bottom:6px;">- "갑"은 "을"에게 신용보증보험을 요구할 수 있으며, "을"은 회사의 요구 시 1주일 이내에 제출하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제14조 【안전 및 보건에 관한 사항】</p>
      <p style="margin-bottom:4px;">1. "갑"은 근로자의 안전 및 보건에 관하여 관계 법령이 정하는 바에 따라 필요한 조치를 강구한다.</p>
      <p style="margin-bottom:4px;">2. "을"은 신규 입사 시 즉시 채용신체검사서를 제출하여야 하며, 정기 건강진단을 관련법령에 의거 실시하고 "을"은 이에 반드시 응해야 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 제반 법규 및 "갑"이 정한 제반 안전 교육사항 및 안전수칙을 준수하여야 한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제15조 【취업 전 고지】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용을 취업 전 충분히 숙지하고 이를 성실히 이행한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제16조 【근로조건의 결정】</p>
      <p style="margin-bottom:6px;">"을"은 본 근로계약의 내용에 이의를 제기하지 아니하며 "을"의 근로조건은 "갑"의 취업규칙 및 근로자계약 범위 내에서 결정되는 것에 동의한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제17조 【계약의 해지】</p>
      <p style="margin-bottom:4px;">다음 각 호에 해당하는 경우 갑과 을의 근로계약은 해지된다.</p>
      <p style="margin-bottom:4px;">1. "갑"과 "을"의 상호 합의 하에 근무일을 지정하여 해당 날짜까지 근무 후 계약 종료</p>
      <p style="margin-bottom:4px;">2. "을"의 계약종료 의사를 "갑"이 인지한 시점으로부터 당기 후의 1기가 지난 뒤 해지의 효력이 발생</p>
      <p style="margin-bottom:6px;">3. 제11조 귀책사유 발생 시 "갑"은 일방적으로 "을"과의 근로계약을 해지할 수 있다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제18조 【지급품의 반납】</p>
      <p style="margin-bottom:6px;">퇴직 시 "을"은 "갑"으로부터 지급받은 장비, 피복, 기타 이에 준하는 지급품을 반납하여야 한다. 반납하지 않은 경우 "갑"은 반환 또는 실비 배상을 청구할 수 있으며, 임금에서 임의로 공제하지 아니한다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제19조 【근로기준법의 적용】</p>
      <p style="margin-bottom:6px;">본 계약에 명시되지 않은 사항은 회사의 취업규칙 및 근로기준법의 해석에 준하여 따른다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제20조 【비밀유지】</p>
      <p style="margin-bottom:4px;">1. "을"은 자신의 계약내용을 관계인에게 누설하지 않는다.</p>
      <p style="margin-bottom:4px;">2. "을"은 근무지에서 발생하는 인사문제를 관리자에게 보고하여야 하며 조치 받을 수 있도록 한다.</p>
      <p style="margin-bottom:6px;">3. "을"은 "갑"에서 발생하는 문제를 외부에 누설하지 않는다.</p>
      <p style="font-weight:700;margin:12px 0 4px;">제21조 【계약의 유지】</p>
      <p style="margin-bottom:12px;">"갑"과 "을"은 제2조의 계약기간을 원칙으로 하며 "을"은 이에 동의한다. 위 계약내용이 당사자의 자유로운 의사에 의하여 원만히 체결되었음을 상호 확인하고 각 1통씩 보관한다.</p>
      <p style="font-weight:600;margin:20px 0 16px;">계약일자 : ${fmtDp(f.contractDate)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;">
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(갑)</p><p>사업체명 : 제이에이치솔루션</p><p style="display:flex;align-items:center;gap:4px;">대&nbsp;&nbsp;&nbsp;&nbsp;표 : 김 종 화&nbsp;${_compSignatures&&_compSignatures.kjh?`<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:0.9;">`:`<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`}</p><p>사업자번호 : 383-09-02847</p></div>
        <div style="border-top:1px solid #333;padding-top:12px;"><p style="font-weight:700;margin-bottom:6px;">(을)</p><p>주&nbsp;&nbsp;소 : ${ul(f.address,140)}</p><p>이&nbsp;&nbsp;름 : ${ul(f.name,80)}</p><p>주민등록번호 : ${ul(f.jumin,110)}</p><div style="margin-top:8px;display:flex;align-items:center;gap:8px;"><span>(인)</span>${signImg}</div></div>
      </div>
    </div>
    <div class="a4" style="page-break-before:always;">
      <div style="text-align:center;margin-bottom:28px;"><div style="font-size:18pt;font-weight:800;letter-spacing:4px;">개인정보 제3자 제공 동의서</div><div style="width:60px;height:2px;background:#333;margin:8px auto 0;"></div></div>
      <p style="margin-bottom:16px;font-size:9.5pt;color:#556;">본 동의서는 근로계약서의 첨부서류로서, 근로계약 체결 시 근로계약서와 함께 작성합니다.</p>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:16px;">
        <tr><td style="border:1px solid #333;padding:8px 10px;width:150px;background:#F5F7FA;font-weight:700;">제공받는 자</td><td style="border:1px solid #333;padding:8px 10px;">회사가 "을"을 배치하는 모든 현장의 발주처 및 관계 기관</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">제공 목적</td><td style="border:1px solid #333;padding:8px 10px;">계약 이행에 따른 근로자 명부·자격증 확인, 출입증 발급 등 현장 출입·관리</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">제공 항목</td><td style="border:1px solid #333;padding:8px 10px;">성명, 생년월일, 소속, 자격증 사항, 그 밖에 발주처가 계약상 요구하는 최소한의 정보</td></tr>
        <tr><td style="border:1px solid #333;padding:8px 10px;background:#F5F7FA;font-weight:700;">보유·이용 기간</td><td style="border:1px solid #333;padding:8px 10px;">본 근로계약기간(제2조) 동안 : ${fmtDp(f.startDate)} ~ ${fmtDp(f.endDate)}</td></tr>
      </table>
      <p style="margin-bottom:14px;font-size:9.5pt;">귀하는 개인정보의 제3자 제공에 동의하지 않을 권리가 있습니다. 다만 위 정보는 발주처 현장 출입 및 계약 이행에 필요한 최소한의 정보이므로, 동의하지 않을 경우 현장 배치가 제한될 수 있습니다.</p>
      <p style="margin-bottom:6px;">☐ 위 개인정보의 제3자 제공에 동의합니다.</p>
      <p style="margin-bottom:24px;">☐ 위 개인정보의 제3자 제공에 동의하지 않습니다.</p>
      <p style="text-align:right;margin-bottom:8px;">동의일자 : ${fmtDp(f.contractDate)}</p>
      <p style="text-align:right;">근로자(정보주체) 성명 : ${ul(f.name,80)} &nbsp;&nbsp;(인) ${signImg}</p>
    </div>
    </body></html>`);
}
function __annualHtml_v6(f0){
  // v6: 내용 변경 없음(근로계약서 법정 요건 정비에 따른 버전 동기화) — v5 동결본에 위임
  return __annualHtml_v5(f0);
}
function __psHtml_v6(d0){
  // v6: 내용 변경 없음(근로계약서 법정 요건 정비에 따른 버전 동기화) — v5 동결본에 위임
  return __psHtml_v5(d0);
}
const __ANNUAL_TPL = { v0:__annualHtml_v0, v1:__annualHtml_v1, v2:__annualHtml_v2, v3:__annualHtml_v3, v4:__annualHtml_v4, v5:__annualHtml_v5, v6:__annualHtml_v6 };
const __LABOR_TPL  = { v0:__laborHtml_v0,  v1:__laborHtml_v0,  v2:__laborHtml_v2,  v3:__laborHtml_v2,  v4:__laborHtml_v4,  v5:__laborHtml_v5, v6:__laborHtml_v6 };
const __PS_TPL     = { v0:__psHtml_v0,     v1:__psHtml_v1,     v2:__psHtml_v2,     v3:__psHtml_v3,     v4:__psHtml_v4,     v5:__psHtml_v5, v6:__psHtml_v6 };
function docHtmlByVer(map, d) { return (map[docTplVer(d)] || map[DOC_TPL_CURRENT])(d); }
export { DOC_TPL_CURRENT, DOC_TPL_ERAS, DOC_TPL_HISTORY, docTplVer, __psSavedPs, __psSavedC, __calcAnnualSalary_v0, __calcAnnualSalary_v1, __ANNUAL_TPL, __LABOR_TPL, __PS_TPL, docHtmlByVer };
