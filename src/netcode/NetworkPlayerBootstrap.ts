import { installPlayerApp } from '../player/PlayerApp';
import { PlayerNetworkSession } from './PlayerNetworkSession';
import { SupabaseGateway } from './SupabaseGateway';
import type { PresenceRecord } from './NetcodeTypes';

declare global {
  interface Window {
    turnstile?: { render(target: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }): string };
  }
}

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className.length > 0) element.className = className;
  if (text.length > 0) element.textContent = text;
  return element;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : 'The campaign room could not be opened.';
}

function roomId(): string {
  const value = new URLSearchParams(location.search).get('room') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('This player link does not contain a valid campaign room.');
  return value;
}

function inviteToken(): string | null {
  const value = new URLSearchParams(location.search).get('invite');
  return value !== null && /^[0-9a-f]{16}$/i.test(value) ? value : null;
}

function removeInviteFromAddress(): void {
  const url = new URL(location.href);
  url.searchParams.delete('invite');
  history.replaceState(null, '', url);
}

function renderJoin(app: HTMLElement, campaignId: string, token: string, gateway: SupabaseGateway): void {
  document.body.classList.add('player-view-body', 'player-join-body');
  document.title = 'Join PAYAW Campaign';
  const shell = create('main', 'player-join-shell');
  const card = create('section', 'player-join-card');
  card.append(create('span', 'player-preview-badge', 'PRIVATE CAMPAIGN INVITATION'));
  card.append(create('h1', '', 'Join the table'));
  card.append(create('p', '', 'Choose the name the GM will see. This invite assigns the character slot selected by the GM; knowing another character ID does not grant access.'));
  const form = create('form', 'player-join-form');
  const label = create('label'); label.append(create('span', '', 'Your display name'));
  const name = create('input'); name.required = true; name.maxLength = 80; name.autocomplete = 'name'; name.placeholder = 'e.g. Bea'; label.append(name);
  const submit = create('button', 'player-primary', 'Join campaign'); submit.type = 'submit';
  const status = create('p', 'player-join-status', 'The link is single-use and expires automatically.');
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();
  let captchaToken: string | undefined;
  if (turnstileSiteKey.length > 0) {
    submit.disabled = true;
    const challenge = create('div', 'player-turnstile');
    form.append(label, challenge, submit, status);
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true;
    script.addEventListener('load', () => window.turnstile?.render(challenge, {
      sitekey: turnstileSiteKey,
      callback: (value) => { captchaToken = value; submit.disabled = false; status.textContent = 'Invitation ready to verify.'; },
      'expired-callback': () => { captchaToken = undefined; submit.disabled = true; status.textContent = 'Verification expired; complete it again.'; },
    }));
    document.head.append(script);
  } else form.append(label, submit, status);
  const note = create('p', 'player-join-note', 'PAYAW creates a private Supabase identity for this browser. Clearing site data or signing out removes access until the GM sends a new invitation.');
  card.append(form, note); shell.append(card); app.replaceChildren(shell);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); submit.disabled = true; status.textContent = 'Verifying invitation…';
    try {
      const session = await gateway.ensureAnonymousSession(name.value, captchaToken);
      await gateway.claimInvitation(token, name.value);
      removeInviteFromAddress();
      await openRoom(app, campaignId, session.user.id, gateway);
    } catch (error) {
      status.textContent = errorMessage(error); submit.disabled = false;
    }
  });
}

async function openRoom(app: HTMLElement, campaignId: string, userId: string, gateway: SupabaseGateway): Promise<void> {
  app.replaceChildren(create('main', 'player-join-shell', 'Loading your safe campaign projection…'));
  let projection;
  let displayName: string;
  let sourcePlayerId: string;
  try {
    const slot = await gateway.assignedSlot(campaignId, userId);
    projection = slot.projection;
    displayName = slot.display_name;
    sourcePlayerId = slot.source_player_id;
  } catch (error) {
    const cached = PlayerNetworkSession.cachedProjection(campaignId, userId);
    if (cached === null) throw error;
    projection = cached;
    displayName = cached.viewer.displayName;
    sourcePlayerId = cached.viewer.id;
  }
  const presence: PresenceRecord = {
    userId, displayName, role: 'player', sourcePlayerId,
    view: 'player', state: 'online', onlineAt: new Date().toISOString(),
  };
  const networkSession = new PlayerNetworkSession(campaignId, userId, projection, gateway, presence);
  await networkSession.start();
  installPlayerApp({ session: networkSession });
}

export async function installNetworkedPlayerApp(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) throw new Error('Player View requires the #app root.');
  const campaignId = roomId();
  const token = inviteToken();
  const gateway = new SupabaseGateway();
  try {
    const session = await gateway.session();
    if (token !== null) { renderJoin(app, campaignId, token, gateway); return; }
    if (session === null) throw new Error('This invitation has not been claimed on this browser. Ask the GM for a fresh player link.');
    await openRoom(app, campaignId, session.user.id, gateway);
  } catch (error) {
    document.body.classList.add('player-view-body', 'player-join-body');
    const shell = create('main', 'player-join-shell'); const card = create('section', 'player-join-card');
    card.append(create('span', 'player-preview-badge', 'SAFE PLAYER VIEW'), create('h1', '', 'Campaign unavailable'), create('p', '', errorMessage(error)));
    const retry = create('button', 'player-primary', 'Try again'); retry.type = 'button'; retry.addEventListener('click', () => location.reload());
    card.append(retry); shell.append(card); app.replaceChildren(shell);
  }
}
