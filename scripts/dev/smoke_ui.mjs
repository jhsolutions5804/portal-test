/* 화면 열기 점검: 가짜 브라우저(jsdom)와 가짜 Firestore(샘플 문서)로 인사·총무·재무회계의 모든 화면을 실제로 열고(`--click` 이면 버튼도 하나씩 눌러) 오류가 나는 화면을 찾는다.
 * 순수 함수 시험이 못 보는 화면 코드의 빠진 import·잘못된 호출을 잡는다(문제가 있으면 종료 코드 1).
 * 사용: cd scripts/dev && npm i espree eslint-scope jsdom   →   node --import ./smoke_register.mjs smoke_ui.mjs [--click]
 * 한계: 로그인·보안 규칙·실제 데이터 모양은 보지 못한다 — 마지막 확인은 테섭에서 직접 열어 본다. */
import { JSDOM } from 'jsdom'; import fs from 'node:fs';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://x.github.io/portal-test/app/', pretendToBeVisual: true });
const w = dom.window; for (const k of ['window', 'document', 'location', 'history', 'sessionStorage', 'localStorage', 'Element', 'HTMLElement', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'DOMParser', 'FormData', 'File', 'FileReader', 'Blob', 'URL', 'URLSearchParams', 'getComputedStyle', 'MutationObserver']) { try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch (e) { /* 이미 있음 */ } }
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true }); globalThis.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {} })); globalThis.requestAnimationFrame = (f) => setTimeout(f, 0); w.Element.prototype.scrollIntoView = function () {}; w.HTMLElement.prototype.scrollIntoView = function () {}; w.print = () => {}; globalThis.URL.createObjectURL = () => 'blob:x'; globalThis.URL.revokeObjectURL = () => {}; globalThis.alert = () => {}; globalThis.confirm = () => true; globalThis.prompt = () => ''; w.open = () => ({ document: { write() {}, close() {} }, close() {} });
// ── 가짜 Firestore ──
const D = {}; const put = (path, id, data) => { (D[path] = D[path] || {})[id] = data; };
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); const ago = (y) => (parseInt(today.slice(0, 4)) - y) + today.slice(4);
put('workers', 'w1', { name: '김가나', empNo: '20001', rank: '대리', dept: 'PJT팀', empType: 'field', hireDate: ago(5), email: 'a@jhsol.kr', phone: '010-1111-2222', status: 'active', portalUid: 'u2', certifications: ['기능사'] });
put('workers', 'w2', { name: '이다라', empNo: '25002', rank: '사원', dept: '영업기획팀', empType: 'office', hireDate: ago(1), status: 'active' });
put('workers', 'w3', { name: '박퇴사', empNo: '19003', rank: '사원', dept: 'PJT팀', empType: 'field', hireDate: ago(7), status: 'resigned', resignDate: today });
put('worker_private', 'w1', { juminMasked: '900101-1******', bankAccount: '신한 110-1', address: '대전' }); put('worker_private', 'w2', { jumin: '9505052345678' });
put('edoc_leave', 'l1', { dtype: 'leave', status: 'approved', authorName: '김가나', leaveType: '연차(유급)', startDate: today, endDate: today, days: 1 });
put('edoc_leave', 'l2', { dtype: 'leave', status: 'posted', authorName: '이다라', leaveType: '반차(오전)(유급)', startDate: today, endDate: today, days: 0.5, adminCreated: true });
put('annual_contracts/w1/contracts', '20260301', { workerId: 'w1', name: '김가나', contractDate: '2026-03-01', startDate: '2026-03-01', endDate: '2027-02-28', hourly: 12000, salary: 30000000, wageType: 'noncomprehensive', tplVer: 'v6', savedAt: '2026-10-05T00:00:00.000Z' });
put('labor_contracts/w1/contracts', '20260301', { workerId: 'w1', name: '김가나', contractDate: '2026-03-01', startDate: '2026-03-01', endDate: '2027-02-28', hourly: 12000, job: '배관', tplVer: 'v6' });
put('payslips/w1/months', '2026-09', { month: '2026-09', payDate: '2026-10-31', name: '김가나', basic: 2000000, grossPay: 3000000, netPay: 2700000, tplVer: 'v6' });
put('overtime', 'o1', { date: today, name: '김가나', rank: '대리', workerId: 'w1', hours: 2, amount: 30000, rate: 15000, yearMonth: today.slice(0, 7) });
put('edoc_overtime', 'e1', { status: 'approved', date: today, name: '이다라', rank: '사원', workerId: 'w2', hours: 1, amount: 10000, rate: 10000 });
put('worker_attendance_log', 'w1_' + today, { workerId: 'w1', name: '김가나', date: today, yearMonth: today.slice(0, 7), checkIn: '07:00', checkOut: '18:00', breakMinutes: 120, workHours: 9 });
put('salary_offers', 's1', { name: '김후보', kind: 'new', applicantId: 'a1', savedAt: today });
put('job_postings', 'j1', { title: '배관 공고', status: 'open', createdAt: today }); put('recruit_applicants', 'a1', { name: '김후보', status: 'new', phone: '010-1' });
put('hr_calendar_events', 'c1', { date: today, title: '시험 일정' }); put('company_settings', 'salaryTable', { minWage: 10320, techAllowancePerCert: 50000 }); put('company_settings', 'signatures', {});
put('leave_promotions/w1/records', 'r1', { stage: 'p1', category: 'y1', periodStart: today.slice(0, 4) + '-01-01', noticeDate: today, unusedDays: 10 });
put('portal_users', 'u2', { name: '김가나', email: 'a@jhsol.kr' }); put('hr_calendar_access', 'config', { emails: ['a@jhsol.kr'] }); put('evaluations/w1/records', 'v1', { type: 'regular', grade: 'A', date: today }); put('interviews/w1/records', 'i1', { date: today, topic: '면담' });
globalThis.__WRITES = []; const col = (db, ...s) => ({ __t: 'col', path: s.join('/') }); const id = () => 'auto' + Math.random().toString(36).slice(2, 7);
const docRef = (a, ...s) => { if (a && a.__t === 'col') { const i = s[0] || id(); return { __t: 'doc', path: a.path + '/' + i, id: i, coll: a.path }; } const p = s.join('/'); const parts = p.split('/'); return { __t: 'doc', path: p, id: parts[parts.length - 1], coll: parts.slice(0, -1).join('/') }; };
const snapOf = (path, rows) => { const docs = rows.map(([i, d]) => ({ id: i, data: () => d, ref: { __t: 'doc', path: path + '/' + i, id: i, coll: path }, exists: () => true })); return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) }; };
globalThis.__FS = {
  collection: col, doc: docRef, where: (f, op, v) => ({ __c: 'where', f, op, v }), orderBy: (f) => ({ __c: 'order', f }), limit: (n) => ({ __c: 'limit', n }), query: (c, ...cs) => ({ __t: 'query', path: c.path, cs }),
  getDocs: async (q) => { let rows = Object.entries(D[q.path] || {}); (q.cs || []).forEach((c) => { if (c.__c === 'where') { rows = rows.filter(([, d]) => { const x = d[c.f]; if (c.op === '==') return x === c.v; if (c.op === 'in') return (c.v || []).includes(x); if (c.op === '>=') return x >= c.v; if (c.op === '<=') return x <= c.v; return true; }); } else if (c.__c === 'limit') rows = rows.slice(0, c.n); }); return snapOf(q.path, rows); },
  getDoc: async (r) => { const d = (D[r.coll] || {})[r.id]; return { exists: () => !!d, data: () => d, id: r.id, ref: r }; },
  setDoc: async (r, data, o) => { globalThis.__WRITES.push(['set', r.path]); }, addDoc: async (c, data) => { globalThis.__WRITES.push(['add', c.path]); return { id: id() }; }, updateDoc: async (r) => { globalThis.__WRITES.push(['update', r.path]); }, deleteDoc: async (r) => { globalThis.__WRITES.push(['delete', r.path]); },
  deleteField: () => ({ __del: 1 }), serverTimestamp: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }), getFirestore: () => ({}), Timestamp: { fromMillis: (n) => ({ toMillis: () => n, toDate: () => new Date(n) }) },
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
};
const errors = []; process.on('unhandledRejection', (e) => errors.push('미처리 오류: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '))); process.on('uncaughtException', (e) => errors.push('예외: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')));
const ce = console.error; console.error = (...a) => { errors.push('console.error: ' + a.map((x) => String((x && x.stack) || x)).join(' ').slice(0, 260)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hr = await import(new URL('../../app/modules/hr/index.js', import.meta.url).href); const gen = await import(new URL('../../app/modules/general/index.js', import.meta.url).href); const fin = await import(new URL('../../app/modules/finance/index.js', import.meta.url).href);
const ctx = { me: { admin: true, uid: 'u1', name: '관리자', email: 'a@jhsol.kr', perms: {} } };
const targets = [...Object.keys(hr).filter((k) => /^mount/.test(k)).map((k) => ['hr.' + k, hr[k]]), ['general.mountSection', gen.mountSection]]; for (const t of ['home', 'entries', 'expense', 'import', 'reports', 'monthly', 'forecast', 'gap', 'rules', 'opening', 'settings']) targets.push(['finance/' + t, (root, route, c) => fin.mount(root, { segs: [t], query: {} }, c)]);
let failed = 0; const clickMode = process.argv.includes('--click');
for (const [name, fn] of targets) {
  errors.length = 0; const root = document.createElement('div'); document.body.appendChild(root);
  try { await Promise.race([fn(root, { segs: [], query: {} }, ctx), sleep(2500)]); await sleep(120); } catch (e) { errors.push('mount 예외: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
  const html = root.innerHTML; const danger = (html.match(/jh-alert" data-tone="danger"[^>]*>([^<]{0,120})/) || [])[1];
  const esc2 = (html.match(/&lt;(?:span|b|br|div|strong|a)\b|&amp;(?:lt|gt|amp|quot);/g) || []); if (esc2.length) errors.push('이중 이스케이프(화면에 태그 글자가 그대로 보임): ' + esc2.slice(0, 2).join(' '));
  let status = errors.length ? '✗' : '✓'; if (danger) status = '⚠'; if (errors.length || danger) failed++;
  console.log(status, name.padEnd(26), '화면 ' + html.length + '자' + (danger ? ' · 화면 오류문구: ' + danger.trim() : '') + (errors.length ? ' · ' + errors.slice(0, 2).join(' // ') : ''));
  if (clickMode && !errors.length) {
    const els = [...root.querySelectorAll('button[data-variant], a[data-an-act], [class*="jh-segmented__item"], tr[data-open], tr.jh-hr__row')].filter((e) => !e.disabled).slice(0, 40); let n = 0;
    for (let i = 0; i < els.length; i++) { errors.length = 0; const r2 = document.createElement('div'); document.body.appendChild(r2); try { await Promise.race([fn(r2, { segs: [], query: {} }, ctx), sleep(2000)]); await sleep(80); const all = [...r2.querySelectorAll('button[data-variant], a[data-an-act], [class*="jh-segmented__item"], tr[data-open], tr.jh-hr__row')].filter((e) => !e.disabled); const el = all[i]; if (el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(80); } } catch (e) { errors.push('클릭 예외: ' + String(e && e.message)); } if (errors.length) { n++; console.log('    ✗ 클릭 #' + i, (els[i].textContent || els[i].getAttribute('data-variant') || '').trim().slice(0, 24), '→', errors[0].slice(0, 230)); } r2.remove(); }
    if (!n) console.log('    (버튼 ' + els.length + '개 눌러 봄 — 오류 없음)');
  }
  root.remove();
}

// ── 인사총무 껍데기(사이드바 + 새 화면 영역): 모든 인사 메뉴를 껍데기를 통해 열고, 옛 화면(iframe)이 불러와지지 않는지 확인 ──
{
  const V = '?v=' + (fs.readFileSync(new URL('../../app/modules/index.js', import.meta.url), 'utf8').match(/\?v=(\w+)/) || [])[1];   // 앱과 같은 주소(버전 표시 포함)로 불러와야 같은 모듈 인스턴스를 쓴다
  await import(new URL('../../app/modules/index.js' + V, import.meta.url).href); const { mountLegacy } = await import(new URL('../../app/modules/legacy/frame.js' + V, import.meta.url).href); const { LEGACY_DEFS } = await import(new URL('../../app/modules/legacy/list.js' + V, import.meta.url).href);
  const def = LEGACY_DEFS.find((d) => d.id === 'hr'); const keys = def.groups[0].clusters.flatMap((c) => c.keys).concat(['home']); let bad = 0; const keep = document.createElement('div'); document.body.appendChild(keep);
  const routes = keys.map((k) => ({ segs: [k], query: {} })).concat(['home', 'lease', 'vehicle', 'drive', 'asset', 'renewal'].map((t) => ({ segs: ['general', t], query: {} })));
  for (const r of routes) { errors.length = 0; try { await Promise.race([mountLegacy(def, keep, r, ctx), sleep(2500)]); await sleep(60); } catch (e) { errors.push('껍데기 예외: ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' | ')); }
    const wrap = keep.querySelector('.jh-legacy'); const nat = wrap && wrap.querySelector('.jh-legacy__native'); const frame = wrap && wrap.querySelector('iframe'); const cur = wrap && wrap.querySelector('.jh-sidenav__item[aria-current="page"]');
    const problems = []; if (!wrap) problems.push('틀 없음'); else { if (wrap.querySelector('.jh-sidenav') == null) problems.push('사이드바 없음'); if (!nat || nat.hidden || nat.innerHTML.length < 50) problems.push('새 화면 영역이 비어 있음'); if (frame && frame.getAttribute('src')) problems.push('옛 화면(iframe)이 불러와짐'); if (!cur) problems.push('현재 메뉴 표시 없음'); }
    if (errors.length) problems.push(errors[0].slice(0, 160)); if (problems.length) { bad++; console.log('✗ 껍데기', r.segs.join('/').padEnd(22), problems.join(' · ')); } }
  console.log(bad ? '✗ 껍데기 점검: 문제 ' + bad + '건 / ' + routes.length + '개 메뉴' : '✓ 껍데기 점검: 인사 ' + keys.length + '개 + 총무 6개 메뉴를 사이드바 껍데기로 열어 봄 — 새 화면이 그려지고 옛 화면(iframe)은 불러오지 않음'); if (bad) failed++;
}
console.log('\n' + (failed ? '문제가 있는 화면 ' + failed + '개' : '모든 화면이 열림')); process.exit(failed ? 1 : 0);
