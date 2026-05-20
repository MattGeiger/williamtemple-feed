import { ChevronRight } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import React from "react";

export function ButtonIconChevron(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="outline" size="icon" {...props}>
      <ChevronRight />
    </Button>
  );
}