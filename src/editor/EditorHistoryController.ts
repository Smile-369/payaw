import type { EditorSession, EditorSnapshot } from '../models/EditorSession';
import { HistoryManager } from './HistoryManager';

interface EditorHistoryDependencies {
  readonly session: EditorSession;
  readonly undoButton: HTMLButtonElement;
  readonly redoButton: HTMLButtonElement;
  readonly persist: () => void;
  readonly applyLabels: () => void;
  readonly regenerate: () => void;
  readonly scheduleAutosave: () => void;
  readonly setStatus: (message: string, state: 'success') => void;
}

export class EditorHistoryController {
  private readonly history = new HistoryManager<EditorSnapshot>(64);
  private restoring = false;

  public constructor(private readonly dependencies: EditorHistoryDependencies) {
    dependencies.undoButton.addEventListener('click', () => this.undo());
    dependencies.redoButton.addEventListener('click', () => this.redo());
    this.updateButtons();
  }

  public capture(): EditorSnapshot {
    return this.dependencies.session.captureSnapshot();
  }

  public record(previous: EditorSnapshot, label: string): void {
    if (this.restoring) return;
    this.history.record(previous, label);
    this.updateButtons();
    this.dependencies.scheduleAutosave();
  }

  public clear(): void {
    this.history.clear();
    this.updateButtons();
  }

  public undo(): void {
    const entry = this.history.undo(this.capture());
    if (entry === undefined) return;
    this.restore(entry.state, `Undid ${entry.label}.`);
  }

  public redo(): void {
    const entry = this.history.redo(this.capture());
    if (entry === undefined) return;
    this.restore(entry.state, `Redid ${entry.label}.`);
  }

  public updateButtons(): void {
    const { undoButton, redoButton } = this.dependencies;
    undoButton.disabled = !this.history.canUndo;
    redoButton.disabled = !this.history.canRedo;
    undoButton.title = this.history.undoLabel === undefined
      ? 'Undo (Ctrl/Cmd+Z)'
      : `Undo ${this.history.undoLabel} (Ctrl/Cmd+Z)`;
    redoButton.title = this.history.redoLabel === undefined
      ? 'Redo (Ctrl/Cmd+Shift+Z)'
      : `Redo ${this.history.redoLabel} (Ctrl/Cmd+Shift+Z)`;
  }

  private restore(snapshot: EditorSnapshot, label: string): void {
    this.restoring = true;
    try {
      this.dependencies.session.restoreSnapshot(snapshot);
      this.dependencies.persist();
      this.dependencies.applyLabels();
      this.dependencies.regenerate();
    } finally {
      this.restoring = false;
    }
    this.updateButtons();
    this.dependencies.setStatus(label, 'success');
  }
}
