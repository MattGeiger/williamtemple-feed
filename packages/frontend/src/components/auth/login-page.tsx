import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, KeyRound } from "@/components/ui/icons";
import { MagicLinkTab } from "./magic-link-tab";
import { OTPTab } from "./otp-tab";
import { BuiltWithClaude } from "@/components/shared/built-with-claude";
import { APP_VERSION } from "@/config/app-version";

export function LoginPage() {
  const [activeTab, setActiveTab] = useState<"magic" | "otp">("otp");

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in to FEED System</CardTitle>
        <CardDescription>
          Staff access — use your @williamtemple.org email
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "magic" | "otp")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="otp">
              <KeyRound className="h-4 w-4" />
              Verification Code
            </TabsTrigger>
            <TabsTrigger value="magic">
              <Mail className="h-4 w-4" />
              Magic Link
            </TabsTrigger>
          </TabsList>

          <TabsContents className="mt-4 px-1 pb-1">
            <TabsContent value="magic">
              <MagicLinkTab />
            </TabsContent>

            <TabsContent value="otp">
              <OTPTab />
            </TabsContent>
          </TabsContents>
        </Tabs>

        <div className="text-center text-xs text-muted-foreground mt-6 space-y-2">
          <p>Pre-Release Version {APP_VERSION}</p>
          <p className="mt-1">For authorized testing only</p>
          <BuiltWithClaude className="flex justify-center" />
        </div>
      </CardContent>
    </Card>
  );
}
