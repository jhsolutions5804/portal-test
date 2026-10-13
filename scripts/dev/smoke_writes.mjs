/* 저장·삭제 동작 점검: 가짜 브라우저·가짜 Firestore 로 화면을 실제로 조작(입력→저장 버튼→확인 창 승인)하고,
 * "올바른 문서 경로에 올바른 값이 써졌는가"를 확인한다. smoke_ui 가 못 보는 쓰기 경로(저장 눌렀는데 아무것도 안 써지거나 엉뚱한 곳에 써지는 문제)를 잡는다.
 * 사용: cd scripts/dev && node --import ./smoke_register.mjs smoke_writes.mjs [--verbose]
 * 한계: 서버 함수·보안 규칙·실제 데이터는 못 본다(가짜 저장소는 모든 쓰기를 허용). */
import { w, D, errors, sleep, markDone, today } from './smoke_env.mjs';
const verbose = process.argv.includes('--verbose');
const planMod = await import(new URL('../../app/modules/plan/index.js', import.meta.url).href); const pjtMod = await import(new URL('../../app/modules/pjt/index.js', import.meta.url).href); const hrMod = await import(new URL('../../app/modules/hr/index.js', import.meta.url).href); const genMod = await import(new URL('../../app/modules/general/index.js', import.meta.url).href);
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
  try { sessionStorage.clear(); } catch (e) { /* 시나리오끼리 화면 상태 기억(필터·쪽)이 새지 않게 비운다 */ }
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
  const r2 = await mountFresh(planMod.mountProjects); await click(r2, '[data-pj-open="pjt_1782285557624"]'); check(/요약/.test(r2.textContent) && /청구 누계/.test(r2.textContent) && /견적 내역 \(3\)/.test(r2.textContent) && /청구서 \(3\)/.test(r2.textContent) && /지급예정서 \(2\)/.test(r2.textContent), '상세에 요약과 견적 3·청구서 3(폐기 포함)·지급예정서 2 가 보여야 함');
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

await scenario('영업기획 청구·수금 — 목록 합계·필터, 완결(수금)·완결 취소: 상태만 병합 저장, 확인 문구에 프로젝트 미수금', async (check) => {
  const root = await mountFresh(planMod.mountBilling); const n = () => root.querySelectorAll('[data-sl-open]').length;
  check(n() === 3 && !root.querySelector('[data-sl-open="set3"]') && /5,500,000/.test(root.textContent) && /2,200,000/.test(root.textContent), '청구서만 3건(지급예정서 제외), 합계 카드에 대금청구 누계 7,700,000과 미수금 2,200,000: ' + n());
  await setv(root, '[data-sl-filter="status"]', 'pending'); check(n() === 2, '상태 "미결"은 완결이 아닌 것(유효 1 + 폐기 1): ' + n()); await click(root, '[data-sl-act="reset"]'); check(n() === 3, '초기화하면 전체');
  await click(root, '[data-sl-open="set2"]'); check(/FCU \+ H17L/.test(root.textContent) && /완결/.test(root.textContent) && !!root.querySelector('[data-sl-act="void"]') && !root.querySelector('[data-sl-act="undone"]'), '유효 청구서 상세에는 완결·폐기 버튼이 있고 완결 취소는 없음, 공동 발행 표시');
  await click(root, '[data-sl-act="done"]'); const dlg = document.querySelector('.jh-dialog'); check(!!dlg && /이 청구 정산을 완결 처리할까요/.test(dlg.textContent) && /현재 프로젝트 미수금/.test(dlg.textContent), '완결 확인 창에 프로젝트 미수금 안내(구포털 문구)가 보여야 함'); await confirmOk(); await sleep(200);
  const d = wrote('set', /^gihoek_settlements\/set2$/); check(d.length === 1 && d[0].merge === true && d[0].data.status === 'done' && !!d[0].data.doneAt && Object.keys(d[0].data).length === 2, '완결은 set2 에 status done·doneAt 만 병합 저장: ' + JSON.stringify(d[0] && d[0].data));
  WR().length = 0; const r2 = await mountFresh(planMod.mountBilling); await click(r2, '[data-sl-open="set1"]'); check(!r2.querySelector('[data-sl-act="done"]') && !!r2.querySelector('[data-sl-act="undone"]'), '완결된 청구서에는 완결 취소만 있음'); await click(r2, '[data-sl-act="undone"]'); await confirmOk(); await sleep(200);
  const u = wrote('set', /^gihoek_settlements\/set1$/); check(u.length === 1 && u[0].data.status === 'active' && u[0].data.doneAt === null && u[0].merge === true, '완결 취소는 status active·doneAt null 병합 저장: ' + JSON.stringify(u[0] && u[0].data));
});
await scenario('영업기획 지급·정산 — 지급완료·폐기·삭제(폐기된 것만)·회계 계상월 수정', async (check) => {
  const root = await mountFresh(planMod.mountPayout); const n = () => root.querySelectorAll('[data-sl-open]').length; check(n() === 2 && /지급예정 누계/.test(root.textContent) && /1,100,000/.test(root.textContent), '지급예정서만 2건, 미지급 1,100,000: ' + n());
  await click(root, '[data-sl-open="set5"]'); await click(root, '[data-sl-act="done"]'); check(/실제 송금이 완료된 경우에만/.test(document.querySelector('.jh-dialog').textContent), '지급완료 확인 창은 "실제 송금이 완료된 경우에만" 문구'); await confirmOk(); await sleep(200);
  const d = wrote('set', /^gihoek_settlements\/set5$/); check(d.length === 1 && d[0].data.status === 'done' && !!d[0].data.doneAt, '지급완료는 status done·doneAt 병합 저장: ' + JSON.stringify(d[0] && d[0].data));
  WR().length = 0; const r2 = await mountFresh(planMod.mountPayout); await click(r2, '[data-sl-open="set3"]'); check(/회계 계상월/.test(r2.textContent) && /2026-08/.test(r2.textContent), '지급예정서 상세에 회계 계상월(지급일 기준 2026-08)이 보여야 함'); await click(r2, '[data-sl-act="acct-edit"]'); await setv(r2, '[data-sl-acct]', '26-9'); await click(r2, '[data-sl-act="acct-save"]'); check(WR().length === 0, '형식이 틀린 계상월은 저장하면 안 됨');
  await setv(r2, '[data-sl-acct]', '2026-09'); await click(r2, '[data-sl-act="acct-save"]'); await sleep(200); const a = wrote('set', /^gihoek_settlements\/set3$/); check(a.length === 1 && a[0].merge === true && JSON.stringify(a[0].data) === '{"acctMonth":"2026-09"}', '계상월은 acctMonth 만 병합 저장: ' + JSON.stringify(a[0] && a[0].data));
  WR().length = 0; const r3 = await mountFresh(planMod.mountPayout); await click(r3, '[data-sl-open="set5"]'); await click(r3, '[data-sl-act="void"]'); await confirmOk(); await sleep(200); const v = wrote('set', /^gihoek_settlements\/set5$/); check(v.length === 1 && v[0].data.status === 'void' && !!v[0].data.voidedAt && v[0].merge === true, '폐기는 status void·voidedAt 병합 저장: ' + JSON.stringify(v[0] && v[0].data));
  WR().length = 0; const r4 = await mountFresh(planMod.mountBilling); await click(r4, '[data-sl-open="set4"]'); check(/폐기된 정산서입니다/.test(r4.textContent) && !r4.querySelector('[data-sl-act="void"]') && !!r4.querySelector('[data-sl-act="del"]'), '폐기된 정산서에는 삭제만 있음'); await click(r4, '[data-sl-act="del"]'); await confirmOk(); const del = WR().filter((x) => x.op === 'delete'); check(del.length === 1 && del[0].path === 'gihoek_settlements/set4', '삭제는 gihoek_settlements/set4 한 건만: ' + JSON.stringify(del.map((x) => x.path)));
});
await scenario('영업기획 청구 — 견적 연결 저장, 인쇄, 새 정산서 발행(옛 화면 연결), 프로젝트에서 열기', async (check) => {
  const root = await mountFresh(planMod.mountBilling); await click(root, '[data-sl-open="set1"]'); await click(root, '[data-sl-act="link-open"]'); check(/항목별 견적 연결/.test(root.textContent) && !!root.querySelector('[data-sl-link="0"]'), '직접입력 청구서에는 견적 연결 패널이 열려야 함'); await setv(root, '[data-sl-link="0"]', 'est2'); await click(root, '[data-sl-act="link-save"]'); await sleep(200);
  const l = wrote('set', /^gihoek_settlements\/set1$/); check(l.length === 1 && l[0].merge === true && JSON.stringify(l[0].data) === '{"perEst":{"est2":5000000},"perEstLines":{"0":"est2"}}', '견적 연결은 perEst·perEstLines 만 병합 저장: ' + JSON.stringify(l[0] && l[0].data));
  const r2 = await mountFresh(planMod.mountBilling); await click(r2, '[data-sl-open="set2"]'); check(!r2.querySelector('[data-sl-act="link-open"]'), '공정 자동 청구서에는 견적 연결 버튼이 없음');
  let html = ''; const oldOpen = w.open; w.open = () => ({ document: { write: (x) => { html += x; }, close() {} } }); const r3 = await mountFresh(planMod.mountBilling); await click(r3, '[data-sl-open="set1"]'); await click(r3, '[data-sl-act="print"]'); w.open = oldOpen; check(/대 금 청 구 서/.test(html) && /2606001/.test(html) && /다람이엔지/.test(html) && /@page\{size:A4;margin:16mm\}/.test(html), '인쇄는 정산서 양식(번호·수신처·A4 여백)을 새 창에 씀');
  const r4 = await mountFresh(planMod.mountBilling); await click(r4, '[data-sl-act="new"]'); check(!!r4.querySelector('[data-is-f="method"]') && /대금청구서 발행/.test(r4.textContent) && sessionStorage.getItem('jh_plan_open') === null, '+ 청구서 발행은 이제 새 발행 화면을 열어야 함(옛 화면으로 넘기지 않음)');
  const r5 = await mountFresh(planMod.mountPayout); await click(r5, '[data-sl-act="new"]'); check(/지급예정서 발행/.test(r5.textContent) && !!r5.querySelector('[data-is-f="method"]'), '+ 지급예정서 발행도 새 발행 화면'); const r5b = await mountFresh(planMod.mountPayout); await click(r5b, '[data-sl-act="team"]'); check(location.hash === '#/plan/teamlabor', '지급·정산의 팀별 노무비 버튼은 새 팀별 노무비 화면으로: ' + location.hash);
  const r6 = await mountFresh(planMod.mountProjects); await click(r6, '[data-pj-open="pjt_1782285557624"]'); await click(r6, '[data-pj-set="set3"]'); check(location.hash === '#/plan/payout/set3/from/pjt_1782285557624', '프로젝트에서 지급예정서를 누르면 지급·정산 상세로(프로젝트에서 왔다는 표시 포함): ' + location.hash); await click(r6, '[data-pj-set="set1"]'); check(location.hash === '#/plan/billing/set1/from/pjt_1782285557624', '청구서는 청구·수금 상세로: ' + location.hash);
  await click(r6, '[data-pj-act="new-pay"]'); check(location.hash === '#/plan/payout/new/pjt_1782285557624', '프로젝트의 + 지급예정서 발행은 그 프로젝트로 지급·정산의 새 발행 화면을 열어야 함: ' + location.hash); await click(r6, '[data-pj-act="new-inv"]'); check(location.hash === '#/plan/billing/new/pjt_1782285557624', '+ 청구서 발행도 청구·수금의 새 발행 화면');
  const r7 = await mountFresh(planMod.mountBilling, { segs: ['set1', 'from', 'pjt_1782285557624'], query: {} }); check(/프로젝트로 돌아가기/.test(r7.textContent) && /2606001/.test(r7.textContent), '프로젝트에서 들어온 주소는 상세를 바로 열고 돌아가기가 프로젝트로 감'); await click(r7, '[data-sl-act="back"]'); check(location.hash === '#/plan/projects/pjt_1782285557624', '돌아가기는 해당 프로젝트 화면으로: ' + location.hash);
});

await scenario('영업기획 청구서 발행(직접 입력): 번호·내역·금액·프로젝트 몫·발신수신 스냅샷이 gihoek_settlements 에 새로 저장', async (check) => {
  const root = await mountFresh(planMod.mountBilling); await click(root, '[data-sl-act="new"]');
  check(optVal(root, '[data-is-f="method"]') === 'manual' && optVal(root, '[data-is-f="senderId"]') === 'jhsol' && optVal(root, '[data-is-f="recipientId"]') === '' && root.querySelector('[data-is-pjt="pjt_1782285557624"]').checked, '기본값: 직접 입력·발신자 제이에이치솔루션·수신자 비어 있음·첫 프로젝트 선택');
  await setv(root, '[data-is-f="issueDate"]', '2026-08-15'); await setv(root, '[data-is-f="baseMonth"]', '2026-08'); await setv(root, '[data-is-f="payDate"]', '2026-09-30'); await setv(root, '[data-is-f="recipientId"]', 'daram'); await setv(root, '[data-is-f="recipientContact"]', ''); 
  await setv(root, '[data-is-it="0:name"]', '설치비'); await setv(root, '[data-is-it="0:spec"]', '1차'); await setv(root, '[data-is-it="0:price"]', '1000000'); await setv(root, '[data-is-it="0:qty"]', '2'); await sleep(50);
  check(optVal(root, '[data-is-it="0:amount"]') === '2,000,000' && root.querySelector('#is-tot').textContent.replace(/[^0-9]/g, '').includes('2200000'), '품목 연동: 수량 2 × 단가 1,000,000 → 금액 2,000,000, 합계 2,200,000: ' + root.querySelector('#is-tot').textContent.slice(0, 120));
  await click(root, '[data-is-act="publish"]', 300); await sleep(250);
  const c = wrote('set', /^gihoek_settlements\/set_\d+$/); check(c.length === 1 && c[0].merge === false, 'gihoek_settlements/set_<시각> 이 새로 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (c[0]) { const d = c[0].data; check(d.no === '2608001' && d.docType === 'invoice' && d.method === 'manual' && d.supply === 2000000 && d.vat === 200000 && d.total === 2200000 && d.amount === 2000000 && d.status === 'active' && d.pjtId === 'pjt_1782285557624' && JSON.stringify(d.perPjtAmount) === '{"pjt_1782285557624":2000000}' && d.payDate === '2026-09-30' && d.acctMonth === '2026-09' && d.recipient.company === '다람이엔지' && d.sender.company === '제이에이치솔루션' && d.lines.length === 1 && d.lines[0].name === '설치비' && !!d.createdAt, '값(번호 2608001: 그달 청구서 없음, 금액·프로젝트 몫·계상월·스냅샷) 이상: ' + JSON.stringify(d).slice(0, 300)); }
  check(/대금청구서/.test(root.textContent) && /2608001/.test(root.textContent) && !!root.querySelector('[data-sl-act="print"]'), '발행하면 그 정산서 상세로 이동해야 함');
});
await scenario('영업기획 청구서 발행(수량 정산): 견적 품목별 수량·금액, 기청구 차감 표시, 수신자 미선택 확인', async (check) => {
  const root = await mountFresh(planMod.mountBilling); await click(root, '[data-sl-act="new"]'); await setv(root, '[data-is-f="issueDate"]', '2026-08-15'); await setv(root, '[data-is-f="method"]', 'qty'); await sleep(50);
  check(!!root.querySelector('[data-is-est="est2"]') && !root.querySelector('[data-is-est="est1"]') && !root.querySelector('[data-is-est="est3"]'), '선택할 수 있는 견적은 유효한 것만(est2): 폐기된 est1 은 없음'); await check_(root, '[data-is-est="est2"]', true); await sleep(50);
  check(!!root.querySelector('[data-is-q="est2:0"]') && /기청구/.test(root.textContent), '견적을 선택하면 품목 표(단가·총·기청구·이번수량·금액)가 펼쳐져야 함');
  await setv(root, '[data-is-q="est2:0"]', '10'); await sleep(50); check(optVal(root, '[data-is-qa="est2:0"]') === '950,000' && root.querySelector('#is-tot').textContent.replace(/[^0-9]/g, '').includes('1045000'), '수량 10 × 단가 95,000 = 950,000, 합계 1,045,000: ' + optVal(root, '[data-is-qa="est2:0"]'));
  await click(root, '[data-is-act="publish"]', 300); check(!!document.querySelector('.jh-dialog') && /수신자\(거래처\)가 선택되지 않았습니다/.test(document.querySelector('.jh-dialog').textContent) && WR().length === 0, '수신자가 없으면 확인 창이 떠야 하고 확인 전에는 저장하면 안 됨'); await confirmOk(); await sleep(250);
  const c = wrote('set', /^gihoek_settlements\/set_\d+$/); check(c.length === 1, '확인하면 저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (c[0]) { const d = c[0].data; check(d.method === 'qty' && d.supply === 950000 && JSON.stringify(d.perItem) === '{"est2":{"0":{"qty":10,"amount":950000}}}' && JSON.stringify(d.perEst) === '{"est2":950000}' && d.estIds.join() === 'est2' && d.lines[0].spec === ' · 수량 10' && JSON.stringify(d.recipient) === '{}' && d.recipientId === '', '수량 정산 저장 값(perItem·perEst·estIds·내역 규격 표시, 빈 수신자) 이상: ' + JSON.stringify(d).slice(0, 320)); }
});
await scenario('영업기획 지급예정서 발행: 지급예정일 자동, 옛 화면으로 가야 하는 방식은 안내와 연결', async (check) => {
  const root = await mountFresh(planMod.mountPayout); await click(root, '[data-sl-act="new"]'); await setv(root, '[data-is-f="method"]', 'manual'); await setv(root, '[data-is-f="issueDate"]', '2026-09-30'); await setv(root, '[data-is-f="baseMonth"]', '2026-09'); await setv(root, '[data-is-f="recipientId"]', 'sj');
  check(/하청/.test(root.textContent) && /익월 말일/.test(root.textContent), '지급예정서 폼: 수신자는 하청, 지급예정일 자동 안내'); await setv(root, '[data-is-it="0:name"]', '식대'); await setv(root, '[data-is-it="0:amount"]', '470000'); await click(root, '[data-is-act="publish"]', 300); await sleep(250);
  const c = wrote('set', /^gihoek_settlements\/set_\d+$/); check(c.length === 1 && c[0].data.docType === 'payment' && c[0].data.no === '2609001' && c[0].data.payDate === '2026-10-30' && c[0].data.acctMonth === '2026-10' && c[0].data.supply === 470000 && c[0].data.recipient.company === '에스제이', '지급예정서 저장 값(번호 2609001·지급예정일 2026-10-30 자동·계상월 2026-10): ' + JSON.stringify(c[0] && c[0].data).slice(0, 260));
  
  
  const r4 = await mountFresh(planMod.mountBilling, { segs: ['new', 'pjt_1784786243034'], query: {} }); check(r4.querySelector('[data-is-pjt="pjt_1784786243034"]').checked && !r4.querySelector('[data-is-pjt="pjt_1782285557624"]').checked, '주소에 프로젝트가 있으면 그 프로젝트가 선택된 상태로 시작'); await click(r4, '[data-is-pjt="pjt_1784786243034"]'); check(/최소 1개 프로젝트/.test(document.body.textContent) || r4.querySelector('[data-is-pjt="pjt_1784786243034"]').checked, '프로젝트를 모두 해제할 수는 없음');
  WR().length = 0; const r5 = await mountFresh(planMod.mountBilling); await click(r5, '[data-sl-act="new"]'); await click(r5, '[data-is-act="publish"]', 200); check(WR().length === 0, '금액이 없으면 발행하면 안 됨');
});

await scenario('영업기획 지급예정서 발행(공수 연동): 공수 불러오기(FAB 명부 외 제외·경량 PJT 자기 공수표), 프로젝트별 단가, 공수·프로젝트별 몫 저장, 기준월 경고', async (check) => {
  const root = await mountFresh(planMod.mountPayout); await click(root, '[data-sl-act="new"]'); check(optVal(root, '[data-is-f="method"]') === 'manday' && /공수 연동/.test(root.textContent) && !!root.querySelector('[data-is-act="fetch-md"]'), '지급예정서의 기본 방식은 공수 연동(공수 불러오기 버튼)'); await setv(root, '[data-is-f="issueDate"]', '2026-09-30'); await setv(root, '[data-is-f="baseMonth"]', '2026-09'); await setv(root, '[data-is-f="recipientId"]', 'sj');
  await click(root, '[data-is-act="fetch-md"]', 500); await sleep(300);
  check(optVal(root, '[data-is-md=""]') === '3.5' && /3\.5 공수|자동 집계: 3\.5/.test(root.textContent) && root.querySelector('[data-is-supply]').value === '665,000', 'FAB 공수: 9월 2일(w1 1 + w2 1, 명부 밖 x9 5는 제외)·3일(1 + 0.5) = 3.5 공수, 3.5 × 190,000 = 665,000: ' + optVal(root, '[data-is-md=""]'));
  await check_(root, '[data-is-pjt="pjt_1784786243034"]', true); await sleep(80); check(!!root.querySelector('[data-is-md="pjt_1784786243034"]') && !!root.querySelector('[data-is-mdrate="pjt_1784786243034"]'), '프로젝트를 둘 고르면 프로젝트별 공수·단가 입력이 생김');
  await click(root, '[data-is-act="fetch-md"]', 500); await sleep(300); check(optVal(root, '[data-is-md="pjt_1782285557624"]') === '3.5' && optVal(root, '[data-is-md="pjt_1784786243034"]') === '3', '경량 PJT 는 자기 공수표·명부에서: a 1 + b 2 = 3 공수(명부 밖 old_x 3 제외), FAB 는 3.5: ' + optVal(root, '[data-is-md="pjt_1782285557624"]') + ' / ' + optVal(root, '[data-is-md="pjt_1784786243034"]'));
  await setv(root, '[data-is-mdrate="pjt_1784786243034"]', '180000'); await sleep(50); check(root.querySelector('[data-is-supply]').value === '1,205,000', '프로젝트별 단가: 3.5 × 190,000 + 3 × 180,000 = 1,205,000: ' + root.querySelector('[data-is-supply]').value);
  await setv(root, '[data-is-f="baseMonth"]', '2026-10'); check(/불러온 공수는 2026-09 기준입니다/.test(root.textContent), '기준월을 바꾸면 불러온 공수의 기준월이 다르다는 경고가 보여야 함'); await setv(root, '[data-is-f="baseMonth"]', '2026-09');
  await click(root, '[data-is-act="publish"]', 300); await sleep(250);
  const c = wrote('set', /^gihoek_settlements\/set_\d+$/); check(c.length === 1, '저장되어야 함(경고 없이): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (c[0]) { const d = c[0].data; check(d.docType === 'payment' && d.method === 'manday' && d.no === '2609001' && d.mandayUsed === 6.5 && JSON.stringify(d.perPjtAmount) === '{"pjt_1782285557624":665000,"pjt_1784786243034":540000}' && d.supply === 1205000 && d.vat === 120500 && d.lines.length === 2 && d.lines[1].spec === '공수 3 × 180,000원' && d.payDate === '2026-10-30' && d.acctMonth === '2026-10' && d.recipient.company === '에스제이', '공수 연동 저장 값(공수 합계 6.5·프로젝트별 몫·단가별 내역·지급예정일 자동) 이상: ' + JSON.stringify(d).slice(0, 300)); }
  WR().length = 0; const r2 = await mountFresh(planMod.mountPayout); await click(r2, '[data-sl-act="new"]'); await setv(r2, '[data-is-f="recipientId"]', 'sj'); await setv(r2, '[data-is-f="baseMonth"]', '2026-09'); await click(r2, '[data-is-act="fetch-md"]', 500); await sleep(300); await setv(r2, '[data-is-f="baseMonth"]', '2026-08'); await click(r2, '[data-is-act="publish"]', 300); check(!!document.querySelector('.jh-dialog') && /불러온 공수의 기준월/.test(document.querySelector('.jh-dialog').textContent) && WR().length === 0, '불러온 뒤 기준월을 바꾸고 발행하면 확인 창이 떠야 하고 확인 전에는 저장하면 안 됨');
});

await scenario('영업기획 청구서 발행(공정 연동): 견적·섹터 선택, 공정 체크 불러오기(과거 상수 포함), 반입 80%+설치 20%+보증금, 직접 고친 청구액, perEst·내역 저장', async (check) => {
  const root = await mountFresh(planMod.mountBilling); await click(root, '[data-sl-act="new"]'); await setv(root, '[data-is-f="issueDate"]', '2026-08-15'); await setv(root, '[data-is-f="baseMonth"]', '2026-08'); await setv(root, '[data-is-f="recipientId"]', 'daram'); await setv(root, '[data-is-f="method"]', 'progress'); await sleep(50);
  check(!!root.querySelector('[data-is-act="fetch-prog"]') && /공정 자동/.test(root.textContent) && !root.querySelector('[data-is-act="legacy"]') && !!root.querySelector('[data-is-est="est2"]'), '청구서의 공정 연동은 새 화면(공정 데이터 불러오기 버튼), 추적되는 프로젝트(P4 Ph2)의 견적이 목록에 있음');
  await click(root, '[data-is-act="fetch-prog"]', 200); check(WR().length === 0, '견적을 고르기 전에 불러오기는 아무것도 하지 않음'); await check_(root, '[data-is-est="est2"]', true); await sleep(80);
  check(root.querySelector('[data-is-zone="est2"]').value === 'fiz' && /반입 0\/39/.test(root.textContent), '견적을 고르면 섹터는 제목으로 추정(없으면 첫 섹터 3F FIZ), 진척은 0/39에서 시작');
  await click(root, '[data-is-act="fetch-prog"]', 600); await sleep(400);
  check(/반입 20\/39/.test(root.textContent) && /설치 1\/39/.test(root.textContent) && /801~809, 820~830/.test(root.textContent), '공정 불러오기: 7월 체크 + 코드 상수(6/17~6/20)를 합쳐 반입 20/39(801~809, 820~830)·설치 1/39(801): ' + (root.querySelector('#is-prog') || {}).textContent);
  check(optVal(root, '[data-is-bill="est2"]') === '7,221,462' && root.querySelector('[data-is-supply]').value === '7,221,462', '이번 청구액 = 17,385,000 × (0.8 × 20/39 + 0.2 × 1/39) = 7,221,462: ' + optVal(root, '[data-is-bill="est2"]'));
  await check_(root, '[data-is-dep="est2"]', true); await sleep(60); check(optVal(root, '[data-is-bill="est2"]') === '8,959,962', '보증금 10%를 체크하면 1,738,500 가산: ' + optVal(root, '[data-is-bill="est2"]'));
  await setv(root, '[data-is-bill="est2"]', '5000000'); await sleep(60); check(root.querySelector('[data-is-supply]').value === '5,000,000', '이번 청구액을 직접 고치면 합계에 반영');
  await click(root, '[data-is-act="publish"]', 300); await sleep(250);
  const c = wrote('set', /^gihoek_settlements\/set_\d+$/); check(c.length === 1, '저장되어야 함: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  if (c[0]) { const d = c[0].data; check(d.method === 'progress' && d.docType === 'invoice' && d.no === '2608001' && d.supply === 5000000 && JSON.stringify(d.perEst) === '{"est2":5000000}' && d.estIds.join() === 'est2' && d.lines.length === 1 && d.lines[0].spec === '3F FIZ 반입 20/39 (801~809, 820~830) · 설치 1/39 (801)' && d.lines[0].amount === 5000000 && d.lines[0].qty === 1 && JSON.stringify(d.perPjtAmount) === '{"pjt_1782285557624":5000000}' && JSON.stringify(d.perItem) === '{}', '공정 연동 저장 값(견적별 청구액·내역 문구·프로젝트 몫) 이상: ' + JSON.stringify(d).slice(0, 320)); }
  const r2 = await mountFresh(planMod.mountBilling, { segs: ['new', 'pjt_1790924923339'], query: {} }); await setv(r2, '[data-is-f="method"]', 'progress'); check(/섹터·장비 자동추적 연동이 없어/.test(r2.textContent) && !r2.querySelector('[data-is-est]'), '자동추적 연동이 없는 프로젝트는 공정 연동에서 제외된다는 안내와 함께 견적을 고를 수 없음');
});

await scenario('영업기획 팀별 노무비: 월 이동·팀 집계(명부 밖 제외·미소속 인원 안내), 팀 단가 이중 저장', async (check) => {
  const root = await mountFresh(planMod.mountTeamLabor); await sleep(300);
  for (let i = 0; i < 14 && !/2026년 7월/.test(root.textContent); i++) { await click(root, '[data-tl-act="prev"]', 150); await sleep(250); }
  check(/2026년 7월/.test(root.textContent), '이전 달 버튼으로 2026년 7월까지 이동: ' + (root.querySelector('.jh-plan__big') || {}).textContent);
  const txt = () => root.textContent.replace(/\s+/g, ' ');
  check(/김팀장 팀/.test(txt()) && /\(1명\)/.test(txt()) && /4\.5공수/.test(txt()) && /900,000원/.test(txt()) && /박팀장 팀/.test(txt()) && /팀 노무비 합계 ?900,000원|900,000원/.test(txt()), '김팀장 팀(7월): 팀장 1.5(FAB)+2(SUP)+팀원 1 = 4.5공수 × 200,000 = 900,000원: ' + txt().slice(0, 400));
  check(/P4 Ph2 \(FAB\) 2\.5공수/.test(txt()) && /P4 Ph4 \(SUP\) 2\.0공수/.test(txt()), '프로젝트별 공수 칩(FAB 2.5·SUP 2.0)');
  check(/팀\(마스터 근로자\)에 속하지 않은 인원/.test(txt()) && /낯선사람\(생년월일 없음\)/.test(txt()) && !/ghost/.test(txt()), '팀에 속하지 않은 인원(낯선사람)은 따로 알려 주고, 명부에 없는 ghost 공수는 어디에도 나오지 않음');
  await click(root, '[data-tl-act="rate-edit"][data-tl-leader="L2"]'); check(root.querySelector('[data-tl-rate]').value === '150000', '단가 수정 칸에 현재 단가(마스터 값 150000)가 보여야 함'); await setv(root, '[data-tl-rate]', '170,000'); await click(root, '[data-tl-act="rate-save"]', 300); await sleep(250);
  const a = wrote('set', /^master_worker_private\/L2$/), b = wrote('set', /^team_rates\/L2$/); check(a.length === 1 && a[0].merge === true && JSON.stringify(a[0].data) === '{"teamRate":170000}' && b.length === 1 && b[0].merge === true && b[0].data.teamRate === 170000 && !!b[0].data.updatedAt && Object.keys(b[0].data).length === 2, '팀 단가는 관리자 문서(master_worker_private)와 팀장 조회용(team_rates) 두 곳에 병합 저장: ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  check(/170,000원/.test(txt()) && !root.querySelector('[data-tl-rate]'), '저장하면 화면의 단가가 바뀌고 입력 칸이 닫힘');
  WR().length = 0; await click(root, '[data-tl-act="rate-edit"][data-tl-leader="L2"]'); await setv(root, '[data-tl-rate]', ''); await click(root, '[data-tl-act="rate-save"]', 300); await sleep(200); const z = wrote('set', /^team_rates\/L2$/); check(z.length === 1 && z[0].data.teamRate === 0, '비워서 저장하면 단가 0');
});

await scenario('영업기획 홈: 요약 카드·목록 이동·챙길 일(연체 청구·지급 임박)·바로가기 — 저장 없음', async (check) => {
  const root = await mountFresh(planMod.mountHome); const txt = () => root.textContent.replace(/\s+/g, ' ');
  check(/프로젝트 수\s*3 ?개/.test(txt()) && /유효 견적\s*1 ?건/.test(txt()) && /총 청구액\s*7,000/.test(txt()) && /미수금 \(청구−수금\)2,000,000/.test(txt()), '요약 카드: 프로젝트 3개, 유효 견적 1건, 총 청구액 7,000,000(공동 발행분은 프로젝트 몫), 미수금 2,000,000: ' + txt().slice(0, 260));
  await click(root, '[data-hm-kpi="due"]'); check(/미수금 현황 \(2\)/.test(txt()) && !!root.querySelector('a.jh-plan__row[href^="#/plan/projects/"]'), '미수금 카드를 누르면 미수금이 있는 프로젝트 2개의 목록과 프로젝트 이동 링크'); await click(root, '[data-hm-kpi="due"]'); check(!/미수금 현황/.test(txt()), '같은 카드를 다시 누르면 목록이 닫힘');
  await click(root, '[data-hm-kpi="bill"]'); check(!!root.querySelector('a.jh-plan__row[href^="#/plan/billing/"]') && /2606001/.test(txt()), '청구 내역 목록은 청구·수금 상세로 연결'); await click(root, '[data-hm-kpi="est"]'); check(!!root.querySelector('a.jh-plan__row[href^="#/plan/est/"]') && /유효 견적 \(1\)/.test(txt()) && !/청구 내역 \(/.test(txt()), '유효 견적 목록은 견적 상세로 연결, 카드는 하나씩만 열림');
  check(/챙길 일/.test(txt()) && /2607001/.test(txt()) && /일 지남/.test(txt()) && /2608001/.test(txt()), '챙길 일: 지급요청일이 지난 청구서(2607001)와 지급 예정서(2608001)가 보임'); check(!!root.querySelector('a.jh-plan__link[href="#/plan/teamlabor"]') && !!root.querySelector('a.jh-plan__link[href="#/plan/billing"]') && root.querySelectorAll('a.jh-plan__link').length === 6, '바로가기 6개(프로젝트·거래처·견적·청구·수금·지급·정산·팀별 노무비)'); check(WR().length === 0, '홈은 아무것도 저장하지 않음');
});

await scenario('영업기획 월말 마감: 월 이동·한 달 요약·점검 항목(연체 청구서)·프로젝트별 요약·CSV·인쇄 — 저장 없음', async (check) => {
  const root = await mountFresh(planMod.mountClosing); const txt = () => root.textContent.replace(/\s+/g, ' ');
  for (let i = 0; i < 14 && !/2026년 7월/.test(txt()); i++) { await click(root, '[data-cl-act="prev"]', 100); }
  check(/2026년 7월/.test(txt()), '이전 달 버튼으로 2026년 7월까지 이동');
  check(/청구서 발행 ?1건 · 2,200,000원/.test(txt()) && /지급예정서 발행 ?1건 · 3,300,000원/.test(txt()) && /수금\(완결\) ?1건 · 5,500,000원/.test(txt()) && /지급완료 ?1건 · 3,300,000원/.test(txt()), '7월 요약: 청구서 1건(폐기 제외) 2,200,000, 지급예정서 1건 3,300,000, 완결 처리한 달이 7월인 수금 5,500,000·지급완료 3,300,000: ' + txt().slice(0, 420));
  check(/처리가 필요한 점검 항목이 \d+개/.test(txt()) && /연체 청구서 ?1건/.test(txt()), '점검 항목: 연체 청구서 1건(2607001, 지급요청일 8월 31일)이 처리 필요로 표시'); await click(root, '[data-cl-ck="overdueInvoices"]'); check(!!root.querySelector('a.jh-plan__row[href="#/plan/billing/set2"]') && /일 지남/.test(txt()), '항목을 누르면 연체 청구서 목록과 상세 이동 링크');
  check(/P4 Ph2/.test(txt()) && /H17L/.test(txt()) && /합계/.test(txt()), '프로젝트별 월 요약 표(공동 발행분은 프로젝트 몫)');
  let href = ''; const oldClick = w.HTMLAnchorElement.prototype.click; w.HTMLAnchorElement.prototype.click = function () { href = this.href; }; await click(root, '[data-cl-act="csv"]'); w.HTMLAnchorElement.prototype.click = oldClick; const csv = decodeURIComponent((href.split(',').slice(1)).join(','));
  check(href.startsWith('data:text/csv;charset=utf-8,') && csv.includes('2607001') && csv.includes('2607002') && csv.includes('"번호","구분"'), 'CSV 내려받기는 7월 발행 정산서(2607001·2607002 …)를 담음');
  let html = ''; const oldOpen = w.open; w.open = () => ({ document: { write: (x) => { html += x; }, close() {} } }); await click(root, '[data-cl-act="print"]'); w.open = oldOpen; check(/월말 마감 2026-07/.test(html) && /점검 항목/.test(html) && /window\.print/.test(html), '인쇄는 월말 마감 요약 문서(월·점검 항목·프로젝트별 표)를 새 창에 씀'); check(WR().length === 0, '월말 마감은 아무것도 저장하지 않음');
});

await scenario('영업기획 비용장부 대조(재무회계 이관): 일치·날짜 어긋남·중복 의심·없음 구분, 가져오기 JSON(옵션)·프로젝트 표시 대조표 — 저장 없음', async (check) => {
  const root = await mountFresh(planMod.mountAcct); const txt = () => root.textContent.replace(/\s+/g, ' ');
  check(/비용장부 ?7건/.test(txt()) && /전표와 일치 ?2건/.test(txt()) && /날짜 어긋남 ?1건/.test(txt()) && /중복 의심 ?1건/.test(txt()) && /전표에 없음 ?3건/.test(txt()) && /1,275,000원/.test(txt()), '요약: 비용장부 7건 → 일치 2·날짜 어긋남 1·중복 의심 1·전표에 없음 3(금액 1,275,000원): ' + txt().slice(0, 500));
  check(/통째로 옮기면 같은 지출이 두 번 계상/.test(txt()) && /가져오기 JSON \(1건\)/.test(txt()), '이중 계상 경고가 보이고, 기본 가져오기 JSON 은 1건(공구상사만 — 외상거래·급여·중복 의심 제외)');
  await check_(root, '[data-ac-opt="credit"]', true); await sleep(60); check(/가져오기 JSON \(2건\)/.test(txt()), '외상거래 포함을 켜면 2건'); await check_(root, '[data-ac-opt="dup"]', true); await sleep(60); check(/가져오기 JSON \(3건\)/.test(txt()), '중복 의심 포함까지 켜면 3건');
  await setv(root, '[data-ac-filter="status"]', 'dup'); check(root.querySelectorAll('tbody tr').length === 1 && /편의점/.test(txt()) && /2026-0101/.test(txt()), '상태 필터 "중복 의심": 편의점 1건과 짝지어진 전표 번호'); await click(root, '[data-ac-act="reset"]'); check(root.querySelectorAll('tbody tr').length === 7, '초기화하면 7건');
  let href = '', name = ''; const oldClick = w.HTMLAnchorElement.prototype.click; w.HTMLAnchorElement.prototype.click = function () { href = this.href; name = this.download; };
  await click(root, '[data-ac-act="json"]'); const json = JSON.parse(decodeURIComponent(href.split(',').slice(1).join(','))); check(name === '비용장부_이관_가져오기.json' && href.startsWith('data:application/json;charset=utf-8,') && json.entries.length === 3 && json.entries.every((e) => e.needsReview === true && e.source.kind === 'manual' && /비용장부 이관/.test(e.memo)) && json.entries.some((e) => e.date === '2026-07-11' && e.lines[0].account === '5010') && json.entries.every((e) => e.lines.reduce((a, l) => a + (l.side === 'D' ? l.amount : -l.amount), 0) === 0), '가져오기 JSON 내려받기: 옵션대로 3건, 모두 검토 필요·차변=대변·"[비용장부 이관]" 표시');
  await click(root, '[data-ac-act="tags"]'); const csv = decodeURIComponent(href.split(',').slice(1).join(',')); w.HTMLAnchorElement.prototype.click = oldClick; check(name === '비용장부_프로젝트표시_대조표.csv' && csv.includes('"일치"') && csv.includes('2026-0100') && csv.includes('"날짜 어긋남"') && csv.includes('"없음"'), '프로젝트 표시 대조표 CSV: 일치·날짜 어긋남·없음과 전표 번호'); check(WR().length === 0, '비용장부 대조는 아무것도 저장하지 않음');
});

await scenario('영업기획 협력사 위탁 계약서: 작성 → 법정 기재사항 점검 → 서면 발급 기록(착공 후 경고) → 인쇄 → 변경 계약 → 폐기, 협력사 문서(contracts 배열)에 저장', async (check) => {
  const root = await mountFresh(planMod.mountContracts); const txt = () => root.textContent.replace(/\s+/g, ' ');
  check(/초안 도구/.test(txt()) && /법무 확인/.test(txt()) && /작성한 위탁 계약서가 없습니다/.test(txt()), '목록: 법무 확인 안내와 빈 목록'); await click(root, '[data-ct-act="new"]');
  check(optVal(root, '[data-cf="issuerId"]') === 'jhsol' && !!root.querySelector('[data-cf="partnerId"] option[value="sj"]') && !root.querySelector('[data-cf="partnerId"] option[value="daram"]'), '작성 폼: 원사업자 기본값 제이에이치솔루션, 수급사업자는 협력사 역할 거래처만');
  await click(root, '[data-ct-act="save"]', 200); check(/수급사업자\(협력사\)를 선택/.test(document.body.textContent) && WR().length === 0, '협력사를 고르지 않으면 저장 거부');
  await setv(root, '[data-cf="partnerId"]', 'sj'); await setv(root, '[data-cf="title"]', '평택 FCU 설치 하도급'); await setv(root, '[data-cf="pjtId"]', 'pjt_1782285557624'); await setv(root, '[data-cf="scope"]', 'FAB동 3F FIZ FCU 39대 설치'); await setv(root, '[data-cf="site"]', '평택 P4 Ph2'); await setv(root, '[data-cf="startDate"]', '2026-11-01'); await setv(root, '[data-cf="endDate"]', '2026-11-30'); await setv(root, '[data-cf="inspection"]', '설치 완료 후 7일 이내 검사'); await setv(root, '[data-cf="supply"]', '50000000'); await setv(root, '[data-cf="payMethod"]', '계좌이체'); await setv(root, '[data-cf="payDue"]', '기성 청구 후 익월 말일');
  check(/합계 55,000,000원/.test(txt()), '대금 입력: 공급가액 50,000,000 + 부가세 자동 10% = 합계 55,000,000원'); await click(root, '[data-ct-act="save"]', 300); await sleep(250);
  const c1 = wrote('set', /^gihoek_companies\/sj$/); check(c1.length === 1 && c1[0].merge === true && Object.keys(c1[0].data).join() === 'contracts' && c1[0].data.contracts.length === 1, '협력사 문서(gihoek_companies/sj)에 contracts 배열만 병합 저장(다른 필드는 건드리지 않음): ' + JSON.stringify(WR().map((x) => x.op + ' ' + x.path)));
  const k = c1[0] && c1[0].data.contracts[0]; check(!!k && k.no === '2610001' && k.kind === 'basic' && k.status === 'draft' && k.title === '평택 FCU 설치 하도급' && k.supply === 50000000 && k.partner.company === '에스제이' && k.partner.bizno === '111-22-33333' && k.issuer.company === '제이에이치솔루션' && k.startDate === '2026-11-01' && k.pjtId === 'pjt_1782285557624' && !('partnerName' in k) && /^\d{4}-\d{2}-\d{2}T/.test(k.updatedAt), '저장 값(번호 2610001·작성 중·협력사 정보 박제·기간·프로젝트·갱신 시각) 이상: ' + JSON.stringify(k).slice(0, 260));
  check(/법정 기재사항 점검/.test(txt()) && /누락 1건/.test(txt()) && /원사업자·수급사업자의 서명 또는 기명날인/.test(txt()), '상세로 이동해 점검표 표시: 내용 5개는 갖춤, 서명 누락 1건');
  await click(root, '[data-ct-act="issue"]', 200); check(/서면 발급일을 입력하세요|서명/.test(document.body.textContent) && wrote('set', /^gihoek_companies\/sj$/).length === 1, '서명일·발급일 없이 서면 발급 기록은 거부(저장 없음)');
  await setv(root, '[data-ci="issuerSignedDate"]', '2026-11-04'); await setv(root, '[data-ci="partnerSignedDate"]', '2026-11-05'); await setv(root, '[data-ci="issuedDate"]', '2026-11-05'); await click(root, '[data-ct-act="issue"]', 300); check(!!document.querySelector('.jh-dialog') && /4일 늦음/.test(document.querySelector('.jh-dialog').textContent), '착공일(11/1)보다 늦은 발급일이면 확인 창에 "4일 늦음" 경고'); await confirmOk(); await sleep(250);
  const c2 = wrote('set', /^gihoek_companies\/sj$/); const k2 = c2[1] && c2[1].data.contracts[0]; check(c2.length === 2 && k2.status === 'issued' && k2.issuedDate === '2026-11-05' && k2.issuerSignedDate === '2026-11-04' && k2.partnerSignedDate === '2026-11-05' && c2[1].data.contracts.length === 1, '서면 발급으로 기록(서명일·발급일 저장, 배열은 교체되어 중복 없음)'); check(/서면 발급/.test(txt()) && !!root.querySelector('[data-ct-act="change"]') && !root.querySelector('[data-ct-act="edit"]') && !root.querySelector('[data-ct-act="issue"]'), '발급된 계약서는 수정 불가, 변경 계약서 작성 버튼만');
  let html = ''; const oldOpen = w.open; w.open = () => ({ document: { write: (x) => { html += x; }, close() {} } }); await click(root, '[data-ct-act="print"]'); w.open = oldOpen; check(/하도급 계약서/.test(html) && /2610001/.test(html) && /에스제이/.test(html) && /제이에이치솔루션/.test(html) && /금 55,000,000원/.test(html) && /2026년 11월 04일/.test(html) && /window\.print/.test(html), '인쇄: 계약번호·당사자·하도급대금·서명일이 들어간 계약서 문서');
  await click(root, '[data-ct-act="change"]'); check(root.querySelector('[data-cf="title"]').value === '변경 계약 — 평택 FCU 설치 하도급' && /변경 계약서/.test(txt()), '변경 계약서 작성: 원 계약 내용을 이어받은 새 폼'); await setv(root, '[data-cf="supply"]', '60000000'); await click(root, '[data-ct-act="save"]', 300); await sleep(250);
  const c3 = wrote('set', /^gihoek_companies\/sj$/); const arr = c3[2] && c3[2].data.contracts; check(arr && arr.length === 2 && arr[1].kind === 'change' && arr[1].parentId === arr[0].id && arr[1].no === '2610002' && arr[1].supply === 60000000 && arr[1].status === 'draft' && arr[0].status === 'issued', '변경 계약 저장: 원 계약은 그대로 두고 새 계약(2610002, parentId 연결)이 추가됨');
  await click(root, '[data-ct-act="void"]'); await confirmOk(); await sleep(250); const c4 = wrote('set', /^gihoek_companies\/sj$/); check(c4.length === 4 && c4[3].data.contracts.find((x) => x.no === '2610002').status === 'void' && /폐기/.test(txt()), '폐기하면 상태만 폐기로 바뀌고 기록은 남음');
});

await scenario('PJT 출역·공수(새 모듈): 공수 입력 → 출역 자동, 출역 해제 → 공수 비움(확인), 전체 출역·일괄 공수, 퇴사자·명부 밖 공수 보존, 집계표, 투입 종료, 경량PJT 경로·자동 공수 1', async (check) => {
  const root = await mountFresh(pjtMod.mountAttend, { segs: ['p4ph2', '2026-07-02'], query: {} }); const txt = () => root.textContent.replace(/\s+/g, ' ');
  const rowsOf = () => [...root.querySelectorAll('[data-pa-tog]')].map((b) => b.closest('.jh-pjt__row').querySelector('strong').textContent);
  check(rowsOf().join() === '김가나,김팀장,낯선사람,이다라,이팀원' && /출역 ?3명/.test(txt()) && /공수 합계 ?13\.0/.test(txt()) && /명부에 없는 근로자의 공수 9\.0/.test(txt()) && /ghost/.test(txt()) && /2026-07-03 퇴사/.test(txt()), '7/2 목록: 명부 5명, 출역 3명(공수가 있는 사람), 공수 합계 13.0(명부 밖 ghost 9.0 포함, 경고 표시), 이팀원은 7/3 퇴사 표시: ' + txt().slice(0, 300));
  const att = () => wrote('set', /^worker_attendance\/2026-07-02$/), mdw = () => wrote('set', /^worker_manday\/2026-07-02$/);
  await click(root, '[data-pa-tog="w1"]', 300); await sleep(200); check(att().length === 1 && ['w1', 'wa', 'wb', 'wz'].every((x) => att()[0].data.checks.includes(x)) && mdw().length === 0 && !!att()[0].data.updatedAt, '출역 체크(김가나): 출역 문서만 저장(자동 공수 없음 — Ph2·Ph4), 공수만 있던 사람(wa·wb·wz)도 출역으로 맞춰 저장');
  await setv(root, '[data-pa-md="w2"]', '2'); await sleep(250); const m1 = mdw()[0], a1 = att()[1]; check(!!m1 && m1.data.md.w2 === 2 && m1.data.md.ghost === 9 && m1.data.md.wa === 1 && m1.data.md.wz === 2 && !!a1 && a1.data.checks.includes('w2'), '★ 공수 2 입력(이다라): 공수 문서에 w2:2 가 더해지고 명부 밖 ghost 9 등 기존 공수는 그대로, 출역도 자동으로 체크됨');
  await click(root, '[data-pa-adj="wa:0.5"]', 300); await sleep(200); check(mdw().length === 2 && mdw()[1].data.md.wa === 1.5 && mdw()[1].data.md.ghost === 9, '＋ 버튼: 김팀장 공수 1.0 → 1.5(0~3 안에서 0.5씩)');
  await click(root, '[data-pa-tog="wa"]', 300); check(!!document.querySelector('.jh-dialog') && /공수 1도 함께 지워집니다/.test(document.querySelector('.jh-dialog').textContent), '★ 공수가 있는 사람의 출역을 해제하면 "공수도 함께 지워집니다" 확인 창'); await confirmOk(); await sleep(250); const m3 = mdw()[2], a3 = att()[att().length - 1]; check(!!m3 && !('wa' in m3.data.md) && m3.data.md.ghost === 9 && !!a3 && !a3.data.checks.includes('wa'), '확인하면 그 사람의 공수와 출역이 함께 사라지고 다른 사람은 그대로');
  const nA = att().length; await click(root, '[data-pa-act="all"]', 300); await sleep(250); check(att().length === nA + 1 && ['w1', 'w2', 'wa', 'wb', 'wz'].every((x) => att()[nA].data.checks.includes(x)), '전체 출역: 대상 5명이 모두 체크되지 않았으므로 모두 체크(확인 창 없음)');
  await setv(root, '[data-pa-bulk]', '1.5'); await click(root, '[data-pa-act="bulk"]', 300); await sleep(250); const mb = mdw()[mdw().length - 1]; check(['w1', 'w2', 'wa', 'wb', 'wz'].every((x) => mb.data.md[x] === 1.5) && mb.data.md.ghost === 9, '전원 공수 1.5 일괄 적용: 대상 5명 1.5, 명부 밖 ghost 9 는 그대로');
  await click(root, '[data-pa-act="next"]', 400); await sleep(200); check(/2026-07-03/.test(txt()) && rowsOf().join() === '김가나,김팀장,낯선사람,이다라' && !/이팀원/.test(root.querySelector('.jh-pjt__list').textContent), '★ 7/3: 이팀원은 7/3 퇴사라 입력 대상에서 빠짐(7/2 까지는 나옴)');
  check(/2026년 7월/.test(txt()) && /이팀원/.test(root.querySelector('.jh-pjt__table').textContent) && /\(명부에 없음\) ghost/.test(txt()) && root.querySelector('.jh-pjt__table tbody tr:last-child td:last-child').textContent.trim() === '17.0', '★ 오른쪽에 7월 집계표가 처음부터 보임: 7/3 퇴사자 이팀원이 표에 있고, 명부에 없는 ghost 도 "(명부에 없음)" 행으로, 앞서 입력한 값(7/2 전원 1.5·ghost 9 + 7/3 0.5)이 반영된 전체 합계 17.0 — 입력하면 집계표가 바로 갱신');
  await click(root, '[data-pa-tab="cum"]', 400); await sleep(300); check(/인원별 누적 공수/.test(txt()) && /\(명부에 없음\) ghost/.test(root.querySelector('#pa-panel').textContent), '인원별 누적 공수에도 명부 밖 공수가 보임');
  await click(root, '[data-pa-tab="recent"]', 150); check(/최근 7일 공수 합계/.test(root.querySelector('#pa-panel').textContent), '최근 7일 탭'); await click(root, '[data-pa-tab="manage"]', 200); await click(root, '[data-pa-end="w2"]', 200); await confirmOk(); await sleep(250); const ro = wrote('set', /^pjt_workers_fab\/w2$/); check(ro.length === 1 && ro[0].merge === true && ro[0].data.active === false && ro[0].data.endedDate === '2026-07-03' && Object.keys(ro[0].data).sort().join() === 'active,endedDate' && !wrote('delete', /pjt_workers_fab/).length, '★ 투입 종료: 명부 문서를 지우지 않고 active:false·종료일만 병합 저장(삭제 없음)'); check(!rowsOf().includes('이다라') && /투입 종료/.test(root.querySelector('#pa-panel').textContent), '투입 종료한 사람은 그날 기록이 없으면 입력 대상에서 빠지고 명단 관리에는 "투입 종료"로 남음');
  await click(root, '[data-pa-rejoin="w2"]', 250); await sleep(200); const rj = wrote('set', /^pjt_workers_fab\/w2$/); check(rj.length === 2 && rj[1].data.active === true, '재투입하면 active:true');
  const root2 = await mountFresh(pjtMod.mountAttend, { segs: ['reg_REG1', '2026-09-05'], query: {} }); WR().length = 0; const r2rows = [...root2.querySelectorAll('[data-pa-tog]')].map((b) => b.closest('.jh-pjt__row').querySelector('strong').textContent);
  check(r2rows.join() === '가,나,박팀장', '경량PJT(REG1): 명부는 pjt_registry/REG1/workers 에서(가·나·박팀장)'); await click(root2, '[data-pa-tog="a"]', 300); await sleep(250);
  const la = wrote('set', /^pjt_registry\/REG1\/attendance\/2026-09-05$/), lm = wrote('set', /^pjt_registry\/REG1\/manday\/2026-09-05$/); check(la.length === 1 && la[0].data.checks.join() === 'a' && lm.length === 1 && lm[0].data.md.a === 1, '★ 경량PJT 출역 체크: 저장 경로가 pjt_registry/<id>/attendance·manday 이고, 이 프로젝트 설정(자동 공수 1)대로 공수 1.0 이 함께 들어감');
});
markDone(); console.log('\n' + (failed ? '문제가 있는 저장 동작 ' + failed + '건' : '모든 저장 동작이 올바른 경로·값으로 기록됨')); process.exit(failed ? 1 : 0);
