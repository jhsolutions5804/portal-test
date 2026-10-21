import { partsDefault, partsToggle, partsSyncMain, partsRatioDraft, partsForSubmit, partsPayload, MAX_PARTS, defaultValues, buildDocData, validate, partsNeedsPreview, partsFinal, partsSubmitCheck, partsSaveError, partsEnabled, mainAfterToggle, fieldsFor } from '../app/modules/edoc/compose.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const J = JSON.stringify; const P = (...a) => a.map((x) => ({ pjt: x }));
console.log('── 칩 기본값·켜기 끄기(업무일지 "오늘 참여한 프로젝트")');
ok(J(partsDefault('pa')) === J(P('pa')) && J(partsDefault('common')) === J(P('common')) && partsDefault('').length === 0 && partsDefault(null).length === 0 && partsDefault(undefined).length === 0 && partsDefault(3).length === 0, '★ 위에서 고른 프로젝트가 칩의 기본값이다(공통 포함) — 고르지 않았으면 빈 목록, 글자가 아니면 빈 목록');
ok(J(partsToggle(P('pa'), 'pb')) === J(P('pa', 'pb')) && J(partsToggle(P('pa', 'pb'), 'pa')) === J(P('pb')) && J(partsToggle([], 'pa')) === J(P('pa')), '★ 칩을 누르면 켜지고 다시 누르면 꺼진다(순서는 누른 순서)');
ok(J(partsToggle(P('pa', 'pb'), 'common')) === J(P('common')) && J(partsToggle(P('common'), 'pa')) === J(P('pa')) && J(partsToggle(P('common'), 'common')) === J([]), '★ "공통"은 단독이다 — 공통을 켜면 나머지가 꺼지고, 다른 프로젝트를 켜면 공통이 꺼진다');
{ const six = ['a', 'b', 'c', 'd', 'e', 'f']; const r = partsToggle(P(...six), 'g'); ok(MAX_PARTS === 6 && r.length === 6 && !r.some((p) => p.pjt === 'g') && J(partsToggle(P(...six), 'a')) === J(P('b', 'c', 'd', 'e', 'f')), '★ 한 사람의 하루는 최대 6개까지 — 7번째를 켜려 하면 무시, 끄는 것은 항상 된다'); }
ok(J(partsToggle(P('pa'), '')) === J(P('pa')) && J(partsToggle(P('pa'), null)) === J(P('pa')) && J(partsToggle(null, 'pa')) === J(P('pa')) && J(partsToggle('x', 'pa')) === J(P('pa')), '이상한 값(빈 id·null·목록이 아님)은 던지지 않고 안전하게 처리');
{ const a = P('pa'); partsToggle(a, 'pb'); ok(J(a) === J(P('pa')), '입력 목록을 바꾸지 않는다(새 목록을 돌려준다)'); }
ok(J(partsToggle([{ pjt: 'pa', ratio: 7 }], 'pb')) === J([{ pjt: 'pa' }, { pjt: 'pb' }]), '★ 칩을 바꾸면 이전에 직접 입력한 비율은 지워진다(프로젝트 구성이 바뀌면 비율의 의미가 달라지므로)');
console.log('── 위쪽 프로젝트가 바뀔 때 칩이 따라가기');
ok(J(partsSyncMain(P('pa'), 'pa', 'pb')) === J(P('pb')) && J(partsSyncMain([], '', 'pa')) === J(P('pa')) && J(partsSyncMain(P('pa', 'pc'), 'pa', 'pb')) === J(P('pb', 'pc')), '★ 이전 기본값(pa)이 선택돼 있었으면 그 자리가 새 프로젝트(pb)로 바뀌고, 직접 더 고른 칩(pc)은 뒤에 남는다');
ok(J(partsSyncMain(P('pc'), 'pa', 'pb')) === J(P('pc', 'pb')), '★ 이전 기본값(pa)이 이미 꺼져 있었으면 남은 칩(pc)은 그대로 두고 새 프로젝트(pb)를 끝에 더한다');
ok(J(partsSyncMain(P('pa'), 'pa', '')) === J([]) && J(partsSyncMain(P('pa'), 'pa', 'common')) === J(P('common')) && J(partsSyncMain(P('pa', 'pb'), 'pa', 'common')) === J(P('common')), '★ 위쪽을 "공통"으로 바꾸면 칩도 공통 단독이 된다 · 위쪽을 비우면 이전 기본값 칩만 빠진다');
console.log('── 직접 비율(쏠린 날만 고치기)');
{ const r = partsRatioDraft(P('pa', 'pb'), ['70', '30']); ok(r.ok && J(r.parts) === J([{ pjt: 'pa', ratio: 70 }, { pjt: 'pb', ratio: 30 }]) && r.error === '', '★ 70 + 30 = 100 이면 통과, 서버로 보낼 ratio 가 붙는다'); }
{ const r = partsRatioDraft(P('pa', 'pb', 'pc'), ['33.4', '33.3', '33.3']); ok(r.ok, '소수 비율도 합이 100 이면 통과(33.4 + 33.3 + 33.3)'); }
for (const [nm, tx] of [['합이 100 미만', ['60', '30']], ['합이 100 초과', ['70', '40']], ['빈 칸', ['70', '']], ['글자', ['70', 'x']], ['0', ['100', '0']], ['음수', ['120', '-20']], ['NaN', ['70', 'NaN']]]) { const r = partsRatioDraft(P('pa', 'pb'), tx); ok(!r.ok && r.parts === null && /비율|100/.test(r.error), '★ 비율이 ' + nm + ' 이면 거절·이유에 "비율" 또는 "100" (실제: ' + r.error + ')'); }
ok(partsRatioDraft(P('pa', 'pb'), ['70']).ok === false && partsRatioDraft(P('pa'), ['100', '0']).ok === false && partsRatioDraft(P('pa'), ['100']).ok === true, '입력 칸 수가 프로젝트 수와 다르면(모자라거나 남으면) 거절, 프로젝트 하나에 100 이면 통과');
for (const bad of [null, undefined, 'x', 3, {}]) { let r; try { r = partsRatioDraft(bad, ['100']); } catch (e) { r = { threw: e.message }; } ok(r && !r.threw && r.ok === false, '이상한 목록(' + J(bad) + ')은 던지지 않고 거절'); }
ok(partsRatioDraft(P('pa', 'pb'), ['70.0000001', '29.9999999']).ok === true && partsRatioDraft(P('pa', 'pb'), ['70', '29.5']).ok === false, '합이 100 인지는 부동소수 오차를 허용해 판정한다(미세 오차는 통과, 0.5 차이는 거절)');
console.log('── 임시저장·상신 검사');
ok(partsForSubmit([], true).ok === true && partsForSubmit(P('pa'), true).ok === true, '★ 임시저장은 참여 프로젝트가 비어 있어도 된다');
{ const r = partsForSubmit([], false); ok(!r.ok && /참여/.test(r.error), '★ 상신하려면 참여 프로젝트를 1개 이상 골라야 한다 — 이유에 "참여" (실제: ' + r.error + ')'); }
ok(partsForSubmit(P('pa'), false).ok === true && partsForSubmit(P('common'), false).ok === true && partsForSubmit(P('pa', 'pb'), false).ok === true, '상신: 프로젝트 하나·공통·여러 개 모두 통과');
ok(partsForSubmit(null, false).ok === false && partsForSubmit(undefined, false).ok === false && partsForSubmit('x', false).ok === false, '목록이 아니면 상신 거절(던지지 않음)');
console.log('── 서버 호출 본문');
ok(J(partsPayload('daily', { date: '2026-10-16', parts: P('pa', 'pb') })) === J({ action: 'save', date: '2026-10-16', projects: P('pa', 'pb') }), '★ 업무일지는 { action:"save", date, projects } 를 만든다');
ok(J(partsPayload('daily', { date: '2026-10-16', parts: [{ pjt: 'pa', ratio: 70 }, { pjt: 'pb', ratio: 30 }] })) === J({ action: 'save', date: '2026-10-16', projects: [{ pjt: 'pa', ratio: 70 }, { pjt: 'pb', ratio: 30 }] }), '직접 비율이 있으면 ratio 도 함께 보낸다');
ok(partsPayload('leave', { date: '2026-10-16', parts: P('pa') }) === null && partsPayload('spend', { date: '2026-10-16', parts: P('pa') }) === null && partsPayload('drive', { date: '2026-10-16', parts: P('pa') }) === null, '★ 업무일지가 아닌 문서는 참여 기록을 보내지 않는다');
ok(partsPayload('daily', { date: '2026-10-16', parts: [] }) === null && partsPayload('daily', { date: '2026-10-16' }) === null && partsPayload('daily', { date: '', parts: P('pa') }) === null && partsPayload('daily', null) === null && partsPayload('daily', { date: 'x', parts: P('pa') }) === null, '★ 날짜가 없거나 형식이 틀리거나 칩이 비어 있으면 보내지 않는다(기록 없음은 "미입력"으로 둔다)');
ok(J(partsPayload('daily', { date: '2026-10-16', parts: [{ pjt: ' pa ' }] }).projects) === J(P('pa')), '프로젝트 id 앞뒤 공백은 정리해서 보낸다');
console.log('── 문서 본문에는 섞이지 않는다(업무일지는 승인되면 잠기므로 참여 기록은 별도 문서)');
{ const me = { uid: 'u1', name: '김' }; const v = Object.assign(defaultValues('daily', me, new Date('2026-10-16T03:00:00Z')), { pjtId: 'pa', todayWork: '작업', parts: [{ pjt: 'pa' }, { pjt: 'pb' }] }); const d = buildDocData('daily', v, me, { projects: [{ id: 'pa', name: 'A', code: 'C1' }], now: new Date('2026-10-16T03:00:00Z') }); ok(!('parts' in d) && !J(d).includes('"pb"'), '★ buildDocData 가 만든 업무일지 문서에 parts·참여 칩이 들어가지 않는다'); ok(Array.isArray(defaultValues('daily', me, new Date()).parts) && defaultValues('daily', me, new Date()).parts.length === 0, '업무일지의 새 양식 값에는 빈 parts 가 있다'); ok(!('parts' in defaultValues('leave', me, new Date())) && !('parts' in defaultValues('spend', me, new Date())), '다른 문서 양식에는 parts 가 없다'); }
{ const me = { uid: 'u1', name: '김' }; const v = Object.assign(defaultValues('daily', me, new Date()), { pjtId: 'pa', todayWork: '작업', parts: [{ pjt: 'zzz' }] }); const err = validate('daily', v, { projects: [{ id: 'pa' }] }); ok(!err.parts && !err.pjtId, '기존 검증(validate)은 참여 칩을 건드리지 않는다 — 참여 검사는 partsForSubmit 이 따로 한다'); }
console.log('── 연결 판단(index.js 가 부르는 순수 함수)');
const DV = (parts, extra) => Object.assign({ date: '2026-10-16', parts }, extra || {}); const UI = (o) => Object.assign({ custom: false, texts: {} }, o || {});
ok(partsNeedsPreview(DV(P('pa', 'pb')), UI()) === true && partsNeedsPreview(DV(P('pa', 'pb', 'pc')), UI()) === true, '★ 둘 이상 고르고 직접 입력이 꺼져 있으면 서버 미리보기가 필요하다');
ok(partsNeedsPreview(DV(P('pa')), UI()) === false && partsNeedsPreview(DV([]), UI()) === false && partsNeedsPreview(DV(P('common')), UI()) === false, '★ 하나·없음·공통이면 미리보기가 필요 없다(100%)');
ok(partsNeedsPreview(DV(P('pa', 'pb')), UI({ custom: true })) === false, '★ 직접 입력을 켜면 서버 미리보기를 부르지 않는다(사용자가 비율을 정하므로)');
ok(partsNeedsPreview(DV(P('pa', 'pb'), { date: '' }), UI()) === false && partsNeedsPreview(DV(P('pa', 'pb'), { date: '2026-1-6' }), UI()) === false && partsNeedsPreview(null, UI()) === false && partsNeedsPreview(DV(P('pa', 'pb')), null) === true, '날짜가 없거나 형식이 틀리면 미리보기가 필요 없다 · 값이 이상해도 던지지 않는다(ui 가 없으면 직접 입력 꺼짐으로 본다)');
{ const f = partsFinal(DV(P('pa', 'pb')), UI()); ok(f.ok && J(f.parts) === J(P('pa', 'pb')) && f.error === '', '★ 직접 입력이 꺼져 있으면 칩 그대로(비율은 서버가 정한다)'); }
{ const f = partsFinal(DV(P('pa', 'pb')), UI({ custom: true, texts: { pa: '70', pb: '30' } })); ok(f.ok && J(f.parts) === J([{ pjt: 'pa', ratio: 70 }, { pjt: 'pb', ratio: 30 }]), '★ 직접 입력이 켜져 있으면 입력칸 글자를 읽어 ratio 가 붙은 목록이 된다(칩 순서대로)'); }
{ const f = partsFinal(DV(P('pa', 'pb')), UI({ custom: true, texts: { pa: '70', pb: '20' } })); ok(!f.ok && f.parts === null && /100/.test(f.error), '★ 직접 입력의 합이 100 이 아니면 거절·이유 "100"'); const g = partsFinal(DV(P('pa', 'pb')), UI({ custom: true, texts: { pa: '70' } })); ok(!g.ok, '입력칸이 비어 있으면 거절'); }
ok(partsFinal(DV(P('pa', 'pb')), UI({ custom: true, texts: { pb: '30', pa: '70' } })).parts[0].pjt === 'pa', '입력칸 글자는 칩 순서 기준으로 짝지어 읽는다(texts 객체의 키 순서와 무관)');
{ const r = partsSubmitCheck(DV([]), UI(), false); ok(!r.ok && /참여/.test(r.error), '★ 상신: 칩이 비어 있으면 "참여" 오류'); const d = partsSubmitCheck(DV([]), UI(), true); ok(d.ok, '임시저장: 칩이 비어 있어도 통과'); }
{ const r = partsSubmitCheck(DV(P('pa', 'pb')), UI({ custom: true, texts: { pa: '70', pb: '20' } }), false); ok(!r.ok && /100/.test(r.error), '★ 상신: 칩은 있으나 직접 비율의 합이 틀리면 그 오류'); const d = partsSubmitCheck(DV(P('pa', 'pb')), UI({ custom: true, texts: { pa: '70', pb: '20' } }), true); ok(!d.ok, '★ 임시저장도 직접 비율이 틀리면 막는다(형식이 틀린 값은 저장하지 않음 — 기존 임시저장 규칙과 같다)'); }
{ const ok1 = partsSubmitCheck(DV(P('pa', 'pb')), UI({ custom: true, texts: { pa: '70', pb: '30' } }), false); ok(ok1.ok && ok1.error === '', '모두 맞으면 통과'); ok(partsSubmitCheck(DV(P('common')), UI(), false).ok && partsSubmitCheck(DV(P('pa')), UI(), false).ok, '공통·프로젝트 하나는 통과'); }
ok(partsSaveError({ message: '40일이 지난 날짜는 관리자만 정정할 수 있습니다.' }).includes('40일') && partsSaveError(null).length > 0 && partsSaveError({}).length > 0 && partsSaveError(new Error('')).length > 0 && /참여/.test(partsSaveError(null)), '★ 저장 실패 문구: 서버가 준 메시지가 있으면 그대로, 없으면(null·빈 메시지) "참여 기록" 기본 문구');
for (const bad of [null, undefined, 'x', 3, []]) { let r; try { r = partsFinal(bad, bad); } catch (e) { r = { threw: e.message }; } ok(r && !r.threw && r.ok === false, '이상한 입력(' + J(bad) + ')은 던지지 않고 거절'); }
console.log('── 스위치(edoc_settings/parts) — 규칙 게시·함수 배포가 끝나기 전에는 꺼 둔다');
ok(partsEnabled({ enabled: true }) === true && partsEnabled({ enabled: true, updatedAt: 1 }) === true, '★ { enabled: true } 만 켜짐이다');
ok(partsEnabled(null) === false && partsEnabled(undefined) === false && partsEnabled({}) === false && partsEnabled({ enabled: false }) === false && partsEnabled({ enabled: 'true' }) === false && partsEnabled({ enabled: 1 }) === false && partsEnabled('x') === false && partsEnabled([]) === false && partsEnabled({ enabled: null }) === false, '★ 문서가 없거나 비었거나 enabled 가 참이 아니면(글자 "true"·숫자 1 포함) 꺼짐이다 — 기본 꺼짐');
console.log('── 업무일지 위쪽 "공통"(내근·프로젝트 무관한 날) — 운행일지·지출결의서와 같은 방식');
{ const f = (fieldsFor('daily') || []).find((x) => x.key === 'pjtId'); ok(f && f.allowCommon === true && f.required === true && /공통/.test(f.hint || ''), '★ 업무일지의 프로젝트 필드에 "공통"이 있고(allowCommon) 여전히 필수이며 안내문에 "공통"이 있다'); }
{ const me = { uid: 'u1', name: '김' }; const base = Object.assign(defaultValues('daily', me, new Date('2026-10-16T03:00:00Z')), { todayWork: '작업' }); const proj = [{ id: 'pa', name: 'A', code: 'C1' }];
  ok(!validate('daily', Object.assign({}, base, { pjtId: 'common' }), { projects: proj }).pjtId, '★ 업무일지에서 "공통"은 검증을 통과한다(진행 중 프로젝트 목록에 없어도)');
  ok(!!validate('daily', Object.assign({}, base, { pjtId: 'zzz' }), { projects: proj }).pjtId && !validate('daily', Object.assign({}, base, { pjtId: 'pa' }), { projects: proj }).pjtId, '★ 목록에 없는 프로젝트 id(zzz)는 여전히 거절하고 목록에 있는 것은 통과한다 — "공통" 허용이 검증을 느슨하게 만들지 않는다');
  ok(!!validate('daily', Object.assign({}, base, { pjtId: '' }), { projects: proj }).pjtId, '프로젝트를 비우면 여전히 필수 오류다');
  const d = buildDocData('daily', Object.assign({}, base, { pjtId: 'common' }), me, { projects: proj, now: new Date('2026-10-16T03:00:00Z') });
  ok(d.pjtId === 'common' && d.pjtCode === '공통' && d.pjtName === '프로젝트 무관(본사 경비)', '★ 공통 업무일지의 문서 본문은 지출결의서와 같다 — pjtId common · pjtCode 공통 · pjtName 프로젝트 무관(본사 경비) (실제: ' + [d.pjtId, d.pjtCode, d.pjtName].join(' / ') + ')');
  ok(d.title.startsWith('(공통) ') && d.title.endsWith(' 업무일지') && !d.title.includes('()'), '★ 제목은 "(공통) 261016 김 업무일지"이고 빈 괄호가 없다 (실제: ' + d.title + ')');
  const d2 = buildDocData('daily', Object.assign({}, base, { pjtId: 'pa' }), me, { projects: proj, now: new Date('2026-10-16T03:00:00Z') }); ok(d2.pjtCode === 'C1' && d2.pjtName === 'A' && d2.title.startsWith('(C1) '), '일반 프로젝트는 그대로다 — 코드 C1·이름 A·제목 "(C1) …"');
  ok(!('parts' in d) && !('parts' in d2), '공통이어도 참여 칩은 문서 본문에 들어가지 않는다'); }
console.log('── 칩을 바꾼 뒤 위쪽 대표 프로젝트 맞춤(mainAfterToggle)');
ok(mainAfterToggle([], 'pa') === 'pa' && mainAfterToggle(null, 'pa') === 'pa' && mainAfterToggle(undefined, '') === '', '★ 칩이 비어 있으면 대표 프로젝트는 그대로다');
ok(mainAfterToggle(P('pa'), 'pa') === 'pa' && mainAfterToggle(P('pa', 'pb'), 'pa') === 'pa' && mainAfterToggle(P('pb', 'pa'), 'pa') === 'pa', '★ 대표 프로젝트가 칩 안에 있으면 칩이 여럿이어도 그대로다(사용자가 정한 대표 유지)');
ok(mainAfterToggle(P('pb'), 'pa') === 'pb' && mainAfterToggle(P('pb', 'pc'), 'pa') === 'pb', '★ 대표가 칩에서 빠지면 첫 칩으로 바뀐다(둘이 어긋나지 않게) — 칩이 하나면 그 칩');
ok(mainAfterToggle(P('common'), 'pa') === 'common' && mainAfterToggle(P('pa'), 'common') === 'pa' && mainAfterToggle(P('common'), 'common') === 'common', '★ "공통"을 켜면 대표도 공통, 공통이던 대표는 다른 칩을 켜면 그 칩으로 바뀐다');
ok(mainAfterToggle(P('pa'), '') === 'pa' && mainAfterToggle(P('pa', 'pb'), '') === 'pa', '대표가 아직 비어 있으면 첫 칩을 대표로 삼는다');
for (const bad of [[null, 'pa'], ['x', 'pa'], [3, null], [[null, 3, {}], 'pa'], [[{ pjt: '' }], 'pa']]) { let r; try { r = mainAfterToggle(bad[0], bad[1]); } catch (e) { r = { threw: e.message }; } ok(typeof r === 'string', '이상한 입력(' + JSON.stringify(bad) + ')은 던지지 않고 글자를 돌려준다'); }
ok(mainAfterToggle(P(' pb '), 'pa') === 'pb', '칩 id 앞뒤 공백은 정리한다');
{ const a = P('pa', 'pb'); const s0 = JSON.stringify(a); mainAfterToggle(a, 'pc'); ok(JSON.stringify(a) === s0, '입력 칩 목록을 바꾸지 않는다'); }
ok(pass + fail >= 82, '시험이 끝까지 실행됨');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
