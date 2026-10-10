// Fotos dos rolês, guardadas no próprio aparelho (IndexedDB, que aguenta arquivos
// bem maiores que o armazenamento comum). Antes de guardar, a foto é reduzida:
// uma foto de celular tem uns 4 MB; reduzida fica em torno de 200 KB.
// Tudo aqui falha em silêncio: sem armazenamento, a conta segue funcionando sem foto.

const DB_NAME = 'racha-conta';
const STORE = 'fotos';
const MAX_SIDE = 1600;
const QUALITY = 0.82;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function putPhoto(id: string, blob: Blob): Promise<boolean> {
  try {
    await run('readwrite', (s) => s.put(blob, id));
    return true;
  } catch {
    return false;
  }
}

export async function getPhoto(id: string): Promise<Blob | null> {
  try {
    const v = await run<unknown>('readonly', (s) => s.get(id));
    return v instanceof Blob ? v : null;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    /* nada a fazer */
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Reduz a foto para no máximo 1600 px no lado maior, em JPEG. Já respeita a orientação da câmera. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    src = await loadImage(file);
  }
  const w = src.width;
  const h = src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')?.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ('close' in src) src.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('foto'))), 'image/jpeg', QUALITY),
  );
}
