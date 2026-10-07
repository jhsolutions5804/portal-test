#!/usr/bin/env node
/* 부서 이름 변경 이전 — 계정(portal_users)·인사 명부(workers)의 dept 값을 새 이름으로 바꾼다. 읽기만 하는 plan 이 기본, --apply 로 실제 변경.
 * 사용: GOOGLE_APPLICATION_CREDENTIALS=서비스계정.json node scripts/dept_rename.js [plan|apply] [--project=프로젝트ID]
 * 대표님 결정(2026-10-07): 현장관리팀 → PJT팀, 경영총무팀 → 인사총무팀. (인력배치팀은 삭제 — 소속 인원의 새 팀은 별도 결정) */
const path = require('path');
const admin = require(process.env.FIREBASE_ADMIN_PATH || path.join(__dirname, '..', 'functions', 'edoc', 'node_modules', 'firebase-admin'));
const MAP = { '현장관리팀': 'PJT팀', '경영총무팀': '인사총무팀' };
const apply = process.argv[2] === 'apply'; const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
admin.initializeApp({ projectId: arg('project') || 'portal-test-6e0ff' }); const db = admin.firestore();
(async () => {
  const stat = {}; const left = {};
  for (const col of ['portal_users', 'workers']) {
    const s = await db.collection(col).get(); let batch = db.batch(); let c = 0;
    for (const d of s.docs) { const dept = d.data().dept; if (MAP[dept]) { stat[col + ' ' + dept + ' → ' + MAP[dept]] = (stat[col + ' ' + dept + ' → ' + MAP[dept]] || 0) + 1; if (apply) { batch.update(d.ref, { dept: MAP[dept] }); if (++c >= 400) { await batch.commit(); batch = db.batch(); c = 0; } } } else if (dept === '인력배치팀') left[col] = (left[col] || 0) + 1; }
    if (apply && c) await batch.commit();
  }
  console.log((apply ? '변경함' : '계획(읽기만)') + ':', JSON.stringify(stat), '| 인력배치팀 소속(별도 결정):', JSON.stringify(left));
  process.exit(0);
})().catch((e) => { console.error('오류', e.message); process.exit(1); });
