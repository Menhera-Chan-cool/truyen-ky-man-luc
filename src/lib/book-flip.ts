type FlipInstance = {
  on(name: string, callback: (event: { data: string }) => void): void;
  loadFromHTML(pages: HTMLElement[]): void;
  flipNext(corner: string): void;
  flipPrev(corner: string): void;
  getFlipController(): {
    start(point: { x: number; y: number }): boolean;
    fold(point: { x: number; y: number }): void;
  };
  getRender(): {
    convertToGlobal(point: { x: number; y: number }): { x: number; y: number };
  };
};
type FlipWindow = Window & {
  St?: {
    PageFlip: new (
      root: HTMLElement,
      options: Record<string, string | number | boolean>,
    ) => FlipInstance;
  };
};

// Snapshots live in a disposable browsing context: no duplicate live IDs, selection or idle library RAF loop.
export class BookFlip {
  private frame: HTMLIFrameElement | null = null;
  private host: HTMLDivElement | null = null;
  private ready = false;
  private disposed = false;
  private timer = 0;
  private finishFrame = 0;
  private drag: {
    flip?: FlipInstance;
    x: number;
    y: number;
    originY: number;
    released?: boolean;
    settled?: boolean;
    onTurn: () => void;
  } | null = null;
  private pending: {
    old: HTMLElement;
    direction: number;
    width: number;
    height: number;
    stamp?: string;
  } | null = null;
  private observer: ResizeObserver;
  private size: string;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");
  constructor(
    private paper: HTMLElement,
    private double: boolean,
  ) {
    this.size = `${paper.clientWidth}:${paper.clientHeight}`;
    this.observer = new ResizeObserver(() => {
      const size = `${paper.clientWidth}:${paper.clientHeight}`;
      if (size !== this.size) {
        this.size = size;
        this.reset(true);
      }
    });
    this.observer.observe(paper);
    this.reduced.addEventListener("change", this.visibility);
    document.addEventListener("visibilitychange", this.visibility);
    document.addEventListener("freeze", this.hide);
    window.addEventListener("pagehide", this.hide);
    window.addEventListener("pageshow", this.visibility);
    this.warm();
  }
  private visibility = () => {
    if (document.hidden || this.reduced.matches) this.reset(false);
    else this.warm();
  };
  private hide = () => this.reset(false);
  private css() {
    let result = "";
    for (const sheet of document.styleSheets) {
      try {
        const base = sheet.href ?? location.href;
        result += [...sheet.cssRules]
          .map((rule) =>
            rule.cssText.replace(
              /url\((['"]?)(.*?)\1\)/g,
              (all, _quote, url) =>
                /^(data:|#)/.test(url)
                  ? all
                  : `url("${new URL(url, base).href}")`,
            ),
          )
          .join("\n");
      } catch {
        /* Cross-origin optional styles are not needed for the self-hosted reader. */
      }
    }
    return (
      result +
      "\nhtml,body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden!important}.book-animation-stage{position:absolute;left:0;top:0}.book-animation-page{overflow:hidden}.reader-document{animation:none!important;box-shadow:none!important}"
    );
  }
  private warm() {
    if (
      this.disposed ||
      this.frame ||
      document.hidden ||
      this.reduced.matches ||
      !this.paper.isConnected
    )
      return;
    const host = document.createElement("div"),
      frame = document.createElement("iframe");
    host.dataset.bookAnimation = "true";
    host.className = "book-animation-host";
    host.style.visibility = "hidden";
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    frame.title = "Book page animation";
    frame.tabIndex = -1;
    frame.style.width = `${innerWidth}px`;
    frame.style.height = `${innerHeight}px`;
    host.append(frame);
    this.paper.append(host);
    this.host = host;
    this.frame = frame;
    this.paper.dataset.flipReady = "false";
    frame.onload = async () => {
      const doc = frame.contentDocument,
        win = frame.contentWindow as FlipWindow | null;
      if (!doc || !win?.St || this.frame !== frame || this.disposed) return;
      const style = doc.createElement("style");
      style.textContent = this.css();
      doc.head.append(style);
      const prose = this.paper.querySelector(".prose"),
        font = prose && getComputedStyle(prose);
      try {
        await Promise.all([
          font
            ? doc.fonts.load(`${font.fontSize} ${font.fontFamily}`)
            : undefined,
          doc.fonts.load('600 25px "Literata Variable"'),
        ]);
        await doc.fonts.ready;
      } catch {
        /* Reading remains instant if an optional animation/font cannot load. */
      }
      if (this.frame !== frame || this.disposed) return;
      this.ready = true;
      this.paper.dataset.flipReady = "true";
    };
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${location.origin}/vendor/page-flip-2.0.7.js"></script></head><body></body></html>`;
  }
  private snapshot() {
    const clone = this.paper.cloneNode(true) as HTMLElement,
      rect = this.paper.getBoundingClientRect();
    clone
      .querySelectorAll("[data-book-animation],.book-edge")
      .forEach((el) => el.remove());
    Object.assign(clone.style, {
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      maxWidth: "none",
      margin: "0",
      animation: "none",
    });
    const sourceWindow =
        this.paper.querySelector<HTMLElement>(".reading-window"),
      targetWindow = clone.querySelector<HTMLElement>(".reading-window");
    if (sourceWindow && targetWindow)
      Object.assign(targetWindow.style, {
        width: `${sourceWindow.clientWidth}px`,
        height: `${sourceWindow.clientHeight}px`,
        flex: "none",
      });
    const images = clone.querySelectorAll<HTMLImageElement>("img");
    this.paper
      .querySelectorAll<HTMLImageElement>("img")
      .forEach((img, index) => {
        const b = img.getBoundingClientRect();
        if (b.width && b.height && images[index])
          Object.assign(images[index].style, {
            width: `${b.width}px`,
            height: `${b.height}px`,
          });
      });
    return clone;
  }
  private wrapper(
    doc: Document,
    snapshot: HTMLElement,
    width: number,
    height: number,
  ) {
    const wrapper = doc.createElement("div");
    wrapper.className = "reader-book";
    Object.assign(wrapper.style, {
      width: `${width}px`,
      height: `${height}px`,
      position: "absolute",
      left: "0",
      top: "0",
    });
    const theme = getComputedStyle(this.paper);
    for (const name of [
      "--reader-bg",
      "--reader-fg",
      "--reader-accent",
      "--footnote-link",
    ])
      wrapper.style.setProperty(name, theme.getPropertyValue(name));
    wrapper.style.color = theme.color;
    wrapper.style.colorScheme = theme.colorScheme;
    wrapper.append(doc.importNode(snapshot, true));
    return wrapper;
  }
  begin(direction: number) {
    if (this.pending) {
      this.reset(true);
      return;
    }
    if (
      !this.ready ||
      !this.frame?.contentDocument ||
      !this.host ||
      document.fonts.status === "loading"
    )
      return;
    const rect = this.paper.getBoundingClientRect(),
      old = this.snapshot(),
      doc = this.frame.contentDocument;
    this.pending = { old, direction, width: rect.width, height: rect.height };
    doc.body.replaceChildren(this.wrapper(doc, old, rect.width, rect.height));
    this.host.classList.add("book-flip-layer");
    this.host.style.visibility = "visible";
    this.paper.dataset.flipping = "true";
    this.paper.dataset.flipReady = "false";
    this.ready = false;
    this.timer = window.setTimeout(() => this.reset(true), 1600);
  }
  commit(stamp: string) {
    if (this.drag) {
      if (this.drag.settled || this.pending?.stamp !== stamp) this.reset(true);
      return;
    }
    const pending = this.pending,
      frame = this.frame,
      doc = frame?.contentDocument,
      win = frame?.contentWindow as FlipWindow | null;
    if (!pending || !doc || !win?.St) return;
    if (pending.stamp) {
      if (pending.stamp !== stamp) this.reset(true);
      return;
    }
    const rect = this.paper.getBoundingClientRect();
    if (
      Math.abs(rect.width - pending.width) > 1 ||
      Math.abs(rect.height - pending.height) > 1
    ) {
      this.reset(true);
      return;
    }
    pending.stamp = stamp;
    this.render(this.snapshot());
  }
  startDrag(
    direction: number,
    stamp: string,
    preview: (paper: HTMLElement) => void,
    y: number,
    onTurn: () => void,
  ) {
    this.begin(direction);
    const pending = this.pending,
      doc = this.frame?.contentDocument;
    if (!pending || !doc) return false;
    pending.stamp = stamp;
    clearTimeout(this.timer);
    const wrapper = this.wrapper(
      doc,
      this.snapshot(),
      pending.width,
      pending.height,
    );
    wrapper.style.visibility = "hidden";
    doc.body.append(wrapper);
    const next = wrapper.firstElementChild as HTMLElement;
    preview(next);
    const snapshot = next.cloneNode(true) as HTMLElement;
    wrapper.remove();
    this.drag = {
      x: 0,
      y: 0,
      originY: Math.max(2, Math.min(pending.height - 2, y)),
      onTurn,
    };
    this.render(snapshot);
    return true;
  }
  moveDrag(dx: number, dy: number) {
    const drag = this.drag,
      pending = this.pending;
    if (!drag || !pending || drag.released !== undefined) return;
    const leaf = pending.width / (this.double ? 2 : 1);
    drag.x = Math.max(0, Math.min(leaf * 2 - 1, -dx * pending.direction));
    drag.y = dy;
    this.foldDrag(leaf - drag.x, drag.originY + dy);
  }
  private foldDrag(x: number, y: number) {
    const flip = this.drag?.flip;
    if (flip)
      flip.getFlipController().fold(flip.getRender().convertToGlobal({ x, y }));
  }
  releaseDrag(commit: boolean) {
    const drag = this.drag,
      pending = this.pending;
    if (!drag || !pending || drag.released !== undefined) return;
    drag.released = commit;
    if (drag.flip) this.settleDrag();
  }
  private settleDrag() {
    const drag = this.drag,
      pending = this.pending;
    if (!drag || !pending) return;
    const leaf = pending.width / (this.double ? 2 : 1),
      startX = leaf - drag.x,
      endX = drag.released ? -leaf + 1 : leaf - 1,
      startY = drag.originY + drag.y,
      endY = drag.originY > pending.height / 2 ? pending.height - 1 : 1,
      started = performance.now();
    const step = (now: number) => {
      if (this.drag !== drag) return;
      const progress = Math.min(1, (now - started) / 220),
        ease = 1 - (1 - progress) ** 3;
      this.foldDrag(
        startX + (endX - startX) * ease,
        startY + (endY - startY) * ease,
      );
      if (progress < 1) this.finishFrame = requestAnimationFrame(step);
      else if (drag.released) {
        drag.settled = true;
        this.timer = window.setTimeout(() => this.reset(true), 1600);
        drag.onTurn();
      } else this.reset(true);
    };
    this.finishFrame = requestAnimationFrame(step);
  }
  private render(next: HTMLElement) {
    const pending = this.pending,
      frame = this.frame,
      doc = frame?.contentDocument,
      win = frame?.contentWindow as FlipWindow | null;
    if (!pending || !doc || !win?.St) return;
    const stage = doc.createElement("div"),
      leafWidth = pending.width / (this.double ? 2 : 1);
    stage.className = "book-animation-stage";
    stage.style.width = `${pending.width}px`;
    stage.style.height = `${pending.height}px`;
    const face = (snapshot: HTMLElement, side: number) => {
      const page = doc.createElement("div");
      page.className = "book-animation-page";
      page.style.background = getComputedStyle(this.paper).backgroundColor;
      const content = this.wrapper(
        doc,
        snapshot,
        pending.width,
        pending.height,
      );
      content.style.left = `${-side * leafWidth}px`;
      page.append(content);
      return page;
    };
    const oldFaces = this.double
        ? [face(pending.old, 0), face(pending.old, 1)]
        : [face(pending.old, 0)],
      newFaces = this.double ? [face(next, 0), face(next, 1)] : [face(next, 0)];
    const pages =
      pending.direction > 0
        ? [...oldFaces, ...newFaces]
        : [...newFaces, ...oldFaces];
    stage.append(...pages);
    doc.body.append(stage);
    try {
      const flip = new win.St.PageFlip(stage, {
        width: leafWidth,
        height: pending.height,
        size: "fixed",
        usePortrait: !this.double,
        autoSize: false,
        showCover: false,
        drawShadow: true,
        maxShadowOpacity: 0.3,
        flippingTime: 450,
        startPage: pending.direction > 0 ? 0 : oldFaces.length,
        useMouseEvents: false,
        showPageCorners: false,
        clickEventForward: false,
        mobileScrollSupport: false,
      });
      let started = false;
      flip.on("changeState", (event) => {
        if (this.drag) return;
        if (event.data === "flipping") started = true;
        if (event.data === "read" && started)
          this.finishFrame = requestAnimationFrame(() => this.reset(true));
      });
      flip.on("init", () => {
        if (this.frame === frame && this.pending === pending) {
          if (this.drag) {
            const drag = this.drag;
            drag.flip = flip;
            flip.getFlipController().start({
              x: pending.direction > 0 ? pending.width - 2 : 2,
              y: drag.originY,
            });
            this.foldDrag(leafWidth - drag.x, drag.originY + drag.y);
            if (drag.released !== undefined) this.settleDrag();
          } else if (pending.direction > 0) flip.flipNext("bottom");
          else flip.flipPrev("bottom");
        }
      });
      flip.loadFromHTML(pages);
    } catch {
      this.reset(true);
    }
  }
  cancel() {
    if (this.pending) this.reset(true);
  }
  private reset(rewarm: boolean) {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.finishFrame);
    this.host?.remove();
    this.host = null;
    this.frame = null;
    this.pending = null;
    this.drag = null;
    this.ready = false;
    delete this.paper.dataset.flipping;
    delete this.paper.dataset.flipReady;
    if (rewarm) this.warm();
  }
  dispose() {
    this.disposed = true;
    this.reset(false);
    this.observer.disconnect();
    this.reduced.removeEventListener("change", this.visibility);
    document.removeEventListener("visibilitychange", this.visibility);
    document.removeEventListener("freeze", this.hide);
    window.removeEventListener("pagehide", this.hide);
    window.removeEventListener("pageshow", this.visibility);
  }
}
