/* NFC 출퇴근(대기열 1-3-26) — 화면용 순수 계산. 네트워크·화면 없음(시험하기 쉽게 분리).
 * 설계서: Claude Doc "NFC 출퇴근 기록 설계서". 서버(attendNfcAct)가 모든 판정을 하고, 여기서는 서버 응답을 직원 폰 화면 문구로 바꾸고 입력값을 검사한다.
 * 이 기능은 NFC_ENABLED 가 켜지기 전에는 화면에 나타나지 않는다(테섭 주소에서만 켜지고 본섭 주소에서는 꺼져 있다 — 본섭 반영은 대표님 지시 뒤). */
/** NFC 기능을 켤 주소 — 지금은 테섭(주소에 /portal-test/)에서만 켠다. 본섭에서 켜는 것은 대표님 지시 뒤 이 한 줄만 바꾼다(본섭 전환 코드에 실려 가도 본섭 주소에서는 꺼져 있다) */
export const nfcEnabledFor = (pathname) => /\/portal-test(\/|$)/.test(String(pathname || ''));
export const NFC_ENABLED = typeof location !== 'undefined' && nfcEnabledFor(location.pathname);
export const DEVICE_KEY = 'jh.attend.device';   // 폰 저장소에 기기 토큰을 두는 이름(쿠키를 쓰지 않는다 — 서버 함수 주소가 포털 주소와 달라 쿠키가 막힐 수 있음)
export const TOKEN_RE = /^[0-9a-f]{64}$/;
export const WORK_TYPES = [{ v: '', label: '사무실' }, { v: 'trip', label: '출장' }, { v: 'outside', label: '외근' }];
export const workTypeLabel = (v) => (WORK_TYPES.find((w) => w.v === (v || '')) || WORK_TYPES[0]).label;
export const LOC_LABEL = { office: '사무실', outside: '사무실 밖', unknown: '위치 확인 안 됨' };
export const locLabel = (s) => LOC_LABEL[s] || LOC_LABEL.unknown;

/** 기기 토큰 형식 — 서버가 만든 64자 16진수만 인정 */
export const validToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);

/** 태그 화면 첫 판단: 서버 status 응답 → 다음에 할 일.
 *  next: 'register'(등록 안내) · 'pending'(승인 대기) · 'revoked'(해제) · 'tag'(태그 요청 진행) */
export function nextStep(token, statusResp) {
  if (!validToken(token)) return { next: 'register' };
  if (!statusResp || statusResp.ok !== true || statusResp.registered !== true) return { next: 'register' };
  if (statusResp.status === 'pending') return { next: 'pending', name: statusResp.name || '' };
  if (statusResp.status === 'active') return { next: 'tag', name: statusResp.name || '' };
  return { next: 'revoked', name: statusResp.name || '' };
}

const hoursText = (h) => (Number(h) || 0).toFixed(1) + '시간';
const nameOf = (r) => (r && r.name ? r.name + ' 님' : '');

/** 태그 결과 → 화면 한 장 { tone, title, detail, note, autoClose } — 서버 응답(record)을 그대로 받는다 */
export function tagResultView(r) {
  if (!r || r.ok !== true) return errorView(null);
  const who = nameOf(r); const loc = locLabel(r.locState);
  if (r.action === 'duplicate') return { tone: 'info', title: '방금 기록되었습니다', detail: who, note: '', autoClose: true };
  const head = r.action === 'in' ? '출근 ' + r.time : '퇴근 ' + r.time + (r.workHours ? ' · 근무 ' + hoursText(r.workHours) : '');
  const confirmed = r.locState === 'office';
  const note = r.needsReview
    ? (r.locState === 'unknown' ? '위치를 확인하지 못했습니다. 대표님 확인 목록에 올라갑니다.' : '사무실 밖에서 기록되었습니다. 대표님 확인 목록에 올라갑니다.')
    : '';
  return { tone: r.needsReview ? 'warn' : 'success', title: who ? who + ', ' + head : head, detail: '위치: ' + loc + (confirmed ? ' ✔' : ''), note, autoClose: !r.needsReview };
}

/** 서버 오류(HttpsError: code·message) → 화면 한 장. 메시지는 서버가 직원이 읽을 수 있게 써 두었으므로 그대로 보여 주되, 로그인·연결 문제만 안내를 덧붙인다 */
export function errorView(err) {
  const code = err && (err.code || '').replace(/^functions\//, ''); const msg = (err && err.message) || '';
  if (code === 'unauthenticated') return { tone: 'danger', title: '로그인이 필요합니다', detail: '포털에 로그인한 뒤 다시 시도해 주세요.', note: '', autoClose: false, needsLogin: true };
  if (code === 'unavailable' || code === 'deadline-exceeded') return { tone: 'danger', title: '연결하지 못했습니다', detail: '네트워크를 확인한 뒤 다시 태그해 주세요.', note: '', autoClose: false };
  if (code === 'not-found' || code === 'internal' || !code) return { tone: 'danger', title: '기록하지 못했습니다', detail: msg || '잠시 후 다시 시도해 주세요. 계속되면 인사 담당자에게 문의해 주세요.', note: '', autoClose: false };
  return { tone: 'danger', title: '기록하지 못했습니다', detail: msg || '인사 담당자에게 문의해 주세요.', note: '', autoClose: false };
}

/** 태그 화면의 고정 안내(서버를 부르기 전 상태) */
export const FIXED_VIEWS = {
  register: { tone: 'info', title: '이 폰을 등록합니다', detail: '한 번만 등록하면 이후에는 스티커에 폰을 대기만 하면 출퇴근이 기록됩니다.', note: '', autoClose: false },
  pending: { tone: 'info', title: '대표님 승인 대기 중입니다', detail: '새 폰은 대표님 승인 후 사용할 수 있습니다. 승인 전에는 기존 폰이나 포털 출근 버튼을 쓰세요.', note: '', autoClose: false },
  revoked: { tone: 'warn', title: '등록이 해제된 폰입니다', detail: '포털에 로그인해서 다시 등록해 주세요.', note: '', autoClose: false },
  locating: { tone: 'info', title: '위치를 확인하는 중…', detail: '', note: '', autoClose: false },
  sending: { tone: 'info', title: '기록하는 중…', detail: '', note: '', autoClose: false }
};

/** 폰 위치 → 서버로 보낼 값 { lat, lng, acc } 또는 null(허용 거부·시간 초과) */
export function posFromGeo(g) {
  if (!g || !g.coords) return null; const c = g.coords;
  const ok = (n) => typeof n === 'number' && isFinite(n);
  if (!ok(c.latitude) || !ok(c.longitude)) return null;
  return { lat: c.latitude, lng: c.longitude, acc: ok(c.accuracy) ? Math.round(c.accuracy) : null };
}

/** 출근 버튼 입력 검사 — 근무 구분은 사무실(빈 값)·출장·외근만 */
export function cleanWorkType(v) { const x = v == null ? '' : String(v); return WORK_TYPES.some((w) => w.v === x) ? x : null; }

/** 출근 버튼 결과 한 줄(위젯 토스트용) */
export function buttonResultText(r) {
  const v = tagResultView(r);
  if (r && r.action === 'duplicate') return '방금 기록되었습니다.';
  return v.title + (r && r.workType ? ' · ' + workTypeLabel(r.workType) : '') + (v.note ? ' ' + v.note : '');
}

/** 대표님 확인 목록 한 줄의 "왜 올라왔나" — 서버 reviewList 행을 받는다. 출근 쪽과 퇴근 쪽(out…)을 모두 본다 */
export function reviewReason(r) {
  const parts = [];
  const side = (label, loc, wt) => {
    if (!loc) return;
    if (!wt && loc !== 'office') parts.push(label + ' ' + (loc === 'unknown' ? '위치 확인 안 됨(출장·외근 표시 없음)' : '사무실 밖인데 출장·외근 표시 없음'));
    if (wt && loc === 'office') parts.push(label + ' ' + workTypeLabel(wt) + '으로 표시했지만 위치는 사무실 안');
  };
  side('출근', r.locState, r.workType); side('퇴근', r.outLocState, r.outWorkType);
  return parts.length ? parts.join(' · ') : '확인 필요로 표시됨';
}
export function reviewRows(rows) {
  return (rows || []).map((r) => ({
    key: r.workerId + '_' + r.date, workerId: r.workerId, date: r.date, name: r.name || '', rank: r.rank || '',
    time: (r.checkIn || '--:--') + ' ~ ' + (r.checkOut || '--:--'), via: r.via === 'nfc' ? 'NFC' : '출근 버튼', reason: reviewReason(r),
    pos: isFinite(r.lat) && r.lat != null && isFinite(r.lng) && r.lng != null ? { lat: r.lat, lng: r.lng } : (isFinite(r.outLat) && r.outLat != null && isFinite(r.outLng) && r.outLng != null ? { lat: r.outLat, lng: r.outLng } : null),
    distanceM: r.locDistanceM == null ? null : r.locDistanceM
  }));
}
/** 기기 목록 → 승인 대기 먼저(서버가 정렬해 줌) 표시용 */
export function deviceRows(devs) {
  return (devs || []).map((d) => ({ id: d.id, name: d.name || '', rank: d.rank || '', status: d.status, label: d.label || '이름 없는 폰', pending: d.status === 'pending', createdAtMs: d.createdAtMs || 0, lastUsedAtMs: d.lastUsedAtMs || 0 }));
}
/** 사무실 위치 입력 검사 → { errors, value } (반경 50~2000m 정수 — 서버와 같은 규칙) */
export function validateOffice(input) {
  const errors = {}; const lat = Number(input && input.lat), lng = Number(input && input.lng), r = Number(input && input.radiusM);
  if (!isFinite(lat) || lat < -90 || lat > 90 || input.lat === '' || input.lat == null) errors.lat = '위도를 확인해 주세요.';
  if (!isFinite(lng) || lng < -180 || lng > 180 || input.lng === '' || input.lng == null) errors.lng = '경도를 확인해 주세요.';
  if (!Number.isInteger(r) || r < 50 || r > 2000) errors.radiusM = '반경은 50~2000m 사이 정수로 입력해 주세요.';
  return { errors, value: Object.keys(errors).length ? null : { lat, lng, radiusM: r, address: String((input && input.address) || '').trim().slice(0, 120) } };
}
/** 좌표 → 지도 링크(주소 변환이 안 될 때 대신 보여 줌) */
export const mapLink = (p) => (p ? 'https://map.kakao.com/link/map/' + encodeURIComponent('기록 위치') + ',' + p.lat + ',' + p.lng : '');
