// 캡스 업로드 × NFC 출퇴근(대기열 1-3-26 "캡스와 만날 때") — 캡스 지문이 같은 날을 덮으면 NFC·버튼이 남긴 "확인 필요" 표시를 해제한다.
import { buildCapsPlan, capsSummaryText } from '../app/modules/hr/caps-import.js';
import { capsInit, capsPanelHtml } from '../app/modules/hr/caps-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = [{ id: 'w1', name: '김가나' }];
const tm = (h, m, next) => ({ hhmm: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'), min: h * 60 + m, next: !!next });
const rec = (date, i, o) => ({ name: '김가나', date, in: i ? tm(i[0], i[1]) : null, out: o ? tm(o[0], o[1]) : null });
const exRec = (o) => Object.assign({ checkIn: '09:00', checkOut: '18:00', breakMinutes: 120, workHours: 7, source: 'nfc', needsReview: true }, o);
const EX = new Map([
  ['w1_2026-11-02', exRec({})],                                              // 시각 다름 + 확인 필요 → 변경(해제)
  ['w1_2026-11-03', exRec({ checkIn: '08:00', checkOut: '17:00' })],        // 시각 같음 + 확인 필요 → 같은 값(해제만)
  ['w1_2026-11-04', exRec({ checkOut: '17:30' })],                           // 캡스는 출근만, 퇴근은 포털 값 → 보충(해제 안 함)
  ['w1_2026-11-05', exRec({ needsReview: false, source: 'clock' })],         // 확인 필요 없음, 시각 다름 → 변경(해제 없음, 덮어쓰는 버튼 기록)
  ['w1_2026-11-06', exRec({ checkIn: '08:00', checkOut: '17:00', needsReview: false })]   // 확인 필요 없음, 시각 같음 → 쓰지 않음
]);
const P = buildCapsPlan({ records: [rec('2026-11-02', [8, 0], [17, 0]), rec('2026-11-03', [8, 0], [17, 0]), rec('2026-11-04', [8, 0], null), rec('2026-11-05', [8, 0], [17, 0]), rec('2026-11-06', [8, 0], [17, 0])], workers: W, existing: EX, from: '2026-11-01', to: '2026-11-30', today: '2026-11-20' });
const it = (d) => P.items.find((i) => i.date === d);
ok(it('2026-11-02').status === '변경' && it('2026-11-02').cleared === true && it('2026-11-02').data.needsReview === false && it('2026-11-02').data.reviewedByName === '캡스 지문' && it('2026-11-02').data.checkIn === '08:00' && it('2026-11-02').data.checkOut === '17:00', '★ 캡스가 시각을 덮는 날: 시각이 캡스 값으로 바뀌고 "확인 필요"가 해제된다(확인자 "캡스 지문")');
ok(it('2026-11-03').status === '동일' && it('2026-11-03').write === true && it('2026-11-03').cleared === true && it('2026-11-03').data.needsReview === false && it('2026-11-03').data.checkIn === undefined && it('2026-11-03').after.in === '08:00', '★ 시각은 같고 확인 필요만 남은 날: 시각은 건드리지 않고 표시만 푼다(미리보기에는 기존 시각 표시)');
ok(it('2026-11-04').status === '보충' && !it('2026-11-04').cleared && it('2026-11-04').data.needsReview === undefined, '캡스에 출근 지문만 있는 날(보충)은 반쪽 증거라 확인 필요를 해제하지 않는다');
ok(it('2026-11-05').status === '변경' && !it('2026-11-05').cleared && it('2026-11-05').data.needsReview === undefined, '확인 필요가 없던 날은 해제 표시를 만들지 않는다');
ok(it('2026-11-06').status === '동일' && it('2026-11-06').write === false && !it('2026-11-06').cleared, '확인 필요도 시각 차이도 없으면 쓰지 않는다(기존 규칙 그대로)');
ok(P.cleared === 2 && P.overwritten === 2, '★ 계획 요약: 해제 2건, 덮어쓰는 NFC·버튼 기록 2건(11-02 NFC·11-05 버튼)');
const txt = capsSummaryText(P);
ok(txt.includes('NFC 확인 필요 해제 2건') && txt.includes('덮어쓰는 NFC·버튼 기록 2건'), '미리보기 위쪽 요약에 해제·덮어쓰는 건수가 보인다');
const P0 = buildCapsPlan({ records: [rec('2026-11-02', [8, 0], [17, 0])], workers: W, existing: new Map(), from: '2026-11-01', to: '2026-11-30', today: '2026-11-20' });
ok(P0.cleared === 0 && P0.overwritten === 0 && !capsSummaryText(P0).includes('NFC'), 'NFC 기록이 없는 달은 요약에 NFC 문구가 붙지 않는다(기존 화면 그대로)');
const st = Object.assign(capsInit(), { stage: 'preview', fileName: 'x.xls', parse: { ok: true, records: [], problems: [], stats: { records: 5, names: 1, ids: 1, mergedIds: 0, from: '2026-11-01', to: '2026-11-30', dataRows: 5 } }, from: '2026-11-01', to: '2026-11-30', plan: P });
let html = ''; try { html = capsPanelHtml(st); } catch (e) { html = 'ERR ' + e.message; }
ok(!html.startsWith('ERR') && html.includes('NFC 확인 해제') && html.includes('NFC 확인 필요 해제 2건'), '★ 업로드 미리보기: 표에 "NFC 확인 해제" 칩, 위쪽 요약에 건수 — 화면이 예외 없이 그려진다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
