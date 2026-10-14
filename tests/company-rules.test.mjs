import { rulesHtml } from '../app/modules/company/view.js';
import { sortPolicies } from '../app/modules/company/logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const pol = [{ id: 'a', title: '취업규칙', order: 1, markdown: '# 취업규칙\n\n제1조 목적' }, { id: 'b', title: '급여관리내규', order: 2, markdown: '# 급여관리내규\n\n본문 B' }];
const ha = rulesHtml(pol, 'a'), hb = rulesHtml(pol, 'b'), h0 = rulesHtml(pol, '');
ok(ha.includes('취업규칙') && ha.includes('제1조 목적') && !ha.includes('본문 B') && hb.includes('본문 B') && !hb.includes('제1조') && h0.includes('제1조 목적') && rulesHtml(pol, 'zzz').includes('제1조 목적'), '★ 규정 화면은 고른 문서 하나만(문서를 안 고르거나 모르는 값이면 첫 문서)');
ok(!ha.includes('jh-company__ruletabs') && !ha.includes('role="tablist"') && !ha.includes('?doc='), '★ 규정 화면 안의 문서 탭 줄은 없어짐 — 문서 선택은 사이드바의 규정 묶음이 맡음');
ok(rulesHtml([], '').includes('등록된 규정이 없습니다') && JSON.stringify(sortPolicies([{ id: 'x', title: 'ㄴ', order: 2 }, { id: 'y', title: 'ㄱ', order: 1 }, { id: 'z', title: 'ㄷ' }]).map((p) => p.id)) === '["y","x","z"]', '규정이 없으면 안내, 목록 순서는 order 순(없으면 맨 뒤) — 사이드바 항목 순서와 같은 규칙');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
