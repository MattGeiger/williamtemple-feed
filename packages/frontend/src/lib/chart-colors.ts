import { type ChartConfig } from "@/components/ui/chart"

export const chartPresets = {
  primary: {
    theme: {
      light: 'hsl(var(--chart-primary))',
      dark: 'hsl(var(--chart-primary))'
    }
  },
  success: {
    theme: {
      light: 'hsl(var(--chart-success))',
      dark: 'hsl(var(--chart-success))'
    }
  },
  warning: {
    theme: {
      light: 'hsl(var(--chart-warning))',
      dark: 'hsl(var(--chart-warning))'
    }
  },
  danger: {
    theme: {
      light: 'hsl(var(--chart-danger))',
      dark: 'hsl(var(--chart-danger))'
    }
  },
  info: {
    theme: {
      light: 'hsl(var(--chart-info))',
      dark: 'hsl(var(--chart-info))'
    }
  },
  muted: {
    theme: {
      light: 'hsl(var(--chart-muted))',
      dark: 'hsl(var(--chart-muted))'
    }
  }
} as const;

export const chartConfigs = {
  base: {
    label: {
      theme: {
        light: 'hsl(var(--foreground))',
        dark: 'hsl(var(--foreground))'
      }
    }
  },
  success: {
    ...chartPresets.success,
    label: "Success"
  },
  warning: {
    ...chartPresets.warning,
    label: "Warning"
  },
  danger: {
    ...chartPresets.danger,
    label: "Danger"
  },
  info: {
    ...chartPresets.info,
    label: "Info"
  }
} satisfies Record<string, ChartConfig>;

export type ChartColorPreset = keyof typeof chartPresets;
export type ChartConfigPreset = keyof typeof chartConfigs;