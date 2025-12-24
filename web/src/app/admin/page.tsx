"use client";

import { useEffect, useState } from "react";

interface Session {
  sid: string;
  user_id: string;
  allowlist_hosts: string;
  start_url: string;
  created_at: number;
  last_accessed: number;
  iframeUrl: string;
  authStatus?: {
    google: {
      isAuthenticated: boolean;
      userEmail: string | null;
      lastChecked?: number;
    };
    microsoft: {
      isAuthenticated: boolean;
      userEmail: string | null;
      lastChecked?: number;
    };
    facebook: {
      isAuthenticated: boolean;
      userName: string | null;
      lastChecked?: number;
    };
  };
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customStartUrl, setCustomStartUrl] = useState("");
  const [customAllowlistHosts, setCustomAllowlistHosts] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/remote-browser/sessions", {
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      const data = await res.json();
      const sessionsData = data.sessions || [];
      
      // Fetch auth status for each session
      const sessionsWithAuth = await Promise.all(
        sessionsData.map(async (session: Session) => {
          try {
            const authRes = await fetch(`/api/remote-browser/session/${session.sid}/auth-status`, {
              credentials: "include",
            });
            
            if (authRes.ok) {
              const authData = await authRes.json();
              console.log(`Auth status for ${session.sid}:`, authData);
              return {
                ...session,
                authStatus: {
                  google: {
                    isAuthenticated: authData.google?.isAuthenticated || false,
                    userEmail: authData.google?.userEmail || null,
                    lastChecked: Date.now()
                  },
                  microsoft: {
                    isAuthenticated: authData.microsoft?.isAuthenticated || false,
                    userEmail: authData.microsoft?.userEmail || null,
                    lastChecked: Date.now()
                  },
                  facebook: {
                    isAuthenticated: authData.facebook?.isAuthenticated || false,
                    userName: authData.facebook?.userName || null,
                    lastChecked: Date.now()
                  }
                }
              };
            } else {
              console.error(`Auth status fetch failed for ${session.sid}: ${authRes.status}`);
            }
          } catch (err) {
            console.error(`Failed to fetch auth status for ${session.sid}:`, err);
          }
          return session;
        })
      );
      
      console.log('Sessions with auth:', sessionsWithAuth);
      setSessions(sessionsWithAuth);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load sessions");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // Refresh every 5 seconds
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Load user settings
    fetch("/api/remote-browser/settings", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setCustomStartUrl(data.start_url || "");
        setCustomAllowlistHosts(data.allowlist_hosts || "");
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const openSession = (session: Session) => {
    // Use the iframeUrl from the session which includes the auth token
    window.open(session.iframeUrl, "_blank");
  };

  const deleteSession = async (sid: string) => {
    if (!confirm(`Delete session ${sid}?`)) return;
    
    try {
      const res = await fetch(`/api/remote-browser/sessions/${sid}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      fetchSessions();
    } catch (err) {
      console.error(err);
      alert("Failed to delete session");
    }
  };

  const deleteAllSessions = async () => {
    if (!confirm(`Delete ALL ${sessions.length} sessions? This cannot be undone!`)) return;
    
    try {
      const promises = sessions.map(session =>
        fetch(`/api/remote-browser/sessions/${session.sid}`, {
          method: "DELETE",
          credentials: "include",
        })
      );
      
      await Promise.all(promises);
      fetchSessions();
    } catch (err) {
      console.error(err);
      alert("Failed to delete some sessions");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 40,
      maxWidth: 1200,
      margin: "0 auto",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <h1 style={{ marginBottom: 30 }}>Browser Sessions Admin</h1>
      
      {/* Custom Session Settings */}
      <div style={{
        marginBottom: 30,
        padding: 20,
        backgroundColor: "#f8f9fa",
        borderRadius: 8,
        border: "1px solid #dee2e6"
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 15, fontSize: 18 }}>Default Session Settings</h2>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 15 }}>
          Configure the default start URL and allowed hosts for new browser sessions
        </p>
        
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: 500, fontSize: 14 }}>
            Start URL
          </label>
          <input
            type="text"
            value={customStartUrl}
            onChange={(e) => setCustomStartUrl(e.target.value)}
            placeholder="https://www.google.com"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ced4da",
              borderRadius: 4,
              fontSize: 14,
              fontFamily: "monospace"
            }}
          />
        </div>
        
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 5, fontWeight: 500, fontSize: 14 }}>
            Allowed Hosts (comma-separated)
          </label>
          <input
            type="text"
            value={customAllowlistHosts}
            onChange={(e) => setCustomAllowlistHosts(e.target.value)}
            placeholder="google.com,www.google.com"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ced4da",
              borderRadius: 4,
              fontSize: 14,
              fontFamily: "monospace"
            }}
          />
        </div>
        
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/remote-browser/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    start_url: customStartUrl || "https://www.google.com",
                    allowlist_hosts: customAllowlistHosts || "google.com,www.google.com"
                  }),
                  credentials: "include"
                });
                
                if (res.ok) {
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 3000);
                }
              } catch (err) {
                console.error("Failed to save settings:", err);
              }
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Save Settings
          </button>
          
          {settingsSaved && (
            <span style={{ color: "#28a745", fontSize: 14 }}>✓ Settings saved!</span>
          )}
        </div>
      </div>
      
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ color: "#666", margin: 0 }}>
          Total Sessions: {sessions.length}
        </p>
        {sessions.length > 0 && (
          <button
            onClick={deleteAllSessions}
            style={{
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Delete All Sessions
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p style={{ color: "#999" }}>No active sessions</p>
      ) : (
        <div style={{ 
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"
        }}>
          {sessions.map((session) => (
            <div
              key={session.sid}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 20,
                backgroundColor: "#f9f9f9"
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 14, color: "#333" }}>
                  Session ID:
                </strong>
                <div style={{ 
                  fontFamily: "monospace",
                  fontSize: 13,
                  marginTop: 4,
                  wordBreak: "break-all"
                }}>
                  {session.sid}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 14, color: "#333" }}>
                  User ID:
                </strong>
                <div style={{ 
                  fontFamily: "monospace",
                  fontSize: 13,
                  marginTop: 4,
                  wordBreak: "break-all"
                }}>
                  {session.user_id}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 14, color: "#333" }}>
                  Start URL:
                </strong>
                <div style={{ 
                  fontSize: 13,
                  marginTop: 4,
                  wordBreak: "break-all",
                  color: "#0066cc"
                }}>
                  {session.start_url}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 14, color: "#333" }}>
                  Allowed Hosts:
                </strong>
                <div style={{ 
                  fontSize: 13,
                  marginTop: 4,
                  wordBreak: "break-all"
                }}>
                  {session.allowlist_hosts}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: 14, color: "#333" }}>
                  Created:
                </strong>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {new Date(session.created_at).toLocaleString()}
                </div>
              </div>

              {/* Authentication Status */}
              {session.authStatus && (
                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Google Auth */}
                  <div style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      backgroundColor: session.authStatus.google.isAuthenticated ? "#d4edda" : "#f8d7da",
                      border: `1px solid ${session.authStatus.google.isAuthenticated ? "#c3e6cb" : "#f5c6cb"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                      <span style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: session.authStatus.google.isAuthenticated ? "#28a745" : "#dc3545"
                      }}>
                        {session.authStatus.google.isAuthenticated ? "✓" : "✗"}
                      </span>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        {session.authStatus.google.isAuthenticated ? (
                          <>
                            <strong style={{ color: "#155724" }}>Google Account</strong>
                            {session.authStatus.google.userEmail && (
                              <div style={{ color: "#155724", marginTop: 2, fontFamily: "monospace" }}>
                                {session.authStatus.google.userEmail}
                              </div>
                            )}
                            {session.authStatus.google.lastChecked && (
                              <div style={{ color: "#155724", marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                Connected since session creation
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ color: "#721c24" }}>Google Disconnected</span>
                            {session.authStatus.google.lastChecked && (
                              <div style={{ color: "#721c24", marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                Checked {new Date(session.authStatus.google.lastChecked).toLocaleTimeString()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  
                  {/* Microsoft Auth */}
                  <div style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      backgroundColor: session.authStatus.microsoft.isAuthenticated ? "#d4edda" : "#f8d7da",
                      border: `1px solid ${session.authStatus.microsoft.isAuthenticated ? "#c3e6cb" : "#f5c6cb"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                      <span style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: session.authStatus.microsoft.isAuthenticated ? "#28a745" : "#dc3545"
                      }}>
                        {session.authStatus.microsoft.isAuthenticated ? "✓" : "✗"}
                      </span>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        {session.authStatus.microsoft.isAuthenticated ? (
                          <>
                            <strong style={{ color: "#155724" }}>Microsoft Account</strong>
                            {session.authStatus.microsoft.userEmail && (
                              <div style={{ color: "#155724", marginTop: 2, fontFamily: "monospace" }}>
                                {session.authStatus.microsoft.userEmail}
                              </div>
                            )}
                            {session.authStatus.microsoft.lastChecked && (
                              <div style={{ color: "#155724", marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                Connected since session creation
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ color: "#721c24" }}>Microsoft Disconnected</span>
                            {session.authStatus.microsoft.lastChecked && (
                              <div style={{ color: "#721c24", marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                Checked {new Date(session.authStatus.microsoft.lastChecked).toLocaleTimeString()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  
                  {/* Facebook Auth */}
                  <div style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      backgroundColor: session.authStatus.facebook.isAuthenticated ? "#d4edda" : "#f8d7da",
                      border: `1px solid ${session.authStatus.facebook.isAuthenticated ? "#c3e6cb" : "#f5c6cb"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                      <span style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: session.authStatus.facebook.isAuthenticated ? "#28a745" : "#dc3545"
                      }}>
                        {session.authStatus.facebook.isAuthenticated ? "✓" : "✗"}
                      </span>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        {session.authStatus.facebook.isAuthenticated ? (
                          <>
                            <strong style={{ color: "#155724" }}>Facebook Account</strong>
                            {session.authStatus.facebook.userName && (
                              <div style={{ color: "#155724", marginTop: 2, fontFamily: "monospace" }}>
                                {session.authStatus.facebook.userName}
                              </div>
                            )}
                            {session.authStatus.facebook.lastChecked && (
                              <div style={{ color: "#155724", marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                Connected since session creation
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ color: "#721c24" }}>Facebook Disconnected</span>
                            {session.authStatus.facebook.lastChecked && (
                              <div style={{ color: "#721c24", marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                Checked {new Date(session.authStatus.facebook.lastChecked).toLocaleTimeString()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => openSession(session)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    backgroundColor: "#0066cc",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  Open Session
                </button>
                <button
                  onClick={() => deleteSession(session.sid)}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          button:hover {
            opacity: 0.9;
          }
        `
      }} />
    </div>
  );
}
