import React, { Component } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignInButton } from '../components/GoogleSignInButton.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Text } from '../components/ui/Text.jsx';
import { authService } from '../services/AuthService.js';

export class AuthView extends Component {
  constructor(props) {
    super(props);
    this.state = { busy: false, error: null };
  }

  /**
   * @param {string} idToken
   */
  onIdToken = async (idToken) => {
    this.setState({ busy: true, error: null });
    try {
      await authService.signInWithGoogleIdToken(idToken);
    } catch (e) {
      this.setState({
        error: e?.message ?? String(e),
        busy: false,
      });
      return;
    }
    this.setState({ busy: false });
  };

  render() {
    const { busy, error } = this.state;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-md">
            <Text className="mb-1 text-2xl font-semibold text-foreground">
              Discipline Goals
            </Text>
            <Text className="mb-6 text-sm text-muted-foreground">
              Sign in with Google to track daily goals, routines, and wellness
              habits. Data is stored in Firebase Realtime Database.
            </Text>
            <GoogleSignInButton
              onIdToken={this.onIdToken}
              disabled={busy}
              onBusyChange={(b) => this.setState({ busy: b })}
              onError={(msg) => this.setState({ error: msg || null })}
            />
            {error ? (
              <Text className="mt-4 text-sm text-destructive">{error}</Text>
            ) : null}
          </Card>
        </View>
      </SafeAreaView>
    );
  }
}
