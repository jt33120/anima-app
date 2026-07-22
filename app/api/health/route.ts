import { NextResponse } from "next/server";

// Route de santé — sert de test de fumée (l'app démarre et une route répond).
export function GET() {
  return NextResponse.json({ status: "ok", app: "anam" });
}
