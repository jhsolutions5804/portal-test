import { visibleWorkers } from '../app/modules/attendance/logic.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
/* 2026-11-11 대표님: 퇴사 처리한 형일우 사원이 출퇴근 기록 관리자 목록에 남아 있다 */
const W = [{ id: 'a', name: '송지훈' }, { id: 'b', name: '형일우', status: 'resigned', resignDate: '2026-09-16' }, { id: 'c', name: '무날짜', status: 'resigned' }, { id: 'd', name: '날짜만', resignDate: '2026-11-20' }, { id: 'e', name: '재직', status: 'active' }];
const names = (l) => l.map((w) => w.name).join();
ok(names(visibleWorkers(W, '2026-11', null)) === '송지훈,날짜만,재직', '★ 11월 목록: 9월에 퇴사한 형일우·퇴사일 없는 퇴사자는 빠지고, 11월 중 퇴사자와 재직자는 남는다');
ok(names(visibleWorkers(W, '2026-09', null)) === '송지훈,형일우,날짜만,재직', '★ 퇴사한 달(9월) 목록에는 형일우가 보인다(그 달 기록을 고칠 수 있어야 함)');
ok(names(visibleWorkers(W, '2026-08', null)).indexOf('형일우') !== -1, '퇴사 전 달 목록에도 보인다');
ok(names(visibleWorkers(W, '2026-11', W[1])) === '송지훈,형일우,날짜만,재직', '★ 지금 고른 사람은 퇴사자여도 목록에 남는다(과거 기록 수정 중 사라지지 않음)');
ok(visibleWorkers(null, '2026-11', null).length === 0 && visibleWorkers([null, undefined], '2026-11', null).length === 0, '목록이 없거나 비어 있어도 안전');
console.log(fail ? '\n실패 ' + fail + '건' : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
