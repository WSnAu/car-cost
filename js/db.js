// IndexedDB 封装：records 存记录，meta 存设置（键值）
const DB_NAME = 'car-cost';
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getAll = () => run('records', 'readonly', s => s.getAll());
export const put = rec => run('records', 'readwrite', s => s.put(rec));
export const remove = id => run('records', 'readwrite', s => s.delete(id));
export const clear = () => run('records', 'readwrite', s => s.clear());
export const replaceAll = records => run('records', 'readwrite', s => {
  s.clear();
  records.forEach(r => s.put(r));
});
export const getMeta = key => run('meta', 'readonly', s => s.get(key));
export const setMeta = (key, value) => run('meta', 'readwrite', s => s.put(value, key));
