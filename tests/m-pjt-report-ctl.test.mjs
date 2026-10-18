import { createMobileReport, bodyHtml, formHtml, legacyHtml, dateBarHtml, CSS } from '../m/pjt-report.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));
const later = (ms) => new Promise((r) => setTimeout(r, ms));
const ME = { name: '윤석원', rank: '과장' };

// ── 가짜 환경: 서버 읽기·쓰기(io)를 주입한다
function mk(over) {
  const calls = { read: [], save: [], sync: [] }; const o = over || {};
  const days = o.days || {};   // 날짜 → { stored, att, ... }
  const io = {
    readDay: async (site, date) => { calls.read.push(date); if (o.readDelay && o.readDelay[date]) await later(o.readDelay[date]); if (o.readFail === date) throw Object.assign(new Error('x'), { code: 'permission-denied' }); return Object.assign({ stored: null, att: { checks: ['w1', 'w2', 'w3'], md: { w1: 1, w2: 1, w3: 1 } }, active: ['w1', 'w2', 'w3'], newChecks: {}, structure: null }, days[date] || {}); },
    save: async (site, date, doc) => { calls.save.push({ site, date, doc }); if (o.saveFail) throw Object.assign(new Error('저장'), { code: 'unavailable' }); },
    syncDaily: async (site, date, doc, label) => { calls.sync.push({ site, date, doc, label }); if (o.syncFail) throw new Error('연동 실패'); return o.syncRes || { ok: true, created: true, status: 'draft' }; }
  };
  const env = { calls, renders: 0, today: '2026-10-18' };
  const ctl = createMobileReport({ me: () => ME, today: () => env.today, rerender: () => { env.renders++; }, isGuest: !!o.guest, io, labelOf: (k) => (k === 'p4ph2' ? 'P4 Ph2 (FAB)' : '현장'), now: () => '2026-10-18T05:00:00.000Z' });
  env.ctl = ctl; return env;
}

// ── 화면 문자열
{ const f = { legacy: false, author: '윤석원 과장', checkIn: '07:00', checkOut: '17:00', content: '반입', tomorrow: '', headcount: 8, manday: 1, mandayTotal: 8, equip: ['지게차'], eqNo: { 지게차: '12가3456' }, eqHrs: { 지게차: '4' }, note: '', editors: [] };
  const h = formHtml(f, {}); ok(h.includes('data-rp-in="eqhrs"') && h.includes('data-n="지게차"') && /value="4"/.test(h) && h.includes('value="12가3456"') && h.includes('사용 시간(시간)'), '★ 지게차를 켜면 차량번호 칸과 사용 시간(시간) 칸이 나오고 저장된 값이 들어 있음');
  ok(!formHtml(Object.assign({}, f, { equip: [] }), {}).includes('data-rp-in="eqhrs"'), '장비를 안 켜면 시간 칸이 없음'); ok(formHtml(Object.assign({}, f, { equip: ['지게차', '크레인'] }), {}).split('data-rp-in="eqhrs"').length === 3, '지게차·크레인 둘 다 켜면 시간 칸이 두 개(장비마다)');
  ok(/value="윤석원 과장" readonly/.test(h), '작성자 칸은 읽기 전용(로그인 계정)'); ok(/data-rp="shift" data-n="주간"/.test(h) && /rpchip on" data-rp="shift" data-n="주간"/.test(h), '근무시간 07:00~17:00 이면 주간 칩이 켜짐'); ok(h.includes('data-rp="save"') && !/disabled/.test(h), '저장 버튼(처리 중이 아니면 눌림)');
  ok(/disabled/.test(formHtml(f, { busy: true })) && /id="rp-save" data-rp="save" disabled/.test(formHtml(f, { busy: true })), '저장 중에는 입력·저장이 잠김(중복 저장 방지)');
  const evil = formHtml(Object.assign({}, f, { content: '<script>alert(1)</script>', note: '"><img src=x onerror=1>', eqNo: { 지게차: '"><b>x' }, author: '<i>a</i>' }), {}); ok(!/<script>alert|<img src=x|<b>x|<i>a<\/i>/.test(evil) && evil.includes('&lt;script&gt;'), '★ 입력한 글자의 꺾쇠·따옴표는 글자로만 표시(HTML 로 해석되지 않음)');
  ok(dateBarHtml('2026-10-18').includes('2026. 10. 18 (일)') && /data-rp="prev"/.test(dateBarHtml('2026-10-18')) && /data-rp="today"/.test(dateBarHtml('2026-10-18')), '날짜 막대: 날짜·전날·다음날·오늘');
  const lg = legacyHtml({ legacy: true, author: '윤석원 과장', headcount: 7, equipText: '—', content: '반입', tomorrow: '타공', note: '교육' }); ok(lg.includes('새 양식으로 편집') && !lg.includes('<textarea') && !lg.includes('data-rp="save"'), '★ 옛 양식은 읽기 전용(입력칸·저장 버튼 없음) + "새 양식으로 편집"만'); ok(typeof CSS === 'string' && CSS.includes('.rpcard') && CSS.includes('.rpeq'), '스타일 문자열이 있음'); }

// ── 통제기: 불러오기
{ const e = mk({}); const h0 = e.ctl.html('p4ph2'); ok(h0.includes('불러오는 중') && e.calls.read[0] === '2026-10-18', '처음 열면 오늘 날짜를 불러오기 시작(불러오는 중...)'); await tick(); await tick(); const f = e.ctl.state.form;
  ok(f && f.author === '윤석원 과장' && f.headcount === 3 && f.manday === 1 && f.mandayTotal === 3 && !e.ctl.state.exists, '★ 저장된 일보가 없으면 작성자는 로그인 계정, 인원·공수는 출역·공수로 미리 채움'); const h1 = e.ctl.html('p4ph2'); ok(h1.includes('작성 전') && h1.includes('공정 체크·출역으로 미리 채웠습니다') && h1.includes('data-rp="save"'), '작성 전 배지 + 작성 폼'); ok(e.calls.read.length === 1, '같은 날짜를 화면을 다시 그릴 때마다 서버에서 다시 읽지 않음'); }
{ const stored = { fmt: 2, dateKey: '2026-10-17', author: '김작성 대리', checkIn: '07:00', checkOut: '17:00', content: '어제 일', tomorrow: '', headcount: 5, manday: 1, mandayTotal: 5, equip: '지게차 (12가3456) 4시간', note: '', editors: [] };
  const e = mk({ days: { '2026-10-17': { stored } } }); e.ctl.html('p4ph2'); await tick(); await tick(); await e.ctl.click({ rp: 'prev' }); await tick(); await tick(); const h = e.ctl.html('p4ph2');
  ok(e.ctl.state.date === '2026-10-17' && e.ctl.state.exists && h.includes('작성됨') && h.includes('어제 일') && h.includes('김작성 대리'), '★ 전날로 이동하면 그날 저장된 일보가 그대로 나옴(미리 채우기로 덮지 않음)'); ok(e.ctl.state.form.eqHrs.지게차 === '4' && h.includes('value="4"'), '저장된 장비 사용 시간이 칸에 복원됨');
  await e.ctl.click({ rp: 'next' }); await tick(); await tick(); ok(e.ctl.state.date === '2026-10-18', '다음날로 이동'); await e.ctl.click({ rp: 'prev' }); await e.ctl.click({ rp: 'prev' }); await tick(); await tick(); ok(e.ctl.state.date === '2026-10-16', '두 번 누르면 이틀 전'); await e.ctl.click({ rp: 'today' }); await tick(); await tick(); ok(e.ctl.state.date === '2026-10-18', '오늘 버튼'); }
{ const e = mk({}); e.env = e; e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.state.date = '2026-02-28'; await e.ctl.click({ rp: 'next' }); await tick(); ok(e.ctl.state.date === '2026-03-01', '2월 28일 다음은 3월 1일(달 넘김)'); e.ctl.state.date = '2026-12-31'; await e.ctl.click({ rp: 'next' }); await tick(); ok(e.ctl.state.date === '2027-01-01', '12월 31일 다음은 다음 해 1월 1일'); }

// ── ★ 날짜를 빠르게 바꿔도 늦게 도착한 이전 날짜 응답이 화면을 덮지 않는다
{ const e = mk({ readDelay: { '2026-10-17': 60, '2026-10-16': 5 }, days: { '2026-10-17': { stored: { fmt: 2, dateKey: '2026-10-17', author: 'A', content: '17일 내용', headcount: 1, manday: 1, equip: '' } }, '2026-10-16': { stored: { fmt: 2, dateKey: '2026-10-16', author: 'B', content: '16일 내용', headcount: 2, manday: 1, equip: '' } } } });
  e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.click({ rp: 'prev' }); await later(5); e.ctl.click({ rp: 'prev' }); await later(120);
  ok(e.ctl.state.date === '2026-10-16' && e.ctl.state.form.content === '16일 내용', '★ 17일을 불러오는 중에 16일로 넘어가면, 나중에 도착한 17일 응답이 16일 화면을 덮지 않음(요청 번호) — 화면의 날짜와 내용이 항상 같다'); }
{ const e = mk({ readFail: '2026-10-17' }); e.ctl.html('p4ph2'); await tick(); await tick(); await e.ctl.click({ rp: 'prev' }); await tick(); await tick(); const h = e.ctl.html('p4ph2'); ok(h.includes('불러오지 못했습니다') && h.includes('permission-denied') && h.includes('data-rp="retry"'), '불러오기 실패는 사유와 "다시 시도"를 보여 줌'); }

// ── 입력: 모델에 반영, 화면을 다시 그리지 않음(키보드가 사라지지 않게)
{ const e = mk({}); e.ctl.html('p4ph2'); await tick(); await tick(); const r0 = e.renders;
  e.ctl.onInput('content', '#13 코어 하역'); e.ctl.onInput('headcount', '8'); e.ctl.onInput('manday', '0.5'); e.ctl.onInput('note', '특이'); const st = e.ctl.state.form;
  ok(st.content === '#13 코어 하역' && st.headcount === 8 && st.manday === 0.5 && st.mandayTotal === 4 && st.note === '특이', '★ 입력이 모델에 반영되고 공수 합계가 자동 계산됨'); ok(e.renders === r0, '★ 글자를 입력하는 동안은 화면을 다시 그리지 않음(타이핑 중 키보드·커서가 사라지지 않게)');
  await e.ctl.click({ rp: 'eq', n: '지게차' }); e.ctl.onInput('eqno', '12가3456', '지게차'); e.ctl.onInput('eqhrs', '4', '지게차'); ok(st !== e.ctl.state.form || true, ''); const f2 = e.ctl.state.form; ok(f2.equip.join() === '지게차' && f2.eqNo.지게차 === '12가3456' && f2.eqHrs.지게차 === '4', '장비 칩을 켜고 차량번호·사용 시간을 입력');
  await e.ctl.click({ rp: 'shift', n: '주간' }); ok(e.ctl.state.form.checkIn === '07:00' && e.ctl.state.form.checkOut === '17:00', '근무 구분 "주간"을 누르면 07:00~17:00 이 채워짐'); e.ctl.onInput('coM', '30'); ok(e.ctl.state.form.checkOut.endsWith(':30'), '분을 바꾸면 반영'); }

// ── ★ 저장: 올바른 문서, 장비 사용 시간, 업무일지 연동
{ const e = mk({}); e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.onInput('content', '#13 코어 FCU 5EA 하역'); e.ctl.onInput('headcount', '8'); e.ctl.onInput('manday', '1'); await e.ctl.click({ rp: 'eq', n: '지게차' }); e.ctl.onInput('eqno', '12가3456', '지게차'); e.ctl.onInput('eqhrs', '4', '지게차'); await e.ctl.click({ rp: 'shift', n: '야간' });
  await e.ctl.click({ rp: 'save' }); await tick(); await tick(); const c = e.calls.save[0];
  ok(e.calls.save.length === 1 && c.site === 'p4ph2' && c.date === '2026-10-18', '★ 저장은 그 프로젝트·그 날짜로 한 번'); ok(c.doc.fmt === 2 && c.doc.dateKey === '2026-10-18' && c.doc.site === 'P4 Ph2 (FAB)' && c.doc.author === '윤석원 과장' && c.doc.equip === '지게차 (12가3456) 4시간' && c.doc.headcount === 8 && c.doc.mandayTotal === 8 && c.doc.checkIn === '19:00', '★ 저장 문서: 작성자·현장명·근무시간·인원·공수 합계·장비에 번호와 사용 시간');
  ok(e.calls.sync.length === 1 && e.calls.sync[0].label === 'P4 Ph2 (FAB) 공사일보 (2026. 10. 18 (일))' && e.calls.sync[0].doc.content === '#13 코어 FCU 5EA 하역', '★ 저장하면 전자결재 업무일지 연동도 호출(PC 와 같은 제목)'); ok(e.ctl.state.exists && /저장했습니다/.test(e.ctl.state.msg) && e.ctl.html('p4ph2').includes('작성됨'), '저장 뒤 "작성됨" 으로 바뀌고 안내가 뜸');
  await e.ctl.click({ rp: 'save' }); await tick(); await tick(); ok(e.calls.save.length === 2 && e.calls.save[1].doc.editors.length === 0, '본인이 다시 저장해도 수정자 기록 없음'); }
{ const e = mk({ syncFail: true }); e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.onInput('content', '작업'); await e.ctl.click({ rp: 'save' }); await tick(); await tick(); ok(e.calls.save.length === 1 && e.ctl.state.exists && /저장했습니다/.test(e.ctl.state.msg), '★ 업무일지 연동이 실패해도 일보 저장은 그대로 됨(막지 않고 안내만)'); }
{ const e = mk({}); e.ctl.html('p4ph2'); await tick(); await tick(); await e.ctl.click({ rp: 'save' }); await tick(); await tick(); ok(e.calls.save.length === 1 && e.calls.sync.length === 0, '금일 작업이 비어 있으면 일보는 저장하되 업무일지는 만들지 않음(PC 와 같음)'); }
{ const e = mk({ saveFail: true }); e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.onInput('content', '작업'); await e.ctl.click({ rp: 'save' }); await tick(); await tick(); ok(!e.ctl.state.exists && /저장 실패/.test(e.ctl.state.msg) && e.calls.sync.length === 0, '★ 저장이 실패하면 "작성됨" 으로 바뀌지 않고 실패 안내 + 업무일지도 만들지 않음'); }
{ const e = mk({}); e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.onInput('content', '작업'); const p1 = e.ctl.click({ rp: 'save' }); const p2 = e.ctl.click({ rp: 'save' }); await p1; await p2; await tick(); ok(e.calls.save.length === 1, '★ 저장 버튼을 연달아 눌러도 한 번만 저장(중복 저장 방지)'); }
{ const stored = { fmt: 2, dateKey: '2026-10-17', author: '김작성 대리', content: '어제', headcount: 5, manday: 1, equip: '' }; const e = mk({ days: { '2026-10-17': { stored } } }); e.ctl.html('p4ph2'); await tick(); await tick(); await e.ctl.click({ rp: 'prev' }); await tick(); await tick(); e.ctl.onInput('note', '추가 메모'); await e.ctl.click({ rp: 'save' }); await tick(); await tick(); const d = e.calls.save[0].doc; ok(d.author === '김작성 대리' && d.editors.length === 1 && d.editors[0].by === '윤석원 과장', '★ 다른 사람이 쓴 일보를 고치면 작성자는 그대로, 수정자로 기록(PC 와 같음)'); }

// ── 옛 양식 일보: 읽기 전용, 새 양식으로 편집
{ const old = { dateKey: '2026-10-17', date: '2026년 10월 17일', site: 'P4 Ph2', author: '윤석원 과장', count: '7', equip: '지게차 (12가3456)', today: '옛 금일', tomorrow: '옛 명일', remarks: '옛 특이' }; const e = mk({ days: { '2026-10-17': { stored: old } } }); e.ctl.html('p4ph2'); await tick(); await tick(); await e.ctl.click({ rp: 'prev' }); await tick(); await tick(); const h = e.ctl.html('p4ph2');
  ok(h.includes('옛 양식 · 조회') && h.includes('옛 금일') && h.includes('옛 특이') && h.includes('새 양식으로 편집') && !h.includes('<textarea'), '★ 옛 양식 일보는 "옛 양식 · 조회" 로 읽기 전용'); e.ctl.onInput('content', '바꿈'); await e.ctl.click({ rp: 'save' }); await tick(); ok(e.calls.save.length === 0 && e.ctl.state.form.content === '옛 금일', '★ 옛 양식 일보는 입력·저장이 막혀 옛 일보가 실수로 덮이지 않음');
  await e.ctl.click({ rp: 'edit' }); ok(e.ctl.state.form.legacy === false && e.ctl.state.form.content === '옛 금일' && e.ctl.html('p4ph2').includes('<textarea'), '"새 양식으로 편집" 을 누르면 내용은 그대로 두고 입력칸이 열림'); }

// ── 손님 계정·잘못된 입력
{ const e = mk({ guest: true }); ok(e.ctl.html('p4ph2').includes('GUEST') && e.calls.read.length === 0, '★ 손님(GUEST) 계정은 읽지도 않고 안내만'); await e.ctl.click({ rp: 'save' }); ok(e.calls.save.length === 0, '손님은 저장 불가'); }
{ const e = mk({}); e.ctl.html('p4ph2'); await tick(); await tick(); e.ctl.state.date = '2026-13-45'; e.ctl.onInput('content', '작업'); await e.ctl.click({ rp: 'save' }); ok(e.calls.save.length === 0 && /올바르지 않아/.test(e.ctl.state.msg), '★ 잘못된 날짜로는 저장하지 않고 안내(경로를 깨는 값이 서버로 가지 않음)'); }
{ const e = mk({}); e.ctl.html('p4ph2'); await tick(); await tick(); const r0 = e.calls.read.length; await e.ctl.click({ rp: 'xxx' }); await e.ctl.click(null); await e.ctl.click({}); ok(e.calls.read.length === r0 && e.calls.save.length === 0, '알 수 없는 클릭은 무시(오류·서버 호출 없음)'); const w = { rpClick: null, rpInput: null }; e.ctl.attachGlobals(w); ok(typeof w.rpClick === 'function' && typeof w.rpInput === 'function', 'pjt.html 의 인라인 onclick/oninput 이 부르는 전역 함수 rpClick·rpInput 연결'); }

console.log('\n' + (fail ? '실패 ' + fail + '건 / 통과 ' + pass : '전부 통과 (' + pass + '건)')); if (fail) process.exit(1);
