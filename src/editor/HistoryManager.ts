export interface HistoryEntry<T> {
  readonly label: string;
  readonly state: T;
}

/**
 * Bounded snapshot history for editor data. Generated terrain is deliberately
 * excluded; undo restores the lightweight override state and regenerates only
 * the earliest affected pipeline stage.
 */
export class HistoryManager<T> {
  private readonly undoEntries: HistoryEntry<T>[] = [];
  private readonly redoEntries: HistoryEntry<T>[] = [];

  public constructor(private readonly limit = 64) {}

  public record(previousState: T, label: string): void {
    this.undoEntries.push({ label, state: previousState });
    if (this.undoEntries.length > this.limit) this.undoEntries.shift();
    this.redoEntries.length = 0;
  }

  public undo(currentState: T): HistoryEntry<T> | undefined {
    const entry = this.undoEntries.pop();
    if (entry === undefined) return undefined;
    this.redoEntries.push({ label: entry.label, state: currentState });
    return entry;
  }

  public redo(currentState: T): HistoryEntry<T> | undefined {
    const entry = this.redoEntries.pop();
    if (entry === undefined) return undefined;
    this.undoEntries.push({ label: entry.label, state: currentState });
    return entry;
  }

  public clear(): void {
    this.undoEntries.length = 0;
    this.redoEntries.length = 0;
  }

  public get canUndo(): boolean {
    return this.undoEntries.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoEntries.length > 0;
  }

  public get undoLabel(): string | undefined {
    return this.undoEntries.at(-1)?.label;
  }

  public get redoLabel(): string | undefined {
    return this.redoEntries.at(-1)?.label;
  }
}
