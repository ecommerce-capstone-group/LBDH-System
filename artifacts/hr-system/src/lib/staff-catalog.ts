/** Roles and departments used across LBDH HR (directory, jobs, seed data). */
export const SYSTEM_ROLES = [
  "Registered Nurse",
  "Staff Nurse",
  "Charge Nurse",
  "Nurse Supervisor",
  "Resident Physician",
  "Attending Physician",
  "Medical Technologist",
  "Radiologic Technologist",
  "Pharmacist",
  "Pharmacy Assistant",
  "HR Coordinator",
  "HR Manager",
  "Finance & Accounting Manager",
  "Accountant",
  "Billing Officer",
  "Admin Officer",
  "Unit Head",
  "Department Head",
  "Nursing Aide",
  "Ward Clerk",
];

export const SYSTEM_DEPARTMENTS = [
  "ICU",
  "Emergency",
  "Laboratory",
  "Radiology",
  "Pharmacy",
  "Nursing",
  "Surgery",
  "Outpatient Department",
  "Human Resources",
  "Finance",
  "Administration",
  "Medical Records",
  "Hemodialysis",
  "NICU",
  "OB-GYNE",
  "Pediatrics",
];

export function mergeCatalogOptions(
  ...lists: Array<Iterable<string | null | undefined>>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const value = (raw ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
