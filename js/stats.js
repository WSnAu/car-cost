import { isIncome } from './types.js';

export function summarize(records, year) {
  const months = Array.from({ length: 12 }, () => ({ expense: 0, income: 0 }));
  const byType = {};
  let expense = 0, income = 0;
  for (const r of records) {
    if (!r.date.startsWith(year)) continue;
    const m = months[Number(r.date.slice(5, 7)) - 1];
    if (isIncome(r)) { income += r.amount; m.income += r.amount; }
    else {
      expense += r.amount; m.expense += r.amount;
      byType[r.type] = (byType[r.type] || 0) + r.amount;
    }
  }
  return { expense, income, months, byType };
}

// 12 个月支出柱状图（SVG）
export function monthChartSVG(months) {
  const W = 340, H = 170, left = 34, bottom = 20, top = 12;
  const max = Math.max(...months.map(m => m.expense), 0);
  const nice = niceMax(max);
  const plotH = H - bottom - top, step = (W - left) / 12, bw = step * 0.6;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="每月支出柱状图">`;
  for (let i = 0; i <= 2; i++) {
    const v = nice * i / 2, y = top + plotH - plotH * i / 2;
    s += `<line class="grid" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/>`;
    s += `<text x="${left - 4}" y="${y + 3}" text-anchor="end">${short(v)}</text>`;
  }
  months.forEach((m, i) => {
    const x = left + i * step + (step - bw) / 2;
    const h = nice ? plotH * m.expense / nice : 0;
    if (h > 0) s += `<rect class="bar" x="${x.toFixed(1)}" y="${(top + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="2"><title>${i + 1}月 ¥${m.expense.toFixed(2)}</title></rect>`;
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i + 1}</text>`;
  });
  return s + '</svg>';
}

function niceMax(v) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}
const short = v => v >= 10000 ? (v / 10000).toFixed(v % 10000 ? 1 : 0) + '万' : String(Math.round(v));
