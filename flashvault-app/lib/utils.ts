import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatBDT(n: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("BDT", "৳");
}
export function getNextFriday9PM() {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 5 Fri
  let diff = 5 - day;
  if (diff < 0 || (diff === 0 && now.getHours() >= 21)) diff += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  next.setHours(21, 0, 0, 0);
  return next;
}
