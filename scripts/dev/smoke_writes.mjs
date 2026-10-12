/* 저장·삭제 동작 점검: 가짜 브라우저·가짜 Firestore 로 화면을 실제로 조작(입력→저장 버튼→확인 창 승인)하고,
 * "올바른 문서 경로에 올바른 값이 써졌는가"를 확인한다. smoke_ui 가 못 보는 쓰기 경로(저장 눌렀는데 아무것도 안 써지거나 엉뚱한 곳에 써지는 문제)를 잡는다.
 * 사용: cd scripts/dev && node --import ./smoke_register.mjs smoke_writes.mjs [--verbose]
 * 한계: 서버 함수·보안 규칙·실제 데이터는 못 본다(가짜 저장소는 모든 쓰기를 허용). */
import { w, D, errors, sleep, markDone } from './smoke_env.mjs';
const verbose = process.argv.includes('--verbose');
const hrMod = await import(new URL('../../app/modules/hr/index.js', import.meta.url).href); const genMod = await import(new URL('../../app/modules/general/index.js', import.meta.url).href);
const ctx = { me: { admin: true, uid: 'u1', name: '관리자', email: 'a@jhsol.kr', perms: {} } };
const idCalls = []; globalThis.JH_IDENTITY = { save: async (kind, id, jumin) => { idCalls.push({ kind, id, jumin }); return { ok: true }; }, reveal: async () => ({ found: true, jumin: '9001011234567' }), maskView: (m) => m };
const WR = () => globalThis.__WRITES;
const click = async (root, sel, ms = 80) => { const el = root.querySelector(sel); if (!el) throw new Error('요소 없음: ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(ms); };
const setv = async (root, sel, val) => { const el = root.querySelector(sel); if (!el) throw new Error('입력 칸 없음: ' + sel); el.value = val; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(50); };
const confirmOk = async () => { await sleep(60); const b = document.querySelector('.jh-dialog [data-ok]'); if (!b) return false; b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(120); return true; };
const mountFresh = async (fn, route) => { const root = document.createElement('div'); document.body.appendChild(root); await Promise.race([fn(root, route || { segs: [], query: {} }, ctx), sleep(2500)]); await sleep(150); return root; };
const wrote = (op, re) => WR().filter((x) => x.op === op && re.test(x.path));
const results = []; let failed = 0;
async function scenario(name, fn) {
  errors.length = 0; WR().length = 0; idCalls.length = 0; document.querySelectorAll('.jh-dialog').forEach((d) => d.remove()); const problems = [];
  const check = (cond, msg) => { if (!cond) problems.push(msg); };
  try { await fn(check); } catch (e) { problems.push('예외: ' + String((e && e.message) || e).slice(0, 160)); }
  if (errors.length) problems.push('오류: ' + errors[0].slice(0, 200));
  if (problems.length) { failed++; console.log('✗ ' + name + '\n    ' + problems.join('\n    ')); if (verbose) console.log('    쓰기 기록:', JSON.stringify(WR()).slice(0, 700)); } else console.log('✓ ' + name + (verbose ? ' ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)).slice(0, 300) : ''));
}
const hasNo = (obj, keys) => keys.every((k) => !(k in (obj || {})));

await scenario('근로자 명부 — 신규 등록: 일반 정보는 workers, 주소·계좌는 worker_private, 주민번호는 문서에 쓰지 않고 서버 함수로', async (check) => {
  const root = await mountFresh(hrMod.mountWorkers); await click(root, '[data-w-act="reg-new"]');
  const f = { name: '신입사원', jumin: '9801011234567', phone: '01099998888', email: 'new@jhsol.kr', address: '대전 유성구', rank: '사원', job: '배관', bankAccount: '국민 123-45', hireDate: '2026-10-01' };
  for (const [k, v] of Object.entries(f)) await setv(root, '[data-w-rf="' + k + '"]', v);
  await setv(root, '[data-w-rf="dept"]', 'PJT팀'); await setv(root, '[data-w-rf="empType"]', 'field');
  await click(root, '[data-w-act="reg-save"]', 200);
  const ws = wrote('set', /^workers\/w_[0-9a-f]{16}$/), ps = wrote('set', /^worker_private\/w_[0-9a-f]{16}$/);
  check(ws.length === 1, 'workers 문서가 1건 만들어져야 함(실제 ' + ws.length + ')');
  if (ws[0]) { const d = ws[0].data; check(d.name === '신입사원' && d.dept === 'PJT팀' && d.empType === 'field' && d.hireDate === '2026-10-01' && /^\d{5}$/.test(d.empNo) && !!d.registeredAt, 'workers 값(이름·소속·구분·입사일·사번·등록시각) 이상: ' + JSON.stringify(d).slice(0, 200)); check(hasNo(d, ['jumin', 'juminMasked', 'birth6', 'bankAccount', 'address']), 'workers 에 주민번호·계좌·주소가 섞여 들어감'); }
  check(ps.length >= 1 && ps[0].data.address === '대전 유성구' && ps[0].data.bankAccount === '국민 123-45' && !('jumin' in ps[0].data), 'worker_private 에 주소·계좌만(주민번호 없이) 저장되어야 함: ' + JSON.stringify(ps[0] && ps[0].data));
  check(idCalls.length === 1 && idCalls[0].kind === 'hr' && idCalls[0].jumin === '9801011234567' && idCalls[0].id === (ws[0] || {}).path.split('/')[1], '주민번호는 서버 함수(identity.save)로 13자리 숫자 저장: ' + JSON.stringify(idCalls));
});
await scenario('근로자 명부 — 수정: 직급 변경 이력·가족/자녀/비율은 개인정보 쪽, 주민번호는 건드리지 않음', async (check) => {
  const root = await mountFresh(hrMod.mountWorkers); await click(root, '[data-w-open="w1"]');
  await setv(root, '[data-w-f="rank"]', '과장'); await setv(root, '[data-w-f="taxFamily"]', '4'); await setv(root, '[data-w-f="taxChildren"]', '2'); await setv(root, '[data-w-f="taxRate"]', '120');
  await click(root, '[data-w-act="save"]', 200); await confirmOk(); await sleep(150);
  const w1 = wrote('set', /^workers\/w1$/), p1 = wrote('set', /^worker_private\/w1$/), hist = WR().filter((x) => x.op === 'add' && /^workers\/w1\/history\//.test(x.path));
  check(w1.length >= 1 && w1[0].merge === true && w1[0].data.rank === '과장' && hasNo(w1[0].data, ['jumin', 'taxFamily', 'bankAccount']), 'workers/w1 에 직급 변경이 병합 저장되어야 함: ' + JSON.stringify(w1[0] && w1[0].data));
  check(p1.length >= 1 && p1[0].data.taxFamily === 4 && p1[0].data.taxChildren === 2 && p1[0].data.taxRate === 120, 'worker_private/w1 에 가족 4·자녀 2·비율 120 저장: ' + JSON.stringify(p1[0] && p1[0].data));
  check(hist.length === 1 && hist[0].data.type === 'rank' && hist[0].data.fromRank === '대리' && hist[0].data.toRank === '과장', '직급 변경 이력(workers/w1/history)이 남아야 함: ' + JSON.stringify(hist[0] && hist[0].data));
  check(idCalls.length === 0, '주민번호 칸을 비웠으므로 서버 저장을 부르면 안 됨');
});
await scenario('근로자 명부 — 퇴직 처리: 삭제가 아니라 status=resigned + 퇴직일', async (check) => {
  const root = await mountFresh(hrMod.mountWorkers); await click(root, '[data-w-open="w1"]'); await setv(root, '[data-w-f="resignDate"]', '2026-10-31').catch(() => {});
  await click(root, '[data-w-act="resign"]'); await confirmOk();
  const r = wrote('set', /^workers\/w1$/); check(r.length >= 1 && r[0].data.status === 'resigned' && /^\d{4}-\d{2}-\d{2}$/.test(r[0].data.resignDate) && r[0].merge === true, '퇴직 처리: workers/w1 에 status=resigned·resignDate 병합 저장: ' + JSON.stringify(r[0] && r[0].data)); check(wrote('delete', /^workers\//).length === 0, '퇴직 처리가 문서를 삭제하면 안 됨');
});
await scenario('급여명세서 — 확정 저장: payslips/{근로자}/months/{월}, 양식 v7·사용 요율(2026)·지급계 기록', async (check) => {
  const root = await mountFresh(hrMod.mountPayslip); await setv(root, '[data-p-month]', '2026-10'); await setv(root, '[data-p-worker]', 'w1'); await sleep(900);
  await click(root, '[data-p-act="save"]', 200); await confirmOk(); await sleep(200);
  const p = wrote('set', /^payslips\/w1\/months\/2026-10$/); check(p.length === 1, 'payslips/w1/months/2026-10 이 1건 저장되어야 함(실제 ' + p.length + '): ' + JSON.stringify(WR().map((x) => x.path)));
  if (p[0]) { const d = p[0].data; check(d.tplVer === 'v7' && d.insRates && d.insRates.pension === 0.0475 && d.insRates.health === 0.03595 && d.insRates.ltcare === 0.1314, '양식 v7 과 2026 요율 기록 이상: ' + JSON.stringify({ t: d.tplVer, r: d.insRates })); check(Number.isFinite(d.grossPay) && Number.isFinite(d.netPay) && d.name === '김가나' && d.month === '2026-10', '지급계·실지급액·이름·월 기록 이상'); check(d.pension === Math.round(d.grossPay * 0.0475), '국민연금이 지급계×4.75% 여야 함(' + d.pension + ' vs ' + Math.round(d.grossPay * 0.0475) + ')'); }
});
await scenario('퇴직금 정산 — 저장: severance/{근로자}/records/{마지막 근무일}, 법적 퇴직일·산정기간 포함', async (check) => {
  const root = await mountFresh(hrMod.mountRetire); await setv(root, '[data-t-date]', '2026-09-30'); await setv(root, '[data-t-worker]', 'w1'); await sleep(900);
  await click(root, '[data-t-act="save"]', 200); await confirmOk(); await sleep(200);
  const s = wrote('set', /^severance\/w1\/records\/2026-09-30$/); check(s.length === 1, 'severance/w1/records/2026-09-30 이 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.path)));
  if (s[0]) { const d = s[0].data; check(d.legalRetireDate === '2026-10-01' && d.periodStart === '2026-07-01' && d.retireDate === '2026-09-30' && d.payDeadline === '2026-10-15' && !!d.savedAt, '법적 퇴직일·산정기간·지급기한 기록 이상: ' + JSON.stringify(d).slice(0, 260)); }
});

const contractScenario = (title, mountName, col, ver, needsPeriod) => scenario(title, async (check) => {
  const root = await mountFresh(hrMod[mountName]); await click(root, '[data-an-act="new"]'); await setv(root, '[data-an-worker]', 'w1'); await sleep(700); await setv(root, '[data-an-f="contractDate"]', '2026-10-13'); await setv(root, '[data-an-pay]', '12000');
  await click(root, '[data-an-act="save"]', 250); await confirmOk(); await sleep(250);
  const c = WR().filter((x) => x.op === 'set' && new RegExp('^' + col + '/w1/contracts/').test(x.path)); check(c.length === 1, col + '/w1/contracts/<계약일> 이 1건 저장되어야 함(실제 ' + c.length + '): ' + JSON.stringify(WR().map((x) => x.path)));
  if (c[0]) { const d = c[0].data; check(d.workerId === 'w1' && d.name === '김가나' && d.tplVer === ver && !!d.savedAt && !!d.contractDate && (!needsPeriod || (!!d.startDate && !!d.endDate)), '계약서 값(근로자·이름·양식 ' + ver + '·저장시각·계약일' + (needsPeriod ? '·기간' : '') + ') 이상: ' + JSON.stringify(d).slice(0, 240)); check(!/\d{6}-?\d{7}/.test(JSON.stringify(d)), '계약서에 주민번호 전체가 들어감(마스킹이어야 함)'); check(c[0].path.endsWith('/' + String(d.contractDate).replace(/-/g, '')) || c[0].path.endsWith('/' + d.contractDate), '문서 번호가 계약일 기반이어야 함: ' + c[0].path); }
});
await contractScenario('연봉계약서 — 확정 저장: annual_contracts/{근로자}/contracts/{계약일}, 양식 v6', 'mountAnnual', 'annual_contracts', 'v6', true);
await contractScenario('근로계약서 — 확정 저장: labor_contracts/{근로자}/contracts/{계약일}, 양식 v6', 'mountLabor', 'labor_contracts', 'v6', false);   // 근로계약서는 계약기간 없이도 저장된다(구포털과 같음 — 필수로 할지는 대표님 결정)
await scenario('초과근로 — 입력 저장 / 삭제: overtime 에 근로자·시간·금액·월, 삭제는 해당 문서만', async (check) => {
  const root = await mountFresh(hrMod.mountOvertime); await click(root, '[data-ot-new]'); await setv(root, '[data-ot-fw]', 'w1'); await setv(root, '[data-ot-f="date"]', '2026-10-13'); await setv(root, '[data-ot-f="hours"]', '2'); await setv(root, '[data-ot-f="reason"]', '야간 입고'); await sleep(300);
  await click(root, '[data-ot-act="save"]', 250); await confirmOk(); await sleep(200);
  check(WR().some((x) => x.op === 'set' && x.path === 'overtime/edoc_e1'), '화면을 열 때 승인된 전자결재 초과근로가 고정 번호(overtime/edoc_<번호>)로 한 번만 자동 반영되어야 함');
  const o = WR().filter((x) => x.op === 'add' && /^overtime\//.test(x.path)); check(o.length === 1, '직접 입력한 초과근로가 overtime 에 1건 추가되어야 함(실제 ' + o.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (o[0]) { const d = o[0].data; check(d.workerId === 'w1' && d.name === '김가나' && Number(d.hours) === 2 && d.date === '2026-10-13' && String(d.yearMonth || d.date).slice(0, 7) === '2026-10' && Number(d.amount) > 0 && d.reason === '야간 입고', '초과근로 값(근로자·이름·시간·날짜·월·금액·사유) 이상: ' + JSON.stringify(d).slice(0, 260)); }
  WR().length = 0; const root2 = await mountFresh(hrMod.mountOvertime); await click(root2, '[data-ot-del="o1"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.length === 1 && del[0].path === 'overtime/o1', '삭제는 overtime/o1 한 건만: ' + JSON.stringify(del.map((x) => x.path)));
});
await scenario('연차 현황 — 관리자 등록: edoc_leave 에 관리자 등록분으로 저장(근로자·종류·기간·일수)', async (check) => {
  const root = await mountFresh(hrMod.mountLeaves, { segs: ['w1'], query: {} }); await click(root, '[data-l-new="김가나"]'); await sleep(150);
  await setv(root, '[data-lv-f="startDate"]', '2026-10-20'); await setv(root, '[data-lv-f="endDate"]', '2026-10-21'); await setv(root, '[data-lv-f="note"]', '개인 사유');
  await click(root, '[data-lv-act="save"]', 250); await confirmOk(); await sleep(200);
  const l = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^edoc_leave\//.test(x.path)); check(l.length === 1, 'edoc_leave 문서가 1건 저장되어야 함(실제 ' + l.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (l[0]) { const d = l[0].data; check(d.startDate === '2026-10-20' && d.endDate === '2026-10-21' && Number(d.days) === 2 && d.leaveType === '연차' && d.adminCreated === true && (d.authorName === '김가나' || d.workerName === '김가나' || d.name === '김가나'), '연차 값(기간·일수 2·관리자 등록 표시·근로자) 이상: ' + JSON.stringify(d).slice(0, 280)); }
});
await scenario('연차사용촉진 — 1차 촉진서 "기록만 등록": leave_promotions/{근로자}/records 에 단계·구간·일자', async (check) => {
  const root = await mountFresh(hrMod.mountLeavePromo); await click(root, '[data-lp-open="w1|p1|y1"]'); await sleep(150); await click(root, '[data-lp-rec]'); await sleep(100);
  await click(root, '[data-lp-act="issue"]', 250); await confirmOk(); await sleep(200);
  const r = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^leave_promotions\/w1\/records\//.test(x.path)); check(r.length === 1, 'leave_promotions/w1/records 가 1건 저장되어야 함(실제 ' + r.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (r[0]) { const d = r[0].data; check(d.stage === 'p1' && d.category === 'y1' && d.recordOnly === true && !!d.noticeDate, '촉진 기록 값(단계 p1·구간 y1·기록만·통보일) 이상: ' + JSON.stringify(d).slice(0, 260)); }
});
await scenario('급여테이블 — 저장: company_settings/salaryTable', async (check) => {
  const root = await mountFresh(hrMod.mountSalary); await setv(root, '[data-s-field="minWage"]', '10500'); await click(root, '[data-s-act="save"]', 250); await confirmOk(); await sleep(200);
  const s = wrote('set', /^company_settings\/salaryTable$/); check(s.length === 1 && Number(s[0].data.minWage) === 10500, 'company_settings/salaryTable 에 최저임금 10500 저장: ' + JSON.stringify(s[0] && s[0].data).slice(0, 200)); if (s[0]) check(!('track' in s[0].data) && !JSON.stringify(s[0].data).includes('고졸') && !JSON.stringify(s[0].data).includes('전공'), '급여테이블에 학력 트랙이 다시 들어가면 안 됨');
});
await scenario('해고예고통지서 — 임시저장: dismissal_notices 에 초안 상태로', async (check) => {
  const root = await mountFresh(hrMod.mountDismissal); await setv(root, '[data-d-pick]', 'w1'); await sleep(300); await click(root, '[data-d-act="draft"]', 250); await confirmOk(); await sleep(200);
  const d = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^dismissal_notices\//.test(x.path)); check(d.length === 1, 'dismissal_notices 가 1건 저장되어야 함(실제 ' + d.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path))); if (d[0]) check(/draft|임시/.test(JSON.stringify(d[0].data)) && d[0].data.workerId === 'w1', '초안 상태·근로자 기록 이상: ' + JSON.stringify(d[0].data).slice(0, 240));
});

await scenario('총무 — 차량 추가: general_vehicles 에 이름·번호판·상태, 삭제 없이 한 건', async (check) => {
  const root = await mountFresh(genMod.mountSection, { segs: ['vehicle'], query: {} }); await click(root, '[data-g-add]'); await setv(root, '[data-gf="name"]', '스타리아'); await setv(root, '[data-gf="plate"]', '123가4567'); await setv(root, '[data-gf="monthly"]', '650000');
  await click(root, '[data-g-act="save"]', 250); await confirmOk(); await sleep(200);
  const v = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^general_vehicles\//.test(x.path)); check(v.length === 1, 'general_vehicles 가 1건 저장되어야 함(실제 ' + v.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (v[0]) check(v[0].data.name === '스타리아' && v[0].data.plate === '123가4567' && Number(v[0].data.monthly) === 650000, '차량 값(이름·번호판·월 납부액) 이상: ' + JSON.stringify(v[0].data).slice(0, 240)); check(WR().filter((x) => x.op === 'delete').length === 0, '저장이 다른 문서를 지우면 안 됨');
});
await scenario('공고 관리 — 등록: job_postings 에 제목·근무지, 학력 항목 없음', async (check) => {
  const root = await mountFresh(hrMod.mountPostings); await click(root, '[data-j-new]'); await setv(root, '[data-j-f="title"]', '전기 기능공 모집'); await setv(root, '[data-j-f="location"]', '대전'); await setv(root, '[data-j-f="duties"]', '배선 작업');
  await click(root, '[data-j-act="save"]', 250); await confirmOk(); await sleep(200);
  const j = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^job_postings\//.test(x.path)); check(j.length === 1, 'job_postings 가 1건 저장되어야 함(실제 ' + j.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (j[0]) { const d = j[0].data; check(d.title === '전기 기능공 모집' && !!d.status, '공고 값(제목·상태) 이상: ' + JSON.stringify(d).slice(0, 240)); check(!/education|학력/.test(JSON.stringify(Object.keys(d))) || d.education === '' || d.education === undefined, '공고에 학력 선택지가 다시 들어가면 안 됨(education 은 빈 값만): ' + JSON.stringify(d.education)); }
});
markDone(); console.log('\n' + (failed ? '문제가 있는 저장 동작 ' + failed + '건' : '모든 저장 동작이 올바른 경로·값으로 기록됨')); process.exit(failed ? 1 : 0);
