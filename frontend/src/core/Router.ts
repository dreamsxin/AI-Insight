/** Hash-based router: #/ch1/p2 -> {chapter: 1, page: 2}. */

export interface Route {
  chapter: number;
  page: number;
}

export class Router {
  private current: Route = { chapter: 1, page: 1 };
  private listeners: Set<(route: Route) => void> = new Set();

  constructor() {
    window.addEventListener("hashchange", this.handleHashChange);
    this.handleHashChange();
  }

  private handleHashChange = () => {
    const hash = window.location.hash.slice(1); // remove #
    const match = hash.match(/ch(\d+)(?:\/p(\d+))?/);
    if (match) {
      this.current = {
        chapter: parseInt(match[1], 10),
        page: match[2] ? parseInt(match[2], 10) : 1,
      };
      this.listeners.forEach((fn) => fn(this.current));
    }
  };

  navigate(chapter: number, page: number = 1): void {
    window.location.hash = `#/ch${chapter}/p${page}`;
  }

  next(): void {
    this.navigate(this.current.chapter, this.current.page + 1);
  }

  prev(): void {
    this.navigate(this.current.chapter, Math.max(1, this.current.page - 1));
  }

  onChange(cb: (route: Route) => void): () => void {
    this.listeners.add(cb);
    cb(this.current);
    return () => this.listeners.delete(cb);
  }

  get route(): Route {
    return this.current;
  }

  destroy(): void {
    window.removeEventListener("hashchange", this.handleHashChange);
  }
}
