const BROWSER_SESSION_STORAGE_KEY = 'payaw.browser-session.v1';
const PROJECT_AUTOSAVE_STORAGE_KEY = 'payaw.session-autosave.v1';
const RESUME_COOKIE_NAME = 'payaw_resume';
const RESUME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type SessionWorkspace = 'editor' | 'dm';

export interface PersistedMapView {
  readonly seed: string;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly visibleLayers: readonly string[];
}

export interface BrowserSessionState {
  readonly version: 1;
  readonly activePanels: Readonly<Partial<Record<SessionWorkspace, string>>>;
  readonly mapView?: PersistedMapView;
  readonly updatedAt: string;
}

export interface BrowserSessionUpdate {
  readonly activePanels?: Readonly<Partial<Record<SessionWorkspace, string>>>;
  readonly mapView?: PersistedMapView;
}

export type AutosaveRecoveryInfo =
  | { readonly state: 'none' }
  | { readonly state: 'invalid' }
  | { readonly state: 'available'; readonly seed: string; readonly savedAt: string | null };

function finiteNumber(value: unknown, minimum: number, maximum: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeMapView(value: unknown): PersistedMapView | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.seed !== 'string' || candidate.seed.length === 0 || candidate.seed.length > 1_024) return undefined;
  const x = finiteNumber(candidate.x, -10_000_000, 10_000_000);
  const y = finiteNumber(candidate.y, -10_000_000, 10_000_000);
  const zoom = finiteNumber(candidate.zoom, 0.5, 24);
  if (x === undefined || y === undefined || zoom === undefined || !Array.isArray(candidate.visibleLayers)) return undefined;
  const visibleLayers = candidate.visibleLayers
    .filter((layer): layer is string => typeof layer === 'string' && layer.length > 0 && layer.length <= 64)
    .slice(0, 64);
  return { seed: candidate.seed, x, y, zoom, visibleLayers };
}

function normalizeSession(value: unknown): BrowserSessionState | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const rawPanels = typeof candidate.activePanels === 'object' && candidate.activePanels !== null
    ? candidate.activePanels as Record<string, unknown>
    : {};
  const activePanels: Partial<Record<SessionWorkspace, string>> = {};
  if (typeof rawPanels.editor === 'string') activePanels.editor = rawPanels.editor;
  if (typeof rawPanels.dm === 'string') activePanels.dm = rawPanels.dm;
  const mapView = normalizeMapView(candidate.mapView);
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date(0).toISOString();
  return {
    version: 1,
    activePanels,
    ...(mapView === undefined ? {} : { mapView }),
    updatedAt,
  };
}

export function readBrowserSession(): BrowserSessionState | null {
  try {
    const raw = localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);
    return raw === null ? null : normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function markSessionResumeAvailable(): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${RESUME_COOKIE_NAME}=v1; Max-Age=${RESUME_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Local persistence still works when a browser blocks cookies.
  }
}

export function hasSessionResumeMarker(): boolean {
  try {
    return document.cookie.split(';').some((part) => part.trim() === `${RESUME_COOKIE_NAME}=v1`);
  } catch {
    return false;
  }
}

export function updateBrowserSession(update: BrowserSessionUpdate): void {
  const current = readBrowserSession();
  const next: BrowserSessionState = {
    version: 1,
    activePanels: {
      ...(current?.activePanels ?? {}),
      ...(update.activePanels ?? {}),
    },
    ...(update.mapView === undefined
      ? (current?.mapView === undefined ? {} : { mapView: current.mapView })
      : { mapView: update.mapView }),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Session persistence is best effort when browser storage is unavailable.
  }
}

export function readAutosavedProject(): string | null {
  try {
    return localStorage.getItem(PROJECT_AUTOSAVE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeAutosavedProject(payload: unknown): void {
  localStorage.setItem(PROJECT_AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
}

export function readAutosaveRecoveryInfo(): AutosaveRecoveryInfo {
  const raw = readAutosavedProject();
  if (raw === null) return { state: 'none' };
  try {
    const parsed = JSON.parse(raw) as { autosavedAt?: unknown; project?: { seed?: unknown } };
    return {
      state: 'available',
      seed: typeof parsed.project?.seed === 'string' ? parsed.project.seed : 'The last world',
      savedAt: typeof parsed.autosavedAt === 'string' ? parsed.autosavedAt : null,
    };
  } catch {
    return { state: 'invalid' };
  }
}
