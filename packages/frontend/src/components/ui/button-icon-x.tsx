import { X } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import React from "react";

export function ButtonIconX(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="ghost" size="sm" {...props}>
      <X className="h-4 w-4" />
    </Button>
  );
}