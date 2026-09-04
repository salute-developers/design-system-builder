import { Request, Response, NextFunction } from "express";
import { z } from "zod";

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
