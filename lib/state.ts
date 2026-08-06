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

export interface AssessmentState {
  work: string | null;
  goal: string | null;
  baseline: string | null;
  completed_at: string | null;
}

export interface LocalState {
  follows: string[];
  /** Keyed `${domain}/${slug}`: tool slugs are unique per domain, not globally. */
  tools: Record<string, ToolStateRecord>;
  submissions: Submission[];
  feedback: FeedbackRecord[];
  /**
   * One assessment per domain. The work contexts are domain-specific — a
   * design-system context means something in frontend and nothing in AI — so a
   * single shared answer would ask the wrong question of the second domain.
   */
  assessments: Record<string, AssessmentState>;
}

const KEY = 'techmyrmidons.v2';

/**
 * v1 stored one assessment and keyed tools by bare slug, because the pilot had
 * a single active domain. Everything it holds therefore belongs to that domain.
 */
const LEGACY_KEY = 'techmyrmidons.v1';
const LEGACY_DOMAIN = 'frontend';

export const toolKey = (domain: string, slug: string) => `${domain}/${slug}`;

const EMPTY_ASSESSMENT: AssessmentState = { work: null, goal: null, baseline: null, completed_at: null };

const EMPTY: LocalState = {
  follows: [],
  tools: {},
  submissions: [],
  feedback: [],
  assessments: {},
};

let cache: LocalState = EMPTY;
let cacheRaw: string | null = null;
const listeners = new Set<() => void>();

/** v1 payload → v2 shape. Everything it holds belongs to the one domain it had. */
function migrateLegacy(parsed: Record<string, unknown>): LocalState {
  const tools: Record<string, ToolStateRecord> = {};
  const old = (parsed.tools ?? {}) as Record<string, ToolStateRecord>;
  for (const [slug, rec] of Object.entries(old)) tools[toolKey(LEGACY_DOMAIN, slug)] = rec;

  const assessment = parsed.assessment as AssessmentState | undefined;
  return {
    follows: Array.isArray(parsed.follows) ? (parsed.follows as string[]) : [],
    tools,
    submissions: Array.isArray(parsed.submissions) ? (parsed.submissions as Submission[]) : [],
    feedback: Array.isArray(parsed.feedback) ? (parsed.feedback as FeedbackRecord[]) : [],
    assessments:
      assessment && typeof assessment === 'object'
        ? { [LEGACY_DOMAIN]: { ...EMPTY_ASSESSMENT, ...assessment } }
        : {},
  };
}

function read(): LocalState {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null = null;
  let legacy = false;
  try {
    raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      // Migration is read-only: the v2 payload is written on the next change,
      // so this never writes to storage during a render.
      raw = window.localStorage.getItem(LEGACY_KEY);
      legacy = raw !== null;
    }
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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    cache = legacy
      ? migrateLegacy(parsed)
      : {
          follows: Array.isArray(parsed.follows) ? (parsed.follows as string[]) : [],
          tools:
            parsed.tools && typeof parsed.tools === 'object'
              ? (parsed.tools as Record<string, ToolStateRecord>)
              : {},
          submissions: Array.isArray(parsed.submissions) ? (parsed.submissions as Submission[]) : [],
          feedback: Array.isArray(parsed.feedback) ? (parsed.feedback as FeedbackRecord[]) : [],
          assessments:
            parsed.assessments && typeof parsed.assessments === 'object'
              ? (parsed.assessments as Record<string, AssessmentState>)
              : {},
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

/**
 * @param domain scopes tool marks and the assessment. Omitted only by callers
 *   that touch neither — submissions, feedback and the follow toggle, which are
 *   genuinely global.
 */
export function useLocalState(domain = '') {
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
    const k = toolKey(domain, slug);
    if (next === null || tools[k]?.state === next) delete tools[k];
    else tools[k] = { state: next, updated_at: new Date().toISOString() };
    write({ ...cur, tools });
  }, [domain]);

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

  const setAssessment = useCallback((patch: Partial<AssessmentState>) => {
    const cur = read();
    const prev = cur.assessments[domain] ?? EMPTY_ASSESSMENT;
    write({ ...cur, assessments: { ...cur.assessments, [domain]: { ...prev, ...patch } } });
  }, [domain]);

  /**
   * Marks the guided flow finished. Deliberately separate from answering:
   * picking a work context and a goal must not yank the tool-selection step
   * away mid-flow, so leaving the assessment is always the user's decision.
   */
  const completeAssessment = useCallback(() => {
    const cur = read();
    const prev = cur.assessments[domain] ?? EMPTY_ASSESSMENT;
    if (!prev.work || !prev.goal) return;
    write({
      ...cur,
      assessments: {
        ...cur.assessments,
        [domain]: { ...prev, completed_at: new Date().toISOString() },
      },
    });
  }, [domain]);

  const clearAssessment = useCallback(() => {
    const cur = read();
    write({ ...cur, assessments: { ...cur.assessments, [domain]: EMPTY_ASSESSMENT } });
  }, [domain]);

  const reset = useCallback(() => write(EMPTY), []);

  /** Tool marks for this domain only, keyed by bare slug for the callers' convenience. */
  const marked: Record<string, ToolStateRecord> = {};
  const prefix = `${domain}/`;
  for (const [k, v] of Object.entries(state.tools)) {
    if (k.startsWith(prefix)) marked[k.slice(prefix.length)] = v;
  }

  return {
    state,
    /** This domain's answers. Never the other domain's. */
    assessment: state.assessments[domain] ?? EMPTY_ASSESSMENT,
    marked,
    isFollowing: (domain: string) => state.follows.includes(domain),
    toolState: (slug: string): ProgressState | null =>
      state.tools[toolKey(domain, slug)]?.state ?? null,
    toggleFollow,
    setToolState,
    addSubmission,
    addFeedback,
    setAssessment,
    completeAssessment,
    clearAssessment,
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
