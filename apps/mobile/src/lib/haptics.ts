import * as Haptics from 'expo-haptics';

/** Tek kullanıcı eylemi başına bir haptik; görselle aynı karede; asla tek geri bildirim değil. iOS'ta anlamlı. */
export function hapticCommit(): void {
  if (process.env.EXPO_OS !== 'ios') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticSelection(): void {
  if (process.env.EXPO_OS !== 'ios') return;
  Haptics.selectionAsync().catch(() => {});
}
