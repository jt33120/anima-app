import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

// Test de fumée : la route de santé répond.
describe("smoke", () => {
  it("GET /api/health renvoie status ok", async () => {
    const res = GET();
    const json = await res.json();
    expect(json).toEqual({ status: "ok", app: "anam" });
  });
});
