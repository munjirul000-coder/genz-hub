export type PlatformSettings = {
  platformName: string;
  currency: string;
  timezone: string; // IANA
  dropDay: number; // 0-6, 5=Friday
  dropStartHour: number; // 0-23
  dropStartMinute: number;
  dropDurationMinutes: number;
  commissionPercent: number;
  minOrderAmount: number;
  shippingFeeInsideDhaka: number;
  shippingFeeOutside: number;
  maintenanceMode: boolean;
  logoUrl?: string;
};

export const defaultSettings: PlatformSettings = {
  platformName: "FlashVault BD",
  currency: "BDT",
  timezone: "Asia/Dhaka",
  dropDay: 5, // Friday
  dropStartHour: 21, // 9PM
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
