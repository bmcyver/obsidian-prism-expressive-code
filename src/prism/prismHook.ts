import { getPrism } from './getPrism';

type PrismHookCallback = (env: unknown) => void;

const HOOK_NAME = 'before-all-elements-highlight';

export function filterExpressiveCodeElements(env: unknown): void {
  const environment = env as { elements?: Element[] };
  if (environment.elements) {
    environment.elements = environment.elements.filter(
      (element: Element) => !element.matches('div.expressive-code pre code'),
    );
  }
}

export function registerPrismHook(callback: PrismHookCallback): void {
  const prism = getPrism();
  if (prism?.hooks) {
    unregisterPrismHook(callback);
    prism.hooks.add(HOOK_NAME, callback);
  }
}

export function unregisterPrismHook(callback: PrismHookCallback): void {
  const prism = getPrism();
  if (prism?.hooks?.all) {
    const hooks = prism.hooks.all[HOOK_NAME];
    if (hooks) {
      prism.hooks.all[HOOK_NAME] = hooks.filter((hook) => hook !== callback);
    }
  }
}
