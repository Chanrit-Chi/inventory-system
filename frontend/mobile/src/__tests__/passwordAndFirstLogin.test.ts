import React from 'react'
import * as Clipboard from 'expo-clipboard'
import { generateSecureTemporaryPassword } from '../utils/password'
import { copyToClipboard } from '../utils/clipboard'
import { adminUserSchema } from '../utils/validation'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: any) => ({ type: 'Ionicons', props }),
}))

jest.mock('react-native', () => ({
  Text: (props: any) => ({ type: 'Text', props }),
  TextInput: (props: any) => ({ type: 'TextInput', props }),
  TouchableOpacity: (props: any) => ({ type: 'TouchableOpacity', props }),
  Modal: (props: any) => ({ type: 'Modal', props }),
  View: (props: any) => ({ type: 'View', props }),
  ScrollView: (props: any) => ({ type: 'ScrollView', props }),
  ActivityIndicator: (props: any) => ({ type: 'ActivityIndicator', props }),
  KeyboardAvoidingView: (props: any) => ({ type: 'KeyboardAvoidingView', props }),
  Alert: {
    alert: jest.fn(),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  },
}))

describe('Password Generator & First Login Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateSecureTemporaryPassword', () => {
    it('generates a password of default length 10', () => {
      const password = generateSecureTemporaryPassword()
      expect(typeof password).toBe('string')
      expect(password.length).toBe(10)
    })

    it('generates a password of specified custom length', () => {
      const password = generateSecureTemporaryPassword(14)
      expect(password.length).toBe(14)
    })

    it('enforces minimum length of 8 even if smaller length requested', () => {
      const password = generateSecureTemporaryPassword(4)
      expect(password.length).toBe(8)
    })

    it('contains uppercase, lowercase, number, and special characters', () => {
      const password = generateSecureTemporaryPassword(12)

      const hasUpper = /[A-Z]/.test(password)
      const hasLower = /[a-z]/.test(password)
      const hasDigit = /[0-9]/.test(password)
      const hasSpecial = /[@#$%&*!]/.test(password)

      expect(hasUpper).toBe(true)
      expect(hasLower).toBe(true)
      expect(hasDigit).toBe(true)
      expect(hasSpecial).toBe(true)
    })

    it('generates randomized and distinct passwords on multiple invocations', () => {
      const passwords = new Set<string>()
      for (let i = 0; i < 20; i++) {
        passwords.add(generateSecureTemporaryPassword(10))
      }
      expect(passwords.size).toBe(20)
    })
  })

  describe('adminUserSchema Validation', () => {
    it('validates a user with auto-generated temporary password', () => {
      const tempPass = generateSecureTemporaryPassword(10)
      const validData = {
        name: 'Jane Staff',
        email: 'jane.staff@example.com',
        phone: '+85512345678',
        password: tempPass,
        role: 'SELLER' as const,
        department: 'Main Counter',
        hire_date: '2026-08-29',
        notes: 'Morning shift',
        base_salary: '350.00',
        salary_reason: 'Starting package',
        isActive: true,
      }

      const result = adminUserSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('allows empty password during edit mode', () => {
      const editData = {
        name: 'Jane Staff',
        email: 'jane.staff@example.com',
        phone: '',
        password: '',
        role: 'SELLER' as const,
        department: '',
        hire_date: '',
        notes: '',
        base_salary: '',
        salary_reason: '',
        isActive: true,
      }

      const result = adminUserSchema.safeParse(editData)
      expect(result.success).toBe(true)
    })

    it('rejects password with fewer than 8 characters when provided', () => {
      const invalidData = {
        name: 'Jane Staff',
        email: 'jane.staff@example.com',
        password: 'short',
        role: 'SELLER' as const,
        isActive: true,
      }

      const result = adminUserSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Credentials Copy to Clipboard', () => {
    it('copies credentials to clipboard with full formatted string', async () => {
      const payload = 'KC Inventory Account Credentials:\nEmail: jane.seller@inventory.local\nTemporary Password: Pass#12345\nRole: SELLER'

      const copyResult = await copyToClipboard(payload, { label: 'Credentials' })

      expect(copyResult).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(payload)
    })

    it('copies temporary password alone to clipboard', async () => {
      const tempPass = 'TempPass@2026'

      const copyResult = await copyToClipboard(tempPass, { label: 'Temporary Password' })

      expect(copyResult).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('TempPass@2026')
    })
  })
})
