import { vi } from 'vitest';

if (Element.prototype.scrollIntoView === undefined) {
  Element.prototype.scrollIntoView = vi.fn();
}

class IntegrationPointerEvent extends MouseEvent {
  private _pointerId: number;
  private _pointerType: string;
  private _isPrimary: boolean;
  private _clientX: number;
  private _clientY: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, { bubbles: true, cancelable: true, composed: true, ...init });
    this._pointerId = init.pointerId ?? 1;
    this._pointerType = init.pointerType ?? 'mouse';
    this._isPrimary = init.isPrimary ?? true;
    this._clientX = init.clientX ?? 0;
    this._clientY = init.clientY ?? 0;
    Object.defineProperty(this, 'button', { value: init.button ?? 0, configurable: true });
    Object.defineProperty(this, 'buttons', { value: init.buttons ?? 1, configurable: true });
  }

  get pointerId() { return this._pointerId; }
  get pointerType() { return this._pointerType; }
  get isPrimary() { return this._isPrimary; }
  get clientX() { return this._clientX; }
  get clientY() { return this._clientY; }
  get x() { return this._clientX; }
  get y() { return this._clientY; }
  get pageX() { return this._clientX; }
  get pageY() { return this._clientY; }
}

Object.defineProperty(globalThis, 'PointerEvent', {
  configurable: true,
  writable: true,
  value: IntegrationPointerEvent,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: IntegrationPointerEvent,
  });
}

if (HTMLElement.prototype.setPointerCapture === undefined) {
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  HTMLElement.prototype.hasPointerCapture = () => false;
}

if (globalThis.ResizeObserver === undefined) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
  const rect = originalGetBoundingClientRect.call(this);
  if (rect.width !== 0 || rect.height !== 0 || rect.top !== 0 || rect.bottom !== 0) {
    return rect;
  }
  let top = 0;
  let multiplier = 50;
  let curr: Element | null = this;
  const path: number[] = [];
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (curr.parentElement) {
      const idx = Array.from(curr.parentElement.children).indexOf(curr);
      path.unshift(idx);
    }
    curr = curr.parentElement;
  }
  for (const idx of path) {
    top = top * 20 + (idx + 1) * multiplier;
  }
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 400,
    bottom: top + 40,
    width: 400,
    height: 40,
    toJSON: () => ({}),
  } as DOMRect;
};
