import { monthlyHtml, reportBodyHtml, yieldView, monthOptions, monthLabel, printHtml, printTitle } from '../app/modules/pjt/monthly-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };

// ── 서버(monthlyReportAct)가 돌려주는 report 와 같은 모양의 시험 자료
const tally = (o) => Object.assign({ installed: 0, inspected: 0, cells: 0, byStage: { 반입: 0, 입고검사: 0 }, total: 183, installRate: 0, inspectRate: 0 }, o);
const REP = (o) => Object.assign({ ym: '2026-08', pjtId: 'p1', pjtLabel: 'P4 Ph2 (FAB)', partial: false, version: 2, generatedMs: 1, generatedByName: '팀장', source: {}, notes: { remarks: '', nextPlan: '', byName: '', atMs: 0 },
  data: { ym: '2026-08', progress: { start: tally({ installed: 41, inspected: 0, installRate: 41 / 183, byStage: { 반입: 55, 입고검사: 51 } }), end: tally({ installed: 86, inspected: 67, installRate: 86 / 183, inspectRate: 67 / 86, byStage: { 반입: 82, 입고검사: 82 } }), delta: { installed: 45, inspected: 67, cells: 305, byStage: { 반입: 27, 입고검사: 31 } }, touched: true, checkDays: 17 },
    manday: { manday: 195, mandayDays: 19, attendDays: 19, avgHeads: 7.5, workers: 12 },
    reports: { from: '2026-08-01', to: '2026-08-31', span: 31, written: 5, missing: 26, attendMissing: 14, remarks: [{ date: '2026-08-03', text: '자재 반입 지연', author: '작성자' }, { date: '2026-08-20', text: '검측 일정 변경', author: '' }], nextPlan: { text: '4층 배관 검사', from: '2026-08-31' }, total: 5 },
    yield: { status: 'ok', installed: 45, manday: 195, value: 45 / 195, per100: 23.1, installRate: 86 / 183 } } }, o || {});
const ST = (o) => Object.assign({ proj: 'p1', label: 'P4 Ph2 (FAB)', loading: false, error: '', months: [{ ym: '2026-08', version: 2, partial: false }, { ym: '2026-07', version: 1, partial: false }], ym: '2026-08', report: REP(), reportLoading: false, canEdit: true, busy: false, msg: '', notesDraft: null, today: '2026-10-17' }, o || {});

// ── 월 선택: 이번 달부터 최근 12개월 + 이미 만든 달(중복 없음, 최신순)
{ const o = monthOptions('2026-10-17', [{ ym: '2026-08' }, { ym: '2025-01' }, { ym: '2026-10' }]);
  ok(o[0] === '2026-10' && o[11] === '2025-11' && o.length === 13 && o[12] === '2025-01', '월 목록: 이번 달부터 12개월(2026-10 ~ 2025-11)에 12개월보다 오래된 만든 달(2025-01)이 뒤에 붙고 중복 없음: ' + o.length + '개');
  ok(monthOptions('2026-01-05', []).slice(0, 3).join() === '2026-01,2025-12,2025-11' && monthOptions('2026-01-05', []).length === 12, '연초에는 작년 12월로 넘어감');
  ok(monthOptions('', []).length === 0 && monthOptions(null, [{ ym: '2026-05' }]).join() === '2026-05' && monthOptions('x', null).length === 0, '오늘 날짜가 이상하면 목록이 비고 만든 달만 남음(오류 없음)');
  ok(monthLabel('2026-08') === '2026년 8월' && monthLabel('2026-12') === '2026년 12월' && monthLabel('x') === '' && monthLabel(null) === '', '월 표시: "2026년 8월"'); }

// ── ★ 수율 표시(설계 §3-1·§4): 숫자가 말이 안 되는 경우는 숫자 대신 사유, 분자·분모는 항상 같이
{ const v = yieldView({ status: 'ok', installed: 45, manday: 195, per100: 23.1 }); ok(v.tone === 'ok' && v.main === '공수 100당 23.1품목' && v.sub === '설치 완료 +45 ÷ 공수 195', '정상: "공수 100당 23.1품목", 분자·분모를 함께 — ' + v.sub);
  const nc = yieldView({ status: 'no-check', installed: 0, manday: 195 }); ok(nc.tone === 'warn' && nc.main === '공정 체크 없음' && nc.sub.includes('입력 누락 가능') && nc.sub.includes('195') && !/\d+\.\d+품목/.test(nc.main), '★ 공수는 있는데 공정 체크가 없으면 숫자 대신 "공정 체크 없음(입력 누락 가능)", 분모(공수)는 보여 줌 — 결정 9');
  const nm = yieldView({ status: 'no-manday', installed: 3, manday: 0 }); ok(nm.main === '공수 입력 없음' && nm.tone === 'warn' && nm.sub.includes('+3'), '공수가 없으면 "공수 입력 없음"(0 나눗셈 방지), 설치 증분은 보여 줌');
  const fin = yieldView({ status: 'finishing', installed: 0, manday: 40, installRate: 0.97 }); ok(fin.main === '마감 단계' && fin.tone === 'info' && fin.sub.includes('97%'), '설치 완료율 95% 이상이면 "마감 단계"(설치 완료율 표시)');
  const nd = yieldView({ status: 'no-data' }); ok(nd.main === '공정 구조 없음' && nd.tone === 'warn', '공정 구조가 없으면 "공정 구조 없음"');
  ok(yieldView(null).main === '공정 구조 없음' && yieldView({}).main === '공정 구조 없음' && yieldView({ status: '이상한값' }).main === '공정 구조 없음' && yieldView({ status: 'ok', per100: null }).main === '공수 100당 0품목', '빈 값·모르는 상태도 오류 없이(숫자가 아니면 0)'); }

// ── 보고서 본문(현장 층): 공정·출역·공수·수율·공사일보·특이사항·다음 달 계획
{ const h = reportBodyHtml(REP());
  ok(h.indexOf('공정') < h.indexOf('출역 · 공수') && h.indexOf('출역 · 공수') < h.indexOf('생산성 수율') && h.indexOf('생산성 수율') < h.indexOf('공사일보 · 특이사항 · 다음 달 계획'), '구역 순서: 공정 → 출역·공수 → 생산성 수율 → 공사일보·특이사항·다음 달 계획');
  ok(h.includes('86 / 183품목') && h.includes('47%') && h.includes('+45품목') && h.includes('67품목') && h.includes('77.9%') && h.includes('이번 달 +27 · +31') && h.includes('누적 82 · 82품목'), '공정: 설치 완료 누적 86/183(47%)·이번 달 +45·시공검측 67(통과율 77.9%)·반입/입고검사는 참고로 월 증분과 누적');
  ok(h.includes('195') && h.includes('공수 입력 19일 · 인원 12명') && h.includes('19일') && h.includes('일평균 7.5명'), '출역·공수: 공수 합 195·공수 입력 19일·인원 12명·출역 19일·일평균 7.5명');
  ok(h.includes('5일 / 31일') && h.includes('26일') && h.includes('휴무·주말·공휴일 포함') && h.includes('출역이 있는데 미작성 14일') && h.includes('세는 기간 08/01 ~ 08/31'), '공사일보: 작성 5일/31일·미작성 26일(달력 전체, 휴무·주말·공휴일 포함)·출역이 있는데 미작성 14일 병기');
  ok(h.includes('자재 반입 지연') && h.includes('검측 일정 변경') && h.includes('08. 03') && h.includes('작성자') && h.indexOf('08. 03') < h.indexOf('08. 20'), '특이사항: 비고가 있는 날을 날짜순으로, 작성자는 있을 때만');
  ok(h.includes('다음 달 계획 (초안)') && h.includes('4층 배관 검사') && h.includes('08. 31 공사일보의 "내일 작업"'), '다음 달 계획 초안: 마지막 "내일 작업"과 그 날짜');
  ok(h.includes('data-tone="ok"') && h.includes('data-tone="warn"'), '지표 타일의 상태 색: 설치 증가·미작성 경고');
  ok(!/amount|price|금액|단가|원가|마진/.test(h.replace(/금액 없음/g, '')), '★ 현장 층 화면에는 금액·원가·마진 같은 경영 층 용어가 없음');
  const none = reportBodyHtml(REP({ data: { progress: null, manday: null, reports: null, yield: { status: 'no-data' } } })); ok(none.includes('공정 구조가 없어 공정을 집계하지 않았습니다') && none.includes('공정 구조 없음') && none.includes('공정'), '공정·공수·일보 자료가 없는 보고서도 오류 없이(안내 문구)');
  const empty = reportBodyHtml(REP({ data: Object.assign({}, REP().data, { reports: { from: '2026-08-01', to: '2026-08-31', span: 31, written: 31, missing: 0, attendMissing: 0, remarks: [], nextPlan: { text: '', from: '' } } }) })); ok(empty.includes('비고가 적힌 날이 없습니다') && empty.includes('"내일 작업"이 적힌 날이 없습니다') && empty.includes('0일'), '비고·내일 작업이 없으면 빈 안내, 미작성 0일은 주의 색 아님');
  ok(reportBodyHtml({}).includes('공정') && reportBodyHtml({ data: {} }).length > 0, '자료가 통째로 비어도 오류 없이 그림'); }

// ── 탭 전체: 상태·월 선택·만들기/다시 만들기·인쇄·부분 보고
{ const h = monthlyHtml(ST());
  ok(h.includes('🏗️ P4 Ph2 (FAB)') && h.includes('월간 보고서') && h.includes('data-mr-ym') && h.includes('<option value="2026-08" selected>2026년 8월 ✓</option>') && h.includes('2026년 7월 ✓') && h.includes('2026년 10월</option>'), '월 선택: 만든 달에는 ✓, 안 만든 달은 표시 없음, 고른 달이 선택됨');
  ok(h.includes('다시 만들기') && !h.includes('>만들기<') && h.includes('data-mr-print') && h.includes('PDF 저장(인쇄)') && h.includes('버전 2') && h.includes('팀장'), '보고서가 있으면 "다시 만들기"·"PDF 저장(인쇄)"·버전·만든 사람');
  const none = monthlyHtml(ST({ report: null, ym: '2026-10' })); ok(none.includes('>만들기<') && !none.includes('다시 만들기') && !none.includes('data-mr-print') && none.includes('2026년 10월 보고서가 아직 없습니다') && none.includes('아직 만들지 않은 달입니다'), '보고서가 없으면 "만들기"만, 인쇄 버튼 없음, 안내 문구');
  ok(monthlyHtml(ST({ report: REP({ partial: true }), months: [{ ym: '2026-08', version: 2, partial: true }] })).includes('중간 보고서(오늘까지)') && monthlyHtml(ST({ months: [{ ym: '2026-08', partial: true }] })).includes('✓ (중간)'), '이번 달은 "중간 보고서(오늘까지)"로 표시하고 월 선택에도 (중간)');
  ok(monthlyHtml(ST({ busy: true })).includes('data-mr-gen disabled') && /data-mr-save[^>]*disabled/.test(monthlyHtml(ST({ busy: true }))), '처리 중에는 만들기·저장 버튼이 비활성(중복 클릭 방지)');
  ok(monthlyHtml(ST({ reportLoading: true, report: null })).includes('aria-busy="true"') && !monthlyHtml(ST({ reportLoading: true, report: null })).includes('아직 없습니다'), '월을 바꾸는 동안에는 불러오는 중(빈 안내를 잘못 보이지 않음)');
  ok(monthlyHtml(ST({ proj: '' })).includes('이 프로젝트를 열 수 없습니다') && monthlyHtml(ST({ loading: true, months: null })).includes('aria-busy') && monthlyHtml(ST({ error: '이 프로젝트의 이력을 볼 권한이 없습니다.', months: null })).includes('role="alert"'), '프로젝트 없음·로딩·목록 오류 상태 화면');
  const soft = monthlyHtml(ST({ error: '일시적인 오류', report: null })); ok(soft.includes('data-tone="warn"') && soft.includes('일시적인 오류') && soft.includes('data-mr-ym') && !soft.includes('data-tone="danger"'), '목록은 있고 보고서 읽기만 실패하면 주의 안내만(월 선택·만들기는 계속 쓸 수 있음)');
  ok(monthlyHtml(ST({ msg: '만들었습니다.' })).includes('만들었습니다.'), '처리 결과 안내 문구'); }

// ── ★ 직접 입력 칸: 권한자만 편집, 나머지는 읽기만, 금액·연락처는 입력하는 중에 안내
{ const ed = monthlyHtml(ST({ canEdit: true, report: REP({ notes: { remarks: '검측 협의 필요', nextPlan: '8월 3주 검측 신청', byName: '팀장' } }) }));
  ok(ed.includes('data-mr-notes="remarks"') && ed.includes('data-mr-notes="nextPlan"') && ed.includes('data-mr-save') && ed.includes('검측 협의 필요') && ed.includes('8월 3주 검측 신청') && ed.includes('다시 만들어도 여기에 적은 내용은 그대로'), '권한자: 두 칸을 고칠 수 있고 저장 버튼, 기존 내용이 채워져 있음, 다시 만들어도 보존된다는 안내');
  const ro = monthlyHtml(ST({ canEdit: false, report: REP({ notes: { remarks: '메모', nextPlan: '계획' } }) })); ok(!ro.includes('data-mr-notes') && !ro.includes('data-mr-save') && ro.includes('메모') && ro.includes('계획') && ro.includes('PJT 권한자·관리자가 적을 수 있습니다'), '일반 참여자: 읽기만(입력칸·저장 없음), 내용은 보임');
  ok(monthlyHtml(ST({ canEdit: false })).includes('직접 입력한 내용이 없습니다'), '일반 참여자 + 내용 없음: 빈 안내');
  const bad = monthlyHtml(ST({ notesDraft: { remarks: '단가 12만원 인상', nextPlan: '' } })); ok(/data-mr-save[^>]*disabled/.test(bad) && bad.includes('금액·단가·전화번호·메일 주소는 적지 않습니다') && !/data-mr-hint hidden/.test(bad), '★ 금액이 든 초안: 저장 비활성 + 안내 표시');
  const ph = monthlyHtml(ST({ notesDraft: { remarks: '', nextPlan: '담당 010-1234-5678' } })); ok(/data-mr-save[^>]*disabled/.test(ph) && ph.includes('전화번호'), '연락처가 든 초안도 저장 비활성');
  const fine = monthlyHtml(ST({ notesDraft: { remarks: 'FCU 183대 반입(1,500대 중 1차)', nextPlan: '검측 신청' } })); ok(!/data-mr-save[^>]*disabled/.test(fine) && /data-mr-hint hidden/.test(fine), '수량·사양은 허용(저장 활성, 안내 숨김)'); }

// ── 안전: 사용자·서버가 준 글자는 HTML 로 해석되지 않음
{ const evil = REP({ pjtLabel: '<img src=x onerror=1>', notes: { remarks: '<script>alert(1)</script>', nextPlan: '"><b>x</b>', byName: '<i>y</i>' }, generatedByName: '<u>z</u>', data: Object.assign({}, REP().data, { reports: { from: '2026-08-01', to: '2026-08-31', span: 31, written: 1, missing: 30, attendMissing: 0, remarks: [{ date: '2026-08-03', text: '<script>alert(2)</script> & "x"', author: '<b>a</b>' }], nextPlan: { text: '<img src=x onerror=3>', from: '2026-08-03' } } }) });
  const h = monthlyHtml(ST({ report: evil, label: '<img src=x onerror=1>' })), p = printHtml(evil, '<img src=x onerror=1>');
  ok(!/<script>alert|<img src=x|<b>x<\/b>|<i>y|<u>z|<b>a/.test(h) && h.includes('&lt;script&gt;alert(2)&lt;/script&gt; &amp; &quot;x&quot;'), '★ 화면: 특이사항·작성자·다음 계획·직접 입력·프로젝트 이름·만든 사람의 꺾쇠·따옴표는 글자로만 표시');
  ok(!/<script>alert|<img src=x|<b>x<\/b>|<i>y|<b>a/.test(p.replace(/<scr\x69pt>window\.onload[\s\S]*?<\/scr\x69pt>/, '')) && p.includes('&lt;script&gt;alert(2)&lt;/script&gt;'), '★ 인쇄 문서도 같음(자동 인쇄 스크립트 하나만 있음)');
  ok(((p.match(/<script>/g) || []).length) === 1, '인쇄 문서의 script 는 자동 인쇄 하나뿐'); }

// ── 인쇄 문서(PDF 저장): 파일 이름 규칙(월 단위: "연월 종류 - 프로젝트")·내용·중간 보고서 표시·수율 사유
{ const r = REP(); ok(printTitle(r, 'P4 Ph2 (FAB)') === '2026-08 월간 보고서 - P4 Ph2 (FAB)', '★ 파일 이름 = 문서 파일 이름 규칙(월 단위): "' + printTitle(r, 'P4 Ph2 (FAB)') + '"');
  ok(printTitle(r, '공사 3,000,000원 건 010-1234-5678').indexOf('010') === -1 && printTitle(r, '공사 3,000,000원').indexOf('원') === -1, '프로젝트 이름에 금액·전화번호가 들어와도 파일 이름에는 남지 않음');
  ok(printTitle(null, '프로젝트') === '월간 보고서 - 프로젝트' && printTitle(r, '') === '2026-08 월간 보고서', '월이 없거나 프로젝트 이름이 없으면 그 칸만 건너뜀');
  const p = printHtml(r, 'P4 Ph2 (FAB)'); ok(p.startsWith('<!doctype html>') && p.includes('<title>2026-08 월간 보고서 - P4 Ph2 (FAB)</title>') && p.includes('window.print()') && p.includes('@page{size:A4'), '인쇄 문서: 제목이 파일 이름·A4·자동 인쇄');
  ok(p.includes('P4 Ph2 (FAB) 월간 보고서') && p.includes('2026년 8월') && p.includes('현장 층(금액 없음)') && p.includes('버전 2') && p.includes('86 / 183품목 (47%)') && p.includes('+45품목') && p.includes('67품목') && p.includes('195 (공수 입력 19일 · 인원 12명)') && p.includes('19일 · 일평균 7.5명') && p.includes('공수 100당 23.1품목') && p.includes('설치 완료 +45 ÷ 공수 195') && p.includes('5일 / 31일') && p.includes('26일 (휴무·주말·공휴일 포함 · 출역이 있는데 미작성 14일)') && p.includes('자재 반입 지연') && p.includes('4층 배관 검사'), '인쇄 문서 내용: 공정·출역·공수·수율(분자·분모)·공사일보 미작성(달력 전체)·특이사항·다음 달 계획');
  ok(printHtml(REP({ partial: true }), 'P').includes('중간 보고서 — 오늘까지'), '이번 달은 "중간 보고서 — 오늘까지"로 표시');
  const nc = printHtml(REP({ data: Object.assign({}, REP().data, { yield: { status: 'no-check', installed: 0, manday: 195 } }) }), 'P'); ok(nc.includes('공정 체크 없음') && nc.includes('입력 누락 가능') && nc.includes('class="warn"'), '인쇄 문서도 공정 체크가 없으면 숫자 대신 사유(주의 색)');
  const nt = printHtml(REP({ notes: { remarks: '검측 협의', nextPlan: '검측 신청', byName: '팀장' } }), 'P'); ok(nt.includes('직접 입력 (보완)') && nt.includes('검측 협의') && nt.includes('검측 신청') && nt.includes('팀장 작성') && !printHtml(r, 'P').includes('직접 입력 (보완)'), '직접 입력이 있을 때만 "직접 입력(보완)" 구역을 인쇄');
  ok(!/amount|price|금액|단가|원가|마진/.test(p.replace(/금액 없음/g, '')), '★ 인쇄 문서(현장 층)에도 금액·원가·마진이 없음');
  ok(printHtml({}, '').includes('월간 보고서') && printHtml({ data: {} }, 'x').length > 100 && !printHtml({ ym: '2026-08', data: { reports: { remarks: [{ text: 't' }], nextPlan: null } } }, 'x').includes('undefined'), '빈 보고서·날짜가 없는 특이사항에도 오류·"undefined" 없이'); }

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
