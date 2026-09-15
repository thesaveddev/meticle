import React from 'react'
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native'
import { render, fireEvent, act } from '@testing-library/react-native'
import { EmergencyButton, organisationSosContacts, sosTargets } from '../EmergencyButton'

const office = { label: 'Office', phone: '020 7946 0000' }
const supervisor = { label: 'Supervisor', phone: '07700 900123' }

let actionSheetOptions: string[] = []
let actionSheetHandler: ((index: number) => void) | undefined

beforeEach(() => {
  actionSheetOptions = []
  actionSheetHandler = undefined
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((options: any, callback: any) => {
    actionSheetOptions = options.options
    actionSheetHandler = callback
  })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
})

function pressSos(contacts = [office, supervisor]) {
  const screen = render(<EmergencyButton contacts={contacts} />)
  fireEvent.press(screen.getByLabelText('Emergency call'))
  return screen
}

describe('EmergencyButton', () => {
  it('offers the emergency services first and the organisation numbers after them', () => {
    pressSos()

    expect(actionSheetOptions).toEqual([
      'Cancel',
      'Call 999 — Emergency',
      'Call 111 — NHS',
      'Call Office',
      'Call Supervisor',
    ])
  })

  it('marks 999 as the destructive option', () => {
    pressSos()
    const config = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mock.calls[0][0]
    expect(config.destructiveButtonIndex).toBe(1)
    expect(config.cancelButtonIndex).toBe(0)
  })

  it('leaves 999 and 111 untouched when no organisation numbers are configured', () => {
    pressSos([])

    expect(actionSheetOptions).toEqual(['Cancel', 'Call 999 — Emergency', 'Call 111 — NHS'])
  })

  it('dials the organisation number that was chosen', async () => {
    pressSos()

    // Option 0 is Cancel, 1-2 are the emergency services, then the organisation
    // numbers in the order they were configured.
    await act(async () => {
      actionSheetHandler?.(3)
    })
    expect(Linking.openURL).toHaveBeenCalledWith('tel:020 7946 0000')

    await act(async () => {
      actionSheetHandler?.(4)
    })
    expect(Linking.openURL).toHaveBeenCalledWith('tel:07700 900123')
  })

  it('offers the manager after the organisation numbers when one is configured', async () => {
    const screen = render(<EmergencyButton contacts={[office]} managerPhone="07700 900999" />)
    fireEvent.press(screen.getByLabelText('Emergency call'))

    expect(actionSheetOptions).toEqual([
      'Cancel',
      'Call 999 — Emergency',
      'Call 111 — NHS',
      'Call Office',
      'Call Manager',
    ])

    await act(async () => {
      actionSheetHandler?.(4)
    })
    expect(Linking.openURL).toHaveBeenCalledWith('tel:07700 900999')
  })

  it('dials 999 when the first option is chosen', async () => {
    pressSos()

    await act(async () => {
      actionSheetHandler?.(1)
    })

    expect(Linking.openURL).toHaveBeenCalledWith('tel:999')
  })

  it('does nothing when the sheet is cancelled', async () => {
    pressSos()

    await act(async () => {
      actionSheetHandler?.(0)
    })

    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it('lists the organisation numbers on Android too', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android')
    try {
      pressSos()

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2]
      expect(buttons.map((b: any) => b.text)).toEqual([
        'Cancel',
        '999 — Emergency',
        '111 — NHS',
        'Office',
        'Supervisor',
      ])
    } finally {
      platform.restore()
    }
  })
})

describe('SOS contact mapping', () => {
  it('uses office and supervisor defaults for unlabelled numbers', () => {
    expect(organisationSosContacts({
      emergency_contact_1_phone: '020 7946 0000',
      emergency_contact_2_phone: '07700 900123',
    })).toEqual([office, supervisor])
  })

  it('drops blank numbers and missing organisations', () => {
    expect(organisationSosContacts({ emergency_contact_1_phone: '', emergency_contact_2_phone: null })).toEqual([])
    expect(organisationSosContacts(null)).toEqual([])
  })

  it('cannot be displaced by an organisation number that looks like an emergency one', () => {
    const targets = sosTargets([{ label: 'Fake emergency', phone: '999' }])
    expect(targets[0]).toEqual({ label: '999 — Emergency', phone: '999' })
    expect(targets[1]).toEqual({ label: '111 — NHS', phone: '111' })
    expect(targets).toHaveLength(3)
  })
})
