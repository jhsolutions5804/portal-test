export const DOC_TYPES = ['daily', 'leave', 'resign', 'cert', 'purchase', 'expense'];
export const TYPE_LABEL = { daily: '업무일지', leave: '연차신청서', resign: '휴직/퇴직', cert: '재직증명서', purchase: '구매품의서', expense: '지출결의서' };
export const TYPE_GROUPS = [
  { key: 'all', label: '전체', types: DOC_TYPES },
  { key: 'daily', label: '업무일지', types: ['daily'] },
  { key: 'leave', label: '연차', types: ['leave'] },
  { key: 'resign', label: '휴직/퇴직', types: ['resign'] },
  { key: 'cert', label: '재직증명', types: ['cert'] },
  { key: 'spend', label: '구매·지출', types: ['purchase', 'expense'] }
];
export const STATUS_LABEL = { draft: '임시저장', pending: '결재대기', reviewing: '검토중', approved: '승인', rejected: '반려', posted: '게시' };
export const STATUS_GROUPS = [
  { key: 'all', label: '전체', statuses: null },
  { key: 'waiting', label: '결재 진행', statuses: ['pending', 'reviewing'] },
  { key: 'approved', label: '승인', statuses: ['approved'] },
  { key: 'posted', label: '게시', statuses: ['posted'] },
  { key: 'rejected', label: '반려', statuses: ['rejected'] },
  { key: 'draft', label: '임시저장', statuses: ['draft'] }
];
const PASSIVE = ['작성', '회람', '수신', '참조'];
export const isPassive = (role) => PASSIVE.indexOf(role) !== -1;

export function toMillis(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return 0;
}
const pad = (n) => String(n).padStart(2, '0');
function kst(ms) { return new Date(ms + 9 * 3600 * 1000); }
export function fmtDate(v) {
  const t = toMillis(v); if (!t) return '-';
  const d = kst(t); return d.getUTCFullYear() + '.' + pad(d.getUTCMonth() + 1) + '.' + pad(d.getUTCDate());
}
export function fmtDateTime(v) {
  const t = toMillis(v); if (!t) return '-';
  const d = kst(t); return fmtDate(t) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}
export function fmtYmd(s) { return s ? String(s).replace(/(\d{4})-(\d{2})-(\d{2})/, '$1.$2.$3') : ''; }
function won(n) {
  const v = Number(String(n == null ? '' : n).replace(/,/g, ''));
  return isFinite(v) && String(n).trim() !== '' ? v.toLocaleString('ko-KR') : '';
}

/** 담당자 판정은 계정 번호(uid)로만 한다(서버 규칙과 동일). 이름만 있는 구 단계는 누구의 차례로도 보지 않는다. */
export const isMyStep = (s, me) => !!s && typeof s.uid === 'string' && s.uid !== '' && s.uid === me.uid;
/** 지금 차례인 단계에 계정 번호가 없는 구 문서 — 서버가 처리하지 않으므로 관리자 확인이 필요하다 */
export function legacyCurrentStep(doc) {
  const i = currentStepIndex(doc);
  return i >= 0 && !(typeof doc.approvalLine[i].uid === 'string' && doc.approvalLine[i].uid !== '');
}

/** 지금 결재 차례인 단계의 인덱스(없으면 -1). 순번상 앞 단계가 모두 승인된 첫 pending 결재 단계. */
export function currentStepIndex(doc) {
  if (doc.status !== 'pending' && doc.status !== 'reviewing') return -1;
  const line = Array.isArray(doc.approvalLine) ? doc.approvalLine : [];
  for (let i = 0; i < line.length; i++) {
    const s = line[i];
    if (isPassive(s.role)) continue;
    if (s.status === 'approved' || s.status === 'done' || s.status === 'skipped') continue;
    return s.status === 'pending' ? i : -1;
  }
  return -1;
}
export function myTurn(doc, me) {
  const i = currentStepIndex(doc); if (i < 0) return false;
  return isMyStep(doc.approvalLine[i], me);
}
/** 대리 승인은 정책(edoc_settings/policy)의 대리 권한자만 — me.isProxy 는 화면이 정책을 읽어 채운다 */
export function canProxy(doc, me) { return me.isProxy === true && currentStepIndex(doc) >= 0 && !legacyCurrentStep(doc) && !myTurn(doc, me); }

/** 이 문서에서 내가 누를 수 있는 처리 버튼(화면 안내용 — 실제 허용은 서버가 다시 판단한다) */
export function availableActions(doc, me) {
  const out = []; const st = doc.status; const mine = doc.authorUid === me.uid;
  if (mine && (st === 'draft' || st === 'rejected')) out.push({ key: 'edit', label: st === 'rejected' ? '수정·재상신' : '수정·상신', variant: 'primary', group: 'primary' });
  const my = myTurn(doc, me); const proxy = canProxy(doc, me);
  if ((my || proxy) && !legacyCurrentStep(doc)) {
    out.push({ key: 'approve', label: proxy && !my ? '대리 승인' : '승인', variant: 'primary', group: 'primary' });
    if (me.isProxy || me.isRequired) out.push({ key: 'approve_post', label: '승인 후 게시(전결)', variant: 'secondary', group: 'primary' });
    out.push({ key: 'reject', label: proxy && !my ? '대리 반려' : '반려', variant: 'danger', group: 'danger' });
  }
  if (mine && (st === 'pending' || st === 'reviewing') && !my) out.push({ key: 'recall', label: '회수', variant: 'secondary', group: 'secondary' });
  if (st === 'approved') {
    const line = Array.isArray(doc.approvalLine) ? doc.approvalLine : [];
    const actives = line.filter((s) => !isPassive(s.role)); const last = actives[actives.length - 1];
    if (me.admin || me.isRequired || isMyStep(last, me)) out.push({ key: 'post', label: '게시', variant: 'primary', group: 'primary' });
  }
  if (st === 'approved' || st === 'posted') out.push({ key: 'print', label: '인쇄 · PDF', variant: st === 'approved' && out.some(a => a.key === 'post') ? 'secondary' : 'primary', group: 'secondary' });
  if ((mine && st === 'draft') || me.admin) out.push({ key: 'delete', label: '삭제', variant: 'ghost', group: 'danger' });
  return out;
}

/** 문서가 속하는 결재함 탭들 */
export function tabsOf(doc, me) {
  const line = Array.isArray(doc.approvalLine) ? doc.approvalLine : [];
  const mine = doc.authorUid === me.uid;
  const cc = !mine && line.some(s => isPassive(s.role) && s.role !== '작성' && isMyStep(s, me));
  return { todo: myTurn(doc, me) || canProxy(doc, me), mine, cc, all: me.admin ? true : doc.status === 'posted' };
}
export function tabDefs(me) {
  return [
    { key: 'todo', label: '결재할 문서' },
    { key: 'mine', label: '내가 올린' },
    { key: 'cc', label: '참조·회람' },
    { key: 'all', label: me.admin ? '전체' : '게시 문서' }
  ];
}

/** 제목이 비어 있는 구 문서도 목록·상세에서 알아볼 수 있게 '일자 작성자 종류'로 만든다 */
export function docTitle(d) {
  if (d.title && String(d.title).trim()) return String(d.title).trim();
  const ymd = (d.startDate || d.expDate || d.dueDate || d.date || '').replace(/-/g, '') || (toMillis(d.createdAt) ? fmtDate(d.createdAt).replace(/\./g, '') : '');
  return [ymd, d.authorName, TYPE_LABEL[d.dtype] || ''].filter(Boolean).join(' ');
}

export function summaryOf(d) {
  switch (d.dtype) {
    case 'daily': return [d.pjtCode, d.pjtName].filter(Boolean).join(' · ');
    case 'leave': {
      const range = fmtYmd(d.startDate) + (d.endDate && d.endDate !== d.startDate ? ' ~ ' + fmtYmd(d.endDate) : '');
      return [d.leaveType || '연차', range, d.days ? '(' + d.days + '일)' : ''].filter(Boolean).join(' ');
    }
    case 'resign': return [d.leaveKind, fmtYmd(d.lastDate)].filter(Boolean).join(' · ');
    case 'cert': return d.purpose || '';
    case 'purchase': return [d.item, d.qty ? '× ' + d.qty : ''].filter(Boolean).join(' ');
    case 'expense': return [d.category, won(d.amount) ? won(d.amount) + '원' : '', d.vendor].filter(Boolean).join(' · ');
    default: return '';
  }
}

export function filterDocs(docs, me, f) {
  const tg = TYPE_GROUPS.find(g => g.key === (f.type || 'all')) || TYPE_GROUPS[0];
  const sg = STATUS_GROUPS.find(g => g.key === (f.status || 'all')) || STATUS_GROUPS[0];
  const tab = f.tab || 'todo';
  const q = String(f.q || '').trim().toLowerCase();
  return docs.filter(d => {
    if (!tabsOf(d, me)[tab]) return false;
    if (tg.types.indexOf(d.dtype) === -1) return false;
    if (sg.statuses && sg.statuses.indexOf(d.status) === -1) return false;
    if (q) {
      const hay = [docTitle(d), d.authorName, d.authorDept, summaryOf(d)].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}
/* ── 페이지 구분: 한 번에 10·20·30건씩 끊어서 보여준다 ── */
export const PAGE_SIZES = [10, 20, 30];
export const DEFAULT_PAGE_SIZE = 20;
export function normalizeSize(v) { const n = parseInt(v, 10); return PAGE_SIZES.indexOf(n) !== -1 ? n : DEFAULT_PAGE_SIZE; }
export function pageOfIndex(index, size) { return index < 0 ? 1 : Math.floor(index / size) + 1; }
/** rows 를 page(1부터)·size 로 자른다. 범위를 벗어난 page 는 가까운 쪽으로 보정한다. */
export function paginate(rows, page, size) {
  const sz = normalizeSize(size);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / sz));
  const p = Math.min(pages, Math.max(1, parseInt(page, 10) || 1));
  const start = (p - 1) * sz;
  return { rows: rows.slice(start, start + sz), page: p, pages, total, size: sz, from: total ? start + 1 : 0, to: Math.min(total, start + sz) };
}
/** 번호 버튼 목록. 예) page 6/12 → [1,'…',4,5,6,7,8,'…',12] (앞뒤 2개씩, 처음·끝은 항상) */
export function pageNumbers(page, pages) {
  const out = []; let last = 0;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) {
      if (i - last > 1) out.push(i - last === 2 ? last + 1 : '…');
      out.push(i); last = i;
    }
  }
  return out;
}

export function tabCounts(docs, me) {
  const c = { todo: 0, mine: 0, cc: 0, all: 0 };
  docs.forEach(d => { const t = tabsOf(d, me); Object.keys(c).forEach(k => { if (t[k]) c[k]++; }); });
  return c;
}
export function stepState(doc, i) {
  const s = doc.approvalLine[i];
  if (s.role === '작성') return 'done';
  if (isPassive(s.role)) return 'ref';
  if (s.status === 'approved' || s.status === 'done') return 'done';
  if (s.status === 'skipped') return 'skipped';
  if (s.status === 'rejected') return 'rejected';
  return currentStepIndex(doc) === i ? 'current' : 'pending';
}
