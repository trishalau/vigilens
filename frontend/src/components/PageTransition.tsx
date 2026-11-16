import { ViewTransition } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ViewTransition key={pathname} enter="page-fade-in" exit="page-fade-out" default="none">
      {children}
    </ViewTransition>
  );
}
