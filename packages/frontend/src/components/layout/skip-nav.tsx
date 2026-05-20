import React from 'react';

export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-4 focus:left-4
        focus:z-50
        focus:px-4 focus:py-2
        focus:bg-background
        focus:border-2 focus:border-ring
        focus:rounded-md
        focus:outline-none
        focus:shadow-lg
      "
    >
      Skip to main content
    </a>
  );
}