import React from 'react'
import { Alert } from 'react-native'
import { AuthModal } from '../components/AuthModal'
import type { UserAccount } from '../types'
import { styles as expenseStyles } from '../screens/expenses/ExpensesScreen.styles'
import { styles as payrollStyles } from '../screens/payroll/PayrollScreen.styles'

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: any) => ({ type: 'Ionicons', props }),
}))

jest.mock('react-native', () => ({
  Text: Object.assign((props: any) => props?.children, { displayName: 'Text' }),
  TextInput: Object.assign((props: any) => null, { displayName: 'TextInput' }),
  TouchableOpacity: Object.assign((props: any) => props?.children, { displayName: 'TouchableOpacity' }),
  Modal: Object.assign((props: any) => props?.children, { displayName: 'Modal' }),
  View: Object.assign((props: any) => props?.children, { displayName: 'View' }),
  ScrollView: Object.assign((props: any) => props?.children, { displayName: 'ScrollView' }),
  ActivityIndicator: Object.assign((props: any) => null, { displayName: 'ActivityIndicator' }),
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

describe('AuthModal Profile Name Restriction & Dialog Bottom Spacing', () => {
  const sellerUser: UserAccount = {
    id: 'u1',
    name: 'John Seller',
    email: 'john@kcinventory.com',
    role: 'SELLER',
    isActive: true,
    phone: '012345678',
  }

  const adminUser: UserAccount = {
    id: 'u2',
    name: 'Admin Boss',
    email: 'admin@kcinventory.com',
    role: 'ADMIN',
    isActive: true,
    phone: '098765432',
  }

  const superAdminUser: UserAccount = {
    id: 'u3',
    name: 'Super Director',
    email: 'super@kcinventory.com',
    role: 'SUPER_ADMIN',
    isActive: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => [initial, jest.fn()]) as any)
  })

  function findNodes(node: any, predicate: (n: any) => boolean): any[] {
    if (!node || typeof node !== 'object') return []
    const matches: any[] = []
    if (predicate(node)) matches.push(node)
    if (node.props?.children) {
      const children = Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      for (const child of children) {
        matches.push(...findNodes(child, predicate))
      }
    }
    return matches
  }

  describe('Profile Name Editing Restriction', () => {
    it('disables full name editing for non-admin seller', () => {
      const mockUpdate = jest.fn()
      const tree = (AuthModal as any)({
        visible: true,
        currentUser: sellerUser,
        onClose: jest.fn(),
        onUpdateProfile: mockUpdate,
      })

      const inputs = findNodes(tree, (n) => n.props?.placeholder === 'Enter full name')
      expect(inputs.length).toBe(1)
      expect(inputs[0].props.value).toBe('John Seller')
      expect(inputs[0].props.editable).toBe(false)
    })

    it('enables full name editing for admin and super admin', () => {
      const adminTree = (AuthModal as any)({
        visible: true,
        currentUser: adminUser,
        onClose: jest.fn(),
        onUpdateProfile: jest.fn(),
      })

      const superTree = (AuthModal as any)({
        visible: true,
        currentUser: superAdminUser,
        onClose: jest.fn(),
        onUpdateProfile: jest.fn(),
      })

      const adminInputs = findNodes(adminTree, (n) => n.props?.placeholder === 'Enter full name')
      expect(adminInputs.length).toBe(1)
      expect(adminInputs[0].props.value).toBe('Admin Boss')
      expect(adminInputs[0].props.editable).toBe(true)

      const superInputs = findNodes(superTree, (n) => n.props?.placeholder === 'Enter full name')
      expect(superInputs.length).toBe(1)
      expect(superInputs[0].props.value).toBe('Super Director')
      expect(superInputs[0].props.editable).toBe(true)
    })

    it('preserves existing name when non-admin submits profile update', () => {
      const mockUpdate = jest.fn()
      const mockClose = jest.fn()
      const tree = (AuthModal as any)({
        visible: true,
        currentUser: sellerUser,
        onClose: mockClose,
        onUpdateProfile: mockUpdate,
      })

      const buttons = findNodes(tree, (n) =>
        n.props?.children &&
        (n.props.children === 'Save Profile Changes' ||
          (Array.isArray(n.props.children) && n.props.children.includes('Save Profile Changes')) ||
          (n.props.children?.props?.children === 'Save Profile Changes'))
      )

      expect(buttons.length).toBeGreaterThan(0)
      buttons[0].props.onPress()

      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'John Seller',
        phone: '012345678',
      })
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Profile updated successfully')
      expect(mockClose).toHaveBeenCalled()
    })
  })

  describe('Dialog Bottom Corner Styling Check', () => {
    it('ensures expense detailSheet has flat bottom corners on iOS', () => {
      expect((expenseStyles.detailSheet as any).borderBottomLeftRadius).toBeUndefined()
      expect((expenseStyles.detailSheet as any).borderBottomRightRadius).toBeUndefined()
    })

    it('ensures payroll detailActionBar has flat bottom corners', () => {
      expect((payrollStyles as any).detailActionBar.borderBottomLeftRadius).toBeUndefined()
      expect((payrollStyles as any).detailActionBar.borderBottomRightRadius).toBeUndefined()
    })
  })
})
