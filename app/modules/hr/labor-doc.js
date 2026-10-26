/* 근로계약서 출력 연결 — 저장 당시 양식(tplVer)으로만 그린다. 단시간 양식 s1 은 short-doc.js, 그 밖(v0~v6)은 동결 양식 그대로(frozen-docs.js 는 건드리지 않는다).
 * 급여명세서 v7(payslip-doc.js)과 같은 방식. 시험: tests/hr-short-doc.test.mjs */
import { __LABOR_TPL, docHtmlByVer, configureFrozenDocs } from './frozen-docs.js?v=20261026h';
import { SHORT_TPL_VER, shortHtml, configureShortDoc } from './short-doc.js?v=20261026h';
export const laborDocHtml = (d) => (d && d.tplVer === SHORT_TPL_VER ? shortHtml(d) : docHtmlByVer(__LABOR_TPL, d));
/** 직인·로고를 동결 양식과 단시간 양식에 함께 넣는다 */
export function configureLaborDocs(o) { configureFrozenDocs(o); configureShortDoc(o); }
