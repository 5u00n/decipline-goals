import '../global.css';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onValue, ref } from 'firebase/database';
import { getDatabaseInstance } from './config/firebase.js';
import { authService } from './services/AuthService.js';
import { useAuthStore } from './store/authStore.js';
import { isFirebaseConfigured, tryGetApp } from './config/firebase.js';
import { AuthView } from './views/AuthView.jsx';
import { HomeView } from './views/HomeView.jsx';
import { AnalyticsView } from './views/AnalyticsView.jsx';
import { AdminDashboardView } from './views/AdminDashboardView.jsx';
import { Text } from './components/ui/Text.jsx';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'hsl(0 0% 100%)',
  },
};

function AppShell() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const ready = useAuthStore((s) => s.ready);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      useAuthStore.getState().setReady(true);
      setLoading(false);
      return;
    }
    tryGetApp();
    const setUser = useAuthStore.getState().setUser;
    const setRole = useAuthStore.getState().setRole;
    const setReady = useAuthStore.getState().setReady;
    const unsub = authService.subscribeAuth(async (u) => {
      if (u) {
        setUser(u);
        try {
          await authService.ensureUserAndBootstrap(u);
        } catch (e) {
          useAuthStore.getState().setError(e?.message ?? String(e));
        }
        const r = await authService.getUserRole(u.uid);
        setRole(r === 'admin' ? 'admin' : 'user');
      } else {
        setUser(null);
        setRole('user');
      }
      setReady(true);
      setLoading(false);
    });
    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, []);

  /** Live-sync role with RTDB (promotion/demotion in admin UI, or bootstrap) */
  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid) {
      return;
    }
    const setRole = useAuthStore.getState().setRole;
    const rref = ref(getDatabaseInstance(), `users/${user.uid}/profile/role`);
    const unsubR = onValue(rref, (snap) => {
      setRole(
        snap.exists() && snap.val() === 'admin' ? 'admin' : 'user'
      );
    });
    return () => {
      unsubR();
    };
  }, [user?.uid]);

  const onSignOut = async () => {
    await authService.signOutUser();
  };

  if (!isFirebaseConfigured()) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="mb-2 text-center text-lg font-semibold">
          Firebase is not configured
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          Create a .env file with EXPO_PUBLIC_FIREBASE_API_KEY and other keys (see
          .env.example), then restart Expo. Realtime Database URL is required.
        </Text>
      </View>
    );
  }

  if (loading || !ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Loading…</Text>
      </View>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'default',
          /** RN Web: stack scene wrapper must fill viewport or nested flex ScrollViews collapse (~12px). */
          contentStyle: { flex: 1 },
        }}
        initialRouteName="Home"
      >
        <Stack.Screen name="Home">
          {({ navigation }) => (
            <HomeView
              onSignOut={onSignOut}
              role={role}
              onOpenAnalytics={() => navigation.navigate('Analytics')}
              onOpenAdmin={() => navigation.navigate('Admin')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Analytics">
          {({ navigation }) => (
            <AnalyticsView onBack={() => navigation.goBack()} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Admin">
          {({ navigation }) => (
            <AdminDashboardView
              navigation={navigation}
              role={role}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView className="flex-1" style={{ flex: 1 }}>
        <AppShell />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
