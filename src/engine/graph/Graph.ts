export interface GraphEdge<TNodeId extends string | number = number> {
  readonly from: TNodeId;
  readonly to: TNodeId;
  readonly weight: number;
}

export class WeightedGraph<TNodeId extends string | number = number> {
  private readonly adjacency = new Map<TNodeId, GraphEdge<TNodeId>[]>();

  public addNode(node: TNodeId): void {
    if (!this.adjacency.has(node)) {
      this.adjacency.set(node, []);
    }
  }

  public addUndirectedEdge(from: TNodeId, to: TNodeId, weight: number): void {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(`Graph edge weight must be finite and non-negative. Received ${weight}.`);
    }

    this.addNode(from);
    this.addNode(to);
    this.adjacency.get(from)?.push({ from, to, weight });
    this.adjacency.get(to)?.push({ from: to, to: from, weight });
  }

  public nodes(): readonly TNodeId[] {
    return [...this.adjacency.keys()];
  }

  public edgesFrom(node: TNodeId): readonly GraphEdge<TNodeId>[] {
    return this.adjacency.get(node) ?? [];
  }

  public hasPath(start: TNodeId, goal: TNodeId): boolean {
    if (!this.adjacency.has(start) || !this.adjacency.has(goal)) {
      return false;
    }

    const visited = new Set<TNodeId>([start]);
    const queue: TNodeId[] = [start];
    for (let offset = 0; offset < queue.length; offset += 1) {
      const current = queue[offset];
      if (current === undefined) {
        continue;
      }
      if (current === goal) {
        return true;
      }

      for (const edge of this.edgesFrom(current)) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }
    }

    return false;
  }
}

class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  public constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Array<number>(size).fill(0);
  }

  public find(value: number): number {
    const parent = this.parent[value];
    if (parent === undefined) {
      throw new RangeError(`Disjoint-set index ${value} is invalid.`);
    }
    if (parent !== value) {
      this.parent[value] = this.find(parent);
    }
    return this.parent[value] ?? value;
  }

  public union(left: number, right: number): boolean {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) {
      return false;
    }

    const leftRank = this.rank[leftRoot] ?? 0;
    const rightRank = this.rank[rightRoot] ?? 0;
    if (leftRank < rightRank) {
      this.parent[leftRoot] = rightRoot;
    } else if (leftRank > rightRank) {
      this.parent[rightRoot] = leftRoot;
    } else {
      this.parent[rightRoot] = leftRoot;
      this.rank[leftRoot] = leftRank + 1;
    }
    return true;
  }
}

export function minimumSpanningTree<TNodeId extends string | number>(
  nodeIds: readonly TNodeId[],
  edges: readonly GraphEdge<TNodeId>[],
): readonly GraphEdge<TNodeId>[] {
  const nodeIndex = new Map<TNodeId, number>();
  nodeIds.forEach((node, index) => nodeIndex.set(node, index));
  const sets = new DisjointSet(nodeIds.length);
  const sortedEdges = [...edges].sort((left, right) => (
    left.weight - right.weight
    || String(left.from).localeCompare(String(right.from))
    || String(left.to).localeCompare(String(right.to))
  ));
  const result: GraphEdge<TNodeId>[] = [];

  for (const edge of sortedEdges) {
    const fromIndex = nodeIndex.get(edge.from);
    const toIndex = nodeIndex.get(edge.to);
    if (fromIndex === undefined || toIndex === undefined) {
      throw new Error('Minimum spanning tree received an edge with an unknown node.');
    }
    if (sets.union(fromIndex, toIndex)) {
      result.push(edge);
    }
    if (result.length === Math.max(0, nodeIds.length - 1)) {
      break;
    }
  }

  if (nodeIds.length > 0 && result.length !== nodeIds.length - 1) {
    throw new Error('Cannot create a spanning tree from a disconnected graph.');
  }
  return result;
}
