import type { CanvasRenderer } from '../engine/renderer/CanvasRenderer';
import { weatherLabel } from '../engine/simulation/WeatherSystem';
import type { SimulationEvent } from '../engine/simulation/SimulationTypes';
import type { NPCSchedulePeriod } from '../engine/npc/NPC';
import { npcSchedulePeriodForTimestamp } from '../engine/time/WorldClock';
import { datetimeLocalValue } from '../campaign/CampaignTime';
import type { EditorSession } from '../models/EditorSession';
import * as elements from './AppElements';

export interface SimulationPanelDependencies {
  readonly renderer: CanvasRenderer;
  readonly session: EditorSession;
  readonly getClockFormat: () => '12h' | '24h';
  readonly onWorldRevision: (period: NPCSchedulePeriod) => void;
  readonly requestRender: () => void;
}

export class SimulationPanelController {
  private lastRealtimeClockSecond = -1;

  public constructor(private readonly dependencies: SimulationPanelDependencies) {}

  public invalidateClock(): void {
    this.lastRealtimeClockSecond = -1;
  }

  public renderInfrastructureTargets(): void {
    const world = this.dependencies.session.world;
    const selected = elements.simulationInfrastructureTarget.value;
    const kind = elements.simulationInfrastructureKind.value as 'road' | 'bridge' | 'port';
    const state = this.dependencies.session.simulation?.state().infrastructure;
    const items = kind === 'road'
      ? world.roads.map((item) => ({ id: item.id, label: item.name, status: state?.roadStatusById[item.id] ?? 'open', manual: state?.manualRoadStatusById[item.id] }))
      : kind === 'bridge'
        ? world.bridges.map((item) => ({ id: item.id, label: item.name, status: state?.bridgeStatusById[item.id] ?? 'open', manual: state?.manualBridgeStatusById[item.id] }))
        : world.ports.map((item) => ({ id: item.id, label: item.name, status: state?.portStatusById[item.id] ?? 'open', manual: state?.manualPortStatusById[item.id] }));
    elements.simulationInfrastructureTarget.replaceChildren(...items.map((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = `${item.label} · ${item.status.replace('-', ' ')}${item.manual === undefined ? '' : ' · manual'}`;
      return option;
    }));
    if (items.some((item) => String(item.id) === selected)) elements.simulationInfrastructureTarget.value = selected;
    const selectedItem = items.find((item) => String(item.id) === elements.simulationInfrastructureTarget.value) ?? items[0];
    if (selectedItem !== undefined) elements.simulationInfrastructureStatus.value = selectedItem.manual ?? selectedItem.status;
    elements.simulationInfrastructureTarget.disabled = items.length === 0;
    elements.simulationInfrastructureApply.disabled = items.length === 0;
    elements.simulationInfrastructureClear.disabled = items.length === 0 || selectedItem?.manual === undefined;
  }

  public render(): void {
    const simulation = this.dependencies.session.simulation;
    if (simulation === null) return;
    const state = simulation.state();
    this.dependencies.renderer.setSimulationState(state);
    elements.simulationClockMode.value = state.time.mode;
    elements.simulationSpeed.value = String(state.time.speed);
    elements.simulationSpeed.disabled = state.time.mode === 'realtime';
    elements.simulationLiveBadge.textContent = state.time.mode === 'realtime'
      ? 'LIVE'
      : state.time.mode === 'campaign' ? `${state.time.speed}×` : 'PAUSED';
    elements.simulationLiveBadge.dataset.mode = state.time.mode;
    const displayDate = new Date(state.time.campaignTimestampMs);
    elements.simulationTimezoneSummary.textContent = state.time.timezone.toLocaleUpperCase();
    elements.simulationNowSummary.textContent = new Intl.DateTimeFormat(undefined, {
      timeZone: state.time.timezone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: this.dependencies.getClockFormat() === '12h',
    }).format(displayDate);
    const currentPeriod = npcSchedulePeriodForTimestamp(state.time.campaignTimestampMs, state.time.timezone);
    elements.simulationPeriodSummary.textContent = `${currentPeriod.toLocaleUpperCase()} PERIOD · ${state.time.mode === 'realtime' ? 'synced to real time' : state.time.mode === 'campaign' ? `campaign running at ${state.time.speed}×` : 'manual clock paused'}`;
    if (document.activeElement !== elements.simulationDatetime) {
      elements.simulationDatetime.value = datetimeLocalValue(state.time.campaignTimestampMs, state.time.timezone);
    }
    elements.simulationWeather.value = simulation.serialize().weatherOverride ?? 'auto';
    elements.simulationWeatherSummary.textContent = `${weatherLabel(state.weather.condition)} · ${Math.round(state.weather.windKph)} km/h`;
    this.setHealth('weather', state.weather.condition === 'typhoon' ? 'critical' : state.weather.intensity >= 0.65 ? 'warning' : 'good');
    elements.simulationTrafficSummary.textContent = `${state.settlements.profileLabel} · ${state.settlements.aggregateTrafficMultiplier.toFixed(2)}×`;
    this.setHealth('traffic', state.settlements.aggregateTrafficMultiplier > 1.45 ? 'warning' : 'good');

    const infrastructureStatuses = [
      ...Object.values(state.infrastructure.roadStatusById),
      ...Object.values(state.infrastructure.bridgeStatusById),
      ...Object.values(state.infrastructure.portStatusById),
    ];
    const unavailable = infrastructureStatuses.filter((status) => status === 'closed' || status === 'flooded' || status === 'damaged').length;
    const restricted = infrastructureStatuses.filter((status) => status === 'restricted' || status === 'under-repair').length;
    elements.simulationInfrastructureSummary.textContent = unavailable + restricted === 0 ? 'All links open' : `${unavailable} unavailable · ${restricted} restricted`;
    this.setHealth('infrastructure', unavailable > 0 ? 'critical' : restricted > 0 ? 'warning' : 'good');

    const venueStatuses = Object.values(state.venues.anchorStatusById);
    const openVenues = venueStatuses.filter((status) => status === 'open' || status === 'closing-soon').length;
    const emergencyVenues = venueStatuses.filter((status) => status === 'emergency-only' || status === 'evacuated').length;
    elements.simulationVenueSummary.textContent = `${openVenues}/${venueStatuses.length} operating${emergencyVenues > 0 ? ` · ${emergencyVenues} emergency` : ''}`;
    this.setHealth('venues', emergencyVenues > 0 ? 'critical' : openVenues < venueStatuses.length * 0.5 ? 'warning' : 'good');

    const npcEntries = Object.values(state.npcs.entriesByNpcId);
    const travelling = npcEntries.filter((entry) => entry.state === 'travelling').length;
    const disrupted = npcEntries.filter((entry) => entry.state === 'delayed' || entry.state === 'unable').length;
    elements.simulationNpcSummary.textContent = disrupted > 0 ? `${disrupted} disrupted · ${travelling} moving` : `${travelling} travelling · on schedule`;
    this.setHealth('npcs', disrupted > 0 ? 'warning' : 'good');

    elements.simulationSupernaturalSummary.textContent = state.supernatural.level === 'dormant'
      ? 'Dormant'
      : `${state.supernatural.level.charAt(0).toUpperCase()}${state.supernatural.level.slice(1)}${state.supernatural.witchingHour ? ' · 3 AM' : ''}`;
    this.setHealth('supernatural', state.supernatural.level === 'peak' ? 'critical' : state.supernatural.active ? 'warning' : 'good');
    this.renderEvents(state.eventLog, state.time.timezone);
    elements.simulationEventClear.disabled = state.eventLog.length === 0;
    this.renderInfrastructureTargets();
    this.dependencies.requestRender();
  }

  public updateRealtimeClock(now = new Date()): void {
    const secondKey = Math.floor(now.getTime() / 1000);
    if (secondKey === this.lastRealtimeClockSecond) return;
    this.lastRealtimeClockSecond = secondKey;
    const simulation = this.dependencies.session.simulation;
    if (simulation === null) return;
    const beforeRevision = simulation.state().revision;
    const state = simulation.tick(now.getTime());
    const timestamp = simulation.currentTimestamp(now.getTime());
    const displayDate = new Date(timestamp);
    elements.realtimeClockTime.textContent = new Intl.DateTimeFormat(undefined, {
      timeZone: state.time.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: this.dependencies.getClockFormat() === '12h',
    }).format(displayDate);
    elements.realtimeClockDate.textContent = new Intl.DateTimeFormat(undefined, {
      timeZone: state.time.timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(displayDate);
    const period = npcSchedulePeriodForTimestamp(timestamp, state.time.timezone);
    elements.realtimeClockPeriod.textContent = period.toLocaleUpperCase();
    elements.realtimeClockMode.textContent = state.time.mode === 'realtime' ? 'REAL' : state.time.mode === 'campaign' ? `${state.time.speed}×` : 'PAUSED';
    elements.realtimeClock.dataset.period = period;
    elements.realtimeClock.dataset.mode = state.time.mode;
    elements.realtimeClock.title = `World time (${state.time.mode}). Click to switch 12/24-hour display.`;
    if (state.revision !== beforeRevision) {
      this.dependencies.onWorldRevision(period);
      this.render();
    }
  }

  private renderEvents(eventLog: readonly SimulationEvent[], timezone: string): void {
    const filter = elements.simulationEventFilter.value;
    const visibleEvents = eventLog.filter((event) => filter === 'all' || event.category === filter || event.severity === filter).slice(0, 36);
    elements.simulationEventLog.replaceChildren();
    if (visibleEvents.length === 0) {
      const empty = document.createElement('div'); empty.className = 'simulation-event-empty';
      const icon = document.createElement('span'); icon.textContent = '▷';
      const copy = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = eventLog.length === 0 ? 'No events recorded' : 'No events match this filter';
      const small = document.createElement('small'); small.textContent = eventLog.length === 0 ? 'Weather, time, closures, venues, and NPC disruptions will appear here.' : 'Choose another event category to view the timeline.';
      copy.append(strong, small); empty.append(icon, copy); elements.simulationEventLog.append(empty);
      return;
    }
    for (const event of visibleEvents) {
      const row = document.createElement('article'); row.className = 'simulation-event'; row.dataset.severity = event.severity;
      const icon = document.createElement('span'); icon.className = 'simulation-event-icon'; icon.textContent = this.eventIcon(event.category);
      const copy = document.createElement('div'); copy.className = 'simulation-event-copy';
      const meta = document.createElement('div');
      const category = document.createElement('span'); category.className = 'simulation-event-category'; category.textContent = event.category;
      const time = document.createElement('time'); time.dateTime = new Date(event.timestampMs).toISOString();
      time.textContent = new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(event.timestampMs));
      meta.append(category, time);
      const message = document.createElement('p'); message.textContent = event.message;
      copy.append(meta, message); row.append(icon, copy); elements.simulationEventLog.append(row);
    }
  }

  private eventIcon(category: SimulationEvent['category']): string {
    if (category === 'weather') return '≋';
    if (category === 'traffic') return '⇄';
    if (category === 'infrastructure') return '⌁';
    if (category === 'venue') return '⌂';
    if (category === 'npc') return '●';
    if (category === 'supernatural') return '◉';
    return '▷';
  }

  private setHealth(kind: string, state: 'good' | 'warning' | 'critical' | 'neutral'): void {
    const card = document.querySelector<HTMLElement>(`[data-simulation-health="${kind}"]`);
    if (card !== null) card.dataset.state = state;
  }
}
