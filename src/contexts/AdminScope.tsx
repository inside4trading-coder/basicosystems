import { createContext, useContext, ReactNode } from "react";

export type AdminScope = "global" | "sublime";

export interface AdminScopeTables {
  scope: AdminScope;
  obligations: string;
  instances: string;
  audit: string;
  config: string;
  view: string;
  storagePrefix: string;
  basePath: string;
  title: string;
  subtitle: string;
}

const GLOBAL: AdminScopeTables = {
  scope: "global",
  obligations: "admin_obligations",
  instances: "admin_instances",
  audit: "admin_audit_log",
  config: "admin_config",
  view: "admin_instances_view",
  storagePrefix: "",
  basePath: "/administracion",
  title: "Administración",
  subtitle: "Control de obligaciones fijas y recurrentes de la empresa",
};

const SUBLIME: AdminScopeTables = {
  scope: "sublime",
  obligations: "sublime_admin_obligations",
  instances: "sublime_admin_instances",
  audit: "sublime_admin_audit_log",
  config: "sublime_admin_config",
  view: "sublime_admin_instances_view",
  storagePrefix: "sublime/",
  basePath: "/sublime/admin/obligaciones",
  title: "Administración · Sublime",
  subtitle: "Obligaciones fijas y recurrentes de la tienda Sublime",
};

const Ctx = createContext<AdminScopeTables>(GLOBAL);

export const useAdminScope = () => useContext(Ctx);

export function AdminScopeProvider({
  scope,
  children,
}: {
  scope: AdminScope;
  children: ReactNode;
}) {
  return <Ctx.Provider value={scope === "sublime" ? SUBLIME : GLOBAL}>{children}</Ctx.Provider>;
}
