import { installPlayerApp } from '../player/PlayerApp';
import { PlayerNetworkSession } from './PlayerNetworkSession';
import { createPlayerSupabaseClient, normalizeCampaignId, normalizePlayerLoginId } from './SupabaseClient';
import { SupabaseGateway } from './SupabaseGateway';
import type { PresenceRecord } from './NetcodeTypes';

const PLAYER_PORTAL_SESSION_KEY = 'payaw-player-portal-current';

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
  return value instanceof Error ? value.message : 'The player portal could not be opened.';
}

interface StoredPortalSession {
  readonly username: string;
  readonly campaignId: string;
}

function readStoredPortalSession(): StoredPortalSession | null {
  try {
    const raw = localStorage.getItem(PLAYER_PORTAL_SESSION_KEY);
    if (raw === null) return null;
    const value = JSON.parse(raw) as { username?: unknown; loginId?: unknown; campaignId?: unknown };
    const sourceUsername = typeof value.username === 'string' ? value.username : value.loginId;
    if (typeof sourceUsername !== 'string' || typeof value.campaignId !== 'string') return null;
    return {
      username: normalizePlayerLoginId(sourceUsername),
      campaignId: normalizeCampaignId(value.campaignId),
    };
  } catch {
    return null;
  }
}

function initialCampaignIdFromAddress(): string {
  const value = new URLSearchParams(location.search).get('room');
  if (value === null) return '';
  try { return normalizeCampaignId(value); } catch { return ''; }
}

function writePortalSession(username: string, campaignId: string): void {
  const url = new URL(location.href);
  url.searchParams.set('view', 'player');
  url.searchParams.delete('player');
  url.searchParams.delete('room');
  url.searchParams.delete('invite');
  url.searchParams.delete('device');
  history.replaceState(null, '', url);
  localStorage.setItem(PLAYER_PORTAL_SESSION_KEY, JSON.stringify({ username, campaignId }));
}

function clearPortalSession(): void {
  const url = new URL(location.href);
  url.searchParams.set('view', 'player');
  url.searchParams.delete('player');
  url.searchParams.delete('room');
  url.searchParams.delete('invite');
  url.searchParams.delete('device');
  history.replaceState(null, '', url);
  localStorage.removeItem(PLAYER_PORTAL_SESSION_KEY);
}

function renderPortalLogin(
  app: HTMLElement,
  initialCampaignId = '',
  initialUsername = '',
  initialError = '',
): void {
  document.body.classList.add('player-view-body', 'player-join-body');
  document.title = 'PAYAW Player Portal';
  const shell = create('main', 'player-join-shell');
  const card = create('section', 'player-join-card');
  card.append(create('span', 'player-preview-badge', 'PERSISTENT PLAYER PORTAL'));
  card.append(create('h1', '', 'Enter your campaign'));
  card.append(create('p', '', 'Enter the campaign ID, username, and password provided by your GM. Your player session remains signed in on this browser until you sign out.'));

  const form = create('form', 'player-join-form');

  const campaignLabel = create('label');
  campaignLabel.append(create('span', '', 'Campaign ID'));
  const campaignId = create('input');
  campaignId.required = true;
  campaignId.maxLength = 36;
  campaignId.autocomplete = 'off';
  campaignId.autocapitalize = 'none';
  campaignId.spellcheck = false;
  campaignId.placeholder = '00000000-0000-0000-0000-000000000000';
  campaignId.value = initialCampaignId;
  campaignLabel.append(campaignId);

  const usernameLabel = create('label');
  usernameLabel.append(create('span', '', 'Username'));
  const username = create('input');
  username.required = true;
  username.maxLength = 24;
  username.autocomplete = 'username';
  username.autocapitalize = 'characters';
  username.spellcheck = false;
  username.placeholder = 'Player username';
  username.value = initialUsername;
  usernameLabel.append(username);

  const passwordLabel = create('label');
  passwordLabel.append(create('span', '', 'Password'));
  const password = create('input');
  password.type = 'password';
  password.required = true;
  password.minLength = 8;
  password.autocomplete = 'current-password';
  password.placeholder = 'Player portal password';
  passwordLabel.append(password);

  const submit = create('button', 'player-primary', 'Open Player View');
  submit.type = 'submit';
  const status = create('p', 'player-join-status', initialError || 'These credentials remain valid until the GM resets or disables them.');
  const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();
  let captchaToken: string | undefined;
  if (turnstileSiteKey.length > 0) {
    submit.disabled = true;
    const challenge = create('div', 'player-turnstile');
    form.append(campaignLabel, usernameLabel, passwordLabel, challenge, submit, status);
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => window.turnstile?.render(challenge, {
      sitekey: turnstileSiteKey,
      callback: (value) => { captchaToken = value; submit.disabled = false; status.textContent = 'Player login ready.'; },
      'expired-callback': () => { captchaToken = undefined; submit.disabled = true; status.textContent = 'Verification expired; complete it again.'; },
    }));
    document.head.append(script);
  } else {
    form.append(campaignLabel, usernameLabel, passwordLabel, submit, status);
  }

  const note = create('p', 'player-join-note', 'Use the permanent Player Portal URL. The campaign ID selects the room; the username and password select your player slot.');
  card.append(form, note);
  shell.append(card);
  app.replaceChildren(shell);

  campaignId.addEventListener('input', () => {
    campaignId.value = campaignId.value.toLowerCase().replace(/[^0-9a-f-]/g, '').slice(0, 36);
  });
  username.addEventListener('input', () => {
    username.value = username.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Signing in to the player portal…';
    try {
      const normalizedCampaignId = normalizeCampaignId(campaignId.value);
      const normalizedUsername = normalizePlayerLoginId(username.value);
      const gateway = new SupabaseGateway(createPlayerSupabaseClient(normalizedCampaignId, normalizedUsername));
      const resolved = await gateway.resolvePlayerPortal(normalizedCampaignId, normalizedUsername, password.value);
      const session = await gateway.signInOrCreatePlayerAccount(
        resolved.authEmail,
        password.value,
        resolved.displayName,
        captchaToken,
      );
      const claimed = await gateway.claimPlayerPortal(normalizedCampaignId, normalizedUsername, password.value);
      if (
        claimed.campaignId !== normalizedCampaignId
        || claimed.campaignId !== resolved.campaignId
        || claimed.sourcePlayerId !== resolved.sourcePlayerId
      ) {
        throw new Error('The player portal returned an inconsistent campaign slot.');
      }
      writePortalSession(normalizedUsername, normalizedCampaignId);
      await openRoom(app, normalizedCampaignId, session.user.id, gateway, normalizedUsername);
    } catch (error) {
      status.textContent = errorMessage(error);
      submit.disabled = false;
    }
  });
}

async function openRoom(
  app: HTMLElement,
  campaignId: string,
  userId: string,
  gateway: SupabaseGateway,
  username: string,
): Promise<void> {
  app.replaceChildren(create('main', 'player-join-shell', 'Loading your campaign projection…'));
  let projection;
  let displayName: string;
  let sourcePlayerId: string;
  try {
    const slot = await gateway.assignedSlot(campaignId, userId);
    projection = slot.projection;
    displayName = slot.display_name;
    sourcePlayerId = slot.source_player_id;
  } catch (error) {
    if (error instanceof Error && error.message === 'PLAYER_PORTAL_ACCESS_REVOKED') throw error;
    const cached = PlayerNetworkSession.cachedProjection(campaignId, userId);
    if (cached === null) throw error;
    projection = cached;
    displayName = cached.viewer.displayName;
    sourcePlayerId = cached.viewer.id;
  }
  const presence: PresenceRecord = {
    userId,
    displayName,
    role: 'player',
    sourcePlayerId,
    view: 'player',
    state: 'online',
    onlineAt: new Date().toISOString(),
  };
  const networkSession = new PlayerNetworkSession(campaignId, userId, projection, gateway, presence);
  await networkSession.start();
  installPlayerApp({
    session: networkSession,
    playerUsername: username,
    onChangeCredentials: async ({ currentPassword, newUsername, newPassword }) => {
      const normalizedUsername = normalizePlayerLoginId(newUsername);
      await gateway.verifyPlayerPortalPassword(campaignId, currentPassword);

      let authPasswordChanged = false;
      if (newPassword.length > 0) {
        await gateway.updateCurrentUserPassword(newPassword);
        authPasswordChanged = true;
      }

      try {
        const updatedUsername = await gateway.changePlayerPortalCredentials(
          campaignId,
          currentPassword,
          normalizedUsername,
          newPassword,
        );
        networkSession.stop();
        await gateway.signOut();
        clearPortalSession();
        renderPortalLogin(
          app,
          campaignId,
          updatedUsername,
          'Credentials updated. Sign in again with your new username and password.',
        );
      } catch (error) {
        if (authPasswordChanged) {
          try {
            await gateway.updateCurrentUserPassword(currentPassword);
          } catch (rollbackError) {
            const original = errorMessage(error);
            const rollback = errorMessage(rollbackError);
            throw new Error(`${original} | AUTH_PASSWORD_ROLLBACK_FAILED: ${rollback}`);
          }
        }
        throw error;
      }
    },
    onSignOut: async () => {
      networkSession.stop();
      await gateway.signOut();
      clearPortalSession();
      renderPortalLogin(app, campaignId, username, 'Signed out from this player account.');
    },
  });
}

export async function installNetworkedPlayerApp(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) throw new Error('Player View requires the #app root.');
  const stored = readStoredPortalSession();
  const initialCampaignId = stored?.campaignId ?? initialCampaignIdFromAddress();
  const initialUsername = stored?.username ?? '';
  if (stored === null) {
    clearPortalSession();
    renderPortalLogin(app, initialCampaignId, initialUsername);
    return;
  }

  const gateway = new SupabaseGateway(createPlayerSupabaseClient(stored.campaignId, stored.username));
  try {
    const session = await gateway.session();
    if (session === null) {
      renderPortalLogin(app, stored.campaignId, stored.username, 'Enter your password to continue.');
      return;
    }
    await openRoom(app, stored.campaignId, session.user.id, gateway, stored.username);
  } catch (error) {
    if (error instanceof Error && error.message === 'PLAYER_PORTAL_ACCESS_REVOKED') {
      try { await gateway.signOut(); } catch { /* Preserve the actual access error even if remote sign-out fails. */ }
      clearPortalSession();
      renderPortalLogin(app, stored.campaignId, stored.username, errorMessage(error));
      return;
    }
    renderPortalLogin(app, stored.campaignId, stored.username, errorMessage(error));
  }
}
