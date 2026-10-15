// 평가 결과 통보서 — 내용 결정(buildResultData)과 HTML(resultHtml)
import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const R = await import('../app/modules/eval/result-report.js?v=' + VER); const E = await import('../app/modules/eval/evaluation.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = { id: 'w1', name: '김영서', dept: 'PJT팀', rank: '사원' }; const it = E.areaItems('PJT팀', '사원');
const mkCycle = (o) => Object.assign(E.emptyCycle(W, 2026), { leadAgg: { areas: { achievement: 4, competency: 5, conduct: 3 }, n: 1, by: 'uL' }, peerAgg: { avg: 4, n: 3 }, ceo: { approved: true, score: null, comment: '내부 코멘트 비공개' }, confirmed: true, self: { text: '올해 안전교육을 모두 이수했습니다.' } }, o || {});
// ── 확정된 평가만
ok(R.buildResultData({ year: 2026, worker: W, cycle: mkCycle({ confirmed: false }) }).ok === false && /확정되지 않은/.test(R.buildResultData({ year: 2026, worker: W, cycle: mkCycle({ confirmed: false }) }).reason), '★ 확정 전 평가는 통보서를 만들지 않음(대표 확정 후에만)');
ok(R.buildResultData({ year: 2026, worker: W, cycle: null }).ok === false && R.buildResultData({ year: 1999, worker: W, cycle: mkCycle() }).ok === false && R.buildResultData(null).ok === false, '정기평가 기록이 없거나 연도가 이상하거나 입력이 비어도 오류 없이 만들지 않음');
const noPeer = mkCycle({ peerAgg: { avg: null, n: 1 } }); ok(R.buildResultData({ year: 2026, worker: W, cycle: noPeer }).ok === false, '동료 평균이 없어 팀 점수가 안 나온 평가는 확정될 수 없으므로 통보서도 없음');
// ── 내용(손계산): 팀장 업적 4·역량 5·태도 3, 동료 4.0 → 32 + 20 + 12 + 16 = 80점, 등급 A
const r = R.buildResultData({ year: 2026, worker: W, cycle: mkCycle(), adhoc: [] }); const d = r.data;
ok(r.ok && d.final === 80 && d.grade === 'A' && d.combined === null && d.worker.name === '김영서' && d.period.from === '2025-10-01' && d.period.to === '2026-09-30', '★ 최종 80점 · A등급(손계산 32+20+12+16), 수시평가가 없으면 종합 점수 없음, 평가 기간 2025-10-01 ~ 2026-09-30');
const by = Object.fromEntries(d.areas.map((a) => [a.key, a])); ok(by.achievement.score === 32 && by.achievement.avg === 4 && by.competency.score === 20 && by.competency.avg === 5 && by.conduct.score === 12 && by.conduct.avg === 3 && by.peer.score === 16 && by.peer.avg === 4 && d.areas.length === 4, '★ 영역별 환산 점수: 업적 32 · 역량 20 · 태도 12 · 동료 16(평균 4·5·3·4)');
// ── 수시평가 합산: 정기 80 + 수시 90 → 80×0.6 + 90×0.4 = 84
const rec = { confirmed: true, items: { progress: 5, schedule: 5, quality: 5, safety: 5, report: 5 }, peers: { a: [5, 5, 5], b: [5, 5, 5] }, exec: { e1: { person: 4 }, e2: { person: 5 } } }; const proj = { exec: { e1: { project: 4 }, e2: { project: 5 } } };
const sa = E.adhocSummary(rec, proj); ok(sa.final != null, '(시험 준비) 확정된 수시평가 기록이 최종 점수를 가짐: ' + sa.final);
const r2 = R.buildResultData({ year: 2026, worker: W, cycle: mkCycle(), adhoc: [{ pjtName: 'P4 Ph2 (FAB)', rec, proj }] });
ok(r2.data.adhoc.length === 1 && r2.data.adhoc[0].name === 'P4 Ph2 (FAB)' && r2.data.adhoc[0].final === sa.final && Math.abs(r2.data.combined - E.combineRegular(80, [sa.final])) < 0.01, '★ 확정된 수시평가가 프로젝트별로 들어가고 종합 점수 = 정기 60% + 수시 40%: ' + r2.data.combined);
const r3 = R.buildResultData({ year: 2026, worker: W, cycle: mkCycle(), adhoc: [{ pjtName: '미확정', rec: Object.assign({}, rec, { confirmed: false }), proj }, null, { pjtName: '기록없음', rec: null, proj: null }] }); ok(r3.data.adhoc.length === 0 && r3.data.combined === null, '★ 확정되지 않은 수시평가·빈 항목은 통보서에 넣지 않음');
// ── 비프로젝트 팀: 사장단 평가 평균(모두 4점 → 업적 32·역량 32·태도 16 = 80)
const Wn = { id: 'w2', name: '박총무', dept: '인사총무팀', rank: '사원' }; const itn = E.areaItems('인사총무팀', '사원'); const fullN = (v) => ({ achievement: itn.achievement.map(() => v), competency: itn.competency.map(() => v), conduct: itn.conduct.map(() => v) });
const cn = Object.assign(E.emptyCycle(Wn, 2026), { exec: { e1: { areas: fullN(4) }, e2: { areas: fullN(4) } }, ceo: { approved: true }, confirmed: true }); const rn = R.buildResultData({ year: 2026, worker: Wn, cycle: cn });
ok(rn.ok && rn.data.final === 80 && rn.data.areas.map((a) => a.key).join() === 'achievement,competency,conduct' && rn.data.areas.every((a) => a.weight > 0) && rn.data.peerN === 0, '비프로젝트 팀: 사장단 평가 평균으로 80점(업적 32·역량 32·태도 16), 동료평가 행은 아예 만들지 않음');
// ── HTML: 내용·안전·누락
const html = R.resultHtml(d, { today: '2026-11-20' });
ok(html.startsWith('<!DOCTYPE html>') && html.includes('2026년 인사평가 결과 통보서') && html.includes('김영서') && html.includes('PJT팀 · 사원') && html.includes('80') && html.includes('A등급') && html.includes('업적') && html.includes('동료평가') && html.includes('발행일 2026-11-20'), 'HTML: 제목·성명·소속·최종 점수·등급·영역·발행일이 들어 있음');
ok(html.includes('참고자료') && html.includes('실적 보고서') && html.includes('별도로 안내') && html.includes('올해 안전교육을 모두 이수했습니다.'), '★ 안내(참고자료·연봉협상 면담에 실적 보고서 지참·일정 별도 안내)와 본인 자기평가 서술이 들어 있음');
ok(!/사장단|코멘트|내부 코멘트|raterUid|uLead|uL\b|scores|approved|ceo|대표 점수/.test(html), '★ 사장단 개인 점수·코멘트·평가자 식별자·내부 필드는 어디에도 없음(대표 코멘트 "내부 코멘트 비공개"도 안 나감)');
ok(!/<script|javascript:|onerror=|onload=|<iframe|<img|https?:\/\//i.test(html), '스크립트·이벤트·외부 주소 없음(자체 완결 문서)');
const evil = R.resultHtml(Object.assign({}, d, { worker: { name: '<script>x</script>', dept: '"><img src=x onerror=1>', rank: "'" }, selfText: '<img src=x onerror=alert(1)> & <b>굵게</b>', adhoc: [{ name: '<i>p</i>', final: 80, grade: 'A' }] }), {});
// 이스케이프된 글자(&lt;img … onerror=…&gt;)는 태그가 아니라 실행되지 않는다. "태그로 살아 있는" 경우만 위험으로 본다: <script 태그, 또는 < 로 시작하는 태그 안의 on*= 속성, 직원이 넣은 <img>·<i>·<b>굵게
const live = (h) => /<\s*script\b/i.test(h) || /<[a-z][^>]*\son[a-z]+\s*=/i.test(h) || /<img\b/i.test(h) || /<i>p<\/i>/.test(h) || /<b>굵게/.test(h);
ok(!live(evil) && live('<img src=x onerror=1>') && live('<div onclick="x">') && live('<script>x</script>') && !live('&lt;img src=x onerror=alert(1)&gt;') && evil.includes('&lt;script&gt;') && evil.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &lt;b&gt;굵게&lt;/b&gt;') && evil.includes('&#39;'), '★ 이름·소속·자기평가 서술·프로젝트명에 HTML 이 들어 있어도 모두 이스케이프됨(직원이 서술에 쓴 코드가 실행되지 않음)');
ok(R.resultHtml(Object.assign({}, d, { selfText: '' }), {}).indexOf('나의 자기평가') === -1 && R.resultHtml(d, {}).indexOf('발행일') === -1 && !R.resultHtml(Object.assign({}, d, { adhoc: [] }), {}).includes('수시평가 (프로젝트별)'), '자기평가 서술이 없으면 그 칸을 만들지 않고, 발행일은 값이 있을 때만, 수시평가가 없으면 표를 만들지 않음');
const long = R.buildResultData({ year: 2026, worker: W, cycle: mkCycle({ self: { text: 'a'.repeat(5000) } }) }); ok(long.data.selfText.length === 2000, '자기평가 서술은 최대 2000자까지만(내 평가의 상한과 같음)');
ok(html.includes('@media print') && html.includes('viewport') && R.RESULT_DOC_TYPE === 'evalresult', '인쇄·폰 화면 설정이 있고 문서 종류 식별자는 evalresult');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
