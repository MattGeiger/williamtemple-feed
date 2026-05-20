// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { type ChartConfig } from "@/components/ui/chart"

export type ColorScheme = 'light' | 'dark';
export type StatusColor = 'success' | 'warning' | 'error' | 'info';

const baseColors = {
  blue: {
    light: 'hsl(217, 91%, 60%)',
    dark: 'hsl(217, 91%, 65%)'
  },
  green: {
    light: 'hsl(142, 71%, 45%)',
    dark: 'hsl(142, 71%, 50%)'
  },
  pink: {
    light: 'hsl(335, 78%, 42%)',
    dark: 'hsl(335, 78%, 47%)'
  },
  orange: {
    light: 'hsl(29, 84%, 52%)',
    dark: 'hsl(29, 84%, 57%)'
  },
  purple: {
    light: 'hsl(262, 83%, 58%)',
    dark: 'hsl(262, 83%, 63%)'
  },
  cyan: {
    light: 'hsl(186, 94%, 41%)',
    dark: 'hsl(186, 94%, 46%)'
  }
} as const;

export const chartColors = {
  category: {
    light: [
      baseColors.blue.light,
      baseColors.green.light,
      baseColors.pink.light,
      baseColors.orange.light,
      baseColors.purple.light,
      baseColors.cyan.light,
    ],
    dark: [
      baseColors.blue.dark,
      baseColors.green.dark,
      baseColors.pink.dark,
      baseColors.orange.dark,
      baseColors.purple.dark,
      baseColors.cyan.dark,
    ]
  },
  status: {
    light: {
      success: baseColors.green.light,
      warning: 'hsl(38, 92%, 50%)',
      error: 'hsl(346, 87%, 47%)',
      info: baseColors.blue.light,
    },
    dark: {
      success: baseColors.green.dark,
      warning: 'hsl(38, 92%, 55%)',
      error: 'hsl(346, 87%, 52%)',
      info: baseColors.blue.dark,
    }
  }
} as const;

export function getChartColor(index: number, scheme: ColorScheme = 'light'): string {
  return chartColors.category[scheme][index % chartColors.category[scheme].length];
}

export function getChartStatusColor(status: StatusColor, scheme: ColorScheme = 'light'): string {
  return chartColors.status[scheme][status];
}

export const chartConfigPresets = {
  categoryChart: {
    items: {
      label: "Items",
      theme: {
        light: baseColors.blue.light,
        dark: baseColors.blue.dark
      }
    },
    label: {
      theme: {
        light: 'hsl(var(--background))',
        dark: 'hsl(var(--background))'
      }
    },
    categoryLabel: {
      theme: {
        light: 'hsl(var(--background))',
        dark: 'hsl(var(--background))'
      }
    }
  } satisfies ChartConfig,
  
  inventoryChart: {
    items: {
      label: "Items",
    },
    inStock: {
      label: "In Stock",
      theme: {
        light: baseColors.green.light,
        dark: baseColors.green.dark
      }
    },
    limited: {
      label: "Limited",
      theme: {
        light: baseColors.orange.light,
        dark: baseColors.orange.dark
      }
    },
    clearance: {
      label: "Clearance",
      theme: {
        light: baseColors.pink.light,
        dark: baseColors.pink.dark
      }
    },
  } satisfies ChartConfig
} as const;