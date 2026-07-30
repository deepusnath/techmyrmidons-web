'use client';

/**
 * Local-first user state.
 *
 * Everything the user does — following, marking tools, submissions, feedback —
 * lives in their own browser. There is no account and no server in this pilot,
 * which is deliberate: the first session should reach the core loop without a
 * signup wall.
 *
 * Records are shaped the way a server would store them, so a later account
 * feature can upload them as-is rather than reshaping anything.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type ProgressState = 'exploring' | 'using' | 'shipped';

export const PROGRESS_ORDER: ProgressState[] = ['exploring', 'using', 'shipped'];

export const PROGRESS_META: Record<ProgressState, { label: string; verb: string; blurb: string }> = {
  exploring: { label: 'Exploring', verb: 'Exploring', blurb: 'Reading about it or trying it out.' },
  using: { label: 'Using', verb: 'Using', blurb: 'Working with it regularly.' },
  shipped: { label: 'Shipped', verb: 'Shipped', blurb: 'Shipped something real with it.' },
};

export interface ToolStateRecord {
  state: ProgressState;
  updated_at: string;
}

export interface Submission {
  id: string;
  type: 'tool' | 'resource';
  name: string;
  url: string;
  why: string;
  created_at: string;
}

export interface FeedbackRecord {
  id: string;
  route: string;
  sentiment: 'works' | 'confusing' | 'broken' | 'idea';
  body: string;
  created_at: string;
}

export interface LocalState {
  follows: string[];
  tools: Record<string, ToolStateRecord>;
  submissions: Submission[];
  feedback: FeedbackRecord[];
}

const KEY = 'techmyrmidons.v1';

const EMPTY: LocalState = { follows: [], tools: {}, submissions: [], feedback: [] };

let cache: LocalState = EMPTY;
let cacheRaw: string | null = null;
const listeners = new Set<() => void>();

function read(): LocalState {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY; // private mode / storage disabled
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  if (!raw) {
    cache = EMPTY;
    return cache;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    cache = {
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
      tools: parsed.tools && typeof parsed.tools === 'object' ? parsed.tools : {},
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch {
    cache = EMPTY; // corrupt payload should not brick the app
  }
  return cache;
}

function write(next: LocalState) {
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(KEY, raw);
    cacheRaw = raw;
    cache = next;
  } catch {
    cache = next; // still update in memory so the session keeps working
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep multiple tabs consistent.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLocalState() {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggleFollow = useCallback((domain: string) => {
    const cur = read();
    const follows = cur.follows.includes(domain)
      ? cur.follows.filter((d) => d !== domain)
      : [...cur.follows, domain];
    write({ ...cur, follows });
  }, []);

  /** Setting the state a tool is already in clears it — the button is a toggle. */
  const setToolState = useCallback((slug: string, next: ProgressState | null) => {
    const cur = read();
    const tools = { ...cur.tools };
    if (next === null || tools[slug]?.state === next) delete tools[slug];
    else tools[slug] = { state: next, updated_at: new Date().toISOString() };
    write({ ...cur, tools });
  }, []);

  const addSubmission = useCallback((s: Omit<Submission, 'id' | 'created_at'>) => {
    const cur = read();
    const entry: Submission = {
      ...s,
      id: `sub_${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
    };
    write({ ...cur, submissions: [entry, ...cur.submissions] });
    return entry;
  }, []);

  const addFeedback = useCallback((f: Omit<FeedbackRecord, 'id' | 'created_at'>) => {
    const cur = read();
    const entry: FeedbackRecord = {
      ...f,
      id: `fb_${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
    };
    write({ ...cur, feedback: [entry, ...cur.feedback] });
    return entry;
  }, []);

  const reset = useCallback(() => write(EMPTY), []);

  return {
    state,
    isFollowing: (domain: string) => state.follows.includes(domain),
    toolState: (slug: string): ProgressState | null => state.tools[slug]?.state ?? null,
    toggleFollow,
    setToolState,
    addSubmission,
    addFeedback,
    reset,
  };
}

/** True once the client has hydrated; use to avoid SSR/client markup mismatch. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
