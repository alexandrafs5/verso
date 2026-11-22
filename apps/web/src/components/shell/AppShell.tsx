import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import type { AppShellProps } from './types';
import { WakingBanner } from './WakingBanner';

export function AppShell({ user, onSignOut, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <TopBar user={user} onSignOut={onSignOut} />
      {/* Zero-height sticky anchor: the banner overlays content, so it never shifts the layout. */}
      <div className="sticky top-14 z-30 h-0">
        <div className="absolute inset-x-0 top-0">
          <WakingBanner />
        </div>
      </div>
      {/* Mobile bottom padding clears the fixed tab bar (3.5rem) plus the safe area. */}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>
      <BottomTabBar username={user.username} />
    </div>
  );
}
