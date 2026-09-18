import { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems, palette, tenants, tokens, tokenValues } from "../../db/schema";

export type TokenMutation = "write" | "delete";

export type TokenActor = {
  projectId: string;
  actorType: string;
  role: string;
  scopes: string[];
  systemAdmin: boolean;
};

const header = (req: Request, name: string): string => {
  const value = req.headers[name];
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
};

export const tokenActor = (req: Request): TokenActor => ({
  projectId: header(req, "x-project-id"),
  actorType: header(req, "x-actor-type"),
  role: header(req, "x-project-role"),
  scopes: header(req, "x-project-scopes").split(",").map((scope) => scope.trim()).filter(Boolean),
  systemAdmin: header(req, "x-system-admin") === "true",
});

export const canMutateToken = (actor: TokenActor, action: TokenMutation): boolean => {
  if (!actor.projectId) return false;
  if (actor.actorType === "user") {
    if (actor.systemAdmin) return true;
    return (action === "write" ? ["owner", "maintainer", "editor"] : ["owner", "maintainer"]).includes(actor.role);
  }
  return actor.actorType === "project_key" && actor.scopes.includes(`tokens:${action}`);
};

export const requireTokenMutation = (action: TokenMutation) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!canMutateToken(tokenActor(req), action)) {
      res.status(403).json({ error: "Token mutation is forbidden" });
      return;
    }
    next();
  };

export const ownsTokenDesignSystem = async (designSystemId: string, projectId: string): Promise<boolean> => {
  const [row] = await db.select({ id: designSystems.id }).from(designSystems)
    .where(and(eq(designSystems.id, designSystemId), eq(designSystems.projectId, projectId)));
  return Boolean(row);
};

export const ownsToken = async (tokenId: string, projectId: string): Promise<boolean> => {
  const [row] = await db.select({ id: tokens.id }).from(tokens)
    .innerJoin(designSystems, eq(tokens.designSystemId, designSystems.id))
    .where(and(eq(tokens.id, tokenId), eq(designSystems.projectId, projectId)));
  return Boolean(row);
};

export const ownsTokenValuePair = async (tokenId: string, tenantId: string, projectId: string): Promise<boolean> => {
  const [row] = await db.select({ id: tokens.id }).from(tokens)
    .innerJoin(tenants, eq(tokens.designSystemId, tenants.designSystemId))
    .innerJoin(designSystems, eq(tokens.designSystemId, designSystems.id))
    .where(and(eq(tokens.id, tokenId), eq(tenants.id, tenantId), eq(designSystems.projectId, projectId)));
  return Boolean(row);
};

export const ownsTokenValue = async (valueId: string, projectId: string): Promise<boolean> => {
  const [row] = await db.select({ id: tokenValues.id }).from(tokenValues)
    .innerJoin(tokens, eq(tokenValues.tokenId, tokens.id))
    .innerJoin(tenants, and(eq(tokenValues.tenantId, tenants.id), eq(tokens.designSystemId, tenants.designSystemId)))
    .innerJoin(designSystems, eq(tokens.designSystemId, designSystems.id))
    .where(and(eq(tokenValues.id, valueId), eq(designSystems.projectId, projectId)));
  return Boolean(row);
};

export const paletteExists = async (paletteId: string): Promise<boolean> => {
  const [row] = await db.select({ id: palette.id }).from(palette).where(eq(palette.id, paletteId));
  return Boolean(row);
};

export const rejectMissingResource = (res: Response): void => {
  res.status(404).json({ error: "Not found" });
};

export const tokenMutationError = (res: Response, error: unknown): void => {
  const code = (error as { code?: string; cause?: { code?: string } })?.code
    || (error as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505") {
    res.status(409).json({ error: "Token record already exists" });
  } else if (code === "23503") {
    res.status(400).json({ error: "Invalid token reference" });
  } else {
    res.status(500).json({ error: String(error) });
  }
};
