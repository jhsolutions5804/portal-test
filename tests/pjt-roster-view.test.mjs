/* 연명부 상세 화면 — 2026-10-28 대표님 요청 3건 회귀 시험(화면 글자만 검사, 네트워크 없음)
 * ① 통장사본은 "서류·사진"이 아니라 "급여·계좌" 카드에(관리자만) ② 삼성 사내화 교육에 화학물질안전원 온라인 교육이 없다(상단 별도 탭) ③ 날짜 칸 검사 */
import { rosterHtml } from '../app/modules/pjt/roster-view.js';
import { rowOf, summaryOf, validDateInput } from '../app/modules/pjt/roster.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const T = '2026-10-28';
const masters = [{ id: 'A', name: '홍길동', birth: '1990-01-01', hireDate: '2026-01-01' }];
const privs = { A: { phone: '010-0000-0000', bank: '국민', account: '1-2-3', dailyRate: 100000, inhouseEdu: { e1: true, e2: true, e3: true, e4: true }, files: { photo: { name: 'a.jpg', size: 1000 }, bankbook: { name: 'b.jpg', size: 2000 } } } };
const byId = (id) => masters.find((m) => m.id === id);
const build = (admin) => { const ctx = { today: T, masterById: byId, accountOf: () => null }; const allRows = masters.map((m) => rowOf(m, privs[m.id], ctx));
  return { allowed: true, ready: true, admin, canEdit: true, sel: 'A', masters, privs, accounts: [], hr: {}, filter: 'active', query: '', sortKey: null, sortDir: 1, busy: false, edit: null, jr: null, photo: null, allRows, rows: allRows, alertRows: [], counts: { active: 1, resigned: 0, all: 1, alert: 0 }, coTab: 'samsung', coSub: 'edu', reveal: new Set(), today: T, summary: summaryOf(masters, privs, T), contractors: [], accountOf: () => null, hrMatch: () => null, err: '' }; };
const hA = rosterHtml(build(true)), hU = rosterHtml(build(false));
const iFiles = hA.indexOf('서류·사진'), iPay = hA.indexOf('급여·계좌');
const bankA = [...hA.matchAll(/data-ro-(file|fview)="bankbook"/g)].map((m) => m.index);
ok(iFiles >= 0 && iPay > iFiles && bankA.length >= 2 && bankA.every((i) => i > iPay), '★ 관리자: 통장사본 칸(보기·올리기)은 "급여·계좌" 카드 안에만 있고 "서류·사진"에는 없음');
ok(!/bankbook/.test(hU) && !/통장사본/.test(hU), '관리자가 아니면 통장사본 칸이 어디에도 보이지 않음');
ok(!/화학물질안전원 온라인/.test(hA) && /화학물질취급작업 안전인증과정/.test(hA), '★ 삼성 사내화 교육 목록에 "화학물질안전원 온라인 안전교육"이 없고 나머지 3종은 그대로(상단 별도 탭에서 관리)');
ok(validDateInput('') && validDateInput('2026-10-28') && validDateInput('1900-01-01') && validDateInput('2100-12-31') && !validDateInput('0002-10-27') && !validDateInput('0202-10-27') && !validDateInput('2026-13-01') && !validDateInput('2026-1-1') && !validDateInput('abc') && validDateInput(null), '★ 날짜 칸 검사: 비어 있거나 1900~2100년 YYYY-MM-DD 만 확정 — 연도를 한 글자씩 칠 때 걸리는 0002-… 값은 화면을 다시 그리지 않고 넘김');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
