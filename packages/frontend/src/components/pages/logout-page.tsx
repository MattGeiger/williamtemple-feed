import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/card";
import { BuiltWithClaude } from "@/components/shared/built-with-claude";
import { APP_VERSION } from "@/config/app-version";

export default function LogoutPage() {
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
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-2 font-medium">
              <span className="text-xl font-semibold">FEED System</span>
            </div>
            
            <div className="rounded-full bg-muted p-6">
              <LogOut className="h-12 w-12 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">You've been logged out</h1>
              <p className="text-muted-foreground">Thank you for using the FEED system.</p>
            </div>
            
            <div className="rounded-md bg-muted px-4 py-3 text-sm">
              Redirecting to login page in <span className="font-bold">{redirectCounter}</span> seconds...
            </div>
            
            <div className="text-center text-xs text-muted-foreground mt-6 space-y-2">
              <p>Pre-Release Version {APP_VERSION}</p>
              <p className="mt-1">For authorized testing only</p>
              <BuiltWithClaude className="flex justify-center" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
