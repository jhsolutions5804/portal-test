// 미분류 메일 받은함 화면 — 공용 규칙(suggestProject·canAssign·showInbox)·화면 문자열(inboxHtml)·이벤트 연결(createInboxPanel, 가짜 브라우저)
import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { JSDOM } = require('../scripts/dev/node_modules/jsdom');
const VER = (fs.readFileSync(new URL('../app/modules/pjt/overview-index.js', import.meta.url), 'utf8').match(/inbox-panel\.js\?v=([0-9a-z]+)/) || [])[1];
const L = await import('../app/shared/pjt-log.js?v=' + VER);
const V = await import('../app/modules/pjt/inbox-view.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK ' + m); } else { fail++; console.log('FAIL ' + m); } };
const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { url: 'https://example.test/' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.Element = dom.window.Element; globalThis.HTMLElement = dom.window.HTMLElement; window.scrollTo = () => {};

// ── 공용 규칙
const P = [{ id: 'a', name: 'P4 Ph2 (FAB) 현장' }, { id: 'b', name: 'P4 Ph4 (SUP)' }, { id: 'c', name: '이천 M14' }];
ok(L.suggestProject('Ph2', P) === 'a' && L.suggestProject('Ph4', P) === 'b', '현장 표기가 든 프로젝트가 하나면 추천');
ok(L.suggestProject('Ph3', P) === '' && L.suggestProject('', P) === '' && L.suggestProject(null, P) === '' && L.suggestProject('Ph2', []) === '', '맞는 프로젝트가 없거나 힌트가 비면 추천 없음');
ok(L.suggestProject('Ph2', [{ id: 'x', name: 'A Ph2' }, { id: 'y', name: 'B Ph2' }]) === '', '★ 같은 표기 프로젝트가 둘이면 추천하지 않는다(모르면 찍지 않는다)');
ok(L.suggestProject('Ph2', [{ id: 'x', name: 'Ph25 현장' }]) === '', '"Ph2" 가 "Ph25" 에 잘못 맞지 않는다');
ok(L.canAssign('a') && !L.canAssign('') && !L.canAssign(null) && !L.canAssign('a/b') && !L.canAssign('x'.repeat(129)), '지정 가능 여부: 비었거나 경로 문자가 있거나 너무 길면 불가');
ok(L.showInbox({ items: [{ id: 'x' }] }) === true && L.showInbox({ items: [] }) === false && L.showInbox(null) === false && L.showInbox({}) === false, '받은함 카드는 항목이 있을 때만 그린다');

// ── 화면 문자열
const IT = (o) => Object.assign({ id: 'a'.repeat(32), date: '2026-10-17', category: '발주처 요청·지시', title: '11월 연장/주말 자료 회신 요청의 件', sourceRef: 'https://outlook.office365.com/owa/?ItemID=1', dueDate: '2026-10-19', restricted: false, siteHint: 'Ph2' }, o);
const ST = (o, items) => Object.assign({ data: { items: items || [IT()], projects: P, total: (items || [IT()]).length }, pick: {}, busy: false, msg: '' }, o || {});
ok(V.inboxHtml({ data: null }) === '' && V.inboxHtml({ data: { items: [], projects: P, total: 0 } }) === '' && V.inboxHtml(null) === '', '★ 비어 있거나 데이터가 없으면 아무것도 그리지 않는다');
const h = V.inboxHtml(ST());
ok(h.includes('미분류 메일') && h.includes('11월 연장/주말 자료 회신 요청의 件') && h.includes('data-ib-act="assign"') && h.includes('data-ib-act="dismiss"') && h.includes('data-ib-pick='), '한 줄: 제목·지정·이 현장 아님·프로젝트 고르기');
ok(/<option value="a" selected>/.test(h), '현장 표기(Ph2)가 맞는 프로젝트가 하나면 미리 선택');
ok(/data-ib-act="assign"[^>]*data-ib-id="a{32}"/.test(h) && !/data-ib-act="assign"[^>]*disabled/.test(h), '미리 선택돼 있으면 지정 버튼이 켜져 있다');
const h2 = V.inboxHtml(ST({}, [IT({ siteHint: '' })])); ok(/data-ib-act="assign"[^>]*disabled/.test(h2) && !/ selected>/.test(h2), '★ 프로젝트가 정해지지 않으면 지정 버튼은 꺼져 있다');
ok(V.inboxHtml(ST({ pick: { ['a'.repeat(32)]: 'b' } })).includes('<option value="b" selected>'), '사람이 고른 값이 추천보다 먼저');
ok(V.inboxHtml(ST({ pick: { ['a'.repeat(32)]: '' } })).includes('data-ib-act="assign"') && /data-ib-act="assign"[^>]*disabled/.test(V.inboxHtml(ST({ pick: { ['a'.repeat(32)]: '' } }))), '사람이 "선택 안 함"으로 되돌리면 추천이 다시 붙지 않고 지정은 꺼진다');
ok(V.inboxHtml(ST({ busy: true })).split('disabled').length - 1 >= 3, '처리 중에는 버튼·선택이 모두 꺼져 중복 클릭을 막는다');
ok(h.includes('10. 17') && h.includes('기한') && V.inboxHtml(ST({}, [IT({ dueDate: '' })])).includes('기한') === false, '날짜와 기한 표시(기한이 없으면 안 보임)');
ok(V.inboxHtml(ST({}, [IT({ restricted: true, title: '(관리자만 볼 수 있는 항목입니다)', sourceRef: '' })])).includes('대외비') && !V.inboxHtml(ST({}, [IT({ restricted: true, title: '(관리자만 볼 수 있는 항목입니다)', sourceRef: '' })])).includes('<a '), '대외비 항목: 칩이 붙고 원문 링크가 없다(서버가 가려 준 그대로)');
ok(V.inboxHtml(ST({ msg: '이력에 후보로 넣었습니다.' })).includes('이력에 후보로 넣었습니다.'), '처리 결과 안내');
ok(V.inboxHtml(ST({}, [IT(), IT({ id: 'b'.repeat(32) })])).includes('2건') && V.inboxHtml({ data: { items: [IT()], projects: P, total: 5 } }).includes('1 / 5건'), '건수 표시(일부만 보이면 전체 건수도)');

// ── ★ 외부에서 온 글자(메일 제목·링크)는 화면 주입이 되지 않는다
const EVIL = '<img src=x onerror=alert(1)><script>alert(2)</script>"\'>';
const he = V.inboxHtml(ST({}, [IT({ title: EVIL, id: 'd'.repeat(32), sourceRef: 'https://example.com/?a="><script>x</script>' })]));
ok(!he.includes('<img src=x') && !he.includes('<script>alert') && !he.includes('<script>x</script>') && he.includes('&lt;img'), '★ 메일 제목의 태그는 글자로만 보인다(이스케이프)');
const dEl = new JSDOM('<div id="r"></div>').window.document.getElementById('r'); dEl.innerHTML = he; ok(dEl.querySelectorAll('img,script').length === 0, '★ 실제로 파싱해도 img·script 요소가 만들어지지 않는다');
ok(!V.inboxHtml(ST({}, [IT({ sourceRef: 'javascript:alert(1)' })])).includes('<a ') && !V.inboxHtml(ST({}, [IT({ sourceRef: 'http://insecure.example/' })])).includes('<a '), '★ 원문 링크는 https 만 연다(javascript:·http: 는 링크로 만들지 않음)');
ok(V.inboxHtml(ST()).includes('rel="noopener noreferrer"') && V.inboxHtml(ST()).includes('target="_blank"'), '원문 링크는 새 창·noopener');
{ const hx = V.inboxHtml(ST({}, [IT({ id: 'x"><b>' })])); ok(hx.includes('data-ib-id="x&quot;&gt;&lt;b&gt;"') && hx.includes('data-ib-row="x&quot;&gt;&lt;b&gt;"') && (hx.match(/<b>/g) || []).length === 1, '★ 항목 번호의 따옴표·태그는 속성 안에서 이스케이프된다(고정 안내 문구의 <b> 한 곳 외에 새 태그가 생기지 않음)'); }

// ── 이벤트 연결(가짜 브라우저·가짜 서버)
const { createInboxPanel } = await import('../app/modules/pjt/inbox-panel.js?v=' + VER); // 브라우저 부품을 직접 불러오지 않는 주입 방식이라 시험에서도 불러와진다
{
  const root = document.getElementById('root'); const calls = []; let answers = { inboxList: { ok: true, items: [IT()], projects: P, total: 1 } }; let changed = 0; let confirmAns = true;
  const confirms = []; const mk = async (o) => { root.innerHTML = ''; calls.length = 0; confirms.length = 0; const callLog = async (p) => { calls.push(p); const a = answers[p.action]; if (a instanceof Error) throw a; return a || { ok: true }; };
    const panel = createInboxPanel(root, Object.assign({ callLog, confirm: async (x) => { confirms.push(x); return { ok: confirmAns, reason: '' }; } /* 실제 core/dialog.js confirmDialog 와 같은 약속 — Promise<{ ok, reason }>. 불리언을 돌려주면 시험이 실제와 어긋나 버그를 못 잡는다 */, onChange: () => { changed++; } }, o || {})); await panel.ready; return panel; };
  const clickBtn = async (sel) => { const el = root.querySelector(sel); if (!el) throw new Error('요소 없음: ' + sel); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 20)); };
  { await mk(); ok(calls[0].action === 'inboxList' && root.querySelectorAll('[data-ib-row]').length === 1, '시작하면 목록을 읽어 그린다'); }
  { answers.inboxList = new Error('permission-denied'); await mk(); ok(root.innerHTML === '', '★ 권한이 없어 서버가 거절하면 아무것도 그리지 않고 오류 문구도 띄우지 않는다'); answers.inboxList = { ok: true, items: [IT()], projects: P, total: 1 }; }
  { answers.inboxList = { ok: true, items: [], projects: P, total: 0 }; await mk(); ok(root.innerHTML === '', '받은함이 비면 아무것도 그리지 않는다'); answers.inboxList = { ok: true, items: [IT()], projects: P, total: 1 }; }
  { await mk(); await clickBtn('[data-ib-act="assign"]'); const a = calls.find((c) => c.action === 'inboxAssign'); ok(a && a.id === 'a'.repeat(32) && a.pjtId === 'a' && !('category' in a), '★ 지정: 미리 선택된 프로젝트로 inboxAssign 을 부른다(서버가 권한을 판정)'); ok(calls.filter((c) => c.action === 'inboxList').length === 2, '지정 뒤에는 목록을 다시 읽는다'); ok(changed >= 1, '지정 뒤 바깥(이력 요약)에 알린다'); ok(/후보로 넣었습니다/.test(root.textContent), '처리 결과 안내가 보인다'); }
  { answers.inboxList = { ok: true, items: [IT({ siteHint: '' })], projects: P, total: 1 }; await mk(); calls.length = 0; const btn = root.querySelector('[data-ib-act="assign"]'); ok(btn.hasAttribute('disabled'), '프로젝트가 정해지지 않으면 지정 버튼이 꺼져 있다'); btn.removeAttribute('disabled'); await clickBtn('[data-ib-act="assign"]'); ok(!calls.some((c) => c.action === 'inboxAssign') && /프로젝트를 먼저 선택/.test(root.textContent), '★ 꺼진 버튼을 억지로 눌러도 프로젝트 없이는 서버를 부르지 않는다'); answers.inboxList = { ok: true, items: [IT()], projects: P, total: 1 }; }
  { answers.inboxList = { ok: true, items: [IT({ siteHint: '' })], projects: P, total: 1 }; await mk(); const sel = root.querySelector('select[data-ib-pick]'); sel.value = 'b'; sel.dispatchEvent(new window.Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); ok(/<option value="b" selected>/.test(root.innerHTML) || root.querySelector('select[data-ib-pick]').value === 'b', '프로젝트를 고르면 화면에 반영된다'); calls.length = 0; await clickBtn('[data-ib-act="assign"]'); const a = calls.find((c) => c.action === 'inboxAssign'); ok(a && a.pjtId === 'b', '고른 프로젝트로 지정한다'); answers.inboxList = { ok: true, items: [IT()], projects: P, total: 1 }; }
  { answers.inboxAssign = new Error('이 프로젝트의 이력을 볼 권한이 없습니다.'); await mk(); await clickBtn('[data-ib-act="assign"]'); ok(/권한이 없습니다/.test(root.textContent), '★ 지정이 서버에서 거절되면 그 사유를 보여 준다'); delete answers.inboxAssign; }
  { const calls2 = []; let release; const slow = new Promise((r) => { release = r; }); const root2 = document.getElementById('root'); root2.innerHTML = ''; const cl = async (p) => { calls2.push(p.action); if (p.action === 'inboxAssign') await slow; return p.action === 'inboxList' ? { ok: true, items: [IT()], projects: P, total: 1 } : { ok: true }; }; const pn = createInboxPanel(root2, { callLog: cl }); await pn.ready; const b = root2.querySelector('[data-ib-act="assign"]'); b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 10)); /* 첫 클릭 뒤 화면이 다시 그려져 b 는 낡은 요소가 된다 — 두 번째 클릭은 다시 그려진 새 버튼(처리 중이라 꺼져 있어도 클릭 이벤트는 보낼 수 있게 disabled 를 풀어)으로 보낸다 */
    const b2 = root2.querySelector('[data-ib-act="assign"]'); b2.removeAttribute('disabled'); b2.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 20)); release(); await new Promise((r) => setTimeout(r, 30)); ok(calls2.filter((x) => x === 'inboxAssign').length === 1, '★ 처리 중에 두 번 눌러도 서버는 한 번만 부른다(중복 방지)'); }
  { confirmAns = true; await mk(); await clickBtn('[data-ib-act="dismiss"]'); const dm = calls.find((c) => c.action === 'inboxDismiss'); ok(confirms.length === 1 && /이 현장 메일 아님/.test(confirms[0].title) && dm && dm.id === 'a'.repeat(32), '★ 치우기: 확인 대화상자를 먼저 띄우고 확인하면 inboxDismiss 를 부른다'); }
  { confirmAns = false; await mk(); await clickBtn('[data-ib-act="dismiss"]'); ok(confirms.length === 1 && !calls.some((c) => c.action === 'inboxDismiss'), '★ 치우기: 확인에서 취소하면 서버를 부르지 않는다'); confirmAns = true; }
  { const src = fs.readFileSync(new URL('../app/core/dialog.js', import.meta.url), 'utf8'); ok(/Promise<\{\s*ok:boolean/.test(src) && /resolve\(\{\s*ok,\s*reason\s*\}\)/.test(src), '★ 실제 확인창(core/dialog.js)은 불리언이 아니라 { ok, reason } 객체를 돌려준다 — 시험의 가짜 확인창이 같은 약속을 쓰는 근거'); }
  { confirmAns = false; await mk(); await clickBtn('[data-ib-act="dismiss"]'); ok(!calls.some((c) => c.action === 'inboxDismiss'), '★ 실제 확인창과 같은 모양({ ok:false })으로 취소하면 서버를 부르지 않는다(객체는 항상 참이라 if (!답) 로는 못 거른다)'); confirmAns = true; }
  { confirmAns = true; await mk(); await clickBtn('[data-ib-act="dismiss"]'); ok(calls.some((c) => c.action === 'inboxDismiss'), '확인({ ok:true })하면 서버를 부른다'); }
  { let threw = false; try { createInboxPanel(root, {}); } catch (e) { threw = true; } ok(threw, '서버 호출 함수(callLog)가 없으면 시작하지 않는다(조용히 잘못 동작하지 않음)'); }
}
console.log('\n' + (fail ? fail + '건 실패' : '전부 통과') + ' (' + pass + '건)'); process.exit(fail ? 1 : 0);
