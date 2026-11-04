import { ROLE_MAX, cleanRole, roleSuggestions, rolePatch, roleOn, careerProjects, careerSummary } from '../app/shared/career.js';
import { manageHtml } from '../app/modules/pjt/attend-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── 역할 정리·제안
ok(cleanRole('  현장   소장 ') === '현장 소장' && cleanRole(null) === '' && cleanRole(undefined) === '' && cleanRole('가'.repeat(60)).length === ROLE_MAX && ROLE_MAX === 40, '역할 입력 정리: 앞뒤 공백 제거·연속 공백 한 칸·40자 제한·빈 값');
const R1 = [{ id: 'a', role: '공무' }, { id: 'b', role: '품질' }, { id: 'c', role: '' }]; const R2 = { x: { role: '공무' }, y: { role: '반장' }, z: { role: ' 품질 ' } };
ok(roleSuggestions([R1, R2]).join() === '공무,품질,반장' && roleSuggestions([R1, R2], 2).join() === '공무,품질' && roleSuggestions([]).length === 0 && roleSuggestions(null).length === 0, '입력칸 제안: 이미 쓴 역할을 많이 쓴 순(같으면 가나다), 명단 배열·객체 모두, 개수 제한, 비어 있어도 안전');
// ── 역할 변경 계획
ok(rolePatch({ role: '공무' }, ' 공무 ', '2026-11-05') === null && rolePatch({}, '', '2026-11-05') === null, '바뀐 것이 없으면 저장하지 않음(공백만 다른 경우 포함)');
const p1 = rolePatch({ role: '', createdDate: '2026-10-01' }, '품질', '2026-11-05'); ok(p1.role === '품질' && JSON.stringify(p1.roleLog) === '[{"role":"품질","at":"2026-11-05"}]', '처음 역할을 적으면 그날부터 기록');
const p2 = rolePatch({ role: '공무', createdDate: '2026-10-01' }, '품질', '2026-11-05'); ok(p2.roleLog.length === 2 && p2.roleLog[0].role === '공무' && p2.roleLog[0].at === '2026-10-01' && p2.roleLog[1].role === '품질', '기록 없이 역할만 있던 옛 데이터는 투입일(없으면 1900-01-01)을 시작점으로 먼저 남기고 새 역할을 이어서 기록');
const p3 = rolePatch({ role: '품질', roleLog: [{ role: '품질', at: '2026-11-05' }] }, '', '2026-11-20'); ok(p3.role === '' && p3.roleLog.length === 2 && p3.roleLog[1].role === '' && p3.roleLog[1].at === '2026-11-20', '역할을 비우면 role 은 빈 값, 그 시점도 기록(이후 공수는 미지정)');
let big = { role: 'r0', roleLog: [] }; for (let i = 1; i <= 40; i++) big = Object.assign({}, big, rolePatch(big, 'r' + i, '2026-01-' + String((i % 28) + 1).padStart(2, '0'))); ok(big.roleLog.length === 30 && big.roleLog[29].role === 'r40', '기록은 최근 30건까지만 보관');
ok(rolePatch({ role: 'x', roleLog: [{ role: 'x', at: 'bad' }, null] }, 'y', '2026-11-05').roleLog.map((e) => e.role).join() === 'x,y', '날짜 형식이 깨진 옛 기록 항목은 버림');
// ── 날짜별 역할
const W = { role: '품질', roleLog: [{ role: '공무', at: '2026-10-10' }, { role: '품질', at: '2026-11-01' }] };
ok(roleOn(W, '2026-10-01') === '공무' && roleOn(W, '2026-10-10') === '공무' && roleOn(W, '2026-10-31') === '공무' && roleOn(W, '2026-11-01') === '품질' && roleOn(W, '2026-12-31') === '품질' && roleOn({ role: '반장' }, '2026-10-01') === '반장' && roleOn(null, '2026-10-01') === '', '날짜별 역할: 첫 기록 이전은 첫 역할, 이후는 그날까지의 가장 늦은 기록, 기록이 없으면 현재 역할');
// ── 프로젝트 이력 집계
const PJ = [
  { key: 'ph2', name: 'P4 Ph2', ended: false, roster: { m1: W, m2: { role: '기술자', active: false, endedDate: '2026-10-20', createdDate: '2026-09-01' } }, rows: [['2026-10-05', { m1: 1, m2: 1 }], ['2026-10-10', { m1: 1, m2: 0.5 }], ['2026-10-31', { m1: 0.5 }], ['2026-11-02', { m1: 1 }], ['2026-11-03', { m1: 0 }], ['2026-10-12', { ghost: 2 }]] },
  { key: 'm15', name: 'M15X', ended: true, roster: { m1: { role: '', createdDate: '2026-06-01' } }, rows: [['2026-07-01', { m1: 1 }], ['2026-07-02', { m1: 1 }], ['2026-07-03', { m1: 0.3 }]] },
  { key: 'ph4', name: 'P4 Ph4', ended: false, roster: { m1: { role: '공무', active: true, createdDate: '2026-11-04' } }, rows: [] },
  { key: 'tst', name: '점검용 시험', ended: false, test: true, roster: { m1: { role: '시험' } }, rows: [['2026-10-01', { m1: 5 }]] },
  { key: 'etc', name: '다른 사람만', ended: false, roster: { m9: { role: '반장' } }, rows: [['2026-10-01', { m9: 1 }]] },
];
const C = careerProjects('m1', PJ, { today: '2026-11-05' });
ok(C.map((x) => x.pjtKey).join() === 'ph4,ph2,m15', '이력 목록: 이 사람이 있는 프로젝트만, 시작이 늦은 순(시험 프로젝트·다른 사람 프로젝트 제외)');
const a = C.find((x) => x.pjtKey === 'ph2');
ok(a.from === '2026-10-05' && a.to === '2026-11-05' && a.active === true && a.days === 4 && a.manDays === 3.5 && a.role === '품질', '진행 중 프로젝트: 기간 = 첫 공수일~오늘, 출역일 4일(공수 0 인 날 제외), 공수 합계 3.5, 지금 역할');
ok(JSON.stringify(a.segments.map((s) => [s.role, s.from, s.to, s.days, s.manDays])) === JSON.stringify([['공무', '2026-10-05', '2026-10-31', 3, 2.5], ['품질', '2026-11-02', '2026-11-02', 1, 1]]), '역할이 바뀌면 구간별로 나눔(공무 10/05~10/31 3일 2.5공수, 품질 11/02 1일 1공수)');
const b = C.find((x) => x.pjtKey === 'm15');
ok(b.ended === true && b.active === false && b.from === '2026-07-01' && b.to === '2026-07-03' && b.days === 3 && b.manDays === 2.3 && b.role === '' && b.segments.length === 1 && b.segments[0].role === '', '종료된 프로젝트: 기간 = 첫~마지막 공수일(오늘이 아님), 공수 소수 합계 반올림 2.3, 역할 미지정');
const c = C.find((x) => x.pjtKey === 'ph4');
ok(c.days === 0 && c.manDays === 0 && c.from === '2026-11-04' && c.to === '2026-11-05' && c.segments.length === 0 && c.role === '공무', '공수 기록이 없는 새 투입: 기간 = 투입일~오늘, 공수 0, 역할은 명단 값');
const d = careerProjects('m2', PJ, { today: '2026-11-05' }); ok(d.length === 1 && d[0].active === false && d[0].from === '2026-10-05' && d[0].to === '2026-10-10' && d[0].manDays === 1.5 && d[0].role === '기술자', '투입 종료된 사람: 마지막 공수일에서 끝남(오늘까지 늘어나지 않음)');
ok(careerProjects('ghost', PJ, { today: '2026-11-05' }).length === 1 && careerProjects('ghost', PJ, { today: '2026-11-05' })[0].role === '' && careerProjects('nobody', PJ).length === 0, '명단에 없어도 공수 기록이 있으면 이력에 나옴(역할 미지정), 아무 기록도 없으면 빈 목록');
ok(careerProjects('m1', PJ, { today: '2026-11-05', includeTest: true }).length === 4, '시험 프로젝트는 옵션으로만 포함');
ok(careerProjects('m1', null).length === 0 && careerProjects('m1', [null, {}]).length === 0, '입력이 비어 있어도 안전');
const S = careerSummary(C); ok(S.count === 3 && S.manDays === 5.8 && S.from === '2026-07-01' && S.to === '2026-11-05' && careerSummary([]).count === 0 && careerSummary(null).from === '', '이력 요약: 프로젝트 수·공수 합계 5.8·가장 이른 시작~가장 늦은 끝');
// ── 명단 관리 화면
const st = { roster: [{ id: 'm1', name: '박<민수>', role: '품질', active: true }, { id: 'm2', name: '최지우', role: '', active: false }], masters: { m1: { name: '박민수', birth: '1992-08-24' }, m3: { name: '신규', birth: '1990-01-01' } }, roleHints: [[{ role: '현장소장' }]] };
const h = manageHtml(st);
ok(/data-pa-role="m1"[^>]*value="품질"/.test(h) && /data-pa-role="m2"[^>]*value=""/.test(h) && /maxlength="40"/.test(h) && /list="jh-pa-roles"/.test(h), '명단 행마다 역할 입력칸(현재 값 표시, 40자, 제안 목록 연결)');
ok(/<datalist id="jh-pa-roles">[\s\S]*value="품질"[\s\S]*value="현장소장"[\s\S]*<\/datalist>/.test(h), '제안 목록: 현재 명단과 다른 프로젝트에서 쓴 역할');
ok(/data-pa-addrole/.test(h) && h.indexOf('data-pa-addrole') < h.indexOf('data-pa-act="add"'), '투입 줄에 역할(선택) 입력칸, 투입 단추 앞에 위치');
ok(h.includes('박&lt;민수&gt;') && !h.includes('박<민수>') && /aria-label="박&lt;민수&gt; 역할"/.test(h), '이름에 특수문자가 있어도 이스케이프(화면·접근성 이름)');
ok(h.includes('자유롭게 적고'), '안내문에 역할은 자유 입력이며 날짜가 기록된다는 설명');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
