import { Request, Response } from "express";
import { SQL, and, eq, isNull, or } from "drizzle-orm";
import { designSystems } from "../../db/schema";

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

const headerValue = (req: Request, name: string): string | undefined => {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
};

export const isSystemAdmin = (req: Request): boolean =>
  headerValue(req, "x-system-admin") === "true";

export const getProjectId = (req: Request): string | undefined =>
  headerValue(req, "x-project-id");

export const designSystemScopeFilter = (req: Request): SQL | undefined => {
  if (isSystemAdmin(req)) {
    return undefined;
  }

  const projectId = getProjectId(req);
  if (!projectId) {
    return undefined;
  }

  return or(eq(designSystems.projectId, projectId), isNull(designSystems.projectId));
};

export const designSystemBelongsToScope = (
  row: { projectId: string | null },
  req: Request,
): boolean => {
  if (isSystemAdmin(req)) {
    return true;
  }

  const projectId = getProjectId(req);
  if (!projectId) {
    return true;
  }

  if (row.projectId == null) {
    return true;
  }

  return row.projectId === projectId;
};

export const andOptional = (...parts: Array<SQL | undefined>): SQL | undefined => {
  const filtered = parts.filter((p): p is SQL => p !== undefined);
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1) return filtered[0];
  return and(...filtered);
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
