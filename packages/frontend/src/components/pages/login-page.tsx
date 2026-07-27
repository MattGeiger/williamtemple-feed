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
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 px-4 py-10 dark:from-gray-950 dark:to-gray-900">
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        <div className="space-y-5 text-center">
          <img
            src={wthLogoHorizontal}
            alt="William Temple House Logo"
            className="mx-auto h-auto w-72 max-w-full object-contain dark:brightness-[0.9]"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Food Equity & Efficient Delivery
            </h1>
          </div>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
