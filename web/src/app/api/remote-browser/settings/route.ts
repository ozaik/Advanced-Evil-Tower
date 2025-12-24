import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const GATEWAY_INTERNAL_URL = process.env.GATEWAY_INTERNAL_URL || "http://gateway:8080";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("rb_user");

  if (!userCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${GATEWAY_INTERNAL_URL}/settings`, {
      headers: {
        Cookie: `rb_user=${userCookie.value}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get settings" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("rb_user");

  if (!userCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const response = await fetch(`${GATEWAY_INTERNAL_URL}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `rb_user=${userCookie.value}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
