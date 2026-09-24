import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export type EmployeeAccountCredentials = {
  username: string;
  temporaryPassword: string;
  employeeName?: string;
  employeeCode?: string;
};

type Props = {
  credentials: EmployeeAccountCredentials | null;
  onClose: () => void;
};

export function EmployeeCredentialsDialog({ credentials, onClose }: Props) {
  if (!credentials) return null;

  const copyAll = async () => {
    const text = `Username: ${credentials.username}\nTemporary password: ${credentials.temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credentials copied.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  return (
    <Dialog
      open={!!credentials}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employee login credentials</DialogTitle>
          <DialogDescription>
            Shown once. Share these with the employee so they can sign in at the
            login page. The temporary password cannot be viewed again from this
            screen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-md border bg-muted/40 p-4 text-sm">
          {credentials.employeeName ? (
            <p>
              <span className="text-muted-foreground">Employee:</span>{" "}
              <span className="font-medium">{credentials.employeeName}</span>
              {credentials.employeeCode ? ` (${credentials.employeeCode})` : ""}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Login:</span>{" "}
            <span className="font-mono text-xs break-all">
              https://lbdh-hr-system.vercel.app/login
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Username:</span>{" "}
            <span className="font-mono font-semibold">{credentials.username}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Temporary password:</span>{" "}
            <span className="font-mono font-semibold">
              {credentials.temporaryPassword}
            </span>
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={copyAll}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
