import type { PlatformSettings } from "./types";

export type { PlatformSettings } from "./types";

export const defaultSettings: PlatformSettings = {
  platformName: "FlashVault BD",
  currency: "BDT",
  timezone: "Asia/Dhaka",
  dropDay: 5,
  dropStartHour: 21,
  dropStartMinute: 0,
  dropDurationMinutes: 60,
  commissionPercent: 10,
  minOrderAmount: 100,
  shippingFeeInsideDhaka: 80,
  shippingFeeOutside: 120,
  maintenanceMode: false,
};

export function getSettingsFromEnv(): Partial<PlatformSettings> {
  const env = process.env;
  return {
    platformName: env.PLATFORM_NAME,
    timezone: env.PLATFORM_TIMEZONE || env.TZ || defaultSettings.timezone,
    commissionPercent: env.COMMISSION_PERCENT ? Number(env.COMMISSION_PERCENT) : undefined,
  };
}
