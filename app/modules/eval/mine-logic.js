/* 내 평가 — 순수 규칙(화면·네트워크 없이 시험 가능). 보안 규칙(docs/rules/eval_rules_block.rules)·서버 함수(portal-functions eval-act.js)와 같은 약속을 쓴다.
 *  과제 키 = "{연도}__{종류}__{대상 근로자 id}", 종류 = self(자기평가) | peer(동료평가) | lead(팀장의 1차 평가)
 *  제출 문서 id = "{연도}__{평가자 uid}__{대상}__{종류}"  (규칙이 id 의 평가자 uid 가 로그인한 사람인지 확인한다) */
export const KINDS = { self: '자기평가', peer: '동료평가', lead: '팀원 1차 평가' };
/** 동료평가 항목(서버 PEER_ITEMS=3 과 같은 수 — 점수 항목은 정확히 3개여야 서버가 집계에 쓴다) */
export const PEER_ITEMS = [{ key: 'collab', label: '협업·소통', hint: '의견을 나누고 필요한 정보를 공유했나요?' }, { key: 'trust', label: '신뢰·책임감', hint: '맡은 일을 믿고 맡길 수 있었나요?' }, { key: 'support', label: '업무 지원', hint: '필요할 때 도움을 주고 받았나요?' }];
/** 팀장의 1차 평가 항목(정기평가 업적·역량·태도 3영역 — 영역마다 5점. 세부 항목은 평가 운영 화면의 사장단 입력과 별개로 팀장이 영역 점수를 준다) */
export const LEAD_ITEMS = [{ key: 'achievement', label: '업적', hint: '맡은 목표와 업무 성과' }, { key: 'competency', label: '역량', hint: '직무 전문성·문제 해결' }, { key: 'conduct', label: '태도·근태·안전', hint: '성실성·안전 수칙·규정 준수' }];
export const itemsOf = (kind) => (kind === 'peer' ? PEER_ITEMS : kind === 'lead' ? LEAD_ITEMS : []);
export const MAX_TEXT = 2000;      // 서술 최대 글자(보안 규칙과 같은 상한)

export const taskKey = (year, kind, targetWid) => year + '__' + kind + '__' + targetWid;
export const subId = (year, raterUid, targetWid, kind) => year + '__' + raterUid + '__' + targetWid + '__' + kind;
/** 과제 키 → { year, kind, target }, 형식이 틀리면 null */
export function parseKey(k) { const p = String(k || '').split('__'); if (p.length !== 3 || !/^\d{4}$/.test(p[0]) || !KINDS[p[1]] || !p[2]) return null; return { year: Number(p[0]), kind: p[1], target: p[2] }; }
/** 과제 문서(eval_tasks/{연도}__{uid}).keys → 화면용 목록. 대상 이름은 names[근로자 id] 로 채우고, 종류·대상 순서로 정렬(자기평가 → 팀원 1차 → 동료) */
export function tasksOf(taskDoc, names) {
  const order = { self: 0, lead: 1, peer: 2 };
  return ((taskDoc && taskDoc.keys) || []).map((k) => { const p = parseKey(k); return p ? Object.assign({ key: k, name: (names && names[p.target]) || '(이름 없음)' }, p) : null; }).filter(Boolean)
    .sort((a, b) => order[a.kind] - order[b.kind] || String(a.name).localeCompare(String(b.name), 'ko'));
}
/** 제출 상태: none(안 씀) | draft(임시저장) | submitted(제출) */
export const statusOf = (sub) => (sub && sub.status === 'submitted' ? 'submitted' : sub && sub.status === 'draft' ? 'draft' : 'none');
export const STATUS_TEXT = { none: '작성 전', draft: '임시저장', submitted: '제출 완료' };
/** 진행 요약: 전체·제출·임시저장 건수 */
export function progressOf(tasks, subs) {
  const by = subs || {}; let done = 0, draft = 0; (tasks || []).forEach((t) => { const s = statusOf(by[t.key]); if (s === 'submitted') done++; else if (s === 'draft') draft++; });
  return { total: (tasks || []).length, done, draft, left: (tasks || []).length - done };
}
/** 제출할 수 있는 상태인가: 점수 항목을 모두 채웠고(자기평가는 서술 필수), 서술이 상한 이하 */
export function canSubmit(kind, sub) {
  const s = sub || {}; const items = itemsOf(kind); const text = String(s.text || '');
  if (text.length > MAX_TEXT) return { ok: false, reason: '서술은 ' + MAX_TEXT + '자 이내로 써 주세요.' };
  if (kind === 'self') return text.trim() ? { ok: true } : { ok: false, reason: '올해 성과·성장·개선하고 싶은 점을 한 줄이라도 써 주세요.' };
  const sc = s.scores || {}; const miss = items.filter((i) => !(Number.isInteger(sc[i.key]) && sc[i.key] >= 1 && sc[i.key] <= 5));
  return miss.length ? { ok: false, reason: '아직 점수를 주지 않은 항목이 있습니다: ' + miss.map((m) => m.label).join(', ') } : { ok: true };
}
/** 저장할 문서 본문 — 규칙(validBody)이 허용하는 필드만: year·raterUid·targetWid·kind·scores·text·status·updatedAt·submittedAt */
export function buildSubmission(year, raterUid, targetWid, kind, input, status, stamp) {
  const items = itemsOf(kind); const sc = {}; (items.length ? items : []).forEach((i) => { const v = Number((input && input.scores || {})[i.key]); if (Number.isInteger(v) && v >= 1 && v <= 5) sc[i.key] = v; });
  const out = { year, raterUid, targetWid, kind, scores: sc, text: String((input && input.text) || '').slice(0, MAX_TEXT), status: status === 'submitted' ? 'submitted' : 'draft', updatedAt: stamp };
  if (out.status === 'submitted') out.submittedAt = stamp; return out;
}
/** 화면 입력을 값으로 반영(복사본) — 점수는 1~5 정수만, 아니면 지움 */
export function withScore(sub, key, val) { const s = JSON.parse(JSON.stringify(sub || { scores: {}, text: '' })); s.scores = s.scores || {}; const n = Number(val); if (Number.isInteger(n) && n >= 1 && n <= 5) s.scores[key] = n; else delete s.scores[key]; return s; }
export const withText = (sub, text) => Object.assign({ scores: {} }, JSON.parse(JSON.stringify(sub || {})), { text: String(text || '').slice(0, MAX_TEXT) });
/** 내 근로자 찾기: 포털 계정(uid)·사번으로 근로자 명부와 연결 — 연결이 없으면 null */
export function myWorker(me, workers) {
  const m = me || {}; return (workers || []).find((w) => w && ((w.portalUid && w.portalUid === m.uid) || (w.empNo && m.empNo && String(w.empNo) === String(m.empNo)))) || null;
}
