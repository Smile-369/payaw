export interface CommandDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly shortcut?: string;
  readonly run: () => void | Promise<void>;
}

export interface CommandPaletteElements {
  readonly trigger: HTMLButtonElement;
  readonly backdrop: HTMLElement;
  readonly input: HTMLInputElement;
  readonly results: HTMLElement;
}

export class CommandPalette {
  private activeIndex = 0;
  private filteredCommands: CommandDefinition[] = [];

  public constructor(
    private readonly elements: CommandPaletteElements,
    private readonly getCommands: () => readonly CommandDefinition[],
  ) {
    elements.trigger.addEventListener('click', () => this.open());
    elements.backdrop.addEventListener('click', (event) => {
      if (event.target === elements.backdrop) this.close();
    });
    elements.input.addEventListener('input', () => {
      this.activeIndex = 0;
      this.render();
    });
  }

  public open(): void {
    this.elements.backdrop.dataset.open = 'true';
    this.elements.backdrop.setAttribute('aria-hidden', 'false');
    this.elements.input.value = '';
    this.activeIndex = 0;
    this.render();
    window.setTimeout(() => this.elements.input.focus(), 0);
  }

  public close(): void {
    this.elements.backdrop.dataset.open = 'false';
    this.elements.backdrop.setAttribute('aria-hidden', 'true');
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (this.elements.backdrop.dataset.open !== 'true') return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.filteredCommands.length - 1, this.activeIndex + 1);
      this.render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      this.render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.runActive();
    }
    return true;
  }

  private render(): void {
    const query = this.elements.input.value.trim().toLocaleLowerCase();
    this.filteredCommands = this.getCommands().filter((command) =>
      `${command.label} ${command.description}`.toLocaleLowerCase().includes(query),
    );
    this.activeIndex = Math.max(0, Math.min(this.activeIndex, this.filteredCommands.length - 1));
    this.elements.results.replaceChildren();
    if (this.filteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-empty';
      empty.textContent = 'No matching commands.';
      this.elements.results.append(empty);
      return;
    }
    this.filteredCommands.forEach((command, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-result';
      button.dataset.active = String(index === this.activeIndex);
      const copy = document.createElement('span');
      const label = document.createElement('strong');
      label.textContent = command.label;
      const description = document.createElement('small');
      description.textContent = command.description;
      copy.append(label, description);
      button.append(copy);
      if (command.shortcut !== undefined) {
        const shortcut = document.createElement('kbd');
        shortcut.textContent = command.shortcut;
        button.append(shortcut);
      }
      button.addEventListener('click', () => {
        this.close();
        void command.run();
      });
      this.elements.results.append(button);
    });
    this.elements.results.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  private runActive(): void {
    const command = this.filteredCommands[this.activeIndex];
    if (command === undefined) return;
    this.close();
    void command.run();
  }
}
