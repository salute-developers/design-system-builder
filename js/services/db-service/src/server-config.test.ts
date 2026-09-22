import { describe, expect, it } from "vitest";
import { resolveServerHost, resolveServerPort } from "./server-config";

describe("server configuration", () => {
  it("preserves the standalone all-interface default", () => {
    expect(resolveServerHost({})).toBe("0.0.0.0");
    expect(resolveServerPort({})).toBe(3008);
  });

  it("supports loopback binding for the monolith container", () => {
    expect(resolveServerHost({ DB_SERVICE_HOST: "127.0.0.1" })).toBe("127.0.0.1");
    expect(resolveServerPort({ PORT: "3108" })).toBe(3108);
  });
});
