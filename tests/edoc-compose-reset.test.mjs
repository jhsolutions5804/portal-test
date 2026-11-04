// 저장에 성공한 새 문서의 작성 화면 초기화 시험 — 포털은 같은 주소로 돌아오면 화면을 다시 그리지 않고 그대로 보여 주므로(boot.js),
// 저장 뒤 숨겨진 작성 화면에 「처리 중…」과 이전 입력이 남아 같은 종류를 연달아 쓸 수 없던 문제(2026-11-04 주유·정비 연속 기록 시험에서 발견).
import fs from 'node:fs';
import { resetCompose, defaultValues, setRec, initialLine, lineContext } from '../app/modules/edoc/compose.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const me = { uid: 'u1', name: '한가나', rank: '사원', dept: '시공팀' };
const mkS = (type, values) => ({ type, values, errors: { odo: '오류' }, formError: '입력 내용을 확인해 주세요.', busy: true, files: [{ name: 'a.jpg' }], uploading: [{ n: 1 }], attachError: '용량 초과', docRef: { dtype: 'drive', id: 'x' }, createdMs: 123, ctx: lineContext(me, {}, {}, [], type), line: { approvers: ['u2'], cc: [] }, edit: null });
const S1 = mkS('drive', Object.assign(defaultValues('drive', me, new Date('2026-11-04')), { rec: 'fuel', station: '시험주유소', odo: '10000', amount: '100000', liters: '45' }));
resetCompose(S1, me);
ok(S1.busy === false && S1.formError === '' && Object.keys(S1.errors).length === 0, '★ 저장 뒤: 「처리 중」·오류 표시가 풀린다');
ok(S1.values.station === '' && S1.values.odo === '' && S1.values.amount === '' && S1.values.liters === '', '★ 저장 뒤: 이전 입력(주유소·누적주행거리·금액·주유량)이 지워진다');
ok(S1.values.rec === 'fuel', '운행일지는 마지막으로 고른 기록 종류(주유)를 유지한다 — 주유를 연달아 쓰기 편하게');
ok(S1.files.length === 0 && S1.uploading.length === 0 && S1.attachError === '' && S1.docRef === null && S1.createdMs === null, '첨부·임시저장 문서 연결이 비워진다(다음 저장이 새 문서가 된다)');
const S2 = mkS('drive', Object.assign(defaultValues('drive', me, new Date('2026-11-04')), { rec: 'repair', items: [{ name: '타이어', amount: '400000', memo: '' }] })); resetCompose(S2, me);
ok(S2.values.rec === 'repair' && S2.values.items.length === 1 && S2.values.items[0].name === '' && S2.values.items[0].amount === '', '정비·비용: 항목이 지워지고 빈 항목 한 줄이 다시 깔린다');
const S3 = mkS('drive', Object.assign(defaultValues('drive', me, new Date('2026-11-04')), { origin: '본사', odoStart: '100' })); resetCompose(S3, me); ok(S3.values.rec === 'trip' && S3.values.origin === '' && S3.values.odoStart === '', '운행: 운행 입력이 지워진다');
const S4 = mkS('cert', Object.assign(defaultValues('cert', me), { purpose: '은행 제출', copies: 3 })); resetCompose(S4, me); ok(S4.values.purpose === '' && S4.values.copies === 1 && S4.busy === false && S4.values.rec === undefined, '다른 종류(재직증명서)도 같은 방식으로 빈 상태로 돌아간다(운행일지 전용이 아님)');
ok(S1.line && Array.isArray(S1.line.approvers), '결재선도 새 문서 기본 상태로');
// 컨트롤러가 성공 경로에서 호출한다(저장 성공 → 초기화 → 문서 화면으로 이동 순서)
const src = fs.readFileSync(new URL('../app/modules/edoc/index.js', import.meta.url), 'utf8');
const iAct = src.indexOf("action: 'submit'"); const iReset = src.indexOf('C.resetCompose(S, me)'); const iNav = src.indexOf("navigate('#/edoc/doc/' + ref.dtype");
ok(iAct > 0 && iReset > iAct && iNav > iReset, '★ 컨트롤러: 저장(submit) 성공 뒤 → 작성 화면 초기화 → 문서 화면으로 이동 순서');
ok(/if \(!S\.edit\) \{ C\.resetCompose\(S, me\); paint\(\); \}/.test(src), '컨트롤러: 새 문서일 때만 초기화하고 다시 그린다(수정 중인 임시저장·반려 문서는 건드리지 않음)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
