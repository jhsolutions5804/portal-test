// 급여명세서 엑셀 → 임금대장 소급 행 파서. 실제 .xlsx(가짜 데이터)를 앱의 readXlsx 로 읽어 끝까지 통과시킨다.
import fs from 'node:fs';
import { readXlsx } from '../app/shared/xlsx-read.js';
import { parseWageWorkbook, toNum, toIsoDate, ymFromFileName, ymFromPayDate } from '../app/shared/wage-sheet-parser.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const load = async (f) => parseWageWorkbook(await readXlsx(fs.readFileSync('tests/fixtures/wage/' + f)), f);
const R24 = await load('테크명세서양식(24.11).xlsx'), R26 = await load('테크명세서양식(26.06).xlsx');

// ── 2024-11 양식(계산란 없음)
ok(R24.ym === '2024-11' && R24.ymSource === '파일 이름' && R24.warnings.length === 0, '귀속월은 파일 이름 "(24.11)"에서 2024-11, 지급일(2024-12-31)의 전월과 일치해 경고 없음');
ok(R24.rows.length === 3 && R24.skipped.length === 1 && /사원명 없음/.test(R24.skipped[0].reason), '직원 3명을 읽고, #VALUE! 가 든 빈 양식 시트("이름")는 건너뜀');
const a = R24.rows.find((x) => x.name === '가나다');
ok(a.payTotal === 3714433 && a.dedTotal === 621200 && a.net === 3093226 && a.pay['기본급(제수당포함)'] === 2100000 && a.pay['야간근로수당'] === 614433 && a.ded['건강보험'] === 74440 && a.ded['고용보험'] === 18900 && a.ded['기숙사비용'] === 256900, '항목별 금액이 라벨 그대로 들어감(PDF 에서 틀렸던 건강보험·고용보험 배정이 엑셀에서는 정확)');
ok(a.birth === '1985-08-30' && a.hireDate === '2024-10-01' && a.payDate === '2024-12-31' && a.rank === '과장', '날짜 정규화: "85/08/30"→1985-08-30, 지급일 "2024년 12월 31일"→2024-12-31');
ok(R24.rows.every((x) => x.ok), '세 명 모두 검산 통과(지급 합·공제 합·실지급=지급−공제, 실지급은 1원 단위 절삭 오차 7원 허용)');
ok(Object.keys(a.calc).length === 0, '계산란이 없는 양식은 근로시간 정보를 비워 둠(추정하지 않음)');
// ── 2026-06 양식(계산란 있음)
ok(R26.ym === '2026-06' && R26.rows.length === 2 && R26.skipped.some((s) => s.sheet === '요약'), '2026-06: 직원 2명, "요약" 시트는 건너뜀');
const b = R26.rows.find((x) => x.name === '가나다');
ok(b.calc.workDays === 21 && b.calc.overtimeHours === 42 && b.calc.hourlyWage === 13397 && b.calc.contractAnnual === 48000000 && b.calc.specialHours === 8, '계산란에서 근무일·초과근로시간·통상시급·계약연봉·특근시간을 읽음("5월 근무일" 같은 라벨은 끝이 "근무일"이면 인식)');
ok(b.hireDate === '2026-07-31', '엑셀 일련번호(46234)로 저장된 입사일도 날짜(2026-07-31)로 변환: ' + b.hireDate);
ok(b.pay['성과급'] === 200000 && b.pay['초과근로수당'] === 0 && b.pay['특근수당'] === undefined && !('식대2' in b.pay), '새 양식 항목(성과급)은 라벨 그대로 보존하고, 0원이라고 적힌 칸(초과근로수당)은 0으로 남기며 값이 비어 있는 칸(특근수당)은 항목을 만들지 않음');
const c = R26.rows.find((x) => x.name === '라마바'); ok(c.ded['범양소득세+4대보험'] === 77700 && c.ok, '새 공제 항목명(범양소득세+4대보험)도 라벨 그대로 보존, 검산 통과');
// ── 회귀: 공제 칸이 비어 있고 같은 줄 오른쪽에 계산란 숫자가 있을 때, 계산란 숫자를 공제 금액으로 잘못 읽으면 안 된다
{ const d = R26.rows.find((x) => x.name === '가나다');
  ok(d.ded['범양임금지급'] === undefined && d.ded['범양소득세+4대보험'] === undefined, '★ 회귀: 값이 빈 공제 칸(범양임금지급·범양소득세+4대보험)은 항목을 만들지 않음 — 같은 줄의 계산란(초과근무수당 844,000·특근 시간 8)을 공제 금액으로 읽으면 안 됨');
  ok(d.ded['대출금/가불금'] === undefined && d.checks.ded === true && d.dedTotal === 211630, '★ 회귀: 공제 항목 합(211,630)이 공제합계와 일치 — 계산란 숫자가 섞이면 검산이 깨짐'); }
// ── 개인정보
const json = JSON.stringify([R24, R26]); ok(!/국민\/0000|하나\/1111|기업\/2222|하나\/3333|신한\/4444/.test(json) && !('account' in a), '★ 계좌번호는 결과 어디에도 나오지 않음(임금대장에 불필요)');
// ── 변조: 합계가 틀리면 잡아낸다
{ const book = await readXlsx(fs.readFileSync('tests/fixtures/wage/테크명세서양식(24.11).xlsx'));
  const sh = book.sheets.find((s) => s.name === '가나다'); const row = sh.rows.findIndex((r) => r.some((v) => String(v).replace(/\s+/g, '') === '지급합계'));
  const col = sh.rows[row].findIndex((v) => toNum(v) === 3714433); sh.rows[row][col] = 3714434;
  const t = parseWageWorkbook(book, '테크명세서양식(24.11).xlsx').rows.find((x) => x.name === '가나다'); ok(t.checks.pay === false && t.ok === false, '★ 변조(지급합계 1원 차이)는 검산 실패로 잡힘 — 저장 단계에서 차단할 근거');
  const book2 = await readXlsx(fs.readFileSync('tests/fixtures/wage/테크명세서양식(24.11).xlsx')); const sh2 = book2.sheets.find((s) => s.name === '라마바'); const r2 = sh2.rows.findIndex((r) => r.some((v) => String(v).replace(/\s+/g, '') === '실지급액')); const c2 = sh2.rows[r2].findIndex((v) => toNum(v) != null); sh2.rows[r2][c2] = toNum(sh2.rows[r2][c2]) + 5000;
  const t2 = parseWageWorkbook(book2, '테크명세서양식(24.11).xlsx').rows.find((x) => x.name === '라마바'); ok(t2.checks.net === false && t2.ok === false, '★ 변조(실지급액 5,000원 차이)도 잡힘 — 허용 오차는 10원까지'); }
// ── 귀속월 불일치 경고
{ const w = parseWageWorkbook(await readXlsx(fs.readFileSync('tests/fixtures/wage/테크명세서양식(24.11).xlsx')), '테크명세서양식(24.10).xlsx'); ok(w.ym === '2024-10' && w.warnings.some((x) => /다릅니다/.test(x)), '파일 이름을 24.10 으로 바꾸면 지급일 기준 귀속월(2024-11)과 어긋난다고 경고');
  const n = parseWageWorkbook(await readXlsx(fs.readFileSync('tests/fixtures/wage/테크명세서양식(24.11).xlsx')), 'temp.xlsx'); ok(n.ym === '2024-11' && n.ymSource === '지급일', '파일 이름에 월이 없으면 지급일(익월 말일)의 전월로 판정'); }
// ── 값 변환
ok(toNum(' 2,100,000 ') === 2100000 && toNum('₩1,000') === 1000 && toNum('#VALUE!') === null && toNum('') === null && toNum(3.5) === 3.5, '숫자 변환: 쉼표·₩·공백 허용, #VALUE!·빈칸은 null');
ok(toIsoDate(46234) === '2026-07-31' && toIsoDate('85/08/30') === '1985-08-30' && toIsoDate('05/01/02') === '2005-01-02' && toIsoDate('가나다') === '', '날짜 변환: 일련번호·두 자리 연도(30 초과는 19xx)·글자는 빈 값');
ok(ymFromFileName('테크명세서양식(26.06).xlsx') === '2026-06' && ymFromFileName('24년 11월 급여명세서') === '2024-11' && ymFromPayDate('2026-01-31') === '2025-12', '귀속월: 파일 이름 두 형식, 지급일이 1월이면 전년 12월');
ok(parseWageWorkbook({ sheets: [] }, 'x').warnings.length >= 2 && parseWageWorkbook(null).rows.length === 0, '빈 파일·null 도 예외 없이 경고로 처리');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
