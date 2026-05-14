"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("Invalid email or password");
      } else {
        setError(msg);
      }
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB] dark:bg-[#0f1923] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-lg font-bold tracking-tight text-[#2C3E50] dark:text-white">
            ViyaWay
          </Link>
          <p className="text-sm text-[#6B8299] mt-1">Log in to your account</p>
        </div>

        <div className="bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#2a3f52] rounded-xl p-6">
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-lg text-sm font-medium hover:bg-[#F8FAFB] dark:hover:bg-[#2a3f52] transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#E0E8ED] dark:bg-[#2a3f52]" />
            <span className="text-xs text-[#9BB0C1]">or</span>
            <div className="flex-1 h-px bg-[#E0E8ED] dark:bg-[#2a3f52]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] bg-[#F8FAFB] dark:bg-[#2a3f52] focus:outline-none focus:border-[#5B8BA0] transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] bg-[#F8FAFB] dark:bg-[#2a3f52] focus:outline-none focus:border-[#5B8BA0] transition-colors"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#5B8BA0] text-white rounded-lg text-sm font-medium hover:bg-[#4A7A8F] transition-colors disabled:opacity-50"
            >
              {loading ? "Logging in…" : "Log In"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6B8299] mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#5B8BA0] hover:text-[#5B8BA0] font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
