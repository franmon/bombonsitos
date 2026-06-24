import { Platform } from 'react-native'
import Constants from 'expo-constants'

const isExpoGo = Constants.appOwnership === 'expo'

let Notifications: typeof import('expo-notifications') | null = null
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications')
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  } catch {
    Notifications = null
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Actividades',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C63FF',
      })
    }
    return finalStatus === 'granted'
  } catch {
    return false
  }
}

export async function scheduleEventNotification(
  eventId: string,
  title: string,
  startsAt: string,
  minutesBefore: number
): Promise<string | null> {
  if (!Notifications) return null
  try {
    const startTime = new Date(startsAt).getTime()
    const notifyTime = startTime - minutesBefore * 60 * 1000
    if (notifyTime <= Date.now()) return null
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Próxima actividad',
        body: `${title} empieza en ${minutesBefore} minutos`,
        data: { eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(notifyTime),
      },
    })
    return id
  } catch {
    return null
  }
}

export async function cancelEventNotification(notificationId: string): Promise<void> {
  if (!Notifications) return
  try { await Notifications.cancelScheduledNotificationAsync(notificationId) } catch {}
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return
  try { await Notifications.cancelAllScheduledNotificationsAsync() } catch {}
}