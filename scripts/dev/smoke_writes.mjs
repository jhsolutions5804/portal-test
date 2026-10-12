/* 저장·삭제 동작 점검: 가짜 브라우저·가짜 Firestore 로 화면을 실제로 조작(입력→저장 버튼→확인 창 승인)하고,
 * "올바른 문서 경로에 올바른 값이 써졌는가"를 확인한다. smoke_ui 가 못 보는 쓰기 경로(저장 눌렀는데 아무것도 안 써지거나 엉뚱한 곳에 써지는 문제)를 잡는다.
 * 사용: cd scripts/dev && node --import ./smoke_register.mjs smoke_writes.mjs [--verbose]
 * 한계: 서버 함수·보안 규칙·실제 데이터는 못 본다(가짜 저장소는 모든 쓰기를 허용). */
import { w, D, errors, sleep, markDone, today } from './smoke_env.mjs';
const verbose = process.argv.includes('--verbose');
const planMod = await import(new URL('../../app/modules/plan/index.js', import.meta.url).href); const hrMod = await import(new URL('../../app/modules/hr/index.js', import.meta.url).href); const genMod = await import(new URL('../../app/modules/general/index.js', import.meta.url).href);
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
  if (mountName === 'mountLabor') { await click(root, '[data-an-act="save"]', 250); await confirmOk(); check(WR().filter((x) => x.op === 'set').length === 0, '계약기간을 비운 근로계약서는 저장되면 안 됨'); await setv(root, '[data-an-f="startDate"]', '2026-10-13'); await setv(root, '[data-an-f="endDate"]', '2027-10-12'); }
  await click(root, '[data-an-act="save"]', 250); await confirmOk(); await sleep(250);
  const c = WR().filter((x) => x.op === 'set' && new RegExp('^' + col + '/w1/contracts/').test(x.path)); check(c.length === 1, col + '/w1/contracts/<계약일> 이 1건 저장되어야 함(실제 ' + c.length + '): ' + JSON.stringify(WR().map((x) => x.path)));
  if (c[0]) { const d = c[0].data; check(d.workerId === 'w1' && d.name === '김가나' && d.tplVer === ver && !!d.savedAt && !!d.contractDate && (!needsPeriod || (!!d.startDate && !!d.endDate)), '계약서 값(근로자·이름·양식 ' + ver + '·저장시각·계약일' + (needsPeriod ? '·기간' : '') + ') 이상: ' + JSON.stringify(d).slice(0, 240)); check(!/\d{6}-?\d{7}/.test(JSON.stringify(d)), '계약서에 주민번호 전체가 들어감(마스킹이어야 함)'); check(c[0].path.endsWith('/' + String(d.contractDate).replace(/-/g, '')) || c[0].path.endsWith('/' + d.contractDate), '문서 번호가 계약일 기반이어야 함: ' + c[0].path); }
});
await contractScenario('연봉계약서 — 확정 저장: annual_contracts/{근로자}/contracts/{계약일}, 양식 v6', 'mountAnnual', 'annual_contracts', 'v6', true);
await contractScenario('근로계약서 — 확정 저장: labor_contracts/{근로자}/contracts/{계약일}, 양식 v6', 'mountLabor', 'labor_contracts', 'v6', true);
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

await scenario('인사 변동 — 직급·소속 변경: workers 병합 저장 + 변경 이력 + 호봉 초기화 + 포털 계정 반영', async (check) => {
  const root = await mountFresh(hrMod.mountChange); await setv(root, '[data-c-sel]', 'w1'); await sleep(200); await setv(root, '[data-c-f="rank"]', '과장'); await setv(root, '[data-c-f="reason"]', '정기 승진');
  await click(root, '[data-c-act="save"]', 250); await confirmOk(); await sleep(250);
  const w1 = wrote('set', /^workers\/w1$/).concat(wrote('update', /^workers\/w1$/)); check(w1.length >= 1 && w1.some((x) => x.data.rank === '과장'), 'workers/w1 에 직급 과장이 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  const h = WR().filter((x) => x.op === 'add' && /^workers\/w1\/history\//.test(x.path)); check(h.length === 1 && h[0].data.fromRank === '대리' && h[0].data.toRank === '과장' && h[0].data.reason === '정기 승진', '변경 이력(workers/w1/history)에 대리→과장·사유가 남아야 함: ' + JSON.stringify(h[0] && h[0].data));
  check(w1.some((x) => x.data.step === 1) || WR().some((x) => x.data && x.data.step === 1), '직급이 바뀌면 호봉을 1로 초기화해야 함(별도 지정이 없으면)');
  check(WR().some((x) => /^portal_users\/u2$/.test(x.path) && x.data.rank === '과장'), '연동된 포털 계정(portal_users/u2)에 직급이 반영되어야 함: ' + JSON.stringify(WR().filter((x) => /portal_users/.test(x.path)).map((x) => x.path + JSON.stringify(x.data))));
});
await scenario('연봉 제안서 — 저장: salary_offers 에 제안 내용, 이메일은 보내지 않음', async (check) => {
  const root = await mountFresh(hrMod.mountOffers); await setv(root, '[data-o-f="name"]', '김후보'); await setv(root, '[data-o-f="dept"]', 'PJT팀'); await setv(root, '[data-o-f="rank"]', '사원'); await setv(root, '[data-o-m="amount"]', '36000000'); await sleep(200);
  await click(root, '[data-o-act="save"]', 250); await confirmOk(); await sleep(250);
  const o = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^salary_offers\//.test(x.path)); check(o.length === 1, 'salary_offers 가 1건 저장되어야 함(실제 ' + o.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (o[0]) check(o[0].data.name === '김후보' && o[0].data.kind === 'new' && !!(o[0].data.savedAt || o[0].data.createdAt), '제안서 값(이름·구분·저장 시각) 이상: ' + JSON.stringify(o[0].data).slice(0, 260));
});
await scenario('채용 지원자 — 상태 변경·삭제: recruit_applicants 문서의 status 만 바뀌고, 삭제는 해당 지원자와 그 면접 일정만', async (check) => {
  const root = await mountFresh(hrMod.mountApplicants); await setv(root, '[data-a-status="a1"]', 'pass'); await sleep(250);
  const u = WR().filter((x) => (x.op === 'update' || x.op === 'set') && x.path === 'recruit_applicants/a1'); check(u.length >= 1 && u.some((x) => x.data.status === 'pass'), '상태가 합격(pass)으로 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path + JSON.stringify(x.data || {}).slice(0, 60))));
  WR().length = 0; const r2 = await mountFresh(hrMod.mountApplicants); await click(r2, '[data-a-del="a1"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.some((x) => x.path === 'recruit_applicants/a1') && del.every((x) => ['recruit_applicants/a1', 'hr_calendar_events/interview_a1'].includes(x.path)), '삭제는 지원자 문서와 그 면접 일정(hr_calendar_events/interview_a1)만: ' + JSON.stringify(del.map((x) => x.path)));
});
await scenario('인사평가 — 호봉 직접 입력: 근로자 호봉(step·stepYear)만 workers 에 병합 저장', async (check) => {
  const root = await mountFresh(hrMod.mountEvals); await setv(root, '[data-e-step="w1"]', '7'); await sleep(250); const el = root.querySelector('[data-e-step="w1"]'); el.dispatchEvent(new w.Event('blur', { bubbles: true })); el.dispatchEvent(new w.Event('focusout', { bubbles: true })); await sleep(250);
  const u = WR().filter((x) => /^workers\/w1$/.test(x.path)); check(u.length >= 1 && u.some((x) => Number(x.data.step) === 7 && !!x.data.stepYear), '호봉 7 이 workers/w1 에 step·stepYear 로 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path + JSON.stringify(x.data || {}).slice(0, 70))));
});

await scenario('퇴직금 정산 — 미사용 연차 정산(참고) 카드와 "연차수당 합계에 넣기": 입력칸이 채워지고 평균임금에 가산 반영, 저장은 일어나지 않음', async (check) => {
  const root = await mountFresh(hrMod.mountRetire); await setv(root, '[data-t-date]', '2026-09-30'); await setv(root, '[data-t-worker]', 'w1'); await sleep(900);
  check(/미사용 연차 정산/.test(root.textContent), '④ 미사용 연차 정산 카드가 보여야 함'); const before = root.textContent.includes('연차수당 가산');
  await click(root, '[data-t-leavefill]', 400); await sleep(500);
  const inp = root.querySelector('[data-t-opt="leave12"]'); check(inp && /\d/.test(inp.value), '연차수당 합계 입력칸이 채워져야 함: ' + (inp && inp.value)); check(!before && /연차 상여·연차수당 가산|상여·연차수당 가산/.test(root.textContent), '평균임금 산정 표에 연간 상여·연차수당 가산 줄이 나타나야 함'); check(WR().filter((x) => x.op === 'set' && /^severance\//.test(x.path)).length === 0, '넣기 버튼은 정산을 저장하면 안 됨');
});

await scenario('근로자 면담 — 기록 저장 / 삭제: interviews/{근로자}/records, 삭제는 해당 기록만', async (check) => {
  const root = await mountFresh(hrMod.mountInterviews); await click(root, '[data-i-open="w1"]'); await setv(root, '[data-i-f="date"]', today); await setv(root, '[data-i-f="memo"]', '업무 적응 면담, 현장 배치 희망');
  await click(root, '[data-i-act="save"]', 250); await confirmOk(); await sleep(200);
  const i = WR().filter((x) => (x.op === 'add' || x.op === 'set') && /^interviews\/w1\/records\//.test(x.path)); check(i.length === 1, 'interviews/w1/records 가 1건 저장되어야 함(실제 ' + i.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (i[0]) check(i[0].data.date === today && /현장 배치/.test(i[0].data.memo || ''), '면담 값(날짜·내용) 이상: ' + JSON.stringify(i[0].data).slice(0, 240));
  WR().length = 0; const r2 = await mountFresh(hrMod.mountInterviews); await click(r2, '[data-i-open="w1"]'); await click(r2, '[data-i-del="i1"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.length === 1 && del[0].path === 'interviews/w1/records/i1', '삭제는 interviews/w1/records/i1 한 건만: ' + JSON.stringify(del.map((x) => x.path)));
});
await scenario('본인 열람 링크 — 연봉계약서: sign_links 에 열람 전용 링크, 문서 내용에 주민번호 전체 없음', async (check) => {
  const root = await mountFresh(hrMod.mountAnnual); await click(root, '[data-an-open="w1"]'); await click(root, '[data-an-link="20260301"]', 300); await confirmOk(); await sleep(300);
  const links = WR().filter((x) => /^sign_links\/[A-Za-z0-9]+$/.test(x.path)); check(links.length === 1, 'sign_links 문서가 1건 만들어져야 함(실제 ' + links.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (links[0]) { const d = links[0].data; check(d.docType === 'annual' && d.workerName === '김가나' && d.viewOnly === true && !!d.expiresAt && d.status === 'view' && !('jumin' in d) && !/\d{6}-?\d{7}/.test(JSON.stringify(d)), '링크 값(문서 종류·이름·열람 전용·만료·상태, 공개 필드에 민감정보 없음) 이상: ' + JSON.stringify(d).slice(0, 260)); }
  const secure = WR().filter((x) => /^sign_links\/[A-Za-z0-9]+\/secure\//.test(x.path)); check(secure.length >= 1, '문서 내용(secure)이 함께 저장되어야 함'); check(!/\d{6}-?\d{7}/.test(JSON.stringify(secure.map((x) => x.data))), '링크에 담긴 문서에 주민번호 전체가 들어가면 안 됨(마스킹)');
});
const generalAdd = (title, tab, coll, fields) => scenario(title, async (check) => {
  const root = await mountFresh(genMod.mountSection, { segs: [tab], query: {} }); await click(root, '[data-g-add]'); for (const [k, v] of Object.entries(fields)) await setv(root, '[data-gf="' + k + '"]', v);
  await click(root, '[data-g-act="save"]', 250); await confirmOk(); await sleep(200);
  const x = WR().filter((y) => (y.op === 'add' || y.op === 'set') && new RegExp('^' + coll + '/').test(y.path)); check(x.length === 1, coll + ' 가 1건 저장되어야 함(실제 ' + x.length + '): ' + JSON.stringify(WR().map((y) => y.op + ' ' + y.path)));
  if (x[0]) check(Object.entries(fields).filter(([k]) => ['name'].includes(k)).every(([k, v]) => x[0].data[k] === v), '입력한 이름이 저장되어야 함: ' + JSON.stringify(x[0].data).slice(0, 240)); return x[0];
});
await generalAdd('총무 — 임대 추가: general_leases', 'lease', 'general_leases', { name: '원희캐슬 B111', rent: '800000', deposit: '10000000' });
await generalAdd('총무 — 자산 추가: general_assets', 'asset', 'general_assets', { name: '노트북 LG그램', cost: '1800000', holder: '김가나' });
await generalAdd('총무 — 갱신 일정 추가: general_renewals', 'renewal', 'general_renewals', { name: '사무실 임대 갱신', nextDate: '2027-03-01', amount: '9600000' });

const check_ = async (root, sel, on) => { const el = root.querySelector(sel); if (!el) throw new Error('체크 칸 없음: ' + sel); el.checked = on; el.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(40); };
const blur = async (root, sel) => { const el = root.querySelector(sel); el.dispatchEvent(new w.Event('focusout', { bubbles: true })); await sleep(40); };
await scenario('영업기획 거래처 — 등록: gihoek_companies 에 구포털과 같은 필드(+협력사 표시), 담당자 전화 정리', async (check) => {
  const root = await mountFresh(planMod.mountCompanies); await click(root, '[data-pc-act="new"]'); await setv(root, '[data-pc-f="company"]', '새협력(주)'); await setv(root, '[data-pc-f="ceo"]', '홍길동'); await setv(root, '[data-pc-f="bizno"]', '123-45-67890'); await check_(root, '[data-pc-role="roleClient"]', true);
  await click(root, '[data-pc-act="ct-add"]'); await setv(root, '[data-pc-ct="0:name"]', '김담당'); await setv(root, '[data-pc-ct="0:tel"]', '12345678'); await blur(root, '[data-pc-ct="0:tel"]'); await setv(root, '[data-pc-ct="0:email"]', 'k@x.kr');
  await click(root, '[data-pc-act="save"]', 250); await confirmOk(); await sleep(200);
  const c = wrote('set', /^gihoek_companies\/co_\d+$/); check(c.length === 1 && c[0].merge === true, 'gihoek_companies/co_<시각> 이 병합 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (c[0]) { const d = c[0].data; check(d.company === '새협력(주)' && d.ceo === '홍길동' && d.bizno === '123-45-67890' && d.roleClient === true && d.roleSupplier === false && d.roleVendor === false, '값(회사명·대표·사업자번호·역할) 이상: ' + JSON.stringify(d).slice(0, 220)); check(d.contacts.length === 1 && d.contacts[0].name === '김담당' && d.contacts[0].tel === '010-1234-5678' && d.contacts[0].email === 'k@x.kr', '담당자 전화가 010-1234-5678 로 정리되어야 함: ' + JSON.stringify(d.contacts)); check(!('tel' in d) && !('email' in d), '구포털처럼 최상위 tel·email 은 건드리지 않음(병합 저장)'); }
});
await scenario('영업기획 거래처 — 역할 미지정이면 확인 창, 협력사 보기에서 등록하면 협력사로 지정', async (check) => {
  const root = await mountFresh(planMod.mountCompanies); await click(root, '[data-pc-act="new"]'); await setv(root, '[data-pc-f="company"]', '역할없음상사'); await click(root, '[data-pc-act="save"]', 250);
  check(!!document.querySelector('.jh-dialog') && /역할이 지정되지 않았습니다/.test(document.querySelector('.jh-dialog').textContent), '역할이 없으면 구포털과 같은 확인 창이 떠야 함'); check(WR().filter((x) => x.op === 'set').length === 0, '확인 전에는 저장하면 안 됨'); await confirmOk(); await sleep(200); check(wrote('set', /^gihoek_companies\/co_/).length === 1, '확인하면 저장되어야 함');
  WR().length = 0; const r2 = await mountFresh(planMod.mountPartners); await click(r2, '[data-pc-act="new"]'); await setv(r2, '[data-pc-f="company"]', '새 하도급사'); check(r2.querySelector('[data-pc-role="roleVendor"]').checked === true, '협력사 보기에서 새로 등록하면 협력사에 체크되어 있어야 함'); await click(r2, '[data-pc-act="save"]', 250); await confirmOk(); const v = wrote('set', /^gihoek_companies\/co_/); check(v.length === 1 && v[0].data.roleVendor === true && !document.querySelector('.jh-dialog'), '협력사로 지정되면 역할 확인 없이 저장: ' + JSON.stringify(v[0] && v[0].data.roleVendor));
});
await scenario('영업기획 거래처 — 수정(협력사 지정)·삭제: 해당 문서만, 다른 역할은 유지', async (check) => {
  const root = await mountFresh(planMod.mountCompanies); await click(root, '[data-pc-open="sj"]'); check(root.querySelector('[data-pc-f="company"]').value === '에스제이' && root.querySelector('[data-pc-role="roleClient"]').checked === true, '수정 폼에 기존 값이 채워져야 함'); await check_(root, '[data-pc-role="roleVendor"]', true); await click(root, '[data-pc-act="save"]', 250); await confirmOk(); await sleep(200);
  const u = wrote('set', /^gihoek_companies\/sj$/); check(u.length === 1 && u[0].data.roleVendor === true && u[0].data.roleClient === true && u[0].data.company === '에스제이', '에스제이에 협력사 지정이 병합 저장되고 수신처 역할은 유지: ' + JSON.stringify(u[0] && u[0].data).slice(0, 200));
  WR().length = 0; const r2 = await mountFresh(planMod.mountCompanies); await click(r2, '[data-pc-open="sj"]'); await click(r2, '[data-pc-act="del"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.length === 1 && del[0].path === 'gihoek_companies/sj', '삭제는 gihoek_companies/sj 한 건만: ' + JSON.stringify(del.map((x) => x.path)));
});

await scenario('영업기획 프로젝트 — 등록(연동 자동 생성): PJT관리에 같은 이름의 경량 PJT 가 생기고 프로젝트가 그 현장에 연결됨', async (check) => {
  const root = await mountFresh(planMod.mountProjects); await click(root, '[data-pj-act="new"]'); const f = { code: 'P5 Ph1 (복합동) PAC', name: 'AHU 2EA 증설', site: 'P3 Ret', client: '삼성전자', contractor: '삼성중공업', partner: '귀뚜라미범양냉방' };
  for (const [k, v] of Object.entries(f)) await setv(root, '[data-pj-f="' + k + '"]', v); await setv(root, '[data-pj-f="type"]', 'fcu'); check(root.querySelector('[data-pj-f="link"]').value === 'auto', '연동 PJT 기본값은 "새 PJT관리 항목 자동 생성"이어야 함');
  await click(root, '[data-pj-act="save"]', 300); await sleep(200);
  const reg = WR().filter((x) => x.op === 'add' && /^pjt_registry\/[^/]+$/.test(x.path)); check(reg.length === 1, 'pjt_registry 에 항목이 1건 만들어져야 함(실제 ' + reg.length + '): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (reg[0]) { const d = reg[0].data; check(d.name === f.code && d.content === f.name && d.site === f.site && d.client === f.client && d.contractor === f.contractor && d.partner === f.partner && d.status === 'active' && d.progress === 0 && d.manday === 0 && !!d.createdAt, 'PJT관리 항목 값(이름=PJT 코드·내용·현장·발주처·시공사·협력사·진행중) 이상: ' + JSON.stringify(d).slice(0, 260)); }
  const pj = wrote('set', /^gihoek_projects\/pjt_\d+$/); check(pj.length === 1 && pj[0].merge === false, 'gihoek_projects/pjt_<시각> 이 새로 저장되어야 함: ' + JSON.stringify(pj.map((x) => x.path)));
  if (pj[0] && reg[0]) { const d = pj[0].data; check(d.code === f.code && d.name === f.name && d.type === 'fcu' && d.status === 'run' && d.linkPjt === 'reg_' + reg[0].path.split('/')[1] && d.progProfile === '' && d.mandayCol === '' && !!d.createdAt, '프로젝트가 방금 만든 PJT관리 항목(reg_<번호>)에 연결되어야 함: ' + JSON.stringify(d).slice(0, 260)); }
});
await scenario('영업기획 프로젝트 — 수정(이미 연동): 기본정보 6항목이 PJT관리 항목에도 그대로 반영되고 새로 만들지 않음', async (check) => {
  const root = await mountFresh(planMod.mountProjects); await click(root, '[data-pj-open="pjt_1784786243034"]'); await click(root, '[data-pj-act="edit"]'); check(root.querySelector('[data-pj-f="link"]').value === 'reg_REG1', '수정 폼의 연동이 기존 PJT관리 항목(reg_REG1)이어야 함');
  await setv(root, '[data-pj-f="site"]', 'H3 17L 신관'); await setv(root, '[data-pj-f="partner"]', ''); await setv(root, '[data-pj-f="client"]', '삼성전자(주)'); await click(root, '[data-pj-act="save"]', 300); await sleep(200);
  check(WR().filter((x) => x.op === 'add' && /pjt_registry/.test(x.path)).length === 0, '이미 연동된 프로젝트를 수정할 때 PJT관리 항목을 새로 만들면 안 됨');
  const up = WR().filter((x) => x.op === 'update' && x.path === 'pjt_registry/REG1'); check(up.length === 1 && JSON.stringify(up[0].data) === JSON.stringify({ name: 'H17L Gas RM. 전환공사', content: 'AHU 설치 공사', site: 'H3 17L 신관', client: '삼성전자(주)', contractor: '삼성중공업', partner: '' }), '기본정보 6항목(비운 협력사 포함)이 pjt_registry/REG1 에 반영되어야 함: ' + JSON.stringify(up[0] && up[0].data));
  const pj = wrote('set', /^gihoek_projects\/pjt_1784786243034$/); check(pj.length === 1 && pj[0].merge === true && pj[0].data.site === 'H3 17L 신관' && pj[0].data.linkPjt === 'reg_REG1' && !('createdAt' in pj[0].data), '프로젝트는 병합 저장(등록일은 그대로)되고 연동은 유지: ' + JSON.stringify(pj[0] && pj[0].data).slice(0, 220));
});
await scenario('영업기획 프로젝트 — 삭제와 PJT 코드 필수, 견적·정산서 열기 연결', async (check) => {
  const root = await mountFresh(planMod.mountProjects); await click(root, '[data-pj-act="new"]'); await click(root, '[data-pj-act="save"]', 200); check(WR().length === 0, 'PJT 코드가 비어 있으면 저장하면 안 됨');
  const r2 = await mountFresh(planMod.mountProjects); await click(r2, '[data-pj-open="pjt_1782285557624"]'); check(/요약/.test(r2.textContent) && /청구 누계/.test(r2.textContent) && /견적 내역 \(3\)/.test(r2.textContent) && /청구서 \(2\)/.test(r2.textContent) && /지급예정서 \(1\)/.test(r2.textContent), '상세에 요약과 견적 3·청구서 2·지급예정서 1 이 보여야 함');
  await click(r2, '[data-pj-est="est2"]'); check(location.hash === '#/plan/est/est2/from/pjt_1782285557624', '견적을 누르면 새 견적 화면이 그 견적을 열도록 이동해야 함(프로젝트에서 왔다는 표시 포함): ' + location.hash);
  const r3 = await mountFresh(planMod.mountProjects); await click(r3, '[data-pj-open="pjt_1782285557624"]'); await click(r3, '[data-pj-act="new-est"]'); check(location.hash === '#/plan/est/new/pjt_1782285557624', '+ 견적 작성이 해당 프로젝트로 새 견적 작성을 열어야 함: ' + location.hash);
  WR().length = 0; const r4 = await mountFresh(planMod.mountProjects); await click(r4, '[data-pj-filter="all"]'); await click(r4, '[data-pj-open="pjt_1790924923339"]'); await click(r4, '[data-pj-act="del"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.length === 1 && del[0].path === 'gihoek_projects/pjt_1790924923339', '삭제는 gihoek_projects/pjt_1790924923339 한 건만(PJT관리 항목·견적·정산서는 남김): ' + JSON.stringify(del.map((x) => x.path)));
});

const optVal = (root, sel) => root.querySelector(sel).value;
await scenario('영업기획 견적 — 새 견적 작성: 기본값(첫 프로젝트·제이에이치솔루션·첫 수신처), 품목 연동 계산, gihoek_estimates 에 번호·스냅샷과 함께 저장', async (check) => {
  const root = await mountFresh(planMod.mountEstimates); await click(root, '[data-es-act="new"]');
  check(optVal(root, '[data-es-f="pjtId"]') === 'pjt_1782285557624' && optVal(root, '[data-es-f="issuerId"]') === 'jhsol' && optVal(root, '[data-es-f="clientId"]') === 'gtr', '기본값: 가장 오래된 프로젝트·발행처 제이에이치솔루션·첫 수신처(귀뚜라미범양냉방)');
  await setv(root, '[data-es-f="title"]', '  신규 설치 견적 '); await setv(root, '[data-es-it="0:name"]', 'FCU'); await setv(root, '[data-es-it="0:price"]', '1000000'); await setv(root, '[data-es-it="0:qty"]', '3'); await sleep(50);
  check(optVal(root, '[data-es-it="0:amount"]') === '3,000,000' && optVal(root, '[data-es-it="0:price"]') === '1,000,000' && root.querySelector('#es-total').textContent.replace(/[^0-9]/g, '') === '3300000' && root.querySelector('#es-vat').textContent.replace(/[^0-9]/g, '') === '300000', '품목 연동: 수량 3 × 단가 1,000,000 → 금액 3,000,000, 부가세 300,000, 합계 3,300,000: ' + optVal(root, '[data-es-it="0:amount"]') + ' / ' + root.querySelector('#es-total').textContent);
  await setv(root, '[data-es-it="1:name"]', ''); await click(root, '[data-es-act="save"]', 300); await sleep(200);
  const c = wrote('set', /^gihoek_estimates\/est_\d+$/); check(c.length === 1 && c[0].merge === false, 'gihoek_estimates/est_<시각> 이 새로 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (c[0]) { const d = c[0].data; check(d.no === 'EST-2026-006' && d.baseNo === d.no && d.rev === 1 && d.status === 'active' && d.title === '신규 설치 견적' && d.pjtId === 'pjt_1782285557624' && d.items.length === 1 && d.items[0].amount === 3000000 && d.clientId === 'gtr' && d.client.company === '귀뚜라미범양냉방' && d.issuer.company === '제이에이치솔루션' && !!d.createdAt, '값(번호 EST-2026-006: 그해 최고 005 + 1, 이름 없는 품목 줄 버림, 거래처 스냅샷) 이상: ' + JSON.stringify(d).slice(0, 300)); }
});
await scenario('영업기획 견적 — 개정 발행: 개정본 저장과 원본 폐기가 한 번에(batch), 번호는 기준번호-r(최고 rev+1)', async (check) => {
  const root = await mountFresh(planMod.mountEstimates); await click(root, '[data-es-open="est2"]'); check(/개정 이력 \(2개 버전\)/.test(root.textContent) && /r1/.test(root.textContent), '상세에 개정 이력(2개 버전)이 보여야 함'); await click(root, '[data-es-act="edit"]'); check(/EST-2026-001-r2/.test(root.textContent) && /원본/.test(root.textContent) && /폐기 처리/.test(root.textContent), '개정 폼에 원본 번호와 "원본은 폐기" 안내가 보여야 함');
  await setv(root, '[data-es-it="0:qty"]', '200'); await sleep(50); check(optVal(root, '[data-es-it="0:amount"]') === '19,000,000', '수량을 바꾸면 금액이 다시 계산되어야 함(200 × 95,000): ' + optVal(root, '[data-es-it="0:amount"]'));
  await click(root, '[data-es-act="save"]', 300); await sleep(200);
  const nb = WR().filter((x) => x.op === 'batch-set' && /^gihoek_estimates\/est_\d+$/.test(x.path)), ob = WR().filter((x) => x.op === 'batch-set' && x.path === 'gihoek_estimates/est2');
  check(nb.length === 1 && ob.length === 1 && WR().filter((x) => x.op === 'set').length === 0, '개정본과 원본 폐기가 일괄 쓰기(batch) 두 건이어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (nb[0] && ob[0]) { const d = nb[0].data; check(d.no === 'EST-2026-001-r3' && d.rev === 3 && d.baseNo === 'EST-2026-001' && d.status === 'active' && d.items[0].qty === 200 && !nb[0].merge, '개정본 값(번호 -r3·rev 3·기준 번호 유지) 이상: ' + JSON.stringify(d).slice(0, 220)); check(ob[0].merge === true && ob[0].data.status === 'void' && ob[0].data.replacedBy === 'EST-2026-001-r3' && !!ob[0].data.voidedAt && Object.keys(ob[0].data).length === 3, '원본은 병합 저장으로 폐기(status void·replacedBy·voidedAt)만 바뀌어야 함: ' + JSON.stringify(ob[0].data)); }
});
await scenario('영업기획 견적 — 종결·종결 취소·삭제와 입력 검사', async (check) => {
  const root = await mountFresh(planMod.mountEstimates); await click(root, '[data-es-open="est2"]'); await click(root, '[data-es-act="close"]'); await confirmOk(); await sleep(200);
  const cl = wrote('set', /^gihoek_estimates\/est2$/); check(cl.length === 1 && cl[0].merge === true && cl[0].data.status === 'closed' && !!cl[0].data.closedAt && Object.keys(cl[0].data).length === 2, '종결은 est2 에 status closed·closedAt 만 병합 저장: ' + JSON.stringify(cl[0] && cl[0].data));
  WR().length = 0; const r2 = await mountFresh(planMod.mountEstimates); await click(r2, '[data-es-filter="status"]'); await click(r2, '[data-es-open="est4"]'); check(/종결된 견적입니다/.test(r2.textContent) && !r2.querySelector('[data-es-act="edit"]') && !!r2.querySelector('[data-es-act="reopen"]'), '종결된 견적에는 안내와 "종결 취소"만 있고 수정(개정) 버튼은 없어야 함'); await click(r2, '[data-es-act="reopen"]'); await confirmOk(); await sleep(200);
  const ro = wrote('set', /^gihoek_estimates\/est4$/); check(ro.length === 1 && ro[0].data.status === 'active' && ro[0].data.closedAt === null && ro[0].merge === true, '종결 취소는 status active·closedAt null 병합 저장: ' + JSON.stringify(ro[0] && ro[0].data));
  WR().length = 0; const r3 = await mountFresh(planMod.mountEstimates); await click(r3, '[data-es-hide]'); await click(r3, '[data-es-open="est3"]'); check(/폐기된 견적입니다/.test(r3.textContent), '폐기된 견적에는 폐기 안내가 보여야 함'); await click(r3, '[data-es-act="del"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.length === 1 && del[0].path === 'gihoek_estimates/est3', '삭제는 gihoek_estimates/est3 한 건만: ' + JSON.stringify(del.map((x) => x.path)));
  WR().length = 0; const r4 = await mountFresh(planMod.mountEstimates); await click(r4, '[data-es-act="new"]'); await click(r4, '[data-es-act="save"]', 200); check(WR().length === 0, '제목·품목이 없으면 저장하면 안 됨');
});
await scenario('영업기획 견적 — 목록 필터(개정 전 버전 숨김 기본)·개정 비교·프로젝트에서 열기·인쇄', async (check) => {
  const root = await mountFresh(planMod.mountEstimates); const n = () => root.querySelectorAll('[data-es-open]').length;
  check(n() === 3 && !root.querySelector('[data-es-open="est1"]'), '기본은 개정되어 폐기된 이전 버전(est1)을 숨겨 3건: ' + n()); await click(root, '[data-es-hide]'); check(n() === 4, '숨기기를 풀면 4건: ' + n());
  await setv(root, '[data-es-filter="status"]', 'closed'); check(n() === 1 && !!root.querySelector('[data-es-open="est4"]'), '견적상태 종결 필터는 est4 한 건: ' + n()); await click(root, '[data-es-act="reset"]'); check(n() === 3, '초기화하면 기본(3건)으로 돌아옴');
  await click(root, '[data-es-open="est2"]'); check(/변경 1/.test(root.textContent) && /100,000/.test(root.textContent) && /95,000/.test(root.textContent), '개정 비교: r1→r2 에서 단가 변경 1건(100,000 → 95,000)이 보여야 함'); await setv(root, '[data-es-cmp="a"]', 'est2'); await setv(root, '[data-es-cmp="b"]', 'est1'); check(/공급가액/.test(root.textContent), '비교 대상을 바꿔도 화면이 유지되어야 함');
  const r2 = await mountFresh(planMod.mountEstimates, { segs: ['est2', 'from', 'pjt_1782285557624'], query: {} }); check(/프로젝트로 돌아가기/.test(r2.textContent) && /EST-2026-001-r2/.test(r2.textContent), '프로젝트에서 들어온 견적 주소는 상세를 바로 열고 돌아가기가 프로젝트로 가야 함'); await click(r2, '[data-es-act="back"]'); check(location.hash === '#/plan/projects/pjt_1782285557624', '돌아가기는 해당 프로젝트 화면으로: ' + location.hash);
  const r3 = await mountFresh(planMod.mountEstimates, { segs: ['new', 'pjt_1784786243034'], query: {} }); check(r3.querySelector('[data-es-f="pjtId"]').value === 'pjt_1784786243034', '새 견적 주소에 프로젝트가 있으면 그 프로젝트가 선택되어 있어야 함');
  let html = ''; const oldOpen = w.open; w.open = () => ({ document: { write: (x) => { html += x; }, close() {} } }); const r4 = await mountFresh(planMod.mountEstimates); await click(r4, '[data-es-open="est2"]'); await click(r4, '[data-es-act="print"]'); w.open = oldOpen; check(/견 적 서/.test(html) && /EST-2026-001-r2/.test(html) && /개정 r2/.test(html) && /다람이엔지/.test(html), '인쇄는 견적서 양식(번호·개정 표시·수신처)을 새 창에 쓰고 자동 인쇄해야 함');
});
markDone(); console.log('\n' + (failed ? '문제가 있는 저장 동작 ' + failed + '건' : '모든 저장 동작이 올바른 경로·값으로 기록됨')); process.exit(failed ? 1 : 0);
