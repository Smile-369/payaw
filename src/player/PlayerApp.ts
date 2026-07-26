import { applyPlayerCommand, type PlayerCommand } from './PlayerCommands';
import {
  PLAYER_PROJECTION_LATEST_KEY,
  PLAYER_PROJECTION_STORAGE_PREFIX,
  ProjectionVersionError,
  parsePlayerProjection,
  type AssetProjection,
  type JournalEntryProjection,
  type MessageThreadProjection,
  type PlayerProjection,
} from './PlayerProjection';
import type { ConnectionSnapshot } from '../netcode/NetcodeTypes';
import { GenerationWorkerClient } from '../browser/GenerationWorkerClient';
import { EMPTY_RENDER_CUSTOMIZATION } from '../customization/Customization';
import { GenerationPipeline } from '../engine/generation/GenerationPipeline';
import { Camera } from '../engine/renderer/Camera';
import { CanvasRenderer } from '../engine/renderer/CanvasRenderer';
import { RenderLayer } from '../engine/renderer/Layers';
import type { World } from '../engine/world/World';
import { hydratePlayerWorldGenerationOptions, type PlayerWorldGenerationRecipe } from './PlayerWorldRecipe';

export interface PlayerAppSession {
  readonly mode: 'network';
  projection(): PlayerProjection;
  submit(command: PlayerCommand): Promise<PlayerProjection>;
  onProjection(listener: (projection: PlayerProjection) => void): () => void;
  onConnection(listener: (state: ConnectionSnapshot) => void): () => void;
  stop(): void;
}

export interface PlayerCredentialUpdate {
  readonly currentPassword: string;
  readonly newUsername: string;
  readonly newPassword: string;
}

export interface PlayerAppOptions {
  readonly session?: PlayerAppSession;
  readonly playerUsername?: string;
  readonly onChangeCredentials?: (update: PlayerCredentialUpdate) => Promise<void>;
  readonly onSignOut?: () => Promise<void>;
}

type PlayerPanel = 'map' | 'scene' | 'journal' | 'messages' | 'character' | 'home' | 'people' | 'places' | 'clues' | 'handouts' | 'objectives';

interface SearchItem {
  readonly panel: PlayerPanel;
  readonly title: string;
  readonly subtitle: string;
}

const PANEL_INFO: Readonly<Record<PlayerPanel, { readonly label: string; readonly icon: string; readonly eyebrow: string }>> = {
  map: { label: 'Map', icon: '⌖', eyebrow: 'Revealed world' },
  scene: { label: 'Scene', icon: '◈', eyebrow: 'Current focus' },
  journal: { label: 'Journal', icon: '✎', eyebrow: 'Your notes' },
  messages: { label: 'Messages', icon: '☏', eyebrow: 'In-world communication' },
  character: { label: 'Character', icon: '☺', eyebrow: 'Your character' },
  home: { label: 'Campaign', icon: '⌂', eyebrow: 'Campaign overview' },
  people: { label: 'Known People', icon: '♟', eyebrow: 'People you know' },
  places: { label: 'Known Places', icon: '⌂', eyebrow: 'Places you know' },
  clues: { label: 'Clues', icon: '◇', eyebrow: 'Discovered evidence' },
  handouts: { label: 'Handouts', icon: '▧', eyebrow: 'Revealed media' },
  objectives: { label: 'Objectives', icon: '✓', eyebrow: 'Current goals' },
};

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className.length > 0) element.className = className;
  if (text.length > 0) element.textContent = text;
  return element;
}

function appendText(parent: HTMLElement, tag: 'strong' | 'span' | 'small' | 'p' | 'h2' | 'h3', text: string, className = ''): HTMLElement {
  const child = create(tag, className, text);
  parent.append(child);
  return child;
}

function formatDate(value: string, timezone?: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value || 'Unknown time';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function titleCase(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?';
}

function panelHeader(panel: PlayerPanel, detail = ''): HTMLElement {
  const header = create('header', 'player-page-header');
  const copy = create('div');
  appendText(copy, 'p', PANEL_INFO[panel].eyebrow);
  appendText(copy, 'h2', PANEL_INFO[panel].label).tagName;
  const heading = copy.querySelector('h2');
  if (heading !== null) {
    const replacement = create('h1', '', PANEL_INFO[panel].label);
    heading.replaceWith(replacement);
  }
  header.append(copy);
  if (detail.length > 0) appendText(header, 'span', detail);
  return header;
}

function card(title: string, subtitle = '', span = 'player-span-12'): HTMLElement {
  const article = create('article', `player-card ${span}`);
  const header = create('div', 'player-card-head');
  const copy = create('div');
  appendText(copy, 'h2', title);
  if (subtitle.length > 0) appendText(copy, 'small', subtitle);
  header.append(copy);
  article.append(header);
  return article;
}

function emptyState(title: string, description: string): HTMLElement {
  const empty = create('div', 'player-empty');
  const copy = create('div');
  appendText(copy, 'strong', title);
  appendText(copy, 'p', description);
  empty.append(copy);
  return empty;
}

function knowledgeBadge(level: string): HTMLElement {
  return create('span', `player-card-badge knowledge-${level}`, titleCase(level));
}

function storageSelection(): { readonly key: string; readonly token: string } {
  const token = new URLSearchParams(location.search).get('projection');
  if (token !== null && /^[a-z0-9-]{8,80}$/i.test(token)) return { key: `${PLAYER_PROJECTION_STORAGE_PREFIX}${token}`, token };
  return { key: PLAYER_PROJECTION_LATEST_KEY, token: 'latest' };
}

function readProjection(): { readonly projection: PlayerProjection; readonly key: string } {
  const selection = storageSelection();
  const raw = localStorage.getItem(selection.key);
  if (raw === null) throw new Error('No safe player projection is available. Return to the GM workspace and choose Open Player Preview.');
  return { projection: parsePlayerProjection(JSON.parse(raw) as unknown), key: selection.key };
}

function writeProjection(key: string, projection: PlayerProjection): void {
  localStorage.setItem(key, JSON.stringify(projection));
  localStorage.setItem(PLAYER_PROJECTION_LATEST_KEY, JSON.stringify(projection));
}

function renderFatal(app: HTMLElement, error: unknown): void {
  app.replaceChildren();
  const shell = create('main', 'player-error-shell');
  const message = error instanceof ProjectionVersionError
    ? error.message
    : error instanceof Error ? error.message : 'The player projection could not be loaded.';
  const content = create('article', 'player-error-card');
  appendText(content, 'span', 'SAFE PLAYER VIEW', 'player-preview-badge');
  const heading = create('h1', '', 'Projection unavailable');
  content.append(heading);
  appendText(content, 'p', message);
  appendText(content, 'p', 'For privacy, Player View will never fall back to the GM project or attempt to recover hidden records.');
  const retry = create('button', 'player-primary', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  content.append(retry);
  shell.append(content);
  app.append(shell);
}

function searchItems(projection: PlayerProjection): SearchItem[] {
  const items: SearchItem[] = [];
  if (projection.activeScene !== undefined) items.push({ panel: 'scene', title: projection.activeScene.title, subtitle: projection.activeScene.locationLabel });
  for (const npc of projection.knownNpcs) items.push({ panel: 'people', title: npc.name, subtitle: npc.description });
  for (const location of projection.knownLocations) items.push({ panel: 'places', title: location.name, subtitle: `${location.type} ${location.description}` });
  for (const clue of projection.clues) items.push({ panel: 'clues', title: clue.title, subtitle: clue.description });
  for (const handout of projection.handouts) items.push({ panel: 'handouts', title: handout.title, subtitle: handout.caption });
  for (const thread of projection.messages) items.push({ panel: 'messages', title: thread.name, subtitle: `${thread.medium} ${thread.messages.map((message) => message.body).join(' ')}` });
  for (const objective of projection.objectives) items.push({ panel: 'objectives', title: objective.wording, subtitle: objective.status });
  for (const entry of [...projection.journal.personal, ...projection.journal.shared]) items.push({ panel: 'journal', title: entry.title, subtitle: entry.body });
  return items;
}

function renderSceneHero(projection: PlayerProjection): HTMLElement {
  const scene = projection.activeScene;
  if (scene === undefined) return emptyState('No active scene', 'The campaign is between scenes. Use the revealed map, journal, messages, and handouts while the GM prepares the next moment.');
  const hero = create('section', 'player-scene-hero');
  appendText(hero, 'span', 'CURRENT SCENE', 'scene-kicker');
  const title = create('h2', '', scene.title);
  hero.append(title);
  appendText(hero, 'span', scene.locationLabel, 'player-scene-location');
  if (scene.description.trim().length > 0) appendText(hero, 'p', scene.description, 'player-scene-description');
  if (scene.readAloud.trim().length > 0) appendText(hero, 'p', scene.readAloud, 'player-scene-readaloud');
  const ambient = create('div', 'player-ambient-row');
  appendText(ambient, 'span', formatDate(scene.ambient.time, projection.campaign.timezone));
  appendText(ambient, 'span', titleCase(scene.ambient.weather));
  for (const condition of scene.ambient.conditions) appendText(ambient, 'span', condition);
  hero.append(ambient);
  return hero;
}

function renderHome(projection: PlayerProjection): HTMLElement {
  const fragment = document.createDocumentFragment();
  fragment.append(panelHeader('home', `${projection.viewer.characterName} · ${formatDate(projection.campaign.campaignTime, projection.campaign.timezone)}`));
  fragment.append(renderSceneHero(projection));
  const grid = create('section', 'player-grid');
  const summary = card('Your campaign at a glance', 'Only information currently available to you.', 'player-span-12');
  const stats = create('div', 'player-stat-grid');
  for (const [label, value] of [
    ['Known people', projection.knownNpcs.length],
    ['Known places', projection.knownLocations.length],
    ['Clues', projection.clues.length],
    ['Messages', projection.messages.reduce((sum, thread) => sum + thread.messages.length, 0)],
  ] as const) {
    const item = create('div', 'player-stat');
    appendText(item, 'small', label);
    appendText(item, 'strong', String(value));
    stats.append(item);
  }
  summary.append(stats);
  grid.append(summary);
  const recent = card('Recent reveals', 'The latest safe projection updates.', 'player-span-6');
  const revealList = create('div', 'player-list');
  if (projection.notifications.length === 0) revealList.append(emptyState('No new reveals', 'New information will appear here after the GM reveals it.'));
  for (const notification of projection.notifications) {
    const row = create('div', 'player-list-item');
    const copy = create('div');
    appendText(copy, 'strong', notification.text);
    appendText(copy, 'p', formatDate(notification.createdAt, projection.campaign.timezone));
    row.append(copy, create('span', 'player-card-badge', notification.kind));
    revealList.append(row);
  }
  recent.append(revealList);
  const goals = card('Objectives', 'Player-safe active and completed goals.', 'player-span-6');
  const goalList = create('div', 'player-list');
  if (projection.objectives.length === 0) goalList.append(emptyState('No objectives yet', 'PAYAW supports investigation without turning the campaign into a quest tracker.'));
  for (const objective of projection.objectives.slice(0, 6)) {
    const row = create('div', 'player-list-item');
    const copy = create('div');
    appendText(copy, 'strong', objective.wording);
    if (objective.completionNote.length > 0) appendText(copy, 'p', objective.completionNote);
    row.append(copy, create('span', 'player-card-badge', objective.status));
    goalList.append(row);
  }
  goals.append(goalList);
  grid.append(recent, goals);
  fragment.append(grid);
  return fragment as unknown as HTMLElement;
}

function renderScene(projection: PlayerProjection): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('scene', projection.activeScene === undefined ? 'Waiting for the GM' : projection.activeScene.locationLabel));
  wrapper.append(renderSceneHero(projection));
  const scene = projection.activeScene;
  if (scene === undefined) return wrapper;
  const grid = create('section', 'player-grid');
  const people = card('People present', 'Only people you can perceive or have been told about.', 'player-span-6');
  const peopleList = create('div', 'player-list');
  if (scene.presentNpcs.length === 0) peopleList.append(emptyState('No one is listed', 'The scene may be empty, private, or not fully revealed.'));
  for (const npc of scene.presentNpcs) {
    const row = create('div', 'player-list-item player-person-card');
    const avatar = create('div', 'player-avatar', initials(npc.name));
    const copy = create('div');
    appendText(copy, 'strong', npc.name);
    appendText(copy, 'p', npc.description);
    row.append(avatar, copy);
    peopleList.append(row);
  }
  people.append(peopleList);
  const exits = card('Visible exits and choices', 'References only; PAYAW never forces an outcome.', 'player-span-6');
  const exitList = create('div', 'player-list');
  if (scene.exits.length === 0) exitList.append(emptyState('No exits listed', 'Use theatre of the mind or ask the GM what is visible.'));
  for (const exit of scene.exits) {
    const row = create('div', 'player-list-item');
    appendText(row, 'strong', exit.label);
    if (exit.targetSceneId !== null) row.append(create('span', 'player-card-badge', 'known'));
    exitList.append(row);
  }
  exits.append(exitList);
  grid.append(people, exits);
  wrapper.append(grid);
  return wrapper;
}

const generatedPlayerWorlds = new Map<string, Promise<World>>();
const playerMapViewports = new WeakMap<HTMLCanvasElement, { readonly camera: Camera; readonly worldWidth: number; readonly worldHeight: number }>();

function playerWorldRecipeKey(recipe: PlayerWorldGenerationRecipe): string {
  return JSON.stringify([recipe.generationVersion, recipe.seed, recipe.options]);
}

function generatePlayerWorld(recipe: PlayerWorldGenerationRecipe): Promise<World> {
  const key = playerWorldRecipeKey(recipe);
  const cached = generatedPlayerWorlds.get(key);
  if (cached !== undefined) return cached;
  const worker = new GenerationWorkerClient(new GenerationPipeline());
  const generated = worker.generate(
    recipe.seed,
    hydratePlayerWorldGenerationOptions(recipe),
    { stopAfterStageId: 'vegetation' },
  ).catch((error: unknown) => {
    generatedPlayerWorlds.delete(key);
    throw error;
  });
  generatedPlayerWorlds.set(key, generated);
  if (generatedPlayerWorlds.size > 4) {
    const oldest = generatedPlayerWorlds.keys().next().value as string | undefined;
    if (oldest !== undefined && oldest !== key) generatedPlayerWorlds.delete(oldest);
  }
  return generated;
}

interface PlayerCanvasFrame {
  readonly context: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly density: number;
}

function preparePlayerCanvas(canvas: HTMLCanvasElement): PlayerCanvasFrame | null {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * density));
  canvas.height = Math.max(1, Math.round(rect.height * density));
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.setTransform(density, 0, 0, density, 0, 0);
  return { context, width: rect.width, height: rect.height, density };
}

function drawProjectedMapFeatures(
  frame: PlayerCanvasFrame,
  projection: PlayerProjection,
  worldWidth: number,
  worldHeight: number,
  camera?: Camera,
): void {
  const { context, width, height, density } = frame;
  context.setTransform(density, 0, 0, density, 0, 0);
  const mapPoint = (x: number, y: number): readonly [number, number] => {
    if (camera !== undefined) {
      const point = camera.worldToScreen(x, y);
      return [point.x, point.y];
    }
    return [x / worldWidth * width, y / worldHeight * height];
  };
  for (const feature of projection.map.features) {
    if (feature.position === null) continue;
    const [x, y] = mapPoint(feature.position.x, feature.position.y);
    if (feature.approximateRadius !== null) {
      context.beginPath();
      context.fillStyle = 'rgb(231 181 108 / 17%)';
      context.strokeStyle = 'rgb(231 181 108 / 70%)';
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      const radius = camera === undefined
        ? feature.approximateRadius / worldWidth * width
        : feature.approximateRadius * camera.zoom;
      context.arc(x, y, Math.max(12, radius), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.setLineDash([]);
    }
    context.beginPath();
    context.fillStyle = feature.color ?? (feature.kind === 'scene' ? '#e7b56c' : feature.kind === 'community' ? '#9bd7c6' : feature.kind === 'ping' ? '#e48781' : '#dce8df');
    context.strokeStyle = '#0b110e';
    context.lineWidth = 2;
    if (feature.kind === 'location') {
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillRect(-4, -4, 8, 8);
      context.strokeRect(-4, -4, 8, 8);
      context.restore();
    } else {
      context.arc(x, y, feature.kind === 'scene' ? 7 : feature.kind === 'community' ? 5 : 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    if (feature.knowledge !== 'rumored') {
      context.font = '600 11px Tahoma, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.lineWidth = 3;
      context.strokeStyle = 'rgb(6 10 8 / 85%)';
      context.fillStyle = '#eef4ef';
      context.strokeText(feature.label, x, y - 7);
      context.fillText(feature.label, x, y - 7);
    }
  }
}

function clearPlayerMapCanvas(canvas: HTMLCanvasElement): void {
  playerMapViewports.delete(canvas);
  const frame = preparePlayerCanvas(canvas);
  if (frame === null) return;
  const { context, width, height } = frame;
  context.fillStyle = '#0a0e0c';
  context.fillRect(0, 0, width, height);
}

async function drawMap(canvas: HTMLCanvasElement, projection: PlayerProjection, status?: HTMLElement): Promise<void> {
  const recipe = projection.map.worldRecipe;
  if (recipe === null) {
    clearPlayerMapCanvas(canvas);
    if (status !== undefined) status.textContent = 'This hosted projection is outdated. Ask the GM to sync player views again.';
    return;
  }
  clearPlayerMapCanvas(canvas);
  const key = playerWorldRecipeKey(recipe);
  canvas.dataset.playerWorldRecipe = key;
  if (status !== undefined) status.textContent = `Generating ${recipe.seed} locally from the shared world seed…`;
  try {
    const world = await generatePlayerWorld(recipe);
    if (!canvas.isConnected || canvas.dataset.playerWorldRecipe !== key) return;
    const frame = preparePlayerCanvas(canvas);
    if (frame === null) return;
    frame.context.setTransform(1, 0, 0, 1, 0, 0);
    frame.context.clearRect(0, 0, canvas.width, canvas.height);
    const renderer = new CanvasRenderer(canvas);
    renderer.setCustomization(EMPTY_RENDER_CUSTOMIZATION);
    for (const layer of [
      RenderLayer.Story,
      RenderLayer.NPCs,
      RenderLayer.HiddenPayaw,
      RenderLayer.SupernaturalActivity,
      RenderLayer.Travel,
      RenderLayer.CustomImages,
      RenderLayer.Authoring,
      RenderLayer.LiveInfrastructure,
      RenderLayer.VenueStatus,
      RenderLayer.SettlementActivity,
    ]) renderer.layers.setVisible(layer, false);
    const camera = new Camera();
    camera.fit(world.width, world.height, frame.width, frame.height);
    renderer.render(world, camera, { width: frame.width, height: frame.height, pixelRatio: frame.density });
    playerMapViewports.set(canvas, { camera, worldWidth: world.width, worldHeight: world.height });
    drawProjectedMapFeatures(frame, projection, world.width, world.height, camera);
    if (status !== undefined) status.textContent = `Generated locally from seed “${recipe.seed}”. Click a revealed marker to inspect it.`;
  } catch (error) {
    if (status !== undefined) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Local map generation failed. ${message}`;
      clearPlayerMapCanvas(canvas);
    }
  }
}

function renderMap(projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('map', `${projection.knownLocations.length} known places · ${projection.map.roads.length} roads · ${projection.map.buildings.length} buildings`));
  const mapCard = create('section', 'player-card player-map-card');
  const toolbar = create('div', 'player-map-toolbar');
  const copy = create('div');
  appendText(copy, 'strong', 'Campaign town map');
  appendText(copy, 'small', 'The player browser regenerates this map from the shared seed and public overrides. Story locations appear only after a GM reveal.');
  const controls = create('div', 'player-map-toolbar-controls');
  const pingLabel = create('input');
  pingLabel.placeholder = 'Ping label';
  pingLabel.setAttribute('aria-label', 'Map ping label');
  const pingMode = create('button', 'player-secondary', 'Place ping');
  pingMode.type = 'button';
  pingMode.disabled = !projection.capabilities.includes('map.ping');
  controls.append(pingLabel, pingMode);
  toolbar.append(copy, controls);
  const stage = create('div', 'player-map-stage');
  const canvas = create('canvas');
  canvas.id = 'player-map-canvas';
  canvas.setAttribute('aria-label', 'Revealed campaign map');
  const status = create('div', 'player-map-status', 'Click a revealed marker to inspect it.');
  stage.append(canvas, status);
  const legend = create('div', 'player-map-legend');
  for (const [label, color] of [['Buildings', '#cbc6b5'], ['Current scene', '#e7b56c'], ['Community', '#9bd7c6'], ['Known place', '#dce8df'], ['Your ping', '#e48781']] as const) {
    const item = create('span', '', label);
    item.style.setProperty('--legend', color);
    legend.append(item);
  }
  mapCard.append(toolbar, stage, legend);
  wrapper.append(mapCard);
  let placingPing = false;
  pingMode.addEventListener('click', () => {
    placingPing = !placingPing;
    pingMode.classList.toggle('player-primary', placingPing);
    status.textContent = placingPing ? 'Click the map to place a temporary ping.' : 'Ping placement cancelled.';
  });
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const base = projection.map.base;
    if (base === null) return;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const viewport = playerMapViewports.get(canvas);
    const worldPoint = viewport === undefined
      ? { x: localX / rect.width * base.worldWidth, y: localY / rect.height * base.worldHeight }
      : viewport.camera.screenToWorld(localX, localY);
    const x = Math.max(0, Math.min(base.worldWidth, worldPoint.x));
    const y = Math.max(0, Math.min(base.worldHeight, worldPoint.y));
    if (placingPing) {
      onCommand({ kind: 'map.ping', x, y, label: pingLabel.value });
      placingPing = false;
      return;
    }
    const nearest = projection.map.features.filter((feature) => feature.position !== null).map((feature) => ({ feature, distance: Math.hypot((feature.position?.x ?? 0) - x, (feature.position?.y ?? 0) - y) })).sort((left, right) => left.distance - right.distance)[0];
    status.textContent = nearest !== undefined && nearest.distance < Math.max(7, base.worldWidth / 22)
      ? `${nearest.feature.label} · ${titleCase(nearest.feature.knowledge)} · ${nearest.feature.detail}`
      : `Map position ${Math.round(x)}, ${Math.round(y)}`;
  });
  requestAnimationFrame(() => { void drawMap(canvas, projection, status); });
  const observer = new ResizeObserver(() => { void drawMap(canvas, projection, status); });
  observer.observe(stage);
  const places = card('Map locations', 'Ordinary communities are public; rumors and story locations appear only after the GM reveals them.');
  const list = create('div', 'player-list');
  if (projection.map.features.length === 0) list.append(emptyState('No named locations on the map', 'The town geometry is still visible. Story locations appear when the GM reveals them.'));
  for (const feature of projection.map.features) {
    const row = create('div', 'player-list-item');
    const rowCopy = create('div');
    appendText(rowCopy, 'strong', feature.label);
    appendText(rowCopy, 'p', feature.detail || titleCase(feature.kind));
    row.append(rowCopy, knowledgeBadge(feature.knowledge));
    list.append(row);
  }
  places.append(list);
  wrapper.append(places);
  return wrapper;
}

function renderPeople(projection: PlayerProjection): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('people', `${projection.knownNpcs.length} visible records`));
  const grid = create('section', 'player-grid');
  if (projection.knownNpcs.length === 0) grid.append(emptyState('No known people', 'NPC schedules and hidden locations are never exposed. People appear only when the GM reveals them or they are visibly present.'));
  for (const npc of projection.knownNpcs) {
    const item = card(npc.name, npc.lastKnownContext, 'player-span-6');
    const header = item.querySelector('.player-card-head');
    header?.append(knowledgeBadge(npc.knowledge));
    const content = create('div', 'player-person-card');
    const avatar = create('div', 'player-avatar', initials(npc.name));
    if (npc.portraitUri !== null) {
      const image = create('img');
      image.src = npc.portraitUri;
      image.alt = `${npc.name} portrait`;
      avatar.replaceChildren(image);
    }
    const copy = create('div');
    appendText(copy, 'p', npc.description);
    const tags = create('div', 'player-tag-row');
    if (npc.occupation !== null) tags.append(create('span', 'player-tag', npc.occupation));
    if (npc.relationship !== null) tags.append(create('span', 'player-tag', npc.relationship));
    for (const fact of npc.facts) tags.append(create('span', 'player-tag', fact));
    copy.append(tags);
    content.append(avatar, copy);
    item.append(content);
    grid.append(item);
  }
  wrapper.append(grid);
  return wrapper;
}

function renderPlaces(projection: PlayerProjection): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('places', `${projection.knownLocations.length} visible records`));
  const grid = create('section', 'player-grid');
  if (projection.knownLocations.length === 0) grid.append(emptyState('No known places', 'A rumored place can exist without exposing its exact map position.'));
  for (const location of projection.knownLocations) {
    const item = card(location.name, titleCase(location.type), 'player-span-6');
    item.querySelector('.player-card-head')?.append(knowledgeBadge(location.knowledge));
    appendText(item, 'p', location.description || (location.knowledge === 'rumored' ? 'You have only heard a rumor about this place.' : 'No public description has been revealed.'));
    const tags = create('div', 'player-tag-row');
    if (location.status !== null) tags.append(create('span', 'player-tag', titleCase(location.status)));
    for (const detail of location.discoveredDetails) tags.append(create('span', 'player-tag', detail));
    item.append(tags);
    grid.append(item);
  }
  wrapper.append(grid);
  return wrapper;
}

function renderClues(projection: PlayerProjection): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('clues', `${projection.clues.length} discovered records`));
  const list = card('Evidence and discoveries', 'Clues support investigation; PAYAW does not solve the mystery.');
  const body = create('div', 'player-list');
  if (projection.clues.length === 0) body.append(emptyState('No clues revealed', 'Revealed clues will preserve their player title, source, and public description.'));
  for (const clue of projection.clues) {
    const row = create('article', 'player-list-item');
    const copy = create('div');
    appendText(copy, 'strong', clue.title);
    appendText(copy, 'p', clue.description);
    if (clue.source.length > 0) appendText(copy, 'small', `Source: ${clue.source}`);
    row.append(copy, knowledgeBadge(clue.knowledge));
    body.append(row);
  }
  list.append(body);
  wrapper.append(list);
  return wrapper;
}

function renderHandouts(projection: PlayerProjection): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('handouts', `${projection.handouts.length} revealed assets`));
  const grid = create('section', 'player-handout-grid');
  if (projection.handouts.length === 0) grid.append(emptyState('No handouts available', 'Unrevealed asset identifiers and URLs are not present in this application.'));
  for (const handout of projection.handouts) grid.append(renderHandout(handout));
  wrapper.append(grid);
  return wrapper;
}

function renderHandout(handout: AssetProjection): HTMLElement {
  const item = create('article', 'player-card player-handout');
  const media = create('div', 'player-handout-media');
  if (handout.type === 'image' && handout.safeUri !== null) {
    const image = create('img');
    image.src = handout.safeUri;
    image.alt = handout.alternateText || handout.caption || handout.title;
    media.append(image);
  } else {
    appendText(media, 'strong', titleCase(handout.type));
  }
  const copy = create('div', 'player-handout-copy');
  appendText(copy, 'h3', handout.title);
  appendText(copy, 'p', handout.caption || handout.alternateText || 'No caption supplied.');
  if (handout.safeUri !== null && handout.type !== 'image') {
    const link = create('a', 'player-card-badge', 'Open revealed asset');
    link.href = handout.safeUri;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    copy.append(link);
  }
  item.append(media, copy);
  return item;
}

function renderJournalEntry(entry: JournalEntryProjection, onCommand: (command: PlayerCommand) => void, canShare: boolean): HTMLElement {
  const row = create('article', 'player-list-item');
  const copy = create('div');
  appendText(copy, 'strong', entry.title);
  appendText(copy, 'p', entry.body);
  appendText(copy, 'small', `${entry.ownerLabel} · ${formatDate(entry.updatedAt)}`);
  const actions = create('div', 'player-list-item-actions');
  actions.append(create('span', 'player-card-badge', entry.sharedWithParty ? 'shared' : 'private'));
  if (canShare) {
    const button = create('button', '', entry.sharedWithParty ? 'Make private' : 'Share');
    button.type = 'button';
    button.addEventListener('click', () => onCommand({ kind: 'journal.share', entryId: entry.id, sharedWithParty: !entry.sharedWithParty }));
    actions.append(button);
  }
  row.append(copy, actions);
  return row;
}

function renderJournal(projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('journal', `${projection.journal.personal.length} personal · ${projection.journal.shared.length} shared`));
  const grid = create('section', 'player-grid');
  const composer = card('New journal entry', 'Write privately or share deliberately with the party.', 'player-span-5');
  if (!projection.capabilities.includes('journal.write.private')) composer.append(emptyState('Writing disabled', 'The GM has not enabled journal writing for this player.'));
  else {
    const form = create('form', 'player-form');
    const title = create('input'); title.placeholder = 'Entry title'; title.maxLength = 160;
    const body = create('textarea'); body.placeholder = 'What did your character notice?'; body.rows = 7;
    const shareField = create('label', 'player-field');
    const share = create('input'); share.type = 'checkbox'; share.disabled = !projection.capabilities.includes('journal.share.party');
    shareField.append(share, create('span', '', 'Share with party'));
    const save = create('button', 'player-primary', 'Save entry'); save.type = 'submit';
    form.append(title, body, shareField, save);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      onCommand({ kind: 'journal.create', title: title.value, body: body.value, sharedWithParty: share.checked });
    });
    composer.append(form);
  }
  const entries = card('Your notes', 'Private notes never appear in another player projection.', 'player-span-7');
  const list = create('div', 'player-list');
  if (projection.journal.personal.length === 0) list.append(emptyState('Your journal is empty', 'Create a note about a clue, suspicion, person, or place.'));
  for (const entry of projection.journal.personal) list.append(renderJournalEntry(entry, onCommand, projection.capabilities.includes('journal.share.party')));
  entries.append(list);
  grid.append(composer, entries);
  const shared = card('Party journal', 'Only entries explicitly shared by a player appear here.', 'player-span-12');
  const sharedList = create('div', 'player-list');
  if (projection.journal.shared.length === 0) sharedList.append(emptyState('No shared notes', 'Private notes stay private.'));
  for (const entry of projection.journal.shared) sharedList.append(renderJournalEntry(entry, onCommand, false));
  shared.append(sharedList);
  grid.append(shared);
  wrapper.append(grid);
  return wrapper;
}

function renderMessages(projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('messages', `${projection.messages.length} visible threads`));
  const grid = create('section', 'player-grid');
  if (projection.messages.length === 0) grid.append(emptyState('No messages delivered', 'Drafts, queued messages, and messages for other players are absent from this projection.'));
  for (const thread of projection.messages) grid.append(renderThread(thread, projection, onCommand));
  wrapper.append(grid);
  return wrapper;
}

function renderThread(thread: MessageThreadProjection, projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const item = card(thread.name, thread.medium, 'player-span-12');
  const history = create('div', 'player-thread');
  for (const message of thread.messages) {
    const bubble = create('article', 'player-message');
    bubble.dataset.self = String(message.senderLabel === projection.viewer.characterName);
    bubble.dataset.glitch = String(message.presentation.glitch);
    appendText(bubble, 'strong', message.senderLabel);
    appendText(bubble, 'p', message.body);
    appendText(bubble, 'small', formatDate(message.sentAt, projection.campaign.timezone));
    history.append(bubble);
  }
  item.append(history);
  if (thread.canReply) {
    const form = create('form', 'player-form');
    const body = create('textarea'); body.rows = 2; body.placeholder = 'Write an in-world reply…';
    const controls = create('div', 'player-form-grid');
    const audience = create('select');
    const party = create('option'); party.value = 'party'; party.textContent = 'Party thread';
    const gm = create('option'); gm.value = 'gm'; gm.textContent = 'Private to GM';
    audience.append(party, gm);
    const send = create('button', 'player-primary', 'Send'); send.type = 'submit';
    controls.append(audience, send);
    form.append(body, controls);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      onCommand({ kind: 'message.send', threadId: thread.id, body: body.value, privateToGm: audience.value === 'gm' });
    });
    item.append(form);
  }
  return item;
}

function renderCharacter(projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('character', projection.character?.name ?? 'No owned character'));
  const character = projection.character;
  if (character === undefined) {
    wrapper.append(emptyState('No character assigned', 'The GM can assign a character to this player identity before opening Player View.'));
    return wrapper;
  }
  const grid = create('section', 'player-grid');
  const identity = card(character.name, character.pronouns, 'player-span-5');
  const avatar = create('div', 'player-avatar', initials(character.name));
  avatar.style.width = '76px'; avatar.style.height = '76px'; avatar.style.fontSize = '26px';
  if (character.portraitUri !== null) {
    const image = create('img'); image.src = character.portraitUri; image.alt = `${character.name} portrait`; avatar.replaceChildren(image);
  }
  identity.append(avatar);
  if (character.background.length > 0) appendText(identity, 'p', character.background);
  const tags = create('div', 'player-tag-row');
  for (const condition of character.conditions) tags.append(create('span', 'player-tag', condition));
  identity.append(tags);
  const stats = card('Stats and inventory', 'Campaign-approved character information.', 'player-span-7');
  const statGrid = create('div', 'player-stat-grid');
  for (const [name, value] of Object.entries(character.stats)) {
    const item = create('div', 'player-stat'); appendText(item, 'small', name); appendText(item, 'strong', value); statGrid.append(item);
  }
  if (Object.keys(character.stats).length > 0) stats.append(statGrid);
  const inventory = create('div', 'player-list');
  if (character.inventory.length === 0) inventory.append(emptyState('Inventory is empty', 'Use the editor below if the GM allows inventory changes.'));
  for (const item of character.inventory) inventory.append(create('div', 'player-list-item', item));
  stats.append(inventory);
  grid.append(identity, stats);
  const editor = card('Character notes and approved edits', 'Only fields listed in this projection can be changed.', 'player-span-12');
  if (!projection.capabilities.includes('character.edit.self')) editor.append(emptyState('Character editing disabled', 'This character is currently read-only.'));
  else {
    const form = create('form', 'player-form-grid');
    const fields = new Map<CharacterProjectionField, HTMLInputElement | HTMLTextAreaElement>();
    const addField = (name: CharacterProjectionField, label: string, value: string, rows = 0): void => {
      if (!character.editableFields.includes(name)) return;
      const field = create('label', `player-field ${rows > 0 ? 'player-field-wide' : ''}`);
      appendText(field, 'span', label);
      const input = rows > 0 ? create('textarea') : create('input');
      input.value = value;
      if (input instanceof HTMLTextAreaElement) input.rows = rows;
      field.append(input);
      fields.set(name, input);
      form.append(field);
    };
    addField('name', 'Name', character.name);
    addField('pronouns', 'Pronouns', character.pronouns);
    addField('background', 'Background', character.background, 4);
    addField('conditions', 'Conditions (one per line)', character.conditions.join('\n'), 4);
    addField('inventory', 'Inventory (one per line)', character.inventory.join('\n'), 6);
    addField('privateNotes', 'Private notes', character.privateNotes, 7);
    const save = create('button', 'player-primary player-field-wide', 'Save approved fields'); save.type = 'submit';
    form.append(save);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      for (const [field, input] of fields) {
        const value = field === 'conditions' || field === 'inventory' ? input.value.split('\n') : input.value;
        onCommand({ kind: 'character.update', field, value });
      }
    });
    editor.append(form);
  }
  grid.append(editor);
  wrapper.append(grid);
  return wrapper;
}

type CharacterProjectionField = 'name' | 'pronouns' | 'background' | 'conditions' | 'inventory' | 'privateNotes';

function renderObjectives(projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const wrapper = create('div');
  wrapper.append(panelHeader('objectives', `${projection.objectives.length} visible goals`));
  const grid = create('section', 'player-grid');
  const list = card('Campaign objectives', 'Completion is authored or confirmed; PAYAW does not infer success.', 'player-span-7');
  const body = create('div', 'player-list');
  if (projection.objectives.length === 0) body.append(emptyState('No active objectives', 'You can still investigate freely without a quest list.'));
  for (const objective of projection.objectives) {
    const row = create('div', 'player-list-item');
    const copy = create('div'); appendText(copy, 'strong', objective.wording); if (objective.completionNote.length > 0) appendText(copy, 'p', objective.completionNote);
    row.append(copy, create('span', 'player-card-badge', objective.status)); body.append(row);
  }
  list.append(body);
  const propose = card('Propose a goal', 'A player-created proposal is not automatically canon.', 'player-span-5');
  if (!projection.capabilities.includes('objective.propose')) propose.append(emptyState('Proposals disabled', 'The GM has not enabled player objective proposals.'));
  else {
    const form = create('form', 'player-form');
    const wording = create('textarea'); wording.rows = 5; wording.placeholder = 'What should the party try next?';
    const submit = create('button', 'player-primary', 'Propose objective'); submit.type = 'submit';
    form.append(wording, submit);
    form.addEventListener('submit', (event) => { event.preventDefault(); onCommand({ kind: 'objective.propose', wording: wording.value }); });
    propose.append(form);
  }
  grid.append(list, propose);
  wrapper.append(grid);
  return wrapper;
}

function renderPanel(panel: PlayerPanel, projection: PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  switch (panel) {
    case 'map': return renderMap(projection, onCommand);
    case 'scene': return renderScene(projection);
    case 'journal': return renderJournal(projection, onCommand);
    case 'messages': return renderMessages(projection, onCommand);
    case 'character': return renderCharacter(projection, onCommand);
    case 'people': return renderPeople(projection);
    case 'places': return renderPlaces(projection);
    case 'clues': return renderClues(projection);
    case 'handouts': return renderHandouts(projection);
    case 'objectives': return renderObjectives(projection, onCommand);
    default: return renderHome(projection);
  }
}

function createTravelDialog(getProjection: () => PlayerProjection): HTMLElement {
  const backdrop = create('div', 'player-utility-dialog');
  backdrop.id = 'player-travel-dialog';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Travel calculator');
  const panel = create('section', 'player-utility-panel');
  const header = create('div', 'player-utility-panel-head');
  appendText(header, 'h2', 'Travel calculator');
  const close = create('button', '', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close travel calculator');
  header.append(close);
  const form = create('form', 'player-form-grid');
  const from = create('select'); const to = create('select'); const mode = create('select');
  for (const [value, label] of [['walk', 'Walk'], ['drive', 'Drive'], ['public', 'Public transport']] as const) { const option = create('option'); option.value = value; option.textContent = label; mode.append(option); }
  const result = create('div', 'player-dice-result');
  appendText(result, 'strong', '—'); appendText(result, 'small', 'Choose two known places.');
  const calculate = create('button', 'player-primary player-field-wide', 'Estimate travel'); calculate.type = 'submit';
  const field = (label: string, input: HTMLElement): HTMLElement => { const item = create('label', 'player-field'); appendText(item, 'span', label); item.append(input); return item; };
  form.append(field('From', from), field('To', to), field('Mode', mode), calculate);
  const refresh = (): void => {
    const projection = getProjection();
    const locations = projection.knownLocations.filter((location) => location.position !== null);
    for (const select of [from, to]) {
      const selected = select.value;
      select.replaceChildren();
      for (const location of locations) { const option = create('option'); option.value = location.id; option.textContent = location.name; select.append(option); }
      if (locations.some((location) => location.id === selected)) select.value = selected;
    }
    if (to.options.length > 1) to.selectedIndex = 1;
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const projection = getProjection();
    const a = projection.knownLocations.find((location) => location.id === from.value)?.position;
    const b = projection.knownLocations.find((location) => location.id === to.value)?.position;
    if (a === null || a === undefined || b === null || b === undefined) { result.replaceChildren(create('strong', '', 'Unavailable'), create('small', '', 'Both locations need approved positions.')); return; }
    const directKm = Math.hypot(b.x - a.x, b.y - a.y) * projection.map.tileSizeMeters / 1000;
    const routeKm = directKm * (mode.value === 'walk' ? 1.18 : 1.32);
    const speed = mode.value === 'walk' ? 4.5 : mode.value === 'drive' ? 32 : 21;
    const minutes = routeKm / speed * 60 + (mode.value === 'public' ? 8 : 0);
    result.replaceChildren(create('strong', '', `${Math.max(1, Math.round(minutes))} min`), create('small', '', `${routeKm.toFixed(1)} km · player-safe estimate using revealed positions only`));
  });
  close.addEventListener('click', () => { backdrop.dataset.open = 'false'; });
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.dataset.open = 'false'; });
  panel.append(header, form, result);
  backdrop.append(panel);
  (backdrop as HTMLElement & { refresh?: () => void }).refresh = refresh;
  return backdrop;
}

function createDiceDialog(getProjection: () => PlayerProjection, onCommand: (command: PlayerCommand) => void): HTMLElement {
  const backdrop = create('div', 'player-utility-dialog');
  backdrop.id = 'player-dice-dialog';
  backdrop.setAttribute('role', 'dialog'); backdrop.setAttribute('aria-modal', 'true'); backdrop.setAttribute('aria-label', 'Dice tray');
  const panel = create('section', 'player-utility-panel');
  const header = create('div', 'player-utility-panel-head'); appendText(header, 'h2', 'Dice tray');
  const close = create('button', '', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close dice tray'); header.append(close);
  const form = create('form', 'player-form-grid');
  const notation = create('input'); notation.value = '1d20'; notation.placeholder = '2d6+1';
  const visibility = create('select');
  for (const [value, label] of [['private', 'Private'], ['party', 'Party'], ['gm', 'GM-visible']] as const) { const option = create('option'); option.value = value; option.textContent = label; visibility.append(option); }
  const roll = create('button', 'player-primary player-field-wide', 'Roll dice'); roll.type = 'submit';
  const labeled = (label: string, input: HTMLElement): HTMLElement => { const field = create('label', 'player-field'); appendText(field, 'span', label); field.append(input); return field; };
  form.append(labeled('Notation', notation), labeled('Visibility', visibility), roll);
  const result = create('div', 'player-dice-result'); result.replaceChildren(create('strong', '', '—'), create('small', '', 'Roll history stays in this safe local projection.'));
  const history = create('div', 'player-list');
  const refresh = (): void => {
    const projection = getProjection();
    history.replaceChildren();
    for (const item of projection.diceRolls.slice(0, 12)) {
      const row = create('div', 'player-list-item');
      const copy = create('div'); appendText(copy, 'strong', `${item.notation} = ${item.total}`); appendText(copy, 'p', `[${item.values.join(', ')}]${item.modifier === 0 ? '' : ` ${item.modifier > 0 ? '+' : ''}${item.modifier}`}`);
      row.append(copy, create('span', 'player-card-badge', item.visibility)); history.append(row);
    }
    const latest = projection.diceRolls[0];
    if (latest !== undefined) result.replaceChildren(create('strong', '', String(latest.total)), create('small', '', `${latest.notation} · ${latest.values.join(' + ')}${latest.modifier === 0 ? '' : ` ${latest.modifier > 0 ? '+' : ''} ${latest.modifier}`}`));
  };
  form.addEventListener('submit', (event) => { event.preventDefault(); onCommand({ kind: 'dice.roll', notation: notation.value, visibility: visibility.value as 'private' | 'party' | 'gm' }); });
  close.addEventListener('click', () => { backdrop.dataset.open = 'false'; });
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.dataset.open = 'false'; });
  panel.append(header, form, result, history); backdrop.append(panel);
  (backdrop as HTMLElement & { refresh?: () => void }).refresh = refresh;
  return backdrop;
}


function createAccountDialog(
  username: string,
  onChangeCredentials: (update: PlayerCredentialUpdate) => Promise<void>,
): HTMLElement {
  const backdrop = create('div', 'player-utility-dialog player-account-dialog');
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Player account settings');

  const panel = create('section', 'player-utility-panel player-account-panel');
  const header = create('div', 'player-utility-panel-head');
  const headerCopy = create('div');
  appendText(headerCopy, 'h2', 'Account Settings');
  appendText(headerCopy, 'p', 'Change the username or password used for this campaign.');
  const close = create('button', '', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close account settings');
  header.append(headerCopy, close);

  const form = create('form', 'player-form player-account-form');
  const usernameLabel = create('label', 'player-field player-field-wide');
  usernameLabel.append(create('span', '', 'Username'));
  const usernameInput = create('input');
  usernameInput.required = true;
  usernameInput.minLength = 3;
  usernameInput.maxLength = 24;
  usernameInput.autocomplete = 'username';
  usernameInput.autocapitalize = 'characters';
  usernameInput.spellcheck = false;
  usernameInput.value = username;
  usernameLabel.append(usernameInput);

  const currentPasswordLabel = create('label', 'player-field player-field-wide');
  currentPasswordLabel.append(create('span', '', 'Current password'));
  const currentPassword = create('input');
  currentPassword.type = 'password';
  currentPassword.required = true;
  currentPassword.minLength = 8;
  currentPassword.maxLength = 128;
  currentPassword.autocomplete = 'current-password';
  currentPasswordLabel.append(currentPassword);

  const newPasswordLabel = create('label', 'player-field');
  newPasswordLabel.append(create('span', '', 'New password'));
  const newPassword = create('input');
  newPassword.type = 'password';
  newPassword.minLength = 8;
  newPassword.maxLength = 128;
  newPassword.autocomplete = 'new-password';
  newPassword.placeholder = 'Leave blank to keep it';
  newPasswordLabel.append(newPassword);

  const confirmPasswordLabel = create('label', 'player-field');
  confirmPasswordLabel.append(create('span', '', 'Confirm new password'));
  const confirmPassword = create('input');
  confirmPassword.type = 'password';
  confirmPassword.minLength = 8;
  confirmPassword.maxLength = 128;
  confirmPassword.autocomplete = 'new-password';
  confirmPasswordLabel.append(confirmPassword);

  const status = create('p', 'player-account-status', 'You will be signed out after the credentials are changed.');
  const actions = create('div', 'player-account-actions');
  const cancel = create('button', 'player-secondary', 'Cancel');
  cancel.type = 'button';
  const submit = create('button', 'player-primary', 'Save credentials');
  submit.type = 'submit';
  actions.append(cancel, submit);
  form.append(usernameLabel, currentPasswordLabel, newPasswordLabel, confirmPasswordLabel, status, actions);
  panel.append(header, form);
  backdrop.append(panel);

  const closeDialog = (): void => {
    backdrop.dataset.open = 'false';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    status.textContent = 'You will be signed out after the credentials are changed.';
  };

  usernameInput.addEventListener('input', () => {
    usernameInput.value = usernameInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  });
  close.addEventListener('click', closeDialog);
  cancel.addEventListener('click', closeDialog);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeDialog(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const normalizedUsername = usernameInput.value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(normalizedUsername)) {
      status.textContent = 'Username must be 3–24 characters using letters, numbers, underscores, or hyphens.';
      return;
    }
    if (newPassword.value.length > 0 && newPassword.value.length < 8) {
      status.textContent = 'The new password must contain at least 8 characters.';
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      status.textContent = 'The new passwords do not match.';
      return;
    }
    if (normalizedUsername === username && newPassword.value.length === 0) {
      status.textContent = 'Enter a new username or a new password.';
      return;
    }

    submit.disabled = true;
    cancel.disabled = true;
    status.textContent = 'Updating player credentials…';
    try {
      await onChangeCredentials({
        currentPassword: currentPassword.value,
        newUsername: normalizedUsername,
        newPassword: newPassword.value,
      });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      submit.disabled = false;
      cancel.disabled = false;
    }
  });

  return backdrop;
}

export function installPlayerApp(options: PlayerAppOptions = {}): void {
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) throw new Error('Player View requires the #app root.');
  for (const child of [...document.body.children]) if (child !== app) child.remove();
  document.body.classList.add('player-view-body');
  document.title = 'PAYAW Player View';
  let loaded: { readonly projection: PlayerProjection; readonly key: string };
  try {
    loaded = options.session === undefined
      ? readProjection()
      : { projection: options.session.projection(), key: PLAYER_PROJECTION_LATEST_KEY };
  } catch (error) {
    renderFatal(app, error);
    return;
  }
  let projection = loaded.projection;
  let activePanel: PlayerPanel = projection.activeScene === undefined ? 'map' : 'scene';
  app.replaceChildren();

  const shell = create('div', 'player-shell');
  const header = create('header', 'player-header');
  const brand = create('button', 'player-brand'); brand.type = 'button'; brand.setAttribute('aria-label', 'Open campaign overview');
  const mark = create('span', 'player-brand-mark', 'P');
  const brandCopy = create('span', 'player-brand-copy'); appendText(brandCopy, 'strong', projection.campaign.name); appendText(brandCopy, 'span', `${projection.viewer.characterName} · ${projection.viewer.displayName}`);
  brand.append(mark, brandCopy);
  const search = create('label', 'player-search');
  const searchInput = create('input'); searchInput.type = 'search'; searchInput.placeholder = 'Search what your character knows…'; searchInput.autocomplete = 'off'; search.append(searchInput);
  const headerActions = create('div', 'player-header-actions');
  const previewBadge = create('span', 'player-preview-badge', options.session === undefined ? 'Local preview' : 'Player portal');
  const connectionBadge = create('span', 'player-connection-badge', options.session === undefined ? 'Local preview' : 'Connecting…');
  headerActions.append(previewBadge, connectionBadge);
  let accountButton: HTMLButtonElement | null = null;
  if (options.onChangeCredentials !== undefined && options.playerUsername !== undefined) {
    accountButton = create('button', 'player-header-account', 'Account');
    accountButton.type = 'button';
    headerActions.append(accountButton);
  }
  if (options.onSignOut !== undefined) {
    const signOut = create('button', 'player-header-sign-out', 'Sign out');
    signOut.type = 'button';
    signOut.addEventListener('click', () => { void options.onSignOut?.(); });
    headerActions.append(signOut);
  }
  header.append(brand, search, headerActions);

  const layout = create('div', 'player-layout');
  const nav = create('nav', 'player-nav'); nav.setAttribute('aria-label', 'Player modules');
  const navOrder: readonly PlayerPanel[] = ['map', 'scene', 'journal', 'messages', 'character', 'home', 'people', 'places', 'clues', 'handouts', 'objectives'];
  const navButtons = new Map<PlayerPanel, HTMLButtonElement>();
  nav.append(create('div', 'player-nav-section', 'During play'));
  for (const [index, panel] of navOrder.entries()) {
    if (index === 5) nav.append(create('div', 'player-nav-section', 'Campaign records'));
    const button = create('button'); button.type = 'button'; button.dataset.playerPanel = panel;
    button.append(create('span', '', PANEL_INFO[panel].icon), create('span', '', PANEL_INFO[panel].label));
    const count = panel === 'messages' ? projection.messages.reduce((sum, thread) => sum + thread.messages.length, 0)
      : panel === 'people' ? projection.knownNpcs.length
        : panel === 'places' ? projection.knownLocations.length
          : panel === 'clues' ? projection.clues.length
            : panel === 'handouts' ? projection.handouts.length
              : panel === 'objectives' ? projection.objectives.length : 0;
    button.append(create('small', '', count > 0 ? String(count) : ''));
    navButtons.set(panel, button); nav.append(button);
  }
  const utilityButtons = create('div', 'player-utility-buttons');
  const travelButton = create('button', '', 'Travel'); travelButton.type = 'button';
  const diceButton = create('button', '', 'Dice'); diceButton.type = 'button';
  utilityButtons.append(travelButton, diceButton); nav.append(utilityButtons);
  const mobileMoreButton = create('button', 'player-mobile-more'); mobileMoreButton.type = 'button';
  mobileMoreButton.append(create('span', '', '•••'), create('span', '', 'More'), create('small', '', ''));
  nav.append(mobileMoreButton);
  const main = create('main', 'player-main');
  const content = create('div', 'player-content'); main.append(content);
  layout.append(nav, main);
  const footer = create('footer', 'player-footer');
  const footerContext = create('span', '', `PLAYER · ${PANEL_INFO[activePanel].label}`);
  const footerRevision = create('span', '', `Projection v${projection.projectionVersion} · Revision ${projection.revision}`);
  footer.append(footerContext, footerRevision, create('span', '', 'PAYAW 0.24.0'));
  shell.append(header, layout, footer); app.append(shell);
  const searchResults = create('div', 'player-search-results'); searchResults.hidden = true; document.body.append(searchResults);

  const getProjection = (): PlayerProjection => projection;
  const render = (): void => {
    for (const [panel, button] of navButtons) {
      button.classList.toggle('active', panel === activePanel);
      button.setAttribute('aria-current', panel === activePanel ? 'page' : 'false');
    }
    footerContext.textContent = `PLAYER · ${PANEL_INFO[activePanel].label}`;
    footerRevision.textContent = `Projection v${projection.projectionVersion} · Revision ${projection.revision}`;
    content.replaceChildren(renderPanel(activePanel, projection, applyCommand));
    main.scrollTop = 0;
  };
  const applyCommand = async (command: PlayerCommand): Promise<void> => {
    try {
      projection = options.session === undefined
        ? applyPlayerCommand(projection, command)
        : await options.session.submit(command);
      if (options.session === undefined) writeProjection(loaded.key, projection);
      render();
      (diceDialog as HTMLElement & { refresh?: () => void }).refresh?.();
      (travelDialog as HTMLElement & { refresh?: () => void }).refresh?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(message);
    }
  };
  for (const [panel, button] of navButtons) button.addEventListener('click', () => { activePanel = panel; render(); });
  brand.addEventListener('click', () => { activePanel = 'home'; render(); });

  const travelDialog = createTravelDialog(getProjection);
  const diceDialog = createDiceDialog(getProjection, applyCommand);
  const accountDialog = options.onChangeCredentials !== undefined && options.playerUsername !== undefined
    ? createAccountDialog(options.playerUsername, options.onChangeCredentials)
    : null;
  const mobileMenu = create('div', 'player-utility-dialog player-mobile-menu');
  mobileMenu.id = 'player-mobile-menu';
  mobileMenu.setAttribute('role', 'dialog');
  mobileMenu.setAttribute('aria-modal', 'true');
  mobileMenu.setAttribute('aria-label', 'More player modules');
  const mobileMenuPanel = create('section', 'player-utility-panel');
  const mobileMenuHead = create('div', 'player-utility-panel-head');
  appendText(mobileMenuHead, 'h2', 'More');
  const mobileMenuClose = create('button', '', '×'); mobileMenuClose.type = 'button'; mobileMenuClose.setAttribute('aria-label', 'Close more menu');
  mobileMenuHead.append(mobileMenuClose);
  const mobileMenuGrid = create('div', 'player-mobile-menu-grid');
  for (const panel of ['character', 'home', 'people', 'places', 'clues', 'handouts', 'objectives'] as const) {
    const button = create('button'); button.type = 'button';
    button.append(create('span', '', PANEL_INFO[panel].icon), create('strong', '', PANEL_INFO[panel].label));
    button.addEventListener('click', () => { activePanel = panel; mobileMenu.dataset.open = 'false'; render(); });
    mobileMenuGrid.append(button);
  }
  const mobileTravel = create('button'); mobileTravel.type = 'button'; mobileTravel.append(create('span', '', '↝'), create('strong', '', 'Travel'));
  mobileTravel.addEventListener('click', () => { mobileMenu.dataset.open = 'false'; (travelDialog as HTMLElement & { refresh?: () => void }).refresh?.(); travelDialog.dataset.open = 'true'; });
  const mobileDice = create('button'); mobileDice.type = 'button'; mobileDice.append(create('span', '', '◇'), create('strong', '', 'Dice'));
  mobileDice.addEventListener('click', () => { mobileMenu.dataset.open = 'false'; (diceDialog as HTMLElement & { refresh?: () => void }).refresh?.(); diceDialog.dataset.open = 'true'; });
  mobileMenuGrid.append(mobileTravel, mobileDice);
  if (accountDialog !== null) {
    const mobileAccount = create('button');
    mobileAccount.type = 'button';
    mobileAccount.append(create('span', '', '⚙'), create('strong', '', 'Account'));
    mobileAccount.addEventListener('click', () => {
      mobileMenu.dataset.open = 'false';
      accountDialog.dataset.open = 'true';
    });
    mobileMenuGrid.append(mobileAccount);
  }
  mobileMenuPanel.append(mobileMenuHead, mobileMenuGrid); mobileMenu.append(mobileMenuPanel);
  document.body.append(travelDialog, diceDialog, mobileMenu);
  if (accountDialog !== null) document.body.append(accountDialog);
  accountButton?.addEventListener('click', () => {
    if (accountDialog !== null) accountDialog.dataset.open = 'true';
  });
  travelButton.addEventListener('click', () => { (travelDialog as HTMLElement & { refresh?: () => void }).refresh?.(); travelDialog.dataset.open = 'true'; });
  diceButton.addEventListener('click', () => { (diceDialog as HTMLElement & { refresh?: () => void }).refresh?.(); diceDialog.dataset.open = 'true'; });
  mobileMoreButton.addEventListener('click', () => { mobileMenu.dataset.open = 'true'; });
  mobileMenuClose.addEventListener('click', () => { mobileMenu.dataset.open = 'false'; });
  mobileMenu.addEventListener('click', (event) => { if (event.target === mobileMenu) mobileMenu.dataset.open = 'false'; });

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    searchResults.replaceChildren();
    if (query.length === 0) { searchResults.hidden = true; return; }
    const matches = searchItems(projection).filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(query)).slice(0, 20);
    if (matches.length === 0) searchResults.append(emptyState('No known result', 'Search only covers this player projection.'));
    for (const item of matches) {
      const button = create('button', 'player-search-result'); button.type = 'button';
      appendText(button, 'strong', item.title); appendText(button, 'span', `${PANEL_INFO[item.panel].label} · ${item.subtitle.slice(0, 140)}`);
      button.addEventListener('click', () => { activePanel = item.panel; searchInput.value = ''; searchResults.hidden = true; render(); });
      searchResults.append(button);
    }
    searchResults.hidden = false;
  });
  document.addEventListener('click', (event) => { if (!search.contains(event.target as Node) && !searchResults.contains(event.target as Node)) searchResults.hidden = true; });
  window.addEventListener('storage', (event) => {
    if (options.session !== undefined) return;
    if (event.key !== loaded.key || event.newValue === null) return;
    try { projection = parsePlayerProjection(JSON.parse(event.newValue) as unknown); render(); } catch { /* Safe stale projection remains visible until the GM republishes. */ }
  });
  if (options.session !== undefined) {
    const removeProjectionListener = options.session.onProjection((next) => {
      projection = next;
      render();
      (diceDialog as HTMLElement & { refresh?: () => void }).refresh?.();
      (travelDialog as HTMLElement & { refresh?: () => void }).refresh?.();
    });
    const removeConnectionListener = options.session.onConnection((snapshot) => {
      connectionBadge.textContent = snapshot.pendingCommands > 0
        ? `${snapshot.state} · ${snapshot.pendingCommands} queued`
        : snapshot.state;
      connectionBadge.dataset.status = snapshot.state;
      connectionBadge.title = snapshot.detail;
    });
    window.addEventListener('beforeunload', () => {
      removeProjectionListener();
      removeConnectionListener();
      options.session?.stop();
    }, { once: true });
  }
  render();
}
