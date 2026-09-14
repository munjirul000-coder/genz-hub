import { defaultSettings, PlatformSettings } from "./settings";

export type DropState = "UPCOMING" | "LIVE" | "ENDED" | "LOCKED" | "CANCELLED";

export type DropSchedule = {
  id: string;
  title: string;
  scheduledAt: number; // ms timestamp in Dhaka timezone converted to UTC
  durationMinutes: number;
  status: DropState;
  productIds: string[];
  createdAt: number;
  createdBy?: string;
};

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

// Get current time in Asia/Dhaka
export function nowInDhaka(): Date {
  // Server may be UTC, we calculate Dhaka time
  const now = new Date();
  // Convert to Dhaka: UTC+6
  const dhakaOffset = 6 * 60; // minutes
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

  // If manual override isLocked exists (legacy), respect but also check schedule
  if (override && typeof override.isLocked === "boolean") {
    // If explicitly unlocked via admin, treat as LIVE regardless of schedule
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

  // Find active scheduled drop
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

  // Check if we are within Friday 9PM window automatically
  const { start, end } = getNextFridayDrop(settings);
  // Calculate if we are in the *previous* drop window that started 7 days ago and still within duration? No, we need to check if now is within this week's Friday window
  // Actually getNextFridayDrop returns future, so check if dhakaNow is Friday 21:00-22:00
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

  // Otherwise upcoming
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
