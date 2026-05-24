// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { ChevronRight, Info } from "@/components/ui/icons"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import { APP_VERSION } from "@/config/app-version"
import { Github } from "lucide-react"
import templeConsultingIconUrl from "../../../../../docs/Temple_Icon_System.svg"

const aboutFacts = [
  { label: "Version", value: APP_VERSION },
  { label: "License", value: "AGPL-3.0-or-later" },
]

export function AboutCard() {
  return (
    <Card className="mx-auto max-w-xl rounded-lg">
      <CardContent className="flex flex-col items-center gap-6 p-8 text-center sm:p-10">
        <div className="space-y-4">
          <img
            src={templeConsultingIconUrl}
            alt="Temple Consulting logo"
            className="mx-auto h-28 w-28"
          />
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">FEED</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Food Equity & Efficient Delivery
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Food pantry management software for William Temple House.
            </p>
          </div>
        </div>

        <dl className="grid w-full max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
          <div className="contents">
            <dt className="text-right font-medium text-foreground">Made by</dt>
            <dd className="text-muted-foreground">
              <a
                href="https://www.geigertron.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Matt Geiger
              </a>
              {", "}
              <a
                href="https://templepdx.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Temple Consulting, LLC.
              </a>{" "}
              2025-2026
            </dd>
          </div>
          <div className="contents">
            <dt className="text-right font-medium text-foreground">Made for</dt>
            <dd className="text-muted-foreground">
              <a
                href="https://williamtemple.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                William Temple House
              </a>
            </dd>
          </div>
          <div className="contents">
            <dt className="text-right font-medium text-foreground">Made with</dt>
            <dd className="text-muted-foreground">
              React, TypeScript, Node.js, Express, Prisma, Tailwind CSS, and
              Claude Code
            </dd>
          </div>
          {aboutFacts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-right font-medium text-foreground">{fact.label}</dt>
              <dd className="text-muted-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <p className="max-w-md text-xs leading-5 text-muted-foreground">
          The application code is open source. William Temple House branding is
          not open source and may not be reused without separate permission.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="secondary">
            <a
              href="https://github.com/MattGeiger/williamtemple-feed"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              Source Code on GitHub
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

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
      <AboutCard />
    </div>
  )
}
