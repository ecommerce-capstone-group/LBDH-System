import { CheckCircle2, XCircle, Clock, Circle } from "lucide-react";
import { format } from "date-fns";
import type { ApprovalStep } from "@workspace/api-client-react";

interface ApprovalStepperProps {
  steps: ApprovalStep[];
  currentStep: string;
}

export function ApprovalStepper({ steps, currentStep }: ApprovalStepperProps) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-6">
        {steps.map((step, index) => {
          const isPending = step.status === "pending";
          const isApproved = step.status === "approved";
          const isRejected = step.status === "rejected";
          
          return (
            <div key={index} className="relative flex gap-4">
              <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white">
                {isApproved ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 bg-white" />
                ) : isRejected ? (
                  <XCircle className="h-6 w-6 text-red-500 bg-white" />
                ) : isPending && step.name === currentStep ? (
                  <Clock className="h-6 w-6 text-amber-500 bg-white" />
                ) : (
                  <Circle className="h-6 w-6 text-gray-300 bg-white" />
                )}
              </div>
              
              <div className="flex flex-col pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {step.name}
                  </span>
                  {step.timestamp && (
                    <span className="text-xs text-gray-500">
                      {format(new Date(step.timestamp), "MMM d, yyyy h:mm a")}
                    </span>
                  )}
                </div>
                
                {step.actor && (
                  <span className="text-xs text-gray-600 mt-0.5">
                    by {step.actor}
                  </span>
                )}
                
                {step.note && (
                  <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                    "{step.note}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
