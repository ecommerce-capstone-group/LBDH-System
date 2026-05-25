import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function fitScoreLabel(score: number): string {
  if (score >= 80) return "Excellent fit";
  if (score >= 60) return "Good fit";
  if (score >= 40) return "Moderate fit";
  return "Low fit";
}

export function fitScoreBarClass(score: number): string {
  if (score >= 80) return "[&>div]:bg-emerald-600";
  if (score >= 60) return "[&>div]:bg-sky-600";
  if (score >= 40) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-orange-500";
}

type FitScoreBarProps = {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showHint?: boolean;
};

export function FitScoreBar({
  score,
  label = "Fit for this role",
  size = "md",
  showHint = true,
}: FitScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const height = size === "lg" ? "h-4" : size === "sm" ? "h-2" : "h-3";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold tabular-nums text-gray-900">{clamped}%</span>
      </div>
      <Progress value={clamped} className={cn(height, fitScoreBarClass(clamped))} />
      {showHint && (
        <p className="text-xs text-muted-foreground">{fitScoreLabel(clamped)} — based on position requirements</p>
      )}
    </div>
  );
}
