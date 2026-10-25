/* 작성 화면의 순수 로직 — 양식 정의, 검증, 문서 데이터 만들기, 결재선 편집. (화면·Firestore 와 분리해 시험한다) */

export const MAX_APPROVERS = 5;
export const MAX_PARTS = 6; // 한 사람의 하루에 나눌 수 있는 참여 프로젝트 수(서버 pjt-part-act 의 day-split 규칙과 같다)
export const MAX_CC = 10;

export const LEAVE_TYPES = ['연차(유급)', '반차-오전(유급)', '반차-오후(유급)', '생리휴가(무급)', '출산전후휴가(유급)', '배우자출산휴가(유급)', '유산·사산휴가(유급)', '육아휴직(무급)', '가족돌봄휴가(무급)', '병가(무급)', '예비군/민방위(유급)'];
export const SPEND_CATEGORIES = ['식대', '교통비', '소모품', '공구/자재', '접대비', '기타'];
export const RECEIPTS = ['영수증 첨부', '카드전표', '세금계산서', '없음'];
export const DRIVE_KINDS = ['일반 업무용', '출퇴근용', '비업무용'];   // 업무용승용차 운행기록부의 구분(비업무용은 업무 사용거리 0)

/** 작성할 수 있는 문서 종류. spend 는 구매품의·지출결의를 한 양식으로 합친 것(저장은 기존 컬렉션 그대로). */
export const COMPOSE_TYPES = [
  { key: 'leave', label: '연차신청서', icon: '🏖️', guide: 'leave', desc: '연차·반차·특별휴가' },
  { key: 'spend', label: '구매·지출 결의서', icon: '🧾', guide: 'spend', desc: '구매품의 / 지출결의' },
  { key: 'daily', label: '업무일지', icon: '📝', guide: 'daily', desc: '프로젝트별 금일·명일 업무' },
  { key: 'cert', label: '재직증명서', icon: '🪪', guide: 'cert', desc: '제출처·부수 지정' },
  { key: 'resign', label: '휴직/퇴직', icon: '📤', guide: 'resign', desc: '휴직·퇴직 신청' },
  { key: 'attend', label: '근태 기록 수정 요청', icon: '⏰', guide: 'attend', desc: '지난 출퇴근 기록 입력·수정' },
  { key: 'drive', label: '차량 운행일지', icon: '🚙', guide: 'drive', desc: '운행 후 바로 기록 · 결재 없음' }
];
export const typeOfDtype = (dtype) => (dtype === 'purchase' || dtype === 'expense' ? 'spend' : dtype);
export const composeType = (key) => COMPOSE_TYPES.find((t) => t.key === key) || null;

/* 양식 정의. type: text|textarea|date|select|number|money|items|project|person.
 * row: 같은 row 값을 가진 항목은 한 줄에 나란히 놓는다(폰에서는 세로로). showIf: 다른 항목 값에 따라 표시 */
const F = {
  leave: [
    { key: 'leaveType', label: '휴가 종류', type: 'select', opts: LEAVE_TYPES, required: true, row: 'a' },
    { key: 'startDate', label: '시작일', type: 'date', required: true, row: 'a' },
    { key: 'endDate', label: '종료일', type: 'date', required: true, row: 'a' },
    { key: 'days', label: '일수', type: 'number', ph: '0.5 / 1 / 2…', required: true, row: 'a', hint: '날짜를 고르면 주말을 뺀 일수가 자동으로 들어갑니다.' },
    { key: 'reason', label: '사유', type: 'textarea', ph: '휴가 사유를 입력하세요', required: true, row: 'b' },
    { key: 'deputyUid', label: '업무 대리인', type: 'person', required: true, row: 'c', hint: '휴가 중 업무를 맡을 사람입니다. 이 문서의 참조로 자동 포함됩니다.' },
    { key: 'contact', label: '비상연락처', type: 'text', ph: '휴가 중 연락처', row: 'c' }
  ],
  resign: [
    { key: 'leaveKind', label: '구분', type: 'select', opts: ['퇴직', '휴직'], required: true, row: 'a' },
    { key: 'lastDate', label: '퇴직/휴직 예정일', type: 'date', required: true, row: 'a' },
    { key: 'returnDate', label: '복직 예정일', type: 'date', required: true, showIf: { key: 'leaveKind', equals: '휴직' }, row: 'a' },
    { key: 'reason', label: '사유', type: 'textarea', ph: '사유를 입력하세요', required: true, row: 'b' }
  ],
  cert: [
    { key: 'purpose', label: '용도', type: 'text', ph: '예) 금융기관 제출용', required: true, row: 'a' },
    { key: 'language', label: '발급 언어', type: 'select', opts: ['한국어', '영문(English)'], required: true, row: 'a' },
    { key: 'copies', label: '부수', type: 'number', ph: '1', required: true, row: 'a' }
  ],
  daily: [
    { key: 'date', label: '작성일', type: 'date', required: true, row: 'a', layout: 'narrow-first' },
    { key: 'pjtId', label: '프로젝트', type: 'project', allowCommon: true, required: true, row: 'a', hint: '프로젝트와 무관한 날(내근 등)은 "공통"을 고릅니다.' },
    { key: 'todayWork', label: '금일 업무', type: 'textarea', ph: '오늘 한 일을 시간 순서대로 적어 주세요', required: true, row: 'b' },
    { key: 'tomorrowWork', label: '명일 계획', type: 'textarea', ph: '내일 할 일', row: 'c' },
    { key: 'issue', label: '특이사항', type: 'textarea', ph: '안전·품질·자재 이슈 등', row: 'd' }
  ],
  drive: [
    { key: 'date', label: '운행일자', type: 'date', required: true, row: 'a', layout: 'narrow-first-3' }, // 운행일자·차량·프로젝트를 한 줄로(대표님 2026-10-25)
    { key: 'vehicleId', label: '차량', type: 'vehicle', required: true, row: 'a' },
    { key: 'pjtId', label: '프로젝트', type: 'project', allowCommon: true, required: true, row: 'a', hint: '업무용 운행이 어느 프로젝트인지 고르세요. 프로젝트와 무관하면 "공통"을 고릅니다.' },
    { key: 'origin', label: '출발지', type: 'text', ph: '예) 본사 창고', required: true, row: 'b' },
    { key: 'destination', label: '도착지', type: 'text', ph: '예) P4 Ph2 현장', required: true, row: 'b' },
    { key: 'kind', label: '구분', type: 'select', opts: DRIVE_KINDS, required: true, row: 'b' },
    { key: 'odoStart', label: '주행 전 계기판(km)', type: 'number', zeroOk: true, required: true, row: 'c' },
    { key: 'odoEnd', label: '주행 후 계기판(km)', type: 'number', zeroOk: true, required: true, row: 'c' },
    { key: 'bizKm', label: '업무용 사용거리(km)', type: 'number', zeroOk: true, row: 'c', hint: '비우면 주행거리 전체가 업무용입니다. 일부만 업무용이면 그 거리만 적으세요(비업무용 구분은 0).' },
    { key: 'purpose', label: '운행 목적', type: 'textarea', ph: '예) 현장 자재 운반, 협력업체 방문', required: true, row: 'd' },
    { key: 'note', label: '비고 (주유·통행료 등)', type: 'textarea', row: 'e' }
  ],
  attend: [
    { key: 'date', label: '수정할 날짜', type: 'date', required: true, row: 'a', hint: '지난 날짜만, 최근 60일 이내입니다. 오늘 기록은 출퇴근 기록 화면에서 직접 입력하세요.' },
    { key: 'checkIn', label: '출근', type: 'time', required: true, row: 'a' },
    { key: 'checkOut', label: '퇴근', type: 'time', required: true, row: 'a' },
    { key: 'reason', label: '사유', type: 'textarea', ph: '예) 퇴근 기록을 누르지 못했습니다', required: true, row: 'b' }
  ],
  spendBase: [
    { key: 'vendor', label: '공급업체 / 거래처', type: 'text', ph: '업체명', required: true, row: 'a' },
    { key: 'pjtId', label: '프로젝트 (회계 처리용)', type: 'project', allowCommon: true, required: true, row: 'a', hint: '어느 프로젝트 비용인지 고르세요. 프로젝트와 무관하면 "공통"을 고릅니다.' },
    { key: 'purpose', label: '목적', type: 'textarea', ph: '사유를 입력하세요', required: true, row: 'b' }
  ],
  purchase: [{ key: 'dueDate', label: '필요일', type: 'date', required: true, row: 'c' }, { key: 'items', label: '구매 품목', type: 'items' }],
  expense: [
    { key: 'expDate', label: '지출일', type: 'date', required: true, row: 'c' },
    { key: 'category', label: '지출 구분', type: 'select', opts: SPEND_CATEGORIES, required: true, row: 'c' },
    { key: 'amount', label: '금액 (원)', type: 'money', ph: '0', required: true, row: 'c' },
    { key: 'receipt', label: '증빙 구비', type: 'select', opts: RECEIPTS, required: true, row: 'c' },
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
/** 화면에 놓을 줄 목록: [{ cols, layout, fields }] — 같은 row 값끼리 한 줄(최대 4칸) */
export function fieldRows(type, values) {
  const list = fieldsFor(type, values); const rows = []; let cur = null;
  list.forEach((f) => {
    if (f.type === 'items') { cur = null; rows.push({ cols: 1, items: true, fields: [f] }); return; }
    if (cur && cur.row === f.row && cur.fields.length < 4) { cur.fields.push(f); cur.cols = cur.fields.length; }
    else { cur = { row: f.row, cols: 1, layout: f.layout || '', fields: [f] }; rows.push(cur); }
  });
  return rows;
}
function visible(f, values) { return !f.showIf || (values && values[f.showIf.key] === f.showIf.equals); }
/* ── 업무일지 "오늘 참여한 프로젝트"(대기열 1-2-2 2b, 대표님 2026-10-20): 직원이 하루에 참여한 프로젝트를 고른다. 내근이어도 선택하고 프로젝트와 무관하면 "공통".
 * 승인된 업무일지는 잠기므로 이 값은 문서 본문(buildDocData)에 넣지 않고, 문서 저장이 끝난 뒤 서버 pjtPartAct(save)로 별도 문서에 저장한다. 비율은 서버가 정한다(그날 일용직 공수 비율, 없으면 균등) — 쏠린 날만 직접 입력. */
const pid = (x) => (typeof x === 'string' ? x.trim() : '');
const asParts = (parts) => (Array.isArray(parts) ? parts.filter((p) => p && pid(p.pjt)).map((p) => ({ pjt: pid(p.pjt) })) : []);
/** 위에서 고른 프로젝트가 칩의 기본값 — 고르지 않았으면 빈 목록 */
export function partsDefault(pjtId) { const id = pid(pjtId); return id ? [{ pjt: id }] : []; }
/** 칩을 바꾼 뒤 위쪽 "프로젝트"(문서 제목·결재 목록에 쓰이는 대표 프로젝트)를 칩과 맞춘다 — 칩이 비어 있으면 그대로, 대표가 칩 안에 있으면 그대로(여럿이어도 사용자가 정한 대표 유지), 칩에서 빠졌으면 첫 칩. 문자열을 돌려준다 */
export function mainAfterToggle(parts, main) {
  const cur = asParts(parts); const m = pid(main); if (!cur.length) return m;
  return cur.some((p) => p.pjt === m) ? m : cur[0].pjt;
}
/** 칩 켜기·끄기 — 공통은 단독, 최대 MAX_PARTS 개(끄는 것은 항상 가능), 직접 입력한 비율은 구성이 바뀌면 지운다. 새 목록을 돌려준다 */
export function partsToggle(parts, pjt) {
  const cur = asParts(parts); const id = pid(pjt); if (!id) return cur;
  if (cur.some((p) => p.pjt === id)) return cur.filter((p) => p.pjt !== id);
  if (id === 'common') return [{ pjt: 'common' }];
  const next = cur.filter((p) => p.pjt !== 'common'); if (next.length >= MAX_PARTS) return cur; return next.concat([{ pjt: id }]);
}
/** 위쪽 프로젝트가 oldMain → newMain 으로 바뀔 때 칩이 따라간다 — oldMain 이 선택돼 있었으면 그 자리가 newMain 으로 바뀌고(다른 칩은 뒤에 남음), 이미 꺼져 있었으면 newMain 을 끝에 더한다. newMain 이 공통이면 공통 단독 */
export function partsSyncMain(parts, oldMain, newMain) {
  const cur = asParts(parts); const o = pid(oldMain), n = pid(newMain);
  if (n === 'common') return [{ pjt: 'common' }];
  const base = cur.filter((p) => p.pjt !== 'common'); const i = o ? base.findIndex((p) => p.pjt === o) : -1;
  if (!n) return i === -1 ? base : base.filter((p) => p.pjt !== o);
  if (base.some((p) => p.pjt === n)) return i === -1 ? base : base.filter((p, k) => k !== i);
  if (i !== -1) return base.map((p, k) => (k === i ? { pjt: n } : p));
  return base.length >= MAX_PARTS ? base : base.concat([{ pjt: n }]);
}
/** 직접 비율 입력(%칸 글자 목록) 검사 — 칸 수 = 프로젝트 수, 모두 0 보다 큰 숫자, 합 100(부동소수 오차 허용). 통과하면 서버로 보낼 ratio 가 붙은 목록 */
export function partsRatioDraft(parts, texts) {
  const bad = (error) => ({ ok: false, parts: null, error }); const cur = asParts(parts);
  if (!cur.length || !Array.isArray(texts) || texts.length !== cur.length) return bad('프로젝트마다 비율(%)을 입력해 주세요.');
  const nums = texts.map((t) => (typeof t === 'string' && t.trim() !== '' && /^\d+(\.\d+)?$/.test(t.trim()) ? Number(t.trim()) : NaN));
  if (nums.some((n) => !(n > 0))) return bad('비율(%)은 0 보다 큰 숫자로 모든 칸에 입력해 주세요.');
  const sum = nums.reduce((a, b) => a + b, 0); if (Math.abs(sum - 100) > 0.001) return bad('비율의 합이 100% 가 되어야 합니다(지금 ' + Math.round(sum * 100) / 100 + '%).');
  return { ok: true, parts: cur.map((p, i) => ({ pjt: p.pjt, ratio: nums[i] })), error: '' };
}
/** 임시저장은 비어 있어도 되고, 상신은 참여 프로젝트를 1개 이상 골라야 한다(업무일지는 전 직원 의무 작성) */
export function partsForSubmit(parts, draft) { if (draft) return { ok: true, error: '' }; return Array.isArray(parts) && asParts(parts).length ? { ok: true, error: '' } : { ok: false, error: '오늘 참여한 프로젝트를 한 개 이상 선택해 주세요(프로젝트와 무관하면 "공통").' }; }
/** 서버 pjtPartAct 호출 본문 — 업무일지가 아니거나 날짜·칩이 없으면 null(보내지 않음). 직접 비율이 있으면 ratio 도 함께 */
export function partsPayload(type, values) {
  if (type !== 'daily' || !values || typeof values !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(values.date || ''))) return null;
  const list = Array.isArray(values.parts) ? values.parts.filter((p) => p && pid(p.pjt)).map((p) => (typeof p.ratio === 'number' ? { pjt: pid(p.pjt), ratio: p.ratio } : { pjt: pid(p.pjt) })) : []; if (!list.length) return null;
  return { action: 'save', date: values.date, projects: list };
}
/* ── 참여 칩 연결 판단(index.js 가 부르는 순수 함수) ── */
const objOk = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** 참여 프로젝트 기능 스위치 — 문서 edoc_settings/parts 가 { enabled: true } 일 때만 켜진다(없거나 다른 값이면 꺼짐). 규칙(pjt_day_part 거부) 게시와 함수 배포가 끝난 뒤 켠다 */
export const partsEnabled = (data) => !!data && typeof data === 'object' && !Array.isArray(data) && data.enabled === true;
/** 서버 미리보기(기본 비율)가 필요한가 — 업무일지 값에 유효한 날짜가 있고 칩이 둘 이상이며 직접 입력이 꺼져 있을 때만 */
export function partsNeedsPreview(values, ui) { if (!objOk(values) || !/^\d{4}-\d{2}-\d{2}$/.test(String(values.date || ''))) return false; return asParts(values.parts).length >= 2 && !(objOk(ui) && ui.custom === true); }
/** 저장할 최종 목록 — 직접 입력이 켜져 있으면 입력칸 글자(칩 순서)를 읽어 ratio 를 붙이고, 아니면 칩 그대로(비율은 서버가 정한다). 결과 { ok, parts, error } */
export function partsFinal(values, ui) {
  if (!objOk(values)) return { ok: false, parts: null, error: '참여 프로젝트를 확인할 수 없습니다.' };
  const cur = asParts(values.parts); if (!(objOk(ui) && ui.custom === true)) return { ok: true, parts: cur, error: '' };
  const texts = objOk(ui.texts) ? ui.texts : {}; return partsRatioDraft(cur, cur.map((p) => (typeof texts[p.pjt] === 'string' ? texts[p.pjt] : '')));
}
/** 임시저장·상신 검사 — 상신이면 참여 프로젝트 1개 이상이 필수, 직접 비율이 켜져 있으면 합 100 검사(임시저장도 형식이 틀린 값은 막는다). 결과 { ok, error } */
export function partsSubmitCheck(values, ui, draft) {
  const base = partsForSubmit(objOk(values) ? values.parts : null, draft === true); if (!base.ok) return base;
  const f = partsFinal(values, ui); if (objOk(ui) && ui.custom === true && !f.ok) return { ok: false, error: f.error }; return { ok: true, error: '' };
}
/** 참여 기록 저장 실패 안내 문구 — 서버가 준 메시지가 있으면 그대로 */
export function partsSaveError(e) { const m = e && typeof e.message === 'string' ? e.message.trim() : ''; return m || '참여 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'; }
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

/** 오늘이 토·일이면 다음 월요일, 아니면 오늘 (연차 기본 날짜) */
export function nextBusinessDay(now) {
  const d = new Date(now || new Date()); d.setHours(0, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return ymd(d);
}
export function defaultValues(type, me, now) {
  const today = ymd(now || new Date());
  const v = {};
  if (type === 'leave') { const nb = nextBusinessDay(now); Object.assign(v, { leaveType: '연차(유급)', startDate: nb, endDate: nb, days: calcLeaveDays(nb, nb, '연차(유급)'), reason: '', contact: '', deputyUid: '' }); }
  else if (type === 'resign') Object.assign(v, { leaveKind: '퇴직', lastDate: '', returnDate: '', reason: '' });
  else if (type === 'cert') Object.assign(v, { purpose: '', language: '한국어', copies: 1 });
  else if (type === 'attend') { const y = new Date(now || new Date()); y.setDate(y.getDate() - 1); Object.assign(v, { date: ymd(y), checkIn: '', checkOut: '', reason: '' }); }
  else if (type === 'daily') Object.assign(v, { date: today, pjtId: '', todayWork: '', tomorrowWork: '', issue: '', parts: [] }); // parts = 오늘 참여한 프로젝트 칩(문서 본문에는 넣지 않고 업무일지와 별도 기록 pjt_day_part 로 서버가 저장)
  else if (type === 'drive') Object.assign(v, { date: today, vehicleId: '', pjtId: '', origin: '', destination: '', kind: DRIVE_KINDS[0], odoStart: '', odoEnd: '', bizKm: '', purpose: '', note: '' });
  else if (type === 'spend') Object.assign(v, { kind: 'purchase', vendor: '', pjtId: '', purpose: '', dueDate: '', expDate: today, category: SPEND_CATEGORIES[0], amount: '', receipt: RECEIPTS[0], items: [] });
  return v;
}
/** 근태 요청의 근무시간(점심 2시간 제외, 단 출근~퇴근 5시간 이하는 제외 안 함 · 퇴근이 더 이르면 다음 날 퇴근) — 서버(attend-calc.js)와 같은 규칙 */
export function attendHoursOf(ci, co) { const [ih, im] = String(ci).split(':').map(Number); const [oh, om] = String(co).split(':').map(Number); let m = (oh * 60 + om) - (ih * 60 + im); if (m <= 0) m += 1440; return Math.max(0, m - (m <= 300 ? 0 : 120)) / 60; }
export const emptyItem = () => ({ name: '', qty: '', unitPrice: '', link: '' });

/** 한글 받침에 맞는 조사: josa('금액','을','를') → '금액을', josa('사유','을','를') → '사유를' */
export function josa(word, withFinal, noFinal) {
  const ch = String(word || '').trim().slice(-1); const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return word + ((code - 0xac00) % 28 ? withFinal : noFinal);
  return word + noFinal;
}
const num = (x) => { const n = Number(String(x == null ? '' : x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

/** 입력값 검증 → { 항목키: 오류문구 } (비어 있으면 통과) */
/** 차량 운행일지 전용 검사 — 계기판 전·후, 업무용 거리, 미래 날짜 */
function driveChecks(v, err) {
  const has = (x) => x !== '' && x != null; const a = num(v.odoStart), b = num(v.odoEnd);
  if (has(v.odoStart) && has(v.odoEnd) && !err.odoEnd && b < a) err.odoEnd = '주행 후 계기판이 주행 전보다 작을 수 없습니다.';
  if (has(v.bizKm) && !err.bizKm) { const dist = b - a; if (num(v.bizKm) < 0) err.bizKm = '업무용 사용거리가 올바르지 않습니다.'; else if (has(v.odoStart) && has(v.odoEnd) && dist >= 0 && num(v.bizKm) > dist) err.bizKm = '업무용 사용거리(' + num(v.bizKm) + 'km)가 주행거리(' + dist + 'km)보다 클 수 없습니다.'; }
  if (v.date && !err.date && v.date > ymd(new Date())) err.date = '운행일자가 오늘보다 뒤입니다. 운행 후에 작성해 주세요.';
}
export function validate(type, values, opts) { const err = validateBase(type, values, opts); if (type === 'drive') driveChecks(values || {}, err); return err; }
function validateBase(type, values, opts) {
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
    if (f.required && empty) { if (!draft) err[f.key] = josa(f.label.replace(/ \(.*\)$/, ''), '을', '를') + ' ' + (f.type === 'select' || f.type === 'project' || f.type === 'person' ? '선택해' : '입력해') + ' 주세요.'; return; }
    if (empty) return;
    if ((f.type === 'number' || f.type === 'money') && !(num(val) > 0) && f.key !== 'amount' && !f.zeroOk) err[f.key] = josa(f.label, '은', '는') + ' 0보다 커야 합니다.';
    if (f.key === 'amount' && !(num(val) > 0)) err[f.key] = '금액은 0보다 커야 합니다.';
    if (f.key === 'copies' && (!Number.isInteger(num(val)) || num(val) > 20)) err[f.key] = '부수는 1~20 사이의 정수여야 합니다.';
    if (f.key === 'days' && num(val) % 0.5 !== 0) err[f.key] = '일수는 0.5 단위로 입력해 주세요.';
    if (f.key === 'days' && !(num(val) > 0)) err[f.key] = '일수가 0입니다. 선택한 기간이 주말뿐이라면 날짜를 다시 확인해 주세요.';
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(val))) err[f.key] = f.label + ' 형식이 올바르지 않습니다.';
  });
  if (type === 'attend' && !draft) {
    const today = ymd((opts && opts.now) || new Date()); const t = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
    if (!err.date) { const back = new Date(today + 'T00:00:00'); back.setDate(back.getDate() - 60);
      if (v.date >= today) err.date = '지난 날짜만 요청할 수 있습니다. 오늘 기록은 출퇴근 기록 화면에서 직접 입력해 주세요.'; else if (v.date < ymd(back)) err.date = '최근 60일 이내의 날짜만 요청할 수 있습니다. 관리자에게 직접 입력을 요청해 주세요.'; }
    if (!err.checkIn && !t(v.checkIn)) err.checkIn = '출근 시각 형식이 올바르지 않습니다.'; if (!err.checkOut && !t(v.checkOut)) err.checkOut = '퇴근 시각 형식이 올바르지 않습니다.';
    if (!err.checkIn && !err.checkOut) { if (v.checkIn === v.checkOut) err.checkOut = '출근과 퇴근 시각이 같습니다.'; else if (attendHoursOf(v.checkIn, v.checkOut) > 16) err.checkOut = '근무시간이 16시간을 넘습니다. 시각을 확인해 주세요.'; }
    if (opts && opts.worker === null) err.date = err.date || '근무자 명부와 연동된 계정만 요청할 수 있습니다. 인사 담당자에게 연동을 요청해 주세요.';
  }
  if (type === 'leave' && !err.startDate && !err.endDate && v.startDate > v.endDate) err.endDate = '종료일이 시작일보다 빠릅니다.';
  if (type === 'resign' && v.leaveKind === '휴직' && !err.lastDate && !err.returnDate && v.returnDate && v.returnDate <= v.lastDate) err.returnDate = '복직 예정일은 휴직 예정일 이후여야 합니다.';
  if ((type === 'daily' || type === 'spend') && opts && opts.projects && v.pjtId && v.pjtId !== 'common' && !opts.projects.some((p) => p.id === v.pjtId)) err.pjtId = '선택할 수 없는 프로젝트입니다.';
  if (type === 'leave' && v.deputyUid && opts && opts.users && !err.deputyUid) {
    const u = opts.users.find((x) => x.uid === v.deputyUid);
    if (!u || (opts.meUid && u.uid === opts.meUid)) err.deputyUid = '업무 대리인으로 지정할 수 없는 사람입니다.';
  }
  return err;
}

const ymdCompact = (d) => ymd(d).replace(/-/g, '');
/** 제목 자동 생성 — 기존 문서와 같은 모양(예: 20261005 김가나 연차(유급) 신청서) */
export function buildTitle(type, values, me, now) {
  const today = ymdCompact(now || new Date()); const name = (me && me.name) || '';
  const v = values || {};
  if (type === 'leave') return today + ' ' + name + ' ' + (v.leaveType || '연차') + ' 신청서';
  if (type === 'daily') { const d = String(v.date || '').replace(/-/g, '').slice(2); return '(' + (v.pjtId === 'common' ? '공통' : (v.pjtCode || '')) + ') ' + d + ' ' + name + ' 업무일지'; }
  if (type === 'drive') return String(v.date || '').replace(/-/g, '') + ' ' + name + ' 차량 운행일지' + (v.vehicleName ? ' (' + v.vehicleName + ')' : '');
  if (type === 'cert') return today + ' ' + name + ' 재직증명서';
  if (type === 'attend') return String(v.date || '').replace(/-/g, '') + ' ' + name + ' 근태 기록 수정 요청';
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
  if (type === 'leave') {
    const dep = (ctx && ctx.users || []).find((u) => u.uid === v.deputyUid);
    Object.assign(d, { leaveType: text('leaveType'), startDate: v.startDate, endDate: v.endDate, days: num(v.days), reason: text('reason'), contact: text('contact'), deputyUid: v.deputyUid || '', deputyName: dep ? dep.name : '', deputyRank: dep ? dep.rank || '' : '' });
  }
  else if (type === 'resign') Object.assign(d, { leaveKind: text('leaveKind'), lastDate: v.lastDate, returnDate: v.leaveKind === '휴직' ? (v.returnDate || '') : '', reason: text('reason') });
  else if (type === 'cert') Object.assign(d, { purpose: text('purpose'), language: text('language'), copies: num(v.copies) });
  else if (type === 'attend') Object.assign(d, { date: v.date, checkIn: v.checkIn, checkOut: v.checkOut, reason: text('reason'), workerId: (ctx && ctx.worker && ctx.worker.id) || '', workHours: attendHoursOf(v.checkIn, v.checkOut), breakMinutes: 120 });
  else if (type === 'daily') Object.assign(d, { date: v.date, pjtId: v.pjtId, pjtCode: v.pjtId === 'common' ? '공통' : proj ? proj.pjtCode || proj.code || '' : '', pjtName: v.pjtId === 'common' ? '프로젝트 무관(본사 경비)' : proj ? proj.name || '' : '', todayWork: String(v.todayWork || '').trim(), tomorrowWork: String(v.tomorrowWork || '').trim(), issue: String(v.issue || '').trim() });
  else if (type === 'drive') {
    const veh = (ctx && ctx.vehicles || []).find((x) => x.id === v.vehicleId); const a = num(v.odoStart), b = num(v.odoEnd); const dist = b >= a ? b - a : 0;
    const biz = v.kind === '비업무용' ? 0 : (v.bizKm === '' || v.bizKm == null ? dist : Math.min(num(v.bizKm), dist));
    Object.assign(d, { date: v.date, vehicleId: v.vehicleId || '', vehicleName: veh ? veh.name : '', vehiclePlate: veh ? veh.plate || '' : '', pjtId: v.pjtId || '', pjtCode: v.pjtId === 'common' ? '공통' : proj ? proj.pjtCode || proj.code || '' : '', pjtName: v.pjtId === 'common' ? '프로젝트 무관' : proj ? proj.name || '' : '', origin: text('origin'), destination: text('destination'), kind: text('kind'), odoStart: a, odoEnd: b, distance: dist, bizKm: biz, purpose: text('purpose'), note: text('note') });
  }
  else if (type === 'spend') {
    Object.assign(d, { vendor: text('vendor'), purpose: text('purpose'), pjtId: v.pjtId || '', pjtCode: v.pjtId === 'common' ? '공통' : proj ? proj.pjtCode || proj.code || '' : '', pjtName: v.pjtId === 'common' ? '프로젝트 무관(본사 경비)' : proj ? proj.name || '' : '' });
    const items = (v.items || []).filter((r) => r.name || r.qty || r.unitPrice || r.link).map((r) => ({ name: String(r.name || '').trim(), qty: num(r.qty), unitPrice: num(r.unitPrice), amount: num(r.qty) * num(r.unitPrice), link: String(r.link || '').trim() }));
    if (v.kind === 'expense') Object.assign(d, { expDate: v.expDate, category: text('category'), amount: num(v.amount), receipt: text('receipt'), items });
    else Object.assign(d, { dueDate: v.dueDate, items });
  }
  d.title = buildTitle(type, Object.assign({}, v, { pjtCode: d.pjtCode, vehicleName: d.vehicleName }), me, ctx && ctx.now);
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
export const isLocked = (uid, ctx) => requiredFor(ctx).indexOf(uid) !== -1 || (!!ctx.deputy && uid === ctx.deputy);
/** 업무 대리인을 정하면 참조로 자동 포함한다. prevAuto: 이전에 자동으로 넣었던 사람(바꾸면 빼 준다) → { state, auto, error } */
export function setDeputy(state, newUid, prevAuto, ctx) {
  let cc = state.cc.filter((u) => u !== prevAuto || u === newUid); let auto = null; let error = '';
  if (newUid && state.approvers.indexOf(newUid) === -1 && cc.indexOf(newUid) === -1) {
    if (cc.length >= MAX_CC) error = '참조가 가득 차서 업무 대리인을 넣지 못했습니다. 참조를 줄여 주세요.';
    else { cc = cc.concat(newUid); auto = newUid; }
  } else if (newUid && prevAuto === newUid) auto = newUid;
  return { state: { approvers: state.approvers, cc }, auto, error };
}
export function removeFromLine(state, uid, ctx) {
  if (isLocked(uid, ctx)) return { state, error: ctx.deputy && uid === ctx.deputy ? '업무 대리인은 참조로 고정됩니다. 바꾸려면 위쪽 "업무 대리인"을 변경하세요.' : '필수 결재자는 뺄 수 없습니다.' };
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
  if (ctx.deputy && state.approvers.indexOf(ctx.deputy) === -1 && state.cc.indexOf(ctx.deputy) === -1) out.push('업무 대리인이 결재선에 빠졌습니다.');
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
