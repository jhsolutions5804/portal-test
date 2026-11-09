/* 투입 인력 소개서(외부용) — 직원이 투입 확인서에서 「동의」한 프로젝트에 한해, 제공받는 자(발주처·시공사)에게 내는 소개서(대기열 1-3-27-3-2, 시험: tests/hr-external-print.test.mjs).
 * 서버(deployAct provide)가 동의한 프로젝트만 자료를 주고 제공 이력을 남긴다. 제공 항목은 성명·사진·학력·자격·경력·프로젝트 이력뿐 — 주민번호·연락처·주소·계좌·가족관계·병역·건강·급여·평가·부서·연봉·퇴사사유는 이 문서에 없다.
 * 내부용 이력서(resume-print.js)와 같은 스타일·단추·크기 맞춤을 쓴다. 순수 함수 — 모든 값은 이스케이프하고 사진은 검사한 이미지 data URL 만 넣는다. */
import { esc } from '../../core/ui.js?v=20261109i';
import { RESUME_CSS, RESUME_TOOLBAR, RESUME_SCRIPT } from './resume-print.js?v=20261109i';
import { careerMonths, fmtMonths } from './career-tab.js?v=20261109i';
import { deployWhen } from '../../shared/deploy-fmt.js?v=20261109i';

const COMPANY = '제이에이치솔루션';
/** 프로젝트 참여 기간 표시 — 시작이 비어 있으면(공수 기록 전) 「~」 없이 끝 표시만 */
const periodText = (p) => { const end = p.active ? '진행 중' : (p.to || ''); return p.from ? p.from + ' ~ ' + end : end; };
const PHOTO_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const s = (v) => (v == null ? '' : String(v));
const td = (v, attr) => '<td' + (attr ? ' ' + attr : '') + '>' + esc(s(v)) + '</td>';
const lab = (v, attr) => '<th class="lab"' + (attr ? ' ' + attr : '') + '>' + esc(s(v)) + '</th>';
const hd = (v, attr) => '<th class="hd"' + (attr ? ' ' + attr : '') + '>' + esc(s(v)) + '</th>';
const ym = (d) => (/^\d{4}-\d{2}/.test(s(d)) ? s(d).slice(0, 7) : s(d));
const cg = (w) => '<colgroup>' + w.map((x) => '<col style="width:' + (x * 100 / w.reduce((a, b) => a + b, 0)).toFixed(2) + '%">').join('') + '</colgroup>';
const blank = (n, cells) => Array.from({ length: Math.max(0, n) }, () => '<tr>' + cells.map((c) => '<td' + (c > 1 ? ' colspan="' + c + '"' : '') + '>&nbsp;</td>').join('') + '</tr>').join('');
const W7 = [15, 17, 13, 16, 13, 13, 19];
const EXTRA = 'tr.job td{height:9mm}.warn{border:1px solid #c0392b;color:#c0392b;font-weight:700;padding:3px 6px;margin:4px 0;font-size:8.5pt}.foot{font-size:8pt;color:#444;margin-top:8px;line-height:1.5}';

/** d = 서버 provide 결과 { worker, party, consent, education, certs, career, photo, provision }, opts = { projects:[…careerProjects + client·contractor], todayYm } */
export function externalResumeHtml(d, opts) {
  const o = opts || {}; const x = d || {}; const w = x.worker || {}; const pt = x.party || {}; const cs = x.consent || {};
  const photoOk = PHOTO_RE.test(s(x.photo));
  const photo = '<td class="photo" rowspan="4">' + (photoOk ? '<img src="' + s(x.photo) + '" alt="사진">' : '사진<br>(3.5 × 4.5 cm)') + '</td>';
  const info = '<table class="g">' + cg(W7)
    + '<tr class="r5">' + lab('성명') + td(w.name, 'colspan="2"') + lab('소속') + td(COMPANY, 'colspan="2"') + photo + '</tr>'
    + '<tr class="r5">' + lab('투입 사업') + td(pt.pjtName, 'colspan="5"') + '</tr>'
    + '<tr class="r5">' + lab('발주처') + td(pt.client, 'colspan="2"') + lab('시공사') + td(pt.contractor, 'colspan="2"') + '</tr>'
    + '<tr class="r5">' + lab('현장·역할') + td([pt.site, pt.role].filter(Boolean).join(' / '), 'colspan="5"') + '</tr></table>';
  const edu = (x.education || []).map((e) => '<tr>' + td(e.school, 'colspan="3"') + td(e.major) + td(ym(e.from)) + td(ym(e.to)) + td(e.status) + '</tr>').join('') + blank(2 - (x.education || []).length, [3, 1, 1, 1, 1]);
  const certs = (x.certs || []).map((c) => '<tr>' + td(c.name, 'colspan="3"') + td(c.issuer, 'colspan="2"') + td(c.date, 'colspan="2"') + '</tr>').join('') + blank(3 - (x.certs || []).length, [3, 2, 2]);
  const rows = x.career || []; const today = o.todayYm || '';
  const jobs = rows.map((r) => '<tr class="job"><td>' + esc(ym(r.from)) + '</td><td>' + esc(r.to ? ym(r.to) : (r.from ? '재직' : '')) + '</td><td>' + esc(r.company) + '</td><td>' + esc(r.position) + '</td><td class="l">' + esc(r.duty) + '</td><td>' + (r.from ? esc(String(careerMonths([r], today))) : '') + '</td></tr>').join('')
    + Array.from({ length: Math.max(0, 5 - rows.length) }, () => '<tr class="job">' + '<td>&nbsp;</td>'.repeat(6) + '</tr>').join('');
  const total = rows.reduce((a, r) => a + (r.from ? careerMonths([r], today) : 0), 0);
  const pj = (o.projects || []).map((p) => '<tr><td class="l">' + esc(p.name) + '</td><td>' + esc(p.client || '') + '</td><td>' + esc(p.contractor || '') + '</td><td>' + esc(periodText(p)) + '</td><td class="l">' + esc(p.role || '') + '</td></tr>').join('') + blank(3 - (o.projects || []).length, [1, 1, 1, 1, 1]);
  const when = deployWhen(x.provision && x.provision.at).slice(0, 10); const consentDay = deployWhen(cs.at).slice(0, 10);
  const draft = cs.draft ? '<div class="warn">시험용 문구에 따른 동의입니다(노무사 확인 전) — 실제 제출에 사용하지 마세요.</div>' : '';
  const to = [pt.client, pt.contractor].filter(Boolean).join(' · ');
  const page = '<section class="pg"><h1>투입 인력 소개서</h1><div class="sub">' + esc(to ? '제출처: ' + to : '') + '</div>' + draft + info
    + '<h2>1. 학력</h2><table class="g">' + cg(W7) + '<tr>' + hd('학교명', 'colspan="3"') + hd('전공') + hd('입학(년-월)') + hd('졸업(년-월)') + hd('졸업여부') + '</tr>' + edu + '</table>'
    + '<h2>2. 자격·면허</h2><table class="g">' + cg(W7) + '<tr>' + hd('명칭', 'colspan="3"') + hd('발급기관', 'colspan="2"') + hd('취득일', 'colspan="2"') + '</tr>' + certs + '</table>'
    + '<h2>3. 경력사항 <span class="mute">총 ' + esc(fmtMonths(total) || '0개월') + '</span></h2><table class="g">' + cg([11, 11, 18, 12, 38, 10]) + '<tr>' + hd('시작\n(년-월)') + hd('종료\n(년-월)') + hd('회사명') + hd('직위') + hd('담당업무') + hd('개월수') + '</tr>' + jobs + '</table>'
    + '<h2>4. 프로젝트 참여 이력</h2><table class="g">' + cg([28, 16, 16, 28, 12]) + '<tr>' + hd('프로젝트명') + hd('발주처') + hd('시공사') + hd('기간') + hd('역할') + '</tr>' + pj + '</table>'
    + '<div class="foot">이 소개서는 본인의 동의(프로젝트 투입 확인서' + (consentDay ? ', ' + esc(consentDay) : '') + ')에 따라 ' + esc(to || '발주처·시공사') + '에 제공하는 문서입니다. 제공 항목: 성명, 사진, 학력, 자격·면허, 경력, 프로젝트 참여 이력.' + (when ? ' 작성일 ' + esc(when) + '.' : '') + '</div></section>';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc('투입 인력 소개서 - ' + (s(w.name) || '근로자') + (pt.pjtName ? ' (' + pt.pjtName + ')' : '')) + '</title><style>' + RESUME_CSS + EXTRA + '</style></head><body>' + RESUME_TOOLBAR + '<div id="sheets">' + page + '</div>' + RESUME_SCRIPT + '</body></html>';
}
