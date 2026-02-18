"use client";

import { ReactNode } from "react";

interface SafeAreaProps {
  children: ReactNode;
  className?: string;
}

export function SafeArea({ children, className }: SafeAreaProps) {
  return <div className={className}>{children}</div>;
}

