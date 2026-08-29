// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/card";
import { AuthAttribution } from "@/components/auth/auth-attribution";
import { BrandLogo } from "@/components/brand-logo";
import { useBrand } from "@/contexts/BrandContext";

export default function LogoutPage() {
  const brand = useBrand();
  const { logout } = useAuth();
  const [redirectCounter, setRedirectCounter] = useState(5);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  useEffect(() => {
    // Perform logout action
    logout();
    
    // Start countdown for redirection
    const timer = setInterval(() => {
      setRedirectCounter((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShouldRedirect(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Clean up on unmount
    return () => clearInterval(timer);
  }, [logout]);
  
  // Redirect to login page after countdown
  if (shouldRedirect) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-8 bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      {/* Same treatment as the sign-in and magic-link surfaces: the mark sits
          above the card, so the card no longer repeats the app's name. */}
      <BrandLogo className="h-auto w-64" />
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="rounded-full bg-muted p-6">
              <LogOut className="h-12 w-12 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">You've been logged out</h1>
              <p className="text-muted-foreground">Thank you for using {brand.identity.appName}.</p>
            </div>
            
            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              Redirecting to login page in <span className="font-bold">{redirectCounter}</span> seconds...
            </div>
            
            <AuthAttribution className="mt-6" showSourceLink={false} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
