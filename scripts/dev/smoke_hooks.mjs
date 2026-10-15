import fs from 'node:fs';
export async function resolve(spec, ctx, next) { if (spec.startsWith('https://')) return { url: 'stub:' + encodeURIComponent(spec), shortCircuit: true }; return next(spec, ctx); }
export async function load(url, ctx, next) {
  if (url.startsWith('stub:')) {
    const spec = decodeURIComponent(url.slice(5)); const names = JSON.parse(fs.readFileSync(process.env.JH_STUB_NAMES, 'utf8'));
    const fsNames = ['collection', 'doc', 'getDoc', 'getDocs', 'query', 'where', 'orderBy', 'limit', 'documentId', 'addDoc', 'updateDoc', 'setDoc', 'deleteDoc', 'deleteField', 'serverTimestamp', 'writeBatch', 'Timestamp', 'getFirestore', 'arrayUnion', 'arrayRemove'];
    const isFs = spec.includes('firebase-firestore');
    // httpsCallable(functions, '함수이름') 은 호출 함수를 돌려주고, 호출하면 보낸 값을 globalThis.__CALLS 에 기록한다. 응답은 시나리오가 globalThis.__CALL_REPLY(이름 → 값 또는 함수)로 정해 준 경우에만 돌려주고,
    // 정해 주지 않았으면 오류를 던진다(점검 중 서버 함수가 몰래 성공하는 일이 없게). 오류를 던지려면 __CALL_REPLY[이름] 에 Error 를 넣는다.
    const callable = 'export const httpsCallable = (fns, name) => async (data) => { (globalThis.__CALLS = globalThis.__CALLS || []).push({ name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); const r = (globalThis.__CALL_REPLY || {})[name]; if (r === undefined) { const e = new Error(\'점검 환경: ' + '\' + name + \'의 응답이 정해지지 않았습니다\'); e.code = \'unavailable\'; throw e; } const v = typeof r === \'function\' ? await r(data) : r; if (v instanceof Error) throw v; return { data: v }; };';
    const lines = names.map((n) => (n === 'httpsCallable') ? callable : (isFs && fsNames.includes(n)) ? 'export const ' + n + ' = globalThis.__FS.' + n + ';' : 'export const ' + n + ' = (...a) => ({ __stub: "' + n + '" });');
    return { format: 'module', source: lines.join('\n') + '\nexport default {};', shortCircuit: true };
  }
  return next(url, ctx);
}
