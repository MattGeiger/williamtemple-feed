// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Info, Package, Globe2, Settings } from "@/components/ui/icons";
import type { ComponentType } from 'react';
import {
  AdminNavIcon,
  AIConfigurationNavIcon,
  AnalyticsNavIcon,
  CategoriesNavIcon,
  DashboardNavIcon,
  DocumentTranslatorNavIcon,
  FoodItemsNavIcon,
  ReportsNavIcon,
  HelpNavIcon,
  SettingsNavIcon,
  DataManagementNavIcon,
  LanguagesNavIcon,
  ShoppingListsNavIcon,
  ServiceLogNavIcon,
  ServiceNavIcon,
  TranslationsNavIcon,
} from './animated-nav-icons';

export interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{
    className?: string;
    'aria-hidden'?: boolean | 'true' | 'false';
  }>;
  items?: NavItem[];
  isActive?: boolean;
  isFuture?: boolean;  // For planned features
  /**
   * Shown only to administrators. Presentation only — the server enforces
   * authority on every privileged route independently, and an omitted menu
   * item is not a security boundary.
   */
  adminOnly?: boolean;
}

export const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: DashboardNavIcon,
  },
  {
    title: "Inventory",
    href: "#",
    icon: Package,
    items: [
      {
        title: "Categories",
        href: "/categories",
        icon: CategoriesNavIcon,
      },
      {
        title: "Food Items",
        href: "/food-items",
        icon: FoodItemsNavIcon,
      },
      {
        title: "Analytics",
        href: "/analytics",
        icon: AnalyticsNavIcon,
      }
    ]
  },
  {
    title: "Language & Translation",
    href: "#",
    icon: Globe2,
    items: [
      {
        title: "Languages",
        href: "/languages",
        icon: LanguagesNavIcon
      },
      {
        title: "Translations",
        href: "/translations",
        icon: TranslationsNavIcon
      }
    ]
  },
  {
    title: "Service",
    href: "#",
    icon: ServiceNavIcon,
    items: [
      {
        title: "Service Log",
        href: "/service-log",
        icon: ServiceLogNavIcon,
      },
    ],
  },
  {
    title: "Tools",
    href: "#",
    icon: Settings,
    items: [
      {
        title: "Shopping Lists",
        href: "/shopping-lists",
        icon: ShoppingListsNavIcon
      },
      {
        title: "Document Translator",
        href: "/document-translator",
        icon: DocumentTranslatorNavIcon
      },
      {
        title: "AI Configuration",
        href: "/ai-configuration",
        icon: AIConfigurationNavIcon
      }
    ]
  },
  {
    title: "Information",
    href: "#",
    icon: Info,
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: SettingsNavIcon,
      },
      {
        title: "Data",
        href: "/data-management",
        icon: DataManagementNavIcon,
      },
      {
        title: "Reports",
        href: "/reports",
        icon: ReportsNavIcon,
      },
      {
        title: "Admin",
        href: "/admin",
        icon: AdminNavIcon,
        adminOnly: true,
      },
      {
        title: "Help",
        href: "/help",
        icon: HelpNavIcon,
      }
    ]
  }
];
