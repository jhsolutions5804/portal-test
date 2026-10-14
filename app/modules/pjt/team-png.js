/* 개인 공수표 이미지 저장(브라우저 전용, canvas 에 직접 그림). 시험에서는 ctx.makePng 로 대신한다.
 * 입력: { title, chips[{label}], weeks(calendarOf 결과), total } → PNG 데이터 URL */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function sheetPng(o) {
  const W = 760, M = 20, CW = (W - M * 2) / 7, CH = 70, FONT = '"Malgun Gothic","Apple SD Gothic Neo",sans-serif'; const rows = o.weeks.length; const H = M + 30 + 28 + 22 + rows * CH + 70 + M;
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const g = c.getContext('2d'); g.scale(2, 2); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1A2540'; g.font = 'bold 16px ' + FONT; g.fillText(o.title, M, M + 18);
  g.font = '12px ' + FONT; g.fillStyle = '#5C6F8A'; g.fillText((o.chips || []).map((x) => x.label).join('   ') || '기록 없음', M, M + 40);
  const y0 = M + 30 + 28; g.font = 'bold 11px ' + FONT; DOW.forEach((d, i) => { g.fillStyle = i === 0 ? '#c0392b' : i === 6 ? '#1D5BA6' : '#9AAABF'; g.fillText(d, M + i * CW + CW / 2 - 5, y0 + 12); });
  o.weeks.forEach((w, ri) => w.forEach((cell, ci) => {
    const x = M + ci * CW, y = y0 + 22 + ri * CH; g.strokeStyle = '#EEF2F7'; g.strokeRect(x + 1.5, y + 1.5, CW - 3, CH - 3); if (!cell.k) return;
    if (cell.total > 0) { g.fillStyle = '#F4F8FF'; g.fillRect(x + 2, y + 2, CW - 4, CH - 4); }
    g.fillStyle = '#1A2540'; g.font = '600 11px ' + FONT; g.fillText(String(+cell.k.slice(8)), x + 6, y + 15);
    if (cell.total > 0) { g.fillStyle = '#1D5BA6'; g.font = 'bold 13px ' + FONT; g.fillText(cell.total.toFixed(1), x + 6, y + 31); g.font = '10px ' + FONT; g.fillStyle = '#5C6F8A'; cell.lines.slice(0, 2).forEach((l, i) => g.fillText(l.abbr + ' ' + l.amount.toFixed(1), x + 6, y + 45 + i * 11)); }
  }));
  const yb = y0 + 22 + rows * CH + 14; g.strokeStyle = '#f0f0f0'; g.beginPath(); g.moveTo(M, yb); g.lineTo(W - M, yb); g.stroke(); g.fillStyle = '#86868b'; g.font = '12px ' + FONT; g.textAlign = 'center'; g.fillText('이번 달 합계', W / 2, yb + 22); g.fillStyle = '#1D5BA6'; g.font = 'bold 24px ' + FONT; g.fillText(o.total.toFixed(1) + ' 공수', W / 2, yb + 50);
  return c.toDataURL('image/png');
}
