import type * as Prism from 'prismjs';

export function getPrism(): typeof Prism | undefined {
  return (window as unknown as { Prism?: typeof Prism }).Prism;
}
