import { getCuratedLists } from '../lib/providers';

export const curatedLists = getCuratedLists();
export const HAS_SINGLE_LIST = curatedLists.length === 1;

const STEP_KEYS = HAS_SINGLE_LIST
  ? (['resolve', 'preview', 'apply', 'report'] as const)
  : (['source', 'resolve', 'preview', 'apply', 'report'] as const);

export const ROUTE_DEFAULT = '#/' as const;
export const STEP_ROUTES = STEP_KEYS.map(key => {
  const hash = key === 'source' ? '#/app' : (`#/${key}` as const);
  return { hash, key: `step_${key}_title` as const };
});

export type WizardRoute = (typeof STEP_ROUTES)[number]['hash'] | typeof ROUTE_DEFAULT;

export const ALL_ROUTES: WizardRoute[] = [ROUTE_DEFAULT, ...STEP_ROUTES.map(route => route.hash)];
export const FIRST_STEP_HASH = STEP_ROUTES[0]?.hash ?? '#/resolve';
