import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo } from 'react';
import Constants from 'expo-constants';
import { Platform, View } from 'react-native';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getAuthInstance, isFirebaseConfigured } from '../config/firebase.js';
import { Button } from './ui/Button.jsx';
import { Text } from './ui/Text.jsx';

WebBrowser.maybeCompleteAuthSession();

/**
 * Web: Firebase `signInWithPopup` — avoids `redirect_uri_mismatch` from Expo + Google OAuth
 * on localhost; Firebase + Google are already linked for the project.
 *
 * @param {{ disabled?: boolean, onBusyChange?: (b: boolean) => void, onError?: (m: string) => void }} props
 */
function GoogleSignInWebButton({ disabled, onBusyChange, onError }) {
  const onPress = async () => {
    onBusyChange?.(true);
    onError?.('');
    try {
      const auth = getAuthInstance();
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, p);
    } catch (e) {
      const code = e?.code ?? '';
      const msg = e?.message ?? String(e);
      onError?.(
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in cancelled.'
          : msg
      );
    } finally {
      onBusyChange?.(false);
    }
  };

  if (!isFirebaseConfigured()) {
    return (
      <Text className="text-sm text-destructive">
        Firebase is not configured.
      </Text>
    );
  }

  return (
    <Button label="Sign in with Google" onPress={onPress} disabled={!!disabled} />
  );
}

/**
 * Native + Expo Go: ID token from Google via Expo, then `signInWithCredential` in AuthService.
 * Requires `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and matching redirect in Google Cloud.
 */
function GoogleSignInNativeExpoOauthButton({
  onIdToken,
  disabled,
  onBusyChange,
  onError,
}) {
  const extra = (Constants.expoConfig ?? Constants.manifest)?.extra;
  const webClientId = extra?.google?.webClientId;
  const oauthRedirectOverride = extra?.google?.oauthRedirect?.trim();

  const redirectUri = useMemo(
    () => oauthRedirectOverride || undefined,
    [oauthRedirectOverride]
  );

  const [request, response, promptAsync] = useIdTokenAuthRequest({
    webClientId: webClientId || '',
    redirectUri: redirectUri ?? undefined,
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params?.id_token) {
      onIdToken(response.params.id_token);
    } else if (response?.type === 'error' && response.error) {
      onError?.(String(response.error));
    }
  }, [response, onIdToken, onError]);

  return (
    <Button
      label="Sign in with Google"
      onPress={() => {
        onBusyChange?.(true);
        promptAsync().finally(() => onBusyChange?.(false));
      }}
      disabled={!request || disabled}
    />
  );
}

/**
 * @param {{ onIdToken: (t: string) => void, disabled?: boolean, onBusyChange?: (b: boolean) => void, onError?: (m: string) => void }} props
 */
export function GoogleSignInButton(props) {
  if (Platform.OS === 'web') {
    return <GoogleSignInWebButton {...props} />;
  }
  const webClientId = (Constants.expoConfig ?? Constants.manifest)?.extra?.google
    ?.webClientId;
  if (!webClientId) {
    return (
      <View className="px-1">
        <Text className="text-center text-sm text-destructive">
          Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env to enable Google sign-in on
          this platform.
        </Text>
      </View>
    );
  }
  return <GoogleSignInNativeExpoOauthButton {...props} />;
}
