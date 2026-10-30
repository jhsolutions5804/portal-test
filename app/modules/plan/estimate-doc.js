/* 영업기획 견적서(인쇄/PDF) 양식 — 구포털 기획의 견적서 양식을 그대로 옮겼다(동결). 원본과 같은 결과가 나오는지는 tests/plan-estimate-doc.test.mjs 가 원본 함수(tests/fixtures/gihoek_print_est.js.txt)와 대조한다.
 * 원본과 다른 점은 하나뿐: 원본은 특기사항만 HTML 이스케이프했는데, 안전하게 모든 입력값(품명·규격·비고·제목·거래처 등)을 이스케이프한다(일반 글자는 결과가 같다). */
import { itemAmt, estSupply } from './projects.js?v=20261030a';
import { docFileName } from '../../shared/doc-filename.js?v=20261030a';
/** PDF 저장 기본 이름: 날짜_거래처(담당자)_현장명_견적명_견적서 — 화면 호출부와 시험이 같은 함수를 쓴다(정산서의 settleDocTitle 과 같은 구조). p = 연결 프로젝트(없으면 null) */
export const estDocTitle = (e, p) => docFileName({ group: 'project', project: p && (p.code || p.name), kind: '견적서', no: e.no, party: e.client && e.client.company, contact: e.client && e.client.contact, title: e.title, rev: e.rev, date: e.date });
const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR');
const h = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 견적서 한 장의 HTML. e: 견적 문서, p: 연결 프로젝트(없으면 null), opts.title: PDF 저장 기본 이름(`docFileName` 결과, 없으면 기존 '견적서 번호') */
export function estDocHtml(e, p, opts) {
  const sup = estSupply(e), vat = Math.round(sup * 0.1), tot = sup + vat; const iss = e.issuer || {}, cl = e.client || {};
  const rows = (e.items || []).map((it, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${h(it.name)}</td><td>${h(it.spec)}</td><td style="text-align:right">${won(it.qty)}</td><td style="text-align:right">${won(it.price)}</td><td style="text-align:right">${won(itemAmt(it))}</td><td>${h(it.remark)}</td></tr>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${opts && opts.title ? h(opts.title) : '견적서 ' + h(e.no)}</title>
  <style>@page{size:A4;margin:16mm}*{box-sizing:border-box;font-family:'Malgun Gothic','맑은 고딕',sans-serif}
  body{margin:0;color:#1a2330;font-size:12px}
  h1{text-align:center;font-size:26px;letter-spacing:14px;margin:0 0 18px;font-weight:800}
  .meta{display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:10px}
  .parties{display:flex;gap:10px;margin-bottom:14px}
  .pcard{flex:1;border:1px solid #cfd8e6;border-radius:6px;padding:10px 12px}
  .pcard .h{font-size:10px;color:#1D5BA6;font-weight:700;margin-bottom:6px;letter-spacing:1px}
  .pcard .nm{font-size:14px;font-weight:800}
  .pcard .ln{font-size:11px;color:#444;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid #cfd8e6;padding:7px 8px;font-size:11.5px}
  th{background:#eaf2fc;color:#1D5BA6;font-weight:700}
  tfoot td{font-weight:700;background:#f6f9fd}
  .tot{font-size:14px}
  .stamp{margin-top:24px;text-align:right;font-size:12px;color:#333}
  .title-row{font-size:13px;font-weight:700;margin:6px 0 12px;text-align:center;color:#1D5BA6}
  </style></head><body>
  <h1>견 적 서</h1>
  <div class="meta"><span>견적번호: ${h(e.no)}${(e.rev || 1) > 1 ? ' (개정 r' + h(e.rev) + ')' : ''}</span><span>작성일: ${h(e.date)}</span></div>
  <div class="parties">
    <div class="pcard"><div class="h">공급받는자</div><div class="nm">${h(cl.company || '-')}</div>
      <div class="ln">${cl.ceo ? '대표 ' + h(cl.ceo) : ''}${cl.bizno ? ' / ' + h(cl.bizno) : ''}</div>${cl.contact ? `<div class="ln">${cl.contactTel ? h(cl.contactTel) + ' ' : ''}(${h(cl.contact)})</div>` : (cl.tel ? `<div class="ln">${h(cl.tel)}</div>` : '')}${cl.address ? `<div class="ln">${h(cl.address)}</div>` : ''}</div>
    <div class="pcard"><div class="h">공급자</div><div class="nm">${h(iss.company || '-')}</div>
      <div class="ln">${iss.ceo ? '대표 ' + h(iss.ceo) : ''}${iss.bizno ? ' / ' + h(iss.bizno) : ''}</div>${iss.tel ? `<div class="ln">${h(iss.tel)}</div>` : ''}${iss.email ? `<div class="ln">${h(iss.email)}</div>` : ''}</div>
  </div>
  <div class="title-row">${p ? '[' + h(p.code) + '] ' : ''}${h(e.title)}</div>
  <table><thead><tr><th style="width:34px">No</th><th>품명</th><th>규격</th><th style="width:60px">수량</th><th style="width:96px">단가</th><th style="width:110px">금액</th><th style="width:90px">비고</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr><td colspan="5" style="text-align:right">공급가액</td><td style="text-align:right">${won(sup)}</td><td></td></tr>
    <tr><td colspan="5" style="text-align:right">부가세 (10%)</td><td style="text-align:right">${won(vat)}</td><td></td></tr>
    <tr class="tot"><td colspan="5" style="text-align:right">합계금액</td><td style="text-align:right">${won(tot)}</td><td></td></tr>
  </tfoot></table>
  ${e.notes ? `<div style="margin-top:14px;border:1px solid #cfd8e6;border-radius:6px;padding:10px 12px"><div style="font-size:10px;color:#1D5BA6;font-weight:700;margin-bottom:4px;letter-spacing:1px">특기사항</div><div style="font-size:11.5px;white-space:pre-wrap">${h(e.notes)}</div></div>` : ''}
  <div class="stamp">위와 같이 견적합니다.<br><br>${h(iss.company || '')} ${iss.ceo ? '　대표 ' + h(iss.ceo) + ' (인)' : ''} ${iss.contact ? '<br><span style="font-size:11px;color:#555">담당: ' + h(iss.contact) + (iss.contactTel ? ' &nbsp;' + h(iss.contactTel) : '') + (iss.contactEmail ? ' &nbsp;' + h(iss.contactEmail) : '') + '</span>' : ''}</div>
  <scr` + `ipt>window.onload=function(){setTimeout(function(){window.print();},250);}</scr` + `ipt>
  


</body></html>`;
}
