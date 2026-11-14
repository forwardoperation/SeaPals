import { forwardRef } from "react";

const routes = { "/": "home", "/simulator": "play", "/instructions": "rules" };

export default forwardRef(function Link({ href, children, prefetch, replace, scroll, shallow, locale, ...props }, ref) {
  const pathname = typeof href === "object" ? href.pathname : String(href).split(/[?#]/)[0];
  const route = routes[pathname];
  // Store, analytics and other website-only destinations aren't app features.
  if (!route) return null;
  return <a ref={ref} href={`#${route}`} {...props}>{children}</a>;
});
