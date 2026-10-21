import fs from 'node:fs';
import { adhocParticipants, emptyAdhoc, adhocSummary, adhocProjectPerf, ADHOC_ENTRY_ITEMS, ADHOC_LABELS, evalAccess } from '../app/modules/eval/evaluation.js';
import { adhocBoardHtml, adhocProjectHtml } from '../app/modules/eval/adhoc-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = (id, rank, o) => Object.assign({ id, name: id + '님', rank, empNo: id, dept: 'PJT팀', hireDate: '2023-01-01', status: 'active' }, o || {});
// ── 참여자
const hr = [W('a', '과장'), W('b', '대리'), W('c', '사원'), W('d', '대표'), W('e', '부사장'), W('f', '사원', { status: 'resigned' }), W('admin', '사원', { empNo: 'admin' }), W('g', '사원')];
const ros = [{ id: 'a', active: true }, { id: 'b' }, { id: 'c', active: false }, { id: 'd' }, { id: 'e' }, { id: 'f' }, { id: 'admin' }, { id: 'zz' }];
ok(adhocParticipants(ros, hr).map((w) => w.id).join() === 'a,b', '★ 수시평가 참여자 = 프로젝트 명부에서 활동 중인 근로자만(투입 종료·퇴사·사장단·시스템 계정·명부에 없는 사람 제외)');
ok(adhocParticipants(null, hr).length === 0 && adhocParticipants(ros, null).length === 0, '명부나 근로자 목록이 없어도 안전하게 빈 목록');
// ── 수시평가 요약(설계서 5절)
const P = { id: 'P1', name: 'P4 Ph2' }; let r = emptyAdhoc(hr[0], P);
ok(r.pjtId === 'P1' && r.workerId === 'a' && r.confirmed === false && ADHOC_ENTRY_ITEMS.length === 5 && ADHOC_LABELS.collab.includes('동료') && adhocSummary(r, {}).status === 'none', '새 수시평가 기록은 미시작(항목 5개는 평가자 입력, 협업은 동료 평균으로 자동)');
r.items = { progress: 4, schedule: 4, quality: 4, safety: 5, report: 5 };
let s = adhocSummary(r, {}); ok(s.site === null && s.status === 'rating', '동료평가(2명 이상)가 없으면 협업 항목을 채울 수 없어 현장 점수가 나오지 않음(입력 중)');
r.peers = { x: [4, 4, 4] }; ok(adhocSummary(r, {}).collab === null, '동료 1명뿐이면 협업 반영 안 함(익명 평균 최소 2명)');
r.peers = { x: [4, 4, 4], y: [5, 5, 5] }; s = adhocSummary(r, {});
ok(s.collab === 4.5 && s.site === 88.3 && s.exec === null && s.final === null && s.status === 'rating', '★ 동료 2명(4점·5점) 평균 4.5 → 현장 점수 88.3(6항목 평균 ÷ 5 × 100), 사장단 점수가 없으면 최종 없음');
r.exec = { e1: { person: 4 }, e2: { person: 5 } }; const proj = { target: 12, snapshot: { billed: 1000, done: 1000, paid: 850 }, exec: { e1: { project: 4 }, e2: { project: 5 } } };
s = adhocSummary(r, proj); ok(s.exec === 90 && s.execRaters === 2 && s.site === 88.3 && s.status === 'team_done' && s.final === null, '★ 사장단 점수 = 각자(개인 60% + 그 프로젝트 성과 40%) 80점·100점의 평균 90점, 확정 전에는 최종 점수 없음');
r.confirmed = true; s = adhocSummary(r, proj); ok(s.final === 89.2 && s.grade === 'A' && s.status === 'confirmed', '★ 확정하면 수시 최종 = 현장 88.3 × 50% + 사장단 90 × 50% = 89.2, 등급 A');
r.exec = { e1: { person: 4 }, e9: { person: 5 } }; ok(adhocSummary(r, proj).execRaters === 1, '프로젝트 성과 점수를 아직 안 준 사장단은 계산에서 빠짐(개인 점수와 프로젝트 성과 점수가 모두 있어야 함)');
// ── 프로젝트 성과(프로젝트마다 별도)
const A = adhocProjectPerf({ target: 12, snapshot: { billed: 2000, done: 2000, paid: 1700 } }), B = adhocProjectPerf({ target: 8, snapshot: { billed: 1000, done: 1000, paid: 950 }, bands: [{ min: 2, score: 5 }, { min: -Infinity, score: 2 }] }), C = adhocProjectPerf({ target: 10, snapshot: { billed: 1000, done: 1000, paid: 700, ownLabor: 100, direct: 50 } }), D = adhocProjectPerf({ target: 10, snapshot: {} });
ok(A.actual === 15 && A.diff === 3 && A.score === 5 && B.actual === 5 && B.diff === -3 && B.score === 2 && C.actual === 15 && C.score === 5 && D.actual === null && D.score === null, '★ 프로젝트 성과는 프로젝트마다 따로: A(목표 12%, 실현 15%, +3%p, 5점) / B(목표 8%, 실현 5%, 자체 구간으로 2점) / C(직접비·자체 인건비 포함 실투입비 차감 후 15%) / 청구가 없으면 계산 안 함');
// ── 화면
const me = { uid: '202TPNudKZghsTPAeeG206f8vbJ3', name: '조은별', rank: '대표', empNo: '00000', admin: true, perms: {} };   // 사장단 계정(보안 규칙 isCycleManager 의 목록에 있는 실제 계정 식별자)
const projects = [{ id: 'P1', name: 'P4 Ph2 FAB', status: 'ended', linked: true, planId: 'pjt_1', members: [hr[0], hr[1]], memberWorkers: [hr[0], hr[1]], snapshot: { billed: 1000, done: 1000, paid: 850 }, targetMargin: 12, eval: {} }, { id: 'P2', name: '청주 M15X', status: 'active', linked: false, planId: '', members: [], memberWorkers: [], snapshot: {}, targetMargin: null, eval: {} }];
const st = { evTab: 'adhoc', ad: { me, projects, sel: '', pdraft: null, msel: '', mdraft: null, recs: {} } };
const bd0 = adhocBoardHtml(st); ok(!bd0.includes('data-ec-tab') && !bd0.includes('jh-segmented'), '★ 수시평가 화면 안에 탭이 없음 — 메뉴(정기평가·수시평가)가 탭 역할을 하므로 화면 안 탭은 두지 않음');
const bd = adhocBoardHtml(st); ok(bd.includes('현장 평가') && bd.includes('사장단 평가') && bd.includes('프로젝트마다 따로') && bd.includes('P4 Ph2 FAB') && bd.includes('종료') && bd.includes('12%') && bd.includes('15%') && bd.includes('5점') && bd.includes('data-ad-open="P1"') && bd.includes('청주 M15X') && bd.includes('목표 미입력') && bd.indexOf('P4 Ph2 FAB') < bd.indexOf('청주 M15X'), '★ 프로젝트 목록: 종료 프로젝트가 위, 목표·실현 마진율과 점수, 평가 방식 안내');
const bdN = adhocBoardHtml({ evTab: 'adhoc', ad: Object.assign({}, st.ad, { me: { uid: 'Z', name: '일반', rank: '사원', perms: {} } }) }); ok(bdN.includes('권한이 없습니다') && !bdN.includes('data-ad-open'), '권한이 없는 직원에게는 프로젝트 목록이 보이지 않음');
const bdH = adhocBoardHtml({ evTab: 'adhoc', ad: Object.assign({}, st.ad, { me: { uid: 'H', name: '인사', rank: '대리', admin: true, perms: {} } }) }); ok(bdH.includes('인사팀') && bdH.includes('>보기<') && !bdH.includes('>평가<'), '인사팀은 목록을 보되 버튼이 "보기"');
// 사장단 계정(me.uid)이 준 프로젝트 성과 점수를 심는다
st.ad.sel = 'P1'; st.ad.pdraft = { exec: { [me.uid]: { project: 4 } } }; const pj = adhocProjectHtml(st);
ok(pj.includes('프로젝트 성과 — P4 Ph2 FAB') && pj.includes('영업기획 연결됨') && pj.includes('읽기 전용') && pj.includes('href="#/plan/projects/pjt_1"') && pj.includes('목표 마진율') && pj.includes('12%') && pj.includes('15%') && pj.includes('+3%p') && pj.includes('5 / 5') && pj.includes('1,000원') && pj.includes('850원') && /data-ad-score="pexec\|4"[^>]*aria-pressed="true"/.test(pj) && pj.includes('프로젝트 성과 점수 저장'), '★ 프로젝트 성과 카드: 마진율(목표 12%·실현 15%·+3%p·5/5)·청구·지급은 영업기획 값을 읽기 전용으로 보여 주고 영업기획 프로젝트로 가는 링크, 사장단의 프로젝트 성과 점수(4점 눌림)만 입력');
ok(!pj.includes('data-ad-proj') && !/<input[^>]*inputmode="decimal"/.test(pj) && !pj.includes('직접 노무비') && !pj.includes('직접 입력'), '★ 수시평가에는 마진율 입력칸이 없음(목표·청구·지급·노무비·직접비 입력은 영업기획 쪽 몫)');
ok(pj.includes('평가자(참여자 중 최상급자) a님') && pj.includes('참여자 평가 · 2명') && pj.includes('data-ad-member="a"') && pj.includes('data-ad-member="b"') && pj.includes('관리자·사장단·시스템 계정은 참여자에서 제외'), '참여자 목록: 평가자(최상급자) 표시와 제외 규칙 안내');
const stU = { evTab: 'adhoc', ad: Object.assign({}, st.ad, { sel: 'P2', pdraft: { exec: {} } }) }; const pjU = adhocProjectHtml(stU); ok(pjU.includes('영업기획 연결 없음') && pjU.includes('연동 PJT') && pjU.includes('<strong>미입력</strong>') && pjU.includes('진행 중 — 잠정치') && pjU.includes('참여자 명부가 비어') && pjU.includes('평가자 없음'), '영업기획에 연결되지 않은 진행 중 프로젝트: 연결 방법 안내·목표 미입력, 잠정치 표시, 참여자가 없으면 안내');
st.ad.msel = 'a'; st.ad.mdraft = Object.assign(emptyAdhoc(hr[0], P), { items: { progress: 4, schedule: 4, quality: 4, safety: 5, report: 5 }, peers: { b: [4, 4, 4] } }); const mem = adhocProjectHtml(st);
ok(mem.includes('a님 · 수시평가 · P4 Ph2 FAB') && mem.includes('data-ad-score="item:progress|5"') && mem.includes('data-ad-score="item:report|1"') && !mem.includes('data-ad-score="item:collab') && mem.includes('data-ad-peer="b|0"') && !mem.includes('data-ad-peer="a|') && mem.includes('아직 반영할 수 없음') && mem.includes('data-ad-score="person|3"') && mem.includes('수시 평가 확정(대표)'), '★ 참여자 평가 패널: 현장 5항목 입력(협업은 입력칸 없이 동료 평균으로 자동), 같은 프로젝트 동료 입력(본인 제외), 사장단 개인 점수, 확정 버튼');
ok(/data-ad-act="mconfirm" disabled/.test(mem), '현장·사장단 점수가 아직 완성되지 않으면 확정 버튼이 잠김');
const stH = { evTab: 'adhoc', ad: Object.assign({}, st.ad, { me: { uid: 'H', name: '인사', rank: '대리', admin: true, perms: {} } }) }; const memH = adhocProjectHtml(stH);
ok(/data-ad-score="item:progress\|5"[^>]*disabled/.test(memH) && /data-ad-act="msave" disabled/.test(memH) && memH.includes('인사팀은 열람·운영만') && /data-ad-act="psave"[^>]*disabled/.test(memH), '★ 인사팀이 보면 평가 입력·저장·프로젝트 성과 저장이 모두 잠김(열람·운영만)');
st.ad.mdraft.confirmed = true; const memL = adhocProjectHtml(st); ok(/data-ad-score="item:progress\|5"[^>]*disabled/.test(memL) && memL.includes('확정된 평가는 수정할 수 없습니다') && memL.includes('data-ad-act="munconfirm"'), '확정된 수시평가는 입력이 잠기고 대표에게만 "확정 취소"가 보임');
ok(pj.includes('실현 마진율 (잠정)') && pj.includes('외주·자재(지급예정서)만') && pj.includes('현장경비·자체 직접노무비 미반영'), '★ 수시평가 프로젝트 성과 카드에 "잠정" 표기 — 지급 기준 마진율을 최종 숫자로 오해하지 않게(현장경비·자체 직접노무비 연결 전)');
// ── 연결(소스) 확인
const idx = fs.readFileSync(new URL('../app/modules/eval/ops.js', import.meta.url), 'utf8');
ok(idx.includes('createAdhocController(') && idx.includes('adh.onClick(ev)') && idx.includes('adh.onInput(ev)') && idx.includes('adh.onChange(ev)') && idx.includes("kind === 'adhoc'"), '평가 모듈의 운영 화면에 수시평가 컨트롤러가 연결됨(클릭·입력·선택)');
const io = fs.readFileSync(new URL('../app/modules/eval/adhoc-io.js', import.meta.url), 'utf8');
ok(io.includes("'evaluations/_pjt/adhoc/'") && io.includes("'evaluations/' + wid + '/adhoc/'") && !/addDoc|deleteDoc|updateDoc/.test(io) && io.includes('pjtSummary(') && io.includes('link.targetMargin') && !io.includes('data-ad-proj'), '저장 위치는 기존 관리자 전용 컬렉션 안(evaluations/…/adhoc/…)이고 삭제·덮어쓰기성 쓰기는 없으며, 청구·지급은 영업기획 계산 함수로 집계');
console.log('── 수시평가 성과는 스냅샷의 완결 청구로 계산(대표님 2026-10-21)');
{ const A = adhocProjectPerf({ target: 30, snapshot: { billed: 1000, done: 600, paid: 400 } }), B = adhocProjectPerf({ target: 30, snapshot: { billed: 1000, done: 0, paid: 400 } }), C = adhocProjectPerf({ target: 30, snapshot: { billed: 1000, paid: 400 } }); ok(A.actual === 33.3 && A.score === 5 && B.actual === null && B.score === null && C.actual === null && C.score === null, '★ 스냅샷에 완결이 600이면 실현 33.3%·5점, 완결이 0이거나 완결 정보가 없으면(옛 스냅샷) 계산하지 않는다 — 청구로 대신 계산하지 않음'); }
console.log('── 평가 스냅샷은 영업기획 정산서의 완결 청구를 담는다(동작 시험 — 파일 문자열 검사가 아니라 load 를 실제로 실행)');
{ const { createAdhocController } = await import('../app/modules/eval/adhoc-io.js');
  const DB = { 'pjt_registry': [{ id: 'R1', name: '평가 프로젝트 A', status: 'active' }, { id: 'R2', name: '평가 프로젝트 B(연결 안 됨)', status: 'active' }], 'gihoek_projects': [{ id: 'G1', linkPjt: 'R1', targetMargin: 30 }], 'gihoek_estimates': [],
    'gihoek_settlements': [{ id: 's1', pjtId: 'G1', docType: 'invoice', amount: 600, status: 'done' }, { id: 's2', pjtId: 'G1', docType: 'invoice', amount: 400, status: 'active' }, { id: 's3', pjtId: 'G1', docType: 'invoice', amount: 999, status: 'void' }, { id: 's4', pjtId: 'G1', docType: 'payment', amount: 400 }] };
  const col = (d, p) => ({ path: p }); const getDocs = async (c) => { const l = DB[c.path] || []; return { forEach: (f) => l.forEach((x) => f({ id: x.id, data: () => { const y = Object.assign({}, x); delete y.id; return y; } })) }; };
  const st = {}; const ctl = createAdhocController({ db: {}, collection: col, getDocs, getDoc: async () => ({ exists: () => false }), setDoc: async () => {}, doc: (d, p) => ({ path: p }), serverTimestamp: () => 0, toast: () => {}, confirmDialog: async () => ({ ok: true }), paint: () => {}, st, ctx: { me: { uid: 'u', admin: true } } });
  await ctl.load(); const A = st.ad.projects.find((p) => p.id === 'R1'), B = st.ad.projects.find((p) => p.id === 'R2');
  ok(A && A.snapshot.billed === 1000 && A.snapshot.done === 600 && A.snapshot.paid === 400, '★ 스냅샷에 청구 누계 1,000 · 완결 600 · 지급 400 이 들어간다(폐기 999 제외) (실제: ' + JSON.stringify(A && A.snapshot) + ')');
  { const P = adhocProjectPerf({ target: A.targetMargin, snapshot: A.snapshot }); ok(P.actual === 33.3 && P.diff === 3.3 && P.score === 5, '★ 그 스냅샷으로 점수를 매기면 실현 33.3%(완결 기준)·+3.3%p·5점이다 — 청구 기준이면 60% 라 후하게 나온다 (실제: ' + P.actual + '%·' + P.score + '점)'); }
  ok(B && B.linked === false && Object.keys(B.snapshot).length === 0 && adhocProjectPerf({ target: null, snapshot: B.snapshot }).actual === null, '영업기획에 연결되지 않은 평가 프로젝트는 스냅샷이 비어 있고 마진을 계산하지 않는다'); }
ok(pass + fail >= 29, '시험이 끝까지 실행됨');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
