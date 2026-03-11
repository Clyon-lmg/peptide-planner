import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  useEffect(() => { console.log('[PP] LoginScreen mounted'); }, []);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert(
          'Check your email',
          'We sent a confirmation link to ' + email + '. Click it then come back to sign in.'
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1 justify-center px-6"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Logo / Title */}
        <View className="mb-10 items-center">
          <Text className="text-4xl font-bold text-foreground tracking-tight">💉</Text>
          <Text className="mt-3 text-2xl font-bold text-foreground">Peptide Planner</Text>
          <Text className="mt-1 text-muted text-center text-sm">
            Track your peptide protocols
          </Text>
        </View>

        {/* Tab toggle */}
        <View className="mb-6 flex-row rounded-xl bg-card p-1">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              className={`flex-1 rounded-lg py-2 items-center ${
                mode === m ? 'bg-primary' : ''
              }`}
            >
              <Text
                className={`font-semibold ${
                  mode === m ? 'text-white' : 'text-muted'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Fields */}
        <View className="gap-3">
          <TextInput
            className="rounded-xl bg-card px-4 py-3.5 text-foreground text-base"
            placeholder="Email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            className="rounded-xl bg-card px-4 py-3.5 text-foreground text-base"
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="mt-5 rounded-xl bg-primary py-4 items-center disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </Pressable>

        <Text className="mt-6 text-center text-xs text-muted-foreground">
          Subscription managed at peptideplanner.com
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
