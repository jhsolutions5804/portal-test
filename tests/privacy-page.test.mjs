// 개인정보 처리방침 공개 페이지 시험(2026-11-03 시행) — 로그인 없이 열리는 privacy.html 의 필수 내용과, 로그인 화면의 링크를 점검한다.
// 초안의 「[확인]」 표시가 공개 페이지에 섞이거나, 필수 조항·시행일·보호책임자 연락처가 빠지거나, 로그인 링크가 사라지는 사고를 막는다. ROOT 로 다른 저장소 루트(본섭)를 점검할 수 있다.
import fs from 'node:fs'; import path from 'node:path';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const ROOT = process.env.ROOT || path.resolve(new URL('../', import.meta.url).pathname);
const html = fs.existsSync(path.join(ROOT, 'privacy.html')) ? fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8') : '';
ok(html.length > 3000, 'privacy.html 이 저장소 루트에 있다(로그인 없이 열리는 공개 파일)');
const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
// 1) 필수 조항
const HEADS = ['제1조 처리 목적과 항목', '제2조 보유·이용 기간', '제3조 제3자 제공', '제4조 처리 위탁', '제5조 국외 이전', '제6조 파기 절차와 방법', '제7조 정보주체의 권리와 행사 방법', '제8조 안전성 확보조치', '제9조 자동 수집 장치', '제10조 개인정보 보호책임자와 권익침해 구제', '제11조 방침의 변경'];
const h2 = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1].trim());
for (const hd of HEADS) ok(h2.includes(hd), '조항 제목 「' + hd + '」 이 있다');
for (const k of ['처리 목적과 항목', '보유·이용 기간', '제3자 제공', '처리 위탁', '국외 이전', '파기', '정보주체의 권리', '안전성 확보조치', '자동 수집 장치', '개인정보 보호책임자', '방침의 변경']) ok(text.includes(k), '「' + k + '」 내용이 있다');
// 2) 확정 사실
ok(/시행일 2026년 11월 3일/.test(text) && /이 방침은 2026년 11월 3일부터 시행합니다/.test(text) && /<td>2026-11-03<\/td><td>2026-11-03<\/td>/.test(html), '시행일 2026-11-03 이 첫머리·제11조·개정 이력에 모두 같게 적혀 있다');
ok(text.includes('대표자 김종화') && text.includes('개인정보 보호책임자: 김종화'), '대표자와 개인정보 보호책임자(김종화)가 적혀 있다');
ok(/jh\.kim@jhsol\.kr/.test(html) && /mailto:jh\.kim@jhsol\.kr/.test(html), '공개 연락처는 이메일이고 링크로 걸려 있다');
ok(!/010-\d{3,4}-\d{4}/.test(html), '개인 휴대폰 번호가 들어 있지 않다');
ok(text.includes('채용 확정 후 90일') && text.includes('14일 이내 반환'), '채용 서류 보관기간(확정 후 90일·14일 이내 반환)이 홈페이지 안내문과 같다');
ok(text.includes('383-09-02847') && text.includes('경기도 평택시 고덕중앙로 320'), '처리자 사업자번호와 주소가 적혀 있다');
for (const n of ['118', '1833-6972', '1301', '182']) ok(text.includes(n), '권익침해 신고기관 번호 ' + n + ' 이 적혀 있다');
// 3) 공개 페이지에 있으면 안 되는 것
ok(!/\[확인/.test(html) && !/확인:/.test(html), '초안의 「[확인…]」 표시가 섞여 있지 않다');
ok(!/춘식이|(?<!기)초안|질문 ①|노무사 확인|검토 중/.test(text), '내부 작업 문구(초안·노무사 확인·질문 번호)가 없다');
ok(!/noindex/i.test(html), '검색 제외(noindex) 표시가 없다(공개 방침이므로)');
ok(!/<script[\s>]/i.test(html) && !/<link[^>]+rel=["']stylesheet/i.test(html), '외부 스크립트·스타일에 기대지 않는다(단독으로 열림)');
ok(/<html lang="ko">/.test(html) && /name="viewport"/.test(html), '한국어 문서이고 모바일 화면 설정이 있다');
ok(/prefers-color-scheme: dark/.test(html), '어두운 화면에서도 읽힌다');
// 4) 로그인 화면 링크
const shell = fs.readFileSync(path.join(ROOT, 'app/core/shell.js'), 'utf8'); const css = fs.readFileSync(path.join(ROOT, 'app/theme/shell.css'), 'utf8');
ok(/href="\.\.\/privacy\.html"/.test(shell) && shell.includes('개인정보 처리방침'), '로그인 화면에 처리방침 링크가 있다(앱 주소 기준 ../privacy.html — 테섭·본섭 모두 맞음)');
ok(/jh-login__legal/.test(shell) && /\.jh-login__legal\s*\{/.test(css) && /\.jh-login__legal a\s*\{/.test(css), '로그인 화면 링크의 스타일(칸과 링크)이 정의돼 있다');
ok(/target="_blank"[^>]*rel="noopener"/.test(shell.slice(shell.indexOf('jh-login__legal'), shell.indexOf('jh-login__legal') + 220)), '링크는 새 창으로 열리고 rel=noopener 이다(로그인 화면을 떠나지 않음)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
