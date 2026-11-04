/* 인사평가 면담 도구(2026-11-04 대표님: 성과면담 가이드를 인사평가에 반영 ②③④) — 순수 로직(화면·네트워크 없이 시험).
 * 외부 교육 자료(리얼코칭 「팀장을 위한 연말 성과면담 실전 가이드」, 「무단 상업적 재배포를 삼가」 표시)의 아이디어만 쓰고, 문구는 회사 용어로 새로 썼다.
 * 우리 회사 방식에 맞춘 점: 올해 평가 결과는 참고자료(점수·연봉에 직접 반영하지 않음, 시행 고지문)이고 면담은 사장단의 연봉협상 면담이다 — 그래서 등급과 보상이 곧바로 이어진다는 전제의 문구는 쓰지 않았다.
 * 저장 위치(모두 관리자 전용 interviews/{근로자} 아래 — 보안 규칙 isHrDataCollection 이 이미 관리자만 읽고 쓰게 막아 두어 규칙을 바꾸지 않는다):
 *   interviews/{근로자}/evidence/{자동 id}   평가 근거 메모(여러 건)
 *   interviews/{근로자}/review/{연도}        면담 준비 체크 + 면담 기록·실행 합의(연도마다 한 건)
 *   interviews/{근로자}/records/eval-{연도}  완료하면 인사 「근로자 면담」 이력에도 남기는 한 건(인사 이력 화면과 연결) */
export const EVAL_YEAR = 2026;
/** 올해 평가 회차 — 내 평가 화면(mine.js)과 같은 기준: 2027년부터는 그 해, 그 전에는 2026(2025-10~2026-09 기간을 2026년 11월에 평가) */
export const evalYearNow = (d) => { const y = (d instanceof Date ? d : new Date()).getFullYear(); return y >= 2027 ? y : EVAL_YEAR; };

/** 한국 시간 기준 오늘(YYYY-MM-DD) — 서버·브라우저 시간대와 무관하게 면담일·근거 메모 날짜의 「오늘」을 맞춘다 */
export const kstToday = (nowMs) => new Date((typeof nowMs === 'number' ? nowMs : Date.now()) + 9 * 3600000).toISOString().slice(0, 10);

export const evidencePath = (wid) => 'interviews/' + wid + '/evidence';
export const reviewPath = (wid) => 'interviews/' + wid + '/review';
export const reviewDocPath = (wid, year) => reviewPath(wid) + '/' + year;
export const hrRecordPath = (wid, year) => 'interviews/' + wid + '/records/eval-' + year;

/** ── 면담 전 준비 체크(네 가지) ── */
export const PREP_ITEMS = [
  { key: 'c1', text: '평가표의 기준과 올해 정한 업무 목표가 서로 맞는지 다시 확인했다.' },
  { key: 'c2', text: '올해의 성과 · 아쉬운 점 · 추가 기여를 근거 메모로 균형 있게 남겼다.' },
  { key: 'c3', text: '직원이 쓴 자기평가를 읽었고, 일정·인력·발주처 사정 같은 현장 여건을 따로 적어 두었다.' },
  { key: 'c4', text: '연봉·고과 질문에 어디까지 답할 수 있는지 확인했다(시행 고지문에 안내한 범위).' },
];
export const emptyPrep = () => ({ c1: false, c2: false, c3: false, c4: false });
export const prepOf = (p) => { const o = emptyPrep(); const x = p && typeof p === 'object' ? p : {}; Object.keys(o).forEach((k) => { o[k] = x[k] === true; }); return o; };
export const prepProgress = (p) => { const o = prepOf(p); return { done: Object.keys(o).filter((k) => o[k]).length, total: PREP_ITEMS.length }; };

const isDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return false; const y = +m[1], mo = +m[2], d = +m[3]; if (mo < 1 || mo > 12 || d < 1) return false; return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
export { isDate };
const txt = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);

/** ── 평가 근거 메모 — 면담에서 설명할 수 있도록 있었던 일을 그때그때 남기는 기록(칸 이름은 EV_LABELS 한 곳에서 관리) ── */
export const TONES = { win: '성과', gap: '개선 필요', extra: '추가 기여' };
export const EV_LIMITS = { expected: 300, actual: 600, impact: 300, said: 400 };
export const EV_LABELS = { date: '날짜', expected: '기대했던 수준', actual: '실제로 한 일·결과', impact: '일에 미친 영향', said: '직원이 한 설명' };
export const newEvidence = (today) => ({ date: today || '', tone: 'win', expected: '', actual: '', impact: '', said: '' });
export function buildEvidence(form, today, year) {
  const f = form || {}; const errors = []; const date = String(f.date || '').trim();
  if (!isDate(date)) errors.push('날짜를 입력해 주세요.'); else if (today && date > today) errors.push('날짜가 오늘보다 뒤입니다.');
  if (!TONES[f.tone]) errors.push('구분(성과·개선 필요·추가 기여)을 골라 주세요.');
  const raw = { expected: f.expected, actual: f.actual, impact: f.impact, said: f.said }; const labels = EV_LABELS;
  Object.keys(raw).forEach((k) => { if (String(raw[k] == null ? '' : raw[k]).trim().length > EV_LIMITS[k]) errors.push(labels[k] + '은(는) ' + EV_LIMITS[k] + '자 이내로 써 주세요.'); });
  if (!String(f.actual == null ? '' : f.actual).trim()) errors.push(EV_LABELS.actual + '을(를) 입력해 주세요.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], data: { evalYear: Number(year) || EVAL_YEAR, date, tone: f.tone, expected: txt(f.expected, EV_LIMITS.expected), actual: txt(f.actual, EV_LIMITS.actual), impact: txt(f.impact, EV_LIMITS.impact), said: txt(f.said, EV_LIMITS.said) } };
}
export const evidenceSorted = (list) => (list || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.createdMs) || 0) - (Number(a.createdMs) || 0));
export function toneCounts(list) { const c = { win: 0, gap: 0, extra: 0, total: 0 }; (list || []).forEach((e) => { if (e && TONES[e.tone]) { c[e.tone]++; c.total++; } }); return c; }
/** 한쪽 기록만 쌓이지 않았는지 알리는 안내(막지 않는다) — 비어 있으면 균형이 맞는 것 */
export function balanceNote(c) {
  const x = c || { win: 0, gap: 0, extra: 0, total: 0 }; if (!x.total) return '아직 근거 메모가 없습니다. 면담 전에 성과·아쉬운 점·추가 기여를 날짜와 함께 남겨 두세요.';
  const miss = []; if (!x.win) miss.push('성과'); if (!x.gap) miss.push('개선 필요'); return miss.length ? miss.join('·') + ' 기록이 없습니다. 한쪽 기록만 있으면 면담에서 근거가 한쪽으로 기울어 보일 수 있습니다.' : '';
}

/** ── 면담 기록·실행 합의 — 면담이 끝난 뒤 남기는 합의 내용(칸 이름은 RC_LABELS 한 곳에서 관리) ── */
export const RC_LIMITS = { interviewer: 40, summary: 600, employeeAction: 500, measure: 400, support: 400, disagreement: 600 };
export const RC_LABELS = { date: '면담일', interviewer: '면담자', summary: '올해 주요 성과(요약)', employeeAction: '직원이 시작할 행동', measure: '확인 방법', support: '회사가 해 줄 일', checkDate: '중간 확인일', disagreement: '합의하지 못한 부분' };
export const newRecord = (me) => ({ date: '', interviewer: (me && me.name) || '', summary: '', employeeAction: '', measure: '', support: '', checkDate: '', disagreement: '' });
export const REVIEW_STATUS_TEXT = { none: '기록 없음', draft: '작성 중', done: '완료' };
/** 저장된 문서(없으면 null) → 화면용 값 */
export function reviewFromDoc(d, me) {
  const x = d && typeof d === 'object' ? d : null; const rec = newRecord(me); const r = x && x.record && typeof x.record === 'object' ? x.record : {};
  Object.keys(rec).forEach((k) => { if (typeof r[k] === 'string') rec[k] = r[k]; });
  return { exists: !!x, status: x && x.status === 'done' ? 'done' : 'draft', prep: prepOf(x && x.prep), record: rec };
}
export const reviewStatusOf = (rv) => (!rv || !rv.exists ? 'none' : rv.status === 'done' ? 'done' : 'draft');
/** 저장할 본문 — status = 'draft'(임시저장, 형식만 검사) | 'done'(완료: 면담일·직원이 시작할 행동·중간 확인일 필수) */
export function buildReview(form, status, today, year) {
  const f = form || {}; const r = f.record || {}; const errors = []; const done = status === 'done';
  Object.keys(RC_LIMITS).forEach((k) => { if (String(r[k] == null ? '' : r[k]).trim().length > RC_LIMITS[k]) errors.push(RC_LABELS[k] + '은(는) ' + RC_LIMITS[k] + '자 이내로 써 주세요.'); });
  const date = String(r.date || '').trim(), check = String(r.checkDate || '').trim();
  if (date && !isDate(date)) errors.push('면담일 형식이 올바르지 않습니다.'); if (check && !isDate(check)) errors.push(RC_LABELS.checkDate + ' 형식이 올바르지 않습니다.');
  if (done) {
    if (!date) errors.push('면담일을 입력해 주세요.'); else if (isDate(date) && today && date > today) errors.push('면담일이 오늘보다 뒤입니다(면담을 마친 뒤 완료 처리해 주세요).');
    if (!String(r.employeeAction || '').trim()) errors.push(RC_LABELS.employeeAction + '을(를) 입력해 주세요.');
    if (!check) errors.push(RC_LABELS.checkDate + '을(를) 입력해 주세요(언제 어떤 자료로 확인할지).');
  }
  if (isDate(date) && isDate(check) && check < date) errors.push(RC_LABELS.checkDate + '이 면담일보다 앞입니다.');
  if (errors.length) return { ok: false, errors };
  const rec = {}; Object.keys(RC_LIMITS).forEach((k) => { rec[k] = txt(r[k], RC_LIMITS[k]); }); rec.date = date; rec.checkDate = check;
  return { ok: true, errors: [], data: { evalYear: Number(year) || EVAL_YEAR, prep: prepOf(f.prep), record: rec, status: done ? 'done' : 'draft' } };
}
/** 완료 처리할 때 인사 「근로자 면담」 이력에 남기는 한 건(memo·followUp 은 인사 면담 화면이 보여 주는 필드) */
export function interviewMemo(rec, year) {
  const r = rec || {}; const L = []; const add = (k, v) => { if (String(v || '').trim()) L.push(k + ': ' + String(v).trim()); };
  L.push('[인사평가 ' + year + ' 면담]'); add('올해 주요 성과', r.summary); add(RC_LABELS.employeeAction, r.employeeAction); add(RC_LABELS.measure, r.measure); add(RC_LABELS.support, r.support); add(RC_LABELS.checkDate, r.checkDate); add(RC_LABELS.disagreement, r.disagreement);
  return L.join('\n').slice(0, 4000);
}
export function hrRecordOf(rec, year, byName) {
  const r = rec || {}; return { date: r.date, memo: interviewMemo(r, year), followUp: !!String(r.disagreement || '').trim(), source: 'eval', evalYear: Number(year) || EVAL_YEAR, interviewer: String(r.interviewer || ''), createdByName: String(byName || '') };
}

/** ── 목록 한 줄 요약 ── */
export function rowSummary(worker, evidence, review) {
  const w = worker || {}; const c = toneCounts(evidence); const rv = review || null; const st = reviewStatusOf(rv);
  return { id: w.id, empNo: w.empNo || '', name: w.name || '', dept: w.dept || '', rank: w.rank || '', ev: c, prep: prepProgress(rv && rv.prep), status: st, date: rv && rv.record ? rv.record.date || '' : '', checkDate: rv && rv.record ? rv.record.checkDate || '' : '' };
}

/** ── 면담 진행 안내(우리 말로 쓴 안내문 — 외부 자료의 문구·예시를 옮기지 않았고, 시험이 대표 문구가 없는지 확인한다) ── */
export const FLOW = [
  { min: 5, title: '열기', say: '오늘은 점수를 알리는 자리가 아니라 올해를 같이 돌아보고 내년에 할 일을 정하는 자리입니다. 생각이 다른 부분은 편하게 말씀해 주세요.' },
  { min: 10, title: '직원 이야기 먼저', say: '올해 가장 보람 있었던 일은 무엇이었나요? 평가에 잘 안 담겼다고 느끼는 일이 있나요?' },
  { min: 15, title: '평가 근거 함께 보기', say: '기준에 비춰 본 근거를 메모와 자료로 같이 보겠습니다. 사실과 다른 점이 있으면 그 자리에서 말씀해 주세요.' },
  { min: 20, title: '아쉬움의 원인과 개선 방법', say: '아쉬웠던 일은 무엇 때문이었나요? 회사가 바꿔야 할 부분은 무엇이라고 보시나요?' },
  { min: 10, title: '합의하고 닫기', say: '다음 달까지 무엇부터 시작할지, 언제 무엇으로 확인할지 정하고 마치겠습니다.' },
];
export const FEEDBACK = { title: '말하는 순서: 있었던 일 → 그 결과 → 바라는 모습', fact: '있었던 일: 눈에 보이는 사실만 말합니다.', impact: '그 결과: 그 일이 일과 팀에 어떤 영향을 줬는지 말합니다.', hope: '바라는 모습: 앞으로 어떻게 하면 좋을지 구체적으로 말합니다.', example: { fact: '11월 둘째 주 안전교육 보고서가 사흘 늦게 제출됐습니다.', impact: '현장 점검 일정을 한 번 미뤄야 했습니다.', hope: '마감이 어려워 보이면 마감 전날까지 상황을 알려 주세요.' } };
export const HARD_QUESTIONS = [
  { q: '제 점수가 왜 이 정도인가요?', a: '한 해 동안의 노력과 현장 기여는 분명히 인정합니다. 다만 점수는 목표 대비 결과와 평가 기준으로 정해지니, 기준별 근거를 같이 보면서 설명드리겠습니다. 일정·인력 같은 외부 사정도 함께 확인하겠습니다.' },
  { q: '추가로 맡은 일이 평가에서 빠진 것 같아요.', a: '맡으신 일의 범위와 결과를 알려 주세요. 제가 확인하지 못한 일은 단정하지 않고, 평가에 어떻게 반영됐는지 다시 살펴보겠습니다.' },
  { q: '평가가 좋은데 연봉에는 어떻게 반영되나요?', a: '올해 평가 결과는 참고자료로 쓰고 연봉협상에서 함께 살펴본다고 안내드렸습니다. 이 자리에서 금액을 약속드릴 수는 없지만, 알려 드릴 수 있는 기준과 일정은 말씀드리겠습니다.' },
  { q: '평가하시는 분이 제 현장 업무를 제대로 보셨나요?', a: '제가 직접 보지 못한 부분이 있다는 점은 인정합니다. 업무 기록과 결과물을 함께 보면서 근거를 다시 확인하겠습니다.' },
  { q: '동료평가는 누가 줬나요?', a: '동료평가는 익명으로 처리하기로 안내드렸습니다. 개별 평가자는 알려 드리지 않고, 평균 점수만 반영됩니다. 구체적인 아쉬운 점은 제가 본 사실을 기준으로 말씀드리겠습니다.' },
];
export const FLOW_TOTAL_MIN = FLOW.reduce((s, x) => s + x.min, 0);
