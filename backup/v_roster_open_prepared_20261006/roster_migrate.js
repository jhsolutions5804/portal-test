#!/usr/bin/env node
/* 근로자 연명부 데이터 이전 — master_worker_private(관리자 전용)에 섞여 있던 실무자 항목을 master_worker_info(실무자)로 옮긴다.
 * 대표님 결정(2026-10-06): 은행·계좌번호·일당(단가)만 관리자 전용, 나머지는 실무자가 등록·조회·수정.
 *
 * 사용: GOOGLE_APPLICATION_CREDENTIALS=서비스계정.json node scripts/roster_migrate.js <단계> [--project=프로젝트ID] [--apply]
 *   단계  plan   : 읽기만 — 옮길 문서·항목 개수(값은 출력하지 않음)
 *         copy   : private → info 로 복사(merge). private 원본은 그대로 둔다(되돌릴 수 있음)
 *         verify : private 의 옮길 항목이 info 와 같은지 전부 비교(다르면 목록, 값은 출력하지 않음)
 *         clean  : verify 가 모두 같을 때만 private 에서 옮긴 항목을 지운다(되돌릴 수 없음)
 *   --apply 가 없으면 copy·clean 도 읽기만(모의 실행). 규칙(rules_roster_open_*.rules) 게시 후에만 실행할 것.
 * 이 스크립트는 비밀 값을 담지 않는다(서비스 계정 키는 저장소 밖 파일로, secret_check.py 가 감시). */
const path = require('path');
const admin = require(process.env.FIREBASE_ADMIN_PATH || path.join(__dirname, '..', 'functions', 'edoc', 'node_modules', 'firebase-admin'));
const ADMIN_KEYS = ['bank', 'account', 'dailyRate', 'teamRate'];       // 관리자 전용으로 남는 항목
const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const phase = process.argv[2]; const apply = process.argv.includes('--apply'); const projectId = arg('project') || 'portal-test-6e0ff';
if (!['plan', 'copy', 'verify', 'clean'].includes(phase)) { console.error('단계를 지정하세요: plan | copy | verify | clean'); process.exit(2); }
admin.initializeApp({ projectId }); const db = admin.firestore(); const FV = admin.firestore.FieldValue;
const same = (a, b) => JSON.stringify(a, Object.keys(a || {}).sort ? undefined : undefined) === JSON.stringify(b);
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
const movable = (d) => Object.keys(d).filter((k) => ADMIN_KEYS.indexOf(k) === -1);
(async () => {
  const [ps, is] = await Promise.all([db.collection('master_worker_private').get(), db.collection('master_worker_info').get()]);
  const info = {}; is.forEach((d) => { info[d.id] = d.data(); });
  const stat = { 문서: ps.size, 옮길항목이있는문서: 0, 관리자전용만있는문서: 0, 항목별: {}, 이미info있음: 0 };
  const todo = [];
  ps.forEach((d) => { const m = movable(d.data()); if (!m.length) { stat.관리자전용만있는문서++; return; } stat.옮길항목이있는문서++; if (info[d.id]) stat.이미info있음++; m.forEach((k) => { stat.항목별[k] = (stat.항목별[k] || 0) + 1; }); todo.push({ id: d.id, keys: m, data: d.data() }); });
  console.log('[' + projectId + '] ' + phase + (apply ? ' (실행)' : ' (읽기만)'), JSON.stringify(stat));
  if (phase === 'plan') return;
  if (phase === 'copy') {
    if (!apply) { console.log('모의 실행 — 쓰지 않았습니다. 실행하려면 --apply'); return; }
    let n = 0; let batch = db.batch(); let c = 0;
    for (const t of todo) { const part = {}; t.keys.forEach((k) => { part[k] = t.data[k]; }); batch.set(db.collection('master_worker_info').doc(t.id), part, { merge: true }); n++; if (++c >= 400) { await batch.commit(); batch = db.batch(); c = 0; } }
    if (c) await batch.commit(); console.log('복사한 문서:', n); return;
  }
  const bad = []; todo.forEach((t) => { const cur = info[t.id] || {}; t.keys.forEach((k) => { if (stable(cur[k]) !== stable(t.data[k])) bad.push(t.id + '.' + k); }); });
  if (phase === 'verify') { console.log(bad.length ? '❌ 다른 항목 ' + bad.length + '개: ' + bad.slice(0, 20).join(', ') : '✅ private 의 옮길 항목이 모두 info 와 같습니다(' + todo.length + '개 문서)'); process.exit(bad.length ? 1 : 0); }
  if (phase === 'clean') {
    if (bad.length) { console.error('verify 가 통과하지 않아 지우지 않습니다: ' + bad.slice(0, 20).join(', ')); process.exit(1); }
    if (!apply) { console.log('모의 실행 — 지우지 않았습니다. 실행하려면 --apply'); return; }
    let n = 0; let batch = db.batch(); let c = 0;
    for (const t of todo) { const upd = {}; t.keys.forEach((k) => { upd[k] = FV.delete(); }); batch.update(db.collection('master_worker_private').doc(t.id), upd); n++; if (++c >= 400) { await batch.commit(); batch = db.batch(); c = 0; } }
    if (c) await batch.commit(); console.log('private 에서 정리한 문서:', n);
  }
})().then(() => process.exit(0)).catch((e) => { console.error('오류:', e.message); process.exit(1); });
