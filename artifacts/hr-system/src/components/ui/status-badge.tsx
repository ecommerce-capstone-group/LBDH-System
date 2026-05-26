import { Badge } from "@/components/ui/badge";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "font-medium",
  {
    variants: {
      status: {
        pending: "bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-200",
        approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 border-emerald-200",
        rejected: "bg-red-100 text-red-800 hover:bg-red-100/80 border-red-200",
        active: "bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200",
        open: "bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200",
        present: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 border-emerald-200",
        closed: "bg-gray-100 text-gray-800 hover:bg-gray-100/80 border-gray-200",
        resolved: "bg-gray-100 text-gray-800 hover:bg-gray-100/80 border-gray-200",
        absent: "bg-gray-100 text-gray-800 hover:bg-gray-100/80 border-gray-200",
        expiring: "bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-200",
        expired: "bg-red-100 text-red-800 hover:bg-red-100/80 border-red-200",
        completed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 border-emerald-200",
        enrolled: "bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200",
        published: "bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200",
        archived: "bg-gray-100 text-gray-800 hover:bg-gray-100/80 border-gray-200",
        offboarding: "bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-200",
        left: "bg-gray-100 text-gray-800 hover:bg-gray-100/80 border-gray-200",
      },
    },
    defaultVariants: {
      status: "pending",
    },
  }
);

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as any;
  
  // Safe fallback if status is not in the list
  const validStatuses = ["pending", "approved", "rejected", "active", "open", "present", "closed", "resolved", "absent", "expiring", "expired", "completed", "offboarding", "left", "enrolled", "published", "archived"];
  const variant = validStatuses.includes(normalizedStatus) ? normalizedStatus : "pending";

  return (
    <Badge 
      variant="outline" 
      className={statusBadgeVariants({ status: variant, className })} 
      {...props}
    >
      {status}
    </Badge>
  );
}
