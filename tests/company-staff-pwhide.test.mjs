// 2026-11-02 정규 직원 비밀번호 무작위화 뒤: 직원 관리에서 Microsoft 전용 계정에는 임시 비밀번호 발급·재설정 메일 버튼을 보이지 않는다
import { usesPassword } from '../app/modules/company/staff-logic.js';
import { staffDialogHtml, newAccountDialogHtml } from '../app/modules/company/staff-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const U = (o) => Object.assign({ uid: 'u1', name: '홍길동', email: 'hong@jhsol.kr', empNo: '2301', rank: '사원', dept: 'PJT팀', status: 'approved', perms: {} }, o || {});
const dlg = (u) => staffDialogHtml(u, null, ['PJT팀'], null, false);
ok(usesPassword(U()) === false, '정규 직원(사번 일반)은 비밀번호 계정이 아님');
ok(usesPassword(U({ empNo: 'guest001' })) === true && usesPassword(U({ empNo: ' GUEST002 ' })) === true, 'GUEST(사번 guest…, 대소문자·공백 무관)는 비밀번호 계정');
ok(usesPassword(U({ extLogin: true })) === true, '본인 이메일 로그인(extLogin) 계정은 비밀번호 계정');
ok(usesPassword(U({ pwLogin: true })) === true, '비밀번호 로그인 허용 표시(pwLogin) 계정은 비밀번호 계정');
ok(usesPassword(U({ pwLogin: 'true', extLogin: 1 })) === false, '엄격한 참(true)만 인정 — 문자열·숫자는 아님');
ok(usesPassword(null) === false && usesPassword(undefined) === false && usesPassword({}) === false, '빈 값은 비밀번호 계정이 아님');
let h = dlg(U());
ok(!h.includes('data-staff-pw') && !h.includes('data-staff-mail') && !h.includes('임시 비밀번호 발급') && !h.includes('재설정 메일 보내기'), '정규 직원 화면: 임시 비밀번호 발급·재설정 메일 버튼이 없음');
ok(h.includes('Microsoft 로그인만 씁니다') && h.includes('앱 사용자 할당'), '정규 직원 화면: Microsoft 전용 계정 안내와 확인할 곳(Entra·앱 사용자 할당)이 보임');
ok(h.includes('data-staff-status') && h.includes('사용 중지'), '정규 직원 화면: 사용 중지 버튼은 그대로 있음(퇴사 처리용)');
ok(h.includes('data-staff-extlogin') && h.includes('계약직 — 본인 이메일 로그인으로 변경'), '정규 직원 화면: 계약직 전환 버튼은 그대로 있음');
for (const [name, u] of [['GUEST', U({ empNo: 'guest001', email: 'kt.lee@jhsol.kr' })], ['본인 이메일 로그인', U({ extLogin: true, email: 'a@naver.com' })], ['pwLogin', U({ pwLogin: true })]]) {
  h = dlg(u); ok(h.includes('data-staff-pw') && h.includes('data-staff-mail') && h.includes('임시 비밀번호를 발급하면') && !h.includes('Microsoft 로그인만 씁니다'), name + ' 계정: 임시 비밀번호 발급·재설정 메일 버튼과 기존 안내가 그대로 보임');
}
h = staffDialogHtml(U({ empNo: 'guest001' }), null, ['PJT팀'], null, true);
ok(!h.includes('data-staff-pw'), '본인 계정을 보는 화면에는 계정 관리 구역 자체가 없음(기존 동작)');
const nf = newAccountDialogHtml(['PJT팀'], ['사원']);
ok(nf.includes('임시 비밀번호를 쓰지 않습니다') && nf.includes('GUEST') && !nf.includes('직원에게 전달하고 로그인 뒤'), '새 계정 창: 정규 직원은 Microsoft 로 로그인하고 임시 비밀번호는 GUEST 만 나온다는 안내');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
