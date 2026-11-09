import { lineContext, initialLine, lineIssues, addCc } from '../app/modules/edoc/compose.js';
import { lineEditorHtml } from '../app/modules/edoc/compose-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const has = (h, s) => h.indexOf(s) !== -1;
/* 2026-11-09 대표님: "내가 작성하는 모든 문서는 결재선 무시" — 정책 selfApprove 에 든 작성자는 결재자 없이 바로 확정(서버 core.js 와 같은 규칙, 화면은 미리 알려 줄 뿐) */
const users = [{ uid: 'kim', name: '김종화', rank: '부사장', status: 'approved', empNo: '22001' }, { uid: 'lee', name: '이다라', rank: '차장', status: 'approved', empNo: '23001' }, { uid: 'min', name: '김민서', rank: '대리', status: 'approved', empNo: '22003' }];
const guides = { daily: { steps: ['lee'], cc: ['min'] } };
const pol = { required: ['lee'], proxy: ['kim'], selfApprove: ['kim'] };
const ctxKim = lineContext(users[0], pol, guides, users, 'daily'), ctxLee = lineContext(users[1], pol, guides, users, 'daily'), ctxNo = lineContext(users[0], { required: ['lee'], proxy: [] }, guides, users, 'daily');
console.log('── 면제 판정');
ok(ctxKim.selfApprove === true && ctxLee.selfApprove === false && ctxNo.selfApprove === false, '★ 정책 selfApprove 에 든 사람만 면제(다른 사람·면제 목록이 없는 정책은 아님)');
ok(lineContext(null, pol, guides, users, 'daily').selfApprove === false, '로그인 정보가 없어도 안전');
console.log('── 처음 결재선·검증');
{ const l = initialLine(ctxKim); ok(l.approvers.length === 0 && l.cc.join() === 'min', '★ 면제 작성자는 결재자 없이 시작하고 권장 참조만 들어온다(필수 결재자·권장 결재자는 넣지 않음)'); }
{ const l = initialLine(lineContext(users[2], pol, guides, users, 'daily')); ok(l.approvers.join() === 'lee', '면제가 아닌 사람(김민서)은 기존대로 권장·필수 결재자(이다라)가 들어온다'); }
ok(lineIssues({ approvers: [], cc: [] }, ctxKim).length === 0, '★ 면제 작성자는 결재자 0명이어도 막히지 않는다');
ok(lineIssues({ approvers: [], cc: [] }, lineContext(users[2], pol, guides, users, 'daily')).length >= 1, '면제가 아닌 사람은 결재자 0명이면 기존대로 막힌다');
ok(addCc({ approvers: [], cc: [] }, 'min', ctxKim).state.cc.join() === 'min', '면제 작성자도 참조는 추가할 수 있다');
console.log('── 결재선 화면');
const hk = lineEditorHtml({ approvers: [], cc: ['min'] }, ctxKim, { search: '', picked: null }), hl = lineEditorHtml({ approvers: ['kim'], cc: [] }, Object.assign({}, ctxLee), { search: '', picked: null });
ok(has(hk, '결재선 없이 바로 확정') && !has(hk, 'data-add="approver"') && has(hk, 'data-add="cc"') && !has(hk, '권장 결재선'), '★ 면제 작성자 화면: 안내 문구가 있고 "결재자로 추가"·권장 결재선은 없으며 참조 추가는 있다');
ok(!has(hl, '결재선 없이 바로 확정') && has(hl, 'data-add="approver"'), '★ 면제가 아닌 사람 화면은 그대로');
console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
