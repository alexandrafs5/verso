export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  role: 'USER' | 'ADMIN';
  username: string | null;
  bio: string | null;
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  defaultAnnotationVisibility: 'PUBLIC' | 'PRIVATE';
  ratingStyle: 'STARS_WHOLE' | 'STARS_HALF' | 'STARS_QUARTER' | 'DECIMAL_10' | 'HUNDRED';
  progressStyle: 'PAGES' | 'PERCENT';
  locale: 'en' | 'es';
  theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  timeZone: string;
  reminderEnabled: boolean;
  /** "HH:mm" */
  reminderTime: string | null;
  onboardingCompletedAt: Date | null;
};

export type AuthSession = { id: string; expiresAt: Date };

/** Request shape after SessionGuard has run. */
export type AuthenticatedRequest = {
  user: AuthUser;
  session: AuthSession;
};
