/* 근로자 연명부 도구 — 순수 규칙(화면·네트워크 없이 시험 가능): ① 월간 공수 보기(프로젝트별·개인별 합계, 명단 밖 공수 기록) ② 기존 인원 마이그레이션(프로젝트 명단에만 있는 사람을 마스터 명부로).
 * 모든 프로젝트가 pjt_registry/<id> 한 구조라서 프로젝트 종류를 나누지 않는다. 사람은 마스터 id 로 묶는다(프로젝트 명단 문서 id = 마스터 id 가 원칙). */
const pad = (n) => String(n).padStart(2, '0');
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
/** 월 범위(문서 id 가 날짜라서 범위 조회로 그 달 문서만 읽는다) */
export const monthRange = (y, m) => ({ lo: y + '-' + pad(m + 1) + '-01', hi: y + '-' + pad(m + 1) + '-31' });
/** 종료 시각(파이어스토어 시각 {seconds}) → 종료한 달의 번호(연×12+월0~11, 한국 시간). 시각이 없거나 2000년 이전 값이면 null */
export function endedYmOf(endedAt) { const sec = endedAt && (endedAt.seconds != null ? endedAt.seconds : endedAt._seconds); if (!sec || sec < 946684800) return null; const d = new Date(sec * 1000 + 9 * 3600 * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
/** 그 달(y, m=0~11)에 월간 공수에 보여 줄 프로젝트인가: 진행 중이면 항상, 종료된 프로젝트는 종료한 달까지만(예: 9월에 종료 → 9월까지 보이고 10월부터 숨김). 종료한 달을 모르면(옛 데이터) 그 달에 공수 기록이 있을 때만 */
export function visibleInMonth(p, y, m, hasData) { if (!p || !p.ended) return true; if (p.endedYm == null) return !!hasData; return y * 12 + m <= p.endedYm; }
/** 월간 공수 집계.
 *  projects: [{ key, name, ended, roster: { 직원id: { name, birth } }, rows: [[날짜, { 직원id: 공수 }], …] }] · masters: { id: { name, birth } }
 *  → { grand, pjtTotals[{key,name,ended,workerCount,total}], persons[{key,name,birth,masterId,total,byPjt,byDate}], unknown[{pjt,date,id,amount}], unknownTotal, missingBirth[{pjt,id,name}] } */
export function aggregateMonth(projects, masters) {
  const M = masters || {}; const persons = {}, unknown = [], missing = [], seenMissing = new Set(); const pjtTotals = [];
  (projects || []).forEach((p) => {
    const roster = p.roster || {}; const t = { key: p.key, name: p.name, ended: !!p.ended, workerCount: Object.keys(roster).length, total: 0 }; pjtTotals.push(t);
    (p.rows || []).forEach(([date, md]) => Object.keys(md || {}).forEach((id) => {
      const a = num(md[id]); if (!a) return;
      const m = M[id], w = roster[id]; const who = m ? { name: m.name || (w && w.name) || '', birth: m.birth || (w && w.birth) || '' } : w ? { name: w.name || '', birth: w.birth || '' } : null;   // 마스터가 있으면 마스터 정보가 우선(프로젝트 명단에 없어도 마스터면 집계에 넣는다)
      if (!who) { unknown.push({ pjt: p.name, pjtKey: p.key, date, id, amount: r1(a) }); return; }
      t.total += a; const pk = m ? 'm:' + id : (who.name || '').trim() + '|' + (who.birth || 'MISSING');
      const P = persons[pk] || (persons[pk] = { key: pk, name: who.name, birth: who.birth, masterId: m ? id : '', total: 0, byPjt: {}, byDate: {} });
      P.total += a; P.byPjt[p.name] = (P.byPjt[p.name] || 0) + a; ((P.byDate[date] = P.byDate[date] || {})[p.name] = (P.byDate[date][p.name] || 0) + a);
      if (!who.birth && !m) { const mk = p.key + '|' + id; if (!seenMissing.has(mk)) { seenMissing.add(mk); missing.push({ pjt: p.name, id, name: who.name }); } }
    }));
    t.total = r1(t.total);
  });
  const list = Object.keys(persons).map((k) => { const P = persons[k]; P.total = r1(P.total); Object.keys(P.byPjt).forEach((n) => { P.byPjt[n] = r1(P.byPjt[n]); }); return P; }).sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'ko'));
  unknown.sort((a, b) => b.amount - a.amount || String(a.date).localeCompare(String(b.date)));
  return { grand: r1(pjtTotals.reduce((x, y) => x + y.total, 0)), pjtTotals: pjtTotals.sort((a, b) => b.total - a.total), persons: list, unknown, unknownTotal: r1(unknown.reduce((x, y) => x + y.amount, 0)), missingBirth: missing };
}
/** 개인별 공수표(날짜 순): [{ date, items:[{pjt, amount}], sum }] */
export const personSheet = (P) => Object.keys((P && P.byDate) || {}).sort().map((d) => { const items = Object.keys(P.byDate[d]).map((pjt) => ({ pjt, amount: r1(P.byDate[d][pjt]) })); return { date: d, items, sum: r1(items.reduce((x, y) => x + y.amount, 0)) }; });
/** 마이그레이션 대상: 프로젝트 명단에는 있는데 마스터 명부에 없는 사람 — 이름으로 묶는다.
 *  projects: [{ key, name, roster:{id:{name,birth}} }] · masters: { id:{name,birth} } → [{ name, items:[{pjtKey,pjtName,id,birth}], births[], sameNameMaster: 같은 이름의 마스터가 이미 있는가 }] 이름순 */
export function migrationGroups(projects, masters) {
  const M = masters || {}; const byName = {}; const masterNames = new Set(Object.keys(M).map((id) => (M[id].name || '').trim()));
  (projects || []).forEach((p) => Object.keys(p.roster || {}).forEach((id) => { if (M[id]) return; const w = p.roster[id] || {}; const name = (w.name || '(이름없음)').trim(); (byName[name] = byName[name] || []).push({ pjtKey: p.key, pjtName: p.name, id, birth: w.birth || '' }); }));
  return Object.keys(byName).sort((a, b) => a.localeCompare(b, 'ko')).map((name) => { const items = byName[name]; return { name, items, births: Array.from(new Set(items.map((x) => x.birth).filter(Boolean))), sameNameMaster: masterNames.has(name) }; });
}
/** 마스터 등록 계획 → { error, warnBirths, masterId, master, rate, workerSets[{pjtKey,id,data}], workerDeletes[{pjtKey,id}], rekeys[{pjtKey,from,to}] }.
 *  마스터 id 는 처음 발견된 명단 문서의 id 를 그대로 쓴다(그 프로젝트의 기존 기록 보존). 다른 문서는 마스터 id 로 다시 만들고 옛 문서는 지우며, 그 문서의 공수·출역 기록의 id 도 마스터 id 로 바꿀 대상이다 */
export function planMigration(group, input, masters) {
  const items = (group && group.items) || []; if (!items.length) return { error: '등록할 항목이 없습니다.' };
  const name = String((input && input.name) || group.name || '').trim(); const birth = String((input && input.birth) || '').trim(); if (!birth) return { error: '생년월일을 입력하세요.' }; if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { error: '생년월일 형식이 올바르지 않습니다.' };
  const masterId = items[0].id; const ex = (masters || {})[masterId]; if (ex && ex.name !== name) return { error: '마스터 ID(' + masterId + ')가 이미 다른 근로자(' + ex.name + ')로 등록되어 있어 진행할 수 없습니다.' };
  const master = { name, birth, leaderId: String((input && input.leaderId) || '') }; const rate = Math.max(0, Math.round(num(String((input && input.rate) || '').replace(/[,원\s]/g, ''))));
  const workerSets = [], workerDeletes = [], rekeys = [];
  items.forEach((it) => { if (it.id === masterId) return; workerSets.push({ pjtKey: it.pjtKey, id: masterId, data: { name, birth, masterId, order: 999 } }); workerDeletes.push({ pjtKey: it.pjtKey, id: it.id }); rekeys.push({ pjtKey: it.pjtKey, from: it.id, to: masterId }); });
  return { error: '', warnBirths: group.births && group.births.length > 1 ? group.births : [], masterId, master, rate, workerSets, workerDeletes, rekeys };
}
/** 공수 기록(md 맵) 안의 id 바꾸기 → 바뀐 맵 또는 null(해당 id 없음). 마스터 id 에 이미 값이 있으면 합친다 */
export function rekeyMd(md, from, to) { if (!md || !(from in md) || from === to) return null; const out = Object.assign({}, md); const a = num(md[from]), b = num(md[to]); delete out[from]; out[to] = (to in md) ? r1(a + b) : md[from]; return out; }
/** 출역 체크 목록 안의 id 바꾸기 → 바뀐 목록 또는 null(해당 id 없음). 이미 마스터 id 가 있으면 중복 없이 */
export function rekeyChecks(checks, from, to) { if (!Array.isArray(checks) || checks.indexOf(from) === -1 || from === to) return null; const out = []; checks.forEach((c) => { const v = c === from ? to : c; if (out.indexOf(v) === -1) out.push(v); }); return out; }
/** 같은 이름의 마스터가 이미 있는 명단 항목을 그 마스터로 합치는 계획 → { error, masterId, workerSets, workerDeletes, rekeys }.
 *  프로젝트 명단에 그 마스터 id 가 이미 있으면 새로 만들지 않고 옛 문서만 지운다. projects 는 migrationGroups 에 쓴 것과 같은 목록 */
export function planMerge(group, masterId, masters, projects) {
  const m = (masters || {})[masterId]; if (!m) return { error: '합칠 마스터를 찾을 수 없습니다.' }; const items = (group && group.items) || []; if (!items.length) return { error: '합칠 항목이 없습니다.' };
  const byKey = {}; (projects || []).forEach((p) => { byKey[p.key] = p; }); const workerSets = [], workerDeletes = [], rekeys = [];
  items.forEach((it) => { if (it.id === masterId) return; const has = byKey[it.pjtKey] && byKey[it.pjtKey].roster && byKey[it.pjtKey].roster[masterId]; if (!has) workerSets.push({ pjtKey: it.pjtKey, id: masterId, data: { name: m.name, birth: m.birth || '', masterId, order: 999 } }); workerDeletes.push({ pjtKey: it.pjtKey, id: it.id }); rekeys.push({ pjtKey: it.pjtKey, from: it.id, to: masterId }); });
  return { error: '', masterId, workerSets, workerDeletes, rekeys };
}
/** 명단 밖 공수 기록을 (프로젝트, 직원 id)별로 묶음 → [{ pjtKey, pjt, id, count, total, first, last }] 공수 큰 순 */
export function unknownGroups(unknown) {
  const g = {}; (unknown || []).forEach((u) => { const k = u.pjtKey + '|' + u.id; const o = g[k] || (g[k] = { pjtKey: u.pjtKey, pjt: u.pjt, id: u.id, count: 0, total: 0, first: u.date, last: u.date }); o.count++; o.total += u.amount; if (u.date < o.first) o.first = u.date; if (u.date > o.last) o.last = u.date; });
  return Object.keys(g).map((k) => { const o = g[k]; o.total = r1(o.total); return o; }).sort((a, b) => b.total - a.total || String(a.id).localeCompare(String(b.id)));
}
/** 명단 밖 직원 id 를 마스터에게 연결하는 계획 → { error, workerSets, rekeys }. 그 프로젝트 명단에 마스터 id 가 없으면 새로 만들고(출역·공수 화면에 나오게), 그 프로젝트의 모든 날짜의 공수·출역 기록 id 를 마스터 id 로 바꾼다.
 *  group = unknownGroups 의 한 항목, project = { key, roster } */
export function planLink(group, masterId, masters, project) {
  const m = (masters || {})[masterId]; if (!m) return { error: '연결할 근로자를 고르세요.' }; if (!group || !group.id) return { error: '연결할 공수 기록을 찾을 수 없습니다.' };
  const has = project && project.roster && project.roster[masterId]; const workerSets = has ? [] : [{ pjtKey: group.pjtKey, id: masterId, data: { name: m.name, birth: m.birth || '', masterId, order: 999 } }];
  return { error: '', workerSets, rekeys: [{ pjtKey: group.pjtKey, from: group.id, to: masterId }] };
}
