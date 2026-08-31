import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireScope } from "./utils";

/**
 * Проверка project-scope на границе ручки.
 *
 * Список scope приходит в заголовке от gateway. Отсутствие заголовка означает, что запрос
 * пришёл не с ключом проекта, — такие запросы проверке не подлежат.
 */
const run = (headers: Record<string, string | undefined>) => {
  const req = { headers } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnValue({ json }), json } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  requireScope("components:read")(req, res, next);
  return { res, next, json };
};

describe("requireScope", () => {
  it("пропускает ключ с нужным scope", () => {
    const { next, res } = run({ "x-project-scopes": "projects:read,components:read" });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("отклоняет ключ без нужного scope", () => {
    const { next, res, json } = run({ "x-project-scopes": "components:write,tokens:read" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "Scope 'components:read' is required" });
  });

  it("не путает scope с похожим префиксом", () => {
    const { next, res } = run({ "x-project-scopes": "components:read-only" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("терпит пробелы вокруг элементов списка", () => {
    const { next } = run({ "x-project-scopes": " projects:read , components:read " });
    expect(next).toHaveBeenCalled();
  });

  it("пропускает запрос без project-контекста", () => {
    const { next } = run({});
    expect(next).toHaveBeenCalled();
  });

  it("пропускает системного администратора без scope", () => {
    const { next } = run({ "x-project-scopes": "tokens:read", "x-system-admin": "true" });
    expect(next).toHaveBeenCalled();
  });
});
