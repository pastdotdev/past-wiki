const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** "Jul 28, 2026". Dates are shown in UTC so server and browser render the same text. */
export function formatDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : formatter.format(new Date(time));
}
