import fs from 'fs';
import { estDocHtml } from '../app/modules/plan/estimate-doc.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// 구포털 기획의 견적서 인쇄 함수 원본(fixtures)을 그대로 실행해 새 양식과 글자 하나까지 같은지 대조한다
const src = fs.readFileSync(new URL('./fixtures/gihoek_print_est.js.txt', import.meta.url), 'utf8');
function legacyHtml(e, p) {
  let html = ''; const win = { document: { write: (s) => { html += s; }, close() {} } }; const window = { open: () => win };
  const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR'); const itemAmt = (it) => (it.amount != null ? it.amount : (it.qty || 0) * (it.price || 0)); const estSupply = (x) => (x.items || []).reduce((s, i) => s + itemAmt(i), 0);
  const fn = new Function('window', 'estimates', 'projects', 'won', 'itemAmt', 'estSupply', 'toast', src + '\nreturn window.printEst;');
  fn(window, [e], p ? [p] : [], won, itemAmt, estSupply, () => {})(e.id); return html;
}
const P = { id: 'p1', code: 'P4 Ph2 (FAB동) FCU' };
const party = (n, extra) => Object.assign({ company: n, ceo: '홍길동', bizno: '123-45-67890', tel: '010-1111-2222', email: 'a@b.kr', address: '대전 유성구', contact: '', contactTel: '', contactEmail: '' }, extra || {});
const cases = {
  '기본(개정 없음·특기사항 없음·담당자 없음)': { id: 'e1', no: 'EST-2026-001', rev: 1, date: '2026-05-10', title: 'FCU 183대 설치 견적', pjtId: 'p1', items: [{ name: 'FCU', spec: 'CF-1000', qty: 183, price: 100000, amount: 18300000, remark: '' }, { name: '배관', spec: '', qty: 1, price: 500000, remark: '자재 포함' }], client: party('다람이엔지'), issuer: party('제이에이치이엔지', { tel: '', email: '' }), notes: '' },
  '개정본·특기사항·담당자 있음': { id: 'e2', no: 'EST-2026-001-r3', rev: 3, date: '2026-06-01', title: '개정 견적', pjtId: 'p1', items: [{ name: 'AHU', spec: '2EA', qty: 2, price: 3500000, amount: 7000000, remark: '' }], client: party('귀뚜라미범양냉방', { contact: '김담당', contactTel: '010-9999-8888', tel: '' }), issuer: party('제이에이치솔루션', { contact: '박대리', contactTel: '010-1234-5678', contactEmail: 'p@jhsol.kr' }), notes: '납기: 계약 후 2주\n설치 조건: 별도 협의' },
  '프로젝트 없음·거래처 정보 없음·품목 금액 0': { id: 'e3', no: 'EST-2026-009', date: '2026-07-01', title: '최소 견적', pjtId: 'zz', items: [{ name: 'x', qty: 0, price: 0 }], client: null, issuer: null },
  '큰 금액·소수 수량·한글 비고': { id: 'e4', no: 'EST-2026-010-r9', rev: 9, date: '2026-10-01', title: 'EHU 13대 설치', pjtId: 'p1', items: [{ name: 'EHU', spec: '대형', qty: 13.5, price: 1234567, remark: '현장 설치' }, { name: '시운전', spec: '', qty: 1, price: 2000000, amount: 2000000, remark: '' }], client: party('다람이엔지', { tel: '' }), issuer: party('제이에이치솔루션'), notes: '비고' }
};
for (const [name, e] of Object.entries(cases)) { const p = e.pjtId === 'p1' ? P : null; const a = legacyHtml(e, p), b = estDocHtml(e, p); ok(a === b, '★ 견적서 양식이 구포털 원본과 글자 하나까지 같음 — ' + name + (a === b ? '' : '\n   원본 ' + a.length + '자 / 새 양식 ' + b.length + '자, 첫 차이 위치 ' + [...a].findIndex((c, i) => c !== b[i]))); }
const evil = { id: 'e5', no: 'EST-2026-011', date: '2026-10-02', title: '<b>제목</b> & 견적', items: [{ name: '<script>alert(1)</script>', spec: 'a&b', qty: 1, price: 100, remark: '<i>x</i>' }], client: party('<img src=x onerror=alert(1)>'), issuer: party('솔루션'), notes: '<u>특기</u>' };
const html = estDocHtml(evil, P);
ok(!/<script>alert|<img src=x|<b>제목|<i>x<|<u>특기/.test(html) && html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && html.includes('a&amp;b') && html.includes('&lt;img src=x onerror=alert(1)&gt;') && html.includes('window.onload=function(){setTimeout(function(){window.print();},250);}'), '입력값의 꺾쇠·& 는 글자로 처리되어 서식이 깨지거나 스크립트가 실행되지 않음(원본은 특기사항만 처리했음), 자동 인쇄 스크립트는 유지');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
