export interface PriorityQueueEntry {
  readonly index: number;
  readonly priority: number;
}

function comesBefore(left: PriorityQueueEntry, right: PriorityQueueEntry): boolean {
  return left.priority < right.priority
    || (left.priority === right.priority && left.index < right.index);
}

export class MinPriorityQueue {
  private readonly entries: PriorityQueueEntry[] = [];

  public get size(): number {
    return this.entries.length;
  }

  public push(entry: PriorityQueueEntry): void {
    this.entries.push(entry);
    this.bubbleUp(this.entries.length - 1);
  }

  public pop(): PriorityQueueEntry | undefined {
    const root = this.entries[0];
    const last = this.entries.pop();

    if (root === undefined || last === undefined) {
      return root;
    }

    if (this.entries.length > 0) {
      this.entries[0] = last;
      this.bubbleDown(0);
    }

    return root;
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const entry = this.entries[index];
      const parent = this.entries[parentIndex];
      if (entry === undefined || parent === undefined || !comesBefore(entry, parent)) {
        return;
      }

      this.entries[index] = parent;
      this.entries[parentIndex] = entry;
      index = parentIndex;
    }
  }

  private bubbleDown(startIndex: number): void {
    let index = startIndex;

    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = index;

      const current = this.entries[smallestIndex];
      const left = this.entries[leftIndex];
      if (current !== undefined && left !== undefined && comesBefore(left, current)) {
        smallestIndex = leftIndex;
      }

      const smallest = this.entries[smallestIndex];
      const right = this.entries[rightIndex];
      if (smallest !== undefined && right !== undefined && comesBefore(right, smallest)) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === index) {
        return;
      }

      const entry = this.entries[index];
      const target = this.entries[smallestIndex];
      if (entry === undefined || target === undefined) {
        throw new Error('Priority queue heap structure became invalid.');
      }

      this.entries[index] = target;
      this.entries[smallestIndex] = entry;
      index = smallestIndex;
    }
  }
}
