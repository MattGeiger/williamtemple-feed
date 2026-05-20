import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle } from "@/components/ui/icons";
import { BuiltWithClaude } from "@/components/shared/built-with-claude";
import { APP_VERSION } from "@/config/app-version";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate a slight delay for better UX
    setTimeout(() => {
      const success = login(username, password);
      
      if (!success) {
        setError("The username or password you entered is incorrect. Please try again or contact the administrator at github.com/MattGeiger");
      }
      
      setIsLoading(false);
    }, 500);
  };

  return (
    <form 
      className={cn("flex flex-col gap-6", className)} 
      {...props} 
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">FEED System</h1>
        <p>Pre-Release Access</p>
        <p className="text-balance text-sm text-muted-foreground">
          Enter your credentials to access the user testing version
        </p>
      </div>
      
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex gap-2 items-center">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
        
        <div className="text-center text-xs text-muted-foreground mt-6 space-y-2">
          <p>Pre-Release Version {APP_VERSION}</p>
          <p className="mt-1">For authorized testing only</p>
          <BuiltWithClaude className="flex justify-center" />
        </div>
      </div>
    </form>
  );
}
