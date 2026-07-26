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
const DISPLAY_DURATION_MS = 4_000;
const MAX_QUEUED_ROLLS = 5;
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
  if (cleaned.length === 0) return 'PLAYER';

  // Player portal login IDs are intentionally opaque. They should never become
  // the large human-facing label in the dice notification.
  if (/^[a-f0-9]{10,24}$/i.test(cleaned)) return 'PLAYER';
  return cleaned;
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
      right: 14px;
      bottom: 14px;
      z-index: 2147483646;
      width: min(380px, calc(100vw - 28px));
      pointer-events: none;
    }
    .payaw-party-dice-banner {
      width: 100%;
      color: #111;
      background: #c7c7c7;
      border: 2px solid;
      border-color: #fff #202020 #202020 #fff;
      box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.46);
      font-family: Tahoma, "MS Sans Serif", Arial, sans-serif;
      transform-origin: right bottom;
      animation: payaw-party-dice-enter 140ms ease-out,
        payaw-party-dice-exit 180ms ease-in 2.08s forwards;
    }
    .payaw-party-dice-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 25px;
      padding: 3px 6px;
      color: #fff;
      background: linear-gradient(90deg, #08266f 0%, #1261b4 72%, #4b96d6 100%);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.55);
    }
    .payaw-party-dice-titlebar span:last-child {
      display: grid;
      place-items: center;
      width: 17px;
      height: 17px;
      color: #111;
      background: #c7c7c7;
      border: 1px solid;
      border-color: #fff #333 #333 #fff;
      font-size: 9px;
      text-shadow: none;
    }
    .payaw-party-dice-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      min-height: 66px;
      margin: 4px;
      padding: 9px 10px;
      background: #ecece7;
      border: 2px solid;
      border-color: #696969 #fff #fff #696969;
    }
    .payaw-party-dice-copy {
      min-width: 0;
    }
    .payaw-party-dice-copy strong {
      display: block;
      overflow: hidden;
      color: #111;
      font-size: 16px;
      font-weight: 800;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .payaw-party-dice-copy small {
      display: block;
      margin-top: 5px;
      overflow: hidden;
      color: #4b4b4b;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .payaw-party-dice-total {
      display: grid;
      place-items: center;
      min-width: 58px;
      min-height: 46px;
      padding: 2px 8px;
      color: #f2c94c;
      background: #111914;
      border: 2px solid;
      border-color: #575f5a #050805 #050805 #575f5a;
      font-size: 30px;
      font-weight: 900;
      line-height: 1;
    }
    @keyframes payaw-party-dice-enter {
      from { opacity: 0; transform: translateX(24px) scale(0.98); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes payaw-party-dice-exit {
      to { opacity: 0; transform: translateX(18px) scale(0.98); }
    }
    @media (max-width: 720px) {
      #${ROOT_ID} {
        top: 64px;
        right: 8px;
        bottom: auto;
        width: min(360px, calc(100vw - 16px));
      }
      .payaw-party-dice-banner { transform-origin: right top; }
    }
    @media (prefers-reduced-motion: reduce) {
      .payaw-party-dice-banner {
        animation: payaw-party-dice-fade 2.3s linear forwards;
      }
      @keyframes payaw-party-dice-fade {
        0%, 91% { opacity: 1; }
        100% { opacity: 0; }
      }
    }
  `;
  document.head.append(style);
}

function detailText(roll: SharedDiceRoll): string {
  const parts = roll.values.length === 0 ? '' : `[${roll.values.join(', ')}]`;
  const modifier = roll.modifier === 0 ? '' : ` ${roll.modifier > 0 ? '+' : '-'} ${Math.abs(roll.modifier)}`;
  return `${roll.notation}${parts.length === 0 ? '' : ` · ${parts}`}${modifier}`;
}

function showNext(): void {
  const next = queue.shift();
  if (next === undefined) {
    active = false;
    document.getElementById(ROOT_ID)?.replaceChildren();
    return;
  }

  active = true;
  installStyle();
  let root = document.getElementById(ROOT_ID);
  if (root === null) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    document.body.append(root);
  }

  const banner = document.createElement('section');
  banner.className = 'payaw-party-dice-banner';

  const titleBar = document.createElement('div');
  titleBar.className = 'payaw-party-dice-titlebar';
  const title = document.createElement('span');
  title.textContent = 'Party dice';
  const titleIcon = document.createElement('span');
  titleIcon.textContent = '◆';
  titleBar.append(title, titleIcon);

  const body = document.createElement('div');
  body.className = 'payaw-party-dice-body';
  const copy = document.createElement('div');
  copy.className = 'payaw-party-dice-copy';
  const headline = document.createElement('strong');
  headline.textContent = `${next.rollerUsername} rolled`;
  const detail = document.createElement('small');
  detail.textContent = detailText(next);
  copy.append(headline, detail);

  const total = document.createElement('output');
  total.className = 'payaw-party-dice-total';
  total.textContent = String(next.total);
  total.setAttribute('aria-label', `Total ${next.total}`);

  body.append(copy, total);
  banner.append(titleBar, body);
  root.replaceChildren(banner);

  window.setTimeout(() => {
    banner.remove();
    showNext();
  }, DISPLAY_DURATION_MS);
}

export function showDiceRollBanner(roll: SharedDiceRoll): void {
  if (announcedIds.has(roll.id)) return;
  announcedIds.add(roll.id);
  if (announcedIds.size > 500) {
    const oldest = announcedIds.values().next().value as string | undefined;
    if (oldest !== undefined) announcedIds.delete(oldest);
  }

  queue.push(roll);
  if (queue.length > MAX_QUEUED_ROLLS) queue.splice(0, queue.length - MAX_QUEUED_ROLLS);
  if (!active) showNext();
}
