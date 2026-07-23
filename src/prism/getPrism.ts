import type * as Prism from 'prismjs';
import PrismModule from 'prismjs';

export function getPrism(): typeof Prism | undefined {
  if (typeof window !== 'undefined' && (window as unknown as { Prism?: typeof Prism }).Prism) {
    return (window as unknown as { Prism?: typeof Prism }).Prism;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { Prism?: typeof Prism }).Prism) {
    return (globalThis as unknown as { Prism?: typeof Prism }).Prism;
  }
  return PrismModule;
}
