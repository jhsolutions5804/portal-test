/* 영업기획 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 규칙을 그대로 옮긴다.
 * 거래처 역할은 "발행처(우리 발행 주체)"와 "수신처(거래 상대: 견적·청구의 고객, 지급예정서의 수신처)". 새로 `roleVendor`(협력사 — 지급 대상 표시)를 덧붙였고 구포털은 이 필드를 몰라도 동작한다. */
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/** 전화번호 입력 정리(구포털 fmtTel 그대로): 숫자만 남겨 3-3-4 / 3-4-4 모양으로 */
export function fmtTel(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length <= 3) return d; if (d.length <= 6) return d.slice(0, 3) + '-' + d.slice(3); if (d.length <= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7, 11);
}
/** 입력칸을 떠날 때(구포털 fmtTelBlur): 0으로 시작하지 않는 8자리는 휴대폰 앞자리 010 을 붙인다 */
export function fmtTelBlur(v) { let d = String(v == null ? '' : v).replace(/\D/g, ''); if (d.length === 8 && d[0] !== '0') d = '010' + d; return fmtTel(d); }

export const COMP_ROLES = [['roleSupplier', '발행처', '우리가 발행'], ['roleClient', '수신처', '거래 상대'], ['roleVendor', '협력사', '지급 대상(위탁·지급예정서)']];
export const MAX_CONTACTS = 20;
export const compNew = () => ({ company: '', roleSupplier: false, roleClient: false, roleVendor: false, ceo: '', bizno: '', address: '', contacts: [] });
export const compToForm = (c) => { const x = c || {}; return { company: x.company || '', roleSupplier: !!x.roleSupplier, roleClient: !!x.roleClient, roleVendor: !!x.roleVendor, ceo: x.ceo || '', bizno: x.bizno || '', address: x.address || '', contacts: (x.contacts || []).map((t) => ({ name: (t && t.name) || '', tel: (t && t.tel) || '', email: (t && t.email) || '' })) }; };
export const contactsClean = (list) => (list || []).filter((t) => t && (t.name || t.tel || t.email)).map((t) => ({ name: String(t.name || '').trim(), tel: String(t.tel || '').trim(), email: String(t.email || '').trim() }));

/** 목록 묶음: 발행처 · 수신처 · 역할 미지정(구포털과 같은 구성, 이름 가나다순). 협력사 보기는 roleVendor 인 업체만 */
export function compGroups(list, view) {
  const sorted = (list || []).slice().sort((a, b) => String(a.company || '').localeCompare(String(b.company || ''), 'ko'));
  if (view === 'partners') return { vendors: sorted.filter((c) => c.roleVendor) };
  return { sup: sorted.filter((c) => c.roleSupplier), cli: sorted.filter((c) => c.roleClient), none: sorted.filter((c) => !c.roleSupplier && !c.roleClient) };
}
/** 저장 검사. 구포털 saveComp 와 같은 규칙: 회사명 필수, 역할이 하나도 없으면 확인(warnings), 비어 있는 담당자 줄은 버림. id 는 기존 것 또는 'co_' + 시각 */
export function compBuild(form, opt) {
  const f = form || {}; const o = opt || {}; const errors = []; const warnings = []; const T = (v, max, label) => { const s = String(v == null ? '' : v).trim(); if (s.length > max) errors.push(label + '은(는) ' + max + '자 이내로 입력해 주세요.'); return s; };
  const company = T(f.company, 100, '회사명'); if (!company) errors.push('회사명을 입력하세요.');
  const roleSupplier = !!f.roleSupplier, roleClient = !!f.roleClient, roleVendor = !!f.roleVendor;
  if (!roleSupplier && !roleClient && !roleVendor) warnings.push('역할이 지정되지 않았습니다. 그래도 저장할까요?\n(견적·정산 드롭다운에는 나타나지 않습니다)');
  const contacts = contactsClean(f.contacts); if (contacts.length > MAX_CONTACTS) errors.push('담당자는 ' + MAX_CONTACTS + '명까지 등록할 수 있습니다.'); contacts.forEach((t) => { if (t.name.length > 40 || t.tel.length > 20 || t.email.length > 80) errors.push('담당자 정보가 너무 깁니다.'); });
  const data = { company, ceo: T(f.ceo, 40, '대표자'), bizno: T(f.bizno, 20, '사업자번호'), address: T(f.address, 200, '주소'), contacts, roleSupplier, roleClient, roleVendor };
  const dup = (o.others || []).find((c) => c.id !== o.id && String(c.company || '').trim() === company);
  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, errors: [], warnings, id: o.id || ('co_' + (o.now || Date.now())), data, duplicate: dup ? dup.company : '' };
}
