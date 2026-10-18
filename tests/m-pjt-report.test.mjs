import { pjtIdOf, reportDoc, newForm, formFor, applyInputs, docToSave, toggleEquip, REPORT_FMT, fromStored, toStored } from '../m/pjt-report.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' — 실제 ' + JSON.stringify(a) + ' / 기대 ' + JSON.stringify(b)));

const ME = { name: '윤석원', rank: '과장' };
const NOW = '2026-10-18T05:00:00.000Z';

// ── 저장 위치: PC 와 같은 어댑터(모바일이 따로 정하지 않는다)
eq(pjtIdOf('reg_abc123'), 'abc123', '경량 프로젝트 키 reg_<id> → 서버 프로젝트 id');
eq(pjtIdOf('p4ph2'), 'p4ph2', '고정 프로젝트 키는 그대로');
eq(reportDoc('p4ph2', '2026-10-18'), ['pjt_registry/p4ph2/reports', '2026-10-18'], '★ 일보 저장 위치 = pjt_registry/<프로젝트>/reports/<날짜> (PC 와 같음)');
eq(reportDoc('reg_X1', '2026-10-18'), ['pjt_registry/X1/reports', '2026-10-18'], '경량 프로젝트도 같은 구조');
ok(reportDoc('p4ph2', '2026-13-45x') === null && reportDoc('p4ph2', '') === null && reportDoc('', '2026-10-18') === null && reportDoc('a/b', '2026-10-18') === null, '★ 잘못된 날짜·빈 프로젝트·경로를 깨는 키는 위치를 주지 않음(쓰지 않는다)');

// ── 새 일보: PC 의 loadDay 와 같은 미리 채우기
const att = { headcount: 8, manday: 1, mandayTotal: 8 };
const nf = newForm(ME, att, null, {});
ok(nf.legacy === false && nf.author === '윤석원 과장' && nf.headcount === 8 && nf.manday === 1 && nf.mandayTotal === 8 && Array.isArray(nf.equip) && nf.equip.length === 0 && JSON.stringify(nf.eqNo) === '{}' && JSON.stringify(nf.eqHrs) === '{}' && nf.content === '' && nf.note === '', '★ 저장된 일보가 없으면 작성자는 로그인 계정, 인원·공수는 출역·공수로 미리 채움, 장비·시간은 비어 있음');
ok(formFor(null, ME, att, null, {}).author === '윤석원 과장', '저장된 일보가 없으면 새 폼');
const stored = { fmt: 2, dateKey: '2026-10-18', date: '2026-10-18', site: 'P4 Ph2', author: '김작성 대리', checkIn: '07:00', checkOut: '17:00', shift: '주간', content: '반입', tomorrow: '타공', headcount: 5, manday: 1, mandayTotal: 5, equip: '지게차 (12가3456) 4시간, 크레인 2.5시간', note: '', editors: [] };
const sf = formFor(stored, ME, att, null, {}); ok(sf.author === '김작성 대리' && sf.headcount === 5 && sf.eqNo.지게차 === '12가3456' && sf.eqHrs.지게차 === '4' && sf.eqHrs.크레인 === '2.5', '★ 저장된 일보가 있으면 그대로(미리 채우기로 덮지 않음) — 작성자는 쓴 사람 그대로, 장비 번호·시간 복원');
ok(formFor(Object.assign({}, stored, { author: '' }), ME, att, null, {}).author === '윤석원 과장', '저장된 일보의 작성자가 비어 있으면 로그인 계정으로');

// ── ★ PC 와 모바일이 같은 입력에서 같은 저장 문서를 만든다(PC 의 readForm→toStored 흐름과 비교)
{ const inputs = { author: '윤석원 과장', content: '#13 코어 FCU 5EA 하역', tomorrow: '선마킹', note: '특이 없음', headcount: '8', manday: '1', ciH: '19', ciM: '00', coH: '05', coM: '00', eqNo: { 지게차: '12가3456' }, eqHrs: { 지게차: '4', 크레인: '2.5' } };
  let m = toggleEquip(toggleEquip(newForm(ME, att, null, {}), '지게차'), '크레인'); const mob = docToSave(applyInputs(m, inputs), { dateKey: '2026-10-18', site: 'P4 Ph2' }, false, ME, NOW);
  // PC 흐름: 모델에 입력을 직접 담고(readForm) toStored — 같은 입력
  const pcModel = { legacy: false, author: '윤석원 과장', checkIn: '19:00', checkOut: '05:00', shift: '', content: '#13 코어 FCU 5EA 하역', tomorrow: '선마킹', headcount: 8, manday: 1, mandayTotal: 8, equip: ['지게차', '크레인'], eqNo: { 지게차: '12가3456' }, eqHrs: { 지게차: '4', 크레인: '2.5' }, note: '특이 없음', editors: [] };
  const pc = toStored(pcModel, { dateKey: '2026-10-18', site: 'P4 Ph2' });
  eq(mob, pc, '★ 같은 입력이면 모바일이 만드는 저장 문서가 PC 와 글자 하나 다르지 않음'); ok(mob.fmt === REPORT_FMT && mob.equip === '지게차 (12가3456) 4시간, 크레인 2.5시간' && mob.checkIn === '19:00' && mob.checkOut === '05:00' && mob.mandayTotal === 8, '저장 문서: fmt 2·장비에 번호와 사용 시간·근무시간·공수 합계'); }

// ── 장비: 지게차·크레인 켜기/끄기, 끄면 번호·시간도 비움, 다른 장비는 안 켜짐
{ let f = newForm(ME, att, null, {}); f = toggleEquip(f, '지게차'); ok(f.equip.join() === '지게차', '지게차 켜기'); f = applyInputs(f, { eqNo: { 지게차: '12가3456' }, eqHrs: { 지게차: '4' } }); f = toggleEquip(f, '크레인'); ok(f.equip.join() === '지게차,크레인', '크레인도 함께 켤 수 있음(둘 다)');
  f = toggleEquip(f, '지게차'); ok(f.equip.join() === '크레인' && f.eqNo.지게차 === undefined && f.eqHrs.지게차 === undefined, '★ 끄면 그 장비의 차량번호·사용 시간도 지워져 다시 켜도 옛 값이 되살아나지 않음');
  ok(toggleEquip(f, '스카이').equip.join() === '크레인', '지게차·크레인이 아닌 이름은 무시(원본 그대로)'); ok(!toggleEquip(newForm(ME, att, null, {}), '지게차').equip.includes('크레인'), '다른 장비를 건드리지 않음'); }

// ── 장비 사용 시간(대표님 요청): 입력 → 저장 → 다시 열기 → 저장 왕복
{ let f = toggleEquip(newForm(ME, att, null, {}), '지게차'); f = applyInputs(f, { eqNo: { 지게차: '12가3456' }, eqHrs: { 지게차: '4' } });
  const d1 = docToSave(f, { dateKey: '2026-10-18', site: 'P' }, false, ME, NOW); ok(d1.equip === '지게차 (12가3456) 4시간', '★ 모바일에서 입력한 사용 시간이 "지게차 (12가3456) 4시간" 으로 저장됨');
  const back = formFor(d1, ME, att, null, {}); ok(back.eqHrs.지게차 === '4' && back.eqNo.지게차 === '12가3456', '★ 다시 열면 시간·번호가 칸에 복원됨'); const d2 = docToSave(back, { dateKey: '2026-10-18', site: 'P' }, true, ME, NOW); ok(d2.equip === d1.equip, '다시 저장해도 같은 글자(안정적)');
  const bad = docToSave(applyInputs(toggleEquip(newForm(ME, att, null, {}), '지게차'), { eqHrs: { 지게차: '0' } }), { dateKey: '2026-10-18' }, false, ME, NOW); ok(bad.equip === '지게차', '시간 0 은 붙지 않음("0시간"이 저장되지 않음)');
  const neg = docToSave(applyInputs(toggleEquip(newForm(ME, att, null, {}), '지게차'), { eqHrs: { 지게차: '-3' } }), { dateKey: '2026-10-18' }, false, ME, NOW); ok(neg.equip === '지게차', '음수는 붙지 않음(부호가 지워져 양수가 되지 않음)'); }

// ── 수정자 기록: 이미 있는 일보를 최초 작성자가 아닌 사람이 고치면 기록(PC 와 같은 withEditor)
{ const f = formFor(stored, ME, att, null, {}); const d = docToSave(f, { dateKey: '2026-10-18', site: 'P4 Ph2' }, true, ME, NOW); ok(d.editors.length === 1 && d.editors[0].by === '윤석원 과장' && d.author === '김작성 대리', '★ 다른 사람이 고치면 수정자로 기록되고 작성자는 최초 작성자 그대로');
  const same = docToSave(formFor(Object.assign({}, stored, { author: '윤석원 과장' }), ME, att, null, {}), { dateKey: '2026-10-18' }, true, ME, NOW); ok(same.editors.length === 0, '작성자 본인이 고치면 수정자 기록 없음'); const fresh = docToSave(newForm(ME, att, null, {}), { dateKey: '2026-10-18' }, false, ME, NOW); ok(fresh.editors.length === 0, '새 일보는 수정자 기록 없음'); }

// ── 옛 형식 일보는 고치지 않는다(조회만, "새 양식으로 편집"을 눌러야 고칠 수 있음 — PC 와 같음)
{ const old = { dateKey: '2026-06-15', date: '2026년 06월 15일 월요일', site: 'P4 Ph2(FAB)', author: '윤석원 과장', count: '7', equip: '—', today: '반입', tomorrow: '타공', remarks: '교육' }; const lf = formFor(old, ME, att, null, {});
  ok(lf.legacy === true && lf.content === '반입' && lf.note === '교육' && lf.headcount === 7, '옛 형식 일보는 옛 형식으로 인식되고 화면 모델로 환산됨'); const after = applyInputs(lf, { content: '바꿈', headcount: '99' }); ok(after.content === '반입' && after.headcount === 7, '★ 옛 형식 일보는 입력값을 받아도 바뀌지 않음(실수로 옛 일보가 덮이지 않음)'); }

// ── 입력 정리: 근무시간 시·분, 빈 값, 잘못된 값
{ let f = newForm(ME, att, null, {}); f = applyInputs(f, { ciH: '07', ciM: '00', coH: '17', coM: '' }); ok(f.checkIn === '07:00' && f.checkOut === '17:00', '시만 있으면 :00 을 붙임'); f = applyInputs(f, { ciH: '', ciM: '', coH: '', coM: '' }); ok(f.checkIn === '' && f.checkOut === '', '시·분을 비우면 근무시간 없음');
  f = applyInputs(f, { headcount: 'abc', manday: 'x' }); ok(f.headcount === 0 && f.manday === 0 && f.mandayTotal === 0, '숫자가 아닌 인원·공수는 0');
  f = applyInputs(f, { headcount: '8', manday: '0.5' }); ok(f.mandayTotal === 4, '공수 합계 = 인원 × 1인당 공수(자동 계산)'); const g = applyInputs(f, {}); ok(g.content === f.content && g.headcount === 8, '입력이 없는 칸은 그대로(부분 갱신)'); const orig = newForm(ME, att, null, {}); applyInputs(orig, { content: 'x' }); ok(orig.content === '', '원본 모델을 바꾸지 않음(새 모델을 돌려줌)'); }

console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); if (fail) process.exit(1);
