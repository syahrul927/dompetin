"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/server/better-auth/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Chrome } from "lucide-react";
import Link from "next/link";
import { useAnalytics } from "@/hooks/use-analytics";

/**
 * Login page - Google OAuth only
 * Redirects to /dashboard on success
 */
export default function LoginPage() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { trackEvent } = useAnalytics();

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      setIsLoading(true);
      trackEvent("login_initiated", { method: "google" });

      // Sign in with Google OAuth
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Gagal masuk dengan Google. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-lg">
        {/* Logo/Title */}
        <div className="mb-8 text-center">
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">
            Dompetin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kelola keuangan pribadi dengan mudah
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-[20px] bg-card p-5 shadow-sm">
          <h2 className="mb-6 text-[22px] font-bold text-foreground">Masuk</h2>

          {error && (
            <Alert variant="destructive" className="mb-4 rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Google Sign In Button */}
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              className="h-14 w-full rounded-2xl border-border bg-background hover:bg-muted-foreground active:scale-[0.97] transition-transform duration-150"
              disabled={isLoading}
              variant="outline"
            >
              <Chrome className="mr-2 h-5 w-5" />
              {isLoading ? "Memproses..." : "Masuk dengan Google"}
            </Button>

            {/* Info Text */}
            <p className="text-center text-xs text-muted-foreground">
              Dengan masuk, Anda menyetujui{" "}
              <Link href="/terms" className="underline">
                Syarat & Ketentuan
              </Link>{" "}
              dan{" "}
              <Link href="/privacy" className="underline">
                Kebijakan Privasi
              </Link>
            </p>
          </div>

          {/* Register Link - Redirect to home since no registration with Google only */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link
              href="/"
              className="font-semibold text-primary hover:underline"
            >
              Kembali ke Beranda
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
