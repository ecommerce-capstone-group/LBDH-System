import type { ApprovalStep } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  UNIT_HEAD_STEP,
  DEPARTMENT_HEAD_STEP,
  stageStatus,
  findStage,
  formatApprovalDate,
  canActOnStep,
  type StageStatus,
} from "@/lib/approval-display";

const STAGES = [UNIT_HEAD_STEP, DEPARTMENT_HEAD_STEP] as const;

type ApprovalStageControlsProps = {
  steps: ApprovalStep[];
  currentStep: string;
  overallStatus: string;
  actorName: string;
  actorRole?: string | null;
  /** When provided, shows approve/reject controls for the active stage. */
  onAdvance?: (decision: "approve" | "reject", note: string) => Promise<void>;
  /** Compact read-only mode (employee self-service). */
  readOnly?: boolean;
  className?: string;
};

function statusTone(status: StageStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50/60";
  if (status === "rejected") return "border-red-200 bg-red-50/60";
  return "border-amber-200 bg-amber-50/40";
}

export function ApprovalStageControls({
  steps,
  currentStep,
  overallStatus,
  actorName,
  actorRole,
  onAdvance,
  readOnly = false,
  className,
}: ApprovalStageControlsProps) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const isFinalized = overallStatus !== "pending";
  const activeHeadStage = STAGES.find((name) => currentStep === name);
  const pendingStep = steps.find((s) => s.status === "pending");
  const actingOnLabel = activeHeadStage ?? (pendingStep?.name || currentStep);
  const canAct =
    !readOnly &&
    !!onAdvance &&
    !isFinalized &&
    canActOnStep(currentStep, actorRole ?? "hr");

  const run = async (decision: "approve" | "reject") => {
    if (!onAdvance || !canAct) return;
    setPending(true);
    try {
      await onAdvance(decision, note.trim());
      setNote("");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">Approval stages</p>
        {!isFinalized && currentStep ? (
          <span className="text-xs text-amber-700">
            Awaiting: {currentStep}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {STAGES.map((name) => {
          const status = stageStatus(steps, name);
          const step = findStage(steps, name);
          const isActive = !isFinalized && currentStep === name;
          const approved = status === "approved";

          return (
            <div
              key={name}
              className={cn(
                "rounded-md border px-3 py-2.5 transition-colors",
                statusTone(status),
                isActive && "ring-1 ring-amber-400/60",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {name}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  {step?.timestamp ? (
                    <p className="mt-1 text-xs text-gray-600">
                      {formatApprovalDate(step.timestamp)}
                      {step.actor ? ` · ${step.actor}` : ""}
                    </p>
                  ) : isActive ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Decision required
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Not yet reviewed</p>
                  )}
                </div>

                {!readOnly ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="sr-only">
                      {name}: {status}
                    </span>
                    <Switch
                      checked={approved}
                      disabled={
                        !isActive ||
                        !canAct ||
                        pending ||
                        status === "rejected"
                      }
                      onCheckedChange={(checked) => {
                        if (checked && isActive && canAct) void run("approve");
                      }}
                      aria-label={`${name} approval toggle`}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {canAct ? (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs text-gray-600">
            Acting as <span className="font-medium">{actorName}</span> on{" "}
            <span className="font-medium">{actingOnLabel}</span>. A request is
            fully approved only after all required stages are completed.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="stage-approval-note">
              Comments / signature note (optional)
            </Label>
            <Input
              id="stage-approval-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Review comments"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => void run("approve")}
            >
              Approve {actingOnLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => void run("reject")}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}

      {!readOnly &&
      !isFinalized &&
      !canActOnStep(currentStep, actorRole ?? "hr") ? (
        <p className="text-xs text-muted-foreground">
          Only the {currentStep} can act on this stage.
        </p>
      ) : null}
    </div>
  );
}
