/* 총무 — 임대·차량·자산·갱신 일정. 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 네 종류(lease·vehicle·asset·renewal)는 항목 정의(GTYPES) 하나로 목록·입력·검증·만기 알림이 모두 같은 방식으로 돌아간다. */
import { csvCell } from '../../shared/csv.js?v=20261031h';
export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
/** 오늘부터 date 까지 남은 날수(지났으면 음수), 날짜가 아니면 null */
export const dday = (date, today) => { if (!isDate(date)) return null; return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse((today || kstToday()) + 'T00:00:00Z')) / 86400000); };
export const won = (v) => Math.round(Number(v) || 0).toLocaleString('ko-KR');
const ymIdx = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7));

const leaseMonthlyOf = (d) => (Number(d.rent) || 0) + (Number(d.vat) || 0);
export const leaseMonthly = leaseMonthlyOf;
const CYCLE_YEAR = { '월': 12, '분기': 4, '연': 1 };

export const GTYPES = {
  lease: {
    key: 'lease', title: '임대', icon: '🏢', coll: 'general_leases', add: '임대 추가', activeFilter: '사용중',
    label: (d) => d.name || '(이름 없음)', active: (d) => d.status !== '종료',
    fields: [
      { k: 'name', l: '이름', t: 'text', req: true, ph: '예) 원희캐슬 B111' }, { k: 'kind', l: '종류', t: 'select', o: ['창고', '사무실', '숙소', '기타'], d: '창고' },
      { k: 'place', l: '주소·호수', t: 'text' }, { k: 'lessor', l: '임대인', t: 'text' }, { k: 'contact', l: '임대인 연락처', t: 'text' }, { k: 'bank', l: '납부 방법·계좌', t: 'text', ph: '예) 계좌이체, 농협 353…' },
      { k: 'deposit', l: '보증금(원)', t: 'money' }, { k: 'rent', l: '월 임대료(원, 부가세 별도)', t: 'money' }, { k: 'vat', l: '월 부가세(원)', t: 'money' }, { k: 'fee', l: '월 관리비(원, 평균)', t: 'money' }, { k: 'payDay', l: '납부일(1~31, 모르면 비움)', t: 'int', min: 1, max: 31 },
      { k: 'start', l: '계약 시작일', t: 'date' }, { k: 'end', l: '계약 만료일', t: 'date' }, { k: 'status', l: '상태', t: 'select', o: ['사용중', '종료'], d: '사용중' }, { k: 'note', l: '비고', t: 'area' }],
    log: { k: 'payments', l: '입금 이력', cols: [{ k: 'ym', l: '귀속 월(YYYY-MM)', t: 'ym', req: true }, { k: 'date', l: '입금일', t: 'date' }, { k: 'amount', l: '금액(원)', t: 'money' }, { k: 'memo', l: '메모', t: 'text' }], newRow: (d) => ({ amount: leaseMonthlyOf(d) || '' }) },
    cols: [['이름', (d) => d.name], ['종류', (d) => d.kind], ['월 납부액(부가세 포함)', (d) => (leaseMonthlyOf(d) ? won(leaseMonthlyOf(d)) + '원' : ''), 'num'], ['납부일', (d) => (d.payDay ? d.payDay + '일' : '')], ['계약 만료', (d) => d.end || '']],
    dues: (d) => [{ what: '계약 만료', date: d.end, lead: 60 }]
  },
  vehicle: {
    key: 'vehicle', title: '차량', icon: '🚙', coll: 'general_vehicles', add: '차량 추가', activeFilter: '운행',
    label: (d) => d.name || '(이름 없음)', active: (d) => d.status !== '반납·매각',
    fields: [
      { k: 'name', l: '차량명(모델)', t: 'text', req: true, ph: '예) GMC 시에라' }, { k: 'plate', l: '차량번호', t: 'text' }, { k: 'kind', l: '구분', t: 'select', o: ['렌트', '할부', '리스', '소유'], d: '렌트' }, { k: 'company', l: '금융사·렌트사', t: 'text', ph: '예) 현대캐피탈' },
      { k: 'ref', l: '계약·계좌 번호(끝자리)', t: 'text' }, { k: 'monthly', l: '월 납부액(원)', t: 'money' }, { k: 'payDay', l: '납부일(1~31)', t: 'int', min: 1, max: 31 }, { k: 'start', l: '계약 시작일', t: 'date' }, { k: 'end', l: '계약 만료일', t: 'date' },
      { k: 'deposit', l: '보증금·선수금(원)', t: 'money' }, { k: 'driver', l: '사용자(운전자)', t: 'text' }, { k: 'delivery', l: '출고일(운행일지 시작일)', t: 'date' }, { k: 'deliveryOdo', l: '출고 시 계기판(km)', t: 'int', min: 0 }, { k: 'odo', l: '현재 주행거리(km)', t: 'int', min: 0 },
      { k: 'insCompany', l: '보험사', t: 'text' }, { k: 'insExpire', l: '보험 만기일', t: 'date' }, { k: 'insPremium', l: '연 보험료(원)', t: 'money' }, { k: 'inspect', l: '다음 정기검사일', t: 'date' }, { k: 'status', l: '상태', t: 'select', o: ['운행', '반납·매각'], d: '운행' }, { k: 'note', l: '비고', t: 'area' }],
    log: { k: 'service', l: '정비·점검 이력', cols: [{ k: 'date', l: '일자', t: 'date', req: true }, { k: 'item', l: '내용', t: 'text', req: true }, { k: 'cost', l: '비용(원)', t: 'money' }, { k: 'odo', l: '주행거리(km)', t: 'int' }, { k: 'shop', l: '정비소', t: 'text' }, { k: 'memo', l: '메모', t: 'text' }] },
    cols: [['차량', (d) => d.name + (d.plate ? ' (' + d.plate + ')' : '')], ['구분', (d) => d.kind], ['금융사', (d) => (d.company || '') + (d.ref ? ' ' + d.ref : '')], ['월 납부액', (d) => (Number(d.monthly) ? won(d.monthly) + '원' : ''), 'num'], ['보험 만기', (d) => d.insExpire || ''], ['정기검사', (d) => d.inspect || ''], ['계약 만료', (d) => d.end || '']],
    dues: (d) => [{ what: '계약 만료', date: d.end, lead: 60 }, { what: '보험 만기', date: d.insExpire, lead: 30 }, { what: '정기검사', date: d.inspect, lead: 30 }]
  },
  asset: {
    key: 'asset', title: '자산·장비', icon: '💻', coll: 'general_assets', add: '자산 추가', activeFilter: '사용중',
    label: (d) => d.name || '(이름 없음)', active: (d) => d.status !== '폐기',
    fields: [
      { k: 'name', l: '이름', t: 'text', req: true, ph: '예) 노트북 LG 그램' }, { k: 'category', l: '분류', t: 'select', o: ['노트북·PC', '모니터·주변기기', '공구·장비', '측정기', '휴대폰', '카메라', '가구·비품', '기타'], d: '노트북·PC' },
      { k: 'serial', l: '일련번호·관리번호', t: 'text' }, { k: 'purchase', l: '구입일', t: 'date' }, { k: 'cost', l: '구입가(원)', t: 'money' }, { k: 'vendor', l: '구입처', t: 'text' }, { k: 'holder', l: '현재 보유자', t: 'text' }, { k: 'place', l: '보관 위치', t: 'text' },
      { k: 'warranty', l: '보증 만료일', t: 'date' }, { k: 'status', l: '상태', t: 'select', o: ['사용중', '보관', '수리 중', '폐기'], d: '사용중' }, { k: 'note', l: '비고', t: 'area' }],
    log: { k: 'history', l: '지급·이동·수리 이력', cols: [{ k: 'date', l: '일자', t: 'date', req: true }, { k: 'action', l: '구분', t: 'select', o: ['지급', '반납', '이동', '수리', '폐기', '기타'], req: true }, { k: 'who', l: '대상(사람·장소)', t: 'text' }, { k: 'memo', l: '메모', t: 'text' }] },
    cols: [['이름', (d) => d.name], ['분류', (d) => d.category], ['보유자', (d) => d.holder || ''], ['위치', (d) => d.place || ''], ['구입일', (d) => d.purchase || ''], ['구입가', (d) => (Number(d.cost) ? won(d.cost) + '원' : ''), 'num'], ['상태', (d) => d.status]],
    dues: (d) => [{ what: '보증 만료', date: d.warranty, lead: 30 }]
  },
  credit: {
    key: 'credit', title: '외상 장부', icon: '🧾', coll: 'general_credits', add: '거래처 추가', activeFilter: '거래 중',
    label: (d) => d.name || '(이름 없음)', active: (d) => d.status !== '종료',
    fields: [
      { k: 'name', l: '거래처', t: 'text', req: true, ph: '예) ○○식당, ○○철물' }, { k: 'kind', l: '구분', t: 'select', o: ['구매(자재·공구)', '식당', '복지', '기타'], d: '구매(자재·공구)' },
      { k: 'contact', l: '연락처', t: 'text' }, { k: 'cycle', l: '결제 주기', t: 'select', o: ['월말', '수시', '건별', '기타'], d: '월말' },
      { k: 'bank', l: '결제 방법·계좌', t: 'text', ph: '예) 월말 계좌이체, 농협 353…' }, { k: 'status', l: '상태', t: 'select', o: ['거래 중', '종료'], d: '거래 중' }, { k: 'note', l: '비고', t: 'area' }],
    log: { k: 'entries', l: '거래 내역', cols: [{ k: 'date', l: '일자', t: 'date', req: true }, { k: 'type', l: '구분', t: 'select', o: ['외상', '결제', '반품'], req: true }, { k: 'corp', l: '청구 법인', t: 'select', o: ['제이에이치테크', '다람이엔지', '제이에이치엔지니어링', '기타'] }, { k: 'item', l: '품목·내용', t: 'text' }, { k: 'amount', l: '금액(원)', t: 'money' }, { k: 'pay', l: '결제 수단', t: 'select', o: ['카드', '계좌이체', '현금', '기타'] }, { k: 'pjt', l: '현장(PJT)', t: 'text' }, { k: 'memo', l: '메모', t: 'text' }] },
    cols: [['거래처', (d) => d.name], ['구분', (d) => d.kind], ['미결제 잔액', (d) => won(creditBalance(d)) + '원', 'num'], ['마지막 거래', (d) => creditLast(d)], ['결제 주기', (d) => d.cycle || '']],
    dues: () => []
  },
  renewal: {
    key: 'renewal', title: '갱신 일정', icon: '🔔', coll: 'general_renewals', add: '갱신 항목 추가', activeFilter: '사용중',
    label: (d) => d.name || '(이름 없음)', active: (d) => d.status !== '해지',
    fields: [
      { k: 'name', l: '이름', t: 'text', req: true, ph: '예) 마이크로소프트 365' }, { k: 'kind', l: '종류', t: 'select', o: ['구독·라이선스', '보험·공제', '계약', '정기점검·검사', '통신·인터넷', '기타'], d: '구독·라이선스' },
      { k: 'vendor', l: '업체', t: 'text' }, { k: 'amount', l: '1회 금액(원)', t: 'money' }, { k: 'cycle', l: '주기', t: 'select', o: ['월', '분기', '연', '비정기'], d: '월' }, { k: 'nextDate', l: '다음 갱신·만기일', t: 'date' }, { k: 'lead', l: '미리 알림(일)', t: 'int', min: 0, max: 365, d: 30 },
      { k: 'pay', l: '납부 방식', t: 'select', o: ['자동이체', '카드', '수동 납부'], d: '자동이체' }, { k: 'payNote', l: '납부 계좌·카드', t: 'text', ph: '예) 자동이체 (기업) 5일' }, { k: 'owner', l: '담당자', t: 'text' }, { k: 'status', l: '상태', t: 'select', o: ['사용중', '해지'], d: '사용중' }, { k: 'note', l: '비고', t: 'area' }],
    log: { k: 'history', l: '갱신 이력', cols: [{ k: 'date', l: '일자', t: 'date', req: true }, { k: 'amount', l: '금액(원)', t: 'money' }, { k: 'memo', l: '메모', t: 'text' }] },
    cols: [['이름', (d) => d.name], ['종류', (d) => d.kind], ['업체', (d) => d.vendor || ''], ['금액', (d) => (Number(d.amount) ? won(d.amount) + '원 / ' + (d.cycle || '') : ''), 'num'], ['납부', (d) => (d.payNote || d.pay || '')], ['다음 갱신', (d) => d.nextDate || '']],
    dues: (d) => [{ what: '갱신·만기', date: d.nextDate, lead: Number(d.lead) >= 0 && d.lead !== '' && d.lead != null ? Number(d.lead) : 30 }]
  }
};
export const GKEYS = Object.keys(GTYPES);

/** 입력 양식 값(문자열) → 저장할 문서. 틀린 곳은 errors 로 돌려주고 doc 는 null */
export function formToDoc(type, vals, logRows) {
  const T = GTYPES[type]; const errors = []; const doc = {}; const v = vals || {};
  T.fields.forEach((f) => {
    const raw = v[f.k]; const s = raw == null ? '' : String(raw).trim();
    if (f.req && !s) { errors.push(f.l + '을(를) 입력해 주세요.'); return; }
    if (f.t === 'text') doc[f.k] = s.slice(0, 80);
    else if (f.t === 'area') doc[f.k] = s.slice(0, 600);
    else if (f.t === 'select') { if (s && !f.o.includes(s)) errors.push(f.l + ' 값이 올바르지 않습니다.'); doc[f.k] = s || f.d || ''; }
    else if (f.t === 'date') { if (s && !isDate(s)) errors.push(f.l + '은(는) YYYY-MM-DD 형식이어야 합니다.'); doc[f.k] = s; }
    else if (f.t === 'money' || f.t === 'int') {
      if (!s) { doc[f.k] = f.d !== undefined ? f.d : 0; return; }
      const n = Number(s.replace(/[,\s원]/g, '')); if (!Number.isFinite(n) || n < 0 || (f.t === 'int' && !Number.isInteger(n))) { errors.push(f.l + '이(가) 올바른 숫자가 아닙니다.'); return; }
      if (f.min !== undefined && n < f.min && n !== 0) errors.push(f.l + '은(는) ' + f.min + ' 이상이어야 합니다.'); if (f.max !== undefined && n > f.max) errors.push(f.l + '은(는) ' + f.max + ' 이하여야 합니다.');
      doc[f.k] = Math.round(n);
    }
  });
  if (doc.start && doc.end && doc.end < doc.start) errors.push('계약 만료일이 시작일보다 빠릅니다.');
  const L = T.log; if (L) {
    const rows = []; (logRows || []).forEach((r, i) => {
      const row = {}; let bad = false; L.cols.forEach((c) => {
        const raw = r[c.k]; const s = raw == null ? '' : String(raw).trim();
        if (c.req && !s) { errors.push(L.l + ' ' + (i + 1) + '번째 줄: ' + c.l + '을(를) 입력해 주세요.'); bad = true; return; }
        if (c.t === 'date') { if (s && !isDate(s)) { errors.push(L.l + ' ' + (i + 1) + '번째 줄: ' + c.l + ' 형식이 올바르지 않습니다.'); bad = true; return; } row[c.k] = s; }
        else if (c.t === 'ym') { if (s && !isYm(s)) { errors.push(L.l + ' ' + (i + 1) + '번째 줄: ' + c.l + ' 형식이 올바르지 않습니다.'); bad = true; return; } row[c.k] = s; }
        else if (c.t === 'money' || c.t === 'int') { const n = s === '' ? 0 : Number(s.replace(/[,\s원]/g, '')); if (!Number.isFinite(n) || n < 0) { errors.push(L.l + ' ' + (i + 1) + '번째 줄: ' + c.l + '이(가) 올바른 숫자가 아닙니다.'); bad = true; return; } row[c.k] = Math.round(n); }
        else if (c.t === 'select') { if (s && !c.o.includes(s)) { errors.push(L.l + ' ' + (i + 1) + '번째 줄: ' + c.l + ' 값이 올바르지 않습니다.'); bad = true; return; } row[c.k] = s; }
        else row[c.k] = s.slice(0, 80);
      }); if (!bad) rows.push(row);
    });
    if (rows.length > 400) errors.push(L.l + '은(는) 400줄까지 저장할 수 있습니다.'); doc[L.k] = rows.slice(0, 400);
  }
  return errors.length ? { doc: null, errors } : { doc, errors: [] };
}
/** 저장된 문서 → 양식 값(문자열) */
export function docToForm(type, d) { const out = {}; GTYPES[type].fields.forEach((f) => { const x = d ? d[f.k] : undefined; out[f.k] = x == null ? (f.d !== undefined && !d ? String(f.d) : '') : String(x); }); return out; }
export const newDefaults = (type) => docToForm(type, null);

/** 임대: 가장 최근 입금(귀속 월 기준) */
export function leaseLast(d) { const p = (d.payments || []).filter((x) => isYm(x.ym)).slice().sort((a, b) => (a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : (a.date || '') < (b.date || '') ? -1 : 1)); return p.length ? p[p.length - 1] : null; }
/** 임대 입금 상태 — 종료된 임대는 없음, 입금 기록이 없으면 안내, 마지막 귀속 월이 두 달 넘게 뒤처지면 누락 가능 */
export function leasePayState(d, today) {
  if (d.status === '종료') return null; const last = leaseLast(d); if (!last) return { text: '입금 기록 없음', tone: 'muted' };
  const cur = (today || kstToday()).slice(0, 7); const diff = ymIdx(cur) - ymIdx(last.ym);
  if (diff >= 2) return { text: '입금 누락 가능 — 마지막 ' + last.ym, tone: 'danger' }; return { text: '입금 확인 — 마지막 ' + last.ym, tone: 'accent' };
}
/** 만기 알림 — 모든 종류의 만기일을 모아 가까운 순으로. horizon 일 안(지난 것 포함)만 보여 주고, 미리 알림 기간(lead) 안이면 경고 */
export function dueList(data, today, horizon) {
  const out = []; const H = horizon == null ? 90 : horizon; const t = today || kstToday();
  GKEYS.forEach((k) => { const T = GTYPES[k]; ((data && data[k]) || []).forEach((d) => { if (!T.active(d)) return; T.dues(d).forEach((du) => { const n = dday(du.date, t); if (n === null || n > H) return; out.push({ type: k, id: d.id, label: T.label(d), what: du.what, date: du.date, d: n, tone: n < 0 ? 'danger' : n <= du.lead ? 'warn' : 'muted' }); }); }); });
  return out.sort((a, b) => a.d - b.d || (a.label < b.label ? -1 : 1));
}
/** 외상 장부 — 잔액 = 외상 합계 − 결제 합계 − 반품 합계(거래 내역 줄 기준, 줄 값은 숫자·문자열 모두 허용) */
export function creditRowsBalance(rows) { let s = 0; (rows || []).forEach((r) => { const n = Number(String(r && r.amount != null ? r.amount : '').replace(/[,\s원]/g, '')) || 0; if (r && (r.type === '결제' || r.type === '반품')) s -= n; else if (r && r.type === '외상') s += n; }); return s; }
export const creditBalance = (d) => creditRowsBalance((d && d.entries) || []);
export function creditLast(d) { let m = ''; ((d && d.entries) || []).forEach((r) => { if (r && r.date && r.date > m) m = r.date; }); return m; }
/** 외상 장부 합계 — 거래 중인 거래처만, 구분별 미결제 잔액 */
export function creditTotals(list) { const kinds = GTYPES.credit.fields[1].o; const by = {}; kinds.forEach((k) => { by[k] = 0; }); let balance = 0; let open = 0; (list || []).filter(GTYPES.credit.active).forEach((d) => { const b = creditBalance(d); balance += b; if (b > 0) open += 1; const k = kinds.includes(d.kind) ? d.kind : '기타'; by[k] += b; }); return { balance, open, byKind: by }; }
/* ── 외상 장부: 거래 줄 거름·요약(검색·구분·청구 법인·월 필터, 월별·법인별 합계, CSV) — 화면과 같은 계산을 시험할 수 있게 여기에 둔다 ── */
const cNum = (v) => Number(String(v == null ? '' : v).replace(/[,\s원]/g, '')) || 0;
export const CREDIT_NO_CORP = '(미지정)';
/** 거래 내역 화면의 거름 기본값 — desc 는 '최근 거래 먼저' 정렬(기본 켬), size·page 는 페이지 나누기(기본 한 쪽 10줄, 10·20·50 선택) */
export { PAGE_SIZES as CREDIT_PAGE_SIZES, pageInfo as creditPageInfo, pageList as creditPageList } from '../../shared/pager.js?v=20261031h';
export const creditFltDefault = () => ({ q: '', type: '', corp: '', ym: '', desc: true, size: 10, page: 1 });
/** 거름 조건 f = { q, type, corp, ym } — 조건에 맞는 줄의 **원래 번호** 목록(표시 순서는 부르는 쪽이 정한다). corp 가 '(미지정)'이면 청구 법인이 빈 줄 */
export function creditFilterRows(rows, f) {
  const q = String((f && f.q) || '').trim().toLowerCase(); const type = (f && f.type) || ''; const corp = (f && f.corp) || ''; const ym = (f && f.ym) || '';
  const out = [];
  (rows || []).forEach((r, i) => {
    if (!r) return;
    if (type && r.type !== type) return;
    if (corp === CREDIT_NO_CORP ? !!r.corp : (corp && r.corp !== corp)) return;
    if (ym && String(r.date || '').slice(0, 7) !== ym) return;
    if (q && ![r.date, r.type, r.corp, r.item, r.pay, r.pjt, r.memo].some((x) => String(x == null ? '' : x).toLowerCase().includes(q))) return;
    out.push(i);
  });
  return out;
}
/** 줄 묶음 요약 — 구분별 합계·잔액(외상 − 결제 − 반품), 청구 법인별, 월별(월 순증감과 누적 잔액). 구분이 외상·결제·반품이 아닌 줄은 잔액 계산(creditRowsBalance)과 같이 제외한다 */
export function creditSummary(rows) {
  const blank = () => ({ 외상: 0, 결제: 0, 반품: 0, count: 0 });
  const tot = blank(); const corp = {}; const mon = {};
  (rows || []).forEach((r) => {
    if (!r || !['외상', '결제', '반품'].includes(r.type)) return;
    const n = cNum(r.amount); const ck = r.corp || CREDIT_NO_CORP; const mk = String(r.date || '').slice(0, 7) || '(일자 없음)';
    tot[r.type] += n; tot.count += 1;
    (corp[ck] = corp[ck] || blank())[r.type] += n; corp[ck].count += 1;
    (mon[mk] = mon[mk] || blank())[r.type] += n; mon[mk].count += 1;
  });
  const bal = (o) => o.외상 - o.결제 - o.반품;
  tot.balance = bal(tot);
  const byCorp = Object.keys(corp).map((k) => Object.assign({ corp: k, balance: bal(corp[k]) }, corp[k])).sort((a, b) => b.balance - a.balance || b.외상 - a.외상 || (a.corp < b.corp ? -1 : 1));
  let cum = 0; const NO_DATE = '(일자 없음)'; const byMonth = Object.keys(mon).sort((a, b) => (a === NO_DATE) - (b === NO_DATE) || (a < b ? -1 : a > b ? 1 : 0)).map((k) => { const net = bal(mon[k]); cum += net; return Object.assign({ ym: k, net, cum }, mon[k]); });
  return { total: tot, byCorp, byMonth };
}
/** 거래처 목록 전체의 청구 법인별 합계 — list 는 화면에 보이는 거래처들 */
export function creditCorpTotals(list) { const all = []; (list || []).forEach((d) => { ((d && d.entries) || []).forEach((r) => all.push(r)); }); return creditSummary(all); }
/** 보이는 거래 줄을 엑셀용 CSV 로(수식 주입 방어 csvCell 사용). 맨 아래에 구분별 합계와 순액 */
export function creditCsv(rows, title) {
  const q = csvCell; const L = [[title || '외상 장부'], [], ['일자', '구분', '청구 법인', '품목·내용', '금액(원)', '결제 수단', '현장(PJT)', '메모']];
  (rows || []).forEach((r) => L.push([r.date, r.type, r.corp, r.item, cNum(r.amount), r.pay, r.pjt, r.memo]));
  const s = creditSummary(rows); L.push([], ['외상 합계', '', '', '', s.total.외상], ['반품 합계', '', '', '', s.total.반품], ['결제 합계', '', '', '', s.total.결제], ['순액(외상 − 결제 − 반품)', '', '', '', s.total.balance]);
  return '\uFEFF' + L.map((x) => x.map(q).join(',')).join('\r\n');
}
/** 개요 숫자 */
export function homeSummary(data) {
  const act = (k) => ((data && data[k]) || []).filter(GTYPES[k].active);
  const lease = act('lease'), vehicle = act('vehicle'), asset = act('asset'), renewal = act('renewal'), credit = act('credit');
  return { leaseN: lease.length, leaseMonthly: lease.reduce((s, d) => s + leaseMonthlyOf(d) + (Number(d.fee) || 0), 0), vehicleN: vehicle.length, vehicleMonthly: vehicle.reduce((s, d) => s + (Number(d.monthly) || 0), 0), assetN: asset.length, assetCost: asset.reduce((s, d) => s + (Number(d.cost) || 0), 0), creditN: credit.length, creditBalance: credit.reduce((s, d) => s + creditBalance(d), 0), renewalN: renewal.length, renewalYear: renewal.reduce((s, d) => s + (Number(d.amount) || 0) * (CYCLE_YEAR[d.cycle] || 0), 0) };
}
/** 첫 목록(엑셀 월간 손익계산서·지하111호 입금내역 기준) — 확인된 것만 넣는다 */
const pay = (ym, date, memo) => ({ ym, date: date || '', amount: 220000, memo: memo || '' });
export const SEED = {
  lease: [
    { name: '원희캐슬 B111', kind: '창고', place: '원희캐슬 지하 111호', lessor: '이순옥', contact: '', bank: '계좌이체 · 농협 35302139411', deposit: 0, rent: 200000, vat: 20000, fee: 0, payDay: 0, start: '2024-08-19', end: '', status: '사용중', note: '월 220,000원(부가세 포함). 보증금 1,000,000원은 장부 1610 임차보증금(2024-08-19) — 호실 확인 필요',
      payments: [pay('2024-08', '2024-08-21'), pay('2024-09', '2024-09-25'), pay('2024-10', '2024-10-22'), pay('2024-11', '2024-11-29'), pay('2024-12', '2024-12-31'), pay('2025-01', '', '입금일 미기재'), pay('2025-02', '2025-02-28'), pay('2025-03', '2025-03-31'), pay('2025-04', '2025-04-30'), pay('2025-05', '2025-05-30'), { ym: '2025-07', date: '2025-08-11', amount: 440000, memo: '2025-06·07 두 달분' }, pay('2025-08', '2025-09-01'), pay('2025-09', '2025-10-03'), pay('2025-10', '2025-10-31'), pay('2025-11', '2025-12-01'), pay('2025-12', '2025-12-31'), pay('2026-01', '2026-01-31'), pay('2026-02', '2026-03-03'), pay('2026-03', '2026-04-01')] },
    { name: '원희캐슬 B110', kind: '창고', place: '원희캐슬 지하 110호', lessor: '이연주', contact: '', bank: '계좌이체 · 국민 37040201129740', deposit: 0, rent: 200000, vat: 0, fee: 0, payDay: 0, start: '', end: '', status: '사용중', note: '월 200,000원(부가세 없음)', payments: [] }
  ],
  vehicle: [],
  asset: [],
  renewal: [
    { name: '마이크로소프트 365', kind: '구독·라이선스', vendor: '삼정데이타서비스(경유)', amount: 199650, cycle: '월', nextDate: '', lead: 30, pay: '자동이체', payNote: '자동이체 (기업) 5일', owner: '', status: '사용중', note: '월 199,650원', history: [] },
    { name: '노란우산(소기업소상공인 공제)', kind: '보험·공제', vendor: '중소기업중앙회', amount: 0, cycle: '월', nextDate: '', lead: 30, pay: '자동이체', payNote: '자동이체 (신한) 6일', owner: '', status: '사용중', note: '월 납입액을 입력하세요(현재 누적 약 60만원)', history: [] }
  ]
};

/* ───────── 차량 운행일지 취합 — 전자결재 edoc_drive 문서를 시간 순으로 모아 일간·주간·월간·프로젝트별로 본다 ───────── */
export const DRIVE_STATUS = { pending: '결재대기', reviewing: '검토중', approved: '기록', posted: '기록', rejected: '반려', draft: '임시저장' };   // 운행일지는 결재 없이 기록 — 결재대기는 결재 방식이던 때 올린 문서
/** 취합 대상: 기본은 상신된 문서(결재대기·승인) — 임시저장·반려는 뺀다. approvedOnly 면 승인된 것만 */
export function driveRows(docs, opt) {
  const o = opt || {}; return (docs || []).filter((d) => d && d.date && isDate(d.date) && ['pending', 'reviewing', 'approved', 'posted'].includes(d.status) && (!o.approvedOnly || ['approved', 'posted'].includes(d.status)))
    .map((d) => ({ id: d.id, date: d.date, vehicleId: d.vehicleId || '', vehicle: d.vehicleName || '', plate: d.vehiclePlate || '', driver: d.authorName || '', pjtKey: d.pjtId || '', pjt: d.pjtId === 'common' ? '공통(프로젝트 무관)' : [d.pjtCode, d.pjtName].filter(Boolean).join(' · ') || '(프로젝트 없음)', origin: d.origin || '', destination: d.destination || '', kind: d.kind || '', odoStart: Number(d.odoStart) || 0, odoEnd: Number(d.odoEnd) || 0, distance: Number(d.distance) || 0, bizKm: Number(d.bizKm) || 0, purpose: d.purpose || '', note: d.note || '', status: d.status, docNo: d.docNo || d.no || '', createdMs: Number(d.createdMs) || 0 }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.odoStart - b.odoStart || a.createdMs - b.createdMs));
}
/** 그 날이 속한 주의 월요일(YYYY-MM-DD) — 주간은 월요일 시작 */
export function weekStart(date) { const t = new Date(date + 'T00:00:00Z'); const dow = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dow); return t.toISOString().slice(0, 10); }
export function addDays(date, n) { const t = new Date(date + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
/** 기간 거름: mode = all | day | week | month, anchor = 기준 날짜(day·week) 또는 YYYY-MM(month), from = 출고일 등 시작 하한 */
export function driveRange(mode, anchor, from) {
  let a = '0000-00-00', b = '9999-99-99';
  if (mode === 'day') { a = b = anchor; } else if (mode === 'week') { a = weekStart(anchor); b = addDays(a, 6); } else if (mode === 'month') { a = anchor + '-01'; b = anchor + '-31'; }
  if (from && from > a) a = from; return { from: a, to: b };
}
export function driveFilter(rows, f) {
  const r = driveRange(f.mode, f.anchor, f.from); return rows.filter((x) => x.date >= r.from && x.date <= r.to && (!f.vehicleId || x.vehicleId === f.vehicleId) && (!f.driver || x.driver === f.driver) && (!f.pjtKey || x.pjtKey === f.pjtKey));
}
const km = (n) => Math.round(n * 10) / 10;
export function driveTotals(rows) {
  const distance = rows.reduce((s, x) => s + x.distance, 0), biz = rows.reduce((s, x) => s + x.bizKm, 0);
  return { n: rows.length, distance: km(distance), bizKm: km(biz), nonBizKm: km(distance - biz), bizRate: distance > 0 ? Math.round((biz / distance) * 1000) / 10 : 0, days: new Set(rows.map((x) => x.date)).size };
}
/** 프로젝트별 합계(주행거리 많은 순) */
export function driveByProject(rows) {
  const m = new Map(); rows.forEach((x) => { const g = m.get(x.pjtKey) || { key: x.pjtKey, pjt: x.pjt, n: 0, distance: 0, bizKm: 0, last: '' }; g.n++; g.distance += x.distance; g.bizKm += x.bizKm; if (x.date > g.last) g.last = x.date; m.set(x.pjtKey, g); });
  return [...m.values()].map((g) => Object.assign(g, { distance: km(g.distance), bizKm: km(g.bizKm) })).sort((a, b) => b.distance - a.distance || (a.pjt < b.pjt ? -1 : 1));
}
/** 월별 합계(오래된 달부터) — 출고 이후 전체 흐름 */
export function driveByMonth(rows) {
  const m = new Map(); rows.forEach((x) => { const k = x.date.slice(0, 7); const g = m.get(k) || { ym: k, n: 0, distance: 0, bizKm: 0 }; g.n++; g.distance += x.distance; g.bizKm += x.bizKm; m.set(k, g); });
  return [...m.values()].map((g) => Object.assign(g, { distance: km(g.distance), bizKm: km(g.bizKm), bizRate: g.distance > 0 ? Math.round((g.bizKm / g.distance) * 1000) / 10 : 0 })).sort((a, b) => (a.ym < b.ym ? -1 : 1));
}
/** 출고 시점부터의 누적: 출고 시 계기판 → 가장 최근 일지의 주행 후 계기판, 일지 사이 빈 거리(이어지지 않는 구간) 알림 */
export function driveOdoCheck(rows, deliveryOdo) {
  const list = rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.odoStart - b.odoStart)); const gaps = []; let prevEnd = Number(deliveryOdo) > 0 ? Number(deliveryOdo) : null;
  list.forEach((x) => { if (prevEnd !== null && x.odoStart > prevEnd) gaps.push({ date: x.date, from: prevEnd, to: x.odoStart, km: x.odoStart - prevEnd }); else if (prevEnd !== null && x.odoStart < prevEnd) gaps.push({ date: x.date, from: prevEnd, to: x.odoStart, km: x.odoStart - prevEnd, overlap: true }); prevEnd = x.odoEnd; });
  const last = list.length ? list[list.length - 1].odoEnd : null; return { gaps, last, sinceDelivery: Number(deliveryOdo) > 0 && last !== null ? last - Number(deliveryOdo) : null };
}
/** 운행기록부 엑셀(CSV) — 업무용승용차 운행기록부 항목(사용일자·사용자·주행 전/후·주행거리·업무용 거리·출발·도착·목적) */
export function driveCsv(rows, title) {
  const q = csvCell; const L = [[title || '차량 운행기록부'], [], ['사용일자', '차량', '차량번호', '사용자', '프로젝트', '구분', '출발지', '도착지', '주행 전 계기판(km)', '주행 후 계기판(km)', '주행거리(km)', '업무용 사용거리(km)', '운행 목적', '비고', '결재 상태']];
  rows.forEach((x) => L.push([x.date, x.vehicle, x.plate, x.driver, x.pjt, x.kind, x.origin, x.destination, x.odoStart, x.odoEnd, x.distance, x.bizKm, x.purpose, x.note, DRIVE_STATUS[x.status] || x.status]));
  const t = driveTotals(rows); L.push([], ['합계', '', '', '', '', '', '', '', '', '', t.distance, t.bizKm, '업무사용비율 ' + t.bizRate + '%']);
  return '\uFEFF' + L.map((x) => x.map(q).join(',')).join('\r\n');
}

/* ───────── 과거 운행일지(종이·엑셀) 이식 — 보정을 마친 JSON 파일을 미리보기 후 general_vehicles / general_drive_history(월 단위 문서)에 넣는다 ───────── */
export const DRIVE_KINDS = ['일반 업무용', '출퇴근용', '비업무용'];
export function parseDriveHistory(text) {
  let b; try { b = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON 파일이 아닙니다.'], bundle: null, summary: null }; }
  if (!b || b.kind !== 'jh-vehicle-drive-history' || b.version !== 1) return { ok: false, errors: ['운행일지 과거 기록 파일이 아닙니다(kind·version 확인).'], bundle: null, summary: null };
  const errors = []; const vk = new Set();
  (b.vehicles || []).forEach((v, i) => { if (!v || !v.key || !v.name || vk.has(v.key)) { errors.push('차량 ' + (i + 1) + '번의 key·이름이 올바르지 않거나 겹칩니다.'); return; } vk.add(v.key); const r = formToDoc('vehicle', v, []); if (r.errors.length) errors.push('차량 "' + v.name + '": ' + r.errors[0]); });
  let rows = 0; const per = {}; let from = '9999-99-99', to = '0000-00-00'; const yms = new Set();
  (b.months || []).forEach((m) => {
    if (!m || !isYm(m.ym) || !Array.isArray(m.rows)) { errors.push('월 "' + (m && m.ym) + '"의 형식이 올바르지 않습니다.'); return; }
    if (yms.has(m.ym)) errors.push('월 ' + m.ym + '이 두 번 들어 있습니다.'); yms.add(m.ym);
    m.rows.forEach((r, i) => {
      rows++; const tag = m.ym + ' ' + (i + 1) + '번째 줄: ';
      if (!r || !vk.has(r.v)) { errors.push(tag + '차량 key가 없습니다.'); return; }
      if (!isDate(r.date) || r.date.slice(0, 7) !== m.ym) errors.push(tag + '날짜가 올바르지 않거나 월과 다릅니다.');
      if (!Number.isInteger(r.odoStart) || !Number.isInteger(r.odoEnd) || r.odoStart < 0 || r.odoEnd < r.odoStart) errors.push(tag + '계기판 값이 올바르지 않습니다.');
      if (!Number.isInteger(r.distance) || r.distance < 0 || r.distance !== r.odoEnd - r.odoStart) errors.push(tag + '주행거리가 계기판 차이와 다릅니다.');
      if (!DRIVE_KINDS.includes(r.kind)) errors.push(tag + '구분 값이 올바르지 않습니다.');
      if (isDate(r.date)) { if (r.date < from) from = r.date; if (r.date > to) to = r.date; } per[r.v] = (per[r.v] || { n: 0, km: 0, biz: 0 }); per[r.v].n++; per[r.v].km += Number(r.distance) || 0; per[r.v].biz += r.kind === '비업무용' ? 0 : Number(r.distance) || 0;
    });
  });
  const summary = { vehicles: (b.vehicles || []).map((v) => ({ key: v.key, name: v.name, n: (per[v.key] || {}).n || 0, km: (per[v.key] || {}).km || 0, biz: (per[v.key] || {}).biz || 0, delivery: v.delivery || '', deliveryOdo: v.deliveryOdo || 0 })), rows, months: yms.size, from: rows ? from : '', to: rows ? to : '', report: b.report || null };
  return { ok: errors.length === 0 && rows > 0, errors: rows === 0 ? errors.concat(['가져올 운행 줄이 없습니다.']).slice(0, 10) : errors.slice(0, 10), bundle: b, summary };
}
/** 이식한 월 문서 → 취합 화면용 줄(전자결재 일지와 같은 모양, 승인된 기록으로 취급) */
export function historyRows(hist, vehById) {
  const out = []; (hist || []).forEach((m) => (m.rows || []).forEach((r, i) => { const v = (vehById && vehById[r.vehicleId]) || {};
    out.push({ id: 'h_' + (m.ym || m.id) + '_' + i, date: r.date, time: r.time || '', vehicleId: r.vehicleId || '', vehicle: v.name || '', plate: v.plate || '', driver: r.who || '', pjtKey: r.pjtId || '', pjt: r.pjtId === 'common' ? '공통(프로젝트 무관)' : r.pjtId ? ([r.pjtCode, r.pjtName].filter(Boolean).join(' · ') || '(프로젝트)') : '(프로젝트 없음)', origin: r.origin || '', destination: r.destination || '', kind: r.kind || '', odoStart: Number(r.odoStart) || 0, odoEnd: Number(r.odoEnd) || 0, distance: Number(r.distance) || 0, bizKm: r.kind === '비업무용' ? 0 : Number(r.distance) || 0, purpose: r.purpose || '', note: [r.note, Number(r.amount) ? '금액 ' + won(r.amount) + '원' : '', (r.flags || []).join(' / ')].filter(Boolean).join(' · '), status: 'approved', source: 'legacy', docNo: '', createdMs: 0 });
  }));
  return out;
}
/** 전자결재 일지 + 이식한 과거 기록을 하나로, 날짜·계기판 순으로 */
export function driveAllRows(docs, hist, vehById, opt) {
  const a = driveRows(docs, opt).map((x) => Object.assign({ source: 'edoc', time: '' }, x)); const h = historyRows(hist, vehById);
  return a.concat(h).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.odoStart - y.odoStart || (x.time < y.time ? -1 : x.time > y.time ? 1 : 0)));
}

/* ───────── 이식한 과거 기록에 프로젝트 일괄 지정 — 내용에 들어 있는 말(예: #5, 2게이트)로 줄을 찾아 프로젝트를 정한다 ───────── */
const rowText = (r) => [r.purpose, r.origin, r.destination, r.note].filter(Boolean).join(' ').replace(/\s+/g, '').toLowerCase();
const SKIP_WORDS = new Set(['출근', '퇴근', '개인', '주유', '세차', '출퇴근', '개인사용', '요소수', '인계', '사무실', '기숙사', '숙소']);
/** 아직 프로젝트가 없는 이식 줄의 내용에서 자주 나오는 말(많은 순) — 지정할 키워드를 고르는 데 쓴다 */
export function driveKeywordStats(hist, limit) {
  const m = new Map(); (hist || []).forEach((mo) => (mo.rows || []).forEach((r) => { if (r.pjtId) return; const seen = new Set(String([r.purpose, r.origin, r.destination].filter(Boolean).join(' ')).match(/[#A-Za-z0-9가-힣]+/g) || []); seen.forEach((w) => { if (w.length < 2 && w[0] !== '#') return; if (SKIP_WORDS.has(w)) return; const g = m.get(w) || { word: w, n: 0, km: 0 }; g.n++; g.km += Number(r.distance) || 0; m.set(w, g); }); }));
  return [...m.values()].sort((a, b) => b.n - a.n || b.km - a.km).slice(0, limit || 24);
}
/** 규칙에 맞는 줄을 찾는다(저장하지 않음). rule = { kw, from, to, over(이미 지정된 줄도 바꿈) } */
export function matchHistory(hist, rule) {
  const kw = String((rule && rule.kw) || '').replace(/\s+/g, '').toLowerCase(); if (!kw) return { n: 0, km: 0, months: 0, hits: [] };
  const hits = []; (hist || []).forEach((mo) => (mo.rows || []).forEach((r, i) => { if (!rule.over && r.pjtId) return; if (rule.from && r.date < rule.from) return; if (rule.to && r.date > rule.to) return; if (!rowText(r).includes(kw)) return; hits.push({ ym: mo.ym || mo.id, i, km: Number(r.distance) || 0 }); }));
  return { n: hits.length, km: hits.reduce((s, h) => s + h.km, 0), months: new Set(hits.map((h) => h.ym)).size, hits };
}
/** 일괄 지정 결과: 바뀐 월 문서(rows 전체)만 돌려준다. project = { id, code, name } — id 'common' 은 프로젝트 무관 */
export function assignProject(hist, rule, project) {
  const mt = matchHistory(hist, rule); if (!mt.n || !project || !project.id) return { n: 0, km: 0, changed: [] };
  const by = new Map(); mt.hits.forEach((h) => { (by.get(h.ym) || by.set(h.ym, new Set()).get(h.ym)).add(h.i); });
  const changed = []; (hist || []).forEach((mo) => { const set = by.get(mo.ym || mo.id); if (!set) return; changed.push({ ym: mo.ym || mo.id, rows: (mo.rows || []).map((r, i) => (set.has(i) ? Object.assign({}, r, { pjtId: project.id, pjtCode: project.id === 'common' ? '공통' : project.code || '', pjtName: project.id === 'common' ? '프로젝트 무관' : project.name || '' }) : r)) }); });
  return { n: mt.n, km: mt.km, changed };
}
