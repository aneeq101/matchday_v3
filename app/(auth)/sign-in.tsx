import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

// Required for the OAuth browser session to complete properly on iOS
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPwd, setShowPwd]     = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error.message);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error || !data?.url) {
        Alert.alert('Google sign-in failed', error?.message ?? 'Could not start Google sign-in.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (exchangeError) Alert.alert('Sign-in failed', exchangeError.message);
        // On success, onAuthStateChange in AuthContext fires → _layout redirects to tabs
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="football" size={40} color="#fff" />
            </View>
            <Text style={styles.appName}>MatchDay</Text>
            <Text style={styles.tagline}>Find players. Book venues. Play.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome back</Text>

            {/* Google button */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#374151" />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or sign in with email</Text>
              <View style={styles.divider} />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={18} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.linkText}>Don't have an account? </Text>
              <Text style={styles.linkBold}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  header:     { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#16a34a', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  appName:  { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  tagline:  { fontSize: 14, color: '#6b7280', marginTop: 4 },

  form:      { gap: 4 },
  formTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingVertical: 13, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  googleIcon:    { fontSize: 18, fontWeight: '800', color: '#4285F4', fontFamily: 'serif' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  divider:     { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { color: '#9ca3af', fontSize: 12, flexShrink: 0 },

  label:    { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#f9fafb',
  },
  input: { flex: 1, fontSize: 15, color: '#111827' },

  primaryBtn: {
    backgroundColor: '#16a34a', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 20,
    shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  linkRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { color: '#6b7280', fontSize: 14 },
  linkBold: { color: '#16a34a', fontSize: 14, fontWeight: '700' },
});
