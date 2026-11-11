// 油耗计算（加满法）
// 以一次“加满”为起点，到下一次“加满”为一段：
//   段油耗 = 段内（不含起点、含终点）所有加油升数 ÷ 里程差 × 100
// 中间未加满的记录累计进下一段。第一次加满之前的记录不参与计算。
export function computeFuel(records) {
  const fuels = records
    .filter(r => r.type === 'fuel' && r.odometer > 0 && r.liters > 0)
    .sort((a, b) => a.odometer - b.odometer || a.date.localeCompare(b.date));

  const segments = [];
  let base = null, liters = 0, cost = 0;
  for (const r of fuels) {
    if (base) { liters += r.liters; cost += r.amount; }
    if (r.full) {
      if (base && r.odometer > base.odometer) {
        const distance = r.odometer - base.odometer;
        segments.push({
          id: r.id, date: r.date, from: base.odometer, to: r.odometer,
          distance, liters, cost,
          l100: liters / distance * 100,
          costPerKm: cost / distance,
        });
      }
      base = r; liters = 0; cost = 0;
    }
  }
  return { segments, byId: new Map(segments.map(s => [s.id, s])) };
}

export function averageFuel(segments) {
  const distance = segments.reduce((a, s) => a + s.distance, 0);
  if (!distance) return null;
  const liters = segments.reduce((a, s) => a + s.liters, 0);
  const cost = segments.reduce((a, s) => a + s.cost, 0);
  return { distance, liters, cost, l100: liters / distance * 100, costPerKm: cost / distance };
}
