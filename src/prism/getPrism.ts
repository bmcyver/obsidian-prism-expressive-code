import type * as Prism from 'prismjs';

// DO NOT ADD FALLBACK HERE!
export function getPrism(): typeof Prism | undefined {
  return (window as unknown as { Prism?: typeof Prism }).Prism;
}
