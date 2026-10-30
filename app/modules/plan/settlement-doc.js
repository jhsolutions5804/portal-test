/* 영업기획 정산서(대금청구서·지급예정서) 양식 — 구포털 기획의 양식을 그대로 옮겼다(동결). 원본과 같은 결과가 나오는지는 tests/plan-settlement-doc.test.mjs 가 원본 함수(tests/fixtures/gihoek_settle_doc.js.txt)와 대조한다.
 * 원본과 다른 점은 하나뿐: 원본은 입력값을 그대로 HTML 에 넣었는데, 안전하게 모든 입력값(내역·비고·거래처·담당자 등)을 이스케이프한다(일반 글자는 결과가 같다). */
import { docFileName, safeText } from '../../shared/doc-filename.js?v=20261030a';
const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR');
const h = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const SET_DOC_CSS = `*{box-sizing:border-box;font-family:'Malgun Gothic',sans-serif}body{margin:0;color:#1a2330;font-size:12px}
  h1{text-align:center;font-size:25px;letter-spacing:10px;margin:0 0 16px;font-weight:800}
  .meta{display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:10px}
  .parties{display:flex;gap:10px;margin-bottom:12px}.pcard{flex:1;border:1px solid #cfd8e6;border-radius:6px;padding:10px 12px}
  .pcard .h{font-size:10px;color:#1D5BA6;font-weight:700;margin-bottom:5px}.pcard .nm{font-size:14px;font-weight:800}.pcard .ln{font-size:11px;color:#444;margin-top:2px}
  .info{border:1px solid #cfd8e6;border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:11.5px;line-height:1.9}
  table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #cfd8e6;padding:7px 8px;font-size:11.5px}
  th{background:#eaf2fc;color:#1D5BA6}tfoot td{font-weight:700;background:#f6f9fd}.stamp{margin-top:22px;text-align:right;font-size:12px}`;
const pjtCode = (projects, id) => { const p = (projects || []).find((x) => x.id === id); return p ? p.code : id; };
/** 정산서 한 장의 본문 HTML. s: 정산서 문서, projects: 프로젝트 목록(프로젝트 표시용) */
export function settleDocHtml(s, projects) {
  const title = s.docType === 'invoice' ? '대 금 청 구 서' : '지 급 예 정 서';
  const dateLabel = s.docType === 'invoice' ? '지급요청일' : '지급예정일'; const sd = s.sender || {}, rc = s.recipient || {}; const p = (projects || []).find((x) => x.id === s.pjtId);
  const pjtLabel = (s.pjtIds && s.pjtIds.length > 1) ? s.pjtIds.map((pid) => { const pp = (projects || []).find((x) => x.id === pid); return pp ? pp.code : pid; }).join(' + ') : (p ? p.code : (s.pjtId ? '-' : '해당 없음'));
  const rows = (s.lines || []).map((it, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${h(it.name)}</td><td>${h(it.spec || '')}</td><td style="text-align:right">${won(it.amount)}</td></tr>`).join('');
  return `<h1>${title}</h1>
  <div class="meta"><span>발행번호: ${h(s.no)}</span><span>발행일: ${h(s.issueDate)}</span></div>
  <div class="parties">
    <div class="pcard"><div class="h">${s.docType === 'invoice' ? '수신 (원청)' : '수신 (하청)'}</div><div class="nm">${h(rc.company || '-')}</div><div class="ln">${rc.ceo ? '대표 ' + h(rc.ceo) : ''}${rc.bizno ? ' / ' + h(rc.bizno) : ''}</div>${rc.contact ? `<div class="ln">${rc.contactTel ? h(rc.contactTel) + ' ' : ''}(${h(rc.contact)})</div>` : (rc.tel ? `<div class="ln">${h(rc.tel)}</div>` : '')}</div>
    <div class="pcard"><div class="h">발신 (공급자)</div><div class="nm">${h(sd.company || '-')}</div><div class="ln">${sd.ceo ? '대표 ' + h(sd.ceo) : ''}${sd.bizno ? ' / ' + h(sd.bizno) : ''}</div>${sd.tel ? `<div class="ln">${h(sd.tel)}</div>` : ''}</div></div>
  <div class="info"><b>프로젝트</b> : ${h(pjtLabel)} &nbsp;&nbsp; <b>기준월</b> : ${h(s.baseMonth)} &nbsp;&nbsp; <b>${dateLabel}</b> : ${h(s.payDate || '-')}</div>
  <table><thead><tr><th style="width:34px">No</th><th>내역</th><th>비고</th><th style="width:130px">금액</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td colspan="3" style="text-align:right">공급가액</td><td style="text-align:right">${won(s.supply)}</td></tr>
    <tr><td colspan="3" style="text-align:right">부가세 (10%)</td><td style="text-align:right">${won(s.vat)}</td></tr>
    <tr><td colspan="3" style="text-align:right;font-size:14px">${s.docType === 'invoice' ? '청구금액 합계' : '지급금액 합계'}</td><td style="text-align:right;font-size:14px">${won(s.total)}</td></tr></tfoot></table>
  ${s.notes ? `<div style="margin-top:14px;border:1px solid #cfd8e6;border-radius:6px;padding:10px 12px"><div style="font-size:10px;color:#1D5BA6;font-weight:700;margin-bottom:4px;letter-spacing:1px">특이사항</div><div style="font-size:11.5px;white-space:pre-wrap">${h(s.notes)}</div></div>` : ''}
  <div class="stamp">위와 같이 ${s.docType === 'invoice' ? '청구' : '지급 예정 통보'}합니다.<br><br>${h(sd.company || '')}　${sd.ceo ? '대표 ' + h(sd.ceo) + ' (인)' : ''} ${sd.contact ? '<br><span style="font-size:11px;color:#555">담당: ' + h(sd.contact) + (sd.contactTel ? ' &nbsp;' + h(sd.contactTel) : '') + (sd.contactEmail ? ' &nbsp;' + h(sd.contactEmail) : '') + '</span>' : ''}</div>`;
}
/** 인쇄 창에 쓰는 전체 페이지(구포털 pvPrint): A4 여백 16mm + 양식 CSS + 본문 + 자동 인쇄. opts.title: PDF 저장 기본 이름(`settleDocTitle` 결과, 없으면 기존 '대금청구서 번호') — 구포털 원본 대조 시험이 지키는 기본 모양은 그대로 */
/** 정산서 자동 이름(대기열 1-2-10, 대표님 2026-10-22 "기준월, 거래처만 고르면 2026년 10월 다람이엔지 정산서"): 기준월 + 거래처 + 정산서. 정산서는 기준월과 거래처로 식별하고 프로젝트는 항목에만 있다.
 * 기준월이 올바르지 않거나 거래처가 없으면 그 부분만 생략한다. 화면 표시용이며 PDF 저장 기본 이름(settleDocTitle, 대표님 확정 규칙)은 이 함수와 별개로 그대로다. */
export function settleName(s) {
  const x = s && typeof s === 'object' ? s : {};
  const m = typeof x.baseMonth === 'string' ? x.baseMonth.match(/^(\d{4})-(0[1-9]|1[0-2])$/) : null;
  const co = x.recipient && typeof x.recipient === 'object' && typeof x.recipient.company === 'string' ? x.recipient.company.trim() : '';
  return [m ? m[1] + '년 ' + Number(m[2]) + '월' : '', co, '정산서'].filter(Boolean).join(' ');
}
const noOfTitle = (n) => String(n == null ? '' : n).replace(/[^0-9A-Za-z가-힣._-]/g, '').slice(0, 30); // 번호만 파일 이름에 쓸 수 있는 문자로(둘 다 없을 때의 대체용)
/** PDF 저장 기본 이름: 종류 - 기준월 - 거래처(대기열 1-2-10, 대표님 2026-10-23 "파일명은 기준월 거래처"). 프로젝트·번호·발행일·담당자는 이름에 넣지 않는다(한 정산서에 프로젝트가 여럿이라 이름이 길어지던 문제).
 * 종류는 모든 문서군에서 맨 앞(대표님 2026-10-17 원칙)이라 유지한다. 기준월이 올바르지 않으면 월 칸을, 거래처가 없으면 거래처 칸을 건너뛰고, 둘 다 없으면 번호로 대체한다(이름이 종류 한 단어만 남으면 여러 장이 구분되지 않는다). */
export function settleDocTitle(s) {
  const x = s && typeof s === 'object' ? s : {};
  const ym = typeof x.baseMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x.baseMonth) ? x.baseMonth : '';
  const party = x.recipient && typeof x.recipient === 'object' && typeof x.recipient.company === 'string' ? x.recipient.company : '';
  const hasParty = !!safeText(party, 40);
  return docFileName({ group: 'month', kind: x.docType === 'invoice' ? '대금청구서' : '지급예정서', ym, party, project: ym || hasParty ? '' : noOfTitle(x.no) });
}
export function settleDocPage(s, projects, opts) {
  return `<!doctype html><meta charset="utf-8"><title>${opts && opts.title ? h(opts.title) : (s.docType === 'invoice' ? '대금청구서' : '지급예정서') + ' ' + h(s.no)}</title><style>@page{size:A4;margin:16mm}${SET_DOC_CSS}</style>${settleDocHtml(s, projects)}<scr` + `ipt>window.onload=function(){setTimeout(function(){window.print();},250);}</scr` + `ipt>`;
}
