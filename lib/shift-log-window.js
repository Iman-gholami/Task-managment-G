import { APP_TIME_ZONE, tehranDate } from "./shifts.js";

/**
 * Before 08:00 Tehran time, yesterday's night shift (20:00–08:00) is still on duty.
 * The date returned is the shift's START date, not the date on which it ends.
 * At 08:00 sharp the normal entry window has closed.
 */
export function continuingNightDate(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE, hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).find((part) => part.type === "hour")?.value);
  if (hour >= 8) return null;
  const date = new Date(`${tehranDate(now)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
