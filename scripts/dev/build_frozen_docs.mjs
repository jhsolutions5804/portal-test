/* 구포털(hr/index.html)의 "FROZEN-DOC-TEMPLATES" 블록(근로계약서·연봉계약서·급여명세서 양식 v0~v5, 동결)을 손대지 않고 그대로 ES 모듈로 옮기는 생성기.
 * 사용: node scripts/dev/build_frozen_docs.mjs <구포털 hr/index.html> [출력 경로(기본 app/modules/hr/frozen-docs.js)]   (espree 필요: npm i espree)
 * 규칙: 동결 서식은 한 글자도 고치지 않는다. 이 파일이 만드는 app/modules/hr/frozen-docs.js 는 직접 수정 금지 — 새 양식이 필요하면 새 버전(v6…)을 추가한다. */
import fs from 'fs'; import * as espree from 'espree';
const src = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const b = src.findIndex((l) => l.includes('FROZEN-DOC-TEMPLATES:BEGIN')), e = src.findIndex((l) => l.includes('FROZEN-DOC-TEMPLATES:END'));
const blk = src.slice(b, e + 1).join('\n');
const ast = espree.parse(blk, { ecmaVersion: 2022, range: true, sourceType: 'script' });
const want = new Set(['DOC_TPL_CURRENT', 'DOC_TPL_ERAS', 'DOC_TPL_HISTORY', 'docTplVer', '__psSavedPs', '__psSavedC', '__calcAnnualSalary_v0', '__calcAnnualSalary_v1', '__annualHtml_v0', '__annualHtml_v1', '__annualHtml_v2', '__annualHtml_v3', '__annualHtml_v4', '__annualHtml_v5', '__laborHtml_v0', '__laborHtml_v2', '__laborHtml_v4', '__laborHtml_v5', '__psHtml_v0', '__psHtml_v1', '__psHtml_v2', '__psHtml_v3', '__psHtml_v4', '__psHtml_v5', '__ANNUAL_TPL', '__LABOR_TPL', '__PS_TPL', 'docHtmlByVer']);
const parts = []; const got = new Set();
for (const n of ast.body) { const name = n.type === 'FunctionDeclaration' ? n.id.name : n.type === 'VariableDeclaration' ? n.declarations[0].id.name : ''; if (want.has(name)) { parts.push(blk.slice(n.range[0], n.range[1])); got.add(name); } }
const missing = [...want].filter((x) => !got.has(x)); if (missing.length) { console.error('빠진 정의:', missing.join(', ')); process.exit(1); }
const line = (re) => src.find((l) => re.test(l));
const deps = [line(/^const psWonR = /), line(/^const PS_TRAVEL_PER_DAY = /)].join('\n') + '\n' + src.slice(src.findIndex((l) => /^const PS_TRAVEL_TYPE_LABEL = /.test(l)), src.findIndex((l) => /^const PS_TRAVEL_TYPE_LABEL = /.test(l)) + 6).join('\n');
const out = `/* ⚠️ 자동 생성 파일 — 직접 수정 금지(동결). 생성기: scripts/dev/build_frozen_docs.mjs
 * 구포털 hr 의 "저장 서류 양식 동결" 블록(근로계약서·연봉계약서·급여명세서 v0~v5)을 원본 그대로 옮겼다.
 * 원칙(원문): 서명·저장이 끝난 서류는 어떠한 경우에도 내용이 바뀌면 안 된다 — 저장 서류는 "저장 당시 양식(tplVer)"으로만 그린다.
 * 새 양식이 필요하면 이 파일의 함수를 고치지 말고 새 버전(v6…)을 따로 추가하고 DOC_TPL_CURRENT 를 올린다.
 * 바깥 의존: 직인 이미지(_compSignatures: company_settings/signatures)·로고(JH_LOGO) — configureFrozenDocs() 로 넣는다. */
let _compSignatures = {};
let JH_LOGO = '';
${deps}
/** 직인(company_settings/signatures 의 문서 내용)과 로고 이미지 주소를 넣는다 */
export function configureFrozenDocs(o) { const x = o || {}; if (x.signatures !== undefined) _compSignatures = x.signatures || {}; if (x.logo !== undefined) JH_LOGO = x.logo || ''; }
${parts.join('\n')}
export { DOC_TPL_CURRENT, DOC_TPL_ERAS, DOC_TPL_HISTORY, docTplVer, __psSavedPs, __psSavedC, __calcAnnualSalary_v0, __calcAnnualSalary_v1, __ANNUAL_TPL, __LABOR_TPL, __PS_TPL, docHtmlByVer };
`;
fs.writeFileSync(process.argv[3] || 'app/modules/hr/frozen-docs.js', out); console.log('생성', out.length, 'bytes');
