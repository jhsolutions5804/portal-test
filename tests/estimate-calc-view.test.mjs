// 견적 항목 "산식" 표 화면(HTML) 시험 — 가짜 값만 쓴다(공개 저장소). 화면 함수: app/modules/plan/estimate-calc-view.js, 항목 줄: estimates-view.js 의 itemRowHtml
import { readFileSync, readdirSync } from 'node:fs';
import { calcBoxHtml, calcSummaryHtml, tableBodyHtml, COLS } from '../app/modules/plan/estimate-calc-view.js';
import { itemRowHtml } from '../app/modules/plan/estimates-view.js';
import { calcSheet, newRow, newCalc } from '../app/modules/plan/estimate-calc.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const has = (h, s) => h.includes(s); const count = (h, re) => (h.match(re) || []).length;
const row = (o) => Object.assign(newRow(), o);
const calc = () => ({ rows: [row({ name: '구역 A', unit: '인', qty: '=2*18', price: '100', remark: '메모 A' }), row({ name: '구역 B', unit: '인', qty: '20', price: '100', total: '2500' })], markup: '10', unit: '10', count: '13' });
const res = calcSheet(calc()); const INFO = { qty: 1, amount: 0 }; const html = calcBoxHtml(2, calc(), res, INFO);

console.log('── 구조(열: 번호·내역·단위·수량·단가·합계·비고)');
ok(html.startsWith('<div') && has(html, 'data-ec-box="2"') && !has(html, 'colspan=') && !/^<tr/.test(html), '★ 항목 표 안의 <tr> 이 아니라 표 밖에 놓는 <div> 블록(data-ec-box) — 항목 표의 가로 폭에 끌려가 폰에서 잘리지 않게');
ok(COLS.map((c) => c.label).join() === '번호,내역,단위,수량,단가,합계,비고', '★ 열은 번호·내역·단위·수량·단가·합계·비고 (대표님 지정)');
ok(has(html, '품목 3 산식') && has(html, 'aria-label="품목 3 산식"'), '★ 블록 제목에 어느 품목의 계산인지(항목 번호 2 → "품목 3")가 보임 — 항목 바로 아래가 아니므로');
ok(count(html, /<th[ >]/g) >= 7 && ['번호', '내역', '단위', '수량', '단가', '합계', '비고'].every((t) => has(html, '>' + t + '<')), '표 머리글에 일곱 열의 이름이 있음');
ok(count(html, /data-ec-r="\d+"/g) >= 2 && has(html, 'data-ec-r="0"') && has(html, 'data-ec-r="1"'), '행마다 행 번호(data-ec-r)가 붙음');
ok(['name', 'unit', 'qty', 'price', 'total', 'remark'].every((k) => count(html, new RegExp('data-ec-c="' + k + '"', 'g')) === 2), '★ 행 2개 × 입력칸 6종(내역·단위·수량·단가·합계·비고)이 각각 2개씩');
ok(has(html, 'value="구역 A"') && has(html, 'value="=2*18"') && has(html, 'value="메모 A"') && has(html, 'value="2500"'), '입력한 글자가 칸에 그대로 보임(수식은 =2*18 글자 그대로)');
ok(/>1<\/td>/.test(html) && />2<\/td>/.test(html), '번호 칸은 1, 2 로 자동 표시(저장하지 않는 값)');
ok(count(html, /data-ec-del="\d+"/g) === 2 && has(html, 'aria-label="행 삭제"'), '행마다 삭제(×) 버튼');
ok(has(html, 'data-ec-add="2"') && has(html, '행 추가'), '★ "행 추가" 버튼(항목 번호가 붙음)');

console.log('── 합계 칸: 자동은 계산값, 직접 쓰면 고정');
ok(/data-ec-c="total"[^>]*data-ec-auto="true"/.test(html) || /data-ec-auto="true"[^>]*data-ec-c="total"/.test(html), '합계를 안 쓴 행은 자동(data-ec-auto=true) 표시');
ok(/data-ec-fixed="true"/.test(html) && count(html, /data-ec-fixed="true"/g) === 1, '★ 합계를 직접 쓴 행만 고정(data-ec-fixed=true) 표시 — 1개');
ok(has(html, 'placeholder="3,600"'), '자동 합계 행은 입력칸 값이 비어 있고 계산값 3,600 이 연한 글자(placeholder)로 보임');
ok(has(html, 'value="2500"') && !has(html, 'placeholder="2,500"'), '직접 쓴 합계는 값으로 보이고 연한 글자가 아님');

console.log('── 요약 영역(소계·가산율·내림 단위·총 대수·견적가·대당 금액)');
ok(has(html, 'data-ec-m="markup"') && has(html, 'data-ec-m="unit"') && has(html, 'data-ec-m="count"'), '가산율·내림 단위·총 장비 대수 입력칸');
ok(has(html, 'value="10"') && has(html, 'value="13"'), '가산율 10 · 총 대수 13 이 보임');
const sm = calcSummaryHtml(res, 2, { qty: 1, amount: 0 }); ok(has(sm, '6,100') && has(sm, '소계'), '소계 6,100 이 보임(고정한 합계 2,500 + 3,600)');
ok(has(sm, '6,710'), '견적가 6,710 이 보임(소계 6,100 × 1.1 = 6,710, 내림 단위 10)');
ok(has(sm, 'data-ec-apply="2"') && has(sm, '항목에 넣기') && !/data-ec-apply[^>]*disabled/.test(sm), '"항목에 넣기" 버튼(계산되면 눌림)');
ok(has(sm, 'data-ec-close="2"') && has(sm, '닫기'), '"닫기" 버튼');

console.log('── 오류·빈 상태');
const badCalc = calc(); badCalc.rows[1].qty = '=1/0'; const badRes = calcSheet(badCalc); const badHtml = calcBoxHtml(0, badCalc, badRes);
ok(has(badHtml, 'data-ec-err="true"') && count(badHtml, /data-ec-err="true"/g) === 1, '★ 틀린 행만 오류 표시(data-ec-err) — 1개');
ok(has(badHtml, '0 으로 나눌 수 없습니다') && has(badHtml, 'role="alert"'), '그 행에 이유 문구가 role=alert 로 보임');
const bsm = calcSummaryHtml(badRes, 0, { qty: 1, amount: 0 });
ok(has(bsm, '2번 행') && !has(bsm, '0 으로 나눌 수 없습니다'), '★ 요약은 틀린 행의 위치만 알리고(2번 행을 확인) 이유는 그 행 아래에만 — 같은 문구가 두 번 나오지 않음'); ok(/data-ec-apply="0"[^>]*disabled/.test(bsm) && has(bsm, 'role="alert"'), '★ 거부되면 "항목에 넣기"가 비활성이고 이유가 보임');
ok(!has(badHtml, 'NaN') && !has(badHtml, 'undefined') && !has(badHtml, 'null'), '거부된 화면에 NaN·undefined·null 이 보이지 않음');
const emptyHtml = calcBoxHtml(0, newCalc(), calcSheet(newCalc())); ok(count(emptyHtml, /data-ec-c="name"/g) === 1 && has(emptyHtml, 'data-ec-add') && !has(emptyHtml, 'NaN') && !has(emptyHtml, 'undefined'), '새 표(빈 행 1개)도 깨지지 않고 입력칸 6개와 행 추가가 보임');
ok(has(emptyHtml, 'value="10"') && has(emptyHtml, 'value="100000"'), '새 표는 가산율 10 · 내림 단위 100000 이 미리 채워져 있음');
const noRows = calcBoxHtml(0, { rows: [], markup: '10', unit: '10', count: '1' }, calcSheet({ rows: [], markup: '10', unit: '10', count: '1' })); ok(has(noRows, 'data-ec-add') && !has(noRows, 'NaN'), '행이 하나도 없어도 "행 추가"가 보임(다시 시작할 수 있음)');
ok(calcBoxHtml(0, null, calcSheet(null)).length > 50 && !has(calcBoxHtml(0, null, calcSheet(null)), 'undefined'), 'calc 가 null 이어도 화면이 깨지지 않음');

console.log('── 안전');
const evil = calc(); evil.rows[0].name = '"><script>alert(1)</script>'; evil.rows[0].remark = '<img src=x onerror=alert(2)>'; evil.rows[0].unit = "'><b>x</b>"; evil.markup = '"><i>'; evil.count = '</td><script>3</script>';
const evilHtml = calcBoxHtml(0, evil, calcSheet(evil));
ok(!has(evilHtml, '<script>alert') && !has(evilHtml, '<img src=x') && !has(evilHtml, '<b>x</b>') && !has(evilHtml, '<i>') && !has(evilHtml, '<script>3') && has(evilHtml, '&lt;script&gt;'), '★ 내역·비고·단위·가산율·총 대수의 HTML 은 이스케이프됨(주입 불가)');
const evilErr = calc(); evilErr.rows[0].qty = '=<script>'; ok(!has(calcBoxHtml(0, evilErr, calcSheet(evilErr)), '<script>'), '오류 문구 안의 입력 글자도 이스케이프됨');

console.log('── 결과 요약만 다시 그리기(입력 중 커서 유지용)');
const smOk = calcSummaryHtml(res, 2, { qty: 1, amount: 0 });
ok(!has(smOk, 'data-ec-c=') && !has(smOk, 'data-ec-m='), '★ 요약 영역에는 입력칸이 없음 — 입력할 때마다 이 부분만 다시 그리므로 커서가 유지됨');
ok(has(html, 'data-ec-sum="2"') && html.includes(calcSummaryHtml(res, 2, INFO)), '★ 표 안의 요약이 calcSummaryHtml 과 같은 내용(한 곳에서 만듦 — 두 벌이 어긋나지 않음)');
const body = tableBodyHtml(2, calc(), res); ok(has(body, 'data-ec-r="0"') && !has(body, 'data-ec-sum') && !has(body, 'data-ec-m='), '표 본문(행들)만 따로 그릴 수 있음(행 추가·삭제 때 사용)');

console.log('── 항목에 넣은 값과 어긋남 알림');
const diff = calcSummaryHtml(res, 2, { qty: 1, amount: 999 }); ok(has(diff, 'data-ec-stale="true"') && has(diff, '다릅니다'), '★ 항목에 들어 있는 금액이 계산 결과와 다르면 표식(data-ec-stale)과 "다릅니다" 문구로 "항목에 넣기"를 눌러야 반영된다고 알림');
const same = calcSummaryHtml(res, 2, { qty: res.count, amount: res.price }); ok(!has(same, 'data-ec-stale="true"'), '항목 값이 계산 결과와 같으면 알림이 없음');

console.log('── 항목 줄의 "산식" 버튼');
const it = { name: '구역 A', spec: '', qty: 1, price: 0, amount: 0, remark: '' };
const row0 = itemRowHtml(it, 0); ok(has(row0, 'data-ec-open="0"') && has(row0, '산식') && count(row0, /data-ec-open/g) === 1, '★ 항목 줄에 "산식" 버튼이 하나, 항목 번호가 붙음');
ok(has(row0, 'data-es-del="0"') && has(row0, 'data-es-it="0:qty"') && has(row0, 'data-es-it="0:amount"'), '기존 삭제 버튼과 수량·금액 입력은 그대로');
const rowWith = itemRowHtml(Object.assign({}, it, { calc: calc() }), 0); ok(has(rowWith, 'data-ec-has="true"'), '★ 산식 표가 저장된 항목은 버튼에 표시(data-ec-has) — 이미 쓴 내역이 있음을 알려 줌');
ok(!has(row0, 'data-ec-has'), '산식이 없는 항목에는 표시가 없음');

console.log('── 스타일 클래스');
const cssAll = readdirSync(new URL('../app/theme/', import.meta.url)).filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL('../app/theme/' + f, import.meta.url), 'utf8')).join('\n');
const used = [...new Set((html + badHtml + emptyHtml + row0 + rowWith + sm + diff).match(/class="[^"]+"/g).flatMap((c) => c.slice(7, -1).split(/\s+/)))].filter((c) => c.startsWith('jh-'));
const undef = used.filter((c) => !cssAll.includes('.' + c));
ok(used.length >= 8 && undef.length === 0, '★ 화면이 쓰는 jh- 클래스 ' + used.length + '개가 전부 스타일 파일에 정의됨(정의 안 된 이름 ' + JSON.stringify(undef) + ')');
const primary = (html.match(/<button[^>]*data-variant="primary"[^>]*>/g) || []); ok(primary.length === 1 && has(primary[0], 'data-ec-apply'), '주 버튼은 하나이고 그것이 "항목에 넣기"(나머지는 기본·보조)');
ok(pass + fail >= 42, '★ 시험 전체가 끝까지 실행됨(' + (pass + fail) + '건 ≥ 42) — 중간에 예외로 죽어 뒤쪽 시험이 안 도는 일 방지');
console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); process.exit(fail ? 1 : 0);
