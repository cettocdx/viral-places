import { Alert, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlaceDetailDto, SummaryItemDto } from '@viral-places/contracts';
import { CATEGORY_META, type ClaimType } from '@viral-places/domain';
import { categoryColor, categoryTextColor, categoryTint, colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { Button, IconButton } from '@/components/button';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { MediaPlaceholder, SourceVideoCard } from '@/components/source-video-card';
import { ErrorState, SkeletonBlock } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { TrendEvidenceCard } from '@/components/trend-evidence-card';
import { SaveButton } from '@/components/save-button';
import { CreatorStack } from '@/components/creator-stack';
import { PLATFORM_LABEL } from '@/i18n';
import { useRef } from 'react';

const CLAIM_ICON: Record<ClaimType, { sf: string; material: string }> = {
  try: { sf: 'fork.knife', material: 'restaurant' },
  visit_time: { sf: 'clock', material: 'schedule' },
  reservation: { sf: 'calendar', material: 'event' },
  atmosphere: { sf: 'sparkles', material: 'auto-awesome' },
  family_note: { sf: 'figure.2.and.child.holdinghands', material: 'family-restroom' },
  uncertainty: { sf: 'questionmark.circle', material: 'help-outline' },
};

/** Google Maps URL ile dış yol tarifi (§21.3, [S18]); kendi navigasyon motoru yok. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function SummaryRow({ item, t, sourceLabel }: { item: SummaryItemDto; t: ReturnType<typeof useT>['t']; sourceLabel: string | null }) {
  const icon = CLAIM_ICON[item.claimType];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <Icon sf={icon.sf} material={icon.material as never} size={18} color={colors.textSecondary} weight="regular" />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText>
          <ThemedText variant="bodyStrong">{t(`claim.${item.claimType}`)}: </ThemedText>
          {item.text}
        </ThemedText>
        <ThemedText variant="caption" tone="secondary">
          {sourceLabel ? `${sourceLabel} · ` : ''}
          {item.sourcePostIds.length} kaynak · {new Date(item.lastVerifiedAt).toLocaleDateString('tr-TR')}
        </ThemedText>
      </View>
    </View>
  );
}

/** Mekan detay ekranı (§7.3). Sıra: ad/mahalle → kategori → bağımsız puan → trend → videolar → AI özeti → pratik → sabit CTA. */
export function PlaceDetailScreen({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const place = usePlace(id);
  const scrollRef = useRef<ScrollView>(null);
  const sourcesY = useRef(0);

  const topBar = (
    <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
      <IconButton accessibilityLabel={t('place.back')} onPress={() => router.back()} testID="place-back">
        <Icon sf="chevron.left" material="arrow-back" size={20} color={colors.textPrimary} />
      </IconButton>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <IconButton accessibilityLabel={t('place.share')} onPress={() => place.data && Share.share({ message: `${place.data.name} — DEMO` })}>
          <Icon sf="square.and.arrow.up" material="ios-share" size={20} color={colors.textPrimary} />
        </IconButton>
        <SaveButton venueId={id} variant="icon" onPress={() => router.push({ pathname: '/save-to-collection', params: { venueId: id } })} />
      </View>
    </View>
  );

  if (place.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonBlock height={320} rounded={0} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonBlock height={30} width="70%" />
          <SkeletonBlock height={18} width="40%" />
          <SkeletonBlock height={140} />
        </View>
        {topBar}
      </View>
    );
  }
  if (place.isError || !place.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ErrorState message={t('place.notFound')} retryTitle={t('common.retry')} onRetry={() => place.refetch()} />
        {topBar}
      </View>
    );
  }

  const p: PlaceDetailDto = place.data;
  const meta = CATEGORY_META[p.category];
  const heroMode = p.sources[0]?.media.mode ?? 'unavailable';
  const ctaHeight = 52 + spacing.lg * 2 + insets.bottom;
  const creators = p.sources.map((s) => s.creator);
  const sourceLabelFor = (ids: string[]) => {
    const src = p.sources.find((s) => ids.includes(s.id));
    return src ? `@${src.creator.handle} · ${PLATFORM_LABEL[src.platform]}` : null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: ctaHeight + spacing.lg }} contentInsetAdjustmentBehavior="never" testID="place-scroll">
        {/* Hero: izinli video/embed/poster; hak yoksa sakin yer tutucu (§14.2). */}
        <View style={{ height: 320, backgroundColor: categoryTint(p.category, 0.2), alignItems: 'center', justifyContent: 'center' }}>
          <MediaPlaceholder category={p.category} mode={heroMode} size={120} />
          {/* Karusel sayfa noktaları: kaynak başına bir poster alanı (medya hakkı gelince gerçek görsel) */}
          {p.sources.length > 1 ? (
            <View style={{ position: 'absolute', bottom: spacing.lg + 64, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
              {p.sources.map((s, i) => (
                <View key={s.id} style={{ width: i === 0 ? 8 : 6, height: i === 0 ? 8 : 6, borderRadius: radius.chip, backgroundColor: i === 0 ? colors.textPrimary : 'rgba(17,24,39,0.28)' }} />
              ))}
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: spacing.lg, bottom: spacing.lg + 20, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <DemoBadge compact />
            <ThemedText variant="caption" tone="secondary">
              {heroMode === 'unavailable' ? t('media.unavailable') : t('media.linkOnly', { platform: 'TikTok' })}
            </ThemedText>
          </View>
        </View>
        <View style={{ marginTop: -24, backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <ThemedText variant="screenTitle" style={{ flex: 1 }} selectable testID="place-name">
                {p.name}
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: categoryTint(p.category), borderRadius: radius.chip, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={14} color={categoryTextColor(p.category)} />
                <ThemedText variant="helper" style={{ color: categoryTextColor(p.category), fontWeight: '600' }}>
                  {t(meta.labelKey)}
                </ThemedText>
              </View>
              <ThemedText variant="helper" tone="secondary">
                {[p.neighborhood, p.city.name].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            <ThemedText variant="helper" tone="secondary">
              {p.externalRating ? `Google ${p.externalRating.rating} (${p.externalRating.count})` : t('place.externalRatingNA')}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <CreatorStack creators={creators} onPress={(cid) => router.push({ pathname: '/creators/[id]', params: { id: cid } })} />
              {p.sources.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('place.sourcesPill', { count: p.sources.length })}
                  onPress={() => scrollRef.current?.scrollTo({ y: sourcesY.current, animated: true })}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.chip, backgroundColor: pressed ? 'rgba(17,24,39,0.08)' : 'rgba(17,24,39,0.05)' })}
                  testID="place-sources-pill"
                >
                  <Icon sf="play.rectangle" material="play-circle-outline" size={14} color={colors.textPrimary} weight="regular" />
                  <ThemedText variant="helper" style={{ fontWeight: '600' }}>
                    {t('place.sourcesPill', { count: p.sources.length })}
                  </ThemedText>
                  <Icon sf="chevron.right" material="chevron-right" size={12} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <TrendEvidenceCard trend={p.trend} onExplain={() => router.push({ pathname: '/trend-explainer', params: { placeId: p.id } })} />

          <View style={{ gap: spacing.md }} onLayout={(e) => { sourcesY.current = e.nativeEvent.layout.y + 296; }}>
            <ThemedText variant="sectionTitle">{t('place.sources')}</ThemedText>
            {p.sources.length === 0 ? (
              <ThemedText tone="secondary">{t('place.sourcesEmpty')}</ThemedText>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                {p.sources.map((s) => (
                  <SourceVideoCard key={s.id} post={s} category={p.category} onCreatorPress={(cid) => router.push({ pathname: '/creators/[id]', params: { id: cid } })} />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: hairline }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon sf="sparkles" material="auto-awesome" size={18} color={colors.culture} />
                <ThemedText variant="headline">{t('place.summary')}</ThemedText>
              </View>
              <ThemedText variant="caption" tone="secondary" style={{ flexShrink: 1, textAlign: 'right' }}>
                {t('place.summaryAiLabel')}
              </ThemedText>
            </View>
            {p.summary.items.length === 0 ? (
              <ThemedText tone="secondary">{t('place.summaryEmpty')}</ThemedText>
            ) : (
              p.summary.items.map((item, idx) => <SummaryRow key={`${item.claimType}-${idx}`} item={item} t={t} sourceLabel={sourceLabelFor(item.sourcePostIds)} />)
            )}
          </View>

          {p.practical.familyAttributes.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <ThemedText variant="sectionTitle">{t('place.familyTitle')}</ThemedText>
              {p.practical.familyAttributes.map((fa) => (
                <View key={fa.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: hairline }}>
                  <ThemedText>{t(`place.family.${fa.key}` as never)}</ThemedText>
                  <ThemedText tone="secondary" style={{ color: fa.value === 'supported' ? colors.sightseeing : fa.value === 'contradicted' ? colors.trending : colors.textSecondary }}>
                    {t(`place.family.${fa.value}`)}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <Button
            title={t('place.report')}
            variant="ghost"
            size="md"
            onPress={() => Alert.alert(t('place.report'), t('place.reportBody'))}
            icon={<Icon sf="flag" material="flag" size={16} color={colors.textSecondary} weight="regular" />}
          />
        </View>
      </ScrollView>
      {/* HIG/apple-design: içerik yüzen chrome altına kayarken sert kenar yerine hafif degrade (scroll edge). */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 72, experimental_backgroundImage: 'linear-gradient(to bottom, rgba(247,248,250,0.92) 0%, rgba(247,248,250,0.55) 55%, rgba(247,248,250,0) 100%)' }} />
      {topBar}
      {/* Sabit ana CTA (§7.3): Yol Tarifi birincil, Gününe Ekle ikincil; tek elle erişilebilir. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: hairline, flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title={t('place.directions')}
          onPress={() => Linking.openURL(directionsUrl(p.location.lat, p.location.lng))}
          icon={<Icon sf="location.north.fill" material="navigation" size={16} color={colors.surface} />}
          style={{ flex: 1.2 }}
          testID="place-directions"
        />
        <Button
          title={t('place.addToDay')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/add-to-plan', params: { venueId: p.id } })}
          icon={<Icon sf="calendar.badge.plus" material="event" size={16} color={categoryColor('food')} />}
          style={{ flex: 1 }}
          testID="place-add-to-plan"
        />
      </View>
    </View>
  );
}
