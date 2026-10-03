/* 작성 화면의 순수 로직 — 양식 정의, 검증, 문서 데이터 만들기, 결재선 편집. (화면·Firestore 와 분리해 시험한다) */

export const MAX_APPROVERS = 5;
export const MAX_CC = 10;

export const LEAVE_TYPES = ['연차(유급)', '반차-오전(유급)', '반차-오후(유급)', '생리휴가(무급)', '출산전후휴가(유급)', '배우자출산휴가(유급)', '유산·사산휴가(유급)', '육아휴직(무급)', '가족돌봄휴가(무급)', '병가(무급)', '예비군/민방위(유급)'];
export const SPEND_CATEGORIES = ['식대', '교통비', '소모품', '공구/자재', '접대비', '기타'];
export const RECEIPTS = ['영수증 첨부', '카드전표', '세금계산서', '없음'];

/** 작성할 수 있는 문서 종류. spend 는 구매품의·지출결의를 한 양식으로 합친 것(저장은 기존 컬렉션 그대로). */
export const COMPOSE_TYPES = [
  { key: 'leave', label: '연차신청서', icon: '🏖️', guide: 'leave', desc: '연차·반차·특별휴가' },
  { key: 'spend', label: '구매·지출 결의서', icon: '🧾', guide: 'spend', desc: '구매품의 / 지출결의' },
  { key: 'daily', label: '업무일지', icon: '📝', guide: 'daily', desc: '프로젝트별 금일·명일 업무' },
  { key: 'cert', label: '재직증명서', icon: '🪪', guide: 'cert', desc: '제출처·부수 지정' },
  { key: 'resign', label: '휴직/퇴직', icon: '📤', guide: 'resign', desc: '휴직·퇴직 신청' }
];
export const typeOfDtype = (dtype) => (dtype === 'purchase' || dtype === 'expense' ? 'spend' : dtype);
export const composeType = (key) => COMPOSE_TYPES.find((t) => t.key === key) || null;

/* 양식 정의. type: text|textarea|date|select|number|money|items. showIf: 다른 항목 값에 따라 표시 */
const F = {
  leave: [
    { key: 'leaveType', label: '휴가 종류', type: 'select', opts: LEAVE_TYPES, required: true },
    { key: 'startDate', label: '시작일', type: 'date', required: true },
    { key: 'endDate', label: '종료일', type: 'date', required: true },
    { key: 'days', label: '일수', type: 'number', ph: '0.5 / 1 / 2…', required: true, hint: '날짜를 고르면 주말을 뺀 일수가 자동으로 들어갑니다. 필요하면 직접 고치세요.' },
    { key: 'reason', label: '사유', type: 'textarea', ph: '휴가 사유를 입력하세요', required: true },
    { key: 'contact', label: '비상연락처', type: 'text', ph: '휴가 중 연락처', hint: '비상 연락이 가능한 번호를 적어 주세요.' }
  ],
  resign: [
    { key: 'leaveKind', label: '구분', type: 'select', opts: ['퇴직', '휴직'], required: true },
    { key: 'lastDate', label: '퇴직/휴직 예정일', type: 'date', required: true },
    { key: 'returnDate', label: '복직 예정일', type: 'date', required: true, showIf: { key: 'leaveKind', equals: '휴직' } },
    { key: 'reason', label: '사유', type: 'textarea', ph: '사유를 입력하세요', required: true }
  ],
  cert: [
    { key: 'purpose', label: '용도', type: 'text', ph: '예) 금융기관 제출용', required: true },
    { key: 'language', label: '발급 언어', type: 'select', opts: ['한국어', '영문(English)'], required: true },
    { key: 'copies', label: '부수', type: 'number', ph: '1', required: true }
  ],
  daily: [
    { key: 'date', label: '작성일', type: 'date', required: true },
    { key: 'pjtId', label: '프로젝트', type: 'project', required: true },
    { key: 'todayWork', label: '금일 업무', type: 'textarea', ph: '오늘 한 일을 시간 순서대로 적어 주세요', required: true },
    { key: 'tomorrowWork', label: '명일 계획', type: 'textarea', ph: '내일 할 일' },
    { key: 'issue', label: '특이사항', type: 'textarea', ph: '안전·품질·자재 이슈 등' }
  ],
  spendBase: [{ key: 'vendor', label: '공급업체 / 거래처', type: 'text', ph: '업체명', required: true }, { key: 'purpose', label: '목적', type: 'textarea', ph: '사유를 입력하세요', required: true }],
  purchase: [{ key: 'dueDate', label: '필요일', type: 'date', required: true }, { key: 'items', label: '구매 품목', type: 'items' }],
  expense: [
    { key: 'expDate', label: '지출일', type: 'date', required: true },
    { key: 'category', label: '지출 구분', type: 'select', opts: SPEND_CATEGORIES, required: true },
    { key: 'amount', label: '금액 (원)', type: 'money', ph: '0', required: true },
    { key: 'receipt', label: '증빙 구비', type: 'select', opts: RECEIPTS, required: true },
    { key: 'items', label: '구매 품목', type: 'items' }
  ]
};

/** 작성 종류(+구매/지출 구분)에 따라 보여 줄 항목 목록 */
export function fieldsFor(type, values) {
  if (type === 'spend') {
    const kind = (values && values.kind) === 'expense' ? 'expense' : 'purchase';
    return F.spendBase.concat(F[kind]).filter((f) => visible(f, values));
  }
  return (F[type] || []).filter((f) => visible(f, values));
}
function visible(f, values) { return !f.showIf || (values && values[f.showIf.key] === f.showIf.equals); }
export function dtypeOf(type, values) { return type === 'spend' ? (values && values.kind === 'expense' ? 'expense' : 'purchase') : type; }

export const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** 연차 일수: 반차는 0.5, 그 외는 시작~종료 사이 주말을 뺀 날수(공휴일은 사람이 고친다) */
export function calcLeaveDays(startDate, endDate, leaveType) {
  if (leaveType && leaveType.indexOf('반차') !== -1) return 0.5;
  if (!startDate || !endDate) return '';
  const s = new Date(startDate + 'T00:00:00'), e = new Date(endDate + 'T00:00:00');
  if (isNaN(s) || isNaN(e) || e < s) return '';
  let n = 0; const cur = new Date(s);
  while (cur <= e) { const w = cur.getDay(); if (w !== 0 && w !== 6) n++; cur.setDate(cur.getDate() + 1); }
  return n;
}

export function defaultValues(type, me, now) {
  const today = ymd(now || new Date());
  const v = {};
  if (type === 'leave') Object.assign(v, { leaveType: '연차(유급)', startDate: today, endDate: today, days: calcLeaveDays(today, today, '연차(유급)'), reason: '', contact: '' });
  else if (type === 'resign') Object.assign(v, { leaveKind: '퇴직', lastDate: '', returnDate: '', reason: '' });
  else if (type === 'cert') Object.assign(v, { purpose: '', language: '한국어', copies: 1 });
  else if (type === 'daily') Object.assign(v, { date: today, pjtId: '', todayWork: '', tomorrowWork: '', issue: '' });
  else if (type === 'spend') Object.assign(v, { kind: 'purchase', vendor: '', purpose: '', dueDate: '', expDate: today, category: SPEND_CATEGORIES[0], amount: '', receipt: RECEIPTS[0], items: [] });
  return v;
}
export const emptyItem = () => ({ name: '', qty: '', unitPrice: '', link: '' });

/** 한글 받침에 맞는 조사: josa('금액','을','를') → '금액을', josa('사유','을','를') → '사유를' */
export function josa(word, withFinal, noFinal) {
  const ch = String(word || '').trim().slice(-1); const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return word + ((code - 0xac00) % 28 ? withFinal : noFinal);
  return word + noFinal;
}
const num = (x) => { const n = Number(String(x == null ? '' : x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

/** 입력값 검증 → { 항목키: 오류문구 } (비어 있으면 통과) */
export function validate(type, values, opts) {
  const err = {}; const v = values || {}; const draft = !!(opts && opts.draft);   // 임시저장은 필수 항목이 비어 있어도 되고 형식만 본다
  fieldsFor(type, v).forEach((f) => {
    const val = v[f.key];
    if (f.type === 'items') {
      const rows = (val || []).filter((r) => r.name || r.qty || r.unitPrice || r.link);
      rows.forEach((r, i) => {
        if (!draft && !String(r.name || '').trim()) err['items.' + i + '.name'] = '품목명을 입력해 주세요.';
        if (r.qty !== '' && r.qty != null && !(num(r.qty) > 0)) err['items.' + i + '.qty'] = '수량은 0보다 커야 합니다.';
        if (r.unitPrice !== '' && r.unitPrice != null && num(r.unitPrice) < 0) err['items.' + i + '.unitPrice'] = '단가가 올바르지 않습니다.';
      });
      if (!draft && type === 'spend' && v.kind !== 'expense' && !rows.length) err.items = '구매 품목을 한 줄 이상 입력해 주세요.';
      return;
    }
    const empty = val == null || String(val).trim() === '';
    if (f.required && empty) { if (!draft) err[f.key] = josa(f.label, '을', '를') + ' ' + (f.type === 'select' || f.type === 'project' || f.type === 'date' ? (f.type === 'date' ? '입력해' : '선택해') : '입력해') + ' 주세요.'; return; }
    if (empty) return;
    if ((f.type === 'number' || f.type === 'money') && !(num(val) > 0) && f.key !== 'amount') err[f.key] = josa(f.label, '은', '는') + ' 0보다 커야 합니다.';
    if (f.key === 'amount' && !(num(val) > 0)) err[f.key] = '금액은 0보다 커야 합니다.';
    if (f.key === 'copies' && (!Number.isInteger(num(val)) || num(val) > 20)) err[f.key] = '부수는 1~20 사이의 정수여야 합니다.';
    if (f.key === 'days' && num(val) % 0.5 !== 0) err[f.key] = '일수는 0.5 단위로 입력해 주세요.';
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(val))) err[f.key] = f.label + ' 형식이 올바르지 않습니다.';
  });
  if (type === 'leave' && !err.startDate && !err.endDate && v.startDate > v.endDate) err.endDate = '종료일이 시작일보다 빠릅니다.';
  if (type === 'resign' && v.leaveKind === '휴직' && !err.lastDate && !err.returnDate && v.returnDate && v.returnDate <= v.lastDate) err.returnDate = '복직 예정일은 휴직 예정일 이후여야 합니다.';
  if (type === 'daily' && opts && opts.projects && v.pjtId && !opts.projects.some((p) => p.id === v.pjtId)) err.pjtId = '선택할 수 없는 프로젝트입니다.';
  return err;
}

const ymdCompact = (d) => ymd(d).replace(/-/g, '');
/** 제목 자동 생성 — 기존 문서와 같은 모양(예: 20261005 김가나 연차(유급) 신청서) */
export function buildTitle(type, values, me, now) {
  const today = ymdCompact(now || new Date()); const name = (me && me.name) || '';
  const v = values || {};
  if (type === 'leave') return today + ' ' + name + ' ' + (v.leaveType || '연차') + ' 신청서';
  if (type === 'daily') { const d = String(v.date || '').replace(/-/g, '').slice(2); return '(' + (v.pjtCode || '') + ') ' + d + ' ' + name + ' 업무일지'; }
  if (type === 'cert') return today + ' ' + name + ' 재직증명서';
  if (type === 'resign') return today + ' ' + name + ' ' + (v.leaveKind || '휴직/퇴직') + ' 신청서';
  if (type === 'spend') return today + ' ' + name + (v.kind === 'expense' ? ' 지출결의서' : ' 구매품의서');
  return today + ' ' + name;
}

/** 저장할 문서 데이터(서버 시각·결재 상태는 넣지 않음) */
export function buildDocData(type, values, me, ctx) {
  const v = values || {}; const dtype = dtypeOf(type, v);
  const proj = (ctx && ctx.projects || []).find((p) => p.id === v.pjtId);
  const d = { dtype, authorUid: me.uid, authorName: me.name || '', authorRank: me.rank || '', authorDept: me.dept || '', authorEmail: me.email || '' };
  const text = (k) => String(v[k] == null ? '' : v[k]).trim();
  if (type === 'leave') Object.assign(d, { leaveType: text('leaveType'), startDate: v.startDate, endDate: v.endDate, days: num(v.days), reason: text('reason'), contact: text('contact') });
  else if (type === 'resign') Object.assign(d, { leaveKind: text('leaveKind'), lastDate: v.lastDate, returnDate: v.leaveKind === '휴직' ? (v.returnDate || '') : '', reason: text('reason') });
  else if (type === 'cert') Object.assign(d, { purpose: text('purpose'), language: text('language'), copies: num(v.copies) });
  else if (type === 'daily') Object.assign(d, { date: v.date, pjtId: v.pjtId, pjtCode: proj ? proj.pjtCode || proj.code || '' : '', pjtName: proj ? proj.name || '' : '', todayWork: String(v.todayWork || '').trim(), tomorrowWork: String(v.tomorrowWork || '').trim(), issue: String(v.issue || '').trim() });
  else if (type === 'spend') {
    Object.assign(d, { vendor: text('vendor'), purpose: text('purpose') });
    const items = (v.items || []).filter((r) => r.name || r.qty || r.unitPrice || r.link).map((r) => ({ name: String(r.name || '').trim(), qty: num(r.qty), unitPrice: num(r.unitPrice), amount: num(r.qty) * num(r.unitPrice), link: String(r.link || '').trim() }));
    if (v.kind === 'expense') Object.assign(d, { expDate: v.expDate, category: text('category'), amount: num(v.amount), receipt: text('receipt'), items });
    else Object.assign(d, { dueDate: v.dueDate, items });
  }
  d.title = buildTitle(type, Object.assign({}, v, { pjtCode: d.pjtCode }), me, ctx && ctx.now);
  return d;
}

/** 저장된 문서 → 작성 화면 값 (임시저장·반려 문서 수정용) */
export function valuesFromDoc(doc) {
  const type = typeOfDtype(doc.dtype); const v = defaultValues(type, {}, new Date());
  Object.keys(v).forEach((k) => { if (doc[k] != null) v[k] = doc[k]; });
  if (type === 'spend') {
    v.kind = doc.dtype === 'expense' ? 'expense' : 'purchase';
    const items = Array.isArray(doc.items) && doc.items.length ? doc.items : (doc.item ? [{ name: doc.item, qty: doc.qty, unitPrice: doc.unitPrice, link: (doc.refUrls || [])[0] || '' }] : []);
    v.items = items.map((r) => ({ name: r.name || '', qty: r.qty == null ? '' : r.qty, unitPrice: r.unitPrice == null ? '' : r.unitPrice, link: r.link || '' }));
  }
  return { type, values: v };
}

/* ───────── 결재선 편집 ─────────
 * state = { approvers:[uid…], cc:[uid…] } — 서버(core.js)의 상신 검증과 같은 규칙을 화면에서 미리 알려 준다. 최종 판단은 서버. */
const isGuest = (u) => /^guest/i.test(String((u && u.empNo) || '').trim());
export function lineContext(me, policy, guides, users, type) {
  const byUid = {}; (users || []).forEach((u) => { byUid[u.uid] = u; });
  const guide = guides && guides[(composeType(type) || {}).guide || type] || null;
  return { me, required: (policy && policy.required) || [], proxy: (policy && policy.proxy) || [], guide, users: users || [], byUid };
}
export const requiredFor = (ctx) => ctx.required.filter((u) => u !== ctx.me.uid);
const eligible = (ctx, uid, asApprover) => { const u = ctx.byUid[uid]; return !!u && u.status === 'approved' && uid !== ctx.me.uid && !(asApprover && isGuest(u)); };

/** 처음 보여 줄 결재선: 권장 결재선(있으면) + 빠진 필수 결재자 */
export function initialLine(ctx) {
  const approvers = []; const cc = [];
  const g = ctx.guide || {};
  (g.steps || []).forEach((u) => { if (eligible(ctx, u, true) && approvers.indexOf(u) === -1 && approvers.length < MAX_APPROVERS) approvers.push(u); });
  (g.cc || []).forEach((u) => { if (eligible(ctx, u, false) && approvers.indexOf(u) === -1 && cc.indexOf(u) === -1 && cc.length < MAX_CC) cc.push(u); });
  requiredFor(ctx).forEach((u) => { if (approvers.indexOf(u) === -1 && eligible(ctx, u, true)) { const i = cc.indexOf(u); if (i !== -1) cc.splice(i, 1); approvers.push(u); } });
  return { approvers, cc };
}
/** 기존 문서(반려·임시저장)의 결재선을 편집 상태로 */
export function lineFromDoc(doc, ctx) {
  const approvers = []; const cc = [];
  (doc.approvalLine || []).forEach((s) => {
    if (!s.uid || s.uid === ctx.me.uid || s.role === '작성') return;
    if (/^결재/.test(s.role)) { if (eligible(ctx, s.uid, true) && approvers.indexOf(s.uid) === -1) approvers.push(s.uid); }
    else if (eligible(ctx, s.uid, false) && cc.indexOf(s.uid) === -1) cc.push(s.uid);
  });
  requiredFor(ctx).forEach((u) => { if (approvers.indexOf(u) === -1) approvers.push(u); });
  return { approvers, cc };
}
export function addApprover(state, uid, ctx) {
  if (!eligible(ctx, uid, true)) return { state, error: '결재자로 지정할 수 없는 사람입니다.' };
  if (state.approvers.indexOf(uid) !== -1 || state.cc.indexOf(uid) !== -1) return { state, error: '이미 결재선에 있는 사람입니다.' };
  if (state.approvers.length >= MAX_APPROVERS) return { state, error: '결재자는 최대 ' + MAX_APPROVERS + '명까지 지정할 수 있습니다.' };
  return { state: { approvers: state.approvers.concat(uid), cc: state.cc } };
}
export function addCc(state, uid, ctx) {
  if (!eligible(ctx, uid, false)) return { state, error: '참조로 지정할 수 없는 사람입니다.' };
  if (state.approvers.indexOf(uid) !== -1 || state.cc.indexOf(uid) !== -1) return { state, error: '이미 결재선에 있는 사람입니다.' };
  if (state.cc.length >= MAX_CC) return { state, error: '참조는 최대 ' + MAX_CC + '명까지 지정할 수 있습니다.' };
  return { state: { approvers: state.approvers, cc: state.cc.concat(uid) } };
}
export const isLocked = (uid, ctx) => requiredFor(ctx).indexOf(uid) !== -1;
export function removeFromLine(state, uid, ctx) {
  if (isLocked(uid, ctx)) return { state, error: '필수 결재자는 뺄 수 없습니다.' };
  return { state: { approvers: state.approvers.filter((u) => u !== uid), cc: state.cc.filter((u) => u !== uid) } };
}
export function moveApprover(state, uid, dir) {
  const i = state.approvers.indexOf(uid); const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= state.approvers.length) return state;
  const a = state.approvers.slice(); a[i] = a[j]; a[j] = uid; return { approvers: a, cc: state.cc };
}
export function applyGuide(ctx) { return initialLine(ctx); }
/** 상신 전에 막아야 하는 문제 목록(서버 검증과 동일) */
export function lineIssues(state, ctx) {
  const out = [];
  if (!state.approvers.length) out.push('결재자를 한 명 이상 지정해 주세요.');
  requiredFor(ctx).forEach((u) => { if (state.approvers.indexOf(u) === -1) out.push('필수 결재자(' + ((ctx.byUid[u] && ctx.byUid[u].name) || '지정자') + ')가 결재선에 빠졌습니다.'); });
  if (state.approvers.length > MAX_APPROVERS) out.push('결재자는 최대 ' + MAX_APPROVERS + '명입니다.');
  return out;
}
export function guideStatus(state, ctx) {
  const g = ctx.guide; if (!g || !(g.steps || []).length) return { hasGuide: false, matches: null, names: [] };
  const names = g.steps.map((u) => (ctx.byUid[u] ? ctx.byUid[u].name + (ctx.byUid[u].rank ? ' ' + ctx.byUid[u].rank : '') : '(알 수 없음)'));
  const matches = g.steps.length === state.approvers.length && g.steps.every((u, i) => u === state.approvers[i]);
  return { hasGuide: true, matches, names, note: g.note || '' };
}
