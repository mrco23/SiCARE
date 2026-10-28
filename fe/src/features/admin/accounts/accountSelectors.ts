import type { Account, Role } from "../../../data/mock/adminAccounts";

export type AdminAccountTab = "Semua" | "Konselor" | "Klien" | "Kepala LMI" | "Admin";

const CLIENT_ROLES: readonly Role[] = ["Mahasiswa", "Dosen", "Staff"];

export function accountMatchesTab(account: Account, tab: AdminAccountTab): boolean {
  if (tab === "Semua") return true;
  if (tab === "Klien") return CLIENT_ROLES.includes(account.role);
  return account.role === tab;
}

export function defaultAccountRoleForTab(tab: AdminAccountTab): Role {
  return tab === "Semua" || tab === "Klien" ? "Mahasiswa" : (tab as Role);
}

export function selectAccounts<T extends Account>(accounts: readonly T[], tab: AdminAccountTab, query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return accounts.filter((account) =>
    accountMatchesTab(account, tab) &&
    (!normalizedQuery || account.name.toLowerCase().includes(normalizedQuery) ||
      account.code.toLowerCase().includes(normalizedQuery)),
  );
}
