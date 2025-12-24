import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_INTERNAL_URL || "http://gateway:8080";
const EXCHANGE_SHARED_SECRET = process.env.EXCHANGE_SHARED_SECRET || "";
const DEFAULT_ALLOWLIST_HOSTS =
  process.env.DEFAULT_ALLOWLIST_HOSTS || "google.com,www.google.com,google.ch,www.google.ch";
const DEFAULT_START_URL = process.env.DEFAULT_START_URL || "https://www.google.com";

// IMPORTANT: since you're mapping nginx to 8080 on host, BASE_URL should be that for local dev.
const BASE_URL = process.env.BASE_URL || "http://localhost:8080";

function cookieVal(req: NextRequest, name: string) {
  return req.cookies.get(name)?.value || "";
}

function extractCookiePair(setCookieHeader: string, cookieName: string) {
  const idx = setCookieHeader.indexOf(`${cookieName}=`);
  if (idx === -1) return "";
  const tail = setCookieHeader.slice(idx);
  const end = tail.indexOf(";");
  return end === -1 ? tail.trim() : tail.slice(0, end).trim();
}

export async function GET(req: NextRequest) {
  if (!EXCHANGE_SHARED_SECRET) {
    return NextResponse.json({ error: "Missing EXCHANGE_SHARED_SECRET" }, { status: 500 });
  }

  // If middleware hasn't set rb_anon yet (first request), create it here.
  let anon = cookieVal(req, "rb_anon");
  let setAnonCookie = false;
  if (!anon) {
    anon = crypto.randomUUID(); // Edge-safe
    setAnonCookie = true;
  }

  // 1) Exchange anon -> gateway sets rb_user cookie
  const exchangeResp = await fetch(`${GATEWAY}/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Exchange-Secret": EXCHANGE_SHARED_SECRET,
      "Cookie": req.headers.get("cookie") || ""
    },
    body: JSON.stringify({ sub: `anon:${anon}` })
  });

  const exchangeSetCookie = exchangeResp.headers.get("set-cookie") || "";
  if (!exchangeResp.ok) {
    const txt = await exchangeResp.text();
    const res = NextResponse.json({ error: "Exchange failed", details: txt }, { status: 500 });
    if (setAnonCookie) {
      res.cookies.set("rb_anon", anon, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365
      });
    }
    if (exchangeSetCookie) res.headers.append("Set-Cookie", exchangeSetCookie);
    return res;
  }

  // Build Cookie header for gateway that includes rb_user immediately
  const existingCookie = req.headers.get("cookie") || "";
  const rbUserPair = extractCookiePair(exchangeSetCookie, "rb_user");
  const cookieForGateway = [existingCookie, rbUserPair].filter(Boolean).join("; ");

  // 2) Check if preferred sid exists and session is still valid
  const preferredSid = cookieVal(req, "rb_preferred_sid");
  if (preferredSid) {
    // Try to start/resume the existing session to get a fresh iframe token
    const startResp = await fetch(`${GATEWAY}/sessions/${preferredSid}/start`, {
      method: "POST",
      headers: {
        "Cookie": cookieForGateway
      }
    });
    
    if (startResp.ok) {
      const data = await startResp.json();
      const res = NextResponse.json({
        ok: true,
        sid: data.sid,
        sessionId: data.sid,
        iframeUrl: data.iframeUrl
      });
      if (setAnonCookie) {
        res.cookies.set("rb_anon", anon, {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
          maxAge: 60 * 60 * 24 * 365
        });
      }
      if (exchangeSetCookie) res.headers.append("Set-Cookie", exchangeSetCookie);
      return res;
    }
    // If start failed, fall through to create new session
  }

  // 3) Create session
  const createResp = await fetch(`${GATEWAY}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieForGateway
    },
    body: JSON.stringify({
      allowlist_hosts: DEFAULT_ALLOWLIST_HOSTS,
      start_url: DEFAULT_START_URL
    })
  });

  if (!createResp.ok) {
    const txt = await createResp.text();
    const res = NextResponse.json({ error: "Create session failed", details: txt }, { status: 500 });
    if (setAnonCookie) {
      res.cookies.set("rb_anon", anon, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365
      });
    }
    if (exchangeSetCookie) res.headers.append("Set-Cookie", exchangeSetCookie);
    return res;
  }

  const data = await createResp.json(); // { sid, iframeUrl, ... }

  const res = NextResponse.json({ ok: true, sid: data.sid, sessionId: data.sid, iframeUrl: data.iframeUrl });

  // Set anon cookie if we created it here
  if (setAnonCookie) {
    res.cookies.set("rb_anon", anon, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  // Forward rb_user cookie to browser
  if (exchangeSetCookie) res.headers.append("Set-Cookie", exchangeSetCookie);

  // Remember sid
  res.cookies.set("rb_preferred_sid", data.sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return res;
}

export async function POST(req: NextRequest) {
  if (!EXCHANGE_SHARED_SECRET) {
    return NextResponse.json({ error: "Missing EXCHANGE_SHARED_SECRET" }, { status: 500 });
  }

  // Parse custom parameters from request body
  const body = await req.json();
  const customAllowlistHosts = body.allowlist_hosts || DEFAULT_ALLOWLIST_HOSTS;
  const customStartUrl = body.start_url || DEFAULT_START_URL;

  // If middleware hasn't set rb_anon yet (first request), create it here.
  let anon = cookieVal(req, "rb_anon");
  let setAnonCookie = false;
  if (!anon) {
    anon = crypto.randomUUID(); // Edge-safe
    setAnonCookie = true;
  }

  // 1) Exchange anon -> gateway sets rb_user cookie
  const exchangeResp = await fetch(`${GATEWAY}/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Exchange-Secret": EXCHANGE_SHARED_SECRET,
      "Cookie": req.headers.get("cookie") || ""
    },
    body: JSON.stringify({ sub: `anon:${anon}` })
  });

  const exchangeSetCookie = exchangeResp.headers.get("set-cookie") || "";
  if (!exchangeResp.ok) {
    const txt = await exchangeResp.text();
    const res = NextResponse.json({ error: "Exchange failed", details: txt }, { status: 500 });
    if (setAnonCookie) {
      res.cookies.set("rb_anon", anon, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365
      });
    }
    return res;
  }

  // Build cookie string for gateway request
  const rbUserPair = extractCookiePair(exchangeSetCookie, "rb_user");
  let cookieForGateway = "";
  if (rbUserPair) cookieForGateway = rbUserPair;

  // 2) Create session with custom parameters
  const createResp = await fetch(`${GATEWAY}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieForGateway
    },
    body: JSON.stringify({
      allowlist_hosts: customAllowlistHosts,
      start_url: customStartUrl
    })
  });

  if (!createResp.ok) {
    const txt = await createResp.text();
    const res = NextResponse.json({ error: "Create session failed", details: txt }, { status: 500 });
    if (setAnonCookie) {
      res.cookies.set("rb_anon", anon, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365
      });
    }
    if (exchangeSetCookie) res.headers.append("Set-Cookie", exchangeSetCookie);
    return res;
  }

  const data = await createResp.json(); // { sid, iframeUrl, ... }

  const res = NextResponse.json({ ok: true, sid: data.sid, sessionId: data.sid, iframeUrl: data.iframeUrl });

  // Set anon cookie if we created it here
  if (setAnonCookie) {
    res.cookies.set("rb_anon", anon, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  // Forward rb_user cookie to browser
  if (exchangeSetCookie) res.headers.append("Set-Cookie", exchangeSetCookie);

  // Remember sid
  res.cookies.set("rb_preferred_sid", data.sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return res;
}

