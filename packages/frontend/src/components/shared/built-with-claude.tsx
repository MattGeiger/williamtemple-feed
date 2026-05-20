import React from 'react';

interface BuiltWithClaudeProps {
  className?: string;
}

export function BuiltWithClaude({ className = '' }: BuiltWithClaudeProps) {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      <a 
        href="https://www.anthropic.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="built-with-claude hover:text-foreground transition-colors duration-200 no-underline"
      >
        Built With Claude
      </a>
    </div>
  );
}
