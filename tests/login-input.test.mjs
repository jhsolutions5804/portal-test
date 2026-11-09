// 2026-11-09 로그인 입력 보강(대기열 2-1-15) — 폰에서 자동 대문자·확대·비밀번호 확인 불편을 줄이는 속성·스타일이 있는지(소스 확인)
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const sh = readFileSync(new URL('../app/core/shell.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/theme/shell.css', import.meta.url), 'utf8');
const idTag = (sh.match(/<input class="jh-input" id="jh-id"[^>]*>/) || [''])[0];
const pwTag = (sh.match(/<input class="jh-input" id="jh-pw"[^>]*>/) || [''])[0];
ok(idTag.includes('autocomplete="username"') && idTag.includes('autocapitalize="none"') && idTag.includes('autocorrect="off"') && idTag.includes('spellcheck="false"') && idTag.includes('enterkeyhint="next"'), '아이디 칸: 자동 대문자·자동 고침·맞춤법 끔, 키보드 「다음」, 저장된 아이디 자동완성 유지');
ok(pwTag.includes('autocomplete="current-password"') && pwTag.includes('autocapitalize="none"') && pwTag.includes('enterkeyhint="go"') && pwTag.includes('type="password"'), '비밀번호 칸: 자동 대문자 끔, 키보드 「이동」, 저장된 비밀번호 자동완성 유지, 기본은 가림');
ok(sh.includes('data-pw-toggle') && sh.includes("pwBox.type = show ? 'text' : 'password'") && sh.includes("aria-pressed"), '비밀번호 「보기」 버튼: 누르면 보이고 다시 누르면 가려지며 상태를 알려 준다');
ok(sh.includes('pwBox.focus(); pwBox.select();') && sh.includes("pwBox.type = 'password'"), '로그인 실패하면 비밀번호를 다시 가리고 그 칸으로 돌아가 바로 다시 입력');
ok(sh.includes("jh_login_tab") && sh.includes("select(1, false)") && /try \{ localStorage\.setItem/.test(sh) && /try \{ if \(localStorage\.getItem/.test(sh), '마지막에 쓴 로그인 탭을 기억하고, 저장이 막힌 브라우저에서도 오류 없이 기본 탭');
ok(/\.jh-login \.jh-input \{[^}]*font-size: max\(16px/.test(css) && css.includes('.jh-login__pwbtn'), '로그인 입력칸 글자는 16px 이상(폰 사파리 확대 방지), 보기 버튼 스타일');
ok(/\.jh-login__tab \{ word-break: keep-all/.test(css), '로그인 탭 이름은 글자 중간이 아니라 띄어쓰기에서만 줄바꿈');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
