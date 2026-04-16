const ADMIN_ROLE_KEYWORDS = ["admin", "superuser", "staff", "manager", "root"] as const;

const USER_ACCESSIBLE_PATHS = ["/", "/portal", "/responses", "/login"] as const;

function matchesPath(pathname: string, basePath: string) {
  if (basePath === "/") {
    return pathname === "/";
  }

  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function isPrivilegedRole(role?: string | null) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.trim().toLowerCase();
  return ADMIN_ROLE_KEYWORDS.some((keyword) => normalizedRole.includes(keyword));
}

export function isPathAccessible(pathname: string, role?: string | null) {
  if (isPrivilegedRole(role)) {
    return true;
  }

  return USER_ACCESSIBLE_PATHS.some((basePath) => matchesPath(pathname, basePath));
}

export function getFallbackPath(role?: string | null, isAuthenticated = false) {
  if (isPrivilegedRole(role)) {
    return "/";
  }

  return isAuthenticated ? "/portal" : "/login";
}
