/**
 * The image behind the window. The file is kept in IndexedDB as it was chosen, so a GIF
 * goes on moving, and the preferences only hold its key. Builds before 3.1 kept a shrunk
 * copy in the preferences as a data URL; that one is still shown.
 */
const DATABASE = "shelduck.background";
const STORE = "images";
const KEY = /^image:[0-9a-f-]{36}$/;
/** A still image larger than this is scaled down: behind a terminal, more pixels only cost memory. */
const LONGEST_SIDE = 3840;

export const MAX_BACKGROUND_BYTES = 40_000_000;
export const MAX_BACKGROUND_BLUR = 40;

export const isBackgroundImage = (value: unknown): value is string =>
  typeof value === "string" && (KEY.test(value) || (value.startsWith("data:image/") && value.length <= 3_500_000));

/** Runs `work` in one transaction and resolves, once it's on disk, with what its request found. */
async function inStore<T = undefined>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** `file` itself, or a smaller copy of a very large still image. Rejects what the webview can't draw. */
async function sized(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = LONGEST_SIDE / Math.max(image.naturalWidth, image.naturalHeight);
    // A GIF keeps its size whatever it is: drawn again, it would be left with its first frame.
    if (!(scale < 1) || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    // A photo stays a JPEG. The rest may be see-through in places, which WebP keeps; a webview
    // that can't write WebP answers with a PNG.
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), type, 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Keeps `file` as the background, in place of the one before, and returns its key. */
export async function saveBackgroundImage(file: Blob): Promise<string> {
  const image = await sized(file);
  const key = `image:${crypto.randomUUID()}`;
  await inStore("readwrite", (store) => {
    store.clear();
    store.put(image, key);
  });
  return key;
}

/** The image kept under `key`, or nothing when it's gone. */
export async function loadBackgroundImage(key: string): Promise<Blob | undefined> {
  const found = await inStore<unknown>("readonly", (store) => store.get(key));
  return found instanceof Blob ? found : undefined;
}

export async function forgetBackgroundImage(): Promise<void> {
  await inStore("readwrite", (store) => void store.clear());
}

/**
 * How the image is laid under the window, for `visibility` of it to show behind the text:
 * `image` is its opacity over the chrome color, where the tabs are, and `surface` how much
 * of the theme's background the terminal adds on top. A see-through terminal adds less.
 */
export function backgroundLayers(visibility: number, terminalOpacity: number): { image: number; surface: number } {
  const image = visibility ** 0.75;
  return { image, surface: (1 - visibility / image) * terminalOpacity };
}
