import type { Camera } from '../engine/renderer/Camera';
import {
  TrafficProfile,
  TravelMode,
  collectTravelLocations,
  findTravelLocation,
  formatTravelDuration,
  planTravel,
  planTravelAlternatives,
  pointTravelLocation,
  type TravelLocation,
  type TravelPlan,
} from '../engine/travel/TravelPlanner';
import type { EditorSession } from '../models/EditorSession';

type StatusTone = 'success' | 'warning' | 'error' | 'working' | 'idle';
type TravelEndpoint = 'from' | 'to';

export interface TravelPlannerElements {
  readonly canvas: HTMLCanvasElement;
  readonly fromLocation: HTMLSelectElement;
  readonly toLocation: HTMLSelectElement;
  readonly mode: HTMLSelectElement;
  readonly traffic: HTMLSelectElement;
  readonly calculate: HTMLButtonElement;
  readonly reverse: HTMLButtonElement;
  readonly clear: HTMLButtonElement;
  readonly pickFrom: HTMLButtonElement;
  readonly pickTo: HTMLButtonElement;
  readonly alternatives: HTMLElement;
  readonly result: HTMLElement;
}

export interface TravelPlannerDependencies {
  readonly elements: TravelPlannerElements;
  readonly session: EditorSession;
  readonly camera: Camera;
  readonly syncMap: () => void;
  readonly requestRender: () => void;
  readonly setStatus: (message: string, tone?: StatusTone) => void;
}

export interface RenderedTravelPath {
  readonly segments: readonly {
    readonly mode: TravelPlan['segments'][number]['mode'];
    readonly tileIndices: readonly number[];
  }[];
}

export class TravelPlannerController {
  private activePlanValue: TravelPlan | null = null;
  private alternativesValue: readonly TravelPlan[] = [];
  private normalDuration: number | null = null;
  private pickTarget: TravelEndpoint | null = null;
  private readonly customLocations = new Map<string, TravelLocation>();

  public constructor(private readonly dependencies: TravelPlannerDependencies) {
    const { elements } = dependencies;
    elements.pickFrom.addEventListener('click', () => this.setPickTarget(this.pickTarget === 'from' ? null : 'from'));
    elements.pickTo.addEventListener('click', () => this.setPickTarget(this.pickTarget === 'to' ? null : 'to'));
    elements.calculate.addEventListener('click', () => this.calculate());
    elements.reverse.addEventListener('click', () => {
      const previous = elements.fromLocation.value;
      elements.fromLocation.value = elements.toLocation.value;
      elements.toLocation.value = previous;
      this.calculate();
    });
    elements.clear.addEventListener('click', () => this.clear(true));
    elements.mode.addEventListener('change', () => this.recalculateIfActive());
    elements.traffic.addEventListener('change', () => this.recalculateIfActive());
    this.renderPlan(null);
  }

  public get activePlan(): TravelPlan | null {
    return this.activePlanValue;
  }

  public renderedPath(): RenderedTravelPath | null {
    const plan = this.activePlanValue;
    return plan?.reachable === true
      ? { segments: plan.segments.map((segment) => ({ mode: segment.mode, tileIndices: segment.tileIndices })) }
      : null;
  }

  public refreshLocations(): void {
    const { fromLocation, toLocation } = this.dependencies.elements;
    const locations = this.availableLocations();
    const fromBefore = fromLocation.value;
    const toBefore = toLocation.value;
    this.populateSelect(fromLocation, locations, fromBefore);
    this.populateSelect(toLocation, locations, toBefore);
    if (toLocation.value === fromLocation.value && locations.length > 1) {
      toLocation.value = locations[1]?.id ?? toLocation.value;
    }
  }

  public selectEndpoint(endpoint: TravelEndpoint, locationId: string): void {
    this.refreshLocations();
    const select = endpoint === 'from'
      ? this.dependencies.elements.fromLocation
      : this.dependencies.elements.toLocation;
    if ([...select.options].some((option) => option.value === locationId)) select.value = locationId;
  }

  public handleMapPoint(x: number, y: number): boolean {
    if (this.pickTarget === null) return false;
    const label = this.pickTarget === 'from' ? 'Point A' : 'Point B';
    const location = pointTravelLocation(this.dependencies.session.world, x, y, label);
    if (location === undefined) {
      this.dependencies.setStatus('Choose a point inside the generated world.', 'error');
      return true;
    }
    this.customLocations.set(location.id, location);
    this.refreshLocations();
    const select = this.pickTarget === 'from'
      ? this.dependencies.elements.fromLocation
      : this.dependencies.elements.toLocation;
    select.value = location.id;
    this.dependencies.setStatus(`${label} set at ${location.x}, ${location.y}.`, 'success');
    this.setPickTarget(null);
    return true;
  }

  public calculate(): void {
    const { fromLocation, toLocation, mode, traffic } = this.dependencies.elements;
    const world = this.dependencies.session.world;
    const from = this.resolveLocation(fromLocation.value);
    const to = this.resolveLocation(toLocation.value);
    if (from === undefined || to === undefined) {
      this.dependencies.setStatus('Choose two valid locations.', 'error');
      return;
    }
    if (from.id === to.id) {
      this.dependencies.setStatus('Choose two different locations.', 'error');
      return;
    }
    const liveConditions = traffic.value === 'live';
    const trafficProfile = liveConditions ? TrafficProfile.Normal : traffic.value as TrafficProfile;
    const travelMode = mode.value as TravelMode;
    const context = liveConditions ? this.dependencies.session.simulation?.travelContext() : undefined;
    this.normalDuration = null;
    if (liveConditions) {
      const normalPlan = planTravel(world, from, to, { mode: travelMode, trafficProfile: TrafficProfile.Normal });
      if (normalPlan.reachable) this.normalDuration = normalPlan.durationMinutes;
    }
    this.alternativesValue = planTravelAlternatives(world, from, to, {
      mode: travelMode,
      trafficProfile,
      context,
    }, 3);
    this.showPlan(this.alternativesValue[0] ?? planTravel(world, from, to, { mode: travelMode, trafficProfile, context }));
  }

  public recalculateIfActive(): void {
    if (this.activePlanValue !== null) this.calculate();
  }

  public recalculateIfContextual(): void {
    if (this.activePlanValue?.contextRevision !== undefined) this.calculate();
  }

  public resetForWorld(): void {
    this.clear(false);
  }

  private clear(notify: boolean): void {
    this.activePlanValue = null;
    this.alternativesValue = [];
    this.normalDuration = null;
    this.customLocations.clear();
    this.setPickTarget(null);
    this.refreshLocations();
    this.dependencies.elements.alternatives.replaceChildren();
    this.renderPlan(null);
    this.dependencies.syncMap();
    if (notify) this.dependencies.setStatus('Cleared the displayed travel route.', 'success');
  }

  private availableLocations(): readonly TravelLocation[] {
    return [...collectTravelLocations(this.dependencies.session.world), ...this.customLocations.values()]
      .sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
  }

  private resolveLocation(id: string): TravelLocation | undefined {
    return this.customLocations.get(id) ?? findTravelLocation(this.dependencies.session.world, id);
  }

  private populateSelect(select: HTMLSelectElement, locations: readonly TravelLocation[], preferred?: string): void {
    const previous = preferred ?? select.value;
    select.replaceChildren(...locations.map((location) => {
      const option = document.createElement('option');
      option.value = location.id;
      option.textContent = this.locationLabel(location);
      return option;
    }));
    if (locations.some((location) => location.id === previous)) select.value = previous;
  }

  private locationLabel(location: TravelLocation): string {
    const prefix = location.kind === 'story' ? 'Story'
      : location.kind === 'anchor' ? 'Landmark'
        : location.kind === 'settlement' ? 'Settlement'
          : location.kind === 'port' ? 'Port'
            : location.kind === 'npc' ? 'NPC' : 'Point';
    return `${prefix} · ${location.label}`;
  }

  private focusPlan(plan: TravelPlan): void {
    const world = this.dependencies.session.world;
    const indices = plan.segments.flatMap((segment) => [...segment.tileIndices]);
    const points = indices.flatMap((index) => world.tiles[index] ?? []);
    if (points.length === 0) return;
    const minimumX = Math.min(...points.map((tile) => tile.x));
    const maximumX = Math.max(...points.map((tile) => tile.x));
    const minimumY = Math.min(...points.map((tile) => tile.y));
    const maximumY = Math.max(...points.map((tile) => tile.y));
    const rectangle = this.dependencies.elements.canvas.getBoundingClientRect();
    const width = Math.max(6, maximumX - minimumX + 8);
    const height = Math.max(6, maximumY - minimumY + 8);
    const { camera } = this.dependencies;
    camera.zoom = Math.max(0.5, Math.min(18, Math.min(rectangle.width / width, rectangle.height / height)));
    camera.x = rectangle.width * 0.5 - (minimumX + maximumX + 1) * 0.5 * camera.zoom;
    camera.y = rectangle.height * 0.5 - (minimumY + maximumY + 1) * 0.5 * camera.zoom;
    this.dependencies.requestRender();
  }

  private segmentIcon(mode: TravelPlan['segments'][number]['mode']): string {
    if (mode === 'walk') return 'W';
    if (mode === 'drive') return 'C';
    if (mode === 'public-transport') return 'J';
    return 'B';
  }

  private renderPlan(plan: TravelPlan | null): void {
    const { result } = this.dependencies.elements;
    result.replaceChildren();
    if (plan === null) {
      const empty = document.createElement('span');
      empty.textContent = 'Select two locations and calculate a journey.';
      result.append(empty);
      return;
    }
    if (!plan.reachable) {
      const strong = document.createElement('strong'); strong.textContent = 'No connected route found.';
      const warning = document.createElement('p'); warning.className = 'travel-warning';
      warning.textContent = plan.warnings[0] ?? 'Try another travel mode.';
      result.append(strong, warning);
      return;
    }
    const summary = document.createElement('div'); summary.className = 'travel-result-summary';
    const items: readonly [string, string][] = this.normalDuration !== null && plan.contextRevision !== undefined
      ? [
        ['Current conditions', formatTravelDuration(plan.durationMinutes)],
        ['Normal estimate', formatTravelDuration(this.normalDuration)],
        ['Distance', `${plan.distanceKilometers.toFixed(1)} km`],
        ['Segments', String(plan.segments.length)],
      ]
      : [
        ['Travel time', formatTravelDuration(plan.durationMinutes)],
        ['Distance', `${plan.distanceKilometers.toFixed(1)} km`],
        ['Segments', String(plan.segments.length)],
      ];
    for (const [label, value] of items) {
      const item = document.createElement('div');
      const span = document.createElement('span'); span.textContent = label;
      const strong = document.createElement('strong'); strong.textContent = value;
      item.append(span, strong); summary.append(item);
    }
    const heading = document.createElement('strong'); heading.textContent = `${plan.from.label} → ${plan.to.label}`;
    const segments = document.createElement('div'); segments.className = 'travel-segments';
    for (const segment of plan.segments) {
      const row = document.createElement('div'); row.className = 'travel-segment';
      const icon = document.createElement('span'); icon.className = 'travel-segment-icon'; icon.textContent = this.segmentIcon(segment.mode);
      const copy = document.createElement('div');
      const instruction = document.createElement('strong'); instruction.textContent = segment.instruction;
      const detail = document.createElement('small');
      detail.textContent = `${segment.distanceKilometers.toFixed(1)} km · ${formatTravelDuration(segment.durationMinutes)}`;
      copy.append(instruction, document.createElement('br'), detail);
      const duration = document.createElement('strong'); duration.textContent = formatTravelDuration(segment.durationMinutes);
      row.append(icon, copy, duration); segments.append(row);
    }
    const warning = document.createElement('p'); warning.className = 'travel-warning'; warning.textContent = plan.warnings[0] ?? '';
    const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Focus route on map';
    focus.addEventListener('click', () => this.focusPlan(plan));
    result.append(summary, heading, segments, focus, warning);
  }

  private renderAlternatives(plans: readonly TravelPlan[]): void {
    const { alternatives } = this.dependencies.elements;
    alternatives.replaceChildren();
    if (plans.length <= 1) return;
    const heading = document.createElement('strong'); heading.textContent = 'Alternate paths';
    alternatives.append(heading);
    plans.forEach((plan, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === 0 ? 'active' : '';
      button.textContent = `${index === 0 ? 'Fastest' : `Route ${index + 1}`} · ${formatTravelDuration(plan.durationMinutes)} · ${plan.distanceKilometers.toFixed(1)} km`;
      button.addEventListener('click', () => {
        for (const item of alternatives.querySelectorAll('button')) item.classList.remove('active');
        button.classList.add('active');
        this.showPlan(plan, false);
      });
      alternatives.append(button);
    });
  }

  private showPlan(plan: TravelPlan, updateAlternatives = true): void {
    const elements = this.dependencies.elements;
    this.activePlanValue = plan;
    elements.fromLocation.value = plan.from.id;
    elements.toLocation.value = plan.to.id;
    elements.mode.value = plan.requestedMode;
    elements.traffic.value = plan.contextRevision === undefined ? plan.trafficProfile : 'live';
    this.renderPlan(plan);
    if (updateAlternatives) this.renderAlternatives(this.alternativesValue);
    this.dependencies.syncMap();
    if (plan.reachable) {
      this.dependencies.setStatus(`${plan.from.label} to ${plan.to.label}: ${formatTravelDuration(plan.durationMinutes)} over ${plan.distanceKilometers.toFixed(1)} km.`, 'success');
    } else {
      this.dependencies.setStatus('No connected travel route was found for that mode.', 'warning');
    }
  }

  private setPickTarget(target: TravelEndpoint | null): void {
    this.pickTarget = target;
    const { pickFrom, pickTo, canvas } = this.dependencies.elements;
    pickFrom.dataset.active = String(target === 'from');
    pickTo.dataset.active = String(target === 'to');
    canvas.classList.toggle('travel-pick-mode', target !== null);
    if (target !== null) {
      this.dependencies.setStatus(`Click the map to set Point ${target === 'from' ? 'A' : 'B'}.`, 'working');
    }
  }
}
