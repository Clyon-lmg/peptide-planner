import '../global.css';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { scheduleUpcomingNotifications } from '@/lib/notifications';
// Note: react-native-safe-area-context's SafeAreaView is already registered for
// NativeWind className support by react-native-css-interop/dist/runtime/components.js.
// No manual cssInterop call needed here.

// Use console.error so logs appear in Android logcat (ReactNativeJS:E) regardless
// of whether Expo Go routes console.log to Metro terminal only.
const log = (...args: unknown[]) => console.log('[PP]', ...args);

log('module loaded');
SplashScreen.preventAutoHideAsync();

// ─── Auth Guard ──────────────────────────────────────────────────────────────

function useAuthGuard(session: Session | null, isReady: boolean) {
  const router = useRouter();

  useEffect(() => {
    log('useAuthGuard effect — isReady:', isReady, 'session:', !!session);
    // Wait until auth check completes. By the time isReady is true (Supabase
    // resolved or 3 s safety timeout fired), the navigation container is
    // guaranteed to be mounted and ready.
    //
    // NOTE: useSegments() / usePathname() are intentionally avoided here.
    // In expo-router 4.0.x both hooks call syncStoreRootState() during render,
    // which dereferences store.navigationRef before it has been assigned by
    // store.initialize(), crashing with "Cannot read property 'isReady' of
    // undefined". useRouter() is safe because it only captures method
    // references without touching navigationRef.
    if (!isReady) return;

    if (session) {
      log('→ navigating to /(tabs)/');
      router.replace('/(tabs)/');
    } else {
      log('→ navigating to /login');
      router.replace('/login');
    }
  }, [session, isReady]);
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
  // Always render the Stack so expo-router can fully initialise its route
  // tree from the first render. Conditionally swapping a <View> placeholder
  // for a <Stack> causes expo-router to lose the route-node context and throw
  // "No filename found". The splash screen (preventAutoHideAsync above)
  // covers the UI while auth is loading, so users never see an intermediate
  // state.
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
    </>
  );
}
