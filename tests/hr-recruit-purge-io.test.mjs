import { makePurgeIo } from '../app/modules/hr/recruit-purge-io.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const rej = async (fn) => { try { await fn(); return null; } catch (e) { return String((e && e.message) || e); } };
const TODAY = '2026-12-31'; const clone = (o) => JSON.parse(JSON.stringify(o));
function mk(seed) { const store = clone(seed); const log = { batches: [], updates: [] };
  const fb = { db: {}, doc: (db, c, id) => ({ path: c + '/' + id }), serverTimestamp: () => '__ts__',
    getDoc: async (ref) => ({ exists: () => ref.path in store, data: () => clone(store[ref.path]) }),
    updateDoc: async (ref, data) => { if (!(ref.path in store)) throw new Error('not-found'); log.updates.push([ref.path, clone(data)]); store[ref.path] = Object.assign({}, store[ref.path], data); },
    writeBatch: () => { const ops = []; return { set: (ref, data, opts) => ops.push([ref.path, clone(data), opts]), commit: async () => { log.batches.push(ops.length); ops.forEach(([p, d, o]) => { store[p] = o && o.merge ? Object.assign({}, store[p], d) : d; }); } }; } };
  return { store, log, io: makePurgeIo(fb) }; }
const app = (o) => Object.assign({ jobKey: 'j1', jobTitle: '사무직', status: 'new', name: '가나다', phone: '010-1111-2222', email: 'a@b.c', address: '서울', birth: '1990-01-01', educations: [{ s: 'X' }], createdAt: { seconds: 1 } }, o || {});
const seed = () => ({ 'job_postings/j1': { title: '사무직', status: 'closed', decidedDate: '2026-10-01', retentionDays: 90 }, 'job_postings/j2': { title: '현장직', status: 'open' }, 'recruit_applicants/due1': app(), 'recruit_applicants/due2': app({ status: 'review', name: '라마바' }), 'recruit_applicants/pass1': app({ status: 'pass', name: '합격자' }), 'recruit_applicants/early': app({ jobKey: 'j2' }), 'recruit_applicants/gone': app({ status: 'destroyed', name: undefined, phone: undefined }), 'recruit_applicants/ghost': app({ jobKey: 'nope' }) });
// ── 공고 설정 저장
let t = mk(seed()); let r = await t.io.saveSettings('j1', '2026-10-05', '60');
ok(r.decidedDate === '2026-10-05' && r.retentionDays === 60 && t.store['job_postings/j1'].decidedDate === '2026-10-05' && t.store['job_postings/j1'].retentionDays === 60 && t.store['job_postings/j1'].title === '사무직' && t.store['job_postings/j1'].updatedAt === '__ts__' && t.log.updates.length === 1, '설정 저장: 확정일·보관기간만 바꾸고 제목 등 다른 필드는 그대로, 수정 시각 기록');
ok((await t.io.saveSettings('j2', '', '')).retentionDays === 90 && t.store['job_postings/j2'].decidedDate === '' && t.store['job_postings/j2'].retentionDays === 90, '비우면 확정일 지움·기본 90일');
ok(/14~180일/.test(await rej(() => t.io.saveSettings('j1', '2026-10-05', '10'))) && /확정일/.test(await rej(() => t.io.saveSettings('j1', 'x', '90'))) && /공고/.test(await rej(() => t.io.saveSettings('', '2026-10-05', '90'))) && t.store['job_postings/j1'].retentionDays === 60, '잘못된 값·공고 없음은 저장하지 않고 이유와 함께 예외');
ok(/not-found/.test(await rej(() => t.io.saveSettings('없는공고', '2026-10-05', '90'))), '없는 공고에 저장하려 하면 예외(조용히 만들지 않는다)');
// ── 파기
t = mk(seed()); r = await t.io.destroy(['due1', 'due2', 'pass1', 'early', 'gone', 'ghost', 'missing'], ' Admin@JHSOL.kr ', TODAY);
ok(r.destroyed === 2 && r.skipped.length === 5 && t.log.batches.join() === '2', '여러 건: 기한 지난 2건만 파기(한 번에 저장), 나머지 5건은 건너뜀');
const why = Object.fromEntries(r.skipped.map((x) => [x.id, x.reason])); ok(/합격자/.test(why.pass1) && /기한/.test(why.early) && /이미 파기/.test(why.gone) && /기한/.test(why.ghost) && /찾을 수 없음/.test(why.missing), '건너뛴 이유: 합격자·확정일 없음(기한 미도래 포함 설명)·이미 파기·공고 없음·문서 없음');
const d1 = t.store['recruit_applicants/due1']; ok(d1.status === 'destroyed' && d1.destroyedBy === 'admin@jhsol.kr' && d1.prevStatus === 'new' && d1.jobTitle === '사무직' && Object.keys(d1).length === 8 && !JSON.stringify(d1).match(/가나다|010-|a@b|서울|1990|educations/), '파기된 문서: 최소 기록 8개 항목뿐, 개인정보가 하나도 남지 않는다(전체 교체)');
ok(t.store['recruit_applicants/pass1'].name === '합격자' && t.store['recruit_applicants/early'].name === '가나다' && t.store['recruit_applicants/ghost'].phone === '010-1111-2222', '건너뛴 지원서(합격자·미도래·공고 없음)는 그대로 남는다');
ok(typeof d1.destroyedAt === 'string' && !Number.isNaN(Date.parse(d1.destroyedAt)) && d1.createdAt.seconds === 1, '파기 시각은 실제 시각, 접수 시각은 보존');
// 화면을 열어 둔 사이 상태가 바뀐 경우
t = mk(seed()); t.store['recruit_applicants/due1'].status = 'pass'; r = await t.io.destroy(['due1'], 'a@b.c', TODAY);
ok(r.destroyed === 0 && t.store['recruit_applicants/due1'].name === '가나다' && /합격자/.test(r.skipped[0].reason) && t.log.batches.length === 0, '★ 화면을 연 뒤 합격 처리된 지원서는 파기되지 않는다(누르는 순간 다시 읽어 확인, 저장 호출도 없음)');
t = mk(seed()); t.store['job_postings/j1'].decidedDate = ''; r = await t.io.destroy(['due1', 'due2'], 'a@b.c', TODAY); ok(r.destroyed === 0 && r.skipped.length === 2 && t.store['recruit_applicants/due2'].name === '라마바', '★ 그 사이 공고의 채용 확정일이 지워졌으면 파기하지 않는다');
t = mk(seed()); t.store['job_postings/j1'].retentionDays = 180; r = await t.io.destroy(['due1'], 'a@b.c', TODAY); ok(r.destroyed === 0 && /기한/.test(r.skipped[0].reason), '★ 그 사이 보관기간이 180일로 늘었으면(예정일 2027-03-30) 파기하지 않는다');
t = mk(seed()); r = await t.io.destroy(['due1'], 'a@b.c', '2026-12-30'); ok(r.destroyed === 0, '★ 예정일 당일(12-30)에는 파기하지 않는다(다음 날부터)'); r = await t.io.destroy(['due1'], 'a@b.c', '2026-12-31'); ok(r.destroyed === 1, '예정일 다음 날(12-31)에는 파기된다');
t = mk(seed()); await t.io.destroy(['due1'], 'a@b.c', TODAY); r = await t.io.destroy(['due1'], 'a@b.c', TODAY); ok(r.destroyed === 0 && /이미 파기/.test(r.skipped[0].reason), '같은 지원서를 두 번 파기하려 해도 한 번만(두 번째는 건너뜀)');
ok(/이메일/.test(await rej(() => mk(seed()).io.destroy(['due1'], '', TODAY))) && /이메일/.test(await rej(() => mk(seed()).io.destroy(['due1'], '   ', TODAY))) && /이메일/.test(await rej(() => mk(seed()).io.destroy(['due1'], undefined, TODAY))), '누가 파기하는지 알 수 없으면(로그인 정보 없음) 파기하지 않고 예외');
t = mk(seed()); r = await t.io.destroy([], 'a@b.c', TODAY); ok(r.destroyed === 0 && r.skipped.length === 0 && (await t.io.destroy(null, 'a@b.c', TODAY)).destroyed === 0, '대상이 없으면 아무 일도 하지 않는다');
// 큰 묶음은 400건씩 나눠 저장
const big = { 'job_postings/j1': { title: '사무직', decidedDate: '2026-10-01', retentionDays: 90 } }; const ids = []; for (let i = 0; i < 850; i++) { big['recruit_applicants/b' + i] = app({ status: 'fail' }); ids.push('b' + i); }
t = mk(big); r = await t.io.destroy(ids, 'a@b.c', TODAY); ok(r.destroyed === 850 && t.log.batches.join() === '400,400,50' && ids.every((i) => t.store['recruit_applicants/' + i].status === 'destroyed'), '850건: 400·400·50건으로 나눠 저장, 전부 파기');
// 읽기 실패는 숨기지 않는다
const t2 = mk(seed()); const io2 = makePurgeIo({ db: {}, doc: (d, c, i) => ({ path: c + '/' + i }), serverTimestamp: () => 1, updateDoc: async () => {}, writeBatch: () => ({ set() {}, commit: async () => {} }), getDoc: async () => { throw new Error('permission-denied'); } });
ok(/permission-denied/.test(await rej(() => io2.destroy(['due1'], 'a@b.c', TODAY))), '읽기에 실패하면 파기하지 않고 예외');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
