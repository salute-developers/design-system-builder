import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystemUsers } from "../../db/schema";

export const assertFound = <T>(
  row: T | undefined,
  res: Response,
): row is NonNullable<T> => {
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return false;
  }

  return true;
};

export const tryCatch = async (
  res: Response,
  fn: () => Promise<void>,
): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};

/**
 * Checks whether the current user is allowed to access the given design system.
 * - No Authorization header → admin mode, always allowed.
 * - Invalid token (req.user is undefined) → allowed only if the DS has no assigned users.
 * - Valid user → allowed only if the DS has no assigned users OR the user is assigned to it.
 * Returns true if access is granted, false (and sends 401) otherwise.
 */
export async function assertDsAccess(
  req: Request,
  res: Response,
  dsId: string,
): Promise<boolean> {
  const hasAuthHeader = req.headers.authorization?.startsWith("Basic ");
  if (!hasAuthHeader) return true; // admin mode

  const assignedUserRows = await db
    .select({ userId: designSystemUsers.userId })
    .from(designSystemUsers)
    .where(eq(designSystemUsers.designSystemId, dsId));

  const isUnassigned = assignedUserRows.length === 0;

  if (!req.user) {
    if (isUnassigned) return true;
    res.status(401).json({ error: "Invalid token" });
    return false;
  }

  if (isUnassigned || assignedUserRows.some((r) => r.userId === req.user!.id)) {
    return true;
  }

  res.status(401).json({ error: "Access denied" });
  return false;
}
