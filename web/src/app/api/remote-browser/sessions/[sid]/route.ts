import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL || "http://gateway:8080";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sid: string }> }
) {
  const { sid } = await params;

  try {
    // Use the admin endpoint to delete any session regardless of user
    const res = await fetch(`${GATEWAY}/sessions/${sid}/admin`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: "Failed to delete session", details: txt },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error deleting session:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
