/* 차량 비용(주유·정비·수리·기타) 순수 로직 — 화면·Firestore 와 분리해 시험한다.
 * 저장: 차량 운행일지 문서(edoc_drive)의 rec 필드로 구분한다. rec 가 없거나 'trip' 이면 기존 운행 기록, 'fuel' 주유, 'repair' 정비·수리·기타 비용.
 *   → 서버·보안 규칙은 바꾸지 않는다(운행일지는 필드 제한 없이 확정되는 기록 문서).
 *   → 운행기록부(주행거리·업무사용비율)는 세무 자료라 주유·정비 기록이 섞이면 안 된다. 운행 집계는 isTrip() 만 쓴다.
 * 연비: 가득 주유 기록끼리 비교한다 — (이번 가득 주유 누적주행거리 − 직전 가득 주유 누적주행거리) ÷ (그 사이 넣은 연료 합계: 사이의 부분 주유 + 이번 주유량). */
import { csvCell } from './csv.js?v=20261109s';

const won = (n) => Number(n || 0).toLocaleString('ko-KR');
const n0 = (x) => { const v = Number(String(x == null ? '' : x).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? 0 : v; };
const has = (x) => x !== '' && x != null && String(x).trim() !== '';
const txt = (x) => String(x == null ? '' : x).trim();
const r2 = (x) => Math.round(x * 100) / 100;

/* ───────── 기록 종류 ───────── */
export const REC_KEYS = ['trip', 'fuel', 'repair'];
export const REC_LABEL = { trip: '운행', fuel: '주유', repair: '정비·수리·비용' };
export const recKey = (x) => (x === 'fuel' || x === 'repair' ? x : 'trip');
export const isTrip = (d) => !d || recKey(d.rec) === 'trip';
export const isCar = (d) => !!d && !isTrip(d);

export const FUEL_TYPES = ['휘발유', '고급 휘발유', '경유', 'LPG', '전기(충전)', '기타'];
export const FULL_OPTS = ['가득 주유', '부분 주유'];
export const SHOP_KINDS = ['정비소', '자가정비'];
export const EV_TYPE = '전기(충전)'; // 단위가 L 이 아니라 kWh 라 단가·연비 이상 점검에서 뺀다

/* 항목 목록 — [이름, 교체 주기 안내]. 정비·수리 항목과 기타 비용 항목(스마트폰 차계부 앱 구성을 참고) */
export const SERVICE_ITEMS = [
  ['엔진오일 및 오일필터', '12개월 · 15,000km 마다'], ['에어컨필터(항균필터)', '6개월 · 5,000km 마다'], ['와이퍼 블레이드', '12개월 · 8,000km 마다'],
  ['구동벨트', '36개월 · 60,000km 마다'], ['미션 오일', '50,000km 마다'], ['배터리', '36개월 · 60,000km 마다'], ['보증수리', ''],
  ['브레이크 디스크/드럼 (뒤)', '84개월 · 100,000km 마다'], ['브레이크 디스크/드럼 (앞)', '84개월 · 100,000km 마다'], ['브레이크 오일', '24개월 · 45,000km 마다'],
  ['브레이크 패드/라이닝 (뒤)', '48개월 · 60,000km 마다'], ['브레이크 패드/라이닝 (앞)', '36개월 · 40,000km 마다'], ['사고수리', ''], ['스태빌라이저', '60개월 마다'],
  ['에어클리너 필터', '24개월 · 40,000km 마다'], ['엔진/모터마운트', '72개월 마다'], ['엔진부동액(냉각수)', '24개월 · 40,000km 마다'], ['연료필터', '60,000km 마다'],
  ['외장수리복원', ''], ['일반수리', ''], ['점화플러그', '100,000km 마다'], ['타이밍 벨트', '80,000km 마다'], ['타이어', '36개월 · 60,000km 마다'],
  ['타이어 위치', '10,000km 마다'], ['타이어펑크수리', ''], ['파워스티어링 오일', '36개월 · 80,000km 마다'], ['하부 부식', '84개월 마다'], ['휠 얼라인먼트', '50,000km 마다']
];
export const OTHER_ITEMS = [
  ['하이패스', ''], ['톨게이트 비용', ''], ['주차요금', ''], ['세차', ''], ['연료첨가제(불스원샷)', ''], ['자동차검사', ''], ['차량용품', ''], ['실외용품', ''],
  ['실내용품', ''], ['자동차 보험', '12개월 마다'], ['블랙박스', ''], ['교통범칙금', ''], ['자동차세', ''], ['썬팅(틴팅)', ''], ['판금도색', ''], ['네비게이션', ''],
  ['후방카메라', ''], ['카오디오', '']
];
/** 입력 칸의 자동 완성 목록 */
export const CAR_ITEM_OPTIONS = SERVICE_ITEMS.map(([name, cycle]) => ({ name, hint: '정비' + (cycle ? ' · ' + cycle : '') })).concat(OTHER_ITEMS.map(([name, cycle]) => ({ name, hint: '기타 비용' + (cycle ? ' · ' + cycle : '') })));
export const itemGroup = (name) => { const s = txt(name); return SERVICE_ITEMS.some((x) => x[0] === s) ? '정비' : OTHER_ITEMS.some((x) => x[0] === s) ? '기타' : s ? '직접 입력' : ''; };
export const emptyCarItem = () => ({ name: '', amount: '', memo: '' });

/* ───────── 입력 검증(작성 화면) ───────── */
export const UNIT_MIN = 500, UNIT_MAX = 5000, LITER_MAX = 300; // 리터당 단가가 이 범위를 벗어나면 입력 실수로 보고 막는다(전기 제외)
/** 주유·정비 입력 검사 — err 에 항목키: 문구를 채운다. draft 면 비어 있는 필수 칸은 봐준다. */
export function carChecks(v, err, today, draft) {
  const rec = recKey(v.rec); if (rec === 'trip') return err;
  if (v.date && !err.date && today && v.date > today) err.date = '기록 일자가 오늘보다 뒤입니다. 지난 기록만 적어 주세요.';
  if (has(v.odo) && !err.odo && !(n0(v.odo) > 0)) err.odo = '누적주행거리가 올바르지 않습니다.';
  if (rec === 'fuel') {
    const amount = n0(v.amount), liters = n0(v.liters), ev = v.fuelType === EV_TYPE;
    if (has(v.liters) && !err.liters && !ev && liters > LITER_MAX) err.liters = '주유량이 ' + LITER_MAX + 'L를 넘습니다. 확인해 주세요.';
    if (amount > 0 && liters > 0 && !err.amount && !err.liters && !ev) {
      const u = amount / liters;
      if (u < UNIT_MIN || u > UNIT_MAX) err.amount = '리터당 단가가 ' + won(Math.round(u)) + '원으로 계산됩니다. 금액과 주유량을 확인해 주세요(보통 ' + won(1000) + '~' + won(3000) + '원).';
    }
    if (has(v.washFee) && !err.washFee && n0(v.washFee) < 0) err.washFee = '세차비가 올바르지 않습니다.';
  } else {
    const rows = (v.items || []).filter((r) => r && (has(r.name) || has(r.amount) || has(r.memo)));
    if (!draft && !rows.length) err.items = '정비·수리·비용 항목을 한 줄 이상 입력해 주세요.';
    rows.forEach((r, i) => {
      if (!draft && !has(r.name)) err['items.' + i + '.name'] = '항목을 입력해 주세요.';
      if (has(r.amount) && n0(r.amount) < 0) err['items.' + i + '.amount'] = '금액이 올바르지 않습니다.';
      else if (!draft && !(n0(r.amount) > 0)) err['items.' + i + '.amount'] = '금액을 입력해 주세요.';
    });
  }
  return err;
}

/** 작성 화면의 자동 계산 문구(입력할 때마다 갱신) */
export function carCalcText(key, v) {
  const val = v || {};
  if (key === 'fuelSum') {
    const amount = n0(val.amount), liters = n0(val.liters), wash = n0(val.washFee);
    const unit = amount > 0 && liters > 0 ? '리터당 ' + won(Math.round(amount / liters)) + '원' : '금액·주유량을 넣으면 자동 계산';
    return unit + (amount > 0 ? '\n합계 ' + won(amount + wash) + '원' : ''); // 4칸 한 줄 안에서 두 줄(리터당 단가 / 합계)로 나뉘어 보이게 — 화면은 줄바꿈을 살려 그린다(white-space: pre-line)
  }
  if (key === 'repairSum') {
    const rows = (val.items || []).filter((r) => r && (has(r.name) || has(r.amount)));
    const total = rows.reduce((s, r) => s + n0(r.amount), 0);
    return rows.length ? '합계 ' + won(total) + '원 (' + rows.length + '개 항목)' : '항목을 추가하면 합계가 계산됩니다';
  }
  return '';
}

/* ───────── 저장 문서 필드 ───────── */
export function fuelFields(v) {
  const amount = n0(v.amount), liters = n0(v.liters), wash = n0(v.washFee);
  return { rec: 'fuel', station: txt(v.station), fuelType: txt(v.fuelType) || FUEL_TYPES[0], odo: n0(v.odo), amount, liters: r2(liters), unitPrice: liters > 0 ? Math.round(amount / liters) : 0, full: v.full !== '부분 주유', washFee: wash, cost: amount + wash, note: txt(v.note) };
}
export function repairFields(v) {
  const items = (v.items || []).filter((r) => r && (has(r.name) || has(r.amount) || has(r.memo))).map((r) => ({ name: txt(r.name), amount: n0(r.amount), memo: txt(r.memo) }));
  return { rec: 'repair', shopKind: txt(v.shopKind) || SHOP_KINDS[0], place: txt(v.place), odo: has(v.odo) ? n0(v.odo) : null, items, cost: items.reduce((s, r) => s + r.amount, 0), note: txt(v.note) };
}
export const carFields = (v) => (recKey(v.rec) === 'fuel' ? fuelFields(v) : recKey(v.rec) === 'repair' ? repairFields(v) : null);

/** 문서 상세·목록 요약용 한 줄 */
export function carSummary(d) {
  if (!d) return '';
  if (d.rec === 'fuel') return ['주유', d.liters ? r2(Number(d.liters)) + 'L' : '', won(d.cost != null ? d.cost : d.amount) + '원', d.station].filter(Boolean).join(' · ');
  if (d.rec === 'repair') return ['정비·비용', (d.items || []).map((r) => r.name).filter(Boolean).slice(0, 3).join(', '), won(d.cost) + '원'].filter(Boolean).join(' · ');
  return '';
}

/* ───────── 총무 집계 ───────── */
const OK_STATUS = ['pending', 'reviewing', 'approved', 'posted'];
/** edoc_drive 문서 → 주유 줄 */
export function fuelRows(docs, vById) {
  const V = vById || {};
  return (docs || []).filter((d) => d && d.rec === 'fuel' && d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && OK_STATUS.includes(d.status)).map((d) => {
    const amount = n0(d.amount), liters = n0(d.liters), wash = n0(d.washFee);
    return { id: d.id, rec: 'fuel', date: d.date, vehicleId: d.vehicleId || '', vehicle: d.vehicleName || (V[d.vehicleId] && V[d.vehicleId].name) || '', plate: d.vehiclePlate || '', driver: d.authorName || '', station: d.station || '', fuelType: d.fuelType || '', odo: n0(d.odo), amount, liters, unitPrice: liters > 0 ? Math.round(amount / liters) : 0, full: d.full !== false, washFee: wash, cost: amount + wash, note: d.note || '', status: d.status, createdMs: d.createdMs || 0 };
  });
}
export function repairRows(docs, vById) {
  const V = vById || {};
  return (docs || []).filter((d) => d && d.rec === 'repair' && d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && OK_STATUS.includes(d.status)).map((d) => {
    const items = (Array.isArray(d.items) ? d.items : []).map((r) => ({ name: r.name || '', amount: n0(r.amount), memo: r.memo || '' }));
    return { id: d.id, rec: 'repair', date: d.date, vehicleId: d.vehicleId || '', vehicle: d.vehicleName || (V[d.vehicleId] && V[d.vehicleId].name) || '', plate: d.vehiclePlate || '', driver: d.authorName || '', shopKind: d.shopKind || '', place: d.place || '', odo: d.odo == null ? null : n0(d.odo), items, cost: items.reduce((s, r) => s + r.amount, 0), note: d.note || '', status: d.status, createdMs: d.createdMs || 0 };
  });
}

/** 주유 줄에 연비(구간 km, 구간 연료, km/L)와 점검 표시를 붙인다. 차량별로 날짜순으로 계산한다. */
export function withEconomy(rows) {
  const out = rows.map((r) => Object.assign({}, r, { segKm: null, segLiters: null, economy: null, flags: [] }));
  const byV = new Map(); out.forEach((r) => { const k = r.vehicleId || r.vehicle; if (!byV.has(k)) byV.set(k, []); byV.get(k).push(r); });
  byV.forEach((list) => {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdMs - b.createdMs) || (a.odo - b.odo)));
    let prevOdo = null, base = null, pending = 0;
    list.forEach((r) => {
      const ev = r.fuelType === EV_TYPE;
      if (!ev && r.unitPrice > 0 && (r.unitPrice < 1000 || r.unitPrice > 3000)) r.flags.push('priceOut');
      if (prevOdo !== null && r.odo < prevOdo) { r.flags.push('odoBack'); base = null; pending = 0; } // 계기판이 거꾸로 — 이어서 계산하지 않고 여기서 다시 시작
      prevOdo = r.odo;
      if (base !== null) pending += r.liters;
      if (r.full) {
        if (base !== null && r.odo > base && pending > 0) {
          r.segKm = r.odo - base; r.segLiters = r2(pending); r.economy = r2(r.segKm / pending);
          if (!ev && (r.economy < 3 || r.economy > 30)) r.flags.push('econOut');
        }
        base = r.odo; pending = 0;
      }
    });
  });
  return out;
}
/** 연비를 계산한 구간의 평균(구간 거리 합 ÷ 구간 연료 합) */
export function avgEconomy(rows) {
  const k = rows.filter((r) => r.economy != null && r.fuelType !== EV_TYPE); const km = k.reduce((s, r) => s + r.segKm, 0), l = k.reduce((s, r) => s + r.segLiters, 0);
  return l > 0 ? { km: Math.round(km), liters: r2(l), kmPerL: r2(km / l), n: k.length } : null;
}

/** 주유 + 정비 줄을 날짜순(최근이 위)으로 합친 비용 줄 */
export function costRows(docs, vById) {
  const fuel = withEconomy(fuelRows(docs, vById)); const rep = repairRows(docs, vById);
  return fuel.concat(rep).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdMs - a.createdMs)));
}
const ymOf = (d) => String(d).slice(0, 7);
/** 기간·차량·종류 거름. mode: month(ym) | year(year) | all */
export function costFilter(rows, o) {
  const f = o || {};
  return rows.filter((r) => (f.mode === 'month' ? ymOf(r.date) === f.ym : f.mode === 'year' ? r.date.slice(0, 4) === String(f.year) : true) && (!f.vehicleId || r.vehicleId === f.vehicleId) && (!f.rec || r.rec === f.rec));
}
export function costTotals(rows) {
  const fuel = rows.filter((r) => r.rec === 'fuel'); const rep = rows.filter((r) => r.rec === 'repair');
  const fuelAmt = fuel.reduce((s, r) => s + r.amount, 0), wash = fuel.reduce((s, r) => s + r.washFee, 0), repAmt = rep.reduce((s, r) => s + r.cost, 0);
  const liters = fuel.reduce((s, r) => s + r.liters, 0);
  return { n: rows.length, total: fuelAmt + wash + repAmt, fuel: fuelAmt, wash, repair: repAmt, liters: r2(liters), fuelN: fuel.length, repairN: rep.length, avgUnit: liters > 0 ? Math.round(fuelAmt / liters) : 0 };
}
export function costByMonth(rows) {
  const m = new Map(); rows.forEach((r) => { const k = ymOf(r.date); const g = m.get(k) || { ym: k, n: 0, fuel: 0, repair: 0, wash: 0, total: 0 }; g.n++; if (r.rec === 'fuel') { g.fuel += r.amount; g.wash += r.washFee; g.total += r.cost; } else { g.repair += r.cost; g.total += r.cost; } m.set(k, g); });
  return [...m.values()].sort((a, b) => (a.ym < b.ym ? 1 : -1));
}
export function costByVehicle(rows) {
  const m = new Map(); rows.forEach((r) => { const k = r.vehicleId || r.vehicle; const g = m.get(k) || { key: k, vehicle: r.vehicle || '(차량 없음)', n: 0, fuel: 0, repair: 0, total: 0 }; g.n++; if (r.rec === 'fuel') { g.fuel += r.amount; g.total += r.cost; } else { g.repair += r.cost; g.total += r.cost; } m.set(k, g); });
  return [...m.values()].sort((a, b) => b.total - a.total);
}
/** 비용 기록의 연도 목록(최근이 앞) */
export const costYears = (rows) => [...new Set(rows.map((r) => r.date.slice(0, 4)))].sort().reverse();

const FLAG_TEXT = { priceOut: '단가 확인', odoBack: '계기판이 이전보다 작음', econOut: '연비 이상' };
export const flagText = (f) => FLAG_TEXT[f] || f;
/** 엑셀용 CSV(수식 주입 방어 csvCell) — 맨 아래에 합계 */
export function carCostCsv(rows, title) {
  const q = csvCell; const L = [[title || '차량 비용'], [], ['일자', '차량', '차량번호', '작성자', '종류', '장소', '유종·정비구분', '누적주행거리(km)', '주유량(L)', '리터당 단가(원)', '가득/부분', '구간거리(km)', '연비(km/L)', '항목', '금액(원)', '세차비(원)', '합계(원)', '메모', '점검']];
  rows.forEach((r) => {
    if (r.rec === 'fuel') L.push([r.date, r.vehicle, r.plate, r.driver, '주유', r.station, r.fuelType, r.odo, r.liters, r.unitPrice, r.full ? '가득' : '부분', r.segKm == null ? '' : r.segKm, r.economy == null ? '' : r.economy, '', r.amount, r.washFee, r.cost, r.note, (r.flags || []).map(flagText).join(' / ')]);
    else L.push([r.date, r.vehicle, r.plate, r.driver, '정비·비용', r.place, r.shopKind, r.odo == null ? '' : r.odo, '', '', '', '', '', r.items.map((x) => x.name + (x.memo ? '(' + x.memo + ')' : '') + ' ' + won(x.amount) + '원').join('; '), r.cost, '', r.cost, r.note, '']);
  });
  const t = costTotals(rows); L.push([], ['합계', '', '', '', '', '', '', '', t.liters, t.avgUnit, '', '', '', '', t.fuel + t.repair, t.wash, t.total, '주유 ' + won(t.fuel) + '원 · 정비·비용 ' + won(t.repair) + '원 · 세차비 ' + won(t.wash) + '원', '']);
  return '\uFEFF' + L.map((x) => x.map(q).join(',')).join('\r\n');
}
