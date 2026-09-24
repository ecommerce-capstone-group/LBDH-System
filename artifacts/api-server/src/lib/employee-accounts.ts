import { createHash, randomBytes } from "crypto";
import { db, pool, employeeAccounts, employees } from "@workspace/db";
import { eq } from "drizzle-orm";

export type AccountCredentials = {
  username: string;
  temporaryPassword: string;
};

let accountsReady: Promise<void> | null = null;

export function ensureEmployeeAccountsTable(): Promise<void> {
  if (!accountsReady) {
    accountsReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS employee_accounts (
          id serial PRIMARY KEY,
          employee_id integer NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
          username text NOT NULL UNIQUE,
          password_hash text NOT NULL,
          password_salt text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )`,
      )
      .then(() => undefined)
      .catch((err) => {
        accountsReady = null;
        throw err;
      });
  }
  return accountsReady;
}

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Demo / staff logins that must never be auto-assigned to employees. */
const RESERVED_USERNAMES = new Set(["hr", "unithead", "admin"]);

function baseUsernameFromProfile(name: string, email: string): string {
  const fromEmail = email.split("@")[0]?.trim().toLowerCase() ?? "";
  const cleanedEmail = fromEmail.replace(/[^a-z0-9._-]+/g, ".").replace(/^\.+|\.+$/g, "");
  if (cleanedEmail.length >= 3) return cleanedEmail.slice(0, 32);

  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "emp";
  if (parts.length === 1) return parts[0]!.replace(/[^a-z0-9]/g, "").slice(0, 32) || "emp";
  const first = parts[0]!.replace(/[^a-z0-9]/g, "");
  const last = parts[parts.length - 1]!.replace(/[^a-z0-9]/g, "");
  const combined = `${first}.${last}`.replace(/^\.+|\.+$/g, "");
  return (combined || "emp").slice(0, 32);
}

async function allocateUniqueUsername(base: string): Promise<string> {
  let root = (base || "emp").toLowerCase();
  if (RESERVED_USERNAMES.has(root)) root = `emp.${root}`;

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? root : `${root}${attempt + 1}`;
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const [existing] = await db
      .select({ id: employeeAccounts.id })
      .from(employeeAccounts)
      .where(eq(employeeAccounts.username, candidate));
    if (!existing) return candidate;
  }
  return `${root}${Date.now().toString(36)}`;
}

/**
 * Creates a login account linked to an employee profile.
 * Returns credentials once — password is stored hashed only.
 * No-ops (returns null) if an account already exists for this employee.
 */
export async function provisionEmployeeAccount(opts: {
  employeeId: number;
  name: string;
  email: string;
}): Promise<AccountCredentials | null> {
  await ensureEmployeeAccountsTable();

  const [existing] = await db
    .select()
    .from(employeeAccounts)
    .where(eq(employeeAccounts.employeeId, opts.employeeId));
  if (existing) return null;

  const username = await allocateUniqueUsername(
    baseUsernameFromProfile(opts.name, opts.email),
  );
  const temporaryPassword = generateTemporaryPassword();
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(temporaryPassword, passwordSalt);

  await db.insert(employeeAccounts).values({
    employeeId: opts.employeeId,
    username,
    passwordHash,
    passwordSalt,
  });

  return { username, temporaryPassword };
}

export async function authenticateEmployee(
  username: string,
  password: string,
): Promise<{
  username: string;
  role: "employee";
  name: string;
  employeeId: number;
} | null> {
  await ensureEmployeeAccountsTable();

  const uname = username.trim().toLowerCase();
  const [account] = await db
    .select()
    .from(employeeAccounts)
    .where(eq(employeeAccounts.username, uname));
  if (!account) return null;

  const hash = hashPassword(password, account.passwordSalt);
  if (hash !== account.passwordHash) return null;

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, account.employeeId));
  if (!employee) return null;
  if (employee.status === "left") return null;

  return {
    username: account.username,
    role: "employee",
    name: employee.name,
    employeeId: employee.id,
  };
}
