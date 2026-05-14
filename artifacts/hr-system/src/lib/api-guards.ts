/**
 * When the dev server has no /api proxy, fetches can return HTML or other non-JSON
 * bodies that React Query still treats as success. Coerce to [] so .map never throws.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isDashboardSummary(
  value: unknown,
): value is {
  totalEmployees: number;
  activeJobs: number;
  totalApplicants: number;
  pendingRequests: number;
  expiringLicenses: number;
} {
  if (!isRecord(value)) return false;
  for (const key of [
    "totalEmployees",
    "activeJobs",
    "totalApplicants",
    "pendingRequests",
    "expiringLicenses",
  ] as const) {
    if (typeof value[key] !== "number") return false;
  }
  return true;
}
