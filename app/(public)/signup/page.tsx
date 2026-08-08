"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.5-6.5C35.2 2.7 30 0.5 24 0.5 14.6 0.5 6.5 5.9 2.6 13.9l7.6 5.9C12.1 13.5 17.5 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.6c4.3-4 6.8-9.8 6.8-17.1z"/>
      <path fill="#FBBC05" d="M10.2 19.8a14.4 14.4 0 0 0 0 8.4l-7.6 5.9a24 24 0 0 1 0-20.2z"/>
      <path fill="#34A853" d="M24 47.5c6 0 11.2-2 14.9-5.3l-7.3-5.6c-2 1.4-4.6 2.2-7.6 2.2-6.5 0-12-4.4-14-10.3l-7.6 5.9C6.5 42.1 14.6 47.5 24 47.5z"/>
    </svg>
  );
}

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await signUp(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg.includes("email-already-in-use") ? "An account with this email already exists" : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      if (!msg.includes("popup-closed")) setError(msg);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F5", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#FAF8F5", border: "1px solid #E8E8E8", borderRadius: 12, padding: "56px 48px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

        <div style={{ fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif", fontWeight: 400, fontSize: 29, color: "#2C3E50", lineHeight: 1.3 }}>
          Travel that fits who you are.
        </div>

        <button
          onClick={handleGoogle}
          style={{ border: "1px solid #E8E8E8", borderRadius: 4, padding: "13px 16px", fontSize: 15, color: "#1A1A1A", fontWeight: 600, width: "100%", marginTop: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#FFFFFF", cursor: "pointer" }}
        >
          <GoogleIcon /><span>Continue with Google</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 26 }}>
          <div style={{ flex: 1, height: 1, background: "#E8E8E8" }} />
          <span style={{ fontSize: 13, color: "#aaaaaa" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#E8E8E8" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 320 }}>
          <input
            type="email" placeholder="Email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            style={{ border: "1px solid #E8E8E8", borderRadius: 4, padding: "13px 16px", fontSize: 15, color: "#1A1A1A", width: "100%", marginTop: 14, boxSizing: "border-box", outline: "none" }}
          />
          <input
            type="password" placeholder="Password (6+ characters)" value={password} required minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            style={{ border: "1px solid #E8E8E8", borderRadius: 4, padding: "13px 16px", fontSize: 15, color: "#1A1A1A", width: "100%", marginTop: 10, boxSizing: "border-box", outline: "none" }}
          />
          {error && <p style={{ fontSize: 13, color: "#B5654A", marginTop: 8, textAlign: "left" }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            style={{ background: "#2C3E50", color: "#fff", textAlign: "center", fontSize: 15, fontWeight: 600, padding: 14, borderRadius: 999, marginTop: 14, width: "100%", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Creating account…" : "Continue →"}
          </button>
        </form>

        <div style={{ fontSize: 13, color: "#3D5A73", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ textDecoration: "underline", color: "#3D5A73" }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
