// 퇴직 처리 ↔ 포털 계정 자동 중지: 화면 안내·서버 응답 해석 규칙(순수 함수)과 인사 화면의 서버 호출 연결(소스)
import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/hr/index.js', import.meta.url), 'utf8').match(/core\/firebase\.js\?v=([0-9a-z]+)/) || [])[1];
const { resignAccountPlan, resignSyncMessage, buildResign } = await import('../app/modules/hr/logic.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const TODAY = '2026-10-15';
// ── 안내: 퇴직일이 지났으면 바로, 아니면 다음 날 새벽(서버 resign-sweep.js 와 같은 기준 — 퇴직일 당일까지는 재직)
const past = resignAccountPlan('2026-09-16', TODAY), same = resignAccountPlan('2026-10-15', TODAY), fut = resignAccountPlan('2026-10-31', TODAY);
ok(past.when === 'now' && /바로 사용 중지/.test(past.text) && past.stopFrom === '2026-09-17', '퇴직일이 지났으면 "바로 사용 중지"');
ok(same.when === 'later' && same.stopFrom === '2026-10-16' && /2026-10-16 새벽/.test(same.text), '★ 퇴직일이 오늘이면 당일은 재직이므로 다음 날(10-16) 새벽에 중지');
ok(fut.when === 'later' && fut.stopFrom === '2026-11-01' && /2026-11-01 새벽/.test(fut.text) && /날짜를 한 번 더 확인/.test(fut.text), '★ 퇴직일이 미래(10-31)면 11-01 새벽에 중지, 날짜 오입력 주의 문구 포함');
ok(resignAccountPlan('2026-12-31', TODAY).stopFrom === '2027-01-01' && resignAccountPlan('2028-02-29', '2026-01-01').stopFrom === '2028-03-01', '월말·연말·윤년 다음 날 계산이 맞음(12-31 → 01-01, 2028-02-29 → 03-01)');
ok(resignAccountPlan('', TODAY).when === 'invalid' && resignAccountPlan('2026-9-5', TODAY).text === '' && resignAccountPlan(null, TODAY).when === 'invalid', '날짜 형식이 이상하면 안내 없음');
// ── 서버 응답 해석
const msg = (r, n) => resignSyncMessage(r, n || '형');
ok(msg({ suspended: [{ name: '형' }] }).ok === true && /사용 중지했습니다/.test(msg({ suspended: [{ name: '형' }] }).text), '중지됐으면 "사용 중지했습니다"');
ok(msg({ failed: [{ name: '형' }] }).ok === false && /직접 사용 중지/.test(msg({ failed: [{ name: '형' }] }).text), '★ 서버가 중지에 실패했다고 알려 오면 직접 중지하라고 안내(성공처럼 보이지 않음)');
ok(/관리자 계정이라 자동으로 중지하지 않았습니다/.test(msg({ skippedAdmin: ['형'] }).text), '관리자 계정이면 자동 중지하지 않았다고 알림');
ok(/확실하게 찾지 못해 건드리지 않았습니다\(같은 사번의 계정이 2개\)/.test(msg({ ambiguous: [{ name: '형', why: '같은 사번의 계정이 2개' }] }).text), '계정을 확실히 못 찾으면 이유와 함께 알림');
ok(msg({ suspended: [{ name: '다른사람' }] }).text === '' && msg({}).text === '' && msg(null).text === '' && msg({ alreadyOff: 1 }).text === '', '퇴직 처리한 사람과 무관한 결과·이미 중지된 경우·빈 응답은 아무 안내도 하지 않음(다른 사람 이름이 섞여 나오지 않음)');
ok(msg({ suspended: [{ name: '다른사람' }], failed: [{ name: '형' }] }).ok === false, '여러 명이 함께 처리돼도 이번에 퇴직 처리한 사람의 결과만 안내');
// ── 인사 화면 소스: 연결 확인
const src = fs.readFileSync(new URL('../app/modules/hr/index.js', import.meta.url), 'utf8');
ok(/import \{ auth, functions, httpsCallable,/.test(src) && src.includes("httpsCallable(functions, 'adminAct')"), '인사 화면이 서버 adminAct 를 호출함');
ok(src.includes("await syncAccount('syncResigned', rnm)") && src.includes("await syncAccount('restoreResigned', rnm2, rid)"), '퇴직 처리 뒤 syncResigned, 재직 복구 뒤 restoreResigned 를 호출함');
const iRes = src.indexOf("act === 'resign'"), iUn = src.indexOf("act === 'unresign'"), blkRes = src.slice(iRes, iUn);
ok(blkRes.indexOf("setDoc(doc(db, 'workers'") < blkRes.indexOf("syncAccount('syncResigned'") && blkRes.indexOf("toast('퇴직 처리했습니다.')") < blkRes.indexOf("syncAccount('syncResigned'") && blkRes.includes('resignAccountPlan(rr.patch.resignDate, st.today).text'), '★ 명부 저장과 "퇴직 처리했습니다" 안내가 먼저고 서버 호출은 그 뒤 — 서버가 실패해도 퇴직 처리는 유지됨, 확인 창에 중지 시점 안내 포함');
ok(/not-found\|unimplemented/.test(src) && src.includes('직원 관리에서 직접 사용 '), '서버 함수 미배포·연결 실패 때 직접 처리하라고 안내');
// 퇴직 처리·재직 복구 블록과 서버 호출 헬퍼는 계정 문서를 직접 고치지 않는다(로그인 차단은 서버에서만 가능). 직원 정보 수정 때 이름·직급을 계정에 맞춰 갱신하는 기존 코드(다른 줄)는 대상이 아니다
const iHelper = src.indexOf('const syncAccount = async'), helperEnd = src.indexOf('};', src.indexOf('직원 관리에서 직접 사용', iHelper)) + 2, helperBlk = src.slice(iHelper, helperEnd), unBlk = src.slice(iUn, src.indexOf('\n', iUn)), resBlk = src.slice(iRes, src.indexOf('\n', iRes));
const touchesUsers = (t) => /portal_users/.test(t);
ok(iHelper > 0 && helperBlk.length > 200 && !touchesUsers(helperBlk) && !touchesUsers(resBlk) && !touchesUsers(unBlk), '★ 퇴직 처리·재직 복구·서버 호출 헬퍼는 포털 계정 문서(portal_users)를 직접 고치지 않음(서버만 처리)');
ok(buildResign('2026-09-16').patch.status === 'resigned', '기존 퇴직 처리 규칙(buildResign)은 그대로');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
