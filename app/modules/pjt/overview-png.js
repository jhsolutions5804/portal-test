/* 통합 일정(주간) 이미지 저장 — 브라우저 전용(canvas 에 직접 그림). 시험에서는 ctx.savePng 로 대신한다.
 * 입력: { days(14일), map(날짜→일정[]), legend([{label,color}]), label(기간 문구), today, holiday(k)→이름, colorOf(pjtKey)→색, dow(k)→0~6 } → PNG 데이터 URL */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const wrap = (g, text, maxW) => { const lines = []; let cur = ''; for (const ch of String(text || '')) { if (g.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; } if (cur) lines.push(cur); return lines; };
export function weeklyPng(o) {
  const W = 1400, M = 24, COLS = 7, CW = (W - M * 2) / COLS, FONT = '"Malgun Gothic","Apple SD Gothic Neo",sans-serif';
  const c = document.createElement('canvas'); const g0 = c.getContext('2d'); g0.font = '12px ' + FONT;
  const cellLines = (k) => (o.map[k] || []).map((s) => ({ s, lines: wrap(g0, (s.stime && s.stime !== '미정' ? s.stime + ' ' : '') + (s.text || ''), CW - 22).slice(0, 3) }));
  const LN = {}; o.days.forEach((k) => { LN[k] = cellLines(k); });   /* 줄바꿈은 캔버스 크기를 바꾸기 전에 계산한다(크기를 바꾸면 글꼴 설정이 초기화되어 폭이 어긋난다) */
  const rows = [o.days.slice(0, 7), o.days.slice(7, 14)]; const heights = rows.map((r) => Math.max(110, 44 + Math.max.apply(null, r.map((k) => LN[k].reduce((a, x) => a + x.lines.length * 15 + 16 + 6, 0)))));
  const H = M + 36 + 28 + heights[0] + heights[1] + M; c.width = W * 2; c.height = H * 2; const g = c.getContext('2d'); g.scale(2, 2);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = '#1A2540'; g.font = 'bold 20px ' + FONT; g.fillText('PJT 통합 일정 · ' + o.label, M, M + 22);
  let lx = M; g.font = '12px ' + FONT; (o.legend || []).forEach((l) => { g.fillStyle = l.color; g.fillRect(lx, M + 36 + 4, 10, 10); g.fillStyle = '#334155'; g.fillText(l.label, lx + 14, M + 36 + 13); lx += 14 + g.measureText(l.label).width + 18; });
  let y = M + 36 + 28;
  rows.forEach((row, ri) => {
    row.forEach((k, ci) => {
      const x = M + ci * CW; const dow = o.dow(k); const hn = o.holiday(k); const off = dow === 0 || !!hn;
      g.strokeStyle = '#dde4ef'; g.lineWidth = 1; g.fillStyle = k === o.today ? '#eef5ff' : '#ffffff'; g.fillRect(x, y, CW, heights[ri]); g.strokeRect(x + 0.5, y + 0.5, CW - 1, heights[ri] - 1);
      const [, m, d] = k.split('-').map(Number); g.fillStyle = off ? '#c0392b' : dow === 6 ? '#1D5BA6' : '#1A2540'; g.font = 'bold 14px ' + FONT; g.fillText(m + '/' + d + (k === o.today ? ' (오늘)' : ''), x + 10, y + 20);
      g.font = '11px ' + FONT; g.fillStyle = '#86868b'; g.fillText(DOW[dow] + '요일' + (hn ? ' · ' + hn : ''), x + 10, y + 36);
      let yy = y + 48; const its = LN[k]; if (!its.length) { g.fillStyle = '#c7c7cc'; g.font = '12px ' + FONT; g.fillText('—', x + CW / 2 - 4, yy + 12); }
      its.forEach(({ s, lines }) => { const col = o.colorOf(s.pjtKey); const hh = lines.length * 15 + 16; g.fillStyle = col; g.fillRect(x + 8, yy, 3, hh); g.fillStyle = '#1A2540'; g.font = '12px ' + FONT; lines.forEach((ln, i) => g.fillText(ln, x + 16, yy + 12 + i * 15)); g.fillStyle = col; g.font = 'bold 10px ' + FONT; g.fillText(s.pjtName || '', x + 16, yy + 12 + lines.length * 15); yy += hh + 6; });
    });
    y += heights[ri];
  });
  return c.toDataURL('image/png');
}
