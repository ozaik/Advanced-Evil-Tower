import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sid: string }> }
) {
  const { sid } = await params;

  try {
    const res = await fetch(`http://browser-${sid}:3000/url`);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to get URL" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching URL:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sid: string }> }
) {
  const { sid } = await params;

  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`http://browser-${sid}:3000/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to set URL" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error setting URL:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
