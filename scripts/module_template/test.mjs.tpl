// 실행: node tests/__ID__.test.mjs  — 순수 규칙(logic.js)만 시험한다. 화면은 실제 브라우저 시험으로 따로 확인한다.
import { sampleSummary } from '../app/modules/__ID__/logic.js';
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FAIL', m); } else console.log('OK  ', m); };
ok(sampleSummary([]) === '항목이 없습니다.' && sampleSummary(null) === '항목이 없습니다.', '빈 목록·빈 입력 안내');
ok(sampleSummary([{}, {}]) === '항목 2건', '건수 요약');
console.log(fail ? '\n실패 ' + fail + '/' + n : '\n전부 통과 (' + n + '건)'); process.exit(fail ? 1 : 0);
