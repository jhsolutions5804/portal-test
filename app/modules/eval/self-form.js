/* 자기평가 작성 틀(2026-11-04 대표님: 성과면담 가이드를 인사평가에 반영 ①) — 순수 로직(화면·네트워크 없이 시험).
 * 직원이 「올해 성과 3개 · 아쉬운 점 2개 · 내년 성장 목표 1개 · 필요한 지원」을 칸별로 쓰게 하고, 저장은 기존과 같은 text 한 필드(최대 2,000자)에 구역 표시를 넣어 합친다.
 * 왜 text 한 필드인가: 제출 문서의 보안 규칙(eval_submissions validBody)이 저장 가능한 필드를 year·raterUid·targetWid·kind·scores·text·status·updatedAt·submittedAt 로 고정해 두었다.
 * 새 필드를 더하면 규칙을 다시 게시해야 하므로(테섭·본섭 모두), 규칙·서버·집계(text 를 그대로 면담 자료·결과 통보서에 씀)를 건드리지 않고 text 안에서 구조를 표현한다.
 * 구역 표시가 없는 예전 글(자유 서술)은 「그 밖에 하고 싶은 말」 칸으로 읽어 들여 한 글자도 잃지 않는다. */
export const MAX_TEXT = 2000;
export const WIN_SLOTS = 3, GAP_SLOTS = 2;
/** 칸별 최대 글자 — 모두 상한까지 채워도 구역 표시·번호·빈 줄을 더해 MAX_TEXT(2,000자) 이하가 되도록 잡았다(최악 1,977자, 시험이 확인).
 * 2,000자를 넘으면 합친 글의 끝이 조용히 잘리므로 상한을 키울 때는 반드시 tests/eval-self-form.test.mjs 의 최악 길이 시험을 확인한다 */
export const LIMITS = { win: 240, gap: 240, goal: 260, support: 180, etc: 260 };
export const MARK = { wins: '[올해 성과]', gaps: '[아쉬운 점]', goal: '[내년 성장 목표]', support: '[필요한 지원]', etc: '[그 밖에 하고 싶은 말]' };
const MARK_RE = /^\s*\[(올해 성과|아쉬운 점|내년 성장 목표|필요한 지원|그 밖에 하고 싶은 말)\]\s*$/;
const KEY_OF = { '올해 성과': 'wins', '아쉬운 점': 'gaps', '내년 성장 목표': 'goal', '필요한 지원': 'support', '그 밖에 하고 싶은 말': 'etc' };

export const emptySelf = () => ({ wins: ['', '', ''], gaps: ['', ''], goal: '', support: '', etc: '' });
const one = (s, n) => String(s == null ? '' : s).replace(/\r/g, '').replace(/\s*\n\s*/g, ' ').trim().slice(0, n);
const many = (s, n) => String(s == null ? '' : s).replace(/\r/g, '').trim().slice(0, n);

/** 칸별 입력 → 저장할 text. 비어 있는 구역은 쓰지 않는다. 목록 구역은 채운 칸만 1. 2. 3. 으로 번호를 붙인다 */
export function composeSelf(o) {
  const x = o || {}; const out = [];
  const list = (key, slots, lim) => { const a = (Array.isArray(x[key]) ? x[key] : []).slice(0, slots).map((v) => one(v, lim)).filter(Boolean); if (a.length) out.push(MARK[key] + '\n' + a.map((v, i) => (i + 1) + '. ' + v).join('\n')); };
  list('wins', WIN_SLOTS, LIMITS.win); list('gaps', GAP_SLOTS, LIMITS.gap);
  [['goal', LIMITS.goal], ['support', LIMITS.support], ['etc', LIMITS.etc]].forEach(([k, lim]) => { const v = many(x[k], lim); if (v) out.push(MARK[k] + '\n' + v); });
  return out.join('\n\n').slice(0, MAX_TEXT);
}

/** 저장된 text → 칸별 값. 구역 표시가 하나도 없으면 structured=false 이고 전체를 etc 로 둔다(예전 자유 서술 보존) */
export function parseSelf(text) {
  const t = String(text == null ? '' : text).replace(/\r/g, ''); const o = emptySelf(); const lines = t.split('\n');
  if (!lines.some((l) => MARK_RE.test(l))) { o.etc = t.trim(); o.structured = false; return o; }
  const sec = {}; let cur = null; const pre = [];
  lines.forEach((l) => { const m = MARK_RE.exec(l); if (m) { cur = KEY_OF[m[1]]; (sec[cur] = sec[cur] || []); return; } if (cur) sec[cur].push(l); else pre.push(l); });
  const items = (arr, slots) => { const v = (arr || []).map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean); const head = v.slice(0, slots); if (v.length > slots) head[slots - 1] = head[slots - 1] + ' · ' + v.slice(slots).join(' · '); return head; };
  const w = items(sec.wins, WIN_SLOTS), g = items(sec.gaps, GAP_SLOTS); w.forEach((v, i) => { o.wins[i] = v; }); g.forEach((v, i) => { o.gaps[i] = v; });
  ['goal', 'support', 'etc'].forEach((k) => { o[k] = (sec[k] || []).join('\n').trim(); });
  const head = pre.join('\n').trim(); if (head) o.etc = (head + (o.etc ? '\n' + o.etc : '')).trim(); // 첫 구역 표시 앞의 글도 잃지 않는다
  o.structured = true; return o;
}

/** 제출할 수 있는가 — 올해 성과 한 가지 이상(나머지는 권장). 예전 자유 서술은 비어 있지 않으면 통과 */
export function selfCheck(o) {
  const x = o || {}; const wins = (Array.isArray(x.wins) ? x.wins : []).filter((v) => String(v || '').trim());
  if (x.structured === false) return String(x.etc || '').trim() ? { ok: true } : { ok: false, reason: '올해 성과를 한 가지 이상 써 주세요.' };
  return wins.length ? { ok: true } : { ok: false, reason: '올해 성과를 한 가지 이상 써 주세요.' };
}

/** 화면의 칸(data-ev-self="wins.0" 등) 목록 → 칸별 값. 알 수 없는 이름은 무시 */
export function selfFromInputs(pairs) {
  const o = emptySelf();
  (pairs || []).forEach(([k, v]) => { const m = /^(wins|gaps)\.(\d)$/.exec(String(k)); if (m) { const i = Number(m[2]); if (i < (m[1] === 'wins' ? WIN_SLOTS : GAP_SLOTS)) o[m[1]][i] = v; return; } if (k === 'goal' || k === 'support' || k === 'etc') o[k] = v; });
  return o;
}

/** 결과 통보서·면담 자료에 보일 HTML(이미 이스케이프). 구역 표시가 없으면 예전처럼 이스케이프한 글 그대로 */
export function selfHtml(text, esc) {
  const t = String(text == null ? '' : text); const p = parseSelf(t); if (!p.structured) return esc(t);
  const parts = [];
  const list = (title, arr) => { const v = arr.filter(Boolean); if (v.length) parts.push('<b>' + esc(title) + '</b><br>' + v.map((s, i) => esc((i + 1) + '. ' + s)).join('<br>')); };
  list('올해 성과', p.wins); list('아쉬운 점', p.gaps);
  [['내년 성장 목표', p.goal], ['필요한 지원', p.support], ['그 밖에 하고 싶은 말', p.etc]].forEach(([title, v]) => { if (v) parts.push('<b>' + esc(title) + '</b><br>' + esc(v).replace(/\n/g, '<br>')); });
  return parts.join('<br><br>');
}
