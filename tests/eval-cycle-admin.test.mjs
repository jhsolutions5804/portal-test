import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const C = await import('../app/modules/eval/cycle-admin.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── 상태 전이(보안 규칙 eval_cycles 와 같은 기준)
ok(C.STATES.join() === 'draft,open,closed,published' && C.nextState('draft') === 'open' && C.nextState('open') === 'closed' && C.nextState('closed') === 'published' && C.nextState('published') === null && C.nextState('x') === null && C.nextState(undefined) === null, '단계는 준비 → 진행 → 마감 → 공개 한 칸씩, 공개 다음은 없음');
ok(C.canMove('draft', 'open') && C.canMove('open', 'closed') && C.canMove('closed', 'published') && C.canMove(undefined, 'open') && C.canMove('draft', 'closed') && C.canMove('open', 'published'), '앞으로 가는 전이는 가능(회차가 아직 없으면 준비 상태로 봄, 단계를 건너뛰는 것도 규칙상 가능)');
ok(!C.canMove('closed', 'open') && !C.canMove('closed', 'draft') && !C.canMove('published', 'closed') && !C.canMove('published', 'open') && !C.canMove('open', 'draft') && !C.canMove('open', 'open') && !C.canMove('x', 'open') && !C.canMove('draft', 'bogus'), '★ 마감·공개된 회차는 다시 열 수 없고, 같은 상태로의 이동·알 수 없는 상태는 불가(재개방 후 재집계 → 점수 역산 방지)');
// ── 구성원 계산(손으로 계산한 기대값)
const W = (id, name, o) => Object.assign({ id, name, empNo: 'N' + id, dept: 'PJT팀', rank: '사원', hireDate: '2023-01-01', status: 'active' }, o || {});
const workers = [W('w1', '가', { rank: '과장' }), W('w2', '나'), W('w3', '다'), W('w4', '라', { hireDate: '2026-10-13' }), W('w5', '마', { dept: '인사총무팀' }), W('w6', '바', { status: 'resigned', resigned: true }), W('w7', '사', { rank: '대표' }), W('w8', '아', { empNo: 'admin' })];
const users = [{ uid: 'U1', empNo: 'Nw1', teamLead: true, dept: 'PJT팀', name: '가' }, { uid: 'U2', empNo: 'Nw2', dept: 'PJT팀' }, { uid: 'U3', empNo: 'Nw3', dept: 'PJT팀' }, { uid: 'U5', empNo: 'Nw5', dept: '인사총무팀' }];
const plan = C.buildMembers(2026, workers, users);
ok(plan.total === 3 && plan.members.map((m) => m.workerId).join() === 'w1,w2,w3', '★ 대상자는 PJT팀의 평가 대상 직원만: 올해 4분기(10월) 입사자(라)·인사총무팀(마)·퇴사자(바)·대표(사)·시스템 계정(아)은 빠짐 → 3명(가·나·다)');
ok(plan.members.map((m) => m.uid).join() === 'U1,U2,U3' && plan.members.find((m) => m.workerId === 'w1').isLead === true && plan.members.filter((m) => m.isLead).length === 1 && plan.noAccount.length === 0 && plan.members[0].team === 'PJT팀', '포털 계정은 사번으로 연결되고, 직원 관리에서 팀장으로 지정한 가만 팀장(1명)');
const p2 = C.buildMembers(2026, workers, users.filter((u) => u.uid !== 'U3')); ok(p2.noAccount.length === 1 && p2.noAccount[0].workerId === 'w3' && p2.members.find((m) => m.workerId === 'w3').uid === '', '포털 계정이 없는 직원(다)은 uid 가 비고 "계정 없음" 목록에 올라감');
const p3 = C.buildMembers(2026, workers, users.map((u) => Object.assign({}, u, { teamLead: false }))); ok(p3.members.find((m) => m.workerId === 'w1').isLead === true, '팀장 지정이 없으면 팀 최상급자(과장 가)가 팀장(자동)');
const p4 = C.buildMembers(2026, [W('x1', '하', { portalUid: 'UX' })], [{ uid: 'UX', empNo: 'zzz' }]); ok(p4.members[0].uid === 'UX', '근로자 명부의 portalUid 로도 계정이 연결됨(사번이 달라도)');
ok(C.buildMembers(2026, null, null).total === 0 && C.buildMembers(2026, [], []).members.length === 0, '빈 입력은 안전하게 빈 결과');
// ── 사전 경고
ok(C.taskWarnings(plan).length === 0, '정상 구성(PJT팀 3명 + 팀장 있음 + 모두 계정 연결)이면 경고 없음');
const w2 = C.taskWarnings(p2); ok(w2.length === 1 && w2[0].includes('다') && w2[0].includes('1명'), '계정이 없는 직원이 있으면 이름과 함께 경고');
const w3 = C.taskWarnings(C.buildMembers(2026, [W('a1', '가', { rank: '과장' }), W('a2', '나')], [{ uid: 'U1', empNo: 'Na1' }, { uid: 'U2', empNo: 'Na2' }])); ok(w3.some((x) => x.includes('팀원이 2명') && x.includes('2명 미만')) && !w3.some((x) => x.includes('팀장이 없습니다')), '★ 팀원이 2명뿐이면 동료평가가 1명이 되어 평균을 못 낸다고 미리 경고(익명 보호로 평가자 2명 이상 필요), 팀장은 최상급자로 자동이라 팀장 경고는 없음');
const w4 = C.taskWarnings({ members: [], noAccount: [], total: 0 }); ok(w4.length === 1 && w4[0].includes('대상자가 없습니다'), '대상자가 없으면 그 사실을 알림');
const w5 = C.taskWarnings({ members: [{ uid: 'U1', workerId: 'a', team: '신팀', name: '가', isLead: false }, { uid: 'U2', workerId: 'b', team: '신팀', name: '나', isLead: false }, { uid: 'U3', workerId: 'c', team: '신팀', name: '다', isLead: false }], noAccount: [], total: 3 }); ok(w5.length === 1 && w5[0].includes('팀장이 없습니다'), '팀원은 충분한데 팀장이 없으면 팀장 지정 안내');
// ── 서버 buildTasks 와의 일치(같은 구성원 입력을 서버 규칙으로 돌려 과제 수를 손계산과 비교)
const { createRequire } = await import('node:module'); const req = createRequire(import.meta.url); let serverOk = false, srv = null;
try { srv = req('/tmp/pf/functions/eval-act.js'); serverOk = true; } catch (e) { serverOk = false; }
if (serverOk) { const t = srv.buildTasks(2026, plan.members); const keys = (u) => t.tasks['2026__' + u].keys;
  ok(Object.keys(t.tasks).length === 3 && keys('U1').length === 1 + 2 + 2 && keys('U2').length === 1 + 2 && keys('U3').length === 1 + 2 && t.skipped.length === 0, '★ 서버 과제 생성: 팀장 가는 자기평가 1 + 동료 2 + 팀원 1차 평가 2 = 5건, 나·다는 자기평가 1 + 동료 2 = 3건(손계산)');
  const t2 = srv.buildTasks(2026, p2.members); ok(!t2.tasks['2026__'] || Object.keys(t2.tasks).length === 2 && t2.skipped.length === 1 && t2.skipped[0].workerId === 'w3', '계정이 없는 직원은 서버가 과제 생성에서 건너뛰고 skipped 로 알림 — 화면 경고와 같은 사람'); }
else console.log('SKIP 서버 과제 생성 일치 시험(서버 코드 폴더 없음 — 서버 저장소 시험 eval.test.js 가 같은 내용을 확인)');
// ═══ 회차 카드(마크업): 상태별 버튼 ═══
const V = await import('../app/modules/eval/cycle-admin-view.js?v=' + VER);
const goodPlan = C.buildMembers(2026, workers, users);
const card = (status, o) => V.cycleCardHtml({ ca: Object.assign({ year: 2026, cycle: status ? { status } : null, plan: goodPlan, taskCount: 3, progress: null, aggregated: '', canManage: true }, o || {}) });
const acts = (h) => [...h.matchAll(/data-cy-act="([^"]+)"/g)].map((m) => m[1]);
const none = card(''), draft = card('draft', { taskCount: null }), open = card('open'), closed = card('closed'), pub = card('published');
ok(JSON.stringify(acts(none)) === '["create"]' && none.includes('회차 없음') && none.includes('2026년 평가 회차'), '★ 회차가 없으면 "회차 만들기"만 있음');
ok(JSON.stringify(acts(draft)) === '["tasks","move:open"]' && draft.includes('현재 준비') && /data-cy-act="move:open"/.test(draft) && draft.includes('평가 시작(진행)'), '준비 단계: 과제 배정 → 평가 시작(진행)');
ok(JSON.stringify(acts(open)) === '["tasks","move:closed"]' && open.includes('현재 진행') && open.includes('과제 다시 배정') && open.includes('평가 마감') && open.includes('배정된 직원 3명'), '진행 단계: 과제 다시 배정 · 평가 마감, 배정 인원 표시');
ok(JSON.stringify(acts(closed)) === '["move:published","aggregate"]' && closed.includes('동료평가 집계') && closed.includes('결과 공개') && closed.includes('다시 열 수 없습니다') && closed.includes('<strong>마감 후 한 번에</strong>') && closed.includes('평가자 2명 미만이면 평균을 만들지 않고'), '★ 마감 단계: 결과 공개 · 동료평가 집계 버튼만 있고 "다시 열기" 버튼은 없으며, 되돌릴 수 없다는 안내와 마감 후 한 번에 집계·2명 미만이면 평균 없음 안내');
ok(JSON.stringify(acts(pub)) === '["aggregate"]' && pub.includes('현재 공개') && !acts(pub).some((a) => /move:open|move:draft|create|tasks/.test(a)), '공개 단계: 집계만 남고 열기·과제 배정·만들기 버튼은 없음');
ok(!acts(draft).concat(acts(open), acts(closed), acts(pub)).some((a) => a === 'move:open' && !/data-cy-act="move:open"/.test(draft)) && !acts(closed).includes('move:open') && !acts(closed).includes('move:draft'), '★ 마감·공개 상태의 화면에는 "다시 열기" 버튼이 어떤 형태로도 없음');
const staff = card('open', { canManage: false }); ok(acts(staff).every((a) => true) && (staff.match(/data-cy-act="[^"]+"[^>]* disabled/g) || []).length === acts(staff).length && staff.includes('회차 관리는 사장단만 할 수 있습니다') && !/data-cy-act="[^"]+"(?![^>]*disabled)/.test(staff), '★ 인사팀(사장단이 아님)이 보면 모든 버튼이 잠겨 있고 "사장단만 할 수 있습니다" 안내가 있음');
ok(draft.indexOf('data-now="true"') !== -1 && (draft.match(/data-now="true"/g) || []).length === 1 && (open.match(/data-done="true"/g) || []).length === 1 && (pub.match(/data-done="true"/g) || []).length === 3 && (none.match(/data-now="true"/g) || []).length === 0, '진행 단계 표시: 현재 단계가 하나만 표시되고, 지나온 단계 수가 맞음(진행=1, 공개=3, 회차 없음=표시 없음)');
const warnCard = card('draft', { plan: C.buildMembers(2026, workers, users.filter((u) => u.uid !== 'U3')) }); ok(warnCard.includes('시작 전 확인') && warnCard.includes('포털 계정과 연결되지 않아') && !card('draft').includes('시작 전 확인') && !card('closed', { plan: C.buildMembers(2026, workers, users.filter((u) => u.uid !== 'U3')) }).includes('시작 전 확인'), '시작 전 확인 경고는 준비·진행 단계에서만 보이고, 문제가 없거나 마감 뒤에는 보이지 않음');
// 이스케이프된 글자(&lt;img … onerror=…&gt;)는 태그가 아니라 실행되지 않는다. "태그로 살아 있는" 경우만 위험으로 본다: < 로 시작하는 태그 안의 on*= 속성, 또는 <script 태그
const live = (h) => /<\s*script\b/i.test(h) || /<[a-z][^>]*\son[a-z]+\s*=/i.test(h);
const evilA = V.cycleCardHtml({ ca: { year: '<b>x</b>', cycle: { status: 'open' }, plan: { members: [], noAccount: [{ name: '<img src=x onerror=alert(1)>', workerId: 'q' }], total: 1 }, taskCount: 0, canManage: true, aggregated: '<script>x</script>' } }), evalB = V.cycleCardHtml({ ca: { year: '<b>x</b>', cycle: { status: 'closed' }, plan: { members: [], noAccount: [], total: 0 }, canManage: true, aggregated: '<script>x</script>' } });
ok(!live(evilA) && !live(evalB) && evilA.includes('&lt;img src=x onerror=alert(1)&gt;') && evalB.includes('&lt;script&gt;x&lt;/script&gt;') && !evilA.includes('<b>x</b>'), '★ 이름·연도·집계 문구에 HTML 이 들어 있어도 이스케이프되어 태그로 살아 있지 않음(글자로만 보임)');
ok(live('<img src=x onerror=alert(1)>') && live('<script>x</script>') && live('<div onclick="x">') && !live('&lt;img src=x onerror=alert(1)&gt;') && !live('onerror=alert(1) 같은 글자'), '(검사식 자체 확인) 위의 "살아 있는 태그" 검사는 이스케이프 전 원본은 잡아내고 이스케이프된 글자는 통과시킴 — 시험이 아무것도 못 잡는 헛시험이 아님');
// ═══ 입출력(소스) 확인 ═══
const io = fs.readFileSync(new URL('../app/modules/eval/cycle-admin-io.js', import.meta.url), 'utf8'), perm = fs.readFileSync(new URL('../app/shared/eval-perm.js', import.meta.url), 'utf8'), opsSrc = fs.readFileSync(new URL('../app/modules/eval/ops.js', import.meta.url), 'utf8');
const P = await import('../app/shared/eval-perm.js?v=' + VER);
ok(P.canManageCycle({ admin: true, rank: '대표' }) && P.canManageCycle({ admin: true, rank: '부사장' }) && !P.canManageCycle({ admin: true, rank: '대리' }) && !P.canManageCycle({ admin: false, rank: '대표' }) && !P.canManageCycle({ admin: true, rank: '대표', isGuest: true }) && !P.canManageCycle(null) && !P.canManageCycle({ perms: { hrEval: true }, rank: '사원' }), '★ 회차 관리는 사장단 직급이면서 관리자 계정이어야 함(보안 규칙이 관리자 계정을 요구하므로 화면도 같이 요구 — 버튼은 켜졌는데 저장이 거부되는 일이 없게). 인사팀 관리자(대리급)·관리자가 아닌 사장단·GUEST 는 불가');
ok(io.includes('canManageCycle(me)') && io.includes("'eval_cycles/' + year") && !/deleteDoc|updateDoc|addDoc/.test(io) && io.includes('canMove(from, to)') && io.includes('if (!ca.canManage)') && io.includes("to === 'open' && !ca.taskCount") && io.includes("variant: to === 'closed' ? 'danger'"), '입출력: 회차 문서 하나만 쓰고(삭제·부분 수정 없음), 권한·단계 전이를 확인하며, 과제 배정 없이는 평가를 시작할 수 없고, 마감은 위험 표시의 확인 창을 거침');
ok(io.includes("action: 'generateTasks'") && io.includes("action: 'aggregatePeers'") && io.includes('ca.plan.members.map((m) => ({ uid: m.uid, workerId: m.workerId, team: m.team, name: m.name, isLead: m.isLead }))') && !/scores|raterUid|submission/.test(io.replace(/ca\.progress/g, '')), '서버 호출: 과제 배정과 집계 요청에 필요한 값(구성원·연도·대상)만 보내고 점수·평가자 정보는 다루지 않음');
ok(/not-found\|unimplemented/.test(opsSrc) && opsSrc.includes('아직 배포되지 않았습니다') && opsSrc.includes("httpsCallable(functions, 'evalAct')") && opsSrc.includes('cycleCardHtml(st) + evalBoardHtml(st)') && /else if \(!\(await cad\.onClick\(ev\)\)\) await cyc\.onClick\(ev\)/.test(opsSrc), '서버 함수가 배포되지 않았을 때 그 사실을 알리고(not-found), 회차 카드가 정기평가 화면 맨 위에 붙으며 회차 클릭은 회차 컨트롤러가 먼저 처리');
ok(io.includes("toast('저장하지 못했습니다'") && io.includes("e && e.code === 'permission-denied'") && io.includes('toast(e.message ||'), '저장·서버 호출이 실패하면 성공한 것처럼 보이지 않고 이유를 알림');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
