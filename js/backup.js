import { typeOf, isIncome } from './types.js';

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));

// 手机上调用系统分享面板（可“存储到文件”），电脑上直接下载
export async function saveFile(name, text, mime) {
  const file = new File([text], name, { type: mime });
  if (isMobile() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}

export function toJSON(records, settings) {
  return JSON.stringify({ app: 'car-cost', version: 1, exportedAt: new Date().toISOString(), settings, records }, null, 1);
}

export function parseJSON(text) {
  const data = JSON.parse(text);
  const records = Array.isArray(data) ? data : data.records;
  if (!Array.isArray(records)) throw new Error('文件中没有记录数据');
  for (const r of records) {
    if (!r || typeof r.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        typeof r.type !== 'string' || typeof r.amount !== 'number') {
      throw new Error('备份文件格式不正确');
    }
  }
  return { records, settings: data.settings || {} };
}

export function toCSV(records, fuelById) {
  const head = ['日期', '类型', '收支', '金额', '单价', '升数', '里程表', '是否加满', '段油耗(L/100km)', '备注'];
  const rows = [...records].sort((a, b) => a.date.localeCompare(b.date)).map(r => {
    const seg = fuelById.get(r.id);
    return [
      r.date, typeOf(r.type).label, isIncome(r) ? '收入' : '支出', r.amount.toFixed(2),
      r.price ?? '', r.liters ?? '', r.odometer ?? '',
      r.type === 'fuel' ? (r.full ? '是' : '否') : '',
      seg ? seg.l100.toFixed(2) : '', r.note || '',
    ];
  });
  const esc = v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
}
