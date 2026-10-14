import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const css = (n) => fs.readFileSync(new URL('../app/theme/' + n, import.meta.url), 'utf8');
const X = 'calc(var(--sp-4) + var(--sp-1))';   // 카드 좌우 여백 20px, 위아래 16px
const rule = (src, sel) => { const i = src.indexOf('\n' + sel + ' {') >= 0 ? src.indexOf('\n' + sel + ' {') + 1 : src.indexOf(sel + ' {'); if (i < 0) return ''; return src.slice(i, src.indexOf('}', i) + 1); };
// 카드 본문 안쪽 여백 클래스(모듈마다 따로 있던 것)가 모두 같은 값
const pads = [['finance.css', '.jh-finance__pad'], ['general.css', '.jh-gen__pad'], ['hr.css', '.jh-hr__pad'], ['pjt.css', '.jh-pjt__pad'], ['pjt.css', '.jh-ro__pad'], ['plan.css', '.jh-plan__pad']];
const padVals = pads.map(([f, s]) => (rule(css(f), s).match(/padding: ([^;]+);/) || [])[1]);
ok(padVals.every((v) => v === 'var(--sp-4) ' + X), '★ 카드 본문 안쪽 여백은 모든 모듈이 같은 값(위아래 16px · 좌우 20px): ' + padVals.join(' | '));
ok(pads.filter(([f, s]) => s !== '.jh-ro__pad').every(([f, s]) => /gap: var\(--sp-4\)/.test(rule(css(f), s))), '카드 본문 안 요소 사이 간격도 같은 값(16px)');
const head = rule(css('edoc.css'), '.jh-panel__head'), h3 = rule(css('edoc.css'), '.jh-panel__head h3');
ok(head.includes('padding: var(--sp-4) ' + X) && /font-size: var\(--fs-md\); font-weight: 700;/.test(h3), '★ 카드 머리글: 위아래 16px · 좌우 20px(본문과 같은 왼쪽 선), 제목 글자는 한 단계 크게(md) 굵게');
ok(rule(css('edoc.css'), '.jh-kpi').includes('padding: var(--sp-4) ' + X) && rule(css('edoc.css'), '.jh-kpi').includes('gap: var(--sp-1)'), '요약(KPI) 카드: 같은 안쪽 여백, 라벨·값·설명 사이 간격 4px');
const comp = css('components.css');
ok(/\.jh-card > :is\(\.jh-hr__scroll, \.jh-finance__scroll\) :is\(th, td\):first-child, \.jh-card > \.jh-ro__t :is\(th, td\):first-child \{ padding-left: calc\(var\(--sp-4\) \+ var\(--sp-1\)\); \}/.test(comp) && /:is\(th, td\):last-child[^{]*\{ padding-right: calc\(var\(--sp-4\) \+ var\(--sp-1\)\); \}/.test(comp) && /\.jh-card > \.jh-field__hint \{ padding: var\(--sp-3\) calc\(var\(--sp-4\) \+ var\(--sp-1\)\) var\(--sp-2\); \}/.test(comp), '★ 카드 가장자리에 붙던 표(인사·재무·월간 공수)와 안내 문구는 첫·끝 칸에 20px 여백을 줘서 머리글 제목과 같은 선에 맞춤');
const pj = css('pjt.css'); ok(/\.jh-pjt__ghead \{[^}]*padding: var\(--sp-3\) calc\(var\(--sp-4\) \+ var\(--sp-1\)\)/.test(pj) && /\.jh-pjt__steps \{[^}]*padding: 0 calc\(var\(--sp-4\) \+ var\(--sp-1\)\)/.test(pj), '공정 섹터 카드(머리글 버튼·단계 막대)도 같은 좌우 여백');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
