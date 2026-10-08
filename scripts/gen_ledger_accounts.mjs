// 원장 계정과목을 서버(CommonJS)가 쓰는 JSON 으로 내보낸다 — 화면 엔진(app/shared/ledger-engine.js)이 정본, 서버 시험이 둘이 같은지 확인한다.
import { ACCOUNTS } from '../app/shared/ledger-engine.js'; import fs from 'fs';
fs.writeFileSync(new URL('../functions/edoc/ledger-accounts.json', import.meta.url), JSON.stringify(ACCOUNTS.map((a) => ({ code: a.code, name: a.name, type: a.type, normal: a.normal, costGroup: a.costGroup || null })), null, 1));
console.log('계정과목', ACCOUNTS.length, '개 내보냄');
