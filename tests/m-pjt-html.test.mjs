import fs from 'node:fs';
import { createMobileLog } from '../m/pjt-log.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
/* m/pjt.html 은 단독 페이지(Firebase CDN·로그인 필요)라 통째로 실행할 수 없다. 대신 홈·프로젝트 화면을 그리는 함수 두 개를 **실제 파일에서 그대로 뽑아** 최소 환경에서 실행해,
 * 이력 기능을 끼운 자리(중첩 따옴표·템플릿 식)가 올바른지, 이력 기능이 없을 때(불러오기 전·실패)는 기존 화면과 같은지 확인한다. */
const html = fs.readFileSync(new URL('../m/pjt.html', import.meta.url), 'utf8'); const js = (html.match(/<script type="module">([\s\S]*?)<\/script>/) || [])[1] || '';
ok(js.length > 10000, '모듈 스크립트를 찾음');
function fn(name) { const i = js.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (d === 0) return js.slice(i, k + 1); } } return ''; }
const body = fn('renderHome') + '\n' + fn('renderSite'); ok(body.includes('function renderHome') && body.includes('function renderSite'), '홈·프로젝트 화면 그리기 함수를 파일에서 뽑음');
const mkEnv = (LOG, guest, sub) => { let out = ''; const env = { esc: (v) => String(v == null ? '' : v), $app: () => ({ set innerHTML(v) { out = v; } }), _uInitial: 'K', topBar: () => '<top/>', renderCalendar: () => '<cal/>', renderProgress: () => '<prog/>', renderAttend: () => '<attend/>', SITES: { p4ph2: { code: 'P4 Ph2', client: 'C', desc: 'D', ic: 'i', cls: 'c' } }, lightMeta: { X1: { name: '경량', client: 'c', content: 'x' } }, isEndedSite: () => false, isMeRoster: () => false, endedLight: {}, isGuest: guest, LOG, site: 'p4ph2', sub, SITE: () => ({ type: 'static', code: 'P4 Ph2', client: 'C', desc: '', progress: 0 }) };
  const api = new Function(...Object.keys(env), body + '\nreturn { renderHome, renderSite };')(...Object.values(env)); return { api, get out() { return out; } }; };
const ctl = createMobileLog({ call: async () => ({ ok: true, projects: [{ id: 'p4ph2', name: 'P4' }], urgent: [], changes: [], entries: [], total: 0, canConfirm: false }), rerender() {}, ui: { injectStyles() {} }, storage: null, getUid: () => 'u', isGuest: false });
{ const e = mkEnv(null, false, 'sched'); e.api.renderHome(); ok(!e.out.includes('이력') && !e.out.includes('lgClick') && e.out.includes('PJT 메뉴') && e.out.includes('진행 프로젝트'), '★ 홈: 이력 기능이 없으면(불러오기 전·실패) 기존 화면과 같음 — 이력 흔적 없음');
  e.api.renderSite(); ok(!e.out.includes('이력') && e.out.includes('근태') && e.out.includes('일정'), '★ 프로젝트 화면: 이력 기능이 없으면 탭에 "이력"이 없음'); }
{ const e = mkEnv(ctl, false, 'sched'); e.api.renderHome(); ok(e.out.includes('이력관리') && e.out.indexOf('진행 프로젝트') < e.out.indexOf('이력관리') && e.out.indexOf('이력관리') < e.out.indexOf('PJT 메뉴'), '홈: 프로젝트 카드 뒤 · PJT 메뉴 앞에 이력관리');
  e.api.renderSite(); ok(e.out.includes("setSub('log')") && e.out.includes('>이력</div>'), '프로젝트 화면: 탭 줄에 "이력"');
  const e2 = mkEnv(ctl, false, 'log'); e2.api.renderSite(); ok(e2.out.includes("class=\"seg on\" onclick=\"setSub('log')\"") && e2.out.includes('＋ 기록') && !e2.out.includes('<attend/>'), '이력 탭: 선택 표시·이력 본문(＋ 기록)이 그려지고 근태 본문은 아님'); }
{ const e = mkEnv(ctl, true, 'sched'); e.api.renderSite(); ok(!e.out.includes("setSub('log')"), '손님 계정은 이력 탭이 없음'); }
{ const e = mkEnv(null, false, 'log'); e.api.renderSite(); ok(e.out.includes('불러오는 중') && !e.out.includes('<attend/>'), '이력 기능이 아직 없는데 이력 탭 상태(뒤로가기 복원)면 근태가 아니라 "불러오는 중"'); }
// 연결 고리: 불러오기 블록이 기존 화면에 영향을 못 주게 격리돼 있는지(정적 확인)
const blk = js.slice(js.indexOf('(async function(){\n  try{\n    const [fnMod'));
ok(blk.includes('catch(e){ console.error') && blk.includes("import('https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js')") && blk.includes("getFunctions(app,'asia-northeast3')") && blk.includes("import('./pjt-log.js?v="), '불러오기 블록: 동적 import·try/catch 로 격리, PC 와 같은 SDK 버전·지역(asia-northeast3)');
ok(!/^import .*pjt-log/m.test(js) && !/^import .*firebase-functions/m.test(js), '이력 모듈·서버 함수 SDK 를 정적 import 하지 않음(실패해도 페이지 전체가 죽지 않음)');
ok(blk.includes('rerender: ()=>{ try{ render(); }catch(e){} }'), '이력이 화면을 다시 그리다 오류가 나도 삼켜서 기존 화면이 죽지 않게 함');
console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
