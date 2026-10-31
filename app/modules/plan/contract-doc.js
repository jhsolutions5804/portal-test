import { esc } from '../../core/ui.js?v=20261031d';
import { contractTotals, periodDays } from './contracts.js?v=20261031d';
import { docFileName } from '../../shared/doc-filename.js?v=20261031d';
const w = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const dot = (d) => (d ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1년 $2월 $3일') : '____년 __월 __일');
const CSS = '@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box;font-family:\'Malgun Gothic\',\'Apple SD Gothic Neo\',sans-serif}body{margin:0;color:#111;font-size:12px;line-height:1.7}h1{text-align:center;font-size:24px;letter-spacing:6px;margin:0 0 4px}.no{text-align:center;color:#555;margin-bottom:14px}.lead{margin:10px 0 14px;text-align:justify}h2{font-size:13px;margin:14px 0 4px}table.k{width:100%;border-collapse:collapse;margin:4px 0}table.k th,table.k td{border:1px solid #888;padding:5px 8px;font-size:11.5px;vertical-align:top}table.k th{background:#f1f3f6;width:23%;text-align:left}p{margin:2px 0}.sig{display:flex;gap:16px;margin-top:22px}.sig>div{flex:1;border:1px solid #888;padding:10px 12px}.sig b{display:block;margin-bottom:6px}.date{text-align:center;margin:18px 0 6px;font-size:13px}.stamp{display:inline-block;margin-left:10px;color:#666}';
/** 하도급(위탁) 계약서 인쇄 문서(A4). 조항 문구는 일반적인 구성이며, 입력한 내용만 채워 넣는다 — 서명 전에 법무 검토를 받는 것을 전제로 한 초안 양식 */
export function contractDocPage(c, o) {
  const x = o || {}; const t = contractTotals(c); const d = periodDays(c); const iss = c.issuer || {}, par = c.partner || {};
  const party = (label, p, signedDate) => '<div><b>' + label + '</b>상호: ' + esc(p.company || '') + '<br>사업자등록번호: ' + esc(p.bizno || '') + '<br>주소: ' + esc(p.address || '') + '<br>대표자: ' + esc(p.ceo || '') + ' <span class="stamp">(서명 또는 기명날인)</span><br><span style="color:#666">서명일: ' + dot(signedDate) + '</span></div>';
  const row = (th, td) => '<tr><th>' + th + '</th><td>' + td + '</td></tr>';
  return '<!doctype html><meta charset="utf-8"><title>' + esc(docFileName({ group: 'project', project: x.projectName, kind: c.kind === 'change' ? '하도급 변경 계약서' : '하도급 계약서', no: c.no, party: c.partner && c.partner.company, date: c.issuedDate || c.consignDate }) || ((c.title || '계약서') + ' ' + (c.no || ''))) + '</title><style>' + CSS + '</style>'
    + '<h1>' + (c.kind === 'change' ? '하도급 변경 계약서' : '하도급 계약서') + '</h1><div class="no">계약번호 ' + esc(c.no || '(발급 전)') + ' · ' + esc(c.title || '') + '</div>'
    + '<p class="lead">원사업자 <b>' + esc(iss.company || '') + '</b>(이하 "갑")와 수급사업자 <b>' + esc(par.company || '') + '</b>(이하 "을")는 아래와 같이 하도급 계약을 체결하고, 이 계약의 성실한 이행을 위하여 서명(또는 기명날인)한 계약서 2부를 작성하여 각각 1부씩 보관한다.</p>'
    + '<h2>제1조 (위탁일 및 위탁 내용)</h2><table class="k">' + row('위탁일', dot(c.consignDate)) + row('공사(용역)명', esc(x.projectName || c.title || '')) + row('위탁 내용', nl(c.scope || '')) + row('공사 장소', esc(c.site || '')) + '</table>'
    + '<h2>제2조 (공사기간 및 납품·인도 시기와 장소)</h2><table class="k">' + row('착공일', dot(c.startDate)) + row('준공일', dot(c.endDate) + (d ? ' (' + d + '일간)' : '')) + row('납품·인도 시기·장소', nl(c.delivery || '')) + '</table>'
    + '<h2>제3조 (검사의 방법 및 시기)</h2><table class="k">' + row('검사', nl(c.inspection || '')) + '</table>'
    + '<h2>제4조 (하도급대금 및 지급)</h2><table class="k">' + row('하도급대금', '금 ' + w(t.total) + '원 (공급가액 ' + w(t.supply) + '원 + 부가가치세 ' + w(t.vat) + '원)') + row('선급금', nl(c.advance || '없음')) + row('기성금', nl(c.progressPay || '')) + row('지급방법', nl(c.payMethod || '')) + row('지급기일', nl(c.payDue || '')) + '</table><p>갑이 하도급대금의 지급을 지연하는 경우 관계 법령에서 정한 이율에 따른 지연이자를 지급한다.</p>'
    + '<h2>제5조 (원재료 등의 제공)</h2><table class="k">' + row('제공 여부', c.materials && c.materials.provided ? nl(c.materials.detail || '') : '갑은 을에게 원재료 등을 제공하지 않는다.') + '</table>'
    + '<h2>제6조 (설계변경, 대금 조정 및 하도급대금 연동)</h2><table class="k">' + row('내용', c.adjustment ? nl(c.adjustment) : '관계 법령 및 갑·을의 협의에 따른다.') + '</table>'
    + '<h2>제7조 (하자담보)</h2><table class="k">' + row('내용', c.defect ? nl(c.defect) : '관계 법령에 따른다.') + '</table>'
    + '<h2>제8조 (특약사항)</h2><table class="k">' + row('내용', c.special ? nl(c.special) : '없음') + '</table>'
    + '<h2>제9조 (계약의 변경)</h2><p>이 계약의 내용을 변경하는 경우 갑과 을은 변경 내용을 적은 서면에 서명 또는 기명날인한다.</p>'
    + '<div class="date">' + dot(c.issuedDate) + '</div><div class="sig">' + party('원사업자 (갑)', iss, c.issuerSignedDate) + party('수급사업자 (을)', par, c.partnerSignedDate) + '</div>'
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},250);}</scr' + 'ipt>';
}
