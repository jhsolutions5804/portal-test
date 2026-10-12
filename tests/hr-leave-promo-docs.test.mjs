/* 연차사용촉진 통보서 양식 시험 — 구포털 원본 블록(tests/fixtures/leave_promo_block_original.js)을 실행한 출력과 그대로 옮긴 모듈의 출력이 글자 하나까지 같은지 비교한다. */
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
import * as M from '../app/modules/hr/leave-promo-docs.js';
const here = path.dirname(fileURLToPath(import.meta.url)); const code = fs.readFileSync(path.join(here, 'fixtures/leave_promo_block_original.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const SIGS = { kjh: 'data:image/png;base64,KJHSIGN' }; const ctx = vm.createContext({ String, Date, isNaN, Math, JSON, Number, Array, Object, _compSignatures: SIGS }); vm.runInContext(code, ctx); M.configureLeavePromoDocs({ signatures: SIGS });
const orig = (expr, v) => { ctx.__v = v; return vm.runInContext(expr, ctx); };
const base = { workerName: '김가나 <b>', dept: '사업본부', rank: '대리', empNo: '25002', noticeDate: '2026-07-01', grantDays: 15, usedDays: 4.5, unusedDays: 10.5, periodStart: '2026-01-01', periodEnd: '2026-12-31', tplVer: 'l1' };
const recs = []; for (const category of ['y0', 'y1']) for (const stage of ['p1', 'p1x', 'p2']) { recs.push(Object.assign({}, base, { category, stage, periodStart: category === 'y0' ? '2025-10-15' : '2026-01-01', periodEnd: category === 'y0' ? '2026-10-14' : '2026-12-31', designatedDates: stage === 'p2' ? ['2026-11-10', '2026-11-11', '2026-11-14'] : [], priorReplyDates: stage === 'p2' ? ['2026-10-01'] : [], p1NoticeDate: stage === 'p2' ? '2026-07-01' : '' }));
  if (stage === 'p2') recs.push(Object.assign({}, recs[recs.length - 1], { priorReplyDates: [], p1NoticeDate: '', designatedDates: [] })); }
recs.push(Object.assign({}, base, { category: 'y1', stage: 'p1', tplVer: 'zzz', workerName: '', dept: '', rank: '' }), Object.assign({}, base, { category: 'y1', stage: 'p1', noticeDate: '' }));
let same = 0; const diffs = []; recs.forEach((r, i) => { const a = orig('leavePromoHtmlByVer(__v)', r), b = M.leavePromoHtmlByVer(r); if (a === b) same++; else diffs.push('#' + i + ' ' + r.category + '/' + r.stage); });
ok(same === recs.length && recs.length === 10 && diffs.length === 0, '★ 촉진서 양식(l1) 원본과 모듈의 출력이 글자 하나까지 같음: 구간 2종(최초 1년·회계연도) × 1차·추가 1차·2차(회신 일수 있음/없음) + 알 수 없는 양식 버전·빈 값 = ' + recs.length + '건 ' + (diffs.length ? '(다른 것: ' + diffs.join(', ') + ')' : ''));
const dates = ['2026-01-31', '2026-02-28', '2026-03-31', '2024-02-29', '2026-12-31', '2026-10-15', '2026-07-01'];
let helperSame = true; for (const d of dates) { const q = '"' + d + '"';
  for (const m of [1, 9, 10, 11]) helperSame = helperSame && orig('_hzYmd(_hzAddMonths(_hzParse(' + q + '), ' + m + '))', null) === M._hzYmd(M._hzAddMonths(M._hzParse(d), m));
  for (const n of [10, 5, -1, -10]) helperSame = helperSame && orig('_hzYmd(_hzAddDays(_hzParse(' + q + '), ' + n + '))', null) === M._hzYmd(M._hzAddDays(M._hzParse(d), n));
  helperSame = helperSame && orig('_hzKor(' + q + ')', null) === M._hzKor(d) && orig('_hzDot(' + q + ')', null) === M._hzDot(d) && orig('_hzDow(_hzParse(' + q + '))', null) === M._hzDow(M._hzParse(d)) && orig('_hzDiffDays(_hzParse("2026-07-01"), _hzParse(' + q + '))', null) === M._hzDiffDays(M._hzParse('2026-07-01'), M._hzParse(d)); }
ok(helperSame && M._hzParse('2026-02-30') instanceof Date && M._hzParse('') === null && M._hzKor('') === '____년 __월 __일' && M._hzDot(null) === '-' && M._hzYmd(M._hzAddMonths(M._hzParse('2026-01-31'), 1)) === '2026-02-28', '날짜 도우미(월·일 더하기, 한글·점 표기, 요일, 일수 차이)도 원본과 같은 값 — 1/31 + 1개월 같은 말일 처리 포함, 빈 값 처리(원본 도우미는 2월 30일 같은 날짜를 다음 달로 넘겨 읽음 — 입력 검사는 새 화면 쪽에서)');
const p1 = recs.find((x) => x.stage === 'p1' && x.category === 'y1'), p2 = recs.find((x) => x.stage === 'p2' && x.category === 'y1' && x.designatedDates.length), px = recs.find((x) => x.stage === 'p1x');
const hp1 = M.leavePromoHtmlByVer(p1), hp2 = M.leavePromoHtmlByVer(p2), hpx = M.leavePromoHtmlByVer(px);
ok(hp1.includes('연차 유급휴가 사용 촉진 통보서 (1차)') && hp2.includes('연차 유급휴가 사용 시기 지정 통보서 (2차)') && hpx.includes('(추가 1차)') && hp1.includes('김가나 &lt;b&gt;') && !hp1.includes('김가나 <b>') && hp1.includes('KJHSIGN') && hp2.includes('2026.11.10') && hp1.includes('회신란') && !hp2.includes('회신란') && hp2.includes('수령 확인'), '1차·추가 1차·2차 제목, 근로자 이름 이스케이프, 직인 반영, 1차에는 회신란·2차에는 지정 사용일');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
