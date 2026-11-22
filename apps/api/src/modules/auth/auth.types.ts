export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  role: 'USER' | 'ADMIN';
};

export type AuthSession = { id: string; expiresAt: Date };

/** Request shape after SessionGuard has run. */
export type AuthenticatedRequest = {
  user: AuthUser;
  session: AuthSession;
};
