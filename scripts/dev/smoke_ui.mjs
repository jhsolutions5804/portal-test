/* 화면 열기 점검: 가짜 브라우저(jsdom)와 가짜 Firestore(샘플 문서)로 인사·총무·재무회계의 모든 화면을 실제로 열고(`--click` 이면 버튼도 하나씩 눌러) 오류가 나는 화면을 찾는다.
 * 순수 함수 시험이 못 보는 화면 코드의 빠진 import·잘못된 호출을 잡는다(문제가 있으면 종료 코드 1).
 * 사용: cd scripts/dev && npm i espree eslint-scope jsdom   →   node --import ./smoke_register.mjs smoke_ui.mjs [--click]
 * 한계: 로그인·보안 규칙·실제 데이터 모양은 보지 못한다 — 마지막 확인은 테섭에서 직접 열어 본다. */
import { w, D, put, errors, sleep, markDone } from './smoke_env.mjs';
import fs from 'node:fs';
const plan = await import(new URL('../../app/modules/plan/index.js', import.meta.url).href);
const pjtM = await import(new URL('../../app/modules/pjt/index.js', import.meta.url).href);
const hr = await import(new URL('../../app/modules/hr/index.js', import.meta.url).href); const gen = await import(new URL('../../app/modules/general/index.js', import.meta.url).href); const fin = await import(new URL('../../app/modules/finance/index.js', import.meta.url).href);
const ctx = { me: { admin: true, uid: 'u1', name: '관리자', email: 'a@jhsol.kr', perms: {} } };
const targets = [...Object.keys(hr).filter((k) => /^mount/.test(k)).map((k) => ['hr.' + k, hr[k]]), ['general.mountSection', gen.mountSection], ['plan.mountCompanies', plan.mountCompanies], ['plan.mountPartners', plan.mountPartners], ['plan.mountProjects', plan.mountProjects], ['plan.mountEstimates', plan.mountEstimates], ['plan.mountBilling', plan.mountBilling], ['plan.mountPayout', plan.mountPayout], ['plan.mountTeamLabor', plan.mountTeamLabor], ['plan.mountHome', plan.mountHome], ['plan.mountClosing', plan.mountClosing], ['pjt.mountAttend', pjtM.mountAttend], ['plan.mountAcct', plan.mountAcct], ['plan.mountContracts', plan.mountContracts]]; for (const t of ['home', 'entries', 'expense', 'import', 'reports', 'monthly', 'forecast', 'gap', 'rules', 'opening', 'settings']) targets.push(['finance/' + t, (root, route, c) => fin.mount(root, { segs: [t], query: {} }, c)]);
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
  const def = LEGACY_DEFS.find((d) => d.id === 'hr'); const keys = def.groups[0].clusters.flatMap((c) => c.keys).concat(['home', 'hrcal']); /* hrcal(인사 캘린더)은 메뉴에서 빼고 주소로만 연다 */ let bad = 0; const keep = document.createElement('div'); document.body.appendChild(keep);
  const routes = keys.map((k) => ({ segs: [k], query: {} })).concat(['home', 'lease', 'vehicle', 'drive', 'asset', 'renewal'].map((t) => ({ segs: ['general', t], query: {} })));
  for (const r of routes) { errors.length = 0; try { await Promise.race([mountLegacy(def, keep, r, ctx), sleep(2500)]); await sleep(60); } catch (e) { errors.push('껍데기 예외: ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' | ')); }
    const wrap = keep.querySelector('.jh-legacy'); const nat = wrap && wrap.querySelector('.jh-legacy__native'); const frame = wrap && wrap.querySelector('iframe'); const cur = wrap && wrap.querySelector('.jh-sidenav__item[aria-current="page"]');
    const problems = []; if (!wrap) problems.push('틀 없음'); else { if (wrap.querySelector('.jh-sidenav') == null) problems.push('사이드바 없음'); if (!nat || nat.hidden || nat.innerHTML.length < 50) problems.push('새 화면 영역이 비어 있음'); if (frame && frame.getAttribute('src')) problems.push('옛 화면(iframe)이 불러와짐'); if (!cur) problems.push('현재 메뉴 표시 없음'); }
    if (errors.length) problems.push(errors[0].slice(0, 160)); if (problems.length) { bad++; console.log('✗ 껍데기', r.segs.join('/').padEnd(22), problems.join(' · ')); } }
  console.log(bad ? '✗ 껍데기 점검: 문제 ' + bad + '건 / ' + routes.length + '개 메뉴' : '✓ 껍데기 점검: 인사 ' + keys.length + '개 + 총무 6개 메뉴를 사이드바 껍데기로 열어 봄 — 새 화면이 그려지고 옛 화면(iframe)은 불러오지 않음'); if (bad) failed++;
}

// ── PJT 틀: 프로젝트를 고른 뒤 그 아래 탭(기존 화면 / 출역·공수 새 화면). 새 화면에는 프로젝트 선택이 없고, 탭 전환 때 옛 화면(iframe)이 제대로 불러와지는지 확인 ──
{
  const V = '?v=' + (fs.readFileSync(new URL('../../app/modules/index.js', import.meta.url), 'utf8').match(/\?v=(\w+)/) || [])[1]; await import(new URL('../../app/modules/index.js' + V, import.meta.url).href); const { mountLegacy } = await import(new URL('../../app/modules/legacy/frame.js' + V, import.meta.url).href); const { LEGACY_DEFS } = await import(new URL('../../app/modules/legacy/list.js' + V, import.meta.url).href);
  window.JH_HOLIDAYS = window.JH_HOLIDAYS || {}; window.JH_HOLIDAY_DATES = window.JH_HOLIDAY_DATES || [];
  const def = LEGACY_DEFS.find((d) => d.id === 'pjt'); const keep = document.createElement('div'); document.body.appendChild(keep); const problems = []; errors.length = 0;
  const open = async (segs) => { try { await Promise.race([mountLegacy(def, keep, { segs, query: {} }, ctx), sleep(2500)]); await sleep(120); } catch (e) { problems.push('틀 예외: ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' | ')); } return keep.querySelector('.jh-legacy'); };
    const nat = () => wrap.querySelector('.jh-legacy__native'), frame = () => wrap.querySelector('iframe'), sub = () => wrap.querySelector('.jh-legacy__subnav');
    let wrap = await open(['p4ph2', 'attend']); if (!wrap) problems.push('틀 없음'); else {
    const TABS = ['home', 'schedule', 'progress', 'attend', 'report', 'settings'];
    const chk = (key, subName, re, label) => { if (!nat() || nat().hidden || !re.test(nat().textContent) || !new RegExp(label.replace(/[()]/g, '\\$&')).test(nat().textContent) || !sub() || !sub().querySelector('a[data-sub="' + subName + '"][aria-current="page"]')) problems.push(key + ' ' + subName + ' 화면이 안 열리거나 현재 탭 표시가 틀림'); };
    chk('p4ph2', 'attend', /출역/, 'P4 Ph2 (FAB)');
    if (frame() && frame().getAttribute('src')) problems.push('새 화면인데 옛 화면(iframe)이 불러와짐');
    if (!sub() || [...sub().querySelectorAll('a')].map((a) => a.getAttribute('data-sub')).join() !== TABS.join() || sub().querySelector('a[data-sub="legacy"]')) problems.push('프로젝트 아래 탭 줄이 홈·일정·공정·출역·공수·공사일보·설정 6개(옛 화면 칩 없음)가 아님');
    for (const [name, re] of [['report', /공사일보/], ['settings', /설정/], ['schedule', /일정/], ['progress', /공정 현황/]]) { wrap = await open(['p4ph2', name]); chk('p4ph2', name, re, 'P4 Ph2 (FAB)'); }
    wrap = await open(['p4ph2']); chk('p4ph2', 'home', /프로젝트 홈/, 'P4 Ph2 (FAB)');   // 프로젝트를 고르면 새 홈이 기본
    wrap = await open(['p4ph2', 'zzz']); chk('p4ph2', 'home', /프로젝트 홈/, 'P4 Ph2 (FAB)');   // 모르는 탭 이름은 홈
    wrap = await open(['p4ph2', 'legacy']); chk('p4ph2', 'home', /프로젝트 홈/, 'P4 Ph2 (FAB)');   // 옛 화면 주소도 홈(옛 화면은 없음)
    wrap = await open(['p4ph4', 'attend']); chk('p4ph4', 'attend', /출역/, 'P4 Ph4 (SUP)');
    wrap = await open(['home']); if (sub()) problems.push('PJT 홈에는 프로젝트 아래 탭 줄이 없어야 함');   // (메뉴의 "PJT 홈"은 프로젝트가 아닌 전체 화면)
    wrap = await open(['roster']); await sleep(300); if (!nat() || nat().hidden || !/근로자 연명부/.test(nat().textContent) || !/조치 필요 현황/.test(nat().textContent) || (frame() && !frame().hidden)) problems.push('메뉴의 근로자 연명부가 새 화면으로 안 열림(옛 화면이 열리거나 목록이 안 그려짐)'); if (sub()) problems.push('근로자 연명부에는 프로젝트 아래 탭 줄이 없어야 함');
    wrap = await open(['REG1', 'attend']); chk('REG1', 'attend', /가/, 'H17L Gas RM. 전환공사');   // 모든 프로젝트가 같은 화면
    wrap = await open(['p4ph2', 'attend', '2026-07-02']); if (!nat() || !/2026-07-02/.test(nat().textContent)) problems.push('주소의 날짜(#/pjt/<프로젝트>/attend/<날짜>)로 열리지 않음');
  }
  if (errors.length) problems.push(errors[0].slice(0, 160)); keep.remove();
  if (problems.length) { console.log('✗ PJT 틀 점검: ' + problems.join(' · ')); failed++; } else console.log('✓ PJT 틀 점검: 프로젝트를 고르면 새 홈이 열리고 그 아래 탭 6개(홈·일정·공정·출역·공수·공사일보·설정)가 모든 프로젝트(Ph2·Ph4·그 밖)에서 똑같이 열림 — 새 화면에 프로젝트 선택이 없고 프로젝트 이름만 보이며 옛 화면(iframe)은 쓰지 않음');
}

// ── 영업기획 껍데기: 사이드바 + 새 화면(거래처·협력사). 옛 화면 탭(홈·프로젝트·견적·정산·회계)은 iframe 이 열리는 것이 정상이라 틀·사이드바·현재 메뉴 표시만 확인 ──
{
  const V = '?v=' + (fs.readFileSync(new URL('../../app/modules/index.js', import.meta.url), 'utf8').match(/\?v=(\w+)/) || [])[1]; const { mountLegacy } = await import(new URL('../../app/modules/legacy/frame.js' + V, import.meta.url).href); const { LEGACY_DEFS } = await import(new URL('../../app/modules/legacy/list.js' + V, import.meta.url).href);
  const def = LEGACY_DEFS.find((d) => d.id === 'plan'); const keep = document.createElement('div'); document.body.appendChild(keep); let bad = 0;
  for (const key of ['home', 'projects', 'closing', 'est', 'billing', 'payout', 'teamlabor', 'comp', 'partners', 'acct']) { errors.length = 0; try { await Promise.race([mountLegacy(def, keep, { segs: [key], query: {} }, ctx), sleep(2500)]); await sleep(60); } catch (e) { errors.push('껍데기 예외: ' + String((e && e.stack) || e).split('\n').slice(0, 2).join(' | ')); }
    const wrap = keep.querySelector('[data-legacy-mod="plan"]'); const nat = wrap && wrap.querySelector('.jh-legacy__native'); const frame = wrap && wrap.querySelector('iframe'); const cur = wrap && wrap.querySelector('.jh-sidenav__item[aria-current="page"]'); const native = ['home', 'projects', 'closing', 'est', 'billing', 'payout', 'teamlabor', 'comp', 'partners', 'contracts', 'acct'].includes(key); const problems = [];
    if (!wrap) problems.push('틀 없음'); else { if (!wrap.querySelector('.jh-sidenav')) problems.push('사이드바 없음'); if (!cur || cur.getAttribute('data-key') !== key) problems.push('현재 메뉴 표시가 ' + key + ' 가 아님'); if (native) { if (!nat || nat.hidden || nat.innerHTML.length < 50) problems.push('새 화면 영역이 비어 있음'); if (frame && frame.getAttribute('src')) problems.push('새 화면인데 옛 화면(iframe)이 불러와짐'); } else if (!frame || !frame.getAttribute('src') || !/gihoek\/.*tab=/.test(frame.getAttribute('src'))) problems.push('옛 화면 주소(탭 값 포함)가 없음: ' + (frame && frame.getAttribute('src'))); }
    if (errors.length) problems.push(errors[0].slice(0, 160)); if (problems.length) { bad++; console.log('✗ 영업기획 껍데기', key.padEnd(10), problems.join(' · ')); } }
  console.log(bad ? '✗ 영업기획 껍데기 점검: 문제 ' + bad + '건' : '✓ 영업기획 껍데기 점검: 새 화면 11개(홈·프로젝트·월말 마감·견적·청구·지급·팀별 노무비·거래처·협력사·위탁 계약서·비용장부 대조)는 모두 그려지고 옛 화면(iframe)에 의존하는 메뉴는 없음, 사이드바 현재 메뉴 표시 일치'); if (bad) failed++;
}
markDone(); console.log('\n' + (failed ? '문제가 있는 화면 ' + failed + '개' : '모든 화면이 열림')); process.exit(failed ? 1 : 0);
