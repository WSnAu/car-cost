export const TYPES = [
  { id: 'fuel', label: '加油', icon: '⛽' },
  { id: 'toll', label: '高速费', icon: '🛣️' },
  { id: 'maintenance', label: '保养维修', icon: '🔧' },
  { id: 'insurance', label: '保险', icon: '🛡️' },
  { id: 'parking', label: '停车', icon: '🅿️' },
  { id: 'wash', label: '洗车', icon: '🧽' },
  { id: 'other', label: '其他支出', icon: '📌' },
  { id: 'ride', label: '顺风车', icon: '🤝', income: true },
];

export const typeOf = id => TYPES.find(t => t.id === id) || TYPES.find(t => t.id === 'other');
export const isIncome = r => typeOf(r.type).income === true;
