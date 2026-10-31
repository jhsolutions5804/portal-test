/* NFC 출퇴근 — 서버 호출·기기 토큰 보관·폰 위치. 화면·계산은 nfc-logic.js / nfc-view.js. 시험은 가짜 함수·저장소를 주입한다 */
import { DEVICE_KEY, validToken, posFromGeo } from './nfc-logic.js?v=20261031f';

/** 서버 함수 attendNfcAct 호출기 — call(f) 에 파이어베이스 callable 을 주입한다. 오류는 { code, message } 를 그대로 던진다 */
export function makeNfcApi(call) {
  const run = async (action, data) => { const r = await call(Object.assign({ action }, data || {})); return (r && r.data) || r; };
  return {
    status: (token) => run('status', { deviceToken: token }),
    tag: (token, pos) => run('tag', { deviceToken: token, pos: pos || null }),
    register: (label, ua) => run('register', { label: label || '', ua: ua || '' }),
    button: (workType, pos) => run('button', { workType: workType || '', pos: pos || null }),
    devices: () => run('devices'), approveDevice: (id) => run('approveDevice', { deviceId: id }), revokeDevice: (id) => run('revokeDevice', { deviceId: id }),
    getOffice: () => run('getOffice'), saveOffice: (v) => run('saveOffice', v),
    reviewList: () => run('reviewList'), resolveReview: (workerId, date) => run('resolveReview', { workerId, date }), address: (lat, lng) => run('address', { lat, lng })
  };
}

/** 기기 토큰 보관 — 폰 저장소(localStorage). 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 null/false 를 돌려주고 화면이 안내한다 */
export function makeTokenStore(storage) {
  const st = storage || null;
  return {
    load() { try { const v = st && st.getItem(DEVICE_KEY); return validToken(v) ? v : null; } catch (e) { return null; } },
    save(token) { if (!validToken(token)) return false; try { st.setItem(DEVICE_KEY, token); return st.getItem(DEVICE_KEY) === token; } catch (e) { return false; } },
    clear() { try { st && st.removeItem(DEVICE_KEY); } catch (e) { /* 지울 수 없어도 무시 */ } }
  };
}

/** 지금 위치 한 번 — 허용 거부·시간 초과·미지원이면 null(기록은 위치 미확인으로 진행). 하루 종일 추적하지 않는다 */
export function getPosition(nav, timeoutMs) {
  return new Promise((resolve) => {
    if (!nav || !nav.geolocation) { resolve(null); return; }
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const t = setTimeout(() => fin(null), (timeoutMs || 8000) + 500);
    try { nav.geolocation.getCurrentPosition((g) => { clearTimeout(t); fin(posFromGeo(g)); }, () => { clearTimeout(t); fin(null); }, { enableHighAccuracy: true, timeout: timeoutMs || 8000, maximumAge: 0 }); } catch (e) { clearTimeout(t); fin(null); }
  });
}

/** 폰 이름표(등록할 때 관리자 목록에 보일 짧은 설명) — 사용자 에이전트에서 기종 정도만 뽑는다 */
export function deviceLabel(ua) {
  const s = String(ua || ''); const m = /Android[^;)]*;\s*([^;)]+)/.exec(s);
  if (m) return m[1].trim().slice(0, 40);
  if (/iPhone/.test(s)) return 'iPhone'; if (/iPad/.test(s)) return 'iPad'; if (/Windows/.test(s)) return 'Windows PC'; if (/Macintosh/.test(s)) return 'Mac';
  return '모바일';
}
