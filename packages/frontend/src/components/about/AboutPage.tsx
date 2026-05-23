// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { ChevronRight, Info } from "@/components/ui/icons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import { APP_VERSION } from "@/config/app-version"

export function AboutPage() {
  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <div className="w-full min-w-0">
        <SectionHeader
          icon={Info}
          title="About FEED"
          description="A brief note about the project, its source, and its license."
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl">FEED System</CardTitle>
          <CardDescription>Food Equity & Efficient Delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-foreground/90">
          <p>
            FEED is a food pantry management system built for William Temple House.
            It helps staff manage inventory, translate client materials, and create
            printable shopping lists from current pantry data.
          </p>
          <p>
            FEED was created by Temple Consulting, LLC. The William Temple House
            production deployment is branded for William Temple House.
          </p>
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Version
              </div>
              <div className="mt-1 font-medium">{APP_VERSION}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                License
              </div>
              <div className="mt-1 font-medium">AGPL-3.0-or-later</div>
            </div>
          </div>
          <p className="text-muted-foreground">
            The application code is open source. The William Temple House name,
            logo, visual identity, and other branding assets are not open source
            and may not be reused without separate permission.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <a
                href="https://github.com/MattGeiger/williamtemple-feed"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source Code
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a
                href="https://templepdx.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Temple Consulting
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
