// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { useAuth } from "@/contexts/AuthContext";
import { LoginPage as LoginForm } from "@/components/auth/login-page";
import { Navigate } from "react-router-dom";
import wthLogoHorizontal from "@/assets/WTH_Logo_Horizontal.png";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Avoid redirect loops while session status is loading
  if (isLoading) {
    return null;
  }
  
  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <div className="flex items-center gap-2 font-medium">
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-blue-950">
          <img
            src={wthLogoHorizontal}
            alt="William Temple House Logo"
            className="max-w-[60%] object-contain p-8 dark:brightness-[0.9]"
          />
          <div className="mt-8 max-w-md p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold">Food Equity & Efficient Delivery</h2>
            <p className="text-balance text-muted-foreground">
              A comprehensive food pantry management system designed for
              William Temple House's operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
