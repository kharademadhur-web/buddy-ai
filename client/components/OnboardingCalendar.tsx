import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type OnboardingClinic = {
  id: string;
  name: string;
  clinic_code: string;
  created_at: string;
  subscription_status?: string;
};

type Props = {
  clinics: OnboardingClinic[];
};

export function OnboardingCalendar({ clinics }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  const byDay = useMemo(() => {
    const m: Record<number, OnboardingClinic[]> = {};
    for (const c of clinics) {
      const d = new Date(c.created_at);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      if (!m[day]) m[day] = [];
      m[day].push(c);
    }
    return m;
  }, [clinics, year, month]);

  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Onboarding calendar</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthLabel}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 pb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => (
          <div
            key={idx}
            className={`min-h-[52px] rounded-md border p-1 text-left text-xs ${
              day ? "border-gray-200 bg-white" : "border-transparent bg-transparent"
            }`}
          >
            {day != null ? (
              <>
                <div className="font-medium text-gray-700">{day}</div>
                {(byDay[day] || []).slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="truncate rounded px-0.5 mt-0.5 bg-blue-50 text-blue-900"
                    title={`${c.name} (${c.clinic_code})`}
                  >
                    {c.clinic_code}
                  </div>
                ))}
                {(byDay[day]?.length || 0) > 2 ? (
                  <div className="text-[10px] text-gray-500">+{byDay[day]!.length - 2}</div>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
