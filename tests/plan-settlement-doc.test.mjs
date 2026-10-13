import fs from 'fs';
import { settleDocHtml, settleDocPage, SET_DOC_CSS } from '../app/modules/plan/settlement-doc.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// 구포털 기획의 정산서 양식 원본(fixtures)을 그대로 실행해 새 양식과 글자 하나까지 같은지 대조한다
const src = fs.readFileSync(new URL('./fixtures/gihoek_settle_doc.js.txt', import.meta.url), 'utf8');
function legacy(s, projects) {
  let html = ''; const win = { document: { write: (x) => { html += x; }, close() {} } }; const window = { open: () => win };
  const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR'); const $ = (id) => ({ dataset: { sid: s.id }, style: {}, innerHTML: '' }); const settlements = [s];
  const fn = new Function('window', 'settlements', 'projects', 'won', '$', 'toast', 'document', src + '\nreturn { settleDocHTML, pvPrint: window.pvPrint };');
  const api = fn(window, settlements, projects, won, $, () => {}, { body: { style: {} } }); const body = api.settleDocHTML(s); api.pvPrint(); return { body, page: html };
}
const PR = [{ id: 'p1', code: 'P4 Ph2 (FAB동) FCU' }, { id: 'p2', code: 'H17L Gas RM. 전환공사' }];
const party = (n, extra) => Object.assign({ company: n, ceo: '홍길동', bizno: '123-45-67890', tel: '010-1111-2222', email: 'a@b.kr', address: '대전', contact: '', contactTel: '', contactEmail: '' }, extra || {});
const cases = {
  '특이사항·마이너스 줄 있음(줄바꿈·특수문자 포함)': { id: 's5', docType: 'invoice', no: '2610003', issueDate: '2026-10-13', baseMonth: '2026-10', payDate: '2026-11-10', pjtId: 'p1', notes: '협의 단가 적용\n네고 -500,000 & 지급 익월 말 <확인>', lines: [{ name: '설치 공사', spec: '', amount: 3000000 }, { name: '네고 할인', spec: '협의', amount: -500000 }], supply: 2500000, vat: 250000, total: 2750000, sender: { company: '제이에이치솔루션', ceo: '홍', bizno: '1' }, recipient: { company: '원청건설', ceo: '김' } },
  '대금청구서(담당자 없음, 라인 1개)': { id: 's1', docType: 'invoice', no: '2609001', issueDate: '2026-09-30', baseMonth: '2026-09', payDate: '2026-10-31', pjtId: 'p1', lines: [{ name: 'FCU 설치 1차', spec: '진척 40%', amount: 8000000 }], supply: 8000000, vat: 800000, total: 8800000, sender: party('제이에이치이엔지', { tel: '' }), recipient: party('다람이엔지') },
  '지급예정서(담당자·이메일 있음, 공동 발행)': { id: 's2', docType: 'payment', no: '2609002', issueDate: '2026-09-30', baseMonth: '2026-09', payDate: '', pjtId: 'p1', pjtIds: ['p1', 'p2'], lines: [{ name: '공수 정산', spec: '', amount: 40964000 }, { name: '기타', spec: '식대', amount: 470000 }], supply: 41434000, vat: 4143400, total: 45577400, sender: party('제이에이치솔루션', { contact: '박대리', contactTel: '010-1234-5678', contactEmail: 'p@jhsol.kr' }), recipient: party('에스제이', { contact: '최과장', contactTel: '010-9999-8888', tel: '' }) },
  '프로젝트·거래처 정보 없음': { id: 's3', docType: 'invoice', no: '2610001', issueDate: '2026-10-05', baseMonth: '2026-10', pjtId: 'zz', lines: [], supply: 0, vat: 0, total: 0, sender: null, recipient: null },
  '삭제된 프로젝트가 섞인 공동 발행·큰 금액': { id: 's4', docType: 'invoice', no: '2610002', issueDate: '2026-10-10', baseMonth: '2026-10', payDate: '2026-11-10', pjtId: 'p1', pjtIds: ['p1', 'gone'], lines: [{ name: '수량정산', spec: '183대', amount: 109800000 }], supply: 109800000, vat: 10980000, total: 120780000, sender: party('제이에이치이엔지'), recipient: party('귀뚜라미범양냉방', { tel: '' }) }
};
for (const [name, s] of Object.entries(cases)) { const L = legacy(s, PR); const a = settleDocHtml(s, PR), b = settleDocPage(s, PR);
  ok(L.body === a && L.page === b, '★ 정산서 양식이 구포털 원본과 글자 하나까지 같음(본문·인쇄 페이지) — ' + name + (L.body === a && L.page === b ? '' : '\n   본문 ' + L.body.length + '/' + a.length + '자, 페이지 ' + L.page.length + '/' + b.length + '자, 첫 차이 ' + [...L.body].findIndex((c, i) => c !== a[i]))); }
const evil = { id: 'e', docType: 'payment', no: '<b>1</b>', issueDate: '2026-10-02', baseMonth: '2026-10', pjtId: 'p1', lines: [{ name: '<script>alert(1)</script>', spec: 'a&b', amount: 100 }], supply: 100, vat: 10, total: 110, sender: party('<img src=x onerror=alert(1)>'), recipient: party('수신') };
const html = settleDocPage(evil, PR);
ok(!/<script>alert|<img src=x|<b>1<\/b>/.test(html) && html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && html.includes('a&amp;b') && html.includes('window.onload=function(){setTimeout(function(){window.print();},250);}') && SET_DOC_CSS.includes('.pcard') && html.includes('@page{size:A4;margin:16mm}'), '입력값의 꺾쇠·& 는 글자로 처리되어 서식이 깨지거나 스크립트가 실행되지 않음, 자동 인쇄·A4 여백·양식 CSS 유지');
const withNotes = settleDocHtml(cases['특이사항·마이너스 줄 있음(줄바꿈·특수문자 포함)'], PR);
ok(withNotes.includes('특이사항') && withNotes.includes('협의 단가 적용\n네고 -500,000 &amp; 지급 익월 말 &lt;확인&gt;') && withNotes.includes('-500,000'), '특이사항 박스·마이너스 금액이 인쇄 문서에 표시되고 특수문자는 이스케이프');
ok(!settleDocHtml(cases['대금청구서(담당자 없음, 라인 1개)'], PR).includes('특이사항'), '특이사항이 없으면 박스를 그리지 않음');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
