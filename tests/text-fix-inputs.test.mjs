// 전각 문자 정리 2차 시험(2026-11-03) — 업무일지·공사일보·수기 전표에 붙여 넣은 전각 문자가 저장 문서에 들어가지 않는지, 그리고 객체 정리 함수가 안전한지 본다. APP_DIR 로 다른 앱 폴더를 점검할 수 있다(변이 시험용).
import path from 'node:path'; import { pathToFileURL } from 'node:url';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const APP = process.env.APP_DIR || path.resolve(new URL('../app/', import.meta.url).pathname);
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href);
const { halfwidthDeep } = await load('shared/text-fix.js');
// 1) 객체·배열 정리
const src = { a: 'Ｐ４ｐｈ', n: 5, t: true, z: null, u: undefined, arr: ['ＰＣＭ', { x: '（현병찬、 명노근）', k: 3 }], d: new Date(0), nested: { s: '３、 ４동' } };
const out = halfwidthDeep(src);
ok(out.a === 'P4ph' && out.arr[0] === 'PCM' && out.arr[1].x === '(현병찬, 명노근)' && out.nested.s === '3, 4동', '객체·배열 안의 모든 글자가 정리된다');
ok(out.n === 5 && out.t === true && out.z === null && out.u === undefined && out.arr[1].k === 3, '숫자·참/거짓·null·undefined 는 그대로');
ok(out.d === src.d, '날짜 같은 객체는 그대로(같은 값)'); ok(src.a === 'Ｐ４ｐｈ' && src.nested.s === '３、 ４동', '받은 원본은 바꾸지 않는다(새 값을 돌려줌)');
ok(Object.keys(halfwidthDeep({ 'Ｐ４': 'x' }))[0] === 'Ｐ４', '키 이름은 건드리지 않는다');
// 2) 공사일보 저장 형식
let toStored = null; try { ({ toStored } = await load('modules/pjt/report.js')); } catch (e) { console.log('불러오기 실패 report.js: ' + e.message.slice(0, 80)); }
ok(typeof toStored === 'function', 'report.js 를 불러올 수 있다');
if (toStored) { const d = toStored({ author: '정다애', content: 'Ｒｅｔｒｏｆｉｔ 신규\n１３：００～１７：００ ＴＢＭ', tomorrow: 'ｐｈ２ ｆｉｚ、 ＦＣＵ', note: '（본검측）', headcount: '4', manday: '1' }, { dateKey: '2026-11-03', site: 'P4' });
  ok(d.content === 'Retrofit 신규\n13:00~17:00 TBM', '공사일보 금일 작업이 보통 문자로 저장된다'); ok(d.tomorrow === 'ph2 fiz, FCU', '공사일보 명일 작업이 보통 문자로 저장된다'); ok(d.note === '(본검측)', '공사일보 특이사항이 보통 문자로 저장된다');
  ok(d.headcount === 4 && d.date === '2026-11-03' && d.fmt != null, '숫자·날짜·형식 필드는 그대로'); }
// 3) 수기 전표
let manualEntry = null; try { ({ manualEntry } = await load('modules/finance/logic.js')); } catch (e) { console.log('불러오기 실패 finance/logic.js: ' + e.message.slice(0, 80)); }
ok(typeof manualEntry === 'function', 'finance/logic.js 를 불러올 수 있다');
if (manualEntry) { const r = manualEntry('2026-11-03', '지방세입금１건 （정정）', [{ account: '5330', side: 'D', amount: '1,000', partner: '주식회사\u3000도영비엠씨' }, { account: '1020', side: 'C', amount: '1,000', partner: '' }]);
  ok(r.entry.memo === '지방세입금1건 (정정)', '수기 전표 메모가 보통 문자로 저장된다'); ok(r.entry.lines[0].partner === '주식회사 도영비엠씨', '수기 전표 거래처가 보통 문자(보통 공백)로 저장된다'); ok(r.entry.lines[0].amount === 1000, '금액 처리는 그대로'); }
// 4) 업무일지(전자결재 문서) — 2026-11-03 실제로 결재 완료된 윤석원 업무일지의 붙여넣기 문구
let buildDocData = null; try { ({ buildDocData } = await load('modules/edoc/compose.js')); } catch (e) { console.log('불러오기 실패 compose.js: ' + e.message.slice(0, 80)); }
ok(typeof buildDocData === 'function', 'compose.js 를 불러올 수 있다');
if (buildDocData) { const d = buildDocData('daily', { date: '2026-11-03', pjtId: 'common', todayWork: 'ｐｈ２ ｆｉｚ、 Ｘ。Ｏ。Ｂ、 복합３동、 ４동 ＦＣＵ 완성 검사 （본검측）', tomorrowWork: 'Ｒｅｔｒｏｆｉｔ 신규\n１３：００～１７：００ Ｒｅｔｒｏｆｉｔ ＴＢＭ 리더교육', issue: '지연：없음' }, { uid: 'u1', name: '윤석원' }, { projects: [] });
  ok(d.todayWork === 'ph2 fiz, X.O.B, 복합3동, 4동 FCU 완성 검사 (본검측)', '업무일지 금일 업무가 보통 문자로 저장된다'); ok(d.tomorrowWork === 'Retrofit 신규\n13:00~17:00 Retrofit TBM 리더교육', '업무일지 명일 계획이 보통 문자로 저장된다(줄바꿈 유지)'); ok(d.issue === '지연:없음', '업무일지 이슈가 보통 문자로 저장된다');
  ok(d.authorName === '윤석원' && d.authorUid === 'u1' && d.date === '2026-11-03', '작성자·날짜 등 다른 필드는 그대로'); }
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
