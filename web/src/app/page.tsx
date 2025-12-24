"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/wifi-login");
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    }}>
      <div style={{
        textAlign: "center",
        color: "white"
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20
        }}>📶</div>
        <h1 style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 600
        }}>Redirecting to WiFi Login...</h1>
      </div>
    </div>
  );
}
