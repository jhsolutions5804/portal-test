const modules = new Map();
export function register(manifest) { modules.set(manifest.id, manifest); }
export function get(id) { return modules.get(id) || null; }
export function visibleFor(me) {
  return [...modules.values()].filter(m => !m.perm || m.perm(me));
}
