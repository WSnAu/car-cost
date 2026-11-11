import * as db from './db.js';
import { TYPES, typeOf, isIncome } from './types.js';
import { computeFuel, averageFuel } from './fuel.js';
import { summarize, monthChartSVG } from './stats.js';
import { saveFile, toJSON, parseJSON, toCSV } from './backup.js';

const $ = sel => document.querySelector(sel);
const form = $('#form');
const F = form.elements;

let records = [];
let fuel = { segments: [], byId: new Map() };
let currentType = 'fuel';
let editing = null;          // 正在编辑的记录
let edits = [];              // 金额/单价/升数 最近编辑顺序，用于自动换算

// ---------- 工具 ----------
const money = v => '¥' + (Math.round(v * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => { const n = parseFloat(String(v).trim().replace(',', '.')); return Number.isFinite(n) ? n : null; };
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- 页面切换 ----------
const TITLES = { add: '记一笔', list: '明细', stats: '统计', settings: '设置' };
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#title').textContent = view === 'add' && editing ? '编辑记录' : TITLES[view];
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

// ---------- 记账表单 ----------
$('#typeGrid').innerHTML = TYPES.map(t =>
  `<button type="button" data-type="${t.id}"><span>${t.icon}</span>${t.label}</button>`).join('');
$('#typeGrid').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setType(b.dataset.type);
});

function setType(type) {
  currentType = type;
  document.querySelectorAll('#typeGrid button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const isFuel = type === 'fuel';
  $('#fuelFields').hidden = !isFuel;
  $('#fullRow').hidden = !isFuel;
  $('#fuelTip').hidden = !isFuel;
  F.odometer.placeholder = isFuel ? '必填' : '选填';
  $('#amountLabel').textContent = typeOf(type).income ? '收入金额 (元)' : '金额 (元)';
  updateOdoHint();
}

function updateOdoHint() {
  const last = records.filter(r => r.odometer > 0 && (!editing || r.id !== editing.id))
    .sort((a, b) => b.odometer - a.odometer)[0];
  $('#odoHint').textContent = last ? `上次记录里程：${last.odometer} km（${last.date}）` : '';
}

// 金额 = 单价 × 升数：填任意两项，自动算出第三项
['amount', 'price', 'liters'].forEach(k => F[k].addEventListener('input', () => {
  if (currentType !== 'fuel') return;
  edits = edits.filter(x => x !== k).concat(k);
  if (edits.length < 2) return;
  const [a, b] = edits.slice(-2);
  const target = ['amount', 'price', 'liters'].find(x => x !== a && x !== b);
  const amount = num(F.amount.value), price = num(F.price.value), liters = num(F.liters.value);
  let v = null;
  if (target === 'amount' && price > 0 && liters > 0) v = round(price * liters);
  if (target === 'liters' && amount > 0 && price > 0) v = round(amount / price);
  if (target === 'price' && amount > 0 && liters > 0) v = round(amount / liters);
  if (v !== null) F[target].value = v;
}));

function resetForm() {
  editing = null;
  edits = [];
  form.reset();
  F.date.value = today();
  F.full.checked = true;
  $('#editBtns').hidden = true;
  $('#saveBtn').textContent = '保存';
  setType(currentType);
}

function startEdit(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  editing = r;
  edits = [];
  form.reset();
  F.date.value = r.date;
  F.amount.value = r.amount;
  F.price.value = r.price ?? '';
  F.liters.value = r.liters ?? '';
  F.odometer.value = r.odometer ?? '';
  F.full.checked = r.full !== false;
  F.note.value = r.note || '';
  $('#editBtns').hidden = false;
  $('#saveBtn').textContent = '保存修改';
  setType(r.type);
  show('add');
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const amount = num(F.amount.value);
  const odometer = num(F.odometer.value);
  if (!F.date.value) return toast('请选择日期');
  if (!(amount > 0)) return toast('请输入金额');
  if (odometer !== null && odometer < 0) return toast('里程不能为负数');

  const rec = {
    id: editing ? editing.id : uid(),
    date: F.date.value,
    type: currentType,
    amount: round(amount),
    odometer: odometer || null,
    note: F.note.value.trim(),
    createdAt: editing ? editing.createdAt : Date.now(),
  };
  if (currentType === 'fuel') {
    rec.price = num(F.price.value);
    rec.liters = num(F.liters.value);
    if (!rec.liters && rec.price > 0) rec.liters = round(amount / rec.price);
    if (!rec.price && rec.liters > 0) rec.price = round(amount / rec.liters);
    rec.full = F.full.checked;
    if (!(rec.liters > 0)) return toast('请填写单价或加油量');
    if (!(rec.odometer > 0)) return toast('加油需要填写里程表读数，用于计算油耗');
  }

  await db.put(rec);
  const wasEdit = !!editing;
  resetForm();
  await refresh();
  toast(wasEdit ? '已保存修改' : '已记录');
  if (wasEdit) show('list');
});

$('#cancelEdit').addEventListener('click', () => { resetForm(); show('list'); });
$('#deleteBtn').addEventListener('click', async () => {
  if (!editing || !confirm('确定删除这条记录？')) return;
  await db.remove(editing.id);
  resetForm();
  await refresh();
  toast('已删除');
  show('list');
});

// ---------- 明细 ----------
$('#filter').innerHTML = '<option value="">全部类型</option>' +
  TYPES.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('');
$('#filter').addEventListener('change', renderList);
$('#list').addEventListener('click', e => {
  const b = e.target.closest('.item');
  if (b) startEdit(b.dataset.id);
});

function renderList() {
  const type = $('#filter').value;
  const list = type ? records.filter(r => r.type === type) : records;
  if (!list.length) {
    $('#list').innerHTML = `<div class="empty">${records.length ? '没有该类型的记录' : '还没有记录，去“记一笔”添加吧'}</div>`;
    return;
  }
  const groups = new Map();
  for (const r of list) {
    const k = r.date.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  let html = '';
  for (const [k, rs] of groups) {
    const out = rs.filter(r => !isIncome(r)).reduce((a, r) => a + r.amount, 0);
    const inc = rs.filter(isIncome).reduce((a, r) => a + r.amount, 0);
    html += `<div class="month-head"><b>${k.slice(0, 4)}年${Number(k.slice(5))}月</b><span>支出 ${money(out)}${inc ? ' · 收入 ' + money(inc) : ''}</span></div><div class="group">`;
    for (const r of rs) {
      const t = typeOf(r.type);
      const seg = fuel.byId.get(r.id);
      const sub = [r.date.slice(5)];
      if (r.type === 'fuel') sub.push(`${r.liters}L${r.full ? ' 加满' : ''}`);
      if (seg) sub.push(`${seg.l100.toFixed(2)} L/100km`);
      if (r.odometer) sub.push(`${r.odometer}km`);
      html += `<button class="item" data-id="${esc(r.id)}"><span class="ico">${t.icon}</span>
        <div class="mid"><div>${esc(r.note || t.label)}</div><div>${esc(sub.join(' · '))}</div></div>
        <span class="amt ${isIncome(r) ? 'in' : ''}">${isIncome(r) ? '+' : '-'}${money(r.amount)}</span></button>`;
    }
    html += '</div>';
  }
  $('#list').innerHTML = html;
}

// ---------- 统计 ----------
$('#yearSel').addEventListener('change', renderStats);

function renderStats() {
  const years = [...new Set([today().slice(0, 4), ...records.map(r => r.date.slice(0, 4))])].sort().reverse();
  const sel = $('#yearSel');
  const year = years.includes(sel.value) ? sel.value : years[0];
  sel.innerHTML = years.map(y => `<option value="${y}"${y === year ? ' selected' : ''}>${y} 年</option>`).join('');

  const s = summarize(records, year);
  const segs = fuel.segments.filter(x => x.date.startsWith(year));
  const avg = averageFuel(segs);
  $('#kpis').innerHTML = [
    ['总支出', money(s.expense), ''],
    ['顺风车收入', money(s.income), ''],
    ['净支出', money(s.expense - s.income), ''],
    ['平均油耗', avg ? avg.l100.toFixed(2) + ' L' : '—', avg ? `每百公里 · 油费 ¥${avg.costPerKm.toFixed(2)}/km` : '需至少两次加满'],
  ].map(([a, b, c]) => `<div class="kpi"><div>${a}</div><div>${b}</div><div>${c}</div></div>`).join('');

  $('#monthChart').innerHTML = s.expense ? monthChartSVG(s.months) : '<div class="empty">本年暂无支出</div>';

  const cats = Object.entries(s.byType).sort((a, b) => b[1] - a[1]);
  $('#catList').innerHTML = cats.length ? cats.map(([id, v]) => {
    const t = typeOf(id), pct = v / s.expense * 100;
    return `<div class="cat"><div class="top"><span>${t.icon} ${t.label}</span><span>${money(v)} · ${pct.toFixed(1)}%</span></div>
      <div class="track"><div class="fill" style="width:${pct.toFixed(1)}%"></div></div></div>`;
  }).join('') : '<div class="empty">本年暂无支出</div>';

  $('#fuelList').innerHTML = segs.length
    ? `<table><tr><th>加满日期</th><th>里程</th><th>油量</th><th>L/100km</th><th>¥/km</th></tr>${
        segs.slice().reverse().map(x => `<tr><td>${x.date.slice(5)}</td><td>${x.distance}</td><td>${round(x.liters)}</td><td>${x.l100.toFixed(2)}</td><td>${x.costPerKm.toFixed(2)}</td></tr>`).join('')
      }</table>`
    : '<p class="hint">加油时填写里程表并勾选“本次加满”，两次加满后即可算出油耗。</p>';
}

// ---------- 设置与备份 ----------
$('#carName').addEventListener('change', async e => {
  await db.setMeta('carName', e.target.value.trim());
  toast('已保存');
});

async function renderBackupInfo() {
  const t = await db.getMeta('lastBackup');
  $('#backupInfo').textContent = t
    ? `上次导出备份：${new Date(t).toLocaleString('zh-CN')}`
    : '尚未导出过备份。建议每月导出一次，存到“文件”App 或 iCloud。';
}

const stamp = () => today().replace(/-/g, '');

$('#exportJson').addEventListener('click', async () => {
  const settings = { carName: await db.getMeta('carName') || '' };
  const ok = await saveFile(`车账本备份_${stamp()}.json`, toJSON(records, settings), 'application/json');
  if (ok) { await db.setMeta('lastBackup', Date.now()); renderBackupInfo(); toast('备份已导出'); }
});

$('#exportCsv').addEventListener('click', async () => {
  if (!records.length) return toast('暂无数据');
  await saveFile(`车账本_${stamp()}.csv`, toCSV(records, fuel.byId), 'text/csv');
});

$('#importJson').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const { records: recs, settings } = parseJSON(await file.text());
    if (!confirm(`备份中有 ${recs.length} 条记录。恢复后将替换当前全部 ${records.length} 条记录，确定继续？`)) return;
    await db.replaceAll(recs);
    if (settings.carName !== undefined) { await db.setMeta('carName', settings.carName); $('#carName').value = settings.carName; }
    await refresh();
    toast(`已恢复 ${recs.length} 条记录`);
  } catch (err) {
    toast('导入失败：' + err.message);
  }
});

$('#clearAll').addEventListener('click', async () => {
  if (!records.length) return toast('暂无数据');
  if (!confirm(`将永久删除全部 ${records.length} 条记录，且无法恢复。建议先导出备份。确定清空？`)) return;
  await db.clear();
  resetForm();
  await refresh();
  toast('已清空');
});

// ---------- 启动 ----------
async function refresh() {
  records = (await db.getAll()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  fuel = computeFuel(records);
  renderList();
  renderStats();
  updateOdoHint();
}

(async () => {
  resetForm();
  $('#carName').value = (await db.getMeta('carName')) || '';
  renderBackupInfo();
  await refresh();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
