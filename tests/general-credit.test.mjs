// 총무 > 외상 장부(자재·공구 구매, 식당 등 월말 정산 거래) 시험 — 유형 정의, 입력 검사, 잔액 계산, 화면, 메뉴·규칙 연결
import fs from 'node:fs';
import { GTYPES, GKEYS, formToDoc, newDefaults, creditBalance, creditRowsBalance, creditLast, creditTotals, homeSummary, dueList, creditFilterRows, creditSummary, creditCorpTotals, creditCsv, creditFltDefault, CREDIT_NO_CORP, won } from '../app/modules/general/logic.js';
import { listHtml, tableHtml, editHtml, homeHtml, creditLogAreaHtml, creditLogHtml, creditCorpHtml, creditShownIdx, visibleList } from '../app/modules/general/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const T = GTYPES.credit;
ok(GKEYS.includes('credit') && T.coll === 'general_credits' && T.title === '외상 장부' && T.fields[1].o.join() === '구매(자재·공구),식당,복지,기타' && T.log.k === 'entries' && T.dues({}).length === 0, '외상 장부: 컬렉션 general_credits, 구분은 구매(자재·공구)·식당·복지·기타, 거래 내역(entries), 만기 알림 없음');
const good = formToDoc('credit', { name: ' ○○식당 ', kind: '식당', contact: '010-1234-5678', cycle: '월말', status: '거래 중' }, [{ date: '2026-10-05', type: '외상', item: '점심 20인', amount: '330,000', pjt: 'P4 Ph2', memo: '' }, { date: '2026-10-31', type: '결제', item: '10월분 일부', amount: '200000' }]);
ok(good.errors.length === 0 && good.doc.name === '○○식당' && good.doc.kind === '식당' && good.doc.entries.length === 2 && good.doc.entries[0].amount === 330000 && good.doc.entries[1].type === '결제', '외상 장부 저장 변환: 이름 공백 정리, 금액의 쉼표 제거, 거래 줄 2개 보존');
const bad = formToDoc('credit', { name: '', kind: '없는구분' }, [{ date: '2026-02-30', type: '환불', amount: '-5' }]);
ok(bad.doc === null && bad.errors.some((e) => /거래처/.test(e)) && bad.errors.some((e) => /구분 값/.test(e)) && bad.errors.some((e) => /일자 형식/.test(e)), '외상 장부 입력 검사: 거래처 필수, 구분·거래 종류는 목록 값만, 날짜 형식, 금액은 0 이상');
const rows = [{ type: '외상', amount: 330000 }, { type: '외상', amount: '120,000' }, { type: '결제', amount: 200000 }];
ok(creditRowsBalance(rows.concat([{ type: '반품', amount: '30,000' }])) === 220000 && creditRowsBalance(rows) === 250000 && creditBalance({ entries: rows }) === 250000 && creditBalance({}) === 0 && creditRowsBalance([{ type: '결제', amount: 5000 }]) === -5000 && creditRowsBalance([{ type: '기타', amount: 9 }, null, { type: '외상' }]) === 0, '잔액 = 외상 합계 − 결제 합계 − 반품 합계(문자열 금액 허용, 선결제는 음수, 이상한 줄은 무시)');
ok(creditLast({ entries: [{ date: '2026-10-05' }, { date: '2026-11-02' }, { date: '' }] }) === '2026-11-02' && creditLast({}) === '', '마지막 거래일: 가장 늦은 일자, 없으면 빈 값');
const list = [{ id: 'a', name: '식당', kind: '식당', status: '거래 중', entries: [{ type: '외상', amount: 100000 }] }, { id: 'b', name: '철물', kind: '구매(자재·공구)', status: '거래 중', entries: [{ type: '외상', amount: 70000 }, { type: '결제', amount: 20000 }] }, { id: 'c', name: '종료된 곳', kind: '복지', status: '종료', entries: [{ type: '외상', amount: 999 }] }, { id: 'd', name: '정산 끝', kind: '기타', status: '거래 중', entries: [{ type: '외상', amount: 5 }, { type: '결제', amount: 5 }] }];
const tot = creditTotals(list);
ok(tot.balance === 150000 && tot.open === 2 && tot.byKind['식당'] === 100000 && tot.byKind['구매(자재·공구)'] === 50000 && tot.byKind['복지'] === 0, '합계: 거래 중인 거래처만, 구분별 미결제 잔액과 미결제 거래처 수');
const hs = homeSummary({ credit: list });
ok(hs.creditN === 3 && hs.creditBalance === 150000, '개요 숫자: 거래 중 거래처 수와 미결제 잔액(종료된 곳 제외)');
ok(dueList({ credit: list }, '2026-10-30', 90).length === 0, '개요의 만기·갱신 목록에 외상 장부는 섞이지 않음');
const st = { data: { credit: list }, today: '2026-10-30', q: '', onlyActive: true, seed: {}, edit: null, base: '#/hr/general' };
const th = tableHtml(st, 'credit'), lh = listHtml(st, 'credit');
ok(th.includes('미결제 100,000원') && th.includes('미결제 50,000원') && th.includes('정산 완료') && !th.includes('종료된 곳') && /미결제 합계 150,000원/.test(lh) && /미결제 거래처 2곳/.test(lh) && lh.includes('거래처 추가'), '목록 화면: 거래처별 미결제 배지·정산 완료 표시, 종료된 곳은 숨김, 상단에 합계와 안내, 거래처 추가 단추');
const eh = editHtml({ data: {}, today: '2026-10-30', edit: { type: 'credit', id: '', isNew: true, vals: newDefaults('credit'), rows: [{ date: '2026-10-05', type: '외상', item: 'x', amount: '330000', pjt: '', memo: '' }, { date: '2026-10-31', type: '결제', item: 'y', amount: '100000', pjt: '', memo: '' }] } });
ok(/현재 미결제 잔액 230,000원/.test(eh) && eh.includes('거래 내역') && eh.includes('data-g-logadd'), '편집 화면: 거래 줄을 고치는 즉시 현재 미결제 잔액을 보여 주고 줄 추가 단추가 있음');
const hh = homeHtml({ data: { lease: [], vehicle: [], asset: [], credit: list, renewal: [] }, today: '2026-10-30', base: '#/hr/general' });
ok(hh.includes('외상 장부') && hh.includes('미결제 잔액 150,000원') && /#\/hr\/general\/credit/.test(hh), '개요 화면: "외상 장부" 카드와 미결제 잔액, 외상 장부 탭으로 가는 링크');
const nav = fs.readFileSync(new URL('../app/modules/legacy/list.js', import.meta.url), 'utf8'), idx = fs.readFileSync(new URL('../app/modules/general/index.js', import.meta.url), 'utf8');
ok(/\['asset', '자산·장비'\], \['credit', '외상 장부'\], \['renewal', '갱신 일정'\]/.test(nav) && /GKEYS\.includes\(want\)/.test(idx), '메뉴: 인사총무 > 총무에 "외상 장부" 항목이 자산·장비 다음에 걸림, 화면은 GKEYS 기준으로 열림');
const good2 = formToDoc('credit', { name: '넘버원', kind: '구매(자재·공구)', status: '거래 중' }, [{ date: '2026-08-01', type: '외상', corp: '제이에이치테크', item: '안전화 280', amount: '58,000', pay: '', pjt: '', memo: '' }, { date: '2026-08-05', type: '반품', corp: '제이에이치테크', item: '안전화 280 반품', amount: '58000' }, { date: '2026-08-19', type: '결제', corp: '제이에이치테크', item: '8월분', amount: '0', pay: '계좌이체' }]);
ok(good2.errors.length === 0 && good2.doc.entries[0].corp === '제이에이치테크' && good2.doc.entries[1].type === '반품' && good2.doc.entries[2].pay === '계좌이체' && creditBalance(good2.doc) === 0, '새 열: 청구 법인·결제 수단·반품 종류가 저장되고, 외상 58,000 − 반품 58,000 이면 잔액 0');
const bad2 = formToDoc('credit', { name: 'x' }, [{ date: '2026-08-01', type: '외상', corp: '없는법인', amount: '1' }, { date: '2026-08-02', type: '결제', pay: '수표', amount: '1' }]);
ok(bad2.doc === null && bad2.errors.filter((e) => /청구 법인|결제 수단/.test(e)).length === 2, '청구 법인·결제 수단은 목록 값만 허용');
const rowsBig = Array.from({ length: 330 }, (_, i) => ({ date: '2026-08-01', type: '외상', amount: '1000' }));
ok(formToDoc('credit', { name: 'x' }, rowsBig).doc.entries.length === 330 && creditBalance({ entries: rowsBig }) === 330000, '거래 줄 330개(한 거래처 2년치 규모)도 저장되고 잔액이 맞음');

{
/* ── D-5: 거래 내역 검색·구분·청구 법인·월 거름, 요약, 목록 종류 거름·법인별 합계, CSV ── */
const mkRows = (n) => { const corps = ['제이에이치테크', '다람이엔지', '제이에이치엔지니어링', '']; const out = []; for (let i = 0; i < n; i++) out.push({ date: '2026-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0'), type: i % 10 === 9 ? '결제' : i % 17 === 5 ? '반품' : '외상', corp: corps[i % 4], item: i % 7 === 0 ? '안전화 ' + i : '장갑 ' + i, amount: String(1000 * (i + 1)), pay: i % 10 === 9 ? '계좌이체' : '', pjt: i % 5 === 0 ? 'P4 Ph2' : '', memo: i % 11 === 0 ? '급건' : '' }); return out; };
const R = mkRows(230);
const brute = (f) => R.map((r, i) => [r, i]).filter(([r]) => (!f.type || r.type === f.type) && (f.corp === CREDIT_NO_CORP ? !r.corp : (!f.corp || r.corp === f.corp)) && (!f.ym || r.date.slice(0, 7) === f.ym) && (!f.q || [r.date, r.type, r.corp, r.item, r.pay, r.pjt, r.memo].some((x) => String(x).toLowerCase().includes(f.q.toLowerCase())))).map(([, i]) => i);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ok(same(creditFilterRows(R, {}), R.map((_, i) => i)), '거름 조건이 없으면 모든 줄의 원래 번호(0~229)');
[{ q: '안전화' }, { q: '급건' }, { q: 'p4 ph2' }, { type: '결제' }, { type: '반품' }, { corp: '다람이엔지' }, { corp: CREDIT_NO_CORP }, { ym: '2026-03' }, { type: '외상', corp: '제이에이치테크', ym: '2026-05' }, { q: '안전화', type: '외상', corp: CREDIT_NO_CORP }, { q: '없는말' }].forEach((f) => ok(same(creditFilterRows(R, f), brute(f)), '거름 ' + JSON.stringify(f) + ' → ' + brute(f).length + '줄, 별도 계산과 같음'));
ok(creditFilterRows([null, { type: '외상', item: 'a' }, undefined], { q: 'a' }).join() === '1', '빈 줄(null)은 건너뛰고 원래 번호는 유지');
ok(creditFilterRows(R, { q: '  안전화  ' }).length === brute({ q: '안전화' }).length && creditFilterRows(R, { q: '안전화' }).length === creditFilterRows(R, { q: '안전화'.toUpperCase() }).length, '검색어 앞뒤 공백 무시·대소문자 무시');
const S = creditSummary(R);
ok(S.total.balance === creditRowsBalance(R) && S.total.count === 230, '요약 합계 잔액 = 기존 잔액 계산(creditRowsBalance)과 같음');
ok(S.byCorp.reduce((n, c) => n + c.balance, 0) === S.total.balance && S.byCorp.reduce((n, c) => n + c.count, 0) === 230, '청구 법인별 잔액·줄 수의 합이 전체와 같음(미지정 포함)');
ok(S.byCorp.some((c) => c.corp === CREDIT_NO_CORP) && S.byMonth[S.byMonth.length - 1].cum === S.total.balance && S.byMonth.length === 12, '월별 요약은 12개월, 마지막 달 누적 잔액이 전체 잔액과 같음');
ok(creditSummary(R.concat([{ type: '기타', amount: '999999', date: '2026-01-01' }, null])).total.balance === S.total.balance, '구분이 외상·결제·반품이 아닌 줄과 빈 줄은 요약에서 제외(잔액 계산과 같은 규칙)');
const noDate = creditSummary([{ type: '외상', amount: '100', date: '2026-02-03' }, { type: '외상', amount: '50', date: '' }, { type: '결제', amount: '30', date: '2026-01-05' }]);
ok(noDate.byMonth.map((m) => m.ym).join() === '2026-01,2026-02,(일자 없음)' && noDate.byMonth[2].cum === 120, '일자가 없는 줄은 월별 요약 맨 끝(누적에 포함)');
ok(S.byCorp.every((c, i, a) => i === 0 || a[i - 1].balance >= c.balance), '청구 법인별 요약은 잔액이 큰 순서');
const docs = [{ id: 'a', name: '가게A', kind: '구매(자재·공구)', status: '거래 중', entries: mkRows(40) }, { id: 'b', name: '식당B', kind: '식당', status: '거래 중', entries: mkRows(25).map((r) => Object.assign({}, r, { item: '식대 ' + r.item })) }, { id: 'c', name: '옛거래처C', kind: '구매(자재·공구)', status: '종료', entries: mkRows(10) }];
ok(creditCorpTotals(docs).total.balance === docs.reduce((n, d) => n + creditBalance(d), 0), '거래처 목록 전체의 청구 법인별 합계 = 거래처별 잔액의 합');
// 화면: 목록
const st = { data: { credit: docs }, onlyActive: true, q: '', kind: '', today: '2026-10-31', seed: {} };
ok(visibleList(st, 'credit').length === 2 && visibleList(Object.assign({}, st, { onlyActive: false }), 'credit').length === 3, '목록: "거래 중만 보기"를 풀면 종료 거래처까지 3곳');
ok(visibleList(Object.assign({}, st, { onlyActive: false, kind: '식당' }), 'credit').map((d) => d.id).join() === 'b', '목록: 종류 "식당"만 거름');
const lh = listHtml(st, 'credit');
ok(lh.includes('data-g-kind') && lh.includes('종류 전체') && lh.includes('id="g-corp"') && lh.includes('청구 법인별 합계') && lh.includes('제이에이치테크') && lh.includes('(미지정)'), '목록 화면: 종류 선택 칸·청구 법인별 합계 표(미지정 포함)가 있음');
ok(!listHtml(st, 'lease').includes('data-g-kind') && !listHtml(st, 'lease').includes('청구 법인별'), '임대 등 다른 목록 화면에는 종류 선택·법인별 합계가 없음');
const stq = Object.assign({}, st, { q: '안전화' }); const nq = creditFilterRows(docs[0].entries, { q: '안전화' }).length;
ok(tableHtml(stq, 'credit').includes('내역 ' + nq + '줄 일치') && nq > 0, '목록 검색: 거래 내역에서 일치한 줄 수를 거래처 옆에 표시');
ok(!tableHtml(st, 'credit').includes('줄 일치'), '검색어가 없으면 일치 줄 표시 없음');
// 화면: 거래 내역(편집)
const e = { type: 'credit', id: 'a', isNew: false, fresh: false, vals: { name: '가게A', kind: '구매(자재·공구)' }, rows: R.map((r) => Object.assign({}, r)), flt: creditFltDefault() };
const area0 = creditLogAreaHtml(e); const idxAttr = (h) => (h.match(/data-gl="(\d+):date"/g) || []).map((x) => Number(x.match(/(\d+):/)[1]));
ok(idxAttr(area0).length === 230 && area0.includes('전체 230줄') && area0.includes('현재 미결제 잔액 ' + won(creditRowsBalance(R)) + '원') && area0.includes('월별·청구 법인별 요약'), '거름 없음: 230줄 모두 표시, 전체 잔액과 월별·법인별 요약 표시');
e.flt = { q: '', type: '결제', corp: '', ym: '', desc: false }; const area1 = creditLogAreaHtml(e);
ok(same(idxAttr(area1), brute({ type: '결제' })) && area1.includes(brute({ type: '결제' }).length + '줄 표시') && area1.includes('전체 230줄'), '구분 "결제" 거름: 표시되는 줄의 번호가 **원래 번호**(저장이 틀어지지 않음), "N줄 표시 (전체 230줄)" 안내');
e.flt = { q: '안전화', type: '', corp: '다람이엔지', ym: '', desc: true }; const idx2 = creditShownIdx(e);
ok(same(idx2.slice().sort((a, b) => a - b), brute({ q: '안전화', corp: '다람이엔지' })) && idx2.every((v, i, a) => i === 0 || R[a[i - 1]].date >= R[v].date), '검색+법인 거름에 "최근 거래 먼저": 같은 줄이 날짜 내림차순으로 나옴');
e.flt = { q: '없는말', type: '', corp: '', ym: '', desc: false }; const area3 = creditLogAreaHtml(e);
ok(idxAttr(area3).length === 0 && area3.includes('조건에 맞는 줄이 없습니다.') && area3.includes('0줄 표시'), '조건에 맞는 줄이 없으면 안내 문구');
e.flt = creditFltDefault(); const full = creditLogHtml(e);
ok(['data-glf="q"', 'data-glf="type"', 'data-glf="corp"', 'data-glf="ym"', 'data-glf="desc"', 'data-g-credit-csv', 'data-g-logadd', 'id="g-logwrap"', '최근 거래 먼저', '청구 법인 미지정'].every((x) => full.includes(x)) && (full.match(/<option value="2026-\d\d"/g) || []).length === 12, '거래 내역 구역: 검색·구분·법인·월·정렬·CSV·줄 추가가 모두 있고 월 선택은 12개월');
ok(editHtml({ edit: e, data: { credit: docs }, today: '2026-10-31' }).includes('data-glf="q"') && !editHtml({ edit: { type: 'lease', id: '', isNew: true, vals: {}, rows: [] }, data: {}, today: '2026-10-31' }).includes('data-glf'), '편집 화면: 외상 장부에만 거름 막대가 붙고 임대 등은 그대로');
// CSV
const csv = creditCsv(R.slice(0, 3).concat([{ date: '2026-02-02', type: '외상', corp: '다람이엔지', item: '=HYPERLINK("x")', amount: '1,000', pay: '', pjt: '', memo: '' }]), '외상 장부 — 시험');
ok(csv.startsWith('\uFEFF') && csv.includes('"일자","구분","청구 법인"') && !/(^|,)"=HYPERLINK/m.test(csv) && csv.includes("순액(외상 − 결제 − 반품)"), 'CSV: 엑셀용 BOM·머리글·합계 줄, 수식으로 시작하는 내용은 글자로 바뀜(수식 주입 방어)');
}
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
