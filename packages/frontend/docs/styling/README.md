# Theme and Styling Documentation

This document outlines the styling system used in the FEED application.

## Table of Contents

- [Overview](#overview)
- [Theme System](#theme-system)
- [Tailwind CSS](#tailwind-css)
- [Color System](#color-system)
- [Component Styling](#component-styling)
- [Responsive Design](#responsive-design)
- [Dark Mode](#dark-mode)
- [Best Practices](#best-practices)
  - [Form Control Fill](#form-control-fill)

## Overview

The FEED application uses a combination of:
- Tailwind CSS for utility-based styling
- CSS variables for theme values
- Shadcn UI for component styling
- CSS modules for complex component styles
- Built-in dark mode support

## Theme System

### Theme Provider

The application uses `next-themes` for theme management:

```tsx
// src/components/theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

### Theme Switching

A theme switcher component allows users to toggle between light, dark, and system themes:

```tsx
// src/components/theme-switcher.tsx
import { useTheme } from "next-themes";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost">{/* Icon */}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Tailwind CSS

### Configuration

The application uses a customized Tailwind configuration:

```js
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Other theme extensions...
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### Utility Classes

The application uses Tailwind utility classes for most styling:

```tsx
<button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
  Click Me
</button>
```

## Branding and Color System

The application's color schemes are based on William Temple House's branding, matching their logo and website colors. Colors are defined as CSS variables in `src/index.css` and used throughout the application for consistency.

### Color Variables

The color system is implemented through CSS variables with HSL values:

```css
/* Light mode */
:root {
  /* Core brand colors */
  --background: 211 100% 100%;
  --foreground: 211 5% 10%;
  --primary: 211 60% 40%;      /* William Temple House blue */
  --primary-foreground: 0 0% 100%;
  
  /* Secondary palette */
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --accent: 173 30% 90%;       /* Teal accent */
  --accent-foreground: 211 5% 15%;
  
  /* Status colors */
  --color-inStock: hsl(141, 53%, 53%);
  --color-limited: hsl(39, 100%, 50%);
  --color-clearance: hsl(3, 87%, 63%);
  --color-outOfStock: hsl(0, 0%, 50%);
}

/* Dark mode */
.dark {
  --background: 222 50% 0%;
  --foreground: 222 5% 100%;
  --primary: 49 100% 65%;      /* William Temple House gold */
  --primary-foreground: 211 60% 40%;
  
  /* Status colors (dark mode variants) */
  --color-inStock: hsl(141, 53%, 40%);
  --color-limited: hsl(39, 100%, 45%);
  --color-clearance: hsl(3, 87%, 55%);
  --color-outOfStock: hsl(0, 0%, 50%);
}
```

### William Temple House Theme

The color theme is based on William Temple House's brand colors:
- **Light mode**: Blue primary color with white background
- **Dark mode**: Gold primary color with dark background

Status colors remain consistent with their meaning across both themes but are adjusted for appropriate contrast.

### Customization for Other Organizations

To rebrand the application for another organization:

1. Modify the CSS variables in `src/index.css`
2. Focus on these key variables:
   - `--primary`: Main brand color
   - `--accent`: Secondary brand color
   - `--background`/`--foreground`: Base colors
3. Ensure proper contrast in both light and dark modes
4. Update the favicon and logos in the `public` directory

All themed components will automatically reflect the new color scheme in both light and dark modes due to the centralized variable system.

### Chart Colors

Colors for charts and visualizations:

```typescript
// src/lib/chart-colors.ts
export const chartColors = {
  inStock: 'hsl(var(--color-inStock))',
  limited: 'hsl(var(--color-limited))',
  clearance: 'hsl(var(--color-clearance))',
  outOfStock: 'hsl(var(--color-outOfStock))',
  
  // Chart series colors
  series: [
    'hsl(221.2 83.2% 53.3%)',
    'hsl(262.1 83.3% 57.8%)',
    'hsl(316.6 73.5% 52.5%)',
    'hsl(354.3 70.5% 53.5%)',
    'hsl(24.6 95% 53.1%)',
    'hsl(38 92.7% 50.6%)',
    'hsl(142.1 76.2% 36.3%)',
    'hsl(176.2 87.6% 44.1%)',
  ]
};
```

## Component Styling

### Component Variants

The application uses the `cva` (Class Variance Authority) library for component variants:

```tsx
// src/components/ui/button.tsx
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

### Custom Component Styling

For components with complex styling needs, a mix of Tailwind and CSS modules is used:

```tsx
// MyComponent.module.css
.container {
  position: relative;
  overflow: hidden;
}

.animated {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

// MyComponent.tsx
import styles from './MyComponent.module.css';
import { cn } from '@/lib/utils';

export function MyComponent({ className, animated, ...props }) {
  return (
    <div
      className={cn(
        styles.container,
        animated && styles.animated,
        'p-4 bg-background rounded-lg shadow-sm',
        className
      )}
      {...props}
    >
      {/* Component content */}
    </div>
  );
}
```

## Responsive Design

### Breakpoints

The application uses standard Tailwind breakpoints:

```css
/* Tailwind default breakpoints */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### Responsive Components

Components adapt to different screen sizes:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <Card key={item.id} className="p-4">
      {/* Card content */}
    </Card>
  ))}
</div>
```

### Media Query Hook

For complex responsive logic, the application uses a custom `useMediaQuery` hook:

```tsx
import { useMediaQuery } from '@/hooks/use-media-query';

function ResponsiveComponent() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <div>
      {isMobile ? (
        <MobileLayout />
      ) : (
        <DesktopLayout />
      )}
    </div>
  );
}
```

## Dark Mode

### Implementation

Dark mode is implemented using:
- `next-themes` for theme switching
- Tailwind's `dark:` modifier for dark-specific styles
- CSS variables for theme-aware colors
- A View Transitions reveal in `src/lib/theme-transition.ts`, with reduced-motion fallback

### Usage

```tsx
<div className="bg-background text-foreground dark:bg-slate-900 dark:text-slate-50">
  <h1 className="text-2xl font-bold">Title</h1>
  <p className="text-muted-foreground dark:text-slate-400">
    This text adapts to dark mode
  </p>
</div>
```

### Context-Aware Components

Components check the current theme:

```tsx
import { useTheme } from 'next-themes';

function ThemedIcon() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return <Icon color={isDark ? '#ffffff' : '#000000'} />;
}
```

## Best Practices

### App Shell Surfaces

Authenticated app screens use centralized shell atmosphere tokens in `src/index.css`.
The fixed backdrop is owned by `RootLayout`, and reusable surface treatments are opt-in:

```tsx
<Card data-feed-card-surface="soft" data-feed-card-interactive="true">
  ...
</Card>
```

Use these treatments for dashboard/status/configuration cards where subtle elevation helps scanning. Do not apply them to dense data tables, dialogs nested inside other cards, or Shopping List Builder printable surfaces. Print and PDF preview areas must remain flat and theme-independent.

### Form Control Fill

**Every text-entry and select control carries a solid fill.** `Input`,
`Textarea`, and `SelectTrigger` default to `bg-background` in
`src/components/ui/`. They previously defaulted to `bg-transparent`, which let
whatever sat behind them — the app-shell atmosphere gradient, a `Card`, a
tinted panel — show through, so the same filter field read as a different
colour on every page and had almost no edge contrast against the shell.

The fill is a **primitive default, not a call-site class.** Do not write
`bg-background` on an `<Input>`, `<Textarea>`, or `<SelectTrigger>` — it is
already there, and a redundant override is one more place the standard can
drift. Two such overrides existed (Operating Hours time inputs, the shared date
range control) and were removed when the default landed.

Deviations are deliberate and rare. `bg-muted` marks a field that is populated
but not editable (AI Configuration's Service and API Key review steps). Do not
introduce a transparent form control; if a surface makes the standard fill look
wrong, fix the surface.

Reference appearance: the `Columns` dropdown trigger in any
`EnhancedDataTable` feature bar, and the Operating Hours time inputs in
Settings. A filter or search field sitting beside the `Columns` button should be
indistinguishable from it in fill.

### Consistent Color Usage

Use semantic color variables instead of hardcoded values:

```tsx
// Bad
<div className="text-blue-500">Blue text</div>

// Good
<div className="text-primary">Primary text</div>
```

### Component Composition

Build complex UIs through component composition:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Responsive Design Guidelines

1. Design for mobile first
2. Use responsive utility classes
3. Test all components on multiple screen sizes
4. Use Grid and Flexbox for layout
5. Consider touch targets on mobile (min 44px)

### Class Name Organization

Follow a consistent order for class names:

1. Layout (position, display, width, height)
2. Spacing (margin, padding)
3. Typography (font, text)
4. Visual (colors, borders, shadows)
5. Interactivity (hover, focus, active)
6. Media queries (responsive classes)

```tsx
<div className="
  absolute top-0 left-0 w-full h-12
  px-4 py-2
  text-sm font-medium
  bg-primary text-white rounded-md shadow-sm
  hover:bg-primary/90 focus:outline-none focus:ring-2
  md:relative md:w-auto
">
  Button
</div>
```

### Theme Toggle Best Practices

- Remember user preferences with localStorage
- Respect system preferences by default
- Provide visual feedback when changing themes
- Ensure all components support both themes
- Test color contrast in both modes
