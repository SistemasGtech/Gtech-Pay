const STORAGE_KEY = 'gtech_admin_auth';

export const DEFAULT_ADMIN_USER = 'admin';
export const DEFAULT_ADMIN_PASSWORD = '123';

export interface AdminCredentials {
  user: string;
  password: string;
}

function loadStoredAuth(): AdminCredentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminCredentials;
      if (parsed.user && parsed.password) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { user: DEFAULT_ADMIN_USER, password: DEFAULT_ADMIN_PASSWORD };
}

export function validateAdminLogin(user: string, password: string): boolean {
  const auth = loadStoredAuth();
  return user.trim().toLowerCase() === auth.user.toLowerCase() && password === auth.password;
}

/** Restaura usuário e senha padrão (modo local, sem e-mail) */
export function resetAdminPasswordToDefault(): AdminCredentials {
  const creds: AdminCredentials = {
    user: DEFAULT_ADMIN_USER,
    password: DEFAULT_ADMIN_PASSWORD,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  return creds;
}

export function getActiveAdminUser(): string {
  return loadStoredAuth().user;
}

export function getLocalAdminCredentials(): AdminCredentials {
  return loadStoredAuth();
}

export function updateLocalAdminCredentials(user: string, password: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: user.trim(), password }));
}
