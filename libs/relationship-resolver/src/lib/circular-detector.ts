/**
 * Circular Dependency Detector
 *
 * Detects circular dependencies in property relationships.
 */

import { CircularDependencyError } from './errors';

/**
 * Circular path information
 */
export interface CircularPath {
  nodes: string[];
  startNode: string;
}

/**
 * Node in the dependency graph
 */
interface GraphNode {
  id: string;
  dependencies: Set<string>;
}

/**
 * Dependency graph for circular detection
 */
export class DependencyGraph {
  private nodes: Map<string, GraphNode> = new Map();

  /**
   * Add a node to the graph
   */
  addNode(id: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, dependencies: new Set() });
    }
  }

  /**
   * Add a dependency edge
   */
  addDependency(fromId: string, toId: string): void {
    this.addNode(fromId);
    this.addNode(toId);

    const node = this.nodes.get(fromId)!;
    node.dependencies.add(toId);
  }

  /**
   * Remove a node and its edges
   */
  removeNode(id: string): void {
    this.nodes.delete(id);

    for (const node of this.nodes.values()) {
      node.dependencies.delete(id);
    }
  }

  /**
   * Get dependencies of a node
   */
  getDependencies(id: string): string[] {
    return Array.from(this.nodes.get(id)?.dependencies ?? []);
  }

  /**
   * Get all nodes
   */
  getNodes(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
  }

  /**
   * Get the graph as adjacency list
   */
  toAdjacencyList(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [id, node] of this.nodes) {
      result[id] = Array.from(node.dependencies);
    }
    return result;
  }
}

/**
 * Circular dependency detector using DFS
 */
export class CircularDependencyDetector {
  private graph: DependencyGraph;

  constructor(graph?: DependencyGraph) {
    this.graph = graph ?? new DependencyGraph();
  }

  /**
   * Get the dependency graph
   */
  getGraph(): DependencyGraph {
    return this.graph;
  }

  /**
   * Add a dependency relationship
   */
  addDependency(from: string, to: string): void {
    this.graph.addDependency(from, to);
  }

  /**
   * Add multiple dependencies for a node
   */
  addDependencies(from: string, dependencies: string[]): void {
    for (const dep of dependencies) {
      this.graph.addDependency(from, dep);
    }
  }

  /**
   * Check if adding a dependency would create a cycle
   */
  wouldCreateCycle(from: string, to: string): boolean {
    // Adding from -> to creates a cycle if there's already a path from to -> from
    const visited = new Set<string>();
    const path: string[] = [];

    const hasCycle = this.dfsCheckPath(to, from, visited, path);
    return hasCycle;
  }

  /**
   * Detect all circular dependencies in the graph
   */
  detectCircularDependencies(): CircularPath[] {
    const cycles: CircularPath[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    for (const node of this.graph.getNodes()) {
      if (!visited.has(node)) {
        this.dfsDetectCycles(node, visited, recursionStack, path, cycles);
      }
    }

    return cycles;
  }

  /**
   * Check if the graph has any circular dependencies
   */
  hasCircularDependency(): boolean {
    return this.detectCircularDependencies().length > 0;
  }

  /**
   * Get topological sort order (throws if cycle exists)
   */
  topologicalSort(): string[] {
    const cycles = this.detectCircularDependencies();
    if (cycles.length > 0) {
      throw new CircularDependencyError(cycles[0].nodes, cycles[0].startNode);
    }

    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (node: string): void => {
      if (visited.has(node)) return;
      visited.add(node);

      for (const dep of this.graph.getDependencies(node)) {
        visit(dep);
      }

      result.push(node);
    };

    for (const node of this.graph.getNodes()) {
      visit(node);
    }

    return result.reverse();
  }

  /**
   * Get the update order for properties (respecting dependencies)
   */
  getUpdateOrder(): string[] {
    return this.topologicalSort();
  }

  /**
   * Validate that adding a dependency won't create a cycle
   */
  validateDependency(from: string, to: string): void {
    if (this.wouldCreateCycle(from, to)) {
      throw new CircularDependencyError([from, to], from);
    }
  }

  /**
   * Clear all dependencies
   */
  clear(): void {
    this.graph.clear();
  }

  private dfsCheckPath(current: string, target: string, visited: Set<string>, path: string[]): boolean {
    if (current === target) return true;
    if (visited.has(current)) return false;

    visited.add(current);
    path.push(current);

    for (const dep of this.graph.getDependencies(current)) {
      if (this.dfsCheckPath(dep, target, visited, path)) {
        return true;
      }
    }

    path.pop();
    return false;
  }

  private dfsDetectCycles(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: CircularPath[]
  ): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const dep of this.graph.getDependencies(node)) {
      if (!visited.has(dep)) {
        this.dfsDetectCycles(dep, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep);
        const cyclePath = path.slice(cycleStart);
        cycles.push({
          nodes: cyclePath,
          startNode: dep,
        });
      }
    }

    path.pop();
    recursionStack.delete(node);
  }
}
