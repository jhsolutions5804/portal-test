import { makeCareerIo } from '../app/modules/hr/career-io.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// 가짜 DB: 경로 → 문서들. where('md.<id>', '>', 0) 는 그 값이 0 보다 큰 문서만
const DB = {
  'pjt_registry': { p1: { name: 'P4 Ph2', code: 'P4 Ph2 (FAB)', status: 'run' }, p2: { name: 'M15X', status: 'ended' }, p3: { name: '관계없음' } },
  'pjt_registry/p1/workers': { m1: { name: '홍', role: '품질', roleLog: [{ role: '공무', at: '2026-10-01' }, { role: '품질', at: '2026-11-01' }], createdDate: '2026-10-01' } },
  'pjt_registry/p1/manday': { '2026-10-05': { md: { m1: 1, x: 2 } }, '2026-11-02': { md: { m1: 0.5 } }, '2026-11-03': { md: { m1: 0 } }, '2026-10-06': { md: { x: 1 } } },
  'pjt_registry/p2/workers': {}, 'pjt_registry/p2/manday': { '2026-07-01': { md: { m1: 1 } } },
  'pjt_registry/p3/workers': {}, 'pjt_registry/p3/manday': {},
  'master_workers': { m1: { name: '홍길동', birth: '1990-01-01' }, m2: { name: '김영희', birth: '1992-02-02', resigned: true } }
};
const mkFb = (opts) => { const o = opts || {}; const calls = []; const snap = (rows) => ({ forEach: (f) => rows.forEach(([id, d]) => f({ id, data: () => d })) });
  const fb = { db: 'db', collection: (db, p) => ({ p }), doc: (db, p) => ({ p }), query: (c, w) => ({ p: c.p, w }), where: (f, op, v) => ({ f, op, v }),
    getDoc: async (r) => { if (o.failWorkers) throw new Error('x'); const parts = r.p.split('/'); const id = parts.pop(); const d = (DB[parts.join('/')] || {})[id]; return { exists: () => d !== undefined, data: () => d }; },
    getDocs: async (q) => { const p = q.p; if (o.failMaster && p === 'master_workers') throw new Error('x'); if (o.failManday && /manday$/.test(p)) throw new Error('x'); if (o.failRegistry && p === 'pjt_registry') throw new Error('x'); let rows = Object.entries(DB[p] || {}); if (q.w) { const key = q.w.f.split('.')[1]; rows = rows.filter(([id, d]) => ((d.md || {})[key] || 0) > q.w.v); } return snap(rows); },
    call: async (data) => { calls.push(data); if (o.failCall) { const e = new Error('NOT_FOUND'); e.code = 'functions/not-found'; throw e; } return { worker: { id: data.workerId }, masterId: o.masterId || '', career: [], careerOverride: null, awards: [], training: [], certs: [], education: [], careerEdits: [], hasProfile: false }; } };
  return { fb, calls }; };
(async () => {
  const { fb, calls } = mkFb(); const io = makeCareerIo(fb);
  const r0 = await io.load({ id: 'w1', name: '홍길동' }, '2026-11-05');
  ok(calls[0].action === 'get' && calls[0].workerId === 'w1' && r0.data.worker.id === 'w1', '불러오기: 서버 함수 get 호출');
  ok(r0.masters.length === 2 && r0.masters[0].name === '홍길동' && r0.masters[1].resigned === true && r0.projects === null && r0.errors.length === 0, '연명부 목록을 읽고, 연결이 없으면 프로젝트 이력은 읽지 않음(null)');
  const { fb: fb2 } = mkFb({ masterId: 'm1' }); const io2 = makeCareerIo(fb2); const r1 = await io2.load({ id: 'w1', name: '홍길동' }, '2026-11-05');
  const names = r1.projects.list.map((x) => x.name).join();
  ok(names === 'P4 Ph2 (FAB),M15X', '프로젝트 이력: 이 사람이 있는 프로젝트만(이름은 코드 우선), 시작이 늦은 순 — ' + names);
  const a = r1.projects.list[0]; ok(a.days === 2 && a.manDays === 1.5 && a.from === '2026-10-05' && a.to === '2026-11-05' && a.active === true && a.role === '품질' && a.segments.map((s) => s.role).join() === '공무,품질', '진행 중 프로젝트: 공수 있는 날만 2일(0 인 날·다른 사람 제외), 오늘까지, 역할이 바뀐 구간으로 나눔');
  const b = r1.projects.list[1]; ok(b.ended === true && b.active === false && b.manDays === 1 && b.to === '2026-07-01' && b.role === '', '종료된 프로젝트(status=ended): 명단에 없어도 공수 기록으로 포함, 마지막 공수일에서 끝, 역할 미지정');
  ok(r1.projects.summary.count === 2 && r1.projects.summary.manDays === 2.5, '요약: 프로젝트 2개·공수 2.5');
  const { fb: f3 } = mkFb({ masterId: 'm1', failMaster: true }); const r3 = await makeCareerIo(f3).load({ id: 'w1', name: 'x' }, '2026-11-05'); ok(r3.masters.length === 0 && r3.errors.includes('연명부 목록') && r3.projects.list.length === 2, '연명부 목록을 못 읽어도 나머지는 보여 주고 오류 이름을 알림');
  const { fb: f4 } = mkFb({ masterId: 'm1', failManday: true }); const r4 = await makeCareerIo(f4).load({ id: 'w1', name: 'x' }, '2026-11-05'); ok(r4.errors.some((e) => /공수$/.test(e)) && r4.projects.list.length === 1 && r4.projects.list[0].days === 0, '공수를 못 읽은 프로젝트는 오류로 알리고(숨기지 않음) 명단 정보만으로 표시');
  const { fb: f5 } = mkFb({ masterId: 'm1', failRegistry: true }); const r5 = await makeCareerIo(f5).load({ id: 'w1', name: 'x' }, '2026-11-05'); ok(r5.projects.list.length === 0 && r5.errors.includes('프로젝트 목록'), '프로젝트 목록을 못 읽으면 빈 이력과 오류 표시');
  const { fb: f6 } = mkFb({ failCall: true }); let err = null; try { await makeCareerIo(f6).load({ id: 'w1', name: 'x' }, '2026-11-05'); } catch (e) { err = e; } ok(err && err.code === 'functions/not-found', '서버 함수 오류는 그대로 던져 화면이 안내하게 함');
  const { fb: f7, calls: c7 } = mkFb(); const io7 = makeCareerIo(f7); await io7.act('saveCareer', { id: 'w9' }, { rows: [{ company: 'A' }] }); ok(c7[0].action === 'saveCareer' && c7[0].workerId === 'w9' && c7[0].rows.length === 1, '쓰기 동작: 동작 이름·직원 번호·내용을 서버 함수에 그대로 전달');
  const dcalls = []; const okDeploy = async (d) => { dcalls.push(d); return { worker: { id: d.workerId }, linked: true, items: [{ pjtId: 'p1', name: 'P4 Ph2', status: 'agreed', at: '2026-11-05T01:30:00.000Z' }] }; };
  const { fb: fd } = mkFb({ masterId: 'm1' }); const rd = await makeCareerIo(Object.assign({}, fd, { callDeploy: okDeploy })).load({ id: 'w1', name: '홍길동' }, '2026-11-05');
  ok(dcalls.length === 1 && dcalls[0].action === 'adminList' && dcalls[0].workerId === 'w1' && rd.deploy.items[0].status === 'agreed' && rd.errors.length === 0, '투입 확인 현황: callDeploy 가 있으면 서버 함수 adminList 로 직원 한 명의 현황을 함께 읽음');
  const rn = await makeCareerIo(fd).load({ id: 'w1', name: 'x' }, '2026-11-05'); ok(rn.deploy === undefined, '투입 확인 서버 함수가 연결되지 않았으면 deploy 는 undefined(구역을 그리지 않음)');
  const rf = await makeCareerIo(Object.assign({}, fd, { callDeploy: async () => { throw new Error('x'); } })).load({ id: 'w1', name: 'x' }, '2026-11-05'); ok(rf.deploy === null && rf.errors.includes('투입 확인') && rf.data.worker.id === 'w1', '투입 확인 현황을 못 읽어도 경력관리의 나머지는 그대로(deploy=null, 오류에 「투입 확인」)');
  const ld = await makeCareerIo(Object.assign({}, fd, { callDeploy: okDeploy })).loadDeploy({ id: 'w7' }); ok(ld.worker.id === 'w7' && dcalls[dcalls.length - 1].workerId === 'w7', 'loadDeploy: 연결·해제 뒤에 현황만 다시 읽음');
  console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
})();
