import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type ApprovalActionsProps = {
  actor: string;
  onAdvance: (decision: "approve" | "reject", note: string) => Promise<void>;
  disabled?: boolean;
};

export function ApprovalActions({
  actor,
  onAdvance,
  disabled,
}: ApprovalActionsProps) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const run = async (decision: "approve" | "reject") => {
    setPending(true);
    try {
      await onAdvance(decision, note.trim());
      setNote("");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="grid gap-2">
        <Label htmlFor="approval-note">Comments / signature note (optional)</Label>
        <Input
          id="approval-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Review comments or acknowledgement text"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || pending}
          onClick={() => run("approve")}
        >
          Approve step
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={disabled || pending}
          onClick={() => run("reject")}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
