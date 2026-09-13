import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, ActionSheetIOS, Platform, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Linking } from 'react-native'
import { elevation, radii, spacing, FONT } from '../theme'
import { hapticWarning } from '../services/haptics'

interface Props {
  managerPhone?: string
}

export function EmergencyButton({ managerPhone }: Props) {
  const [pressed, setPressed] = useState(false)

  const handlePress = () => {
    hapticWarning()
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Call 999 (Emergency)', managerPhone ? 'Call Manager' : null, 'Call 111 (NHS)'].filter(Boolean) as string[],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) dialNumber('999')
          else if (buttonIndex === 2 && managerPhone) dialNumber(managerPhone)
          else if (buttonIndex === 3) dialNumber('111')
        }
      )
    } else {
      const options = ['Cancel', 'Call 999 (Emergency)', 'Call 111 (NHS)']
      if (managerPhone) options.splice(2, 0, 'Call Manager')
      Alert.alert('Emergency Call', 'Who do you need to call?', [
        { text: 'Cancel', style: 'cancel' },
        { text: '999 — Emergency', style: 'destructive', onPress: () => dialNumber('999') },
        ...(managerPhone ? [{ text: 'Manager', onPress: () => dialNumber(managerPhone) }] : []),
        { text: '111 — NHS', onPress: () => dialNumber('111') },
      ])
    }
  }

  const dialNumber = async (number: string) => {
    try {
      const url = `tel:${number}`
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Cannot make calls', `Dial ${number} manually from your phone app.`)
      }
    } catch {
      Alert.alert('Error', `Could not open phone dialer. Please call ${number} manually.`)
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.button, pressed && styles.buttonPressed]}
      accessibilityLabel="Emergency call"
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="call" size={20} color="#FFFFFF" />
      </View>
      <Text style={styles.label}>SOS</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 100,
    right: spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
    zIndex: 999,
  },
  buttonPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: '#B91C1C',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 1,
  },
})
