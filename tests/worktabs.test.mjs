import { MAX_TABS, noteTab, overflowKeys, dropTab, nextAfterClose, relabelTab, showBar, barOrder, workTabs } from '../app/core/worktabs.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
let L = noteTab([], { key: '#/plan/est', hash: '#/plan/est', label: '영업기획 › 견적', mod: 'plan' }, 1000); L = noteTab(L, { key: '#/pjt/home', hash: '#/pjt/home', label: 'PJT 관리', mod: 'pjt' }, 2000); L = noteTab(L, { key: '#/plan/est', hash: '#/plan/est/e1', label: '' }, 3000);
ok(L.length === 2 && L[0].key === '#/plan/est' && L[0].hash === '#/plan/est/e1' && L[0].label === '영업기획 › 견적' && L[0].ts === 3000 && L[0].mod === 'plan' && L[1].key === '#/pjt/home', '★ 같은 화면은 한 탭으로(맨 앞으로, 주소·시각 갱신), 이름이 비어 오면 이전 이름·모듈을 유지');
ok(noteTab([], { key: '', hash: '#/a' }, 1).length === 0 && noteTab([], { key: 'k', hash: 'x' }, 1).length === 0 && noteTab(null, null, 1).length === 0 && noteTab([], { key: 'k', hash: '#/k' }, 1)[0].label === 'k', '잘못된 입력은 기록하지 않고, 이름이 없으면 key 로');
let M = []; for (let i = 0; i < 11; i++) M = noteTab(M, { key: 'k' + i, hash: '#/m/' + i, label: '탭' + i }, i + 1);
ok(MAX_TABS === 8 && overflowKeys(M, 'k10').join() === 'k0,k1,k2' && overflowKeys(M, 'k0').join() === 'k1,k2,k3' && overflowKeys(M.slice(0, 8), 'k0').length === 0 && overflowKeys([], '', 8).length === 0, '★ 8개를 넘으면 가장 오래 안 쓴 탭부터 닫을 목록(현재 탭은 빼고)');
ok(dropTab(L, '#/plan/est').length === 1 && nextAfterClose(L, '#/plan/est').key === '#/pjt/home' && nextAfterClose(L, '#/pjt/home').key === '#/plan/est' && nextAfterClose([L[0]], '#/plan/est') === null && nextAfterClose(null, 'x') === null, '탭을 닫으면 가장 최근에 쓴 다른 탭으로(없으면 홈)');
ok(relabelTab(L, '#/pjt/home', 'PJT 관리 › P4 Ph2 › 공정')[1].label === 'PJT 관리 › P4 Ph2 › 공정' && relabelTab(L, '#/pjt/home', '')[1].label === 'PJT 관리' && relabelTab(L, '#/pjt/home', 'x')[1].ts === 2000, '이름만 고침(빈 이름으로는 안 지움, 시각 유지)');
ok(showBar([]) === false && showBar([1]) === false && showBar([1, 2]) === true && showBar(null) === false, '탭 바는 탭이 둘 이상일 때만');
ok(barOrder(['b', 'a', 'z'], [{ key: 'a' }, { key: 'b' }, { key: 'c' }]).join() === 'b,a,c' && barOrder([], [{ key: 'a' }, { key: 'b' }]).join() === 'a,b' && barOrder(null, null).length === 0, '탭 바 순서는 처음 연 순서 유지(새 탭은 뒤에)');
// 화면 없이도 안전: 붙이기 전에 불러도 오류가 없고, 닫기 처리기가 부른다
let dropped = 0; workTabs.note({ key: '#/a/x', hash: '#/a/x', label: 'A' }, { drop: () => { dropped++; }, reload() {} }); workTabs.note({ key: '#/b/x', hash: '#/b/x', label: 'B' }, { drop: () => { dropped++; } });
ok(workTabs.list().length === 2 && workTabs.currentKey() === '#/b/x' && workTabs.has('#/a/x') && !workTabs.has('zz'), '붙이기 전에도 기록 가능(현재 탭은 마지막으로 연 것)');
let nav = ''; workTabs.attach(null, { navigate: (h) => { nav = h; } }); workTabs.close('#/b/x');
ok(dropped === 1 && nav === '#/a/x' && workTabs.list().length === 1 && workTabs.currentKey() === '', '★ 현재 탭을 닫으면 그 화면을 정리하고(drop) 가장 최근 다른 탭으로 이동');
workTabs.note({ key: '#/a/x', hash: '#/a/x', label: 'A' }); workTabs.close('#/a/x'); ok(nav === '#/home' && dropped === 2, '마지막 탭(현재)을 닫으면 홈으로');   // 이동하면 화면이 다시 현재로 기록된다
workTabs.note({ key: '#/c/x', hash: '#/c/x', label: 'C' }, { drop: () => { dropped++; } }); workTabs.reset(); ok(dropped === 3 && workTabs.list().length === 0, '모두 닫기(로그아웃·사용자 변경)는 모든 화면을 정리');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
