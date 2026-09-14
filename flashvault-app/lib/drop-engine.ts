import type { PlatformSettings, DropSchedule, DropState } from "./types";
import { defaultSettings } from "./settings";

export type { DropState, DropSchedule } from "./types";

export type ComputedDrop = {
  state: DropState;
  isLive: boolean;
  isLocked: boolean;
  nextDropAt: number;
  liveEndsAt: number | null;
  currentDrop: DropSchedule | null;
  serverTime: number;
  timezone: string;
};

export function nowInDhaka(): Date {
  const now = new Date();
  const dhakaOffset = 6 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + dhakaOffset * 60000);
}

export function getNextFridayDrop(settings: PlatformSettings = defaultSettings): { start: Date; end: Date } {
  const dhakaNow = nowInDhaka();
  const day = dhakaNow.getDay();
  let diff = settings.dropDay - day;
  if (diff < 0 || (diff === 0 && (dhakaNow.getHours() > settings.dropStartHour || (dhakaNow.getHours() === settings.dropStartHour && dhakaNow.getMinutes() >= settings.dropStartMinute)))) {
    diff += 7;
  }
  const next = new Date(dhakaNow);
  next.setDate(dhakaNow.getDate() + diff);
  next.setHours(settings.dropStartHour, settings.dropStartMinute, 0, 0);
  const end = new Date(next.getTime() + settings.dropDurationMinutes * 60000);
  return { start: next, end };
}

export function computeDropState(
  settings: PlatformSettings = defaultSettings,
  override?: { isLocked?: boolean; nextDropAt?: number; liveEndsAt?: number },
  drops?: DropSchedule[]
): ComputedDrop {
  const serverTime = Date.now();
  const dhakaNow = nowInDhaka();
  const timezone = settings.timezone;

  if (override && typeof override.isLocked === "boolean") {
    if (!override.isLocked) {
      return {
        state: "LIVE",
        isLive: true,
        isLocked: false,
        nextDropAt: override.nextDropAt || getNextFridayDrop(settings).start.getTime(),
        liveEndsAt: override.liveEndsAt || Date.now() + settings.dropDurationMinutes * 60000,
        currentDrop: drops?.find(d => d.status === "LIVE") || null,
        serverTime,
        timezone,
      };
    }
  }

  const activeDrop = drops?.find(d => {
    const start = d.scheduledAt;
    const end = start + d.durationMinutes * 60000;
    return serverTime >= start && serverTime <= end && d.status !== "CANCELLED";
  });

  if (activeDrop) {
    return {
      state: "LIVE",
      isLive: true,
      isLocked: false,
      nextDropAt: activeDrop.scheduledAt,
      liveEndsAt: activeDrop.scheduledAt + activeDrop.durationMinutes * 60000,
      currentDrop: activeDrop,
      serverTime,
      timezone,
    };
  }

  const { start } = getNextFridayDrop(settings);
  const isFriday = dhakaNow.getDay() === settings.dropDay;
  const minutesNow = dhakaNow.getHours() * 60 + dhakaNow.getMinutes();
  const startMinutes = settings.dropStartHour * 60 + settings.dropStartMinute;
  const endMinutes = startMinutes + settings.dropDurationMinutes;
  const isInWindow = isFriday && minutesNow >= startMinutes && minutesNow < endMinutes;

  if (isInWindow) {
    const todayStart = new Date(dhakaNow);
    todayStart.setHours(settings.dropStartHour, settings.dropStartMinute, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + settings.dropDurationMinutes * 60000);
    return {
      state: "LIVE",
      isLive: true,
      isLocked: false,
      nextDropAt: todayStart.getTime(),
      liveEndsAt: todayEnd.getTime(),
      currentDrop: null,
      serverTime,
      timezone,
    };
  }

  return {
    state: "UPCOMING",
    isLive: false,
    isLocked: true,
    nextDropAt: start.getTime(),
    liveEndsAt: null,
    currentDrop: null,
    serverTime,
    timezone,
  };
}

export function canPurchase(state: ComputedDrop): boolean {
  return state.isLive && !state.isLocked;
}
