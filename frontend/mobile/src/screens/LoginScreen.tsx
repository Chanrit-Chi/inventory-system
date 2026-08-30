import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'

export default function LoginScreen() {
  const { login, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth()
  const { branding } = useBranding()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (sessionExpiredMessage) {
      setLoginError(sessionExpiredMessage)
      clearSessionExpiredMessage()
    }
  }, [sessionExpiredMessage, clearSessionExpiredMessage])

  const validate = () => {
    let valid = true
    if (!email.trim()) {
      setEmailError('Email is required')
      valid = false
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email address')
      valid = false
    } else {
      setEmailError('')
    }
    if (!password) {
      setPasswordError('Password is required')
      valid = false
    } else {
      setPasswordError('')
    }
    return valid
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoginError('')
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setLoginError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.logoRow}>
          {branding.logo_url ? (
            <Image
              source={{ uri: branding.logo_url }}
              style={styles.logoImg}
              contentFit="contain"
            />
          ) : (
            <Image
              source={require('../../assets/KC SHOP-No BG.png')}
              style={styles.logoImg}
              contentFit="contain"
            />
          )}
          <View>
            <Text style={styles.appName}>{branding.store_name || 'KC Inventory'}</Text>
            <Text style={styles.appTagline}>{branding.tagline || 'Omnichannel Suite'}</Text>
          </View>
        </View>

        <Text style={styles.heading}>Sign in to your account</Text>

        {!!loginError && (
          <View style={styles.errorBanner}>
            <Ionicons
              name={loginError.startsWith('Cannot reach') ? 'wifi-outline' : 'alert-circle-outline'}
              size={16}
              color={tokens.colors.statusError ?? '#EF4444'}
            />
            <Text style={styles.errorBannerText}>{loginError}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            value={email}
            onChangeText={setEmail}
            onBlur={validate}
            placeholder="you@company.com"
            placeholderTextColor={tokens.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Email address"
          />
          {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, passwordError ? styles.inputError : null]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={tokens.colors.textMuted}
              secureTextEntry={!showPassword}
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={tokens.colors.secondary}
              />
            </TouchableOpacity>
          </View>
          {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          {loading ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <Text style={styles.submitBtnText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  card: {
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: tokens.spacing.lg,
  },
  logoImg: {
    width: 52,
    height: 52,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 12,
    color: tokens.colors.secondary,
    marginTop: 1,
  },
  heading: {
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: tokens.spacing.lg,
  },
  fieldGroup: {
    marginBottom: tokens.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.colors.onBackground,
  },
  inputError: {
    borderColor: tokens.colors.statusError ?? '#EF4444',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    color: tokens.colors.statusError ?? '#EF4444',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: tokens.spacing.md,
    ...tokens.shadows.card,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    marginBottom: tokens.spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.statusError ?? '#EF4444',
    lineHeight: 18,
  },
})
