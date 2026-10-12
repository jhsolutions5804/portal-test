/* 영업기획 협력사 위탁(하도급) 계약서(신규) — 순수 규칙(화면·네트워크 없이 시험 가능).
 * 법정 기재사항 점검표는 「하도급거래 공정화에 관한 법률」 제3조와 같은 법 시행령 제3조(2026-08-04 개정판 확인)를 따른다: 서면은 건설위탁이면 수급사업자가 착공하기 전까지 발급하고, 원사업자·수급사업자가 서명 또는 기명날인하며,
 * 하도급계약의 내용(위탁일·목적물등, 납품·인도·제공 시기와 장소, 검사 방법과 시기, 하도급대금(선급금·기성금·조정금액 포함)과 지급방법·지급기일, 원재료 등을 제공하는 경우 그 내용)과 하도급대금 연동 사항(예외 요건 있음)을 적어야 한다.
 * ※ 이 점검표는 입력 누락을 막는 보조 도구이며 법률 자문이 아니다. 이 계약이 하도급법·건설산업기본법의 적용 대상인지(업종·원사업자와 수급사업자의 규모)는 법무 확인이 필요하다.
 * 저장: 협력사 문서(gihoek_companies/<협력사>)의 contracts 배열 — 새 컬렉션을 만들지 않아 보안 규칙을 바꿀 필요가 없다. */
const T = (n) => Math.round(Number(n) || 0);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const CONTRACT_STATUS = { draft: '작성 중', issued: '서면 발급', void: '폐기' };
export const KIND_LABEL = { basic: '기본 계약', change: '변경 계약' };
export const LINKAGE_DAYS = 90, LINKAGE_AMOUNT = 100000000;   // 하도급대금 연동 약정 예외 기준(시행령 제3조 제4항: 기간 90일·금액 1억원) — 적용 여부는 법무 확인
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
/** 협력사 문서들에서 계약서를 한 줄로 펼친다(최신 계약 번호 순) */
export function flattenContracts(companies) {
  const out = []; (companies || []).forEach((c) => (c.contracts || []).forEach((k) => out.push(Object.assign({}, k, { partnerId: c.id, partnerName: c.company || '' }))));
  return out.sort((a, b) => String(b.no || '').localeCompare(String(a.no || '')));
}
/** 새 계약 번호: 작성일의 yymm + 세 자리, 모든 협력사의 계약서에서 그달 가장 큰 번호 + 1 */
export function nextContractNo(contracts, date) {
  const yymm = String(date).slice(2, 4) + String(date).slice(5, 7); let max = 0;
  (contracts || []).forEach((k) => { const no = String(k.no || ''); if (no.startsWith(yymm) && /^\d{3,}$/.test(no.slice(4))) max = Math.max(max, parseInt(no.slice(4), 10)); });
  return yymm + String(max + 1).padStart(3, '0');
}
const snap = (c) => (c ? { company: c.company || '', ceo: c.ceo || '', bizno: c.bizno || '', address: c.address || '', tel: c.tel || '' } : { company: '', ceo: '', bizno: '', address: '', tel: '' });
/** 새 계약서 초안: 원사업자(발행처)·수급사업자(협력사)·프로젝트를 정하면 거래처 정보를 그대로 박제한다 */
export function newContract(o) {
  const x = o || {}; const today = x.today || '';
  return { id: 'ct_' + (x.now || Date.now()), no: '', kind: 'basic', parentId: '', title: x.title || '하도급 계약', status: 'draft', partnerId: x.partner ? x.partner.id : '', issuerId: x.issuer ? x.issuer.id : '', pjtId: x.pjtId || '', issuer: snap(x.issuer), partner: snap(x.partner),
    consignDate: today, scope: '', site: '', startDate: '', endDate: '', delivery: '', inspection: '', supply: 0, vatOverride: null, advance: '', progressPay: '', payMethod: '', payDue: '', materials: { provided: false, detail: '' }, adjustment: '', defect: '', special: '', issuerSignedDate: '', partnerSignedDate: '', issuedDate: '', createdDate: today };
}
export function periodDays(c) { return DATE.test(c.startDate || '') && DATE.test(c.endDate || '') && c.endDate >= c.startDate ? dayDiff(c.endDate, c.startDate) + 1 : null; }
export function contractTotals(c) { const supply = T(c.supply); const vat = c.vatOverride != null ? T(c.vatOverride) : Math.round(supply * 0.1); return { supply, vat, total: supply + vat }; }
/** 저장 전 입력 검사(작성 중 문서는 법정 사항이 비어 있어도 저장 가능) */
export function validateContract(c) {
  const errors = []; if (!c.partnerId) errors.push('수급사업자(협력사)를 선택하세요.'); if (!c.issuerId) errors.push('원사업자(발행처)를 선택하세요.'); if (!String(c.title || '').trim()) errors.push('계약명을 입력하세요.');
  ['consignDate', 'startDate', 'endDate', 'issuerSignedDate', 'partnerSignedDate', 'issuedDate'].forEach((k) => { if (c[k] && !DATE.test(c[k])) errors.push('날짜 형식이 올바르지 않습니다(' + k + ').'); });
  if (c.startDate && c.endDate && DATE.test(c.startDate) && DATE.test(c.endDate) && c.endDate < c.startDate) errors.push('준공일이 착공일보다 빠릅니다.');
  if (!(T(c.supply) >= 0)) errors.push('하도급대금(공급가액)은 0 이상의 숫자여야 합니다.'); if (c.vatOverride != null && !(T(c.vatOverride) >= 0)) errors.push('부가세는 0 이상의 숫자여야 합니다.');
  return { ok: !errors.length, errors };
}
const filled = (s) => !!String(s == null ? '' : s).trim();
/** 법정 기재사항 점검표. status: ok(갖춤) · missing(비어 있음) · check(확인 필요) · info(안내) */
export function contractChecklist(c, today) {
  const tot = contractTotals(c); const days = periodDays(c); const out = []; const add = (key, label, law, status, note) => out.push({ key, label, law, status, note: note || '' });
  add('consign', '위탁일과 위탁받은 것(목적물등)의 내용', '시행령 제3조 제1항 제1호', c.consignDate && filled(c.scope) ? 'ok' : 'missing', c.consignDate ? (filled(c.scope) ? '' : '위탁 내용(공사 내용)을 적어 주세요') : '위탁일을 입력하세요');
  add('delivery', '목적물등의 납품·인도·제공 시기 및 장소', '제2호', periodDays(c) != null && (filled(c.site) || filled(c.delivery)) ? 'ok' : 'missing', periodDays(c) == null ? '착공일·준공일을 입력하세요' : '공사 장소 또는 인도 장소를 적어 주세요');
  add('inspection', '목적물등의 검사 방법 및 시기', '제3호', filled(c.inspection) ? 'ok' : 'missing', filled(c.inspection) ? '' : '검사 방법과 시기를 적어 주세요');
  add('price', '하도급대금(선급금·기성금 포함)과 지급방법·지급기일', '제4호', tot.total > 0 && filled(c.payMethod) && filled(c.payDue) ? 'ok' : 'missing', tot.total > 0 ? (filled(c.payMethod) && filled(c.payDue) ? '' : '지급방법과 지급기일을 모두 적어 주세요') : '하도급대금을 입력하세요');
  add('materials', '원재료 등을 제공하는 경우 품명·수량·제공일·대가·대가의 지급방법과 기일', '제5호', !c.materials || !c.materials.provided ? 'ok' : (filled(c.materials.detail) ? 'ok' : 'missing'), !c.materials || !c.materials.provided ? '제공 없음' : (filled(c.materials.detail) ? '' : '제공하는 원재료 내용을 적어 주세요'));
  const linked = days != null && days <= LINKAGE_DAYS ? 'ok' : (tot.total <= LINKAGE_AMOUNT ? 'ok' : (filled(c.adjustment) ? 'ok' : 'check'));
  add('linkage', '하도급대금 연동에 관한 사항(대상 목적물·원재료·조정요건·기준 지표·산식 등)', '법 제3조 제2항 제3호, 시행령 제3조 제2항', linked, days != null && days <= LINKAGE_DAYS ? '하도급거래 기간 ' + LINKAGE_DAYS + '일 이내 — 해당 없음으로 보임(법무 확인)' : tot.total <= LINKAGE_AMOUNT ? '하도급대금 1억원 이하 — 해당 없음으로 보임(법무 확인)' : (filled(c.adjustment) ? '대금 조정·연동 약정이 적혀 있음(7개 사항 충족 여부는 법무 확인)' : '기간 ' + LINKAGE_DAYS + '일 초과·1억원 초과 — 연동 약정이 필요한지 확인하고 설계변경·대금조정란에 적어 주세요'));
  const sign = c.issuerSignedDate && c.partnerSignedDate; add('sign', '원사업자·수급사업자의 서명 또는 기명날인', '법 제3조 제2항', sign ? 'ok' : 'missing', sign ? '' : '양쪽 서명(기명날인)일을 기록하세요 — 한쪽이라도 없으면 서면 미발급으로 봅니다');
  let ts = 'check', tn = '착공 전에 서면을 발급해야 합니다(건설위탁).';
  if (c.issuedDate && DATE.test(c.startDate || '')) { if (c.issuedDate <= c.startDate) { ts = 'ok'; tn = '착공 전 발급'; } else { ts = 'missing'; tn = '착공 후 발급(' + dayDiff(c.issuedDate, c.startDate) + '일 늦음) — 서면 발급 시기를 지키지 못함'; } }
  else if (!c.issuedDate && DATE.test(c.startDate || '') && today && today > c.startDate) { ts = 'missing'; tn = '착공일이 ' + dayDiff(today, c.startDate) + '일 지났는데 아직 서면을 발급하지 않았습니다'; }
  else if (!DATE.test(c.startDate || '')) { ts = 'check'; tn = '착공일을 입력하면 발급 시기를 점검합니다'; }
  add('timing', '서면 발급 시기(착공 전)', '법 제3조 제1항', ts, tn);
  add('keep', '하도급 서류의 보존', '법 제3조, 시행령 제3조', 'info', '계약서·변경계약서·기성·정산 서류를 대통령령에 따라 보존하세요(보존 기간은 시행령 확인)');
  return out;
}
export const checklistSummary = (list) => ({ missing: list.filter((x) => x.status === 'missing').length, check: list.filter((x) => x.status === 'check').length, ok: list.filter((x) => x.status === 'ok').length });
/** 서면 발급(서명 완료 기록) 전 막아야 할 항목: 계약 내용(1~5)과 양쪽 서명·발급일. 발급 시기(착공 전)는 막지 않고 경고만 */
export function issueBlockers(c, today) {
  const list = contractChecklist(c, today); const must = list.filter((x) => ['consign', 'delivery', 'inspection', 'price', 'materials', 'sign'].includes(x.key) && x.status === 'missing').map((x) => x.label + (x.note ? ' — ' + x.note : ''));
  if (!c.issuedDate) must.push('서면 발급일을 입력하세요'); const warn = list.filter((x) => x.key === 'timing' && x.status === 'missing').map((x) => x.note); return { blockers: must, warnings: warn };
}
/** 협력사 문서의 계약서 배열에 이 계약서를 넣은 새 배열(같은 id 면 교체, 없으면 추가) */
export function upsertContract(list, c) { const arr = (list || []).slice(); const i = arr.findIndex((k) => k.id === c.id); if (i < 0) arr.push(c); else arr[i] = c; return arr; }
/** 변경 계약 초안: 기본 계약의 내용을 이어받고 서명·발급은 비운다(금액·기간 등 바뀐 부분만 고치면 된다) */
export function changeFrom(parent, today, now) {
  return Object.assign({}, JSON.parse(JSON.stringify(parent)), { id: 'ct_' + (now || Date.now()), no: '', kind: 'change', parentId: parent.id, title: '변경 계약 — ' + parent.title, status: 'draft', consignDate: today, issuerSignedDate: '', partnerSignedDate: '', issuedDate: '', createdDate: today });
}
export const contractStatusTone = (s) => (s === 'issued' ? 'green' : s === 'void' ? 'gray' : 'amber');
