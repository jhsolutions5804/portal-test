// 2026-11-02 잘못 입력한 수기 전표 삭제(제한형) — 화면용 규칙(logic.deleteBlocker)·전표 상세의 삭제 영역(view.entryDialogHtml)·서버 호출(data.deleteEntry) 시험. 서버 규칙은 portal-functions functions/test/ledger.test.js 가 고정한다(두 곳 규칙이 같아야 함).
import { deleteBlocker, canDeleteEntry, DELETE_DAYS } from '../app/modules/finance/logic.js';
import { entryDialogHtml, entriesHtml } from '../app/modules/finance/view.js';
import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const NOW = Date.UTC(2026, 10, 2, 5, 30); const H = 3600e3, D = 24 * H;
const E = (o) => Object.assign({ id: 'e1', no: '2026-2001', date: '2026-10-17', memo: '주유', status: 'posted', source: { kind: 'manual', id: '' }, createdBy: 'u1', createdByName: '김민서', createdMs: NOW - H, reversedBy: '', reverses: '', replaces: '', replacesNo: '', lines: [{ account: '5330', side: 'D', amount: 149900, partner: '지에스칼텍스(주)이마트구성점' }, { account: '1110', side: 'C', amount: 149900, partner: 'IBK비씨신용카드' }] }, o || {});
const me = { uid: 'u1', admin: false }, adm = { uid: 'a1', admin: true };
ok(DELETE_DAYS === 7, '삭제 가능 기간은 7일(서버와 같은 값)');
ok(deleteBlocker(E(), me, '', NOW) === '' && canDeleteEntry(E(), me, '', NOW), '★ 민서 님 경우: 수기 전표를 만든 본인이 한 시간 뒤에 지울 수 있음');
ok(canDeleteEntry(E(), adm, '', NOW) && !canDeleteEntry(E(), { uid: 'u2', admin: false }, '', NOW) && deleteBlocker(E(), { uid: 'u2' }, '', NOW).includes('직접'), '관리자는 남의 전표도 가능, 다른 일반 담당자는 불가(메시지 포함)');
ok(!canDeleteEntry(E(), null, '', NOW) && !canDeleteEntry(E(), {}, '', NOW) && !canDeleteEntry(null, adm, '', NOW), '로그인 정보가 없거나 전표가 없으면 불가');
ok(deleteBlocker(E({ source: { kind: 'bank', id: 'x' } }), adm, '', NOW).includes('수기로 입력한'), '가져오기(통장) 전표는 불가');
for (const k of ['taxinv_sales', 'taxinv_purchase', 'card', 'expense', 'payslip', 'opening']) ok(!canDeleteEntry(E({ source: { kind: k, id: 'x' } }), adm, '', NOW), '원천 ' + k + ' 은 불가');
ok(deleteBlocker(E({ reversedBy: 'r1' }), adm, '', NOW).includes('역분개') && deleteBlocker(E({ reverses: 'o1' }), adm, '', NOW).includes('역분개'), '역분개된 원 전표·역분개 전표는 불가');
ok(deleteBlocker(E({ replaces: 'o1', replacesNo: '2026-0001' }), adm, '', NOW).includes('재분류'), '재분류로 만든 전표는 불가');
ok(deleteBlocker(E({ date: '2026-10-31' }), adm, '2026-10-31', NOW).includes('마감') && deleteBlocker(E({ date: '2026-10-01' }), adm, '2026-10-31', NOW).includes('마감') && canDeleteEntry(E({ date: '2026-11-01' }), adm, '2026-10-31', NOW), '마감일 이전·같은 날은 불가, 다음 날은 가능');
ok(canDeleteEntry(E({ createdMs: NOW - (6 * D + 23 * H) }), me, '', NOW) && !canDeleteEntry(E({ createdMs: NOW - (7 * D + H) }), me, '', NOW) && deleteBlocker(E({ createdMs: NOW - 8 * D }), adm, '', NOW).includes('7일'), '7일 경계: 6일 23시간은 가능, 7일 1시간은 불가(관리자도)');
ok(deleteBlocker(E({ createdMs: 0 }), adm, '', NOW).includes('시각'), '만든 시각을 모르면 불가');
// 전표 상세 화면
const dlg = (e, canDel, canRev = true) => entryDialogHtml(e, canRev, '2026-09-30', canDel);
let h = dlg(E(), true);
ok(h.includes('data-act="delete"') && h.includes('data-del-reason') && h.includes('삭제(잘못 입력한 수기 전표)'), '삭제 가능하면 전표 상세에 삭제 영역(사유 칸·삭제 단추)이 보임');
ok(h.includes('7일') && h.includes('감사 기록') && h.includes('되돌릴 수 없') && h.includes('비용 입력'), '안내 문구: 기간·감사 기록·되돌릴 수 없음·바른 곳에 다시 입력');
ok(h.includes('data-act="reverse"') && h.includes('data-act="reclass-open"'), '기존 역분개·재분류 영역은 그대로 있음');
h = dlg(E(), false); ok(!h.includes('data-act="delete"') && !h.includes('data-del-reason'), '삭제 불가이면 삭제 영역이 없음');
h = entryDialogHtml(E(), true, ''); ok(!h.includes('data-act="delete"'), '네 번째 인자를 안 주면(옛 호출) 삭제 영역 없음');
h = dlg(E({ memo: '<img src=x onerror=1>' }), true); ok(h.includes('&lt;img') && !h.includes('<img src=x'), '메모의 위험한 글자는 안전하게 표시');
// 목록 안내 문구(코드에서 직접 확인 — 목록 그림 함수는 많은 입력이 필요해 문구만 본다)
const vsrc = fs.readFileSync(new URL('../app/modules/finance/view.js', import.meta.url), 'utf8');
ok(vsrc.includes('전표는 만든 뒤 고칠 수 없고, 잘못은 역분개로 바로잡습니다(직접 입력한 수기 전표는 만든 지 \' + DELETE_DAYS + \'일 안에 삭제할 수 있습니다)') && !vsrc.includes('전표는 만든 뒤 고치거나 지울 수 없고'), '목록 안내 문구가 새 규칙(수기 전표는 7일 안에 삭제 가능)으로 바뀌고 옛 문구는 없음');
// 서버 호출 연결
const src = fs.readFileSync(new URL('../app/modules/finance/data.js', import.meta.url), 'utf8');
ok(/export const deleteEntry = \(id, reason\) => ledgerCall\(\{ action: 'deleteEntry', id, reason \}\)/.test(src), '데이터 연결: deleteEntry 가 서버 action 「deleteEntry」 에 id·reason 을 보냄');
const ix = fs.readFileSync(new URL('../app/modules/finance/index.js', import.meta.url), 'utf8');
ok(/data-act="delete"[\s\S]{0,900}confirmDialog[\s\S]{0,700}deleteEntry\(id, reason\)/.test(ix) && /reason\.length < 2/.test(ix), '화면 처리: 사유 2자 이상 검사 → 확인창 → 삭제 호출 순서');
ok(/canDeleteEntry\(e, \{ uid: S\.uid, admin: S\.admin \}/.test(ix) && /S\.uid = me\.uid/.test(ix), '화면 처리: 로그인한 사용자(uid·관리자 여부)로 삭제 가능 여부를 판단');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
