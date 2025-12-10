import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock canvas context for Three.js
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock WebGL context
const mockWebGLContext = {
  getExtension: vi.fn(),
  getParameter: vi.fn(() => 16384),
  getShaderPrecisionFormat: vi.fn(() => ({ precision: 1, rangeMin: 1, rangeMax: 1 })),
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  useProgram: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  blendFunc: vi.fn(),
  viewport: vi.fn(),
  clear: vi.fn(),
  drawArrays: vi.fn(),
  createTexture: vi.fn(),
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  activeTexture: vi.fn(),
  pixelStorei: vi.fn(),
  getUniformLocation: vi.fn(),
  getAttribLocation: vi.fn(() => 0),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  uniform1i: vi.fn(),
  uniform1f: vi.fn(),
  uniform2f: vi.fn(),
  uniform3f: vi.fn(),
  uniform4f: vi.fn(),
  uniformMatrix4fv: vi.fn(),
  clearColor: vi.fn(),
  clearDepth: vi.fn(),
  depthFunc: vi.fn(),
  cullFace: vi.fn(),
  frontFace: vi.fn(),
  createFramebuffer: vi.fn(),
  bindFramebuffer: vi.fn(),
  framebufferTexture2D: vi.fn(),
  createRenderbuffer: vi.fn(),
  bindRenderbuffer: vi.fn(),
  renderbufferStorage: vi.fn(),
  framebufferRenderbuffer: vi.fn(),
  checkFramebufferStatus: vi.fn(() => 36053),
  deleteShader: vi.fn(),
  deleteProgram: vi.fn(),
  deleteBuffer: vi.fn(),
  deleteTexture: vi.fn(),
  deleteFramebuffer: vi.fn(),
  deleteRenderbuffer: vi.fn(),
  drawingBufferWidth: 800,
  drawingBufferHeight: 600,
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
  options?: unknown
) {
  if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
    return mockWebGLContext as unknown as WebGLRenderingContext;
  }
  return originalGetContext.call(this, contextId, options);
} as typeof HTMLCanvasElement.prototype.getContext;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
