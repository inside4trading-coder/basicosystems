import { useAuth } from "@/hooks/useAuth";

export type RRPPRole = "admin" | "rrpp" | "marketing" | "limited" | "other";

export interface RRPPPermissions {
  role: RRPPRole;
  canViewAllTabs: boolean;
  canViewPrivateNotes: boolean;
  canEditGeneral: boolean;
  canManageSocial: boolean;
  canChangeStatus: boolean;
  canAddInteraction: boolean;
  canManageCollaborations: boolean;
  canAddPrivateNote: boolean;
  canDeletePrivateNote: boolean;
  canArchive: boolean;
  canDeleteContact: boolean;
}

/**
 * Maps the auth role to RRPP-scoped permissions.
 * - admin: full access
 * - rrpp / marketing: all tabs except cannot delete contacts
 * - limited: only Pipeline (status) + Interactions (add). No private notes.
 * - other: no access (route guard should redirect)
 */
export function useRRPPPermissions(): RRPPPermissions {
  const { role } = useAuth();
  const r = (role as string) ?? "";
  const rrppRole: RRPPRole =
    r === "admin" ? "admin"
    : r === "rrpp" ? "rrpp"
    : r === "marketing" ? "marketing"
    : r === "limited" ? "limited"
    : "other";

  const isAdmin = rrppRole === "admin";
  const isTeam = isAdmin || rrppRole === "rrpp" || rrppRole === "marketing";
  const isLimited = rrppRole === "limited";

  return {
    role: rrppRole,
    canViewAllTabs: isTeam,
    canViewPrivateNotes: isAdmin || rrppRole === "rrpp",
    canEditGeneral: isTeam,
    canManageSocial: isTeam,
    canChangeStatus: isTeam || isLimited,
    canAddInteraction: isTeam || isLimited,
    canManageCollaborations: isTeam,
    canAddPrivateNote: isAdmin || rrppRole === "rrpp",
    canDeletePrivateNote: isAdmin,
    canArchive: isTeam,
    canDeleteContact: isTeam,
  };
}
