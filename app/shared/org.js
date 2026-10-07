/* 조직 구조·직원 정렬의 순수 규칙 — 회사 영역(조직도)과 포털 관리(프로젝트 참여 지정)가 함께 쓴다. 화면·네트워크 없이 시험한다 */
export const DEPT_ORDER = ['사업본부', '영업기획팀', 'PJT팀', '경영지원본부', '인사총무팀', '재무회계팀'];   // 목록 보기의 부서 순서(대표님 확정 2026-10-07)
export const NO_DEPT = '(미지정)';
const num = (u) => (u && u.createdAt && typeof u.createdAt.toMillis === 'function' ? u.createdAt.toMillis() : (u && +u.createdAt) || 0);
/** 사번이 있는 사람이 먼저(숫자 순서), 없으면 등록 순 */
export function byEmpNo(a, b) {
  const ea = a.empNo || '', eb = b.empNo || '';
  if (ea && eb) return ea.localeCompare(eb, 'ko', { numeric: true });
  if (ea) return -1; if (eb) return 1; return num(a) - num(b);
}
/** 승인 직원을 부서별로 묶는다. 순서: 미지정 → 정해진 부서 순서 → 목록에 없는 부서(가나다 순, 옛 화면은 이들을 "미지정"에 숨겼다) */
export function groupOrg(users, query) {
  const q = String(query || '').trim().toLowerCase();
  const list = (users || []).filter((u) => !u.status || u.status === 'approved').filter((u) => !q || [u.name, u.dept, u.rank, u.phone, u.email, u.empNo].some((v) => String(v || '').toLowerCase().indexOf(q) !== -1));
  const map = new Map();
  list.forEach((u) => { const d = (u.dept && String(u.dept).trim()) || NO_DEPT; if (!map.has(d)) map.set(d, []); map.get(d).push(u); });
  const rest = [...map.keys()].filter((d) => d !== NO_DEPT && DEPT_ORDER.indexOf(d) === -1).sort((a, b) => a.localeCompare(b, 'ko'));
  const order = [NO_DEPT].concat(DEPT_ORDER, rest).filter((d) => map.has(d));
  return order.map((d) => ({ dept: d, people: map.get(d).slice().sort(byEmpNo) }));
}
/** 조직 구조(대표님 확정 2026-10-07): 사업본부 산하 영업기획팀·PJT팀(앞으로 PJT 1팀·2팀…), 경영지원본부 산하 인사총무팀·재무회계팀. 목록에 없는 부서는 대표 바로 아래 별도 상자로 보인다 */
/* 직급 순서(높은 직급 먼저) */
export const RANK_ORDER = ['대표', '부사장', '전무', '상무', '이사', '부장', '차장', '과장', '대리', '주임', '사원'];
export const ORG_TREE = [{ dept: '사업본부', teams: ['영업기획팀', 'PJT팀'], pattern: /^PJT\s*\d+\s*팀$/ }, { dept: '경영지원본부', teams: ['인사총무팀', '재무회계팀'] }];   // pattern: 나중에 생길 PJT 1팀·2팀 등은 목록에 없어도 사업본부 아래에 자동으로 붙는다
export const isGuestUser = (u) => /^guest/i.test(String((u && u.empNo) || '').trim());
const rankIdx = (r) => { const i = RANK_ORDER.indexOf(String(r || '').trim()); return i === -1 ? 99 : i; };
/** 높은 직급 먼저, 같으면 사번 순 */
export const byRank = (a, b) => (rankIdx(a.rank) - rankIdx(b.rank)) || byEmpNo(a, b);
/** 승인된 직원(GUEST 제외)으로 조직도 구조를 만든다. people 는 직급 순. 팀은 사람이 없어도 구조로 보여 준다 */
export function buildOrgTree(users) {
  const list = (users || []).filter((u) => (!u.status || u.status === 'approved') && !isGuestUser(u));
  const top = list.filter((u) => String(u.rank || '').trim() === '대표').sort(byRank);
  const rest = list.filter((u) => top.indexOf(u) === -1); const used = new Set();
  const pick = (dept) => { const r = rest.filter((u) => String(u.dept || '').trim() === dept).sort(byRank); r.forEach((u) => used.add(u)); return r; };
  const dyn = (b) => (b.pattern ? [...new Set(rest.map((u) => String(u.dept || '').trim()).filter((d) => b.pattern.test(d) && b.teams.indexOf(d) === -1))].sort((x, y) => x.localeCompare(y, 'ko', { numeric: true })) : []);
  const branches = ORG_TREE.map((b) => ({ dept: b.dept, people: pick(b.dept), teams: b.teams.concat(dyn(b)).map((t) => ({ dept: t, people: pick(t) })) }));
  const other = rest.filter((u) => !used.has(u)); const unit = new Map();
  other.forEach((u) => { const d = String(u.dept || '').trim() || NO_DEPT; if (!unit.has(d)) unit.set(d, []); unit.get(d).push(u); });
  const extras = [...unit.keys()].sort((a, b) => (a === NO_DEPT) - (b === NO_DEPT) || a.localeCompare(b, 'ko')).map((d) => ({ dept: d, people: unit.get(d).sort(byRank) }));
  const total = top.length + branches.reduce((n, b) => n + b.people.length + b.teams.reduce((m, t) => m + t.people.length, 0), 0) + extras.reduce((n, e) => n + e.people.length, 0);
  return { top, branches, extras, total };
}

/** 부서 선택지: 본부·팀(정해진 순서) + 사업본부 아래 "PJT n팀" 형태 + 계정에 실제로 들어 있는 그 밖의 부서(GUEST 제외) */
export function deptOptions(users) {
  const seen = new Set(); const out = [];
  const add = (d) => { d = String(d || '').trim(); if (d && d !== NO_DEPT && d !== 'guest' && !seen.has(d)) { seen.add(d); out.push(d); } };
  ORG_TREE.forEach((b) => { add(b.dept); b.teams.forEach(add); if (b.pattern) [...new Set((users || []).map((u) => String(u.dept || '').trim()).filter((d) => b.pattern.test(d)))].sort((x, y) => x.localeCompare(y, 'ko', { numeric: true })).forEach(add); });
  (users || []).filter((u) => !isGuestUser(u)).map((u) => String(u.dept || '').trim()).sort((x, y) => x.localeCompare(y, 'ko')).forEach(add);
  return out;
}
