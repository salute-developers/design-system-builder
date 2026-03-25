import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";

export const validateBody =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: z.flattenError(result.error) });
      return;
    }

    req.body = result.data;
    next();
  };

export const validateParams =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({ error: z.flattenError(result.error) });
      return;
    }

    next();
  };

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Basic ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Basic ".length);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.token, token));

  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.user = user;
  next();
};

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Basic ")) {
    next();
    return;
  }

  const token = header.slice("Basic ".length);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.token, token));

  if (user) {
    req.user = user;
  }

  next();
};
