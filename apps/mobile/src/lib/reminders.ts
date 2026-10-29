import * as Notifications from 'expo-notifications';
import { track } from '@/lib/telemetry';

/**
 * "Gideceğim" hatırlatması (29.10.2026): işaretlenen mekan için 3 gün sonra, akşam 18:00'de yerel bildirim.
 * Sunucu ya da hesap gerekmez. İzin ilk "Gideceğim"de istenir; reddedilirse sessizce vazgeçilir, tekrar sorulmaz.
 * İşaret kaldırılırsa ya da "Gittim" olursa hatırlatma iptal edilir.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const idFor = (venueId: string) => `want-${venueId}`;

export async function scheduleWantReminder(venue: { id: string; name: string }, texts: { title: string; body: string }) {
  try {
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    track('reminder.permission', { granted });
    if (!granted) return;
    const at = new Date();
    at.setDate(at.getDate() + 3);
    at.setHours(18, 0, 0, 0);
    await Notifications.cancelScheduledNotificationAsync(idFor(venue.id)).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(venue.id),
      content: { title: texts.title, body: texts.body, data: { venueId: venue.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch { /* bildirim yoksa uygulama etkilenmez */ }
}

export async function cancelWantReminder(venueId: string) {
  await Notifications.cancelScheduledNotificationAsync(idFor(venueId)).catch(() => {});
}
