// 평가 결과 통보서 인쇄(대기열 1-2-7 ②, 대표님 2026-10-22) — 인쇄용 문서 이름(resultPrintTitle)과 인쇄용 문서(resultPrintHtml)
// 관리자 화면의 미리보기는 sandbox="" iframe 이라 바깥에서 contentWindow.print() 를 부를 수 없어(교차 출처 차단) [인쇄] 버튼이 늘 "Ctrl+P 를 쓰세요" 안내만 보여 줬다 → 영업기획 문서처럼 새 창에 문서를 쓰고 인쇄한다.
// 직원에게 보내는 확인 링크가 같은 resultHtml 을 쓰므로 resultHtml(발송·미리보기)은 한 글자도 바꾸지 않고, 새 창에 쓸 때만 <title> 치환과 인쇄 스크립트를 더한다. 공개 저장소라 가짜 이름·값만 쓴다.
import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const R = await import('../app/modules/eval/result-report.js?v=' + VER); const E = await import('../app/modules/eval/evaluation.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + (a === b ? '' : ' ← 실제: "' + a + '" / 기대: "' + b + '"'));
const W = { id: 'w1', name: '도하린', dept: 'PJT팀', rank: '사원' };
const mkCycle = (o) => Object.assign(E.emptyCycle(W, 2026), { leadAgg: { areas: { achievement: 4, competency: 5, conduct: 3 }, n: 1, by: 'uL' }, peerAgg: { avg: 4, n: 3 }, ceo: { approved: true, score: null, comment: '' }, confirmed: true }, o || {});
const data = () => R.buildResultData({ year: 2026, worker: W, cycle: mkCycle(), adhoc: [] }).data;
console.log('── 문서 이름(resultPrintTitle)');
eq(R.resultPrintTitle(data()), '인사평가 결과 통보서 - 도하린 - 2026', '★ 종류 - 이름 - 평가 연도');
{ const t = R.resultPrintTitle(data()); ok(!/PJT팀|사원|80|점|등급|[A-D]\b/.test(t.replace('인사평가 결과 통보서', '')), '★ 부서·직급·점수·등급은 파일 이름에 넣지 않는다 — 실제: ' + t); }
eq(R.resultPrintTitle({ year: 2026, worker: { name: '김/하린' } }), '인사평가 결과 통보서 - 김-하린 - 2026', '이름의 금지 문자는 정리한다');
eq(R.resultPrintTitle({ year: 2026, worker: { name: '도하린 010-1234-5678' } }), '인사평가 결과 통보서 - 도하린 - 2026', '★ 안전 규칙: 이름 칸의 전화번호 제거');
eq(R.resultPrintTitle({ year: 2026 }), '인사평가 결과 통보서 - 2026', '이름이 없으면 연도만');
eq(R.resultPrintTitle({ worker: { name: '도하린' } }), '인사평가 결과 통보서 - 도하린', '연도를 모르면 이름만');
for (const bad of [null, undefined, 'x', 3, [], {}]) { let r, threw = false; try { r = R.resultPrintTitle(bad); } catch (e) { threw = true; } ok(!threw && r === '인사평가 결과 통보서', '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않고 종류만 돌려준다'); }
{ const d = data(); const sn = JSON.stringify(d); R.resultPrintTitle(d); ok(JSON.stringify(d) === sn, '입력을 바꾸지 않는다'); }
console.log('── 인쇄용 문서(resultPrintHtml)');
const HTML = () => R.resultHtml(data(), { today: '2026-11-20' });
{ const h = R.resultPrintHtml(HTML(), '인사평가 결과 통보서 - 도하린 - 2026'); ok(/<title>인사평가 결과 통보서 - 도하린 - 2026<\/title>/.test(h), '★ <title> 이 문서 이름으로 바뀐다(새 창의 제목이 저장 창의 기본 파일 이름)'); ok((h.match(/<title>/g) || []).length === 1, '<title> 은 하나뿐이다'); }
{ const h = R.resultPrintHtml(HTML(), '<script>alert(1)</script>'); ok(!/<title><script>/.test(h) && /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/.test(h), '★ 제목은 이스케이프한다(이름에 태그가 들어와도 실행되지 않는다)'); }
{ const h = R.resultPrintHtml(HTML(), '문서'); const sc = h.match(/<script[\s\S]*?<\/script>/g) || []; ok(sc.length === 1, '★ 스크립트는 인쇄 스크립트 하나뿐이다 — 실제 ' + sc.length + '개'); ok(/window\.print\(\)/.test(sc[0]) && /onload/.test(sc[0]), '그 스크립트는 문서를 다 읽은 뒤 인쇄한다(window.onload → window.print)'); ok(!/\$\{|문서/.test(sc[0]), '★ 인쇄 스크립트는 입력 값이 들어가지 않는 고정 문자열이다(제목·이름이 스크립트에 섞이지 않는다)'); }
{ const base = HTML(); const h = R.resultPrintHtml(base, '문서'); const body = (s) => s.slice(s.indexOf('<body>'), s.lastIndexOf('</body>')); const strip = (s) => s.replace(/<script>window\.onload[\s\S]*?<\/script>/, ''); ok(strip(body(h)) === body(base), '★ 본문(<body> 안)은 인쇄 스크립트 하나만 더해질 뿐 한 글자도 바뀌지 않는다 — 통보서 내용·점수를 건드리지 않는다'); ok(/<style>/.test(h) && h.includes('@media print'), '스타일(인쇄 설정)은 그대로 남는다'); }
console.log('── 본문 보존·스크립트 위치(공백·개행이 있는 여러 줄 문서)');
{ const SRC = '<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="utf-8">\n  <title>원래 제목</title>\n  <style>body { margin: 0; }</style>\n</head>\n<body>\n  <div class="w">\n    <h1>  본문   제목  </h1>\n    <p>a  b\n  c</p>\n  </div>\n</body>\n</html>\n'; const h = R.resultPrintHtml(SRC, '새 제목');
  const strip = (x) => x.replace(/<script>window\.onload[\s\S]*?<\/script>/, '').replace('<title>새 제목</title>', '<title>원래 제목</title>'); ok(strip(h) === SRC, '★ 공백·개행·들여쓰기가 있는 문서도 <title> 치환과 인쇄 스크립트 말고는 한 글자도 바뀌지 않는다');
  ok(h.indexOf('<!DOCTYPE html>') === 0, '★ 문서는 여전히 <!DOCTYPE html> 로 시작한다(스크립트를 맨 앞에 두지 않는다)'); const si = h.indexOf('<script>'), bi = h.lastIndexOf('</body>'), hi = h.indexOf('</head>'); ok(si > hi && si < bi && /^<script>[\s\S]*?<\/script>\s*<\/body>/.test(h.slice(si)), '★ 인쇄 스크립트는 </head> 뒤, </body> 바로 앞에 놓인다(문서 구조를 깨지 않는다)'); }
{ const TWO = '<html><head><title>첫째</title></head><body><svg><title>그림 설명</title></svg></body></html>'; const h = R.resultPrintHtml(TWO, '새 제목'); ok(h.includes('<title>새 제목</title>') && h.includes('<svg><title>그림 설명</title></svg>'), '★ <title> 이 둘이면 첫 번째(문서 제목)만 바꾸고 본문 속 <title>(그림 설명 등)은 그대로 둔다'); ok((h.match(/새 제목/g) || []).length === 1, '새 제목은 한 번만 들어간다'); }
{ const h = R.resultPrintHtml(R.resultHtml(data(), { today: '2026-11-20' }), '문서'); ok(/setTimeout\(function\(\)\{window\.print\(\);\},250\)/.test(h), '★ 인쇄는 문서가 로드된 뒤 250ms 지연해서 부른다(스타일·글꼴이 적용된 뒤 인쇄 — 영업기획 인쇄 문서와 같은 방식)'); }
console.log('── 직원에게 가는 원본(resultHtml)은 그대로');
{ const h = HTML(); ok(!/<script/i.test(h), '★ resultHtml 은 스크립트가 없다(발송·직원 링크용 문서의 기존 원칙) — 인쇄 스크립트는 새 창에 쓸 때만 더한다'); ok(/<title>인사평가 결과 통보서<\/title>/.test(h), '★ resultHtml 의 <title> 은 그대로 "인사평가 결과 통보서"다(직원이 링크를 열었을 때의 탭 제목을 바꾸지 않는다)'); const before = HTML(); R.resultPrintHtml(before, '문서'); eq(before, HTML(), 'resultPrintHtml 을 불러도 원본 문서가 바뀌지 않는다'); }
{ const base = HTML(); const sn = base; R.resultPrintHtml(base, '문서'); ok(base === sn, '입력 문자열은 불변이다'); }
console.log('── 이상한 입력');
for (const bad of [null, undefined, 3, {}, []]) { let r, threw = false; try { r = R.resultPrintHtml(bad, '문서'); } catch (e) { threw = true; } ok(!threw && typeof r === 'string', 'HTML 이 문자열이 아니면(' + JSON.stringify(bad) + ') 던지지 않는다'); }
{ const r = R.resultPrintHtml('<p>제목 없는 조각</p>', '문서'); ok(typeof r === 'string' && /<title>문서<\/title>/.test(r) && /window\.print\(\)/.test(r) && r.includes('<p>제목 없는 조각</p>'), '★ <title> 이나 </body> 가 없는 HTML 도 던지지 않고 제목과 인쇄 스크립트를 더하며 내용은 보존한다'); }
{ const r = R.resultPrintHtml(HTML(), ''); ok(/<title>인사평가 결과 통보서<\/title>/.test(r), '제목이 비어 있으면 원래 제목을 그대로 둔다(빈 <title> 을 만들지 않는다)'); const r2 = R.resultPrintHtml(HTML(), null); ok(/<title>인사평가 결과 통보서<\/title>/.test(r2), 'null 도 같다'); }
{ const long = R.resultPrintHtml(HTML(), '가'.repeat(500)); const m = long.match(/<title>([^<]*)<\/title>/); ok(m && m[1].length <= 200, '제목이 너무 길면 200자로 자른다'); }
{ const r = R.resultPrintHtml(HTML(), '제목\n둘째 줄\t탭'); const m = r.match(/<title>([^<]*)<\/title>/); ok(m && !/[\n\t]/.test(m[1]), '제목의 개행·탭은 공백 하나로 정리한다 — 실제: ' + JSON.stringify(m && m[1])); }
ok(pass + fail >= 41, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
