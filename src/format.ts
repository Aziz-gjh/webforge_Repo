// Display helpers for Riyadh dates ("2026-11-03") and hours. Digits stay 0-9 in both languages.
const pad = (n: number) => String(n).padStart(2, '0');

export const hourLabel = (h: number) => `${pad(h)}:00`;

// Left-to-right isolate keeps "10:00 - 12:00" in order inside Arabic text.
export const timeRange = (start: number, len: number) => `⁦${hourLabel(start)} - ${hourLabel(start + len)}⁩`;

/** "Tue 3 Nov" / "الثلاثاء 3 نوفمبر". days/months come from the language dictionary (days start on Saturday). */
export function dateLabel(date: string, days: string[], months: string[]): string {
  const d = new Date(`${date}T00:00:00Z`);
  const satFirst = (d.getUTCDay() + 1) % 7;
  return `${days[satFirst]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export function dayParts(date: string, days: string[]): { dow: string; day: number } {
  const d = new Date(`${date}T00:00:00Z`);
  return { dow: days[(d.getUTCDay() + 1) % 7], day: d.getUTCDate() };
}
