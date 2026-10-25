/* 인사 홈 — 구포털(hr) 홈의 요약 카드 4개·알림·카드별 목록·서명/도장 관리 규칙을 옮겼다(순수 함수).
 * 요약: 재직 인원 / 계약 갱신 필요(연봉계약서 종료일이 30일 이내거나 지난 사람) / 이번 달 급여명세서 작성 / 이번 달 초과근로수당. 알림: 연봉계약서가 없는 재직자.
 * 구포털과 달라진 점: 퇴직자는 재직 인원·계약·급여명세서 집계에서 뺀다(구포털은 명부 전체를 세어 퇴직자가 "연봉계약서 없음"·"급여명세서 미작성"으로 잡혔다). */
export const HOME_EXEMPT = ['송지훈', '김종화', '김영희', '김민서', 'test'];   // 근로계약서·연봉계약서 작성 대상에서 열외(대표·테스트 계정 등) — 구포털 그대로
export const SEAL_KEYS = [{ key: 'kjh', label: '김종화 대표' }];
const pad = (n) => String(n).padStart(2, '0');
export function addDaysStr(s, n) { const [y, m, d] = String(s).split('-').map(Number); const t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
const r2 = (x) => Math.round(x * 100) / 100;
/** 요약 계산. input: { workers, contracts:{워크id:{cnt, latestEnd}}, paySet:Set(이번 달 급여명세서가 있는 근로자 id), overtime:[이번 달 초과근로 문서], today, ym } */
export function homeStats(inp) {
  const x = inp || {}; const today = x.today; const ym = x.ym || String(today || '').slice(0, 7); const d30 = addDaysStr(today, 30); const paySet = x.paySet || new Set();
  const active = (x.workers || []).filter((w) => w.status !== 'resigned').slice().sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || '')));
  const renew = [], noAnnual = [], payMissing = []; let payDone = 0;
  active.forEach((w) => {
    const exempt = HOME_EXEMPT.includes(String(w.name || '').trim()); const c = (x.contracts || {})[w.id] || { cnt: 0, latestEnd: '' };
    if (!exempt) { if (!c.cnt) noAnnual.push(w); if (c.latestEnd && c.latestEnd <= d30) renew.push(Object.assign({}, w, { aLatest: c.latestEnd })); }
    if (paySet.has(w.id)) payDone++; else payMissing.push(w);
  });
  const ot = (x.overtime || []).filter((o) => (o.yearMonth || '') === ym); const otHours = r2(ot.reduce((s, o) => s + (Number(o.hours) || 0), 0)); const otAmt = ot.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  return { headcount: active.length, roster: active, renew: Array.isArray(x.renewItems) ? x.renewItems : renew, noAnnual, payDone, payMissing, overtime: ot, otHours, otAmt, otMan: Math.round(otAmt / 10000), ym };
}
export const HOME_LISTS = { roster: { title: '👥 재직 인원', empty: '재직자가 없습니다', go: 'workers' }, renew: { title: '📝 계약 만료 예정 (2개월 이내)', empty: '만료가 가까운 계약이 없습니다', go: 'annualc' }, paymissing: { title: '💰 급여명세서 미작성', empty: '모두 작성되었습니다', go: 'payslips' }, overtime: { title: '⏱️ 이번 달 초과근로', empty: '초과근로 기록이 없습니다', go: 'attendcal?view=ot' } };
/** 카드를 눌렀을 때 목록 행 */
export function homeListRows(kind, s) {
  const won = (v) => '₩' + Math.round(v || 0).toLocaleString('ko-KR');
  if (kind === 'roster') return s.roster.map((w) => ({ tone: 'primary', badge: w.rank || '직원', title: w.name || '(이름없음)', meta: (w.dept || '') + (w.job ? ' · ' + w.job : ''), right: w.empNo ? '사번 ' + w.empNo : '' }));
  if (kind === 'renew') return s.renew.map((w) => (w.stage ? { tone: w.tone, badge: w.badge, title: w.name || '', meta: (w.dept || '') + (w.rank ? ' · ' + w.rank : '') + ' · ' + w.kindLabel, right: '~' + w.endDate + ' (' + w.dayText + ')', actions: w.options || [] } : { tone: 'warn', badge: '갱신', title: w.name || '', meta: (w.dept || '') + (w.rank ? ' · ' + w.rank : ''), right: '~' + (w.aLatest || '') }));
  if (kind === 'paymissing') return s.payMissing.map((w) => ({ tone: 'danger', badge: '미작성', title: w.name || '', meta: (w.dept || '') + (w.rank ? ' · ' + w.rank : ''), right: s.ym }));
  if (kind === 'overtime') return s.overtime.map((o) => ({ tone: 'accent', badge: (o.hours || 0) + 'h', title: o.name || '', meta: (o.date || '') + (o.yearMonth ? ' · ' + o.yearMonth : ''), right: won(o.amount) }));
  return [];
}
/* ───────── 서명/도장(대표 직인) 이미지 ───────── */
export const SEAL_MAX_BYTES = 300 * 1024;   // 문서에 data URL 로 넣으므로 작게(서명 링크 문서 크기 한도와 함께 쓴다)
/** 화면에 맞춰 줄일 크기: 긴 변이 max 를 넘으면 비율을 유지해 줄인다(작으면 그대로) */
export function fitSize(w, h, max) { const W = Number(w) || 0, H = Number(h) || 0; if (!(W > 0 && H > 0)) return { w: 0, h: 0 }; const m = Math.max(W, H); if (m <= max) return { w: W, h: H }; const k = max / m; return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) }; }
/** 저장 전 검사: 이미지(png·jpeg·webp) data URL 이고 용량이 한도 이내 */
export function validateSeal(dataUrl) { const s = String(dataUrl || ''); if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(s)) return { ok: false, error: '이미지(PNG·JPG·WEBP) 파일만 등록할 수 있습니다.' }; const bytes = Math.floor((s.length - s.indexOf(',') - 1) * 3 / 4); if (bytes > SEAL_MAX_BYTES) return { ok: false, error: '이미지가 너무 큽니다(' + Math.round(bytes / 1024) + 'KB). 300KB 이하로 줄여 주세요.' }; return { ok: true, bytes }; }
