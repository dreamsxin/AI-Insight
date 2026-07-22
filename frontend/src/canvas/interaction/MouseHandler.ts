/** MouseHandler - translates DOM mouse events into canvas-space coordinates. */

export class MouseHandler {
  private canvas: HTMLCanvasElement;
  private onMouseMoveCb: ((x: number, y: number) => void) | null = null;
  private onMouseDownCb: ((x: number, y: number) => void) | null = null;
  private onMouseUpCb: ((x: number, y: number) => void) | null = null;
  private onClickCb: ((x: number, y: number) => void) | null = null;
  private dpr: number = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("mouseup", this.handleMouseUp);
    canvas.addEventListener("click", this.handleClick);
  }

  private getCanvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private handleMouseMove = (e: MouseEvent) => {
    const { x, y } = this.getCanvasCoords(e);
    this.onMouseMoveCb?.(x, y);
  };

  private handleMouseDown = (e: MouseEvent) => {
    const { x, y } = this.getCanvasCoords(e);
    this.onMouseDownCb?.(x, y);
  };

  private handleMouseUp = (e: MouseEvent) => {
    const { x, y } = this.getCanvasCoords(e);
    this.onMouseUpCb?.(x, y);
  };

  private handleClick = (e: MouseEvent) => {
    const { x, y } = this.getCanvasCoords(e);
    this.onClickCb?.(x, y);
  };

  onMouseMove(cb: (x: number, y: number) => void): void {
    this.onMouseMoveCb = cb;
  }

  onMouseDown(cb: (x: number, y: number) => void): void {
    this.onMouseDownCb = cb;
  }

  onMouseUp(cb: (x: number, y: number) => void): void {
    this.onMouseUpCb = cb;
  }

  onClick(cb: (x: number, y: number) => void): void {
    this.onClickCb = cb;
  }

  destroy(): void {
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("click", this.handleClick);
  }
}
