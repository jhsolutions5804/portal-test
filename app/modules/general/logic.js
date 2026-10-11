/* 총무 — 임대·차량·자산·갱신 일정. 화면·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 네 종류(lease·vehicle·asset·renewal)는 항목 정의(GTYPES) 하나로 목록·입력·검증·만기 알림이 모두 같은 방식으로 돌아간다. */
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
    cols: [['이름', (d) => d.name], ['종류', (d) => d.kind], ['월 납부액(부가세 포함)', (d) => (leaseMonthlyOf(d) ? won(leaseMonthlyOf(d)) + '원' : ''), 'num'], ['납부일', (d) => (d.payDay ? d.payDay + '일' : '')], ['계약 만료', (d) => d.end || ''], ['입금 상태', (d, today) => (leasePayState(d, today) || {}).text || '']],
    dues: (d) => [{ what: '계약 만료', date: d.end, lead: 60 }]
  },
  vehicle: {
    key: 'vehicle', title: '차량', icon: '🚙', coll: 'general_vehicles', add: '차량 추가', activeFilter: '운행',
    label: (d) => d.name || '(이름 없음)', active: (d) => d.status !== '반납·매각',
    fields: [
      { k: 'name', l: '차량명(모델)', t: 'text', req: true, ph: '예) GMC 시에라' }, { k: 'plate', l: '차량번호', t: 'text' }, { k: 'kind', l: '구분', t: 'select', o: ['렌트', '할부', '리스', '소유'], d: '렌트' }, { k: 'company', l: '금융사·렌트사', t: 'text', ph: '예) 현대캐피탈' },
      { k: 'ref', l: '계약·계좌 번호(끝자리)', t: 'text' }, { k: 'monthly', l: '월 납부액(원)', t: 'money' }, { k: 'payDay', l: '납부일(1~31)', t: 'int', min: 1, max: 31 }, { k: 'start', l: '계약 시작일', t: 'date' }, { k: 'end', l: '계약 만료일', t: 'date' },
      { k: 'deposit', l: '보증금·선수금(원)', t: 'money' }, { k: 'driver', l: '사용자(운전자)', t: 'text' }, { k: 'odo', l: '현재 주행거리(km)', t: 'int', min: 0 },
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
/** 개요 숫자 */
export function homeSummary(data) {
  const act = (k) => ((data && data[k]) || []).filter(GTYPES[k].active);
  const lease = act('lease'), vehicle = act('vehicle'), asset = act('asset'), renewal = act('renewal');
  return { leaseN: lease.length, leaseMonthly: lease.reduce((s, d) => s + leaseMonthlyOf(d) + (Number(d.fee) || 0), 0), vehicleN: vehicle.length, vehicleMonthly: vehicle.reduce((s, d) => s + (Number(d.monthly) || 0), 0), assetN: asset.length, assetCost: asset.reduce((s, d) => s + (Number(d.cost) || 0), 0), renewalN: renewal.length, renewalYear: renewal.reduce((s, d) => s + (Number(d.amount) || 0) * (CYCLE_YEAR[d.cycle] || 0), 0) };
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
