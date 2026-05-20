import { vi } from 'vitest';

beforeAll(() => {
  // Scroll behavior mocks
  Element.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  
  // Pointer event mocks
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  
  // Dialog focus management mocks
  window.HTMLElement.prototype.focus = vi.fn();
  window.HTMLElement.prototype.blur = vi.fn();
  
  // ResizeObserver mock
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});
