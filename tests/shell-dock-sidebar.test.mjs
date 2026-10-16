// 셸: 오른쪽 도킹 영역·상단 숨김 버튼·접히는 사이드바 — 마크업과 CSS 의 핵심 조건을 고정한다(실제 동작은 배포 뒤 브라우저에서 측정)
import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'); const shell = read('app/core/shell.js'), css = read('app/theme/shell.css'), boot = read('app/core/boot.js'), idx = read('app/modules/index.js');
// ── 마크업
ok(/class="jh-brand__short"[^>]*>JH<\/span><span class="jh-brand__full">JH Portal<\/span>/.test(shell), '브랜드에 짧은 표시("JH")와 전체 표시("JH Portal")가 따로 있음(접힌 사이드바용)');
ok(/<button type="button" class="jh-dockbtn" id="jh-dock-toggle"[^>]*aria-pressed="false"[^>]*hidden>📁<\/button><div class="jh-userchip">/.test(shell), '상단 도구 영역 맨 앞에 숨김/보임 버튼(처음에는 숨김, 눌림 상태 표시)이 있음');
ok(/<aside class="jh-dock" id="jh-dock" aria-label="자료 패널" hidden><\/aside>'\s*\+\s*'<nav class="jh-tabbar"/.test(shell) && /dock: \{ el: root\.querySelector\('#jh-dock'\), toggle: root\.querySelector\('#jh-dock-toggle'\), app: appEl \}/.test(shell), '오른쪽 도킹 자리가 앱 안(하단 막대 앞)에 있고 renderShell 이 dock 객체(el·toggle·app)를 돌려줌');
// ── 연결
ok(/import \{ MODULES, installShellDocks \} from '\.\.\/modules\/index\.js/.test(boot) && /docsOff = installShellDocks\(shell, me\)/.test(boot) && /if \(docsOff\) \{ docsOff\(\); docsOff = null; \}/.test(boot), '★ 로그인 뒤 셸이 만들어질 때 한 번 설치하고, 다시 로그인·로그아웃 때 이전 것을 정리함(겹쳐 붙지 않음)');
ok(/export function installShellDocks\(shell, me\)/.test(idx) && !/withFiles/.test(idx), '모듈 등록부는 셸 도킹 설치 함수를 내보내고, 화면마다 붙이던 옛 방식(withFiles)은 없음');
// ── CSS: 도킹
ok(/\.jh-dock \{ display: none; \}/.test(css) && /\.jh-dock:not\(\[hidden\]\) \{ display: flex;[^}]*position: fixed; top: 0; right: 0; bottom: 0; width: 26rem;/.test(css) && /min-width: 900px/.test(css.split('.jh-dock:not([hidden])')[0].split('@media').pop()), '도킹 패널은 900px 이상에서만, 오른쪽에 고정(전체 높이·26rem)');
ok(/@media \(min-width: 1500px\) \{ \.jh-app\[data-dock-open\] \.jh-body \{ margin-right: 26rem; \} \}/.test(css), '★ 1500px 이상에서 패널이 열려 있으면 본문 영역이 패널 폭만큼 비켜 겹치지 않음');
ok(/\.jh-dockbtn \{ display: none; \}/.test(css) && /\.jh-dockbtn:not\(\[hidden\]\) \{ display: inline-grid;/.test(css) && /\.jh-dockbtn\[aria-pressed="true"\]/.test(css), '버튼은 기본 숨김이고 보일 때만 표시, 눌림 상태 스타일이 있음(PC 에서 숨겨지는 .jh-iconbtn 과 별개 클래스)');
// ── CSS: 사이드바
const blk = css.slice(css.indexOf('@media (min-width: 900px) and (hover: hover) and (pointer: fine)'));
ok(/\.jh-sidebar__brand \.jh-brand__short \{ display: none; \}/.test(css) && blk.length > 100, '짧은 브랜드는 기본 숨김, 접힘 규칙은 하나의 조건 블록에 모여 있음');
ok(/@media \(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\)/.test(css), '★ 접히는 사이드바는 PC(900px 이상)이고 마우스가 있는 기기에서만 적용 — 터치 기기·좁은 화면은 지금처럼');
ok(/\.jh-app \{ grid-template-columns: var\(--u-64\) minmax\(0, 1fr\); \}/.test(blk) && /\.jh-sidebar \{ width: var\(--u-64\);[^}]*z-index: var\(--z-actionbar\)/.test(blk) && /\.jh-sidebar:is\(:hover, :focus-within\) \{ width: var\(--u-220\); \}/.test(blk), '★ 본문 열은 접힌 폭(64) 기준으로 고정하고, 사이드바는 마우스나 키보드 포커스가 오면 220 으로 펼쳐져 본문 위에 겹침(본문이 밀리지 않음)');
ok(/\.jh-sidebar:not\(:hover\):not\(:focus-within\) :is\(\.jh-nav__label, \.jh-userchip, \.jh-sidebar__foot > \.jh-btn, \.jh-brand__full, \.jh-sidebar__brand \.jh-chip\) \{ display: none; \}/.test(blk) && /\.jh-sidebar:not\(:hover\):not\(:focus-within\) \.jh-brand__short \{ display: inline; \}/.test(blk), '접힌 상태에서는 메뉴 이름·사용자 칩·로그아웃·전체 브랜드를 숨기고 아이콘과 짧은 브랜드만 보임(펼치면 모두 보임)');
ok(/:focus-within/.test(blk), '키보드로 메뉴에 들어가도 펼쳐짐(접근성)');
// ── 사이드바가 펼쳐질 때 본문 전체가 같이 밀리고, 접힐 때 같이 들어온다(:has 지원 브라우저). 지원하지 않으면 위의 겹침 방식이 그대로 쓰인다
const push = css.slice(css.indexOf('@supports selector(:has(*))'));
ok(css.includes('@supports selector(:has(*))') && /@media \(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\)/.test(push), '★ 밀기 방식은 :has 를 지원하고 PC·마우스 기기일 때만 적용(그 밖에는 겹침 방식·기존 동작)');
ok(/\.jh-app:has\(\.jh-sidebar:is\(:hover, :focus-within\)\) \{ grid-template-columns: var\(--u-220\) minmax\(0, 1fr\);/.test(push), '★ 사이드바에 마우스나 포커스가 오면 앱 격자의 첫 열이 64→220 으로 넓어져 본문 전체가 오른쪽으로 같이 밀림');
ok(/\.jh-app \{ transition: grid-template-columns \.16s ease \.12s; \}/.test(push), '열 폭 변화에 전환(0.16초)이 있어 들어올 때도 같이 부드럽게 들어옴(스치기만 한 경우를 위한 짧은 지연 포함)');
ok(/\.jh-sidebar, \.jh-sidebar:is\(:hover, :focus-within\) \{ width: auto; justify-self: stretch; transition: none; overflow-x: hidden; \}/.test(push), '밀기 방식에서는 사이드바 폭을 칸 폭에 맡기고(겹침용 고정 폭 해제) 펼치는 중 글자가 삐져나가지 않게 가림');
// (실제 셸 생성·동작은 가상 브라우저 점검 시나리오 smoke_writes 와 배포 뒤 실제 브라우저 측정으로 확인한다 — 셸이 외부 주소 모듈을 불러와 이 시험 환경에서는 못 만든다)
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
