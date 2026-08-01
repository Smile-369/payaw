import type { RecentProjectEntry } from './RecentProjectStore';

export function renderRecentProjectsView(
  container: HTMLElement,
  entries: readonly RecentProjectEntry[],
  onOpen: (entry: RecentProjectEntry) => void,
): void {
  container.replaceChildren();
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'recent-project-empty';
    empty.textContent = 'Generated and imported worlds will appear here.';
    container.append(empty);
    return;
  }
  for (const entry of entries) {
    const row = document.createElement('article'); row.className = 'recent-project-item';
    const copy = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = entry.seed;
    const subtitle = document.createElement('small');
    subtitle.textContent = `${entry.terrainShape} · ${new Date(entry.updatedAt).toLocaleString()}`;
    copy.append(title, subtitle);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Open';
    button.addEventListener('click', () => onOpen(entry));
    row.append(copy, button); container.append(row);
  }
}
