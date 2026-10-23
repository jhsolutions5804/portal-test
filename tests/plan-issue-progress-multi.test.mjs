import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8').match(/margin-link\.js\?v=([0-9a-z]+)/) || [])[1];
const I = await import('../app/modules/plan/issue.js?v=' + VER);
const { PROGRESS_PROFILES } = await import('../app/shared/pjt-progress-data.js');
const { structureFromProfile, toProfile } = await import('../app/shared/pjt-structure.js');
/* 공정 연동 — 견적은 자기 프로젝트의 섹터 구조로 계산한다(대기열 1-2-10, 대표님 2026-10-22 "정산 항목에서 프로젝트를 선택하면 항목별로 그 프로젝트에 맞게").
 * 지금까지는 정산서의 대표 프로젝트(pjtId) 한 개의 섹터 목록으로 모든 견적을 계산해, 서로 다른 프로젝트의 견적을 함께 담으면 다른 프로젝트 견적의 섹터를 못 찾아 진행률이 틀렸다(돈 계산 오류).
 * 프로젝트 p1 = P4 Ph2(섹터 fiz 39대 …), p2 = P4 Ph4(섹터 core20 3대 …). 공개 저장소라 가짜 값만 쓴다. 기대값은 모두 손으로 적었다. */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, m + (s ? '' : ' ← 실제: ' + JSON.stringify(a) + ' / 기대: ' + JSON.stringify(b))); };
const profOf = (k) => toProfile(structureFromProfile(PROGRESS_PROFILES[k]));
I.setProgressOverrides({ p4ph2: profOf('p4ph2'), p4ph4: profOf('p4ph4') });
const PJ = [{ id: 'p1', code: 'A1', linkPjt: 'p4ph2' }, { id: 'p2', code: 'A2', linkPjt: 'p4ph4' }];
const EST = () => [
  { id: 'f1', pjtId: 'p1', title: '3F FIZ FCU 39대 설치', no: 'E1', status: 'active', items: [{ amount: 39000000 }] },
  { id: 'h1', pjtId: 'p2', title: '(중공업) #20Core EHU', no: 'E2', status: 'active', items: [{ amount: 9000000 }] }];
const D = (o) => Object.assign(I.newIssueDraft({ docType: 'invoice', pjtId: 'p1', companies: [], today: '2026-10-22' }), { method: 'progress', pjtIds: ['p1', 'p2'], recipientId: '' }, o || {});
const bld = (d, extra) => I.buildSettlement(d, Object.assign({ settlements: [], estimates: EST(), companies: [], projects: PJ, me: {}, now: 1790000000000 }, extra || {}));
console.log('── 섹터 목록은 견적의 프로젝트에서');
eq(I.progressZonesOf(D(), EST()[0], PJ).map((z) => z.id), ['fiz', 'xob', 'c3', 'c4', 'wob', 'mfr'], '★ p1 의 견적 f1 은 Ph2 의 6개 섹터');
eq(I.progressZonesOf(D(), EST()[1], PJ).map((z) => z.id), ['core20', 'core13', 'core14', 'core17'], '★ p2 의 견적 h1 은 Ph4 의 4개 섹터(대표 프로젝트가 p1 이어도)');
eq(I.progressZonesOf(D(), { id: 'x', pjtId: 'zzz' }, PJ).map((z) => z.id), ['fiz', 'xob', 'c3', 'c4', 'wob', 'mfr'], '호환: 견적의 프로젝트를 목록에서 못 찾으면 대표 프로젝트(p1)의 섹터');
eq(I.progressZonesOf(D(), { id: 'x' }, PJ).map((z) => z.id).length, 6, '호환: 견적에 프로젝트가 없으면 대표 프로젝트의 섹터');
eq(I.progressZonesOf(D(), null, PJ).map((z) => z.id).length, 6, '호환: 견적이 없어도(null) 대표 프로젝트의 섹터');
eq(I.progressZonesOf(D({ pjtId: 'p2', pjtIds: ['p2'] }), EST()[1], PJ).length, 4, '단일 프로젝트(p2)는 기존과 같다');
{ const PJ7 = PJ.concat([{ id: 7, code: '숫자id', linkPjt: 'p4ph4' }]); eq(I.progressZonesOf(D(), { id: 'x', pjtId: 7 }, PJ7).map((z) => z.id).length, 6, '★ 견적의 프로젝트 id 가 글자가 아니면(숫자 7 — 목록에 같은 숫자 id 의 프로젝트가 있어도) 그 프로젝트로 취급하지 않고 대표 프로젝트(p1, 6개 섹터)로 대신한다 — 돈 계산에 쓰이는 값이라 이상한 id 는 걸러낸다'); }
console.log('── 견적을 고르면 섹터가 견적의 프로젝트 구조로 추정된다');
{ const d = D(); I.toggleEst(d, 'f1', PJ, EST()); I.toggleEst(d, 'h1', PJ, EST()); eq(d.estZone, { f1: 'fiz', h1: 'core20' }, '★ f1 은 키워드 "3F FIZ" → fiz, h1 은 "#20Core"·"중공업" → core20(p1 의 섹터 목록에서 못 찾아 엉뚱한 첫 섹터가 들어가던 옛 동작)'); }
{ const d = D(); const E2 = EST().concat([{ id: 'h2', pjtId: 'p2', title: '이름에 키워드 없음', no: 'E3', status: 'active', items: [{ amount: 1 }] }]); I.toggleEst(d, 'h2', PJ, E2); eq(d.estZone.h2, 'core20', '키워드가 없으면 견적의 프로젝트(p2)의 첫 섹터 core20(옛 동작은 p1 의 첫 섹터 fiz)'); }
console.log('── 진행률 계산은 견적의 프로젝트 섹터 총 대수로');
{ const d = D(); I.toggleEst(d, 'f1', PJ, EST()); I.toggleEst(d, 'h1', PJ, EST()); d.prog.f1 = { banip: 39, install: 13 }; d.prog.h1 = { banip: 3, install: 1 };
  const rf = I.calcProgressRow(d, EST()[0], I.progressZonesOf(d, EST()[0], PJ), []); const rh = I.calcProgressRow(d, EST()[1], I.progressZonesOf(d, EST()[1], PJ), []);
  eq([rf.qty, rf.cum, rf.thisBill], [39, 33800000, 33800000], 'f1(p1·fiz 39대): 반입 39 + 설치 13 = 31,200,000 + 2,600,000 = 33,800,000');
  eq([rh.qty, rh.cum, rh.thisBill], [3, 7800000, 7800000], '★ h1(p2·core20 3대): 반입 3/3 → 9,000,000×0.8 = 7,200,000, 설치 1/3 → 9,000,000×0.2×1/3 = 600,000, 합계 7,800,000'); }
console.log('── 자동 합계·저장 줄·저장 금액');
{ const d = D(); I.toggleEst(d, 'f1', PJ, EST()); I.toggleEst(d, 'h1', PJ, EST()); d.prog.f1 = { banip: 39, install: 13 }; d.prog.h1 = { banip: 3, install: 1 };
  eq(I.autoSupply(d, EST(), PJ, []), 41600000, '★ 자동 합계 = 33,800,000 + 7,800,000 = 41,600,000 (옛 동작은 h1 을 p1 섹터로 계산해 금액이 틀렸다)');
  const lines = I.issueLines(d, EST(), PJ, []); eq(lines.map((l) => l.amount), [33800000, 7800000], '발행 줄의 금액이 견적별로 맞다');
  const r = bld(d); ok(r.ok, '발행 저장 계획이 만들어진다 — ' + JSON.stringify(r.errors));
  eq([r.payload.perEst, r.payload.perPjtAmount, r.payload.supply, r.payload.pjtIds], [{ f1: 33800000, h1: 7800000 }, { p1: 33800000, p2: 7800000 }, 41600000, ['p1', 'p2']], '★ 저장되는 견적별 금액·프로젝트별 금액·합계가 손계산과 같다(돈의 귀속)'); }
console.log('── 단일 프로젝트는 그대로(기존 시험과 같은 값)');
{ const d = D({ pjtIds: ['p1'] }); I.toggleEst(d, 'f1', PJ, EST()); d.prog.f1 = { banip: 39, install: 13 }; eq(I.autoSupply(d, EST(), PJ, []), 33800000, '단일 프로젝트 p1: 33,800,000(기존 공정 시험과 같은 값)'); }
console.log('── 안전');
for (const bad of [null, undefined, 'x', 3, {}]) { let threw = false; try { I.progressZonesOf(D(), EST()[0], bad); I.progressZonesOf(D(), bad, PJ); I.progressZonesOf(bad, EST()[0], PJ); } catch (e) { threw = true; } ok(!threw, '이상한 입력(' + JSON.stringify(bad) + ')에도 던지지 않는다'); }
ok(pass + fail >= 21, '★ 시험이 끝까지 실행됨(중간에 예외로 중단돼도 FAIL 0 으로 보이지 않게)');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
