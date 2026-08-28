import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'

interface Props {
  children: ReactNode
  fallback?: (error: Error, resetError: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  public resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.resetError)
      }

      return (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.container} bounces={false}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={56} color={tokens.colors.statusError} />
            </View>

            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred in the application. You can try recovering by clicking below.
            </Text>

            {Boolean(this.state.error?.message) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} numberOfLines={4}>
                  {this.state.error?.message}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.retryButton} onPress={this.resetError} activeOpacity={0.8}>
              <Ionicons name="refresh" size={18} color={tokens.colors.onPrimary} />
              <Text style={styles.retryButtonText}>Reload Screen</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.typography.headlineMedium.fontSize,
    fontWeight: '800',
    color: tokens.colors.onBackground,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: tokens.typography.bodyMedium.fontSize,
    color: tokens.colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: tokens.spacing.md,
    maxWidth: 320,
  },
  errorBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    marginBottom: tokens.spacing.lg,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: tokens.colors.statusError,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primaryContainer,
    paddingVertical: tokens.spacing.sm + 4,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
    ...tokens.shadows.card,
  },
  retryButtonText: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
})
