export function getAdminToken(): string | null {
  return localStorage.getItem('quyinsach_admin_token');
}

export function setAdminToken(token: string | null): void {
  if (token) localStorage.setItem('quyinsach_admin_token', token);
  else localStorage.removeItem('quyinsach_admin_token');
}
