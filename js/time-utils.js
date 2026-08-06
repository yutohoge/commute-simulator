export function nextWeekdayAt(hour, minute) {
  const now = new Date();
  const result = new Date(now);
  result.setSeconds(0, 0);
  result.setHours(hour, minute, 0, 0);

  if (result <= now) result.setDate(result.getDate() + 1);
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

export function resolveDepartureTime(preset, customValue) {
  if (customValue) {
    const custom = new Date(customValue);
    if (!Number.isNaN(custom.getTime()) && custom > new Date()) return custom;
  }

  switch (preset) {
    case "WEEKDAY_0730": return nextWeekdayAt(7, 30);
    case "WEEKDAY_0800": return nextWeekdayAt(8, 0);
    case "WEEKDAY_1800": return nextWeekdayAt(18, 0);
    default: return new Date(Date.now() + 60_000);
  }
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function toDateTimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join("T");
}
