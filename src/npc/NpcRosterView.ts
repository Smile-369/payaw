import type { NPC } from '../engine/npc/NPC';

export interface NpcRosterViewElements {
  readonly count: HTMLElement;
  readonly rosterSize: HTMLInputElement;
  readonly list: HTMLElement;
  readonly exportSelected: HTMLButtonElement;
  readonly exportGroup: HTMLButtonElement;
}

export interface NpcRosterViewState {
  readonly totalCount: number;
  readonly filteredNpcs: readonly NPC[];
  readonly selectedKey: string | null;
  readonly hasSelectedNpc: boolean;
}

export interface NpcRosterViewCallbacks {
  readonly describeNpc: (npc: NPC) => string;
  readonly statusLabel: (npc: NPC) => string;
  readonly editNpc: (key: string) => void;
  readonly focusNpc: (npc: NPC) => void;
  readonly useTravelEndpoint: (endpoint: 'from' | 'to', npc: NPC) => void;
}

export function renderNpcRosterView(
  elements: NpcRosterViewElements,
  state: NpcRosterViewState,
  callbacks: NpcRosterViewCallbacks,
): void {
  elements.count.textContent = String(state.totalCount);
  elements.rosterSize.value = String(state.totalCount);
  elements.list.replaceChildren();
  elements.exportSelected.disabled = !state.hasSelectedNpc;
  elements.exportGroup.disabled = state.filteredNpcs.length === 0;
  if (state.filteredNpcs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = state.totalCount === 0 ? 'No NPCs have been generated.' : 'No NPC matches this search.';
    elements.list.append(empty);
    return;
  }

  for (const npc of state.filteredNpcs.slice(0, 120)) {
    const card = document.createElement('article'); card.className = 'npc-card';
    const heading = document.createElement('div'); heading.className = 'npc-card-heading';
    const copy = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = npc.name;
    const meta = document.createElement('small'); meta.textContent = callbacks.describeNpc(npc);
    copy.append(title, meta);
    const status = document.createElement('span');
    status.className = `npc-status npc-status-${npc.status}`;
    status.textContent = callbacks.statusLabel(npc);
    const actions = document.createElement('div'); actions.className = 'npc-card-actions';
    const edit = document.createElement('button'); edit.type = 'button';
    edit.textContent = state.selectedKey === npc.key ? 'Editing' : 'Edit';
    edit.addEventListener('click', () => callbacks.editNpc(npc.key));
    const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Focus';
    focus.addEventListener('click', () => callbacks.focusNpc(npc));
    actions.append(edit, focus);
    heading.append(copy, status, actions);
    card.dataset.selected = String(state.selectedKey === npc.key);

    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = npc.personality;
    const body = document.createElement('div'); body.className = 'npc-card-body';
    for (const [label, value] of [['Wish', npc.wish], ['Fear', npc.fear], ['Secret', npc.secret], ['Rumor', npc.rumor]] as const) {
      const row = document.createElement('p');
      const strong = document.createElement('strong'); strong.textContent = `${label}: `;
      row.append(strong, value); body.append(row);
    }
    const schedule = document.createElement('p');
    const scheduleStrong = document.createElement('strong'); scheduleStrong.textContent = 'Weekly schedule: ';
    const dayCount = new Set(npc.weeklySchedule.map((entry) => entry.day)).size;
    schedule.append(
      scheduleStrong,
      npc.weeklySchedule.length === 0
        ? 'No authored blocks; defaults to home.'
        : `${npc.weeklySchedule.length} blocks across ${dayCount} day${dayCount === 1 ? '' : 's'}.`,
    );
    body.append(schedule);
    const routeButtons = document.createElement('div'); routeButtons.className = 'button-row compact-buttons';
    const asFrom = document.createElement('button'); asFrom.type = 'button'; asFrom.textContent = 'Use as Point A';
    asFrom.addEventListener('click', () => callbacks.useTravelEndpoint('from', npc));
    const asTo = document.createElement('button'); asTo.type = 'button'; asTo.textContent = 'Use as Point B';
    asTo.addEventListener('click', () => callbacks.useTravelEndpoint('to', npc));
    routeButtons.append(asFrom, asTo); body.append(routeButtons);
    details.append(summary, body);
    card.append(heading, details);
    elements.list.append(card);
  }
}
