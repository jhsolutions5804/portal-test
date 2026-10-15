import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const { isEvalOps, isEvalUser } = await import('../app/shared/eval-perm.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const U = (o) => Object.assign({ uid: 'u', rank: '사원', perms: {}, isGuest: false }, o || {});
// ── 권한: 내 평가(정직원 누구나) / 평가 운영(사장단·관리자·인사평가 권한)
ok(isEvalUser(U()) && isEvalUser(U({ rank: '대표' })) && !isEvalUser(U({ isGuest: true })) && !isEvalUser(null) && !isEvalUser(undefined), '★ 내 평가는 정직원(GUEST 제외) 누구나 — 로그인 정보가 없거나 GUEST 는 못 연다');
ok(isEvalOps(U({ rank: '대표' })) && isEvalOps(U({ rank: '부사장' })) && isEvalOps(U({ admin: true })) && isEvalOps(U({ perms: { hrEval: true } })), '★ 평가 운영은 사장단(대표·부사장)·관리자·"인사평가" 권한을 받은 사람이 열 수 있음');
ok(!isEvalOps(U()) && !isEvalOps(U({ perms: { hrEval: false } })) && !isEvalOps(U({ perms: { hrEval: 'yes' } })) && !isEvalOps(U({ perms: { pjt: true, finance: true } })) && !isEvalOps(U({ rank: '과장' })) && !isEvalOps(U({ isGuest: true, admin: true })) && !isEvalOps(null), '★ 일반 직원·직급이 과장 이하·다른 모듈 권한(PJT·재무)만 있는 사람·GUEST 는 열 수 없음(hrEval 은 true 일 때만, GUEST 는 관리자 표시가 있어도 제외)');
// ── 구조: 평가는 인사 모듈에서 분리되어 있다
const hrIdx = fs.readFileSync(new URL('../app/modules/hr/index.js', import.meta.url), 'utf8');
ok(!/evaluation-view|evaluation-io|adhoc-view|adhoc-io|createCycleController|createAdhocController|evalBoardHtml|adhocBoardHtml/.test(hrIdx), '★ 인사 모듈에는 정기·수시평가 운영 연결이 없음(분리) — 인사 모듈 접근 권한을 넓히지 않고 평가만 별도 메뉴로 열기 위한 설계가 되돌려지지 않게 막음');
const files = fs.readdirSync(new URL('../app/modules/eval/', import.meta.url)).filter((f) => f.endsWith('.js'));
const src = files.map((f) => [f, fs.readFileSync(new URL('../app/modules/eval/' + f, import.meta.url), 'utf8')]);
ok(!src.some(([, s]) => /from '\.\.\/(hr|plan|pjt|finance|company|general|edoc|attendance|calendar)\//.test(s)), '★ 평가 모듈은 다른 모듈의 파일을 직접 가져오지 않음(공용은 shared/ — 규약 R1)');
ok(!src.some(([, s]) => /payslips|salary_offers|annual_contracts|labor_contracts|worker_private|master_worker_private|worker_identity|severance|dismissal_notices/.test(s)), '★ 평가 모듈은 급여명세서·계약서·주민번호·퇴직금 같은 민감 인사 컬렉션을 읽지 않음');
const reads = [...new Set(src.flatMap(([, s]) => [...s.matchAll(/(?:collection|doc)\(db,\s*'([a-z_]+)/g)].map((m) => m[1])))].sort();
ok(JSON.stringify(reads) === JSON.stringify(['evaluations', 'gihoek_estimates', 'gihoek_projects', 'gihoek_settlements', 'portal_users', 'pjt_registry', 'workers'].sort()) || reads.every((r) => ['evaluations', 'gihoek_estimates', 'gihoek_projects', 'gihoek_settlements', 'portal_users', 'pjt_registry', 'workers', 'eval_cycles', 'eval_tasks', 'eval_submissions'].includes(r)), '평가 모듈이 접근하는 컬렉션 목록이 정해진 범위 안(평가·근로자·계정·PJT·영업기획 정산, 내 평가용 eval_*) — 목록 밖의 컬렉션을 쓰면 시험이 알려 줌: ' + reads.join(','));
// ── 진입점: 권한 없는 사람은 운영 화면 데이터를 읽기 전에 멈춘다
const ops = fs.readFileSync(new URL('../app/modules/eval/ops.js', import.meta.url), 'utf8');
const iGuard = ops.indexOf('if (!isEvalOps(me))'), iRead = ops.indexOf('await loadWorkers');
ok(iGuard !== -1 && iRead !== -1 && iGuard < iRead && ops.indexOf('noAccess()', iGuard) < iRead && /if \(!isEvalOps\(me\)\) \{ root\.innerHTML = noAccess\(\); return; \}/.test(ops), '★ 평가 운영 화면은 권한을 먼저 확인하고, 없으면 근로자·평가 데이터를 읽지 않고 안내만 보임');
const idx = fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8');
ok(/perm: isEvalUser/.test(idx) && /key === 'cycle' \|\| key === 'adhoc'/.test(idx) && idx.includes("'mine'") && idx.includes('isEvalUser(me)'), '진입점: 메뉴는 정직원에게 보이고, mine·cycle·adhoc 화면으로 나뉘며, GUEST 는 화면에서도 막음');
// ── 공용 사이드바 틀: 묶음 단위 권한(c.perm)이 일반화되었고 기존 admin 동작은 그대로
const list = fs.readFileSync(new URL('../app/modules/legacy/list.js', import.meta.url), 'utf8');
ok(list.includes("if (c.admin && !(me && me.admin)) return; if (typeof c.perm === 'function' && !c.perm(me)) return;"), '공용 틀: 묶음 권한(c.perm)을 추가하면서 기존 관리자 전용 묶음(c.admin) 동작은 그대로 유지');
// ── 사이드바: 역할별로 어떤 메뉴가 보이는가(공용 틀 sideConfig + 모듈 접근 권한 def.perm)
const LL = await import('../app/modules/legacy/list.js?v=' + VER);
const def = LL.LEGACY_DEFS.find((d) => d.id === 'eval'); const hrDef = LL.LEGACY_DEFS.find((d) => d.id === 'hr');
const labels = (cfg) => (cfg.sections || []).flatMap((x) => (x.items || []).map((i) => i.label));
const seen = (me) => (def.perm(me) ? labels(LL.sideConfig(def, 'mine', null, me, null)) : null);   // null = 메뉴 자체가 없음
const emp = U({ uid: 'k' }), ceo = U({ uid: 'c', rank: '대표' }), hrEval = U({ uid: 'h', perms: { hrEval: true } }), adm = U({ uid: 'a', rank: '대리', admin: true }), guest = U({ uid: 'g', isGuest: true, perms: { hrEval: true }, admin: true });
ok(JSON.stringify(seen(emp)) === '["내 평가"]', '★ 일반 직원에게는 "내 평가"만 보임(평가 운영 메뉴는 없음)');
ok(['정기평가', '수시평가', '내 평가'].every((l) => seen(ceo).includes(l) && seen(hrEval).includes(l) && seen(adm).includes(l)), '★ 사장단·"인사평가" 권한자·관리자에게는 내 평가 + 정기평가·수시평가가 보임');
ok(seen(guest) === null && seen(null) === null, '★ GUEST 는 hrEval·관리자 표시가 있어도 평가 메뉴 자체가 나타나지 않음(로그인 정보가 없어도 마찬가지)');
ok(!labels(LL.sideConfig(hrDef, 'home', null, adm, null)).some((l) => /정기평가|수시평가|평가 운영/.test(l)) && labels(LL.sideConfig(hrDef, 'home', null, adm, null)).includes('인사평가'), '인사 메뉴에는 정기·수시평가 운영이 없고 개별 기록용 "인사평가"만 남아 있음(분리 유지)');
ok(def.order === 47 && def.ownNav === true && LL.LEGACY_DEFS.filter((d) => d.id === 'eval').length === 1, '평가 메뉴는 한 번만 정의되고 회사(45)와 PJT 관리 사이 순서(47)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
