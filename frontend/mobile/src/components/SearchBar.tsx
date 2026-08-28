import React from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'

export interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  onClear?: () => void
  containerStyle?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
  loading?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  returnKeyType?: 'search' | 'done' | 'go' | 'next'
  onSubmitEditing?: () => void
  rightAction?: React.ReactNode
  testID?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  containerStyle,
  inputStyle,
  loading = false,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType = 'search',
  onSubmitEditing,
  rightAction,
  testID,
}) => {
  const handleClear = () => {
    onChangeText('')
    onClear?.()
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search" size={17} color={tokens.colors.secondary} style={styles.searchIcon} />
      <TextInput
        testID={testID}
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.secondary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        clearButtonMode="never"
      />
      {loading ? (
        <ActivityIndicator size="small" color={tokens.colors.primaryContainer} style={styles.rightIcon} />
      ) : value.length > 0 ? (
        <TouchableOpacity
          onPress={handleClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.rightIcon}
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={17} color={tokens.colors.secondary} />
        </TouchableOpacity>
      ) : null}
      {Boolean(rightAction) && <View style={styles.customRightWrap}>{rightAction}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceCard,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.onBackground,
    paddingVertical: 0,
  },
  rightIcon: {
    marginLeft: 6,
  },
  customRightWrap: {
    marginLeft: 6,
  },
})
