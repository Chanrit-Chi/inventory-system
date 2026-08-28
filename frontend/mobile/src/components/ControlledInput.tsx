import React from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native'
import { useController, UseControllerProps, FieldValues } from 'react-hook-form'
import { tokens } from '../theme/tokens'

interface ControlledInputProps<T extends FieldValues> extends UseControllerProps<T> {
  label?: string
  placeholder?: string
  inputProps?: TextInputProps
  containerStyle?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

export function ControlledInput<T extends FieldValues>({
  name,
  control,
  rules,
  defaultValue,
  label,
  placeholder,
  inputProps,
  containerStyle,
  labelStyle,
}: ControlledInputProps<T>) {
  const {
    field: { onChange, onBlur, value },
    fieldState: { error },
  } = useController({ name, control, rules, defaultValue })

  return (
    <View style={[styles.container, containerStyle]}>
      {Boolean(label) && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
          inputProps?.style,
        ]}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textDisabled}
        value={value == null ? '' : String(value)}
        onChangeText={onChange}
        onBlur={onBlur}
        {...inputProps}
      />
      {Boolean(error?.message) && <Text style={styles.errorText}>{error?.message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.onBackground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tokens.colors.surfaceCard,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.colors.onBackground,
  },
  inputError: {
    borderColor: tokens.colors.statusError,
    borderWidth: 1.5,
  },
  errorText: {
    marginTop: 4,
    color: tokens.colors.statusError,
    fontSize: 12,
    fontWeight: '500',
  },
})
