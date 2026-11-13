/* 이력서 인쇄본(내부용) — 자사 입사지원서 엑셀 양식 v8(JH-APPLICATION-V8)의 칸 배치를 그대로 A4 로 옮긴다(대기열 1-3-27-3, 시험: tests/hr-resume-print.test.mjs).
 * 쪽 구성은 양식과 같다: ① 지원서(인적사항·자격증·학력·가족관계·확인·서명) A4 세로 ② 경력사항 A4 세로 ③ 프로젝트이력 A4 가로(JH 프로젝트 이력이 있을 때). 자기소개서 쪽은 대표님 요청(2026-11-05)으로 뺐다.
 * 순수 함수 — 입력은 서버 careerAct resume 결과 + 프로젝트 이력(선택). 모든 값은 이스케이프하고 사진은 검사한 이미지 data URL 만 넣는다.
 * 내부용이라 가족관계·비상연락처·연락처가 들어간다. 주민등록번호는 마스킹본만(서버가 마스킹본만 준다), 은행·계좌는 이 인쇄에 넣지 않는다. 외부 제출용(투입 인력 소개)은 별도(1-3-27-3 후속, 외부 제공 동의 확인 뒤). */
import { esc } from '../core/ui.js?v=20261113c';
import { careerMonths, fmtMonths } from './career-months.js?v=20261113c';
import { deployWhen } from './deploy-fmt.js?v=20261113c';

const NAVY = '#1F3A5F', LABEL = '#DCE6F1', GRAY = '#808080';
const COMPANY = '제이에이치솔루션';
const CONSENT_LINE = '수집·이용 목적: 근로계약 체결, 4대보험 신고, 급여 지급, 현장 출입 등록, 투입 인력 소개(연락처·주소·주민번호·계좌 제외). 보유 기간은 회사 방침에 따릅니다.';
const PHOTO_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const s = (v) => (v == null ? '' : String(v));
/** 주민번호 마스킹본(920824-1******)에서 생년월일·성별 — 7번째 자리 1·2·5·6=1900년대, 3·4·7·8=2000년대, 홀수=남 */
export function juminInfo(masked) {
  const m = /^(\d{2})(\d{2})(\d{2})-?(\d)/.exec(s(masked)); if (!m) return { birth: '', gender: '' };
  const g = +m[4]; const cen = [1, 2, 5, 6].indexOf(g) !== -1 ? 1900 : ([3, 4, 7, 8].indexOf(g) !== -1 ? 2000 : 0); if (!cen) return { birth: '', gender: '' };
  const mm = +m[2], dd = +m[3]; if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { birth: '', gender: '' };
  return { birth: (cen + +m[1]) + '-' + m[2] + '-' + m[3], gender: g % 2 ? '남' : '여' };
}
/** 본인 열람본(직원이 포털에서 자기 이력서를 볼 때) 표시줄·워터마크 — viewer = { no(신청 번호), at(ISO), name } */
const xmlEsc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const watermarkUrl = (text) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="380" height="240"><text x="30" y="140" font-size="18" font-family="Malgun Gothic,Noto Sans CJK KR,sans-serif" fill="rgba(0,0,0,0.12)" transform="rotate(-24 190 120)">' + xmlEsc(text) + '</text></svg>');
const viewerLine = (o) => (o && o.viewer ? '<div class="viewer">본인 열람본 · 신청 번호 ' + esc(s(o.viewer.no)) + (o.viewer.at ? ' · 열람 ' + esc(deployWhen(o.viewer.at)) : '') + '</div>' : '');
const wmDiv = (o) => (o && o.viewer ? '<div class="wm" style="background-image:url(\'' + watermarkUrl([s(o.viewer.name), s(o.viewer.no)].filter(Boolean).join(' · ')) + '\')"></div>' : '');
const td = (v, attr) => '<td' + (attr ? ' ' + attr : '') + '>' + esc(s(v)) + '</td>';
const lab = (v, attr) => '<th class="lab"' + (attr ? ' ' + attr : '') + '>' + esc(s(v)) + '</th>';
const hd = (v, attr) => '<th class="hd"' + (attr ? ' ' + attr : '') + '>' + esc(s(v)) + '</th>';
const blankRows = (n, cols) => Array.from({ length: n }, () => '<tr>' + '<td>&nbsp;</td>'.repeat(cols) + '</tr>').join('');
const ym = (d) => (/^\d{4}-\d{2}/.test(s(d)) ? s(d).slice(0, 7) : s(d));
const cg = (w) => '<colgroup>' + w.map((x) => '<col style="width:' + (x * 100 / w.reduce((a, b) => a + b, 0)).toFixed(2) + '%">').join('') + '</colgroup>';

function page1(d, o) {
  const w = d.worker || {}; const ji = juminInfo(d.juminMasked); const mil = d.military || {}; const em = d.emergency || {}; const photoOk = PHOTO_RE.test(s(d.photo));
  const photo = '<td class="photo" rowspan="5">' + (photoOk ? '<img src="' + s(d.photo) + '" alt="사진">' : '사진<br>(3.5 × 4.5 cm)') + '</td>';
  const milDetail = [mil.branch, mil.mos, mil.rank].filter(Boolean).join(' · ');
  const certs = (d.certs || []).map((c) => '<tr>' + td('') + td(c.name, 'colspan="2"') + td(c.issuer, 'colspan="2"') + td(c.date) + td('') + '</tr>').join('') + blankRows(Math.max(0, 5 - (d.certs || []).length), 5).replace(/<tr>(<td>&nbsp;<\/td>){5}<\/tr>/g, '<tr><td>&nbsp;</td><td colspan="2">&nbsp;</td><td colspan="2">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>');
  const edu = (d.education || []).map((e) => '<tr>' + td('') + td(e.school, 'colspan="2"') + td(e.major) + td(e.from) + td(e.to) + td(e.status) + '</tr>').join('') + Array.from({ length: Math.max(0, 3 - (d.education || []).length) }, () => '<tr><td>&nbsp;</td><td colspan="2">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>').join('');
  const fam = (d.family || []).map((f) => '<tr>' + td(f.relation) + td(f.name) + td(f.age) + td('') + td(f.job) + td('') + td(f.together) + '</tr>').join('') + blankRows(Math.max(0, 3 - (d.family || []).length), 7);
  return '<section class="pg"><h1>입사지원서</h1><div class="sub">채용이 확정된 뒤 작성하는 서류입니다.</div>' + viewerLine(o)
    + '<h2>1. 인적사항</h2><table class="g">' + cg([15, 17, 13, 16, 13, 13, 19])
    + '<tr class="r5">' + lab('이름') + td(w.name, 'colspan="2"') + lab('생년월일') + td(ji.birth, 'colspan="2"') + photo + '</tr>'
    + '<tr class="r5">' + lab('영문 이름') + td(d.nameEn, 'colspan="2"') + lab('성별') + td(ji.gender, 'colspan="2"') + '</tr>'
    + '<tr class="r5">' + lab('휴대폰') + td(w.phone, 'colspan="2"') + lab('혈액형') + td(d.bloodType, 'colspan="2"') + '</tr>'
    + '<tr class="r5">' + lab('이메일') + td(w.email, 'colspan="5"') + '</tr>'
    + '<tr class="r5">' + lab('주소') + td(d.address, 'colspan="5"') + '</tr>'
    + '<tr>' + lab('상세주소') + td('', 'colspan="6"') + '</tr>'
    + '<tr>' + lab('주민등록번호') + td(d.juminMasked, 'colspan="2"') + lab('입사일') + td(w.hireDate, 'colspan="3"') + '</tr>'
    + '<tr>' + lab('은행') + '<td colspan="2" class="mute">인쇄에서 제외</td>' + lab('계좌번호') + '<td colspan="3" class="mute">인쇄에서 제외(관리자 전용 카드)</td></tr>'
    + '<tr>' + lab('비상연락 성명') + td(em.name, 'colspan="2"') + lab('관계') + td(em.relation, 'colspan="3"') + '</tr>'
    + '<tr>' + lab('비상연락 전화') + td(em.phone, 'colspan="2"') + lab('건설기초 이수일') + td(d.baseSafetyDate, 'colspan="3"') + '</tr>'
    + '<tr>' + lab('병역') + td(mil.kind, 'colspan="2"') + lab('군별·병과·계급') + td(milDetail, 'colspan="3"') + '</tr>'
    + '<tr class="r16">' + lab('개인정보 동의') + td(d.consent ? '동의함' : '', 'colspan="2"') + '<td colspan="4" class="small">' + esc(CONSENT_LINE) + '</td></tr></table>'
    + '<h2>2. 자격증</h2><table class="g">' + cg([15, 17, 13, 16, 13, 13, 19]) + '<tr>' + hd('등급') + hd('명칭', 'colspan="2"') + hd('발급기관', 'colspan="2"') + hd('취득일') + hd('만료일 (해당 시)') + '</tr>' + certs + '</table>'
    + '<h2>3. 학력</h2><table class="g">' + cg([15, 17, 13, 16, 13, 13, 19]) + '<tr>' + hd('구분') + hd('학교명', 'colspan="2"') + hd('전공') + hd('입학(년-월)') + hd('졸업(년-월)') + hd('졸업여부') + '</tr>' + edu + '</table>'
    + (o && o.noFamily ? '' : (
'<h2>4. 가족관계 <span class="mute">참고용</span></h2><table class="g">' + cg([15, 17, 13, 16, 13, 13, 19]) + '<tr>' + hd('관계') + hd('성명') + hd('연령') + hd('학력') + hd('직장명') + hd('직위') + hd('동거여부') + '</tr>' + fam + '</table>'
    ))
    + '<div class="confirm">위 기재 내용은 사실과 다름이 없음을 확인합니다.</div>'
    + '<table class="g sign">' + cg([15, 17, 13, 16, 13, 13, 19]) + '<tr>' + lab('작성일') + td('', 'colspan="2"') + lab('지원자 (서명)') + td('', 'colspan="3"') + '</tr></table></section>';
}
function page2(d, todayYm, o) {
  const rows = d.career || []; const mo = rows.reduce((a, r) => a + (r.from ? careerMonths([r], todayYm || '') : 0), 0);   // v8 양식과 같게 줄별 개월수(양 끝 달 포함)의 단순 합 — 겹치면 커진다는 안내가 아래에 있다
  const body = rows.map((r) => '<tr class="job"><td>' + esc(ym(r.from)) + '</td><td>' + esc(r.to ? ym(r.to) : (r.from ? '재직' : '')) + '</td><td>' + esc(r.company) + '</td><td></td><td>' + esc(r.position) + '</td><td class="l">' + esc(r.duty) + '</td><td></td><td></td><td>' + (r.from ? esc(String(careerMonths([r], todayYm || ''))) : '') + '</td></tr>').join('')
    + Array.from({ length: Math.max(0, 12 - rows.length) }, () => '<tr class="job">' + '<td>&nbsp;</td>'.repeat(9) + '</tr>').join('');
  return '<section class="pg"><h1>경력사항</h1><div class="sub">회사별로 한 줄씩 씁니다. 종료일을 비우면 재직 중입니다. 연봉·퇴사사유는 내부용이며 외부 제출 문서에는 쓰지 않습니다.' + (d.careerEdited ? ' (인사 담당자가 수정한 내용입니다.)' : '') + '</div>' + viewerLine(o)
    + '<table class="g c2">' + cg([11, 11, 16, 11, 10, 36, 8, 10, 9]) + '<tr>' + hd('시작\n(년-월)') + hd('종료\n(년-월)') + hd('회사명') + hd('부서') + hd('직위\n(역할)') + hd('담당업무') + hd('연봉\n(만원)') + hd('퇴사사유') + hd('개월수\n(자동)') + '</tr>' + body + '</table>'
    + '<table class="g tot">' + cg([11, 11, 16, 11, 10, 36, 8, 10, 9]) + '<tr>' + lab('총 경력 (자동 합계)', 'colspan="3"') + td(String(mo), 'class="c"') + lab(fmtMonths(mo).replace(/(\d+)년 /, '$1 년 ').replace(/(\d+)개월/, '$1 개월') || '0 개월', 'colspan="2"') + '<td colspan="4"></td></tr></table>'
    + '<div class="note">※ 경력 기간이 겹치면 합계가 실제보다 커집니다. 그때는 실제 기간을 아래 메모 칸에 적어 주세요.</div>'
    + '<table class="g tot">' + cg([11, 11, 16, 11, 10, 36, 8, 10, 9]) + '<tr>' + lab('총 경력 메모 (선택)', 'colspan="3"') + '<td colspan="6">&nbsp;</td></tr></table></section>';
}
function page4(list) {
  const rows = (list || []).map((x, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(COMPANY) + '</td><td class="l">' + esc(x.name) + '</td><td>' + esc(x.client || '') + '</td><td>' + esc(x.contractor || '') + '</td><td>' + esc(x.from || '') + '</td><td>' + esc(x.active ? '' : (x.to || '')) + '</td><td class="l">' + esc(roleText(x)) + '</td></tr>').join('')
    + Array.from({ length: Math.max(0, 12 - (list || []).length) }, (_, i) => '<tr><td>' + ((list || []).length + i + 1) + '</td>' + '<td>&nbsp;</td>'.repeat(7) + '</tr>').join('');
  return '<section class="pg land"><h1>프로젝트 이력</h1><div class="sub">수행한 현장·프로젝트를 한 줄씩 씁니다. 종료일을 비우면 진행 중입니다. (제이에이치솔루션 프로젝트 명단·공수 기록에서 계산한 값)</div>'
    + '<table class="g">' + cg([5, 16, 38, 13, 15, 11, 11, 31]) + '<tr>' + hd('번호') + hd('소속 회사') + hd('프로젝트명') + hd('발주처') + hd('시공사') + hd('시작') + hd('종료') + hd('역할·내용') + '</tr>' + rows + '</table>'
    + '<div class="note">프로젝트 수 ' + (list || []).length + ' 건</div></section>';
}
const roleText = (x) => { const segs = (x.segments || []).filter((g) => g.role); const r = segs.length > 1 ? segs.map((g) => g.role + ' ' + g.from.slice(5) + '~' + g.to.slice(5)).join(' · ') : (x.role || ''); return r + (x.manDays ? (r ? ' / ' : '') + '공수 ' + x.manDays : ''); };
const CSS = '@page{size:210mm 297mm;margin:10mm}@page land{size:297mm 210mm;margin:8mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;line-height:1.25;font-family:"Malgun Gothic","맑은 고딕","Noto Sans CJK KR",sans-serif;font-size:9pt;color:#111}'
  + '.pg{page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}.land{page:land}'
  + 'h1{font-size:17pt;margin:0 0 2px;color:' + NAVY + '}h2{font-size:10.5pt;margin:7px 0 3px;color:' + NAVY + '}.sub{font-size:8pt;color:#555;margin-bottom:2px}.note{font-size:8pt;color:#666;margin:3px 0}'
  + 'table.g{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}table.g td,table.g th{border:.5pt solid #7a7a7a;padding:1px 3px;vertical-align:middle;word-break:break-all;overflow-wrap:anywhere;text-align:center;white-space:pre-wrap}'
  + 'th.lab{background:' + LABEL + ';font-weight:700}th.hd{background:' + NAVY + ';color:#fff;font-weight:700}table.g td.l{text-align:left}table.g td.c{text-align:center}td.mute,.mute{color:' + GRAY + ';font-size:8pt}td.small{font-size:8pt;text-align:left}'
  + 'table.g tr td,table.g tr th{height:6.8mm}table.g tr.r5 td,table.g tr.r5 th{height:9mm}table.g tr.r16 td,table.g tr.r16 th{height:13mm}tr{break-inside:avoid;page-break-inside:avoid}td.photo{width:19%;background:#f7f7f7;color:' + GRAY + ';font-size:8pt;padding:0;text-align:center}td.photo img{width:35mm;height:45mm;object-fit:cover;display:block;margin:0 auto}'
  + 'table.c2 tr.job td{height:16mm;font-size:9pt}.confirm{text-align:center;font-weight:700;margin:10px 0 6px}table.sign td,table.sign th{height:9mm}'
  + ''
  + '.pg{position:relative}.wm{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9;background-repeat:repeat}.viewer{font-size:8pt;color:#1F3A5F;margin:2px 0 3px;font-weight:700}.land table.g tr td{height:9mm}.toolbar{margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.toolbar .hint{font-size:8.5pt;color:#555}@media print{body{background:#fff;padding:0}.toolbar{display:none}#sheets .pg{zoom:1 !important;width:auto;min-height:0;margin:0;box-shadow:none;padding:0 1.5mm}.pg.land{width:auto}}@media screen{body{background:#e9edf3;padding:12px}.pg{width:210mm;min-height:297mm;margin:0 auto 14px;padding:10mm;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}.pg.land{width:297mm;min-height:210mm}}';
/** 인쇄 창 맨 위 「← 닫기 / 🖨 인쇄/PDF」 단추 줄과 창 너비에 맞춘 쪽 축소 스크립트 — 외부용 소개서(external-print.js)도 같은 것을 쓴다 */
export const RESUME_TOOLBAR = '<div class="toolbar"><button onclick="window.close()" style="padding:8px 16px;background:#fff;border:1px solid #DDE4EF;border-radius:8px;cursor:pointer;">← 닫기</button><button onclick="window.print()" style="padding:8px 16px;background:#1D5BA6;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">🖨 인쇄/PDF</button><span class="hint">인쇄 창 설정: 용지 A4 · 배율 100% · 여백 기본 · 배경 그래픽 켜기(권장)</span></div>';
export const RESUME_SCRIPT = '<script>(function(){function z(v){document.querySelectorAll(".pg").forEach(function(p){p.style.zoom=v===1?1:Math.min(1,(document.documentElement.clientWidth-24)/((p.classList.contains("land")?297:210)*96/25.4))})}function fit(){z()}window.addEventListener("resize",fit);window.addEventListener("beforeprint",function(){z(1)});window.addEventListener("afterprint",fit);fit()})()</script>';
export const RESUME_CSS = CSS;
/** 이력서 인쇄본 전체 HTML(문서 하나). d = 서버 resume 결과, opts = { projects:[…careerProjects + client·contractor], todayYm, projectPage:true } */
export function resumeHtml(d, opts) {
  const o = opts || {}; const data = d || {}; const name = s((data.worker || {}).name) || '근로자';
  const pages = [page1(data, o), page2(data, o.todayYm, o)];
  if (o.projectPage !== false && (o.projects || []).length) pages.push(page4(o.projects));
  const wm = wmDiv(o); const body = wm ? pages.map((pg) => pg.replace(/^(<section class="pg[^"]*">)/, '$1' + wm)) : pages;
  const title = o.viewer ? '내 이력서 - ' + name + (o.viewer.no ? ' (' + o.viewer.no + ')' : '') : '이력서(내부용) - ' + name;
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body>' + RESUME_TOOLBAR + '<div id="sheets">' + body.join('') + '</div>' + RESUME_SCRIPT + '</body></html>';
}
