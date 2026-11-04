// 자기평가 칸별 작성 시험(2026-11-04 대표님: 성과면담 가이드 반영 ①) — self-form.js 순수 로직 + 내 평가 화면·제출 조건·결과 통보서 연결
import fs from 'node:fs';
import { composeSelf, parseSelf, selfCheck, selfFromInputs, selfHtml, emptySelf, LIMITS, MAX_TEXT, MARK, WIN_SLOTS, GAP_SLOTS } from '../app/modules/eval/self-form.js';
import { canSubmit, buildSubmission, withText } from '../app/modules/eval/mine-logic.js';
import { selfFieldsHtml, mineFormHtml } from '../app/modules/eval/mine-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const full = { wins: ['설치 일정 2일 단축', '신입 교육 담당', '지적 사항 0건'], gaps: ['일정 공유 지연', '작업일보 지연'], goal: '도면을 혼자 읽고\n수정 제안까지', support: '월 1회 도면 교육', etc: '면담에서 이야기하고 싶은 것' };
// ── 합치기
const t = composeSelf(full);
ok(t === '[올해 성과]\n1. 설치 일정 2일 단축\n2. 신입 교육 담당\n3. 지적 사항 0건\n\n[아쉬운 점]\n1. 일정 공유 지연\n2. 작업일보 지연\n\n[내년 성장 목표]\n도면을 혼자 읽고\n수정 제안까지\n\n[필요한 지원]\n월 1회 도면 교육\n\n[그 밖에 하고 싶은 말]\n면담에서 이야기하고 싶은 것', '★ 합치기: 구역 표시와 번호가 붙은 한 덩어리 text(저장 필드는 text 하나)');
ok(composeSelf({ wins: ['', '성과 하나', ''] }) === '[올해 성과]\n1. 성과 하나' && composeSelf(emptySelf()) === '' && composeSelf(null) === '' && composeSelf({}) === '', '채운 칸만 쓰고 번호는 채운 것끼리 이어 붙인다(1.), 모두 비면 빈 글');
ok(composeSelf({ wins: ['  앞뒤 공백 \n 줄바꿈 포함  '] }) === '[올해 성과]\n1. 앞뒤 공백 줄바꿈 포함', '목록 칸은 한 줄로(줄바꿈은 공백으로), 앞뒤 공백 제거');
const big = { wins: ['가'.repeat(900), '나'.repeat(900), '다'.repeat(900)], gaps: ['라'.repeat(900), '마'.repeat(900)], goal: '바'.repeat(900), support: '사'.repeat(900), etc: '아'.repeat(900) };
const bt = composeSelf(big); const bp = parseSelf(bt);
ok(bp.wins.every((v) => v.length === LIMITS.win) && bp.gaps.every((v) => v.length === LIMITS.gap) && bp.goal.length === LIMITS.goal && bp.support.length === LIMITS.support && bp.etc.length === LIMITS.etc, '★ 칸별 글자 상한(성과·아쉬운 점 240 · 성장 목표 260 · 지원 180 · 그 밖 260)을 넘으면 잘리고, 마지막 칸까지 모두 상한 그대로 남는다(끝이 조용히 잘리지 않음)');
ok(bt.length <= MAX_TEXT && bt.length === 1977, '★ 모든 칸을 상한까지 채워도 text 는 2,000자(보안 규칙 상한) 이하 — 최악 ' + bt.length + '자(2,000을 넘으면 마지막 칸이 잘림)');
ok(LIMITS.win * 3 + LIMITS.gap * 2 + LIMITS.goal + LIMITS.support + LIMITS.etc + 80 <= MAX_TEXT, '상한을 키우면 이 시험이 먼저 알려 준다: 칸 상한 합계 + 표시·번호·빈 줄(약 80자) ≤ 2,000');
ok(Object.keys(MARK).length === 5 && WIN_SLOTS === 3 && GAP_SLOTS === 2, '구역 5개, 성과 3칸 · 아쉬운 점 2칸');
// ── 되읽기
const r = parseSelf(t);
ok(r.structured === true && r.wins.join('|') === full.wins.join('|') && r.gaps.join('|') === full.gaps.join('|') && r.goal === full.goal && r.support === full.support && r.etc === full.etc, '★ 되읽기: 합친 글을 다시 칸별로 정확히 복원(여러 줄 성장 목표 포함)');
ok(composeSelf(parseSelf(t)) === t, '합치기 → 되읽기 → 합치기가 같은 글(저장·다시 열기를 반복해도 변하지 않음)');
const legacy = parseSelf('올해는 설치 일정을 줄였고\n내년엔 도면 교육을 받고 싶습니다.');
ok(legacy.structured === false && legacy.etc === '올해는 설치 일정을 줄였고\n내년엔 도면 교육을 받고 싶습니다.' && legacy.wins.every((v) => v === '') && legacy.goal === '', '★ 예전 자유 서술(구역 표시 없음)은 「그 밖에 하고 싶은 말」로 읽어 한 글자도 잃지 않는다');
ok(parseSelf('[성과] 대괄호지만 표시가 아님').structured === false && parseSelf('').structured === false && parseSelf(null).etc === '' && parseSelf(undefined).wins.length === 3, '표시와 다른 대괄호·빈 글·null 은 안전하게 예전 방식으로 읽는다');
const pre = parseSelf('머리말 한 줄\n[올해 성과]\n1. 성과');
ok(pre.structured && pre.etc === '머리말 한 줄' && pre.wins[0] === '성과', '첫 구역 표시 앞에 있던 글도 「그 밖에」로 보존');
const extra = parseSelf('[올해 성과]\n1. 가\n2. 나\n3. 다\n4. 라\n5. 마\n[아쉬운 점]\n1) 아쉬움 하나');
ok(extra.wins[2] === '다 · 라 · 마' && extra.gaps[0] === '아쉬움 하나' && extra.gaps[1] === '', '칸 수를 넘는 항목은 마지막 칸에 이어 붙여 잃지 않고, 「1)」 번호 형식도 읽는다');
ok(parseSelf('[올해 성과]\r\n1. CRLF 성과\r\n').wins[0] === 'CRLF 성과' && parseSelf('[필요한 지원]\n').support === '', '줄바꿈이 CRLF 여도 읽고, 내용 없는 구역은 빈 칸');
// ── 제출 조건
ok(selfCheck(parseSelf(composeSelf({ wins: ['성과 하나'] }))).ok && !selfCheck(parseSelf(composeSelf({ goal: '목표만' }))).ok && selfCheck(parseSelf(composeSelf({ goal: '목표만' }))).reason === '올해 성과를 한 가지 이상 써 주세요.', '★ 제출 조건: 올해 성과 한 가지 이상(나머지는 권장 — 성장 목표만 쓰면 안내)');
ok(!selfCheck(parseSelf('')).ok && !selfCheck(null).ok && selfCheck(parseSelf('예전에 쓴 자유 서술')).ok && !selfCheck(parseSelf('   ')).ok, '예전 자유 서술은 비어 있지 않으면 통과, 빈 글은 막힘');
ok(canSubmit('self', { text: composeSelf({ wins: ['성과'] }) }).ok && !canSubmit('self', { text: '' }).ok && canSubmit('self', { text: '올해 성과' }).ok && !canSubmit('self', { text: '[올해 성과]\n' }).ok && !canSubmit('self', { text: 'a'.repeat(2001) }).ok, '★ 내 평가 제출 조건(canSubmit self)이 새 규칙을 쓴다: 구조 글·예전 글 통과, 빈 글·성과 없는 구조 글·2,000자 초과는 막힘');
ok(canSubmit('lead', { scores: { achievement: 4, competency: 4, conduct: 5 } }).ok && !canSubmit('peer', { scores: {} }).ok, '동료·팀원 평가 제출 조건은 그대로');
// ── 화면 입력 → 값
const fi = selfFromInputs([['wins.0', 'a'], ['wins.2', 'c'], ['wins.3', '넘침'], ['gaps.1', 'g'], ['goal', 'G'], ['support', 'S'], ['etc', 'E'], ['hack', 'x'], ['wins.x', 'y']]);
ok(fi.wins.join('|') === 'a||c' && fi.gaps.join('|') === '|g' && fi.goal === 'G' && fi.support === 'S' && fi.etc === 'E' && !('hack' in fi), '칸 이름 → 값: 알 수 없는 이름·범위를 넘는 칸은 무시');
ok(selfFromInputs(null).wins.length === 3 && selfFromInputs([]).goal === '', '입력이 없어도 빈 틀');
// ── 보안 규칙과의 약속(저장 필드)
const sub = buildSubmission(2026, 'U1', 'w1', 'self', withText({ scores: {} }, t), 'submitted', '<ts>');
ok(Object.keys(sub).sort().join() === 'kind,raterUid,scores,status,submittedAt,targetWid,text,updatedAt,year' && sub.text === t, '★ 저장 문서는 규칙이 허용한 필드(text 한 필드)만 — 새 필드를 만들지 않았다');
// ── 결과 통보서·면담 자료 표시
ok(selfHtml('예전 글 <b>x</b>\n둘째 줄', esc) === esc('예전 글 <b>x</b>\n둘째 줄'), '★ 표시: 구역 표시가 없는 글은 예전과 똑같이 이스케이프만(기존 결과 통보서가 바뀌지 않는다)');
const hh = selfHtml(t, esc);
ok(hh.startsWith('<b>올해 성과</b><br>1. 설치 일정 2일 단축<br>2. 신입 교육 담당<br>3. 지적 사항 0건<br><br><b>아쉬운 점</b>') && hh.includes('<b>내년 성장 목표</b><br>도면을 혼자 읽고<br>수정 제안까지') && hh.includes('<b>필요한 지원</b><br>월 1회 도면 교육') && !hh.includes('['), '★ 표시: 구역 제목을 굵게, 번호 목록, 여러 줄은 줄바꿈으로(대괄호 표시는 보이지 않는다)');
ok(!/<script/i.test(selfHtml('[올해 성과]\n1. <script>alert(1)</script>', esc)) && selfHtml('[올해 성과]\n1. <img onerror=x>', esc).includes('&lt;img onerror=x&gt;'), '표시: 직원이 쓴 글은 이스케이프(스크립트 삽입 방지)');
ok(selfHtml('[필요한 지원]\n교육', esc) === '<b>필요한 지원</b><br>교육' && selfHtml('', esc) === '', '표시: 쓴 구역만 보인다, 빈 글은 빈 결과');
const evil = '<script>alert(1)</script>'; const allEvil = composeSelf({ wins: [evil, evil, evil], gaps: [evil, evil], goal: evil, support: evil, etc: evil }); const eh = selfHtml(allEvil, esc);
ok(!/<script/i.test(eh) && (eh.match(/&lt;script&gt;/g) || []).length === 8, '★ 표시: 성과·아쉬운 점·성장 목표·필요한 지원·그 밖 — 모든 칸의 글이 이스케이프된다(8곳 모두)');
const rr = fs.readFileSync(new URL('../app/modules/eval/result-report.js', import.meta.url), 'utf8');
ok(rr.includes("selfHtml(d.selfText, esc)") && !rr.includes("esc(d.selfText)") && rr.includes("import { selfHtml } from './self-form.js"), '★ 결과 통보서: 자기평가를 구역별로 구분해 보여 주는 함수를 쓴다');
// ── 내 평가 화면
const th = selfFieldsHtml(t, false);
ok((th.match(/data-ev-self="wins\.\d"/g) || []).length === 3 && (th.match(/data-ev-self="gaps\.\d"/g) || []).length === 2 && /<textarea[^>]*data-ev-self="goal"/.test(th) && /<textarea[^>]*data-ev-self="support"/.test(th) && /<textarea[^>]*data-ev-self="etc"/.test(th) && (th.match(/data-ev-selfform/g) || []).length === 1, '★ 화면: 성과 3칸 · 아쉬운 점 2칸 · 성장 목표·지원·그 밖 3칸, 칸 묶음 표시는 한 곳');
ok(th.includes('value="설치 일정 2일 단축"') && th.includes('value="일정 공유 지연"') && th.includes('>도면을 혼자 읽고\n수정 제안까지</textarea>') && th.includes('>월 1회 도면 교육</textarea>'), '화면: 저장된 글을 칸별로 채워 보여 준다(다시 열어도 그대로)');
ok(!/ disabled/.test(th) && (selfFieldsHtml(t, true).match(/ disabled/g) || []).length === 8, '화면: 평가 기간이 아니거나 제출 후에는 8칸 모두 잠긴다(입력 불가)');
ok(selfFieldsHtml('[올해 성과]\n1. "따옴표" <태그> & 기호', false).includes('value="&quot;따옴표&quot; &lt;태그&gt; &amp; 기호"'), '화면: 값의 따옴표·꺾쇠는 이스케이프(칸 값 깨짐·삽입 방지)');
ok((th.match(/maxlength="240"/g) || []).length === 5 && (th.match(/maxlength="260"/g) || []).length === 2 && th.includes('maxlength="180"'), '화면: 칸마다 글자 상한(maxlength)이 걸려 있다');
ok(selfFieldsHtml('', false).includes('placeholder="예) 10월 A동 설치 일정을 예정보다 2일 앞당겼다"') && selfFieldsHtml('', false).includes('aria-label="올해 성과 1"'), '화면: 빈 상태에는 예시 문구(placeholder)와 칸 이름(aria-label)');
const st = { mine: { year: 2026, worker: { id: 'w1' }, cycle: { status: 'open' }, tasks: [{ key: '2026__self__w1', year: 2026, kind: 'self', target: 'w1', name: '가' }], subs: {}, sel: '2026__self__w1', draft: { scores: {}, text: '' } } };
const form = mineFormHtml(st); ok(form.includes('data-ev-selfform') && !form.includes('data-ev-text') && form.includes('올해 성과 3개 · 아쉬운 점 2개 · 내년 성장 목표 1개'), '작성 화면(자기평가): 칸별 폼이고 예전 한 칸(data-ev-text)이 아니다');
const peerSt = JSON.parse(JSON.stringify(st)); peerSt.mine.tasks = [{ key: '2026__peer__w2', year: 2026, kind: 'peer', target: 'w2', name: '나' }]; peerSt.mine.sel = '2026__peer__w2';
const peerForm = mineFormHtml(peerSt); ok(peerForm.includes('data-ev-text') && !peerForm.includes('data-ev-selfform'), '★ 동료평가 작성 화면은 그대로(한 칸 서술, 칸별 폼 없음)');
// ── 입력 처리(소스)
const io = fs.readFileSync(new URL('../app/modules/eval/mine-io.js', import.meta.url), 'utf8');
ok(/t\.matches\('\[data-ev-self\]'\)/.test(io) && io.includes('composeSelf(selfFromInputs(pairs))') && io.includes("t.closest('[data-ev-selfform]')") && /if \(!editable\(\)\) return true; const f = t\.closest/.test(io), '★ 입력 처리: 칸을 고치면 같은 묶음의 모든 칸을 모아 text 로 합쳐 임시저장하고, 잠긴 상태에서는 무시');
// ── 제출 단추 활성 표시(쓰는 중에도 맞춘다) — 가짜 화면 요소로 입력 처리를 직접 실행
{ const mod = await import('../app/modules/eval/mine-io.js'); const BaseEl = (globalThis.Element = class Element {});
  class El extends BaseEl { constructor(attrs, props, parent) { super(); this.attrs = attrs || {}; Object.assign(this, props || {}); this.parent = parent || null; this.kids = []; } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; } matches(sel) { return sel.split(',').map((x) => x.trim()).some((x) => { const m = /^\[([\w-]+)\]$/.exec(x); return !!m && m[1] in this.attrs; }); } closest(sel) { let n = this; while (n) { if (sel === 'section' ? n.tag === 'section' : n.matches(sel)) return n; n = n.parent; } return null; } querySelector(sel) { const m = /^\[([\w-]+)="?([^"\]]*)"?\]$/.exec(sel); const find = (n) => { for (const k of n.kids) { if (m && k.attrs[m[1]] === m[2]) return k; const r = find(k); if (r) return r; } return null; }; return find(this); } querySelectorAll(sel) { const m = /^\[([\w-]+)\]$/.exec(sel); const out = []; const walk = (n) => n.kids.forEach((k) => { if (m && m[1] in k.attrs) out.push(k); walk(k); }); walk(this); return out; } }
  const section = new El({}, { tag: 'section' }); const sub = new El({ 'data-ev-act': 'submit', 'aria-disabled': 'true' }, {}, section); const form = new El({ 'data-ev-selfform': '' }, {}, section); section.kids = [sub, form];
  const win0 = new El({ 'data-ev-self': 'wins.0' }, { value: '' }, form); const goal = new El({ 'data-ev-self': 'goal' }, { value: '' }, form); form.kids = [win0, goal];
  const st = {};
  const c = mod.createMineController({ db: {}, collection() {}, getDocs() {}, getDoc() {}, setDoc: async () => {}, doc: () => ({}), query() {}, where() {}, serverTimestamp: () => 't', toast() {}, confirmDialog: async () => ({ ok: true }), paint() {}, st, ctx: { me: { uid: 'U1' } }, year: 2026 });
  Object.assign(st.mine, { sel: '2026__self__w1', tasks: [{ key: '2026__self__w1', kind: 'self', target: 'w1' }], cycle: { status: 'open' }, subs: {}, draft: { scores: {}, text: '' } }); // 컨트롤러가 st.mine 을 스스로 만들므로 그 뒤에 채운다
  goal.value = '목표만'; c.onInput({ target: goal }); ok(sub.attrs['aria-disabled'] === 'true' && st.mine.draft.text === '[내년 성장 목표]\n목표만', '★ 제출 단추: 성과 없이 목표만 쓰면 계속 비활성(제출 조건 미충족)');
  win0.value = '성과 하나'; c.onInput({ target: win0 }); ok(!('aria-disabled' in sub.attrs) && st.mine.draft.text.startsWith('[올해 성과]\n1. 성과 하나'), '★ 제출 단추: 올해 성과를 쓰는 순간 비활성 표시가 풀린다(화면을 다시 그리지 않아도)');
  win0.value = ''; c.onInput({ target: win0 }); ok(sub.attrs['aria-disabled'] === 'true', '성과를 다시 지우면 다시 비활성 표시');
  const before = st.mine.draft.text; st.mine.cycle.status = 'closed'; sub.attrs['aria-disabled'] = 'true'; win0.value = '마감 뒤 입력'; ok(c.onInput({ target: win0 }) === true && sub.attrs['aria-disabled'] === 'true' && st.mine.draft.text === before && !st.mine.draft.text.includes('마감 뒤 입력'), '평가 기간이 끝나면 입력해도 아무것도 바뀌지 않는다(글·제출 단추 그대로)');
}
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
