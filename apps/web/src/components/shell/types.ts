export type ShellUser = {
  name: string;
  username: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
};

export type AppShellProps = {
  user: ShellUser;
  onSignOut(): void;
  children: React.ReactNode;
};
