"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

interface Props {
  onClose?: () => void;
}

/**
 * Modal shown when an anonymous user hits the free search limit.
 * Offers Google sign-in or email/password sign-up / log-in.
 * After a successful upgrade the calling component should dismiss this modal;
 * the dashboard will remount automatically (key={user.uid} changes) and the
 * user's profile + trip data will carry over.
 */
export default function UpgradePrompt({ onClose }: Props) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      if (!msg.includes("popup-closed")) setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      if (msg.includes("email-already-in-use")) {
        setError("Account already exists — switch to Log in below.");
      } else if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("Invalid email or password.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2.5 text-sm rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] " +
    "bg-[#F8FAFB] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] " +
    "focus:outline-none focus:border-[#5B8BA0] transition-colors";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-xl w-full max-w-sm p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">✈️</div>
          <h2 className="text-base font-semibold text-[#2C3E50] dark:text-white">
            You&apos;ve used your 2 free searches
          </h2>
          <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] mt-1.5 leading-relaxed">
            Create a free account to keep searching — your travel profile and trips are saved automatically.
          </p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-lg text-sm font-medium hover:bg-[#F8FAFB] dark:hover:bg-[#2a3f52] transition-colors disabled:opacity-50 mb-4"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#E0E8ED] dark:bg-[#2a3f52]" />
          <span className="text-xs text-[#9BB0C1]">or</span>
          <div className="flex-1 h-px bg-[#E0E8ED] dark:bg-[#2a3f52]" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmail} className="space-y-2">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder={mode === "signup" ? "Password (6+ characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 6 : 1}
            className={inputCls}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#5B8BA0] text-white rounded-lg text-sm font-medium hover:bg-[#4A7A8F] transition-colors disabled:opacity-50"
          >
            {loading ? "…" : mode === "signup" ? "Create Free Account" : "Log In"}
          </button>
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-3">
          <button
            className="text-xs text-[#5B8BA0] hover:underline"
            onClick={() => { setMode((m) => (m === "signup" ? "login" : "signup")); setError(""); }}
          >
            {mode === "signup" ? "Already have an account? Log in" : "New here? Sign up free"}
          </button>
          {onClose && (
            <button className="text-xs text-[#9BB0C1] hover:text-[#6B8299] dark:hover:text-[#B8D4E3]" onClick={onClose}>
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
