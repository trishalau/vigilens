import { startTransition } from "react";
import type { MouseEvent } from "react";
import { addTransitionType } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { ComponentProps } from "react";

type LinkDestination = ComponentProps<typeof Link>["to"];

function beginRouteTransition(event: MouseEvent<HTMLAnchorElement>, navigate: ReturnType<typeof useNavigate>, to: LinkDestination) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.target === "_blank"
  ) return;

  event.preventDefault();
  startTransition(() => {
    addTransitionType("nav-lateral");
    navigate(to);
  });
}

type TransitionLinkProps = ComponentProps<typeof Link>;

export function TransitionLink({ onClick, to, ...props }: TransitionLinkProps) {
  const navigate = useNavigate();
  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        beginRouteTransition(event, navigate, to);
      }}
    />
  );
}

type TransitionNavLinkProps = ComponentProps<typeof NavLink>;

export function TransitionNavLink({ onClick, to, ...props }: TransitionNavLinkProps) {
  const navigate = useNavigate();
  return (
    <NavLink
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        beginRouteTransition(event, navigate, to);
      }}
    />
  );
}
