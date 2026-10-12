/* ⚠️ 자동 생성 파일 — 직접 수정 금지(동결). 생성기: scripts/dev/build_leave_promo_docs.mjs
 * 구포털 hr 의 연차사용촉진 통보서 양식 l1(1차·추가 1차·2차 지정통보)과 날짜·서식 도우미를 원본 그대로 옮겼다.
 * 저장된 촉진서는 저장 당시 양식(tplVer)으로만 그린다. 새 양식이 필요하면 이 파일을 고치지 말고 새 버전(l2…)을 따로 추가한다.
 * 바깥 의존: 회사 직인 이미지(_compSignatures: company_settings/signatures) — configureLeavePromoDocs() 로 넣는다. */
let _compSignatures = {};
export function configureLeavePromoDocs(o) { const x = o || {}; if (x.signatures !== undefined) _compSignatures = x.signatures || {}; }
const _hzEsc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const _hzParse = s => { if(!s) return null; const d=new Date(String(s).slice(0,10)+'T00:00:00'); return isNaN(d.getTime())?null:d; };
const _hzYmd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _hzAddDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const _hzAddMonths = (d,n) => { const t=new Date(d.getFullYear(), d.getMonth()+n, 1); const last=new Date(t.getFullYear(), t.getMonth()+1, 0).getDate(); return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)); };
const _hzDiffDays = (a,b) => Math.round((b.getTime()-a.getTime())/86400000);
const _hzDot = s => { const d=(s instanceof Date)?s:_hzParse(s); return d ? `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}` : '-'; };
const _hzKor = s => { const d=(s instanceof Date)?s:_hzParse(s); return d ? `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일` : '____년 __월 __일'; };
const _hzDow = d => '일월화수목금토'[d.getDay()];
const _hzToday = () => _hzYmd(new Date());
function _hzCompanyBlock(){
  const sig = (typeof _compSignatures!=='undefined' && _compSignatures && _compSignatures.kjh)
    ? `<img src="${_compSignatures.kjh}" style="height:34px;max-width:80px;object-fit:contain;vertical-align:middle;opacity:.9;">`
    : `<span style="display:inline-block;width:56px;height:30px;border:1px dashed #ccc;vertical-align:middle;text-align:center;line-height:30px;font-size:10px;color:#aaa;">(인)</span>`;
  return `<div style="margin-top:26px;text-align:right;line-height:2;">
    <p style="margin:0;">사업체명 : 제이에이치솔루션</p>
    <p style="margin:0;">대&nbsp;&nbsp;&nbsp;표 : 김 종 화 &nbsp;${sig}</p>
    <p style="margin:0;">사업자번호 : 383-09-02847</p></div>`;
}
function _hzDocShell(title, bodyHtml){
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${_hzEsc(title)}</title>
  <style>body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:#888;display:flex;flex-direction:column;align-items:center;padding:20px;}
  .a4{width:210mm;min-height:297mm;background:#fff;padding:20mm 22mm;box-shadow:0 4px 24px rgba(0,0,0,.2);font-size:10.5pt;line-height:1.8;color:#1A2540;box-sizing:border-box;}
  h1{text-align:center;font-size:20pt;letter-spacing:6px;margin:0 0 6px;} .ul{width:60px;height:2px;background:#333;margin:8px auto 24px;}
  table.kv{width:100%;border-collapse:collapse;margin:10px 0;} table.kv th{border:1px solid #333;background:#F0F3F8;padding:7px 10px;width:130px;text-align:left;font-size:10pt;vertical-align:top;} table.kv td{border:1px solid #333;padding:7px 10px;font-size:10pt;vertical-align:top;}
  .box{border:1px solid #333;padding:10px 14px;margin-top:18px;font-size:10pt;line-height:2;}
  @media print{body{background:#fff;padding:0;}.toolbar{display:none;}.a4{box-shadow:none;padding:15mm 20mm;width:100%;}}</style></head><body>
  <div class="toolbar" style="margin-bottom:12px;display:flex;gap:8px;">
    <button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button>
    <button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button>
  </div>
  <div class="a4">${bodyHtml}</div></body></html>`;
}
function __leavePromoHtml_l1(r) {
  const y0 = r.category === 'y0', isP2 = r.stage === 'p2', isX = r.stage === 'p1x';
  const law = y0 ? (isP2 ? '제61조 제2항 제2호' : '제61조 제2항 제1호' + (isX ? ' 단서' : '')) : (isP2 ? '제61조 제1항 제2호' : '제61조 제1항 제1호');
  const periodLabel = y0 ? '최초 1년의 근로기간' : '연차 유급휴가 사용 가능 기간<br>(회계연도 기준)';
  const title = isP2 ? '연차 유급휴가 사용 시기 지정 통보서 (2차)' : `연차 유급휴가 사용 촉진 통보서 (${isX?'추가 1차':'1차'})`;
  const n = _hzParse(r.noticeDate);
  const replyDue = n ? _hzKor(_hzAddDays(n,10)) : '';
  const p = { start:_hzParse(r.periodStart), end:_hzParse(r.periodEnd) };
  const dl2 = y0 ? _hzKor(_hzAddDays(_hzAddMonths(p.start,11),-1)) : _hzKor(_hzAddDays(_hzAddMonths(p.start,10),-1));
  const dl2x = y0 ? _hzKor(_hzAddDays(p.end,-10)) : '';
  const head = `
    <h1 style="font-size:17pt;letter-spacing:2px;">${title}</h1><div class="ul"></div>
    <table class="kv">
      <tr><th>수 신</th><td>${_hzEsc(r.workerName)} (${_hzEsc(r.dept)||'-'} / ${_hzEsc(r.rank)||'-'})</td></tr>
      <tr><th>발 신</th><td>제이에이치솔루션 대표 김종화</td></tr>
      <tr><th>통 보 일</th><td>${_hzKor(r.noticeDate)}</td></tr>
    </table>`;
  const stats = `<table class="kv">
      <tr><th>${periodLabel}</th><td>${_hzKor(r.periodStart)} ~ ${_hzKor(r.periodEnd)}</td></tr>
      <tr><th>발생 일수</th><td>${r.grantDays}일</td></tr>
      <tr><th>사용 일수<br>(통보일 기준)</th><td>${r.usedDays}일</td></tr>
      <tr><th>미사용 일수</th><td><b>${r.unusedDays}일</b></td></tr>
    </table>`;
  const law2 = y0 ? (isX ? '제61조 제2항 제2호 단서' : '제61조 제2항 제2호') : '제61조 제1항 제2호';
  let dlText;
  if (!y0) dlText = `연차 사용 가능 기간이 끝나기 2개월 전(${dl2})`;
  else if (isX) dlText = `최초 1년의 근로기간이 끝나기 10일 전(${dl2x})`;
  else dlText = `최초 1년의 근로기간이 끝나기 1개월 전(${dl2}) (1차 이후 발생분은 종료 10일 전인 ${dl2x})`;
  let body;
  if (!isP2) {
    body = `${head}
    <p style="margin:14px 0 6px;">「근로기준법」 ${law}에 따라, 귀하의 연차 유급휴가 사용을 아래와 같이 촉구합니다.</p>
    ${stats}
    <ol style="margin:10px 0 0 18px;padding:0;line-height:1.9;">
      <li>귀하는 위 미사용 연차 유급휴가 <b>${r.unusedDays}일</b>에 대하여, 이 통보서를 받은 날부터 10일 이내(<b>${replyDue}</b>까지)에 사용 시기를 정하여 회사에 서면(아래 회신란)으로 통보하여 주시기 바랍니다.</li>
      <li>위 기한 내에 사용 시기를 통보하지 않는 경우, 회사는 「근로기준법」 ${law2}에 따라 ${dlText}까지 미사용 연차 유급휴가의 사용 시기를 지정하여 서면으로 통보할 예정입니다.</li>
      <li>위 절차에도 불구하고 사용하지 않아 소멸된 연차 유급휴가에 대하여는 「근로기준법」 제61조에 따라 회사가 보상할 의무가 없습니다.</li>
    </ol>
    ${_hzCompanyBlock()}
    <div class="box"><div style="font-weight:700;">회신란 (근로자 작성)</div>
      사용 예정일 : ____________ , ____________ , ____________ , ____________ , ____________ (총 ____일)<br>
      회신일 : ________년 ____월 ____일 &nbsp;&nbsp; 성명 : ________________ (서명 또는 인)</div>
    <div class="box"><div style="font-weight:700;">수령 확인</div>
      위 통보서를 ________년 ____월 ____일에 수령하였음을 확인합니다. &nbsp;&nbsp; 성명 : ________________ (서명 또는 인)</div>`;
  } else {
    const list = (r.designatedDates||[]).map(d => `${_hzDot(d)}(${_hzDow(_hzParse(d))})`).join(', ') || '-';
    const prior = (r.priorReplyDates && r.priorReplyDates.length) ? `<tr><th>근로자가 통보한<br>사용 예정일</th><td>${r.priorReplyDates.map(d=>`${_hzDot(d)}(${_hzDow(_hzParse(d))})`).join(', ')} <span style="color:#555;">(참고)</span></td></tr>` : '';
    body = `${head}
    <p style="margin:14px 0 6px;">「근로기준법」 ${law}에 따라, 회사는 귀하가 ${r.p1NoticeDate?`1차 촉구(${_hzKor(r.p1NoticeDate)} 통보)를 받은 날부터 10일 이내에`:'1차 촉구를 받은 날부터 10일 이내에'} 미사용 연차 유급휴가의 사용 시기를 ${prior?'전부 ':''}정하여 통보하지 않았으므로, ${prior?'통보하지 않은 나머지에 대하여 ':''}아래와 같이 사용 시기를 지정하여 통보합니다.</p>
    ${stats}
    <table class="kv">${prior}<tr><th>회사가 지정한<br>사용일</th><td><b>${list}</b> <span style="color:#555;">(총 ${(r.designatedDates||[]).length}일)</span></td></tr></table>
    <p style="margin:10px 0 0;">지정된 사용일에는 회사가 근로 제공을 받지 않으며(노무 수령 거부), 해당 일은 연차 유급휴가 사용일로 처리됩니다. 사용 시기의 변경이 필요한 경우 미리 회사와 협의하시기 바랍니다.</p>
    ${_hzCompanyBlock()}
    <div class="box"><div style="font-weight:700;">수령 확인</div>
      위 통보서를 ________년 ____월 ____일에 수령하였음을 확인합니다. &nbsp;&nbsp; 성명 : ________________ (서명 또는 인)</div>`;
  }
  return _hzDocShell(`${title} - ${r.workerName||''}`, body);
}
const __LEAVEPROMO_TPL = { l1: __leavePromoHtml_l1 };
function leavePromoHtmlByVer(r) { return (__LEAVEPROMO_TPL[r.tplVer] || __LEAVEPROMO_TPL.l1)(r); }
export { _hzEsc, _hzParse, _hzYmd, _hzAddDays, _hzAddMonths, _hzDiffDays, _hzDot, _hzKor, _hzDow, _hzToday, _hzCompanyBlock, _hzDocShell, __leavePromoHtml_l1, __LEAVEPROMO_TPL, leavePromoHtmlByVer };
