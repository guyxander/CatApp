export type CalendarDescription = {
  dayName: string;
  sundayCycle: "A" | "B" | "C";
  territory: string;
  weekdayCycle: "I" | "II";
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function describeCalendar(dateString: string): CalendarDescription {
  const date = new Date(`${dateString}T12:00:00Z`);
  const year = date.getUTCFullYear();
  return {
    dayName: dayNames[date.getUTCDay()] ?? "Day",
    sundayCycle: sundayCycleForYear(year),
    territory: "Nigeria",
    weekdayCycle: year % 2 === 0 ? "II" : "I",
  };
}

function sundayCycleForYear(year: number): "A" | "B" | "C" {
  const cycle = year % 3;
  if (cycle === 0) return "A";
  if (cycle === 1) return "B";
  return "C";
}
