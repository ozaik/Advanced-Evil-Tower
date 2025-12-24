import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const GATEWAY_INTERNAL_URL = process.env.GATEWAY_INTERNAL_URL || "http://gateway:8080";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sid: string }> }
) {
  const { sid } = await context.params;
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("rb_user");

  if (!userCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${GATEWAY_INTERNAL_URL}/sessions/${sid}/health`, {
      headers: {
        Cookie: `rb_user=${userCookie.value}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check health", details: String(error) },
      { status: 500 }
    );
  }
}
