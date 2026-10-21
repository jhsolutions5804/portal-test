/* 영업기획 프로젝트 마진 ↔ 서버 마진 집계(marginAct) 연결 — 순수 함수(저장·호출 없음). 시험: tests/plan-margin-link.test.mjs · 설계: app-docs/margin-design.md.
 * 마진 = 청구(대금청구서) − 지급(지급예정서) − 자체 인력 노무비 − 프로젝트 간접비. 청구·지급은 앱이 정산서에서 계산하고, 서버가 간접비(direct)와 자체 인력(ownLabor)을 계산해 준다.
 * 서버 호출이 실패하거나 권한이 없으면 null 을 돌려줘서 기존 "잠정" 경고(지급 기준)가 그대로 보이게 한다 — 틀린 값을 확정처럼 보이지 않게. */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const won = (v) => num(v).toLocaleString('ko-KR');
const okReport = (r) => !!r && typeof r === 'object' && !Array.isArray(r) && r.ok === true && Array.isArray(r.projects);
/** 서버 응답에서 프로젝트 하나의 { direct, ownLabor } — 응답이 없거나 실패면 null(비워 두어 "잠정" 표시). 서버가 성공했는데 그 프로젝트가 없으면 0(간접비·자체 인력이 정말 없는 프로젝트) */
export function marginExtra(report, pid) {
  if (!okReport(report) || typeof pid !== 'string' || !pid) return null;
  const p = pid === 'common' ? null : report.projects.find((x) => x && x.pjt === pid);
  return { direct: p ? num(p.overhead) : 0, ownLabor: p ? num(p.ownLabor) : 0 };
}
/** 마진 옆에 보여 줄 주의 문구 — 마진에서 빠진 것·추정한 것·확인이 필요한 것. 해당 없으면 빈 목록 */
export function marginNotes(report) {
  if (!okReport(report)) return [];
  const notes = []; const rate = Math.round(num(report.employerRate) * 1000) / 10;
  if (report.estimated === true) notes.push('사업주 4대보험 ' + rate + '% 추정 포함(고지서와 맞춰 보정).');
  const um = report.unmarked && typeof report.unmarked === 'object' ? report.unmarked : {};
  if (num(um.count) > 0) notes.push('프로젝트 표시가 없는 간접비 ' + num(um.count) + '줄(' + won(um.amount) + '원)은 마진에 반영되지 않았습니다. 재무회계 "프로젝트 표시"에서 표시하면 반영됩니다.');
  const ua = Array.isArray(report.unallocatedLabor) ? report.unallocatedLabor.filter((x) => x && typeof x === 'object') : [];
  if (ua.length) notes.push('참여 기록이 없어 자체 인력 급여 ' + ua.length + '개월(' + won(ua.reduce((a, x) => a + num(x.amount), 0)) + '원, ' + ua.reduce((a, x) => a + num(x.people), 0) + '명)을 프로젝트에 나누지 못했습니다.');
  const pc = Array.isArray(report.payslipCheck) ? report.payslipCheck.filter((x) => x && typeof x.month === 'string') : [];
  if (pc.length) notes.push('급여명세서와 장부 5110 이 다른 달이 ' + pc.length + '개 있습니다(' + pc.map((x) => x.month).join(', ') + ').');
  const ul = report.unlinked && typeof report.unlinked === 'object' ? report.unlinked : {};
  if (num(ul.count) > 0) notes.push('인사 직원과 연결하지 못한 급여명세서 ' + num(ul.count) + '건(' + won(ul.amount) + '원)이 제외되었습니다.');
  return notes;
}
/** 서버 마진 집계 호출이 실패했을 때의 상태 — 권한이 없으면 'denied'(일반 영업기획 사용자는 정상이라 오류 문구 없이 지급 기준 "잠정"만), 그 밖은 'error'(불러오지 못했다고 알림). 호출 함수의 오류 코드는 functions/ 접두사가 붙어 오기도 하고 아니기도 해서 접두사를 떼고 정확히 비교한다 */
export function marginErrorState(e) {
  const code = e && typeof e === 'object' && typeof e.code === 'string' ? e.code.replace(/^functions\//, '') : '';
  return code === 'permission-denied' ? 'denied' : 'error';
}
