import fs from 'node:fs';
export async function resolve(spec, ctx, next) { if (spec.startsWith('https://')) return { url: 'stub:' + encodeURIComponent(spec), shortCircuit: true }; return next(spec, ctx); }
export async function load(url, ctx, next) {
  if (url.startsWith('stub:')) {
    const spec = decodeURIComponent(url.slice(5)); const names = JSON.parse(fs.readFileSync(process.env.JH_STUB_NAMES, 'utf8'));
    const fsNames = ['collection', 'doc', 'getDoc', 'getDocs', 'query', 'where', 'orderBy', 'limit', 'addDoc', 'updateDoc', 'setDoc', 'deleteDoc', 'deleteField', 'serverTimestamp', 'writeBatch', 'Timestamp', 'getFirestore'];
    const isFs = spec.includes('firebase-firestore');
    const lines = names.map((n) => (isFs && fsNames.includes(n)) ? 'export const ' + n + ' = globalThis.__FS.' + n + ';' : 'export const ' + n + ' = (...a) => ({ __stub: "' + n + '" });');
    return { format: 'module', source: lines.join('\n') + '\nexport default {};', shortCircuit: true };
  }
  return next(url, ctx);
}
