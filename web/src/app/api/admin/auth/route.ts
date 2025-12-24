import { NextResponse } from "next/server";
import crypto from "crypto";

// Admin password - Change this in production!
// Set via environment variable: ADMIN_PASSWORD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Simple token generation
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Store valid tokens in memory (in production, use Redis or database)
const validTokens = new Set<string>();

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    if (password === ADMIN_PASSWORD) {
      const token = generateToken();
      validTokens.add(token);

      // Token expires after 24 hours
      setTimeout(() => {
        validTokens.delete(token);
      }, 24 * 60 * 60 * 1000);

      return NextResponse.json({ token, success: true });
    }

    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  } catch (err) {
    console.error("Auth error:", err);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

// Verify token endpoint
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (token && validTokens.has(token)) {
    return NextResponse.json({ valid: true });
  }

  return NextResponse.json({ valid: false }, { status: 401 });
}
