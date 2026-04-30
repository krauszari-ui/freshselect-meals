/**
 * DobPicker — three-dropdown date-of-birth selector
 *
 * Renders three <Select> dropdowns: Month, Day, Year.
 * - Month shows full names (January … December) — prevents "13" typos.
 * - Day is 1–31 and updates to the correct max for the selected month/year.
 * - Year starts from the current year and goes back 120 years — most common
 *   ages appear at the top so users don't have to scroll far.
 * - Outputs a string in MM/DD/YYYY format (or "" when incomplete), which is
 *   compatible with the existing parseLocalDate / formatLocalDate helpers.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(month: number, year: number): number {
  // month is 1-based here
  if (!month) return 31;
  return new Date(year || 2000, month, 0).getDate();
}

interface DobPickerProps {
  /** Current value in MM/DD/YYYY format (or "" when empty) */
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  /** Additional class applied to the wrapper div */
  className?: string;
  /** Label size variant — "sm" for compact rows, "base" (default) for main form */
  size?: "sm" | "base";
}

export function DobPicker({ value, onChange, error, className = "", size = "base" }: DobPickerProps) {
  // Parse the incoming MM/DD/YYYY string into parts
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const month = parts ? parseInt(parts[1], 10) : 0;   // 1-12 or 0 = unset
  const day   = parts ? parseInt(parts[2], 10) : 0;   // 1-31 or 0 = unset
  const year  = parts ? parseInt(parts[3], 10) : 0;   // 4-digit or 0 = unset

  const currentYear = new Date().getFullYear();
  const maxDays = daysInMonth(month, year);

  function emit(m: number, d: number, y: number) {
    if (m && d && y) {
      const mm = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      onChange(`${mm}/${dd}/${y}`);
    } else {
      onChange("");
    }
  }

  function handleMonth(val: string) {
    const m = parseInt(val, 10);
    // Clamp day if it exceeds the new month's max
    const clampedDay = day > daysInMonth(m, year) ? 0 : day;
    emit(m, clampedDay, year);
  }

  function handleDay(val: string) {
    emit(month, parseInt(val, 10), year);
  }

  function handleYear(val: string) {
    const y = parseInt(val, 10);
    // Re-clamp day for Feb in leap-year changes
    const clampedDay = day > daysInMonth(month, y) ? 0 : day;
    emit(month, clampedDay, y);
  }

  const triggerClass = `${size === "sm" ? "h-8 text-xs" : ""} ${error ? "border-red-400" : ""}`;

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {/* Month */}
      <Select value={month ? String(month) : ""} onValueChange={handleMonth}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Day */}
      <Select value={day ? String(day) : ""} onValueChange={handleDay}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year — most recent first so common ages are at the top */}
      <Select value={year ? String(year) : ""} onValueChange={handleYear}>
        <SelectTrigger className={triggerClass}>
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 121 }, (_, i) => currentYear - i).map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
