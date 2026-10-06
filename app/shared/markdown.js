/* 규정(company_policies) 같은 마크다운을 안전하게 HTML 로 바꾼다 — 먼저 모든 글자를 이스케이프한 뒤 허용한 모양만 태그로 만든다(스크립트·링크·이미지는 만들지 않음).
 * 지원: # 제목(1~6단계) · **굵게** · 표(| 머리 |, | --- |) · - / * 목록 · 1. 번호 목록 · --- 구분선 · 문단·줄바꿈 */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const inline = (s) => esc(s).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSep = (l) => isRow(l) && cells(l).every((c) => /^:?-{2,}:?$/.test(c));
export function renderMarkdown(md) {
  const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i]; if (!l.trim()) { i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(l); if (h) { const n = h[1].length; out.push('<h' + n + ' class="jh-md__h">' + inline(h[2].trim()) + '</h' + n + '>'); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr class="jh-md__hr">'); i++; continue; }
    if (isRow(l) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && isRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push('<div class="jh-md__tablewrap"><table class="jh-md__table"><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + head.map((_, k) => '<td>' + inline(r[k] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(l), ol = /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol'; const re = ul ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/; const items = [];
      while (i < lines.length && re.test(lines[i])) { items.push(re.exec(lines[i])[1]); i++; }
      out.push('<' + tag + ' class="jh-md__list">' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</' + tag + '>'); continue;
    }
    const para = [l.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i]) && !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])) { para.push(lines[i].trim()); i++; }
    out.push('<p class="jh-md__p">' + para.map(inline).join('<br>') + '</p>');
  }
  return out.join('\n');
}
