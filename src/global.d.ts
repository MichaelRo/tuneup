/* ---------------------------------------------
 * Ambient globals & helpers for a web TS app
 * Keep this file small, focused, and discoverable.
 * Place at project root or under src/, and make sure tsconfig.json includes it.
 * --------------------------------------------- */

/** 1) Augment the browser Window safely */
import type { ToastType } from './types/ui';

declare global {
  interface Window {
    /**
     * Global toast helper — can be patched or reassigned.
     */
    showToast: (message: string, tone?: ToastType) => void;
  }

  /** 2) A typed CustomEvent for app-wide toast dispatch (decoupled from window API) */
  interface ShowToastDetail {
    message: string;
    type?: ToastType;
    durationMs?: number;
    id?: string;
  }

  interface DocumentEventMap {
    'app:show-toast': CustomEvent<ShowToastDetail>;
  }
}

/** 3) CSS module declarations */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.module.sass' {
  const classes: Record<string, string>;
  export default classes;
}

/** 5) Common static assets */
declare module '*.svg' {
  // Default export: url string (works everywhere)
  const src: string;
  export default src;

  // If using SVGR (React): `import { ReactComponent as Icon } from "./icon.svg"`
  export const ReactComponent: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.avif' {
  const src: string;
  export default src;
}
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.mp4' {
  const src: string;
  export default src;
}

/* ---------------------------------------------
 * Implementation notes / guard rails
 * ---------------------------------------------
 * - Prefer importing utilities instead of globals. Use `window.showToast` only for truly global UX affordances.
 * - If you use the custom event:
 *     document.dispatchEvent(new CustomEvent<ShowToastDetail>("app:show-toast", { detail: {...} }));
 * - Keep this file curated; don’t dump ad-hoc types here.
 * - Make sure tsconfig.json includes it:
 *     {
 *       "compilerOptions": { "types": [], ... },
 *       "include": ["src", "global.d.ts"]
 *     }
 *   (Avoid "typeRoots" unless you know why you need it.)
 * --------------------------------------------- */

export {}; // ensure this file is treated as a module so `declare global` works
