import { partsToServer, partsFromServer } from '../app/modules/edoc/compose.js';
import { composeHtml } from '../app/modules/edoc/compose-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const J = JSON.stringify; const has = (h, s) => h.indexOf(s) !== -1;
/* 2026-11-09 핫픽스: 칩은 영업기획 프로젝트 id 를 쓰는데 서버(pjtPartAct)는 PJT 관리(pjt_registry) id 로 찾아 "프로젝트를 찾을 수 없습니다"로 거절했다 — 영업기획 문서의 linkPjt 로 바꿔 보낸다 */
const PR = [{ id: 'pjt_1', code: '이천 M14', name: 'CTH 13대 설치', reg: 'regA' }, { id: 'pjt_2', code: '', name: '청주 P&T3', reg: 'regB' }, { id: 'pjt_3', code: 'X', name: '연결 없음', reg: '' }];
console.log('── 칩 id → 서버 id');
ok(J(partsToServer(['pjt_1', 'pjt_2'], PR)) === J([{ pjt: 'regA' }, { pjt: 'regB' }]), '★ 칩 id(영업기획)를 PJT 관리 프로젝트 id(linkPjt)로 바꿔 보낸다');
ok(J(partsToServer([{ pjt: 'pjt_1', ratio: 40 }, { pjt: 'pjt_2', ratio: 60 }], PR)) === J([{ pjt: 'regA', ratio: 40 }, { pjt: 'regB', ratio: 60 }]), '직접 입력한 비율(ratio)은 그대로 따라간다');
ok(J(partsToServer([{ pjt: 'common' }], PR)) === J([{ pjt: 'common' }]) && J(partsToServer(['common'], PR)) === J([{ pjt: 'common' }]), '"공통"은 바꾸지 않는다');
{ let m = ''; try { partsToServer(['pjt_3'], PR); } catch (e) { m = e.message; } ok(/연결돼 있지 않아/.test(m) && m.indexOf('X · 연결 없음') !== -1, '★ PJT 관리와 연결이 없는 프로젝트는 서버로 보내지 않고 어느 프로젝트인지 알려 주는 오류'); }
{ let m = ''; try { partsToServer(['nope'], PR); } catch (e) { m = e.message; } ok(/연결돼 있지 않아/.test(m), '목록에 없는 id 도 같은 오류(엉뚱한 id 를 서버로 보내지 않음)'); }
ok(partsToServer(null, PR).length === 0 && partsToServer([], null).length === 0, '목록이 비었거나 없으면 빈 결과');
console.log('── 서버 id → 칩 id');
ok(J(partsFromServer([{ pjt: 'regA', bp: 4000 }, { pjt: 'regB', bp: 6000 }], PR)) === J([{ pjt: 'pjt_1', bp: 4000 }, { pjt: 'pjt_2', bp: 6000 }]), '★ 서버가 돌려준 id 를 칩 id 로 되돌린다(비율 bp 는 그대로)');
ok(J(partsFromServer([{ pjt: 'common' }, { pjt: 'unknown' }], PR)) === J([{ pjt: 'common' }, { pjt: 'unknown' }]), '공통·모르는 id 는 그대로');
ok(partsFromServer(undefined, PR).length === 0, '없으면 빈 목록');
{ const back = partsFromServer(partsToServer(['pjt_2', 'pjt_1'], PR), PR); ok(J(back) === J([{ pjt: 'pjt_2' }, { pjt: 'pjt_1' }]), '갔다 오면 원래 id·순서 그대로'); }
console.log('── 위쪽 "프로젝트" 칸');
const form = (partsOn, type) => composeHtml({ type: type || 'daily', values: { date: '2026-11-09', pjtId: 'pjt_1', todayWork: '', tomorrowWork: '', issue: '', parts: [{ pjt: 'pjt_1' }] }, errors: {}, ctx: { projects: PR, me: { name: '김' }, users: [], vehicles: [], byUid: {}, required: [] }, files: [], uploading: [], line: { approvers: [], cc: [] }, partsUi: { custom: false, texts: {}, preview: null, previewError: '' }, busy: false, partsOn });
const on = form(true), off = form(false);
ok(!has(on, 'data-input="pjtId"') && has(on, 'data-input="date"') && has(on, 'data-input="todayWork"') && has(on, 'edoc-parts'), '★ 참여 프로젝트가 켜지면 위쪽 프로젝트 선택이 없어지고 작성일·금일 업무·칩은 그대로 있다');
ok(has(off, 'data-input="pjtId"') && !has(off, 'edoc-parts'), '★ 꺼져 있으면 예전 그대로(위쪽 프로젝트 선택이 있고 칩은 없다)');
ok(has(on, '가장 먼저 고른 프로젝트') && !has(on, '가장 많이 일한 곳'), '칩 안내 문구가 "가장 먼저 고른 프로젝트가 제목에 쓰인다"로 바뀌었다');
{ const sp = composeHtml({ type: 'spend', values: { kind: 'purchase', pjtId: 'pjt_1', items: [], vendor: '', purpose: '', dueDate: '', expDate: '2026-11-09', category: '', amount: '', receipt: '' }, errors: {}, ctx: { projects: PR, me: { name: '김' }, users: [], vehicles: [], byUid: {}, required: [] }, files: [], uploading: [], line: { approvers: [], cc: [] }, busy: false, partsOn: true }); ok(has(sp, 'data-input="pjtId"'), '★ 다른 양식(지출결의 등)의 프로젝트 칸은 영향 없다'); }
console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
