import { PAYAW_VERSION_LABEL } from '../version';
import { readBrowserSession, updateBrowserSession } from '../session/SessionPersistence';

type Workspace = 'editor' | 'dm';
type PanelKey =
  | 'generate' | 'map' | 'anchors' | 'story' | 'npcs' | 'project'
  | 'dashboard' | 'scenes' | 'timeline' | 'information' | 'messages' | 'assets' | 'notes' | 'players' | 'session';

interface RailItem {
  readonly key: PanelKey;
  readonly label: string;
  readonly icon: string;
  readonly workspace: Workspace;
  readonly description: string;
}

const RAIL_ITEMS: readonly RailItem[] = [
  { key: 'generate', label: 'Generate', icon: '▧', workspace: 'editor', description: 'Seed and rebuild the deterministic world.' },
  { key: 'map', label: 'Map', icon: '⌖', workspace: 'editor', description: 'Display layers, labels, and map diagnostics.' },
  { key: 'anchors', label: 'Anchors', icon: '●', workspace: 'editor', description: 'Point anchors and community settlements.' },
  { key: 'story', label: 'Story', icon: '✦', workspace: 'editor', description: 'Story points, rules, and encounter references.' },
  { key: 'npcs', label: 'NPCs', icon: '☺', workspace: 'editor', description: 'NPCs, homes, schedules, and locations.' },
  { key: 'project', label: 'Project', icon: '▣', workspace: 'editor', description: 'Save, restore, import, and export.' },
  { key: 'dashboard', label: 'Dashboard', icon: '▤', workspace: 'dm', description: 'Campaign status and preparation health.' },
  { key: 'scenes', label: 'Scenes', icon: '◈', workspace: 'dm', description: 'Scene library and live Scene Director.' },
  { key: 'timeline', label: 'Timeline', icon: '◷', workspace: 'dm', description: 'Campaign events and time triggers.' },
  { key: 'information', label: 'Reveals', icon: '✉', workspace: 'dm', description: 'Clues, handouts, and objectives.' },
  { key: 'messages', label: 'Messages', icon: '☏', workspace: 'dm', description: 'In-world messages and queued delivery.' },
  { key: 'assets', label: 'Assets', icon: '▧', workspace: 'dm', description: 'Campaign media and references.' },
  { key: 'notes', label: 'Notes', icon: '✎', workspace: 'dm', description: 'Sessions, checkpoints, search, and notes.' },
  { key: 'players', label: 'Players', icon: '◎', workspace: 'dm', description: 'Knowledge grants and safe View-as-Player previews.' },
  { key: 'session', label: 'Run', icon: '▶', workspace: 'dm', description: 'Focused Scene Director and player-facing controls.' },
];

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Milestone 21 shell could not find ${selector}`);
  return element;
}

function directCards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function detailsWithText(root: ParentNode, needle: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('details, section')).find((element) =>
    element.querySelector('summary, h2, h3')?.textContent?.toLocaleLowerCase().includes(needle.toLocaleLowerCase()),
  );
}

function makeButton(item: RailItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ms21-rail-button';
  button.dataset.ms21Panel = item.key;
  button.dataset.workspace = item.workspace;
  button.title = item.description;
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = item.icon;
  const label = document.createElement('small');
  label.textContent = item.label;
  button.append(icon, label);
  return button;
}

function mergeAnchorTemplateUi(card: HTMLElement, retired: HTMLElement): void {
  const templateCard = document.querySelector<HTMLElement>('.anchor-editor');
  const templateBody = templateCard?.querySelector<HTMLElement>(':scope > .disclosure-body');
  const workspace = card.querySelector<HTMLElement>(':scope > .disclosure-body');
  const form = templateBody?.querySelector<HTMLFormElement>('#anchor-form');
  const list = templateBody?.querySelector<HTMLElement>('#anchor-list');
  if (templateCard === null || templateCard === undefined || templateBody === null || templateBody === undefined
    || workspace === null || form === null || form === undefined || list === null || list === undefined) return;

  const section = document.createElement('details');
  section.className = 'authoring-section ms21-anchor-template-section';
  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.textContent = 'Procedural point rules';
  const count = templateCard.querySelector<HTMLElement>('#anchor-count');
  if (count !== null) {
    count.title = 'Built-in and custom procedural point rules';
    summary.append(title, count);
  } else {
    summary.append(title);
  }

  const body = document.createElement('div');
  body.className = 'authoring-section-body ms21-anchor-template-body';
  const help = templateBody.querySelector<HTMLElement>('.helper-text');
  if (help !== null) {
    help.textContent = 'Create reusable placement rules for plazas, schools, markets, ports, and other generated points of interest.';
    body.append(help);
  }
  body.append(form, list);
  section.append(summary, body);

  const globalActions = workspace.querySelector<HTMLElement>('.authoring-global-actions');
  workspace.insertBefore(section, globalActions);
  retired.append(templateCard);
}

function retireLegacyAuthoringUi(): void {
  const retired = document.createElement('div');
  retired.id = 'ms21-retired-controls';
  retired.hidden = true;
  retired.setAttribute('aria-hidden', 'true');
  document.body.append(retired);

  const card = requireElement<HTMLElement>('#authoring-card');
  const summary = card.querySelector('summary span');
  if (summary !== null) summary.innerHTML = '<small>World workspace</small>Anchors &amp; communities';
  const help = card.querySelector<HTMLElement>('.anchor-authoring-help');
  if (help !== null) help.textContent = 'Communities are settlement-type anchors. Their island and regional context follow their map position automatically.';

  const sections = Array.from(card.querySelectorAll<HTMLElement>(':scope .authoring-section'));
  for (const section of sections.slice(1)) retired.append(section);
  mergeAnchorTemplateUi(card, retired);
  const globalActions = card.querySelector<HTMLElement>('.authoring-global-actions');
  if (globalActions !== null) globalActions.classList.add('ms21-anchor-actions');
  const trailingHelp = Array.from(card.querySelectorAll<HTMLElement>(':scope > .disclosure-body > .helper-text')).at(-1);
  if (trailingHelp !== undefined) retired.append(trailingHelp);

  const toolbar = card.querySelector<HTMLElement>('.authoring-toolbar');
  if (toolbar !== null) {
    for (const button of Array.from(toolbar.querySelectorAll<HTMLButtonElement>('[data-authoring-tool]'))) {
      const tool = button.dataset.authoringTool;
      if (tool !== 'select' && tool !== 'anchor') retired.append(button);
    }
  }

  const anchorGrid = card.querySelector<HTMLElement>('.authoring-section .authoring-form-grid');
  const kindSelect = card.querySelector<HTMLSelectElement>('#authoring-settlement-kind');
  if (anchorGrid !== null && kindSelect !== null) {
    const categoryLabel = document.createElement('label');
    categoryLabel.className = 'form-field ms21-anchor-family-field';
    categoryLabel.innerHTML = '<span>Type category</span><select id="ms21-anchor-family"><option value="community">Community / settlement</option><option value="point">Point anchor</option></select>';
    const kindLabel = kindSelect.closest('label');
    if (kindLabel !== null) anchorGrid.insertBefore(categoryLabel, kindLabel);
    const kindCaption = kindLabel?.querySelector('span');
    if (kindCaption !== null && kindCaption !== undefined) kindCaption.textContent = 'Anchor type';

    const family = categoryLabel.querySelector<HTMLSelectElement>('select');
    const syncFamily = (): void => {
      if (family === null) return;
      family.value = kindSelect.value === 'point' ? 'point' : 'community';
      kindSelect.dataset.family = family.value;
    };
    family?.addEventListener('change', () => {
      if (family.value === 'point') kindSelect.value = 'point';
      else if (kindSelect.value === 'point') kindSelect.value = 'barangay';
      kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
      syncFamily();
    });
    kindSelect.addEventListener('change', syncFamily);
    syncFamily();
  }

  const status = card.querySelector<HTMLElement>('#authoring-status');
  if (status !== null) status.textContent = 'Select an anchor, or choose its type category and place it anywhere on the map.';

  const authoringMenu = Array.from(document.querySelectorAll<HTMLElement>('.category-menu')).find((menu) =>
    menu.querySelector('summary')?.textContent?.trim().toLocaleLowerCase() === 'authoring',
  );
  if (authoringMenu !== undefined) retired.append(authoringMenu);

  const obsoleteCategoryButtons = document.querySelectorAll<HTMLElement>('[data-open-authoring]');
  for (const button of Array.from(obsoleteCategoryButtons)) button.hidden = true;

  // Generated infrastructure remains visible on the map, but legacy subsystem
  // editors are no longer part of the authoring workflow. Settlements and point
  // anchors are the only active map-authoring surface in Milestone 21.
  const legacyMapEditors = [
    document.querySelector<HTMLElement>('.bridge-editor'),
    document.querySelector<HTMLElement>('.maritime-editor'),
    document.querySelector<HTMLElement>('.naming-editor')?.closest<HTMLElement>('details') ?? null,
    document.querySelector<HTMLElement>('.zone-editor'),
    document.querySelector<HTMLElement>('.asset-editor')?.closest<HTMLElement>('details') ?? null,
  ];
  for (const editor of legacyMapEditors) {
    if (editor !== null) retired.append(editor);
  }

  const visualAuthoringHeading = Array.from(document.querySelectorAll<HTMLElement>('.workspace-section-heading')).find((heading) =>
    heading.textContent?.includes('Visual authoring'),
  );
  if (visualAuthoringHeading !== undefined) retired.append(visualAuthoringHeading);
}

function installStoryRestoreControls(): void {
  const storyList = requireElement<HTMLElement>('#world-story-list');
  const parent = storyList.parentElement;
  if (parent === null || document.querySelector('#restore-removed-story-points') !== null) return;
  const strip = document.createElement('div');
  strip.className = 'ms21-story-removal-strip';
  strip.innerHTML = '<span><strong id="removed-story-count">0</strong> removed story points</span><button id="restore-removed-story-points" type="button">Restore removed</button>';
  parent.insertBefore(strip, storyList);
}

function relabelWorkspaceSwitcher(switcher: HTMLElement): void {
  const world = switcher.querySelector<HTMLElement>('[data-workspace="editor"]');
  const campaign = switcher.querySelector<HTMLElement>('[data-workspace="dm"]');
  if (world !== null) world.innerHTML = '<span aria-hidden="true" class="workspace-icon">▧</span><span><strong>WORLD</strong><small>Build and inspect</small></span>';
  if (campaign !== null) campaign.innerHTML = '<span aria-hidden="true" class="workspace-icon">☾</span><span><strong>CAMPAIGN</strong><small>Prepare and run</small></span>';
}

export function installCampaignStudioShell(): void {
  retireLegacyAuthoringUi();
  installStoryRestoreControls();

  const app = requireElement<HTMLElement>('#app');
  const controlPanel = requireElement<HTMLElement>('#control-panel');
  const viewport = requireElement<HTMLElement>('.viewport-shell');
  const dock = requireElement<HTMLElement>('#studio-dock');
  const workspaceSwitcher = requireElement<HTMLElement>('.workspace-switcher');
  const editorWorkspace = requireElement<HTMLElement>('#editor-workspace');
  const dmWorkspace = requireElement<HTMLElement>('#dm-workspace');

  relabelWorkspaceSwitcher(workspaceSwitcher);

  const originalHeader = controlPanel.querySelector<HTMLElement>('.app-header');
  const originalContext = controlPanel.querySelector<HTMLElement>('.workspace-context');
  const retiredControls = requireElement<HTMLElement>('#ms21-retired-controls');
  if (originalHeader !== null) retiredControls.append(originalHeader);
  if (originalContext !== null) retiredControls.append(originalContext);

  document.body.dataset.leftPanel ??= 'open';
  const shellPreferenceVersion = 'payaw.ms21-shell-preferences.v3';
  if (localStorage.getItem(shellPreferenceVersion) !== 'ready') {
    document.body.dataset.studioDock = 'closed';
    localStorage.setItem('payaw.ui-studio-dock.v1', 'closed');
    document.querySelector<HTMLButtonElement>('#toggle-studio-dock-button')?.setAttribute('aria-pressed', 'false');
    localStorage.setItem(shellPreferenceVersion, 'ready');
  } else {
    document.body.dataset.studioDock ??= 'closed';
  }
  const mapBadge = document.querySelector<HTMLElement>('#map-workspace-badge');
  if (mapBadge !== null) mapBadge.textContent = 'WORLD';
  const dockKicker = dock.querySelector<HTMLElement>('.studio-dock-header .section-kicker');
  const dockTitle = dock.querySelector<HTMLElement>('.studio-dock-header h2');
  if (dockKicker !== null) dockKicker.textContent = 'Workspace';
  if (dockTitle !== null) dockTitle.textContent = 'Inspector & Layers';

  const shell = document.createElement('div');
  shell.id = 'ms21-shell';
  shell.className = 'ms21-shell win98-shell';

  const topbar = document.createElement('header');
  topbar.className = 'ms21-topbar';
  topbar.innerHTML = `
    <div class="ms21-titlebar titlebar-blue">
      <div class="ms21-brand"><span class="ms21-app-icon">P</span><div><strong>PAYAW Campaign Studio</strong><small>GM workspace · private player rooms</small></div></div>
      <div class="ms21-window-buttons" aria-hidden="true"><b>_</b><b>□</b><b>×</b></div>
    </div>
    <div class="ms21-menubar" aria-label="Application actions">
      <button type="button" data-ms21-menu="project">Project</button>
      <button type="button" data-ms21-menu="commands">Commands</button>
      <button type="button" data-ms21-menu="view">View</button>
      <button type="button" data-ms21-menu="campaign">Campaign</button>
      <button type="button" data-ms21-menu="help">Help</button>
    </div>
    <div class="ms21-commandbar">
      <div id="ms21-workspace-slot"></div>
      <label class="ms21-global-search"><span>Find</span><input id="ms21-global-search" type="search" placeholder="Search or run a command…" autocomplete="off"></label>
      <div class="ms21-top-actions" id="ms21-top-actions"></div>
    </div>`;

  const body = document.createElement('div');
  body.className = 'ms21-body';
  const rail = document.createElement('nav');
  rail.id = 'ms21-nav-rail';
  rail.className = 'ms21-nav-rail';
  rail.setAttribute('aria-label', 'PAYAW tools');
  for (const item of RAIL_ITEMS) rail.append(makeButton(item));

  const drawer = document.createElement('aside');
  drawer.className = 'ms21-tool-drawer';
  const drawerHeader = document.createElement('header');
  drawerHeader.className = 'ms21-drawer-header titlebar-blue';
  drawerHeader.innerHTML = '<div><strong id="ms21-panel-title">Generate</strong><small id="ms21-panel-description">Seed and rebuild the deterministic world.</small></div><button id="ms21-collapse-drawer" type="button" title="Collapse tools">×</button>';
  drawer.append(drawerHeader, controlPanel);

  const center = document.createElement('main');
  center.className = 'ms21-center';
  center.append(viewport);

  const right = document.createElement('aside');
  right.className = 'ms21-right-dock';
  right.append(dock);

  body.append(rail, drawer, center, right);

  const footer = document.createElement('footer');
  footer.className = 'ms21-footer';
  footer.replaceChildren(
    Object.assign(document.createElement('span'), { textContent: 'Ready' }),
    Object.assign(document.createElement('span'), { id: 'ms21-footer-context', textContent: 'CAMPAIGN · Dashboard' }),
    Object.assign(document.createElement('span'), { textContent: PAYAW_VERSION_LABEL }),
  );

  const helpDialog = document.createElement('dialog');
  helpDialog.className = 'ms21-help-dialog';
  helpDialog.setAttribute('aria-labelledby', 'ms21-help-title');
  helpDialog.innerHTML = `
    <header class="titlebar-blue">
      <strong id="ms21-help-title">PAYAW Quick Help</strong>
      <button type="button" aria-label="Close help">×</button>
    </header>
    <div class="ms21-help-content">
      <p><strong>WORLD</strong> generates and authors the setting. <strong>CAMPAIGN</strong> prepares scenes and runs sessions.</p>
      <dl>
        <dt>Ctrl/Cmd + P</dt><dd>Open commands</dd>
        <dt>Ctrl/Cmd + S</dt><dd>Save project JSON</dd>
        <dt>Ctrl/Cmd + O</dt><dd>Open project JSON</dd>
        <dt>F</dt><dd>Fit the map or focus the selection</dd>
        <dt>[ / ]</dt><dd>Toggle workspace panels</dd>
      </dl>
      <p>Keep a recent project export as your portable backup. Player credentials and hosted-room controls are under CAMPAIGN → Players.</p>
    </div>`;

  const narrowScreen = document.createElement('main');
  narrowScreen.className = 'ms21-narrow-screen';
  narrowScreen.innerHTML = `
    <section>
      <span class="ms21-app-icon" aria-hidden="true">P</span>
      <h1>Open PAYAW Campaign Studio on a wider screen</h1>
      <p>The GM workspace is designed for a desktop or tablet at least 760 pixels wide. The Player Portal remains available on phones.</p>
    </section>`;

  shell.append(topbar, body, footer, helpDialog, narrowScreen);
  app.replaceWith(shell);

  requireElement<HTMLElement>('#ms21-workspace-slot').append(workspaceSwitcher);
  const topActions = requireElement<HTMLElement>('#ms21-top-actions');
  for (const selector of ['#undo-button', '#redo-button', '#command-palette-button', '#toggle-studio-dock-button']) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element !== null) topActions.append(element);
  }
  const save = document.createElement('button');
  save.type = 'button';
  save.id = 'ms21-save-button';
  save.textContent = 'Save';
  save.title = 'Save project JSON (Ctrl+S)';
  save.addEventListener('click', () => document.querySelector<HTMLButtonElement>('#studio-save-button')?.click());
  topActions.prepend(save);

  const storedPanels = readBrowserSession()?.activePanels;
  const panelFor = (workspace: Workspace, fallback: PanelKey): PanelKey => {
    const stored = storedPanels?.[workspace];
    return RAIL_ITEMS.some((item) => item.workspace === workspace && item.key === stored) ? stored as PanelKey : fallback;
  };
  const activePanels: Record<Workspace, PanelKey> = {
    editor: panelFor('editor', 'generate'),
    dm: panelFor('dm', 'dashboard'),
  };

  const editorGroups: Record<string, readonly HTMLElement[]> = {
    generate: [
      editorWorkspace.querySelector<HTMLElement>('.generator-card'),
      editorWorkspace.querySelector<HTMLElement>('.performance-panel'),
    ].filter((value): value is HTMLElement => value !== null),
    map: [
      detailsWithText(editorWorkspace, 'map view'),
      detailsWithText(editorWorkspace, 'label controls'),
      detailsWithText(editorWorkspace, 'world statistics'),
    ].filter((value): value is HTMLElement => value !== undefined),
    anchors: [
      editorWorkspace.querySelector<HTMLElement>('#authoring-card'),
    ].filter((value): value is HTMLElement => value !== null),
    story: [detailsWithText(editorWorkspace, 'story point editor')].filter((value): value is HTMLElement => value !== undefined),
    npcs: [editorWorkspace.querySelector<HTMLElement>('.npc-studio-card')].filter((value): value is HTMLElement => value !== null),
    project: [],
  };

  const campaignPrep = dmWorkspace.querySelector<HTMLElement>('.campaign-prep-card');
  const playerPreviewPanel = dmWorkspace.querySelector<HTMLElement>('#player-preview-panel');
  const campaignSections = Array.from(dmWorkspace.querySelectorAll<HTMLElement>('.campaign-prep-section'));
  const dmSessionCards = directCards(dmWorkspace).filter((item) =>
    item.classList.contains('dm-hero') || item.classList.contains('dm-control-card') || item.classList.contains('dm-sites-card')
      || item.classList.contains('dm-simulation-card') || item.classList.contains('dm-travel-card') || item.classList.contains('dm-maritime-card'),
  );

  const currentWorkspace = (): Workspace => workspaceSwitcher.querySelector<HTMLElement>('[data-workspace="dm"]')?.getAttribute('aria-selected') === 'true' ? 'dm' : 'editor';

  const showProjectDock = (): void => {
    document.querySelector<HTMLButtonElement>('#toggle-studio-dock-button')?.setAttribute('aria-pressed', 'true');
    dock.classList.remove('collapsed');
    document.querySelector<HTMLButtonElement>('#studio-tab-project')?.click();
  };

  const closeHelp = helpDialog.querySelector<HTMLButtonElement>('header button');
  closeHelp?.addEventListener('click', () => helpDialog.close());

  for (const button of Array.from(topbar.querySelectorAll<HTMLButtonElement>('[data-ms21-menu]'))) {
    button.addEventListener('click', () => {
      switch (button.dataset.ms21Menu) {
        case 'project':
          showProjectDock();
          break;
        case 'commands':
          document.querySelector<HTMLButtonElement>('#command-palette-button')?.click();
          break;
        case 'view':
          document.querySelector<HTMLButtonElement>('#toggle-studio-dock-button')?.click();
          break;
        case 'campaign':
          workspaceSwitcher.querySelector<HTMLButtonElement>('[data-workspace="dm"]')?.click();
          setTimeout(() => applyPanel('dm', 'dashboard'), 0);
          break;
        case 'help':
          helpDialog.showModal();
          closeHelp?.focus();
          break;
      }
    });
  }

  const applyPanel = (workspace: Workspace, key: PanelKey): void => {
    activePanels[workspace] = key;
    updateBrowserSession({ activePanels: { [workspace]: key } });
    for (const button of Array.from(rail.querySelectorAll<HTMLButtonElement>('.ms21-rail-button'))) {
      button.hidden = button.dataset.workspace !== workspace;
      button.classList.toggle('active', button.dataset.ms21Panel === key);
      button.setAttribute('aria-current', button.dataset.ms21Panel === key ? 'page' : 'false');
    }

    if (workspace === 'editor') {
      const all = Array.from(new Set(Object.values(editorGroups).flat()));
      for (const element of all) element.hidden = true;
      for (const [index, element] of (editorGroups[key] ?? []).entries()) {
        element.hidden = false;
        if (element instanceof HTMLDetailsElement) element.open = index === 0;
      }
      if (key === 'project') showProjectDock();
    } else {
      const dashboard = dmWorkspace.querySelector<HTMLElement>('#campaign-dashboard');
      const director = dmWorkspace.querySelector<HTMLElement>('#campaign-scene-director');
      if (dashboard !== null) dashboard.hidden = key !== 'dashboard';
      if (director !== null) director.hidden = key !== 'scenes' && key !== 'session';
      if (playerPreviewPanel !== null) playerPreviewPanel.hidden = key !== 'players';
      if (campaignPrep !== null) campaignPrep.hidden = !['scenes', 'timeline', 'information', 'messages', 'assets', 'notes'].includes(key);
      for (const section of campaignSections) section.hidden = true;
      const targetId: Partial<Record<PanelKey, string>> = {
        scenes: 'campaign-scenes-section', timeline: 'campaign-timeline-section', information: 'campaign-information-section',
        messages: 'campaign-messages-section', assets: 'campaign-assets-section', notes: 'campaign-search-section',
      };
      if (key === 'notes') {
        for (const section of campaignSections.filter((section) => section.classList.contains('campaign-session-history-section') || section.id === 'campaign-search-section')) section.hidden = false;
      } else {
        const id = targetId[key];
        if (id !== undefined) dmWorkspace.querySelector<HTMLElement>(`#${id}`)?.removeAttribute('hidden');
      }
      for (const card of dmSessionCards) card.hidden = true;
      if (key === 'session') {
        if (dashboard !== null) dashboard.hidden = true;
        if (campaignPrep !== null) campaignPrep.hidden = true;
      }
    }

    const item = RAIL_ITEMS.find((candidate) => candidate.key === key);
    requireElement<HTMLElement>('#ms21-panel-title').textContent = item?.label ?? key;
    requireElement<HTMLElement>('#ms21-panel-description').textContent = item?.description ?? '';
    requireElement<HTMLElement>('#ms21-footer-context').textContent = `${workspace === 'editor' ? 'WORLD' : 'CAMPAIGN'} · ${item?.label ?? key}`;
    drawer.classList.remove('collapsed');
    document.dispatchEvent(new CustomEvent('payaw:panel-change', { detail: { workspace, key } }));
  };

  for (const button of Array.from(rail.querySelectorAll<HTMLButtonElement>('.ms21-rail-button'))) {
    button.addEventListener('click', () => {
      const key = button.dataset.ms21Panel as PanelKey;
      const workspace = button.dataset.workspace as Workspace;
      if (workspace !== currentWorkspace()) {
        workspaceSwitcher.querySelector<HTMLButtonElement>(`[data-workspace="${workspace}"]`)?.click();
      }
      setTimeout(() => applyPanel(workspace, key), 0);
    });
  }

  for (const button of Array.from(workspaceSwitcher.querySelectorAll<HTMLButtonElement>('[data-workspace]'))) {
    button.addEventListener('click', () => {
      const workspace = button.dataset.workspace as Workspace;
      setTimeout(() => applyPanel(workspace, activePanels[workspace]), 0);
    });
  }

  requireElement<HTMLButtonElement>('#ms21-collapse-drawer').addEventListener('click', () => drawer.classList.toggle('collapsed'));

  const search = requireElement<HTMLInputElement>('#ms21-global-search');
  const openSearch = (): void => {
    document.querySelector<HTMLButtonElement>('#command-palette-button')?.click();
    setTimeout(() => {
      const paletteInput = document.querySelector<HTMLInputElement>('#command-palette-input');
      if (paletteInput === null) return;
      paletteInput.value = search.value;
      paletteInput.dispatchEvent(new Event('input', { bubbles: true }));
      paletteInput.focus();
    }, 0);
  };
  search.addEventListener('focus', openSearch);
  search.addEventListener('keydown', (event) => { if (event.key === 'Enter') openSearch(); });

  const categoryToolbar = document.querySelector<HTMLElement>('.category-toolbar');
  if (categoryToolbar !== null) categoryToolbar.hidden = true;

  const initialWorkspace: Workspace = localStorage.getItem('payaw.workspace.v1') === 'dm' ? 'dm' : 'editor';
  applyPanel(initialWorkspace, activePanels[initialWorkspace]);
}
