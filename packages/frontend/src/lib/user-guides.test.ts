// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { describe, expect, it } from "vitest"

import {
  buildUserGuidesFromModules,
  getGuideToc,
  getHelpSearchIndex,
  rewriteGuideLink,
} from "./user-guides"

describe("user guide parsing", () => {
  it("orders guides by filename prefix and extracts metadata", () => {
    const guides = buildUserGuidesFromModules({
      "../../../../docs/user-guides/02-dashboard-alerts.md": "# Dashboard\n\nShort summary.",
      "../../../../docs/user-guides/01-getting-started.md": "# Getting Started\n\nWelcome text.",
      "../../../../docs/user-guides/screenshot-plan.md": "# Ignored\n\nNot a numbered guide.",
    })

    expect(guides.map((guide) => guide.slug)).toEqual([
      "getting-started",
      "dashboard-alerts",
    ])
    expect(guides[0]).toMatchObject({
      filename: "01-getting-started.md",
      title: "Getting Started",
      description: "Welcome text.",
      order: 1,
    })
  })

  it("creates stable heading ids and ignores fenced headings", () => {
    const toc = getGuideToc(`# Guide

## Setup
### API Keys
## Setup

\`\`\`md
## Ignored
\`\`\`

### API Keys
`)

    expect(toc.map((item) => ({ id: item.id, title: item.title, depth: item.depth }))).toEqual([
      { id: "setup", title: "Setup", depth: 2 },
      { id: "api-keys", title: "API Keys", depth: 3 },
      { id: "setup-1", title: "Setup", depth: 2 },
      { id: "api-keys-1", title: "API Keys", depth: 3 },
    ])
  })

  it("rewrites relative guide links to help routes and preserves hashes", () => {
    expect(rewriteGuideLink("03-inventory.md")).toBe("/help/inventory")
    expect(rewriteGuideLink("03-inventory.md#food-items")).toBe(
      "/help/inventory#food-items"
    )
    expect(rewriteGuideLink("https://example.com/03-inventory.md")).toBe(
      "https://example.com/03-inventory.md"
    )
    expect(rewriteGuideLink("#local-section")).toBe("#local-section")
  })

  it("builds section-level search entries from the real guides", () => {
    const index = getHelpSearchIndex()
    const entry = index.find(
      (item) =>
        item.guideSlug === "shopping-list-builder" &&
        item.sectionTitle === "Translation Settings"
    )

    expect(entry).toBeTruthy()
    expect(entry?.sectionId).toBe("translation-settings")
    expect(entry?.content).toMatch(/translated text/i)
  })
})
