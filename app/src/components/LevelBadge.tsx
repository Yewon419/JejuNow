import { LEVEL_COLOR, LEVEL_LABEL } from "@/lib/constants";

export function LevelBadge({ level, imputed }: { level: number; imputed?: boolean }) {
  const color = LEVEL_COLOR[level] ?? LEVEL_COLOR[1];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {LEVEL_LABEL[level] ?? "?"}
      {imputed ? <span className="font-normal opacity-70">· 추정</span> : null}
    </span>
  );
}

export function PressureBar({ pressure, level }: { pressure: number; level: number }) {
  const color = LEVEL_COLOR[level] ?? LEVEL_COLOR[1];
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pressure)}
      aria-label={`수요 압력 ${Math.round(pressure)}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.min(100, pressure)}%`, backgroundColor: color }}
      />
    </div>
  );
}
