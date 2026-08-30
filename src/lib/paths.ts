export function appPath(path = ""): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}
