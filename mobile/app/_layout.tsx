import '../global.css';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { scheduleUpcomingNotifications } from '@/lib/notifications';

const log = (...args: unknown[]) => console.log('[PP]', ...args);

log('module loaded');
SplashScreen.preventAutoHideAsync();

// ─── Auth Guard ──────────────────────────────────────────────────────────────

function useAuthGuard(session: Session | null, isReady: boolean) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    log('useAuthGuard effect — isReady:', isReady, 'session:', !!session, 'segments:', segments);
    if (!isReady) return;

    const inTabs  = segments[0] === '(tabs)';
    const inLogin = segments[0] === 'login';

    if (!session && !inLogin) {
      log('→ navigating to /login');
      router.replace('/login');
    } else if (session && !inTabs) {
      log('→ navigating to /(tabs)/');
      router.replace('/(tabs)/');
    } else {
      log('→ no navigation needed');
    }
  }, [session, segments, isReady]);
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  log('RootLayout render');
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useAuthGuard(session, isReady);

  useEffect(() => {
    log('auth useEffect — calling getSession()');
    let finished = false;

    const finish = (session: import('@supabase/supabase-js').Session | null) => {
      if (finished) return;
      finished = true;
      log('finish() called — session:', !!session);
      setSession(session);
      setIsReady(true);
      // hideAsync is called in the isReady effect below so it runs after React
      // has committed the new state and mounted the navigator views.
    };

    // Safety net: if getSession() never resolves (e.g. expired token waiting on
    // an unreachable Supabase URL), unblock the app after 3 s and treat as signed-out.
    // Keep this below Android's 5 s ANR threshold.
    const safety = setTimeout(() => {
      log('safety timeout fired');
      finish(null);
    }, 3000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        log('getSession() resolved — session:', !!session);
        finish(session);
      })
      .catch((err) => {
        log('getSession() error:', err?.message);
        finish(null);
      })
      .finally(() => clearTimeout(safety));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      log('onAuthStateChange — session:', !!session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-schedule notifications when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && session) {
        scheduleUpcomingNotifications(supabase).catch(console.warn);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [session]);

  // Handle tapping a notification while app is open
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Navigate to today tab when user taps a dose notification
      // Router navigation is handled via deep link scheme in app.json
    });
    return () => sub.remove();
  }, []);

  // Hide the splash screen after React has committed the ready state so the
  // navigator views are mounted before the splash animates away.
  useEffect(() => {
    if (isReady) {
      log('isReady=true — calling SplashScreen.hideAsync()');
      SplashScreen.hideAsync()
        .then(() => log('SplashScreen hidden'))
        .catch((err) => log('SplashScreen.hideAsync error:', err?.message));
    }
  }, [isReady]);

  log('RootLayout — isReady:', isReady);
  if (!isReady) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="login"
          options={{ animation: 'fade' }}
        />
      </Stack>
    </>
  );
}
