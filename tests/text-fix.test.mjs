// 전각 문자 정리 시험 — 2026-11-03 PJT 일정 3건(Ｐ４ｐｈ 복합３、 ４동 … （현병찬、 명노근）)에서 나온 문제의 재발 방지.
// 순수 함수 toHalfwidth 와, 일정을 만드는 두 곳(공용 buildScheduleDoc · PJT buildDoc)이 입력을 보통 문자로 저장하는지 본다. APP_DIR 로 다른 앱 폴더를 점검할 수 있다(변이 시험용).
import path from 'node:path'; import { pathToFileURL } from 'node:url';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const APP = process.env.APP_DIR || path.resolve(new URL('../app/', import.meta.url).pathname);
const load = (rel) => import(pathToFileURL(path.join(APP, rel)).href);
const { toHalfwidth } = await load('shared/text-fix.js');
const { buildScheduleDoc } = await load('shared/schedule-logic.js');
const { buildDoc } = await load('modules/pjt/schedule.js');
// 1) 실제 데이터 그대로
const REAL = [['Ｐ４ｐｈ 복합３、 ４동 ｆｉｚ ＦＣＵ 통신검사 （현병찬、 명노근）', 'P4ph 복합3, 4동 fiz FCU 통신검사 (현병찬, 명노근)'], ['Ｐ４ｐｈ２복합 ３、 ４동 ｆｉｚ', 'P4ph2복합 3, 4동 fiz'], ['ＰＣＭ 회의 （Ｐ５ｐｈ１ 유재현프로）', 'PCM 회의 (P5ph1 유재현프로)'], ['ＰＣＭ회의 （유재현프로）', 'PCM회의 (유재현프로)']];
for (const [a, b] of REAL) ok(toHalfwidth(a) === b, '실제 일정 문구: ' + a.slice(0, 18) + '… → ' + b.slice(0, 18) + '…');
// 2) 전각 영문·숫자·기호 범위 전체(U+FF01~FF5E)는 같은 보통 문자로
let rangeOk = true; for (let n = 0xFF01; n <= 0xFF5E; n++) if (toHalfwidth(String.fromCharCode(n)) !== String.fromCharCode(n - 0xFEE0)) rangeOk = false;
ok(rangeOk, '전각 U+FF01~FF5E 94자가 모두 같은 보통 문자로 바뀐다');
ok(toHalfwidth('가\u3000나') === '가 나', '전각 공백(U+3000)은 보통 공백으로'); ok(toHalfwidth('a、b。c') === 'a,b.c', '、 는 쉼표, 。 는 마침표로');
// 3) 바꾸면 안 되는 것은 그대로(NFKC 를 쓰지 않는 이유)
for (const s of ['한글 일정 제목', '㈜제이에이치솔루션', '①②③ 1순위', '漢字 テスト カタカナ', 'ｱｲｳ ﾊﾟｽ', 'P4 Ph2 (FAB) 복합동', '2026-11-05 08:30', '＄100'.replace('＄', '$')]) ok(toHalfwidth(s) === s, '그대로 둔다: ' + s);
ok(toHalfwidth(null) === '' && toHalfwidth(undefined) === '' && toHalfwidth(5) === '5', '비어 있거나 숫자 입력도 안전하다');
const once = toHalfwidth(REAL[0][0]); ok(toHalfwidth(once) === once, '두 번 적용해도 결과가 같다');
// 4) 일정을 만드는 두 곳이 실제로 적용한다
const cfg = { tags: [['work', '업무']], defaultTag: 'work' };
const a = buildScheduleDoc({ text: 'ＰＣＭ 회의 （Ｐ５ｐｈ１）', sdate: '2026-11-17', place: 'Ｐ４ｐｈ２복합 ３、 ４동', memo: '참석：유재현프로' }, cfg, { uid: 'u', name: '시험' });
ok(a.doc && a.doc.text === 'PCM 회의 (P5ph1)', '공용 일정: 제목이 보통 문자로 저장된다'); ok(a.doc && a.doc.place === 'P4ph2복합 3, 4동', '공용 일정: 장소가 보통 문자로 저장된다'); ok(a.doc && a.doc.memo === '참석:유재현프로', '공용 일정: 메모가 보통 문자로 저장된다');
const b = buildDoc({ reg: '김종화', text: 'Ｐ４ｐｈ 복합３、 ４동 ｆｉｚ ＦＣＵ 통신검사 （현병찬、 명노근）', place: 'Ｐ４ｐｈ２복합 ３、 ４동 ｆｉｚ', att: '현병찬、 명노근', sdate: '2026-11-05', sh: '08', sm: '30', eh: '10', em: '00', tag: 'admin' }, { today: '2026-11-05' });
ok(b.data && b.data.text === 'P4ph 복합3, 4동 fiz FCU 통신검사 (현병찬, 명노근)', 'PJT 일정: 제목이 보통 문자로 저장된다'); ok(b.data && b.data.place === 'P4ph2복합 3, 4동 fiz', 'PJT 일정: 장소가 보통 문자로 저장된다'); ok(b.data && b.data.att === '현병찬, 명노근', 'PJT 일정: 참석자가 보통 문자로 저장된다');
const c = buildScheduleDoc({ text: '＿'.repeat(101).replace(/＿/g, 'ａ'), sdate: '2026-11-17' }, cfg, {}); ok(!!c.error, '길이 제한(100자)은 변환 뒤에도 그대로 적용된다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
