/* 구포털(hr/index.html)의 연차사용촉진 통보서 양식(l1)과 그 날짜·서식 도우미를 손대지 않고 그대로 ES 모듈로 옮기는 생성기.
 * 사용: node scripts/dev/build_leave_promo_docs.mjs <구포털 hr/index.html> [출력 경로(기본 app/modules/hr/leave-promo-docs.js)]   (espree 필요: npm i espree)
 * 규칙: 이미 발행·저장된 촉진서는 저장 당시 양식(tplVer)으로만 그린다. 생성된 파일은 직접 수정 금지 — 새 양식은 새 버전(l2…)을 따로 추가한다. */
import fs from 'fs'; import * as espree from 'espree';
const html = fs.readFileSync(process.argv[2], 'utf8'); const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]); const code = scripts.find((c) => c.includes('function __leavePromoHtml_l1'));
const ast = espree.parse(code, { ecmaVersion: 2022, range: true, sourceType: 'script' });
const want = ['_hzEsc', '_hzParse', '_hzYmd', '_hzAddDays', '_hzAddMonths', '_hzDiffDays', '_hzDot', '_hzKor', '_hzDow', '_hzToday', '_hzCompanyBlock', '_hzDocShell', '__leavePromoHtml_l1', '__LEAVEPROMO_TPL', 'leavePromoHtmlByVer']; const found = new Map();
const walk = (n) => { if (!n || typeof n.type !== 'string') return; const name = n.type === 'FunctionDeclaration' ? n.id.name : (n.type === 'VariableDeclaration' && n.declarations[0].id && n.declarations[0].id.name); if (name && want.includes(name) && !found.has(name)) found.set(name, code.slice(n.range[0], n.range[1])); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } };
walk(ast); const missing = want.filter((x) => !found.has(x)); if (missing.length) { console.error('빠진 정의:', missing.join(', ')); process.exit(1); }
const out = `/* ⚠️ 자동 생성 파일 — 직접 수정 금지(동결). 생성기: scripts/dev/build_leave_promo_docs.mjs
 * 구포털 hr 의 연차사용촉진 통보서 양식 l1(1차·추가 1차·2차 지정통보)과 날짜·서식 도우미를 원본 그대로 옮겼다.
 * 저장된 촉진서는 저장 당시 양식(tplVer)으로만 그린다. 새 양식이 필요하면 이 파일을 고치지 말고 새 버전(l2…)을 따로 추가한다.
 * 바깥 의존: 회사 직인 이미지(_compSignatures: company_settings/signatures) — configureLeavePromoDocs() 로 넣는다. */
let _compSignatures = {};
export function configureLeavePromoDocs(o) { const x = o || {}; if (x.signatures !== undefined) _compSignatures = x.signatures || {}; }
${want.map((x) => found.get(x)).join('\n')}
export { _hzEsc, _hzParse, _hzYmd, _hzAddDays, _hzAddMonths, _hzDiffDays, _hzDot, _hzKor, _hzDow, _hzToday, _hzCompanyBlock, _hzDocShell, __leavePromoHtml_l1, __LEAVEPROMO_TPL, leavePromoHtmlByVer };
`;
fs.writeFileSync(process.argv[3] || 'app/modules/hr/leave-promo-docs.js', out); console.log('생성', out.length, 'bytes');
