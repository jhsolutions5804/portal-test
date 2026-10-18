import { estDocHtml, estDocTitle } from '../app/modules/plan/estimate-doc.js';
import { settleDocPage, settleDocTitle } from '../app/modules/plan/settlement-doc.js';
import { contractDocPage } from '../app/modules/plan/contract-doc.js';
import { closingPrintHtml } from '../app/modules/plan/closing-view.js';
import { newContract } from '../app/modules/plan/contracts.js';
import { docFileName } from '../app/shared/doc-filename.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const titleOf = (html) => { const m = html.match(/<title>([\s\S]*?)<\/title>/); return m ? m[1] : null; };
const party = (n, extra) => Object.assign({ company: n, ceo: '홍길동', bizno: '123-45-67890', tel: '010-1111-2222', email: 'a@b.kr', address: '대전', contact: '', contactTel: '', contactEmail: '' }, extra || {});
const PR = [{ id: 'p1', code: 'P4 Ph2 (FAB동) FCU' }, { id: 'p2', code: 'H17L Gas RM. 전환공사' }];

// ── 견적서: 제목 인자가 없으면 기존과 글자 하나까지 같음(구포털 원본 대조 시험이 지키는 부분), 있으면 제목만 바뀜
const E = { id: 'e1', no: 'EST-2026-001', rev: 1, date: '2026-05-10', title: 'FCU 183대 설치 견적', pjtId: 'p1', items: [{ name: 'FCU', spec: 'CF-1000', qty: 183, price: 100000, amount: 18300000, remark: '' }], client: party('다람이엔지'), issuer: party('제이에이치솔루션') };
const plain = estDocHtml(E, PR[0]), tt = estDocTitle(E, PR[0]), withT = estDocHtml(E, PR[0], { title: tt });
ok(titleOf(plain) === '견적서 EST-2026-001', '견적서: 제목 인자가 없으면 기존 제목 그대로("견적서 번호")');
ok(titleOf(withT) === '견적서_20260510_다람이엔지_P4 Ph2 (FAB동) FCU_FCU 183대 설치 견적', '★ 견적서: 종류_날짜_거래처_현장명_견적명 (' + titleOf(withT) + ')');
const ttC = estDocTitle(Object.assign({}, E, { client: party('다람이엔지', { contact: '김과장' }) }), PR[0]); ok(ttC === '견적서_20260510_다람이엔지(김과장)_P4 Ph2 (FAB동) FCU_FCU 183대 설치 견적' && titleOf(estDocHtml(E, PR[0], { title: ttC })) === ttC, '견적서: 거래처 담당자가 있으면 거래처(담당자)');
ok(plain.replace(/<title>[\s\S]*?<\/title>/, '') === withT.replace(/<title>[\s\S]*?<\/title>/, ''), '견적서: 제목 말고는 본문이 한 글자도 달라지지 않음');
ok(titleOf(estDocHtml(E, PR[0], { title: '<b>x</b> & y' })) === '&lt;b&gt;x&lt;/b&gt; &amp; y', '견적서: 제목에 들어온 HTML 글자는 이스케이프');
ok(estDocTitle(Object.assign({}, E, { rev: 2 }), PR[0]) === '견적서_20260510_다람이엔지_P4 Ph2 (FAB동) FCU_FCU 183대 설치 견적_r2' && estDocTitle(Object.assign({}, E, { rev: 1 }), PR[0]) === estDocTitle(E, PR[0]), '★ 견적서 개정본은 끝에 _r2 — 화면 호출부가 rev 를 실제로 넘김(rev 1 은 그대로)');
ok(estDocTitle(E, null) === '견적서_20260510_다람이엔지_FCU 183대 설치 견적', '견적서: 프로젝트가 없으면 그 칸만 건너뜀');
ok(estDocTitle(Object.assign({}, E, { client: null, title: '', date: '' }), null) === '견적서' && !/undefined|null/.test(estDocTitle({}, undefined)), '견적서: 거래처·견적명·날짜·프로젝트가 모두 없어도 오류 없이 종류만');
ok(!/010|1111|2222/.test(estDocTitle(Object.assign({}, E, { client: party('다람이엔지', { contact: '김과장 010-1111-2222' }) }), PR[0])), '견적서: 담당자 칸의 전화번호는 파일 이름에 남지 않음');

// ── 정산서(대금청구서·지급예정서): 화면 호출부와 같이 settleDocTitle 결과를 opts.title 로 넘김. 안 넘기면 기존 제목 그대로(구포털 원본 대조 시험이 지키는 부분)
const S1 = { id: 's1', docType: 'invoice', no: '2609001', issueDate: '2026-09-30', baseMonth: '2026-09', payDate: '2026-10-31', pjtId: 'p1', lines: [{ name: 'FCU 설치 1차', spec: '', amount: 8000000 }], supply: 8000000, vat: 800000, total: 8800000, sender: party('제이에이치이엔지'), recipient: party('다람이엔지') };
const S2 = { id: 's2', docType: 'payment', no: '2609002', issueDate: '2026-09-30', baseMonth: '2026-09', payDate: '', pjtId: 'p1', pjtIds: ['p1', 'p2'], lines: [{ name: '공수 정산', spec: '', amount: 40964000 }], supply: 40964000, vat: 4096400, total: 45060400, sender: party('제이에이치솔루션'), recipient: party('에스제이') };
const S3 = { id: 's3', docType: 'invoice', no: '2610001', issueDate: '2026-10-05', baseMonth: '2026-10', pjtId: 'zz', lines: [], supply: 0, vat: 0, total: 0, sender: null, recipient: null };
const pg = (s, pr) => settleDocPage(s, pr, { title: settleDocTitle(s, pr) });
ok(titleOf(settleDocPage(S1, PR)) === '대금청구서 2609001' && titleOf(settleDocPage(S2, PR)) === '지급예정서 2609002', '정산서: 제목 인자가 없으면 기존 제목 그대로("대금청구서 번호"·"지급예정서 번호")');
ok(titleOf(pg(S1, PR)) === '대금청구서_20260930_다람이엔지_P4 Ph2 (FAB동) FCU', '★ 대금청구서: 종류_발행일_상대방_현장명(견적명 칸은 없음) (' + titleOf(pg(S1, PR)) + ')');
ok(titleOf(pg(Object.assign({}, S1, { recipient: party('다람이엔지', { contact: '이대리' }) }), PR)) === '대금청구서_20260930_다람이엔지(이대리)_P4 Ph2 (FAB동) FCU', '★ 정산서: 받는 곳 담당자가 있으면 거래처(담당자) — 화면 호출부가 담당자를 실제로 넘김');
ok(titleOf(pg(S2, PR)) === '지급예정서_20260930_에스제이_P4 Ph2 (FAB동) FCU + H17L Gas RM. 전환공사', '지급예정서: 공동 발행이면 프로젝트를 + 로 연결');
ok(titleOf(pg(S3, PR)) === '대금청구서_20261005', '정산서: 프로젝트·상대방 정보가 없으면 그 칸만 건너뜀');
ok(settleDocTitle(S1, undefined) === '대금청구서_20260930_다람이엔지', '정산서: 프로젝트 목록이 없어도 오류 없음');
ok(settleDocPage(S1, PR).replace(/<title>[\s\S]*?<\/title>/, '') === pg(S1, PR).replace(/<title>[\s\S]*?<\/title>/, ''), '정산서: 제목 말고는 인쇄 페이지가 한 글자도 달라지지 않음');
ok(!/010|1234|45-6789/.test(titleOf(pg(Object.assign({}, S1, { recipient: party('다람 010-1111-2222') }), PR))), '정산서: 상대방 칸에 전화번호가 들어와도 파일 이름에는 남지 않음');

// ── 계약서
const ISS = { id: 'jhsol', company: '제이에이치솔루션', ceo: '김짜장', bizno: '123-45-67890', address: '평택시', tel: '031-000' }, PAR = { id: 'sj', company: '에스제이', ceo: '박', bizno: '111-22-33333', address: '화성시' };
const K = Object.assign(newContract({ issuer: ISS, partner: PAR, pjtId: 'p1', today: '2026-10-13', now: 1790000000000 }), { scope: 'FCU 설치 공사', site: '평택 P4 Ph2', startDate: '2026-11-01', endDate: '2026-11-30', supply: 50000000, no: '2610001', issuedDate: '2026-10-14' });
ok(titleOf(contractDocPage(K, { projectName: 'P4 Ph2' })) === '하도급 계약서_20261014_에스제이_P4 Ph2', '★ 계약서: 종류_발급일_협력사_현장명 — 제목(기본값 "하도급 계약")은 구분력이 없어 넣지 않음 (' + titleOf(contractDocPage(K, { projectName: 'P4 Ph2' })) + ')');
ok(titleOf(contractDocPage(Object.assign({}, K, { kind: 'change' }), { projectName: 'P4 Ph2' })).includes('하도급 변경 계약서'), '변경 계약서는 종류가 "하도급 변경 계약서"');
ok(titleOf(contractDocPage(Object.assign({}, K, { issuedDate: '' }), {})) === '하도급 계약서_20261013_에스제이', '계약서: 발급 전이면 위탁일을 날짜로, 프로젝트 이름이 없으면 그 칸만 건너뜀');
ok(titleOf(contractDocPage(Object.assign({}, K, { no: '', issuedDate: '' }), undefined)) !== null, '계약서: 옵션이 없고 번호가 비어 있어도 오류 없이 제목이 나옴');

// ── 월말 마감
const st = { ym: '2026-09', today: '2026-10-01', projects: [], estimates: [], settlements: [] };
ok(titleOf(closingPrintHtml(st)) === '월말 마감 - 2026-09', '월말 마감: 종류 → 연월 (' + titleOf(closingPrintHtml(st)) + ')');

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
