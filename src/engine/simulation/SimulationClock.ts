import type { SimulationClockMode, SimulationSpeed, SimulationTimeState } from './SimulationTypes';

const VALID_SPEEDS: readonly SimulationSpeed[] = [0, 1, 5, 15, 60];
export const DEFAULT_SIMULATION_TIMEZONE = 'Asia/Manila';

function validSpeed(value: number): SimulationSpeed {
  return VALID_SPEEDS.includes(value as SimulationSpeed) ? value as SimulationSpeed : 1;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeSimulationTimezone(timezone: unknown): string {
  return typeof timezone === 'string' && isValidTimezone(timezone) ? timezone : DEFAULT_SIMULATION_TIMEZONE;
}

export class SimulationClock {
  private mode: SimulationClockMode;
  private speed: SimulationSpeed;
  private campaignTimestampMs: number;
  private anchorRealTimestampMs: number;
  private anchorCampaignTimestampMs: number;
  private timezone: string;

  public constructor(initial?: Partial<SimulationTimeState>, nowMs = Date.now()) {
    this.mode = initial?.mode ?? 'manual';
    this.speed = validSpeed(initial?.speed ?? 0);
    this.campaignTimestampMs = Number.isFinite(initial?.campaignTimestampMs)
      ? initial?.campaignTimestampMs as number
      : nowMs;
    this.anchorRealTimestampMs = nowMs;
    this.anchorCampaignTimestampMs = this.campaignTimestampMs;
    this.timezone = normalizeSimulationTimezone(initial?.timezone);
  }

  public now(nowMs = Date.now()): number {
    if (this.mode === 'realtime') return nowMs;
    if (this.mode === 'manual' || this.speed === 0) return this.campaignTimestampMs;
    return this.anchorCampaignTimestampMs + (nowMs - this.anchorRealTimestampMs) * this.speed;
  }

  public snapshot(nowMs = Date.now()): SimulationTimeState {
    const timestamp = this.now(nowMs);
    if (this.mode !== 'realtime') this.campaignTimestampMs = timestamp;
    return {
      mode: this.mode,
      campaignTimestampMs: timestamp,
      speed: this.mode === 'manual' ? 0 : this.speed,
      timezone: this.timezone,
    };
  }

  public setMode(mode: SimulationClockMode, nowMs = Date.now()): void {
    const current = this.now(nowMs);
    this.mode = mode;
    this.campaignTimestampMs = current;
    this.anchorCampaignTimestampMs = current;
    this.anchorRealTimestampMs = nowMs;
    if (mode === 'manual') this.speed = 0;
    else if (this.speed === 0) this.speed = 1;
  }

  public setSpeed(speed: SimulationSpeed, nowMs = Date.now()): void {
    const current = this.now(nowMs);
    this.campaignTimestampMs = current;
    this.anchorCampaignTimestampMs = current;
    this.anchorRealTimestampMs = nowMs;
    this.speed = validSpeed(speed);
    if (this.mode === 'manual' && this.speed > 0) this.mode = 'campaign';
  }

  public setTimestamp(timestampMs: number, nowMs = Date.now()): void {
    if (!Number.isFinite(timestampMs)) throw new Error('Simulation timestamp must be finite.');
    this.campaignTimestampMs = timestampMs;
    this.anchorCampaignTimestampMs = timestampMs;
    this.anchorRealTimestampMs = nowMs;
  }

  public advanceMinutes(minutes: number, nowMs = Date.now()): void {
    if (!Number.isFinite(minutes)) throw new Error('Advance minutes must be finite.');
    this.setTimestamp(this.now(nowMs) + minutes * 60_000, nowMs);
  }

  public setTimezone(timezone: string): void {
    if (!isValidTimezone(timezone)) throw new Error(`Invalid IANA timezone: ${timezone}`);
    this.timezone = timezone;
  }
}
