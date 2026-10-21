/* 영업기획 프로젝트 마진 ↔ 서버 마진 집계(marginAct) 연결 — 순수 함수(저장·호출 없음). 시험: tests/plan-margin-link.test.mjs · 설계: app-docs/margin-design.md.
 * 마진 = 청구(대금청구서) − 지급(지급예정서) − 자체 인력 노무비 − 프로젝트 간접비. 청구·지급은 앱이 정산서에서 계산하고, 서버가 간접비(direct)와 자체 인력(ownLabor)을 계산해 준다.
 * 서버 호출이 실패하거나 권한이 없으면 null 을 돌려줘서 기존 "잠정" 경고(지급 기준)가 그대로 보이게 한다 — 틀린 값을 확정처럼 보이지 않게. */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const won = (v) => num(v).toLocaleString('ko-KR');
const okReport = (r) => !!r && typeof r === 'object' && !Array.isArray(r) && r.ok === true && Array.isArray(r.projects);
/** 서버 공통비 배부(allocate) 응답에서 프로젝트 하나의 몫과 전체 배부 현황 — 연결된 PJT 등록 id 로 찾는다(영업기획 id 가 아니다, 대기열 1-2-2-④ 교훈). 응답 모양이 이상하면 null(이상한 숫자로 화면을 그리지 않는다). 응답에 그 프로젝트가 없으면 오류가 아니라 배부 0(공수 기록이 있는 달이 없어 배부된 공통비가 없음) */
export function allocFor(r, pjtId) {
  const fin = (v) => typeof v === 'number' && Number.isFinite(v); const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isO(r) || r.ok !== true || !Array.isArray(r.months) || !Array.isArray(r.projects) || !isO(r.total) || !fin(r.total.pool) || !fin(r.total.allocated) || !fin(r.total.unallocated) || !isO(r.unmarked) || !fin(r.unmarked.count) || !fin(r.unmarked.amount) || !isO(r.basisSummary) || !fin(r.basisSummary.daily) || !fin(r.basisSummary.own)) return null;
  const id = typeof pjtId === 'string' ? pjtId : ''; const months = []; let allocated = 0, manday = 0;
  if (id) r.months.forEach((m) => { if (!isO(m) || typeof m.month !== 'string' || !Array.isArray(m.shares)) return; m.shares.forEach((x) => { if (isO(x) && x.pjt === id && fin(x.amount) && fin(x.manday)) { months.push({ month: m.month, amount: x.amount, manday: x.manday }); allocated += x.amount; manday += x.manday; } }); });
  const pool = r.total.pool; const unallocatedMonths = r.months.filter((m) => isO(m) && m.basis === 'none').length;
  return { allocated, manday: Math.round(manday * 100) / 100, months, pool, allocatedTotal: r.total.allocated, unallocated: r.total.unallocated, unallocatedMonths, pctAllocated: pool > 0 ? Math.round(r.total.allocated / pool * 1000) / 10 : 0, unmarked: { count: r.unmarked.count, amount: r.unmarked.amount }, own: r.basisSummary.own, daily: r.basisSummary.daily };
}
/** 평가용 저장(서버 saveEval) 실패를 사람이 읽는 문구로 — 서버가 준 한국어 안내(완결 없음·연결 없음 등)는 그대로 보여 주고(오류 코드 표기 functions/…: 는 뗌), 권한 없음·서버 함수 없음·그 밖은 정해진 문구 */
export function evalSaveError(e) {
  const code = String(e && typeof e === 'object' ? e.code || '' : '').replace(/^functions\//, ''); const msg = String(e && typeof e === 'object' ? e.message || '' : '').replace(/^(functions\/)?[a-z-]+:\s*/i, '').trim();
  if (code === 'permission-denied') return '평가용 저장은 재무회계 권한이 있는 계정만 할 수 있습니다.';
  if (code === 'failed-precondition') return msg || '평가용으로 저장할 수 없는 상태입니다. 프로젝트의 연결과 청구서 완결 여부를 확인해 주세요.';
  if (code === 'not-found' || code === 'unimplemented') return '평가용 저장 기능이 서버에 아직 배포되지 않았거나 프로젝트를 찾을 수 없습니다.';
  return '평가용 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}
/** 영업기획 프로젝트가 연결된 PJT 등록 id — 서버 마진 집계 응답(projects[].pjt)의 id 와 같은 종류다. 영업기획 id(pjt_숫자)와 다르므로 응답을 영업기획 id 로 찾으면 항상 못 찾아 0 으로 채워진다(대기열 1-2-2-④). 연결이 없으면(auto·none·빈 값·없음·글자가 아님) 빈 글자 */
export function linkedPjtId(p) { const v = p && typeof p === 'object' && typeof p.linkPjt === 'string' ? p.linkPjt.trim() : ''; return v && v !== 'auto' && v !== 'none' ? v : ''; }
/** 서버 응답에서 프로젝트 하나의 { direct, ownLabor } — 응답이 없거나 실패면 null(비워 두어 "잠정" 표시). 서버가 성공했는데 그 프로젝트가 없으면 0(간접비·자체 인력이 정말 없는 프로젝트) */
export function marginExtra(report, pid) {
  if (!okReport(report) || typeof pid !== 'string' || !pid) return null;
  const p = pid === 'common' ? null : report.projects.find((x) => x && x.pjt === pid);
  return { direct: p ? num(p.overhead) : 0, ownLabor: p ? num(p.ownLabor) : 0 };
}
/** 마진 옆에 보여 줄 주의 문구 — 마진에서 빠진 것·추정한 것·확인이 필요한 것. 해당 없으면 빈 목록.
 * report = 서버 report 응답(가볍게 — 전표를 안 봐서 미표시·장부 대조는 모른다), check = 서버 check 응답(사용자가 [장부 대조 확인]을 눌렀을 때만 받는다, 선택).
 * 대조를 안 했으면 항상 보이는 안내를 쓰고, 했으면 미표시 줄 수·장부 5110 불일치를 알린다. report 에 옛 키(unmarked·payslipCheck)가 섞여 와도 무시한다 — 옛 응답이 틀린 숫자를 보이지 않게 */
export function marginNotes(report, check) {
  if (!okReport(report)) return [];
  const notes = []; const rate = Math.round(num(report.employerRate) * 1000) / 10;
  if (report.estimated === true) notes.push('사업주 4대보험 ' + rate + '% 추정 포함(고지서와 맞춰 보정).');
  const ck = !!check && typeof check === 'object' && check.ok === true && !!check.unmarked && typeof check.unmarked === 'object' && Array.isArray(check.payslipCheck) ? check : null;
  const um = ck ? ck.unmarked : {}; const pc = ck ? ck.payslipCheck.filter((x) => x && typeof x.month === 'string') : [];
  if (!ck) notes.push('표시가 없는 현장경비는 마진에 반영되지 않습니다. 월 마감 점검이나 재무회계 "프로젝트 표시"에서 확인하세요(전표를 읽는 [장부 대조 확인]으로도 볼 수 있습니다).');
  else if (num(um.count) > 0) notes.push('프로젝트 표시가 없는 현장경비 ' + num(um.count) + '줄(' + won(um.amount) + '원)은 마진에 반영되지 않았습니다. 재무회계 "프로젝트 표시"에서 표시하면 반영됩니다.');
  const ua = Array.isArray(report.unallocatedLabor) ? report.unallocatedLabor.filter((x) => x && typeof x === 'object') : [];
  if (ua.length) notes.push('참여 기록이 없어 자체 직접노무비(급여) ' + ua.length + '개월(' + won(ua.reduce((a, x) => a + num(x.amount), 0)) + '원, ' + ua.reduce((a, x) => a + num(x.people), 0) + '명)을 프로젝트에 나누지 못했습니다.');
  if (pc.length) notes.push('급여명세서와 장부 5110 이 다른 달이 ' + pc.length + '개 있습니다(' + pc.map((x) => x.month).join(', ') + ').');
  const ul = report.unlinked && typeof report.unlinked === 'object' ? report.unlinked : {};
  if (num(ul.count) > 0) notes.push('인사 직원과 연결하지 못한 급여명세서 ' + num(ul.count) + '건(' + won(ul.amount) + '원)이 제외되었습니다.');
  if (ck && num(um.count) === 0 && pc.length === 0) notes.push('장부 대조 완료: 이상 없음(미표시 현장경비 없음, 급여명세서와 장부 5110 일치).');
  return notes;
}
/** 서버 마진 집계 호출이 실패했을 때의 상태 — 권한이 없으면 'denied'(일반 영업기획 사용자는 정상이라 오류 문구 없이 지급 기준 "잠정"만), 그 밖은 'error'(불러오지 못했다고 알림). 호출 함수의 오류 코드는 functions/ 접두사가 붙어 오기도 하고 아니기도 해서 접두사를 떼고 정확히 비교한다 */
export function marginErrorState(e) {
  const code = e && typeof e === 'object' && typeof e.code === 'string' ? e.code.replace(/^functions\//, '') : '';
  return code === 'permission-denied' ? 'denied' : 'error';
}
