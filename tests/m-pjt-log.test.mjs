import { createMobileLog, bodyHtml, formHtml, pjtIdOf, CSS } from '../m/pjt-log.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── 가짜 환경: 서버 호출·화면 조작 어댑터·저장소·확인창
const E = (id, pjtId, pjtLabel, title, o) => Object.assign({ id, pjtId, pjtLabel, date: '2026-10-14', category: '발주처 요청·지시', title, source: '메일', dueDate: '2026-10-19', status: 'confirmed', claimedBy: '', claimedByName: '', replyDetected: false, impactChecked: false, restricted: false, createdByName: '팀장', createdByMe: false, createdMs: 1, auto: false, due: { daysLeft: 2, tone: 'soon' } }, o || {});
const A = E('a1', 'p4ph2', 'P4 Ph2 (FAB)', '자재 반입 일정 회신 요청'), B = E('b1', 'X1', '청주 CUB동 A/S', '점검 일정 확인', { dueDate: '2026-10-18', due: { daysLeft: 1, tone: 'soon' } });
function mk(over) {
  const calls = [], ui = { forms: [], hidden: 0, hint: null, count: null, save: null, form: { title: null, dueDate: null }, styles: 0 };
  ui.injectStyles = () => { ui.styles++; }; ui.showForm = (h) => { ui.forms.push(h); }; ui.hideForm = () => { ui.hidden++; }; ui.readForm = () => ui.form; ui.setHint = (t) => { ui.hint = t; }; ui.setCount = (n) => { ui.count = n; }; ui.setSaveEnabled = (b) => { ui.save = b; };
  const store = new Map(); const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  const env = { calls, ui, store, renders: 0, alerts: [], confirms: [], confirmAnswer: true, went: [], t: 1000000, reply: (d) => (d.action === 'listAll' ? { ok: true, projects: [{ id: 'p4ph2', name: 'P4 Ph2 (FAB)' }, { id: 'X1', name: '청주 CUB동 A/S' }], urgent: [B, A], changes: [], entries: [A, B], total: 2, canConfirm: false } : d.action === 'list' ? { ok: true, urgent: [Object.assign({}, A, { pjtId: undefined })], changes: [Object.assign({}, A, { id: 'c1', category: '일정 변경', title: '검사 일정 변경', pjtId: undefined })], entries: [], total: 2, canConfirm: true } : { ok: true, id: 'n1' }) };
  Object.assign(env, over || {});
  const ctl = createMobileLog({ call: async (d) => { calls.push(JSON.parse(JSON.stringify(d))); const r = env.reply(d); if (r instanceof Error) throw r; return r; }, rerender: () => { env.renders++; }, isGuest: !!env.guest, getUid: () => 'u1', siteKeyOf: (id) => (id === 'p4ph2' ? 'p4ph2' : 'reg_' + id), goProject: (k) => env.went.push(k), ui, storage, now: () => env.t, confirm: (m) => { env.confirms.push(m); return env.confirmAnswer; }, alert: (m) => env.alerts.push(m) });
  return Object.assign(env, { ctl });
}
const nCalls = (e, action) => e.calls.filter((c) => c.action === action).length;

// ── 프로젝트 id 변환
ok(pjtIdOf('reg_ABC123') === 'ABC123' && pjtIdOf('p4ph2') === 'p4ph2' && pjtIdOf('p4ph4') === 'p4ph4' && pjtIdOf('') === '' && pjtIdOf(null) === '' && pjtIdOf('reg_') === '', '모바일 사이트 키 → 서버 프로젝트 id(reg_ 접두어만 떼고 고정 프로젝트는 그대로)');

// ── 홈: 렌더 → 불러오기 1회, 완료 뒤 재렌더에서 다시 안 부름(무한 반복 방지)
{
  const e = mk(); const h0 = e.ctl.homeHtml(); await tick(); await tick();
  ok(h0.includes('이력관리') && h0.includes('data-lg="open"') && h0.includes('＋ 기록') && h0.includes('불러오는 중'), '홈: 처음에는 제목·＋ 기록·"불러오는 중"');
  ok(nCalls(e, 'listAll') === 1 && JSON.stringify(e.calls[0]) === JSON.stringify({ action: 'listAll', filter: {} }), '홈: 렌더하면 listAll 을 {action,filter:{}} 로 한 번 부름');
  const h1 = e.ctl.homeHtml(); h1.length; e.ctl.homeHtml(); e.ctl.homeHtml();
  ok(nCalls(e, 'listAll') === 1 && e.renders === 1, '★ 불러온 뒤 다시 그려도(렌더가 불러오기를 시작하는 구조) 서버를 또 부르지 않고 재렌더도 늘지 않음: 호출 ' + nCalls(e, 'listAll') + '·재렌더 ' + e.renders);
  ok(h1.includes('자재 반입 일정 회신 요청') && h1.includes('점검 일정 확인') && h1.indexOf('점검 일정 확인') < h1.indexOf('자재 반입 일정 회신 요청') && h1.includes('기한 임박 요청 2건'), '홈: 두 프로젝트의 항목이 마감 임박순으로 섞여 나옴');
  ok(h1.includes('P4 Ph2 (FAB)') && h1.includes('청주 CUB동 A/S') && h1.includes('data-lg="go" data-p="X1"') && h1.includes('data-lg="go" data-p="p4ph2"'), '홈: 항목마다 프로젝트 이름(누르면 그 프로젝트 이력)');
  ok(h1.includes('>D-2<') && h1.includes('>내일 마감<') && (h1.match(/lgchip warn/g) || []).length === 2, '홈: 기한 칩(D-2·내일 마감, 2일 이내는 모두 주의 색) — PC 와 같은 문구');
  ok(h1.includes('맡은 사람 없음') && (h1.match(/data-a="claim"/g) || []).length === 2, '홈: 맡은 사람이 없으면 표시하고 "내가 맡기" 버튼');
  ok(e.ui.styles >= 1, '스타일은 어댑터로 주입(pjt.html 의 CSS 를 건드리지 않음)');
  // 오래되면(30초) 다시 부름, 그 전에는 안 부름
  e.t += 10000; e.ctl.homeHtml(); await tick(); ok(nCalls(e, 'listAll') === 1, '30초 안에는 다시 불러오지 않음'); e.t += 25000; e.ctl.homeHtml(); await tick(); await tick(); ok(nCalls(e, 'listAll') === 2, '30초가 지나면 홈을 다시 그릴 때 한 번 새로 읽음');
}
// ── 홈: 서버 오류
{
  const e = mk({ reply: () => Object.assign(new Error('이 프로젝트의 이력을 볼 권한이 없습니다.'), { code: 'functions/permission-denied' }) }); e.ctl.homeHtml(); await tick(); await tick();
  const h = e.ctl.homeHtml(); ok(h.includes('banner soft') && h.includes('권한이 없습니다') && h.includes('data-lg="retry"') && !h.includes('banner err') && nCalls(e, 'listAll') === 1, '★ 서버가 안 돼도 홈은 조용한 안내 + 다시 시도(빨간 오류 아님), 자동으로 계속 부르지 않음');
  e.reply = () => ({ ok: true, projects: [], urgent: [], changes: [], entries: [], total: 0, canConfirm: false }); e.ctl.click({ lg: 'retry', scope: 'all' }); await tick(); await tick(); ok(nCalls(e, 'listAll') === 2 && e.ctl.homeHtml().includes('아직 기록이 없습니다'), '다시 시도를 누르면 바로 다시 부르고 성공하면 빈 안내');
}
// ── 손님 계정
{ const e = mk({ guest: true }); ok(e.ctl.homeHtml() === '' && e.ctl.siteHtml('p4ph2') === '' && e.calls.length === 0, '손님 계정은 이력을 그리지 않고 서버도 부르지 않음'); await e.ctl.click({ lg: 'open', p: '' }); ok(e.alerts.length === 1 && e.alerts[0].includes('GUEST') && e.ui.forms.length === 0, '손님이 ＋ 기록을 눌러도 폼이 열리지 않고 안내만'); }

// ── 프로젝트 탭: list 호출·기한 임박/변경사항/최근, 항목에 프로젝트 id 가 없어도 버튼은 그 프로젝트로
{
  const e = mk(); const h0 = e.ctl.siteHtml('p4ph2'); await tick(); await tick(); const h = e.ctl.siteHtml('p4ph2');
  ok(h0.includes('불러오는 중') && nCalls(e, 'list') === 1 && JSON.stringify(e.calls[0]) === JSON.stringify({ action: 'list', pjtId: 'p4ph2', filter: {} }) && e.renders === 1, '탭: 렌더하면 list 를 {pjtId} 로 한 번, 다시 그려도 늘지 않음');
  ok(h.indexOf('기한 임박 요청') < h.indexOf('변경사항') && h.indexOf('변경사항') < h.indexOf('최근 이력') && h.includes('검사 일정 변경') && h.includes('data-lg="open" data-p="p4ph2"'), '탭: 기한 임박 → 변경사항 → 최근 이력 순서, ＋ 기록은 그 프로젝트로');
  ok(!h.includes('data-lg="go"') && (h.match(/data-id="a1" data-p="p4ph2"/g) || []).length >= 1, '탭: 프로젝트 이름 칩은 없고, 항목에 프로젝트 id 가 없어도 버튼이 탭의 프로젝트(p4ph2)를 가리킴');
  ok(nCalls(e, 'list') === 1 && (h.match(/lgrow/g) || []).length === 2 && h.split('자재 반입 일정 회신 요청').length === 2, '탭: 같은 항목이 기한 임박과 최근 이력에 두 번 나오지 않음');
  e.ctl.siteHtml('X1'); await tick(); ok(nCalls(e, 'list') === 2 && e.calls[1].pjtId === 'X1', '다른 프로젝트 탭은 따로 불러옴');
}

// ── 행 버튼 → 서버 요청(그 항목의 프로젝트로)
{
  const e = mk(); e.ctl.homeHtml(); await tick(); await tick(); e.calls.length = 0;
  await e.ctl.click({ lg: 'act', a: 'claim', id: 'b1', p: 'X1' }); ok(JSON.stringify(e.calls[0]) === JSON.stringify({ action: 'claim', pjtId: 'X1', id: 'b1' }), '★ 홈에서 다른 프로젝트 항목의 "내가 맡기"는 그 항목의 프로젝트(X1)로 claim');
  ok(e.calls.some((c) => c.action === 'listAll'), '처리한 뒤 목록을 다시 읽음');
  e.calls.length = 0; await e.ctl.click({ lg: 'act', a: 'release', id: 'b1', p: 'X1' }); await e.ctl.click({ lg: 'act', a: 'confirm', id: 'b1', p: 'X1' }); await e.ctl.click({ lg: 'act', a: 'done', id: 'b1', p: 'X1' }); await e.ctl.click({ lg: 'act', a: 'reopen', id: 'b1', p: 'X1' });
  ok(JSON.stringify(e.calls.filter((c) => c.action !== 'listAll')) === JSON.stringify([{ action: 'release', pjtId: 'X1', id: 'b1' }, { action: 'confirm', pjtId: 'X1', id: 'b1' }, { action: 'setStatus', pjtId: 'X1', id: 'b1', status: 'done' }, { action: 'setStatus', pjtId: 'X1', id: 'b1', status: 'confirmed' }]), '맡기 취소·확정·완료·다시 열기가 서버 액션/상태로 정확히 변환');
  // 종결·보류는 확인창, 취소하면 서버 호출 없음
  e.calls.length = 0; e.confirmAnswer = false; await e.ctl.click({ lg: 'act', a: 'closed', id: 'b1', p: 'X1' }); await e.ctl.click({ lg: 'act', a: 'hold', id: 'b1', p: 'X1' }); ok(e.confirms.length === 2 && e.calls.length === 0, '종결·보류는 확인창을 띄우고 취소하면 서버를 부르지 않음');
  e.confirmAnswer = true; await e.ctl.click({ lg: 'act', a: 'closed', id: 'b1', p: 'X1' }); ok(e.calls.some((c) => c.action === 'setStatus' && c.status === 'closed'), '확인하면 종결 요청');
  // 영향 확인 토글
  const e2 = mk({ reply: (d) => (d.action === 'list' ? { ok: true, urgent: [], changes: [Object.assign({}, A, { id: 'c1', category: '일정 변경', impactChecked: true })], entries: [], total: 1, canConfirm: false } : { ok: true }) }); e2.ctl.siteHtml('p1'); await tick(); await tick(); e2.calls.length = 0;
  await e2.ctl.click({ lg: 'act', a: 'impact', id: 'c1', p: 'p1' }); ok(e2.calls[0].action === 'impact' && e2.calls[0].checked === false, '영향 확인이 이미 되어 있으면 누르면 해제(checked:false)');
  // 서버 거절 → 안내
  const e3 = mk({ reply: (d) => (d.action === 'claim' ? Object.assign(new Error('이미 다른 사람이 맡고 있습니다.'), { code: 'functions/already-exists' }) : { ok: true, projects: [], urgent: [], changes: [], entries: [], total: 0, canConfirm: false }) });
  await e3.ctl.click({ lg: 'act', a: 'claim', id: 'z', p: 'X1' }); ok(e3.alerts.length === 1 && e3.alerts[0].includes('이미 다른 사람이 맡고 있습니다') , '서버가 거절하면 그 문구를 안내');
  // 이상한 요청(프로젝트·항목 없음, 모르는 동작)은 무시
  e.calls.length = 0; await e.ctl.click({ lg: 'act', a: 'claim', id: 'b1', p: '' }); await e.ctl.click({ lg: 'act', a: 'claim', id: '', p: 'X1' }); await e.ctl.click({ lg: 'act', a: 'delete', id: 'b1', p: 'X1' }); await e.ctl.click({}); await e.ctl.click(null); ok(e.calls.length === 0, '프로젝트·항목이 없거나 모르는 동작은 서버를 부르지 않음');
  // 프로젝트 이름 누르면 그 프로젝트로 이동(사이트 키로 변환)
  e.ctl.click({ lg: 'go', p: 'X1' }); e.ctl.click({ lg: 'go', p: 'p4ph2' }); ok(e.went.join() === 'reg_X1,p4ph2', '프로젝트 이름을 누르면 사이트 키(reg_X1·p4ph2)로 이동');
}

// ── 기록 폼
{
  // 프로젝트 탭에서: 프로젝트 고정, 선택칸 없음
  const e = mk(); await e.ctl.click({ lg: 'open', p: 'p4ph2' }); const f1 = e.ui.forms.at(-1);
  ok(f1.includes('id="lgform-ov"') && !f1.includes('lg-proj') && CATEGORIES_OK(f1) && f1.includes('data-k="src" data-v="현장"') && !f1.includes('data-v="메일"') && !f1.includes('data-v="일정"') && f1.includes('type="date"'), '탭의 ＋ 기록: 프로젝트 선택 없음, 분류 5개·출처 4개(메일·일정 없음)·기한');
  ok(/id="lg-save"[^>]*disabled/.test(f1), '처음에는 기록하기 비활성');
  e.ctl.click({ lg: 'pick', k: 'cat', v: '현장 이슈' }); e.ctl.click({ lg: 'pick', k: 'src', v: '현장' }); ok(e.ui.forms.at(-1).includes('data-v="현장 이슈" onclick') && e.ui.forms.at(-1).includes('background:var(--blue)'), '고른 칩은 강조 표시');
  e.ctl.onInput('title', '배관 단가 15만원 인상'); ok(e.ui.hint.includes('금액') && e.ui.save === false && e.ui.count === '배관 단가 15만원 인상'.length, '★ 금액을 쓰면 입력하는 중에 바로 안내하고 기록하기 비활성(서버 호출 없이)'); ok(e.calls.length === 0, '입력 중에는 서버를 부르지 않음');
  e.ctl.onInput('title', '크레인 사용 일정 충돌'); ok(e.ui.hint === '' && e.ui.save === true, '금액을 지우면 안내가 사라지고 기록하기 활성');
  e.ui.form = { title: '크레인 사용 일정 충돌', dueDate: '2026-10-20' }; e.calls.length = 0; await e.ctl.click({ lg: 'submit' });
  ok(JSON.stringify(e.calls[0]) === JSON.stringify({ action: 'add', pjtId: 'p4ph2', category: '현장 이슈', source: '현장', title: '크레인 사용 일정 충돌', dueDate: '2026-10-20' }), 'add 를 정확한 값(프로젝트·분류·출처·한 줄·기한)으로 부름: ' + JSON.stringify(e.calls[0]));
  ok(e.ui.hidden >= 1 && e.ctl.state.form === null && e.ctl.state.msg === '기록했습니다.', '저장하면 폼이 닫히고 안내 문구');
  e.ctl.siteHtml('p4ph2'); ok(true, ''); 
  // 버튼이 막힌 상태에서 누르면(우회) 서버 호출 없음
  const e2 = mk(); await e2.ctl.click({ lg: 'open', p: 'p4ph2' }); e2.ui.form = { title: '단가 3만원', dueDate: '' }; e2.ctl.click({ lg: 'pick', k: 'cat', v: '현장 이슈' }); e2.ctl.click({ lg: 'pick', k: 'src', v: '현장' }); e2.calls.length = 0; await e2.ctl.click({ lg: 'submit' });
  ok(nCalls(e2, 'add') === 0 && e2.alerts.length === 1 && e2.alerts[0].includes('금액'), '★ 비활성 버튼을 우회해 눌러도(금액 포함) 서버를 부르지 않고 이유를 안내');
  // 칩을 눌러 폼이 다시 그려져도 입력해 둔 글자는 유지
  const e3 = mk(); await e3.ctl.click({ lg: 'open', p: 'p4ph2' }); e3.ui.form = { title: '입력 중인 문장', dueDate: '2026-10-21' }; e3.ctl.click({ lg: 'pick', k: 'cat', v: '회의 결정' }); ok(e3.ui.forms.at(-1).includes('value="입력 중인 문장"') && e3.ui.forms.at(-1).includes('value="2026-10-21"'), '칩을 눌러 폼이 다시 그려져도 쓰던 한 줄·기한은 그대로');
  // 저장 실패 → 안내, 폼 유지, 다시 누를 수 있음
  const e4 = mk({ reply: (d) => (d.action === 'add' ? Object.assign(new Error('일시적인 오류'), { code: 'functions/unavailable' }) : { ok: true }) }); await e4.ctl.click({ lg: 'open', p: 'p4ph2' }); e4.ctl.click({ lg: 'pick', k: 'cat', v: '현장 이슈' }); e4.ctl.click({ lg: 'pick', k: 'src', v: '현장' }); e4.ui.form = { title: '정상 문장', dueDate: '' }; await e4.ctl.click({ lg: 'submit' });
  ok(e4.alerts.length === 1 && e4.ctl.state.form !== null && e4.ui.save === true && e4.ctl.state.busy === false, '저장이 실패하면 안내하고 폼은 그대로, 기록하기를 다시 누를 수 있음');
}
function CATEGORIES_OK(h) { return ['발주처 요청·지시', '일정 변경', '범위·수량 변경', '현장 이슈', '회의 결정'].every((c) => h.includes('data-k="cat" data-v="' + c + '"')); }

// ── PJT 홈에서의 ＋ 기록: 프로젝트를 골라야 함, 마지막 선택 기억
{
  const e = mk(); await e.ctl.click({ lg: 'open', p: '' }); const f = e.ui.forms.at(-1);
  ok(nCalls(e, 'listAll') === 1, '홈에서 폼을 열면 프로젝트 목록을 위해 먼저 불러옴(아직 안 불렀을 때만)');
  ok(f.includes('lg-proj') && f.includes('<option value="p4ph2">P4 Ph2 (FAB)</option>') && f.includes('<option value="X1">청주 CUB동 A/S</option>') && !f.includes('selected'), '홈의 ＋ 기록: 서버가 준 프로젝트만 선택지, 처음엔 아무것도 골라져 있지 않음(잘못된 프로젝트 방지)');
  e.ctl.click({ lg: 'pick', k: 'cat', v: '현장 이슈' }); e.ctl.click({ lg: 'pick', k: 'src', v: '현장' }); e.ui.form = { title: '크레인 충돌', dueDate: '' }; e.ctl.onInput('title', '크레인 충돌');
  ok(e.ui.save === false, '★ 분류·출처·한 줄이 다 있어도 프로젝트를 고르지 않으면 기록하기 비활성');
  await e.ctl.click({ lg: 'submit' }); ok(nCalls(e, 'add') === 0 && e.alerts.at(-1).includes('프로젝트'), '우회해서 눌러도 프로젝트를 고르지 않으면 서버를 부르지 않고 이유 안내');
  e.ctl.onInput('proj', 'X1'); ok(e.ui.forms.at(-1).includes('<option value="X1" selected>') && e.ui.forms.at(-1).includes('value="크레인 충돌"'), '프로젝트를 고르면 폼이 다시 그려져도 선택과 쓰던 글자가 유지');
  e.calls.length = 0; e.ui.form = { title: '크레인 충돌', dueDate: '' }; await e.ctl.click({ lg: 'submit' }); const add = e.calls.find((c) => c.action === 'add');
  ok(add && add.pjtId === 'X1' && add.title === '크레인 충돌', '고른 프로젝트(X1)로 add');
  ok(e.store.get('jh.pjtlog.lastProject') === 'X1', '고른 프로젝트를 기억(PC 와 같은 키)');
  const e2 = mk(); e2.store.set('jh.pjtlog.lastProject', 'p4ph2'); await e2.ctl.click({ lg: 'open', p: '' }); ok(e2.ui.forms.at(-1).includes('<option value="p4ph2" selected>'), '다음에 열면 마지막에 고른 프로젝트가 기본으로 골라져 있음');
  const e3 = mk(); e3.store.set('jh.pjtlog.lastProject', 'no_such'); await e3.ctl.click({ lg: 'open', p: '' }); ok(!e3.ui.forms.at(-1).includes('selected'), '기억해 둔 프로젝트가 지금은 보이지 않으면 기본 선택 없음');
  const e4 = mk({ reply: (d) => (d.action === 'listAll' ? { ok: true, projects: [{ id: 'only1', name: '하나뿐' }], urgent: [], changes: [], entries: [], total: 0, canConfirm: false } : { ok: true }), }); await e4.ctl.click({ lg: 'open', p: '' }); ok(e4.ui.forms.at(-1).includes('<option value="only1" selected>'), '보이는 프로젝트가 하나뿐이면 기본으로 골라짐');
  const e5 = mk({ storage: null }); await e5.ctl.click({ lg: 'open', p: '' }); ok(e5.ui.forms.length === 1, '저장소를 못 써도(null) 폼은 정상으로 열림');
  // 배경을 누르면 닫힘
  e.ctl.click({ lg: 'close-bg' }); ok(e.ctl.state.form === null, '배경(오버레이)을 누르면 폼이 닫힘');
}

// ── 안전: 이스케이프·인라인 코드에 사용자 문자열이 들어가지 않음
{
  const evil = E('x"><img src=x onerror=1>', 'p"><b>', '<img src=x onerror=1>', '<script>alert(1)</script> & "따옴표"', { createdByName: '<i>x</i>', claimedByName: '<u>y</u>' });
  const h = bodyHtml({ urgent: [evil], changes: [], entries: [evil], total: 1 }, { uid: 'u', manager: true }, { showProject: true });
  ok(!/<script>|<img src=x|<b>|<i>x|<u>y/.test(h) && h.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;따옴표&quot;'), '★ 제목·프로젝트 이름·작성자·맡은 사람은 이스케이프(스크립트·속성 탈출 불가)');
  ok(!/onclick="[^"]*(x"|\x27)/.test(h) && (h.match(/onclick="lgClick\(this\)"/g) || []).length >= 2 && !/onclick="[^"]*\$\{/.test(h), '클릭은 모두 onclick="lgClick(this)" 하나뿐 — 사용자 문자열이 인라인 코드에 끼지 않음');
  const f = formHtml({ fixed: false, pjtId: 'p"><b>', category: '', source: '', title: '"><img src=x onerror=1>', dueDate: '2026-10-1"><b>' }, [{ key: 'p"><b>', label: '<img src=x onerror=1>' }]);
  ok(!/<img src=x|<b>/.test(f) && f.includes('&quot;&gt;&lt;img'), '폼의 값·선택지도 이스케이프');
  ok(CSS.includes('.lgrow') && !CSS.includes('!important') && !/#[0-9a-f]{3,6};\s*}[^}]*var\(--none/.test(CSS), '스타일은 !important 없이 기존 변수(var(--blue) 등)를 사용');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
