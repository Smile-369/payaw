export interface SharedDiceRoll {
  readonly id: string;
  readonly rollerUsername: string;
  readonly notation: string;
  readonly values: readonly number[];
  readonly modifier: number;
  readonly total: number;
  readonly rolledAt: string;
}

const STYLE_ID = 'payaw-party-dice-banner-style';
const ROOT_ID = 'payaw-party-dice-banner-root';
const announcedIds = new Set<string>();
const queue: SharedDiceRoll[] = [];
let active = false;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanUsername(value: unknown): string {
  if (typeof value !== 'string') return 'PLAYER';
  const cleaned = value.trim().slice(0, 24);
  return cleaned.length > 0 ? cleaned : 'PLAYER';
}

export function parseSharedDiceRoll(value: unknown): SharedDiceRoll | null {
  const candidate = record(value);
  if (candidate === null || typeof candidate.id !== 'string') return null;
  const values = Array.isArray(candidate.values)
    ? candidate.values.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [];
  const total = Number(candidate.total);
  if (!Number.isFinite(total)) return null;
  return {
    id: candidate.id,
    rollerUsername: cleanUsername(candidate.rollerUsername ?? candidate.rollerLabel),
    notation: typeof candidate.notation === 'string' && candidate.notation.trim().length > 0
      ? candidate.notation.trim().slice(0, 24)
      : 'dice',
    values,
    modifier: Number.isFinite(Number(candidate.modifier)) ? Number(candidate.modifier) : 0,
    total,
    rolledAt: typeof candidate.rolledAt === 'string' ? candidate.rolledAt : new Date().toISOString(),
  };
}

function installStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: grid;
      place-items: start center;
      padding: clamp(72px, 12vh, 140px) 16px 16px;
      pointer-events: none;
    }
    .payaw-party-dice-banner {
      width: min(760px, calc(100vw - 32px));
      padding: 22px 28px 24px;
      border: 3px solid #fff;
      border-radius: 18px;
      background: rgba(8, 13, 11, 0.96);
      color: #fff;
      box-shadow: 0 18px 70px rgba(0, 0, 0, 0.55), 0 0 0 5px rgba(19, 78, 139, 0.9);
      text-align: center;
      transform-origin: top center;
      animation: payaw-party-dice-enter 180ms ease-out, payaw-party-dice-exit 260ms ease-in 3.05s forwards;
    }
    .payaw-party-dice-banner strong {
      display: block;
      overflow-wrap: anywhere;
      font-family: Arial, Helvetica, sans-serif;
      font-size: clamp(28px, 5vw, 58px);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.05;
      text-transform: uppercase;
    }
    .payaw-party-dice-banner strong b {
      color: #ffd45c;
      font-size: 1.2em;
    }
    .payaw-party-dice-banner small {
      display: block;
      margin-top: 10px;
      color: #cfd8d3;
      font-family: Arial, Helvetica, sans-serif;
      font-size: clamp(13px, 2vw, 18px);
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    @keyframes payaw-party-dice-enter {
      from { opacity: 0; transform: translateY(-24px) scale(0.93); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes payaw-party-dice-exit {
      to { opacity: 0; transform: translateY(-16px) scale(0.97); }
    }
    @media (prefers-reduced-motion: reduce) {
      .payaw-party-dice-banner { animation: payaw-party-dice-fade 3.3s linear forwards; }
      @keyframes payaw-party-dice-fade { 0%, 92% { opacity: 1; } 100% { opacity: 0; } }
    }
  `;
  document.head.append(style);
}

function detailText(roll: SharedDiceRoll): string {
  const parts = roll.values.join(' + ');
  const modifier = roll.modifier === 0 ? '' : ` ${roll.modifier > 0 ? '+' : '-'} ${Math.abs(roll.modifier)}`;
  return `${roll.notation} · ${parts}${modifier}`;
}

function showNext(): void {
  const next = queue.shift();
  if (next === undefined) {
    active = false;
    return;
  }
  active = true;
  installStyle();
  let root = document.getElementById(ROOT_ID);
  if (root === null) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('aria-live', 'assertive');
    root.setAttribute('aria-atomic', 'true');
    document.body.append(root);
  }
  const banner = document.createElement('section');
  banner.className = 'payaw-party-dice-banner';
  const headline = document.createElement('strong');
  headline.append(document.createTextNode(`${next.rollerUsername} rolled `));
  const total = document.createElement('b');
  total.textContent = String(next.total);
  headline.append(total);
  const detail = document.createElement('small');
  detail.textContent = detailText(next);
  banner.append(headline, detail);
  root.replaceChildren(banner);
  window.setTimeout(() => {
    banner.remove();
    showNext();
  }, 3400);
}

export function showDiceRollBanner(roll: SharedDiceRoll): void {
  if (announcedIds.has(roll.id)) return;
  announcedIds.add(roll.id);
  if (announcedIds.size > 500) {
    const oldest = announcedIds.values().next().value as string | undefined;
    if (oldest !== undefined) announcedIds.delete(oldest);
  }
  queue.push(roll);
  if (!active) showNext();
}
