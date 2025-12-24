import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL || "http://gateway:8080";

export async function GET(req: NextRequest) {
  try {
    // Use /sessions/all to get all sessions from all users
    const res = await fetch(`${GATEWAY}/sessions/all`, {
      method: "GET",
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: "Failed to fetch sessions", details: txt },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching sessions:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
