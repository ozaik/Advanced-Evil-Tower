import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sid: string }> }
) {
  const { sid } = await params;

  try {
    const res = await fetch(`http://browser-${sid}:3000/auth-status`);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to get authentication status" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching auth status:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
