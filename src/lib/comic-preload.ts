export function preloadComicImages(urls: string[]) {
  let active = true;
  const queue = [...urls], pending = new Map<HTMLImageElement, () => void>();
  async function worker() {
    while (active && queue.length) {
      await new Promise<void>((resolve) => {
        // Native image loading follows private Storage redirects without fetch/CORS requirements.
        const image = new Image();
        const finish = () => {
          image.onload = image.onerror = null;
          pending.delete(image);
          resolve();
        };
        pending.set(image, finish);
        image.onload = image.onerror = finish;
        image.src = queue.shift()!;
      });
    }
  }
  for (let n = 0; n < 3; n++) void worker();
  return () => {
    active = false;
    for (const [image, finish] of [...pending]) {
      finish();
      image.removeAttribute("src");
    }
  };
}
