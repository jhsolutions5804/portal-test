import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const I = await import('../app/modules/plan/issue.js?v=' + VER);
const PR = await import('../app/modules/plan/progress.js?v=' + VER);
const { PROGRESS_PROFILES } = await import('../app/shared/pjt-progress-data.js');
const { structureFromProfile, toProfile } = await import('../app/shared/pjt-structure.js');
/* 공정 연동 불러오기 — 견적은 자기 프로젝트의 공정 체크·섹터 구조·설치 판정 기준으로 계산한다(대기열 1-2-10, 대표님 2026-10-22 "정산 항목에서 프로젝트를 선택하면 항목별로 그 프로젝트에 맞게").
 * 지금까지 불러오기는 정산서의 대표 프로젝트 한 개의 progress_days 만 읽고 그 프로젝트의 섹터·설치 공정 열로 모든 견적에 적용해, 서로 다른 프로젝트의 견적은 진행(반입·설치 수)이 0 으로 나와 청구되지 않았다(돈 오류).
 * 프로젝트 p1 = P4 Ph2(연동 p4ph2, 설치 공정 5개 모두 체크해야 설치), p2 = P4 Ph4(연동 p4ph4, 설치 공정 1개). 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const profOf = (k) => toProfile(structureFromProfile(PROGRESS_PROFILES[k]));
I.setProgressOverrides({ p4ph2: profOf('p4ph2'), p4ph4: profOf('p4ph4') });
const PJ = [{ id: 'p1', code: 'A1', linkPjt: 'p4ph2' }, { id: 'p2', code: 'A2', linkPjt: 'p4ph4' }, { id: 'p3', code: 'A3', linkPjt: 'none' }];
const EST = () => [
  { id: 'f1', pjtId: 'p1', title: '3F FIZ FCU 39대', no: 'E1', status: 'active', items: [{ amount: 39000000 }] },
  { id: 'f2', pjtId: 'p1', title: 'FIZ 추가', no: 'E2', status: 'active', items: [{ amount: 3900000 }] },
  { id: 'h1', pjtId: 'p2', title: '(중공업) #20Core EHU', no: 'E3', status: 'active', items: [{ amount: 9000000 }] },
  { id: 'n1', pjtId: 'p3', title: '연동 없는 현장', no: 'E4', status: 'active', items: [{ amount: 1000 }] }];
const D = (o) => Object.assign(I.newIssueDraft({ docType: 'invoice', pjtId: 'p1', companies: [], today: '2026-10-22' }), { method: 'progress', pjtIds: ['p1', 'p2'], baseMonth: '2026-10' }, o || {});
const pick = (d, ids, est) => { ids.forEach((id) => I.toggleEst(d, id, PJ, est || EST())); return d; };
// 프로젝트별 서버 문서(연동 id → [{id: 날짜, data: {groups}}])
const DOCS_PH2 = () => [{ id: '2026-10-10', data: { groups: { fiz: { '801_반입': true, '801_내진스토퍼': true, '801_다이크': true, '801_실링': true, '801_동판': true, '801_결선': true, '802_반입': true } } } }];
const DOCS_PH4 = () => [{ id: '2026-10-11', data: { groups: { core20: { 'EHU_4F10701_반입': true, 'EHU_4F10701_내진스토퍼': true, 'EHU_4F10702_반입': true } } } }];
const BY = () => ({ p4ph2: DOCS_PH2(), p4ph4: DOCS_PH4() });
console.log('── 견적마다 자기 프로젝트의 공정 체크로 불러온다(서로 다른 프로젝트 견적을 한 청구서에)');
{ const d = pick(D(), ['f1', 'h1']); I.applyProgressByProject(d, EST(), PJ, BY(), '2026-10-31');
  eq([d.prog.f1, d.prog.h1], [{ banip: 2, install: 1 }, { banip: 2, install: 1 }], '★ f1(Ph2 fiz): 반입 801·802 = 2, 설치는 5공정을 모두 체크한 801 하나 = 1 / h1(Ph4 core20): 반입 …701·702 = 2, 설치는 내진스토퍼 1공정만 필요해 …701 하나 = 1');
  eq([d.eqs.f1.banipEqs, d.eqs.f1.installEqs, d.eqs.h1.banipEqs, d.eqs.h1.installEqs], [['801', '802'], ['801'], ['EHU_4F10701', 'EHU_4F10702'], ['EHU_4F10701']], '장비 번호도 각 프로젝트의 것(Ph4 견적에 Ph2 장비 번호가 들어가지 않는다)');
  const rows = [EST()[0], EST()[2]].map((e) => PR.calcProgressRow(d, e, I.progressZonesOf(d, e, PJ), [])); eq(rows.map((r) => r.thisBill), [1800000, 5400000], '★ 금액: f1 = 39,000,000×0.8×2/39 + 39,000,000×0.2×1/39 = 1,600,000 + 200,000 = 1,800,000 / h1 = 9,000,000×0.8×2/3 + 9,000,000×0.2×1/3 = 4,800,000 + 600,000 = 5,400,000'); }
console.log('── 옛 동작의 결함 재현(대표 프로젝트 한 개의 데이터·섹터·설치 기준으로 모든 견적에)');
{ const d = pick(D(), ['f1', 'h1']); const prof = I.progressProfile(d, PJ); const cum = PR.accumulateDays(DOCS_PH2(), [...new Set(d.estIds.map((id) => d.estZone[id]))], '2026-10-31'); PR.applyProgress(d, cum, prof);
  eq([d.prog.f1, d.prog.h1], [{ banip: 2, install: 1 }, { banip: 0, install: 0 }], '★ 옛 방식(대표 프로젝트 Ph2 의 체크·섹터로 모든 견적) — h1 은 Ph2 에 core20 체크가 없어 반입·설치 0 → 5,400,000원이 청구되지 않는 결함(이 시험이 옛 방식이 틀림을 보인다)'); }
console.log('── 기준일·날짜 범위');
{ const d = pick(D(), ['f1']); const docs = DOCS_PH2().concat([{ id: '2026-09-30', data: { groups: { fiz: { '803_반입': true } } } }, { id: '2026-11-02', data: { groups: { fiz: { '804_반입': true } } } }, { id: '2026-04-30', data: { groups: { fiz: { '805_반입': true } } } }]);
  I.applyProgressByProject(d, EST(), PJ, { p4ph2: docs }, '2026-10-31'); eq(d.eqs.f1.banipEqs, ['801', '802', '803'], '★ 기준월 말일(10-31) 이전은 포함(9월 30일의 803), 기준월 뒤(11-02의 804)와 시작 기준일(2026-05-01) 앞(4월 30일의 805)은 제외'); }
{ const d = pick(D(), ['f1']); I.applyProgressByProject(d, EST(), PJ, { p4ph2: DOCS_PH2() }, '2026-10-10'); eq(d.eqs.f1.banipEqs, ['801', '802'], '기준일 당일(10-10) 문서는 포함'); }
{ const d = pick(D(), ['f1']); I.applyProgressByProject(d, EST(), PJ, { p4ph2: DOCS_PH2() }, '2026-10-09'); eq(d.prog.f1, { banip: 0, install: 0 }, '기준일이 문서보다 앞이면 0'); }
console.log('── 같은 프로젝트의 견적 둘, 문서가 없는 프로젝트, 연동 없는 프로젝트');
{ const d = pick(D(), ['f1', 'f2']); I.applyProgressByProject(d, EST(), PJ, { p4ph2: DOCS_PH2() }, '2026-10-31'); eq([d.prog.f1, d.prog.f2], [{ banip: 2, install: 1 }, { banip: 2, install: 1 }], '★ 같은 프로젝트(같은 섹터 fiz)의 견적 둘은 같은 공정 체크로 모두 계산된다'); }
{ const d = pick(D(), ['f1', 'h1']); I.applyProgressByProject(d, EST(), PJ, { p4ph2: DOCS_PH2() }, '2026-10-31'); eq([d.prog.f1, d.prog.h1], [{ banip: 2, install: 1 }, { banip: 0, install: 0 }], '★ Ph4 의 문서를 못 읽었으면(맵에 없음) h1 만 0 이고 Ph2 의 f1 은 정상(한 프로젝트를 못 읽어도 다른 프로젝트는 영향 없음)'); }
{ const d = pick(D({ pjtIds: ['p1', 'p3'] }), ['f1', 'n1']); let threw = false; try { I.applyProgressByProject(d, EST(), PJ, BY(), '2026-10-31'); } catch (e) { threw = true; } ok(!threw && d.prog.n1 && d.prog.n1.banip === 0 && d.prog.f1.banip === 2, '연동이 없는 프로젝트(p3)의 견적 n1 은 섹터 구조가 없어 0 이고 던지지 않으며 다른 견적 f1 은 정상'); }
console.log('── 연동 id 목록(서버에서 읽어야 할 곳)');
eq(I.progressLinkIds(D(), ['f1', 'f2', 'h1'].map((id) => EST().find((e) => e.id === id)), PJ), ['p4ph2', 'p4ph4'], '★ f1·f2(같은 p4ph2)와 h1(p4ph4) → 읽을 곳은 p4ph2·p4ph4 두 곳(같은 연동은 한 번만)');
eq(I.progressLinkIds(D(), [EST()[0]], PJ), ['p4ph2'], '견적이 한 프로젝트면 그 연동 하나');
eq(I.progressLinkIds(D(), [], PJ), [], '견적이 없으면 읽을 곳도 없다');
eq(I.progressLinkIds(D(), [EST()[3]], PJ), [], '★ 연동 없음(none)인 프로젝트는 읽을 곳이 없다(\"none\" 이라는 컬렉션을 읽으러 가지 않는다)');
eq(I.progressLinkIds(D(), [{ id: 'x', pjtId: 'zzz' }], PJ), ['p4ph2'], '호환: 견적의 프로젝트를 못 찾으면 대표 프로젝트(p1)의 연동');
eq(I.progressLinkIds(D(), [{ id: 'x' }], PJ), ['p4ph2'], '호환: 견적에 프로젝트가 없으면 대표 프로젝트의 연동');
eq(I.progressLinkIds(D(), [null, EST()[2]], PJ), ['p4ph4'], '견적이 null 이어도 건너뛴다');
{ const PJA = PJ.concat([{ id: 'p4', code: 'A4', linkPjt: 'auto' }]); eq(I.progressLinkIds(D(), [{ id: 'x', pjtId: 'p4' }], PJA), [], '★ 프로젝트의 연동이 "auto"(새 PJT관리 항목 자동 생성 설정, 아직 연결 전)이면 "auto" 라는 컬렉션을 읽으러 가지 않는다'); }
{ const PJ7 = PJ.concat([{ id: 7, code: '숫자', linkPjt: 'p4ph4' }]); eq(I.progressLinkIds(D(), [{ id: 'x', pjtId: 7 }], PJ7), ['p4ph2'], '★ 견적의 프로젝트 id 가 글자가 아니면(숫자 7 — 목록에 같은 숫자 id 프로젝트가 있어도) 그 프로젝트로 취급하지 않고 대표 프로젝트(p1)의 연동 p4ph2'); }
{ const PJ7 = PJ.concat([{ id: 7, code: '숫자', linkPjt: 'p4ph4' }]); const d = pick(D(), ['f1']); const est = EST().concat([{ id: 'z', pjtId: 7, title: '3F FIZ', no: 'E9', status: 'active', items: [{ amount: 1 }] }]); d.estIds.push('z'); d.estZone.z = 'fiz'; I.applyProgressByProject(d, est, PJ7, { p4ph2: DOCS_PH2(), p4ph4: DOCS_PH4() }, '2026-10-31'); eq(d.prog.z, { banip: 2, install: 1 }, '★ 프로젝트 id 가 숫자인 견적도 대표 프로젝트(Ph2)의 체크·섹터로 계산된다(숫자 id 프로젝트 Ph4 의 데이터가 섞이지 않는다)'); }
console.log('── 단일 프로젝트는 옛 동작과 같다');
{ const d1 = pick(D({ pjtIds: ['p1'] }), ['f1']); I.applyProgressByProject(d1, EST(), PJ, { p4ph2: DOCS_PH2() }, '2026-10-31');
  const d2 = pick(D({ pjtIds: ['p1'] }), ['f1']); const cum = PR.accumulateDays(DOCS_PH2(), ['fiz'], '2026-10-31'); PR.applyProgress(d2, cum, I.progressProfile(d2, PJ));
  eq([d1.prog, d1.eqs, d1.billOverride], [d2.prog, d2.eqs, d2.billOverride], '★ 프로젝트가 하나뿐이면 옛 방식(대표 프로젝트로 일괄)과 결과가 완전히 같다(진행·장비 번호·직접 고친 청구액 초기화)'); }
console.log('── 직접 고친 청구액은 초기화(옛 동작 그대로)');
{ const d = pick(D(), ['f1', 'h1']); d.billOverride.f1 = 123; d.billOverride.h1 = 456; I.applyProgressByProject(d, EST(), PJ, BY(), '2026-10-31'); eq([d.billOverride.f1, d.billOverride.h1], [null, null], '불러오면 직접 고친 청구액이 모두 초기화된다'); }
console.log('── 안전');
for (const bad of [null, undefined, 'x', 3, {}]) { let threw = false; try { I.applyProgressByProject(pick(D(), ['f1']), bad, PJ, BY(), '2026-10-31'); I.applyProgressByProject(pick(D(), ['f1']), EST(), bad, BY(), '2026-10-31'); I.applyProgressByProject(pick(D(), ['f1']), EST(), PJ, bad, '2026-10-31'); I.progressLinkIds(D(), bad, PJ); I.progressLinkIds(D(), EST(), bad); } catch (e) { threw = true; } ok(!threw, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
{ const est = EST(); const sn = JSON.stringify(est); const d = pick(D(), ['f1', 'h1']); I.applyProgressByProject(d, est, PJ, BY(), '2026-10-31'); ok(JSON.stringify(est) === sn, '견적 목록을 바꾸지 않는다'); }
{ const by = BY(); const sn = JSON.stringify(by); const d = pick(D(), ['f1', 'h1']); I.applyProgressByProject(d, EST(), PJ, by, '2026-10-31'); ok(JSON.stringify(by) === sn, '읽어 온 문서를 바꾸지 않는다'); }
ok(pass + fail >= 29, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
