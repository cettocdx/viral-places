import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { VenueLogo } from '@/components/venue-logo';
import { FlatList, Linking, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapClusterItemDto, MapPlaceItemDto, MapPlacesQuery } from '@viral-places/contracts';
import { CATEGORIES, CATEGORY_META, type BBox, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, dimensions, durations, hairline, radius, shadows, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useForegroundLocation } from '@/hooks/use-foreground-location';
import { useCity, useMapPlaces, useSearchPlaces } from '@/lib/api/hooks';
import { appConfig } from '@/lib/config';
import { CategoryChip } from '@/components/category-chip';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/button';
import { PlacePreviewCard } from '@/components/place-preview-card';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';
import { VenueMap } from '@/components/map/venue-map';
import { MapSheet, type SheetDetent } from '@/components/map/map-sheet';
import { ClusterSelectionCard } from '@/components/map/cluster-selection-card';
import { TrendingStrip } from '@/components/trending-strip';
import { GlassSurface } from '@/components/glass-surface';
import { Wordmark } from '@/components/wordmark';
import { Link } from 'expo-router';
import { Image } from 'expo-image';

/** Native (yüzen) tab bar haritanın üstünde durur; attribution ve düğmeler onun üstünde kalmalı (§21.1). */
const NATIVE_TAB_BAR_HEIGHT = 58;
/** Tutamaç alanı (SheetGrabber: padding + çubuk). */
const GRABBER_HEIGHT = 18;

/** Keşfet / harita ekranı (§7.2). Sheet ve harita jestleri yarışmaz: kart dock'lu, harita altta. */
export function ExploreScreen() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const city = useCity();
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingOnly, setTrendingOnly] = useState(false);
  const [viewport, setViewport] = useState<{ bbox: BBox; zoom: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [listMode, setListMode] = useState(false);
  /** Aynı noktadaki mekanlar için seçim listesi (§7.2); pin seçilince kapanır. */
  const [clusterPick, setClusterPick] = useState<MapPlaceItemDto[] | null>(null);
  const [sheetDetent, setSheetDetent] = useState<SheetDetent>('peek');
  const reducedMotion = useReducedMotion();
  const [sheetHeight, setSheetHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const location = useForegroundLocation();

  const familyOnly = categories.length === 1 && categories[0] === 'family';
  const query = useMemo<MapPlacesQuery | null>(
    () => (viewport ? { bbox: viewport.bbox, zoom: viewport.zoom, categories, trendingOnly, familyOnly, locale: 'tr', limit: 100 } : null),
    [viewport, categories, trendingOnly, familyOnly],
  );
  const map = useMapPlaces(query);
  const searchResults = useSearchPlaces(search);

  const items = useMemo(() => (map.data?.items ?? []).filter((i): i is MapPlaceItemDto => i.type === 'place'), [map.data]);
  const serverClusters = useMemo(() => (map.data?.items ?? []).filter((i): i is MapClusterItemDto => i.type === 'cluster'), [map.data]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  useEffect(() => {
    if (clusterPick && !clusterPick.every((c) => items.some((i) => i.id === c.id))) setClusterPick(null);
  }, [items, clusterPick]);

  // Seçim değişince sheet kısa duruma döner: mekan/küme içeriği tek detent'lidir.
  const selectPlace = useCallback((id: string | null) => {
    setClusterPick(null);
    setSelectedId(id);
    setSheetDetent('peek');
  }, []);
  const pickCluster = useCallback((list: MapPlaceItemDto[]) => {
    setSelectedId(null);
    setClusterPick(list);
    setSheetDetent('peek');
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setClusterPick(null);
  }, []);

  const toggleCategory = useCallback((c: Category) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }, []);

  const onViewportSettled = useCallback((bbox: BBox, zoom: number) => setViewport({ bbox, zoom }), []);
  const userLocation = location.state.status === 'granted' ? location.state.coords : null;
  // Yazı ölçeğiyle büyüyen yükseklikler (HIG Dynamic Type): sabit pt'de büyük yazıda içerik kırpılıyordu.
  const { fontScale } = useWindowDimensions();
  // Native (yüzen) sekme çubuğunun yüksekliği güvenli alan payına ZATEN dahil; ayrıca eklemek alt sayfayla
  // çubuk arasında ~50 pt boş beyaz alan bırakıyordu (canlı ölçüm: insets.bottom 57, toplam 141).
  const tabBarAllowance = insets.bottom > 40 ? insets.bottom + spacing.xs : Math.min(NATIVE_TAB_BAR_HEIGHT * fontScale, 84) + insets.bottom;
  // Peek = tutamaç + başlık + kart; sabit 128 pt içerikten küçüktü, ölçüm ise geri besleme yüzünden büyüyordu.
  const SHEET_PEEK = GRABBER_HEIGHT + Math.round(114 * Math.min(fontScale, 1.6));
  const bottomInset = (sheetHeight || SHEET_PEEK) + tabBarAllowance;
  /** Tek sheet'in içeriği: seçili mekan → önizleme; küme → liste; yoksa yükselenler. */
  const sheetMode = selected ? 'place' : clusterPick ? 'cluster' : 'trending';
  const cityName = city.data?.name ?? '…';

  const openPlace = (id: string) => router.push({ pathname: '/places/[id]', params: { id } });
  const openSave = (id: string) => router.push({ pathname: '/save-to-collection', params: { venueId: id } });

  const header = (
    <View style={{ paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.lg, gap: spacing.md }} pointerEvents="box-none" onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      <GlassSurface style={{ alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.chip, overflow: 'hidden' }}>
        <Wordmark size={15} />
      </GlassSurface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <GlassSurface
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: dimensions.primaryButtonMinHeight,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.chip,
            overflow: 'hidden',
          }}
        >
          <Icon sf="magnifyingglass" material="search" size={20} color={colors.textPrimary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('explore.searchPlaceholder', { city: cityName })}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            accessibilityLabel={t('explore.searchPlaceholder', { city: cityName })}
            style={{ flex: 1, fontSize: 16, color: colors.textPrimary, paddingVertical: spacing.sm }}
            testID="explore-search"
          />
          {search.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setSearch('')} hitSlop={8}>
              <Icon sf="xmark.circle.fill" material="cancel" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(listMode ? 'explore.mapView' : 'explore.listView')}
            onPress={() => setListMode((v) => !v)}
            hitSlop={8}
            testID="explore-toggle-list"
          >
            <Icon sf={listMode ? 'map' : 'list.bullet'} material={listMode ? 'map' : 'list'} size={20} color={colors.textPrimary} />
          </Pressable>
        </GlassSurface>
        <DemoBadge compact />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }} keyboardShouldPersistTaps="handled">
        {CATEGORIES.map((c) => (
          <CategoryChip key={c} category={c} selected={categories.includes(c)} onPress={toggleCategory} />
        ))}
      </ScrollView>
      {location.state.status === 'denied' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.cardSmall, padding: spacing.md }}>
          <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>
            {t('explore.locationDenied')}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('explore.locationSettings')} onPress={() => Linking.openSettings()}>
            <ThemedText variant="helperStrong" style={{ color: colors.primaryAction }}>
              {t('explore.locationSettings')}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const listData = search.trim().length >= 2 ? (searchResults.data ?? []) : items;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {listMode || search.trim().length >= 2 ? (
        <FlatList
          data={listData}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('a11y.mapAlternativeList')}
          contentContainerStyle={{ paddingBottom: NATIVE_TAB_BAR_HEIGHT + insets.bottom + spacing.xl, gap: spacing.sm }}
          ListEmptyComponent={
            map.isLoading ? (
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <SkeletonBlock height={72} />
                <SkeletonBlock height={72} />
              </View>
            ) : map.isError ? (
              // Liste modunda hata da gösterilir; önceden yalnız haritada vardı ve liste "sonuç yok" diyordu.
              <View style={{ padding: spacing.lg }}>
                <ErrorState message={t('common.error')} retryTitle={t('common.retry')} onRetry={() => map.refetch()} />
              </View>
            ) : (
              <EmptyState title={t('explore.emptyFilter')} hint={t('explore.emptyFilterHint')} actionTitle={t('explore.clearFilters')} onAction={() => { setCategories([]); setTrendingOnly(false); setSearch(''); }} testID="explore-empty" />
            )
          }
          renderItem={({ item }) => {
            const meta = CATEGORY_META[item.category];
            return (
              <Link href={{ pathname: '/places/[id]', params: { id: item.id } }} asChild>
                <Link.Trigger>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${t(meta.labelKey)}`}
                style={{ marginHorizontal: spacing.lg }}
                testID={`list-${item.id}`}
              >
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: hairline }}>
                  <View>
                    {item.media.thumbnailUrl && item.media.mode !== 'unavailable' ? (
                      <Image source={{ uri: item.media.thumbnailUrl }} contentFit="cover" transition={durations.fast} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: categoryTint(item.category) }} accessibilityIgnoresInvertColors />
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: categoryTint(item.category), alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={20} color={categoryTextColor(item.category)} />
                      </View>
                    )}
                    <VenueLogo url={item.logoUrl} size={22} style={{ position: 'absolute', right: -5, bottom: -5 }} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText variant="headline" numberOfLines={2}>
                      {item.name}
                    </ThemedText>
                    <ThemedText variant="helper" tone="secondary">
                      {t(meta.labelKey)}
                      {item.neighborhood ? ` · ${item.neighborhood}` : ''}
                    </ThemedText>
                  </View>
                  {item.trend.score !== null ? <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" /> : null}
                </View>
              </Pressable>
                </Link.Trigger>
                <Link.Preview />
                <Link.Menu>
                  <Link.MenuAction icon="bookmark" onPress={() => openSave(item.id)}>
                    {t('place.save')}
                  </Link.MenuAction>
                  <Link.MenuAction icon="calendar.badge.plus" onPress={() => router.push({ pathname: '/add-to-plan', params: { venueId: item.id } })}>
                    {t('place.addToDay')}
                  </Link.MenuAction>
                </Link.Menu>
              </Link>
            );
          }}
        />
      ) : (
        <>
          <View style={{ flex: 1 }}>
            {city.data ? (
              <VenueMap
                items={items}
                serverClusters={serverClusters}
                selectedId={selectedId}
                onSelect={selectPlace}
                onClusterSelect={pickCluster}
                initialCamera={{ center: city.data.center, zoom: 12 }}
                onViewportSettled={onViewportSettled}
                bottomInset={bottomInset}
                topInset={headerHeight + spacing.sm}
                userLocation={userLocation}
                focus={userLocation}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.background }} />
            )}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
              {header}
            </View>
            {map.isError ? (
              <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, top: insets.top + 160 }}>
                <ErrorState message={t('common.error')} retryTitle={t('common.retry')} onRetry={() => map.refetch()} />
              </View>
            ) : null}
            {!map.isLoading && items.length === 0 && viewport ? (
              <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxxl * 2 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', boxShadow: shadows.raised }}>
                  <EmptyState title={t('explore.emptyFilter')} hint={t('explore.emptyFilterHint')} actionTitle={t('explore.clearFilters')} onAction={() => { setCategories([]); setTrendingOnly(false); }} testID="explore-empty" />
                </View>
              </View>
            ) : null}
            <View style={{ position: 'absolute', right: spacing.lg, bottom: bottomInset + spacing.lg }}>
              <IconButton accessibilityLabel={t('explore.nearMe')} onPress={() => location.request()} testID="explore-near-me">
                <Icon sf="location.fill" material="my-location" size={20} color={colors.textPrimary} />
              </IconButton>
            </View>
          </View>
          <MapSheet
            peekHeight={SHEET_PEEK}
            bottomInset={tabBarAllowance}
            detent={sheetDetent}
            maxDetent={sheetMode === 'trending' ? 'half' : 'peek'}
            onDetentChange={setSheetDetent}
            onDismissBelowPeek={sheetMode === 'trending' ? undefined : clearSelection}
            onHeightChange={setSheetHeight}
            testID="map-sheet"
          >
            {/* İçerik anahtarla değişir; yükseklik ölçülen içeriğe yaylanır, içerik kısa bir solmayla gelir. */}
            <Animated.View key={sheetMode === 'place' ? `place-${selected!.id}` : sheetMode} entering={reducedMotion ? undefined : FadeIn.duration(durations.fast)}>
              {sheetMode === 'place' ? (
                <PlacePreviewCard item={selected!} asOf={map.data?.asOf ?? new Date().toISOString()} userLocation={userLocation} onOpen={openPlace} onSave={openSave} onDismiss={clearSelection} />
              ) : sheetMode === 'cluster' ? (
                <ClusterSelectionCard items={clusterPick!} onPick={selectPlace} onDismiss={clearSelection} />
              ) : map.isLoading ? (
                <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                  <SkeletonBlock height={14} width="40%" />
                  <SkeletonBlock height={80} />
                </View>
              ) : (
                <TrendingStrip items={items} onSelect={selectPlace} onOpen={openPlace} />
              )}
            </Animated.View>
          </MapSheet>
        </>
      )}
    </View>
  );
}
