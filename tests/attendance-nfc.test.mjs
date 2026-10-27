// NFC 출퇴근 화면(대기열 1-3-26) — 순수 계산·화면 조각·기기 토큰 보관·서버 호출기·태그 페이지·앱 연결. 서버(attendNfcAct)는 가짜 함수로 대신한다.
import fs from 'node:fs';
import * as L from '../app/modules/attendance/nfc-logic.js';
import { makeNfcApi, makeTokenStore, getPosition, deviceLabel } from '../app/modules/attendance/nfc-data.js';
import { tagCardHtml, registerPageHtml, workTypeFieldHtml, reviewPageHtml } from '../app/modules/attendance/nfc-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const T64 = 'a'.repeat(64);

ok(L.NFC_ENABLED === false, '시험 환경(주소 없음)에서는 NFC 기능이 꺼져 있다');
ok(L.nfcEnabledFor('/portal-test/app/') === true && L.nfcEnabledFor('/portal-test/m/tag.html') === true && L.nfcEnabledFor('/portal-test') === true && L.nfcEnabledFor('/app/') === false && L.nfcEnabledFor('/m/tag.html') === false && L.nfcEnabledFor('') === false && L.nfcEnabledFor(null) === false && L.nfcEnabledFor('/portal-testing/app/') === false, '★ NFC 기능은 테섭 주소(/portal-test/)에서만 켜지고 본섭 주소에서는 꺼져 있다');
ok(L.validToken(T64) && !L.validToken('zz') && !L.validToken(null) && !L.validToken('A'.repeat(64)), '기기 토큰은 서버가 만드는 64자 16진수(소문자)만 인정');
// 태그 화면 다음 단계
ok(L.nextStep(null, null).next === 'register' && L.nextStep(T64, { ok: true, registered: false }).next === 'register', '★ 토큰이 없거나 서버에 없는 기기는 등록 안내');
ok(L.nextStep(T64, { ok: true, registered: true, status: 'pending', name: '가나다' }).next === 'pending' && L.nextStep(T64, { ok: true, registered: true, status: 'active', name: '가나다' }).next === 'tag' && L.nextStep(T64, { ok: true, registered: true, status: 'revoked' }).next === 'revoked', '★ 상태별 다음 단계: 승인 대기·정상(태그)·해제');
// 태그 결과 화면
const inR = L.tagResultView({ ok: true, action: 'in', time: '09:00', name: '가나다', locState: 'office', needsReview: false });
ok(inR.tone === 'success' && inR.title === '가나다 님, 출근 09:00' && inR.detail.includes('사무실 ✔') && inR.autoClose === true && inR.note === '', '★ 사무실 출근: 한 줄 결과 + 위치 ✔ + 자동 닫힘');
const outR = L.tagResultView({ ok: true, action: 'out', time: '18:10', workHours: 8, name: '가나다', locState: 'office', needsReview: false });
ok(outR.title === '가나다 님, 퇴근 18:10 · 근무 8.0시간', '퇴근 결과에 근무시간이 붙는다');
const unk = L.tagResultView({ ok: true, action: 'in', time: '09:00', name: '가나다', locState: 'unknown', needsReview: true });
ok(unk.tone === 'warn' && unk.note.includes('위치를 확인하지 못했습니다') && unk.autoClose === false, '★ 위치 미확인: 기록은 되고 대표님 확인 목록에 올라간다고 안내(자동 닫힘 없음)');
ok(L.tagResultView({ ok: true, action: 'in', time: '09:00', name: '가나다', locState: 'outside', needsReview: true }).note.includes('사무실 밖'), '사무실 밖 기록 안내');
ok(L.tagResultView({ ok: true, action: 'duplicate', name: '가나다' }).title === '방금 기록되었습니다', '2분 안 재태그는 "방금 기록되었습니다"');
ok(L.errorView({ code: 'functions/permission-denied', message: '퇴직 처리된 계정입니다.' }).detail === '퇴직 처리된 계정입니다.' && L.errorView({ code: 'unauthenticated' }).needsLogin === true && L.errorView({ code: 'unavailable' }).title === '연결하지 못했습니다', '서버 오류 문구는 그대로 보여 주고 로그인·연결 문제만 안내를 덧붙인다');
// 위치·근무 구분
ok(JSON.stringify(L.posFromGeo({ coords: { latitude: 37.1, longitude: 127.0, accuracy: 12.4 } })) === '{"lat":37.1,"lng":127,"acc":12}' && L.posFromGeo(null) === null && L.posFromGeo({ coords: { latitude: 'x', longitude: 1 } }) === null, '폰 위치 → { lat, lng, acc }, 잘못된 값은 null');
ok(L.cleanWorkType('') === '' && L.cleanWorkType('trip') === 'trip' && L.cleanWorkType('outside') === 'outside' && L.cleanWorkType('home') === null && L.cleanWorkType(undefined) === '', '근무 구분은 사무실(빈 값)·출장·외근만');
// 확인 목록
const rows = L.reviewRows([{ workerId: 'w1', name: '가나다', rank: '대리', date: '2026-11-02', checkIn: '09:10', checkOut: '18:00', workType: '', locState: 'outside', locDistanceM: 5200, lat: 37.2, lng: 127.1, via: 'button', outLocState: 'unknown', outWorkType: '' }]);
ok(rows[0].reason === '출근 사무실 밖인데 출장·외근 표시 없음 · 퇴근 위치 확인 안 됨(출장·외근 표시 없음)' && rows[0].via === '출근 버튼' && rows[0].pos.lat === 37.2 && rows[0].distanceM === 5200, '★ 확인 목록: 왜 올라왔는지(출근·퇴근 쪽 각각)와 방식·좌표·거리');
ok(L.reviewReason({ workType: 'trip', locState: 'office' }) === '출근 출장으로 표시했지만 위치는 사무실 안' && L.reviewReason({ outWorkType: 'outside', outLocState: 'office' }) === '퇴근 외근으로 표시했지만 위치는 사무실 안', '출장·외근을 눌렀는데 사무실 안이면 그 이유로 올라온다');
ok(L.deviceRows([{ id: 'x', name: '가나다', status: 'pending', label: '' }])[0].pending === true && L.deviceRows([{ id: 'x', status: 'active' }])[0].pending === false, '기기 목록: 승인 대기 구분');
// 사무실 위치 입력 검사
ok(L.validateOffice({ lat: '36.99', lng: '127.05', radiusM: '200' }).value.radiusM === 200 && L.validateOffice({ lat: '36.99', lng: '127.05', radiusM: '30' }).errors.radiusM && L.validateOffice({ lat: '', lng: '127', radiusM: 100 }).errors.lat && L.validateOffice({ lat: 95, lng: 127, radiusM: 100 }).errors.lat, '★ 사무실 위치 입력: 반경 50~2000m 정수, 위도·경도 범위(서버와 같은 규칙)');
// 화면 조각
const card = tagCardHtml(unk, { inputHref: '../app/#/attendance/input' });
ok(card.includes('role="status"') && card.includes('data-tone="warn"') && card.includes('위치를 확인하지 못했습니다') && card.includes('잘못 기록되었으면 포털에서 수정'), '★ 태그 화면: 한 줄 결과 + 안내 + 수정 링크, 직원이 누를 버튼 없음');
ok(tagCardHtml(L.FIXED_VIEWS.register, { registerHref: '../app/#/attendance/register' }).includes('이 폰 등록하기') && tagCardHtml(L.errorView({ code: 'unavailable' }), { retry: true }).includes('data-tag-retry'), '등록 안내와 다시 시도 버튼');
ok(!tagCardHtml({ tone: 'info', title: '<img src=x onerror=alert(1)>', detail: '<b>x</b>' }).includes('<img'), '화면 문구는 이스케이프된다');
ok(registerPageHtml({ stage: 'done', status: 'pending', storageOk: true }).includes('대표님 승인 후') && registerPageHtml({ stage: 'done', status: 'active', storageOk: false }).includes('저장하지 못했습니다') && registerPageHtml({ stage: 'idle' }).includes('data-nfc-register'), '★ 등록 화면: 승인 대기 안내·저장 실패 안내·등록 버튼');
const wt = workTypeFieldHtml('', false);
ok(wt.includes('value=""') && wt.includes('value="trip"') && wt.includes('value="outside"') && /value="" checked/.test(wt) && workTypeFieldHtml('trip').includes('value="trip" checked'), '출근 버튼 근무 구분: 사무실(기본)·출장·외근');
const rv = reviewPageHtml({ loading: false, error: '', rows: rows, devices: L.deviceRows([{ id: 'd'.repeat(64), name: '나다라', status: 'pending', label: 'SM-S921' }, { id: 'e'.repeat(64), name: '가나다', status: 'active', label: 'Pixel' }]), office: null, officeForm: {}, addr: {}, busy: false, noKey: true });
ok(rv.includes('확인 필요 출퇴근') && rv.includes('data-nfc-resolve') && rv.includes('data-nfc-approve') && rv.includes('data-nfc-revoke') && rv.includes('사무실 위치가 저장되지 않았습니다') && rv.includes('data-nfc-office-here') && rv.includes('지도로 보기') && rv.includes('주소 변환 설정 전'), '★ 확인 화면 3구역(확인 필요 출퇴근·기기 요청·사무실 위치): 확인 처리·승인/거절·위치 저장, 주소 변환 전에는 지도 링크');
ok(reviewPageHtml({ loading: false, error: '', rows: [], devices: [], office: { lat: 36.99, lng: 127.05, radiusM: 200, address: '' }, officeForm: {}, addr: {}, busy: false }).includes('확인할 건이 없습니다') && reviewPageHtml({ loading: true }).includes('불러오는 중'), '확인할 건이 없을 때·불러오는 중 화면');
// 기기 토큰 보관
const mem = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
const st = makeTokenStore(mem);
ok(st.load() === null && st.save(T64) === true && st.load() === T64 && st.save('bad') === false && (st.clear(), st.load() === null), '★ 기기 토큰 보관: 저장·읽기·잘못된 값 거부·삭제');
ok(makeTokenStore({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} }).save(T64) === false && makeTokenStore(null).load() === null, '저장소를 못 쓰는 환경(사생활 보호 모드)이면 저장 실패를 알린다');
// 서버 호출기
const calls = []; const api = makeNfcApi(async (p) => { calls.push(p); return { data: { ok: true, echo: p.action } }; });
await api.tag(T64, { lat: 1, lng: 2, acc: 3 }); await api.button('trip', null); await api.status(T64); await api.resolveReview('w1', '2026-11-02'); await api.approveDevice('d'.repeat(64));
ok(calls[0].action === 'tag' && calls[0].deviceToken === T64 && calls[0].pos.lat === 1 && calls[1].action === 'button' && calls[1].workType === 'trip' && calls[2].action === 'status' && calls[3].action === 'resolveReview' && calls[3].workerId === 'w1' && calls[4].deviceId === 'd'.repeat(64), '★ 서버 호출기: 태그·출근 버튼·상태·확인 처리·승인이 서버 동작 이름과 입력 칸에 맞게 나간다');
// 위치
const okNav = { geolocation: { getCurrentPosition: (s) => s({ coords: { latitude: 36.99, longitude: 127.05, accuracy: 20 } }) } };
const denyNav = { geolocation: { getCurrentPosition: (s, e) => e({ code: 1 }) } };
ok((await getPosition(okNav, 100)).acc === 20 && (await getPosition(denyNav, 100)) === null && (await getPosition({}, 100)) === null && (await getPosition(null, 100)) === null, '★ 위치 요청: 허용이면 좌표, 거부·미지원이면 null(기록은 위치 미확인으로 진행)');
ok(deviceLabel('Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit') === 'SM-S921N' && deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)') === 'iPhone' && deviceLabel('') === '모바일', '폰 이름표: 안드로이드 기종·아이폰');
// 태그 페이지·앱 연결(원문 검사)
const tag = fs.readFileSync(new URL('../m/tag.html', import.meta.url), 'utf8');
ok(/\/m\/tag\.html/.test(tag) && /attendNfcAct/.test(tag) && /nextStep\(token, st\)/.test(tag) && /getPosition\(navigator/.test(tag) && !/localStorage\.setItem|document\.cookie/.test(tag), '★ 태그 페이지: 이 경로 고정·status → 태그 순서·위치는 한 번·쿠키를 쓰지 않음');
ok(/NFC_ENABLED\) \{ show\(\{ tone: 'info', title: '출퇴근 태그 기능을 준비 중입니다/.test(tag), '서버 적용 전에는 "준비 중" 안내만 보인다');
const idx = fs.readFileSync(new URL('../app/modules/attendance/index.js', import.meta.url), 'utf8');
ok(/NFC_ENABLED && route\.segs\[0\] === 'register'/.test(idx) && /NFC_ENABLED && route\.segs\[0\] === 'review'/.test(idx) && /if \(!me\.admin\) \{ location\.replace\('#\/attendance\/input'\)/.test(idx), '★ 앱 연결: 등록 화면은 NFC 켜짐일 때만, 확인 화면은 관리자만(아니면 기록 화면으로)');
ok(/if \(NFC_ENABLED\) \{[\s\S]{0,200}getPosition[\s\S]{0,200}\.button\(cleanWorkType\(M\.workType\)/.test(idx), '출근 버튼: NFC 켜짐이면 서버(button)로 — 위치와 근무 구분을 함께 보낸다, 꺼짐이면 기존 원터치 그대로');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
