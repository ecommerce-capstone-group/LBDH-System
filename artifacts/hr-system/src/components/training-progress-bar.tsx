import { Progress } from "@/components/ui/progress";
import {
  getProgressPercent,
  type TrainingProgress,
} from "@/lib/training-progress";

type Props = {
  progress: TrainingProgress;
  className?: string;
};

export function TrainingProgressBar({ progress, className }: Props) {
  const percent = getProgressPercent(progress);
  return (
    <div className={className ?? "space-y-1.5 min-w-[140px]"}>
      <div className="flex justify-between text-xs text-gray-600">
        <span>{progress.label}</span>
        {progress.requiredHours > 0 ? <span>{percent}%</span> : null}
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
}
