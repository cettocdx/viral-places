import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { VenueLogo } from '@/components/venue-logo';
import { FlatList, Linking, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapClusterItemDto, MapPlaceItemDto, MapPlacesQuery } from '@viral-places/contracts';
import { CATEGORIES, CATEGORY_META, type BBox, type Category } from '@viral-places/domain';
import { categoryTextColor, categoryTint, colors, dimensions, durations, hairline, mapTheme, radius, shadows, spacing, type } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useForegroundLocation } from '@/hooks/use-foreground-location';
import { useCity, useMapPlaces, useSearchPlaces } from '@/lib/api/hooks';
import { locativeTr } from '@/lib/turkish';

import { CategoryChip, FilterChip, TrendingChip } from '@/components/category-chip';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/button';
import { PlaceCallout } from '@/components/map/place-callout';
import { pinTopExtent } from '@/components/map/venue-marker';
import { calloutFrame, calloutMaxHeight, calloutWidth } from '@/lib/callout-layout';
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

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}
/** Native (yüzen) tab bar haritanın üstünde durur; attribution ve düğmeler onun üstünde kalmalı (§21.1). */
const NATIVE_TAB_BAR_HEIGHT = 58;
/** Tutamaç alanı (SheetGrabber: padding + çubuk). */
const GRABBER_HEIGHT = 24;

/** Keşfet / harita ekranı (§7.2). Sheet ve harita jestleri yarışmaz: kart dock'lu, harita altta. */
export function ExploreScreen() {
  const { t, locale } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const city = useCity();
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingOnly, setTrendingOnly] = useState(false);
  const [viewport, setViewport] = useState<{ bbox: BBox; zoom: number } | null>(null);
  // A camera refresh can temporarily exclude the chosen venue. Keep its card/player until explicit dismissal.
  const [selected, setSelected] = useState<MapPlaceItemDto | null>(null);
  const selectedId = selected?.id ?? null;
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [listMode, setListMode] = useState(false);
  const listActive = listMode || search.trim().length >= 2;
  /** Aynı noktadaki mekanlar için seçim listesi (§7.2); pin seçilince kapanır. */
  const [clusterPick, setClusterPick] = useState<MapPlaceItemDto[] | null>(null);
  const [sheetDetent, setSheetDetent] = useState<SheetDetent>('peek');
  const reducedMotion = useReducedMotion();
  const [sheetHeight, setSheetHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  /** Seçili pinin ekran noktası ve üstündeki kartın yüksekliği (ADR-020). */
  const [calloutPoint, setCalloutPoint] = useState<{ x: number; y: number } | null>(null);
  const [measuredCallout, setMeasuredCallout] = useState(0);
  const location = useForegroundLocation();

  const familyOnly = categories.length === 1 && categories[0] === 'family';
  const query = useMemo<MapPlacesQuery | null>(
    () => (viewport ? { bbox: viewport.bbox, zoom: viewport.zoom, categories, trendingOnly, familyOnly, locale, limit: 200 } : null),
    [viewport, categories, trendingOnly, familyOnly, locale],
  );
  const map = useMapPlaces(query);
  const searchResults = useSearchPlaces(search);

  const items = useMemo(() => (map.data?.items ?? []).filter((i): i is MapPlaceItemDto => i.type === 'place'), [map.data]);
  const serverClusters = useMemo(() => (map.data?.items ?? []).filter((i): i is MapClusterItemDto => i.type === 'cluster'), [map.data]);
  const mapItems = useMemo(() => selected && !items.some((item) => item.id === selected.id) ? [...items, selected] : items, [items, selected]);
  useEffect(() => {
    setSelected(null);
    setClusterPick(null);
  }, [city.data?.id, categories, trendingOnly]);

  useEffect(() => {
    if (clusterPick && !clusterPick.every((c) => items.some((i) => i.id === c.id))) setClusterPick(null);
  }, [items, clusterPick]);

  // Seçim değişince sheet kısa duruma döner: mekan/küme içeriği tek detent'lidir.
  const selectPlace = useCallback((id: string | null) => {
    setClusterPick(null);
    setSelected((previous) => id ? items.find((item) => item.id === id) ?? (previous?.id === id ? previous : null) : null);
    setSheetDetent('peek');
  }, [items]);
  const pickCluster = useCallback((list: MapPlaceItemDto[]) => {
    setSelected(null);
    setClusterPick(list);
    setSheetDetent('peek');
  }, []);
  const clearSelection = useCallback(() => {
    setSelected(null);
    setClusterPick(null);
  }, []);
  useEffect(() => {
    setCalloutPoint(null);
    setMeasuredCallout(0);
  }, [selectedId]);

  const toggleCategory = useCallback((c: Category) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }, []);

  const onViewportSettled = useCallback((bbox: BBox, zoom: number) => setViewport({ bbox, zoom }), []);
  const userLocation = location.state.status === 'granted' ? location.state.coords : null;
  // Yazı ölçeğiyle büyüyen yükseklikler (HIG Dynamic Type): sabit pt'de büyük yazıda içerik kırpılıyordu.
  const { fontScale, height: screenHeight, width: screenWidth } = useWindowDimensions();
  // Native (yüzen) sekme çubuğunun yüksekliği güvenli alan payına ZATEN dahil; ayrıca eklemek alt sayfayla
  // çubuk arasında ~50 pt boş beyaz alan bırakıyordu (canlı ölçüm: insets.bottom 57, toplam 141).
  const tabBarAllowance = insets.bottom > 40 ? insets.bottom + spacing.xs : Math.min(NATIVE_TAB_BAR_HEIGHT * fontScale, 84) + insets.bottom;
  // Peek = tutamaç + başlık + kart; sabit 128 pt içerikten küçüktü, ölçüm ise geri besleme yüzünden büyüyordu.
  const SHEET_PEEK = GRABBER_HEIGHT + Math.round(114 * Math.min(fontScale, 1.6));
  const maxSheetHeight = Math.max(180, Math.min(screenHeight * 0.58, screenHeight - headerHeight - tabBarAllowance - mapTheme.marker.height - spacing.xxxl));
  // Seçili mekan alt sayfada değil, pinin üstündeki kartta: sayfa kalkar, harita aşağıya kadar açılır.
  const bottomInset = selected ? tabBarAllowance + spacing.sm : (sheetHeight || SHEET_PEEK) + tabBarAllowance + spacing.sm;
  /** Tek sheet'in içeriği: küme → liste; yoksa yükselenler. Seçili mekan sayfada gösterilmez. */
  const sheetMode = clusterPick ? 'cluster' : 'trending';
  const cardWidth = calloutWidth(screenWidth);
  const pinExtent = pinTopExtent(true, true);
  const mapTopInset = headerHeight + spacing.sm;
  const cardMaxHeight = calloutMaxHeight({ screenHeight, topInset: mapTopInset, bottomInset, pinExtent, tailHeight: mapTheme.callout.tailHeight });
  // Ölçülene kadar önizleme yüksekliği tahmini: kare fotoğraf + iki satır.
  const cardHeight = Math.min(measuredCallout || Math.round(cardWidth * 0.97 + 76), cardMaxHeight);
  const frame = calloutPoint ? calloutFrame({ point: calloutPoint, screenWidth, cardWidth, cardHeight, pinExtent, tailHeight: mapTheme.callout.tailHeight, tailWidth: mapTheme.callout.tailWidth, cornerRadius: mapTheme.callout.radius }) : null;
  const cityName = city.data?.name ?? '…';
  // Konuma odak yalnız kullanıcı seçili şehrin kapsamındaysa: İstanbul'daki kullanıcı Paris'i seçince harita geri çekilmesin.
  const userInCity = !!(userLocation && city.data && distanceKm(userLocation, city.data.center) <= (city.data.radiusKm ?? 30) + 10);

  const openPlace = (id: string) => router.push({ pathname: '/places/[id]', params: { id } });
  const openSave = (id: string) => router.push({ pathname: '/save-to-collection', params: { venueId: id } });

  const onMap = !listActive;
  const chromeText = onMap ? mapTheme.text : colors.textPrimary;
  const searchPlaceholder = t('explore.searchPlaceholder', { city: cityName, cityLoc: city.data ? locativeTr(cityName) : cityName });
  useFocusEffect(useCallback(() => {
    setStatusBarStyle(onMap ? 'light' : 'auto');
    return () => setStatusBarStyle('auto');
  }, [onMap]));

  const header = (
    <View
      style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xs }}
      pointerEvents="box-none"
      onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {searchOpen ? (
          <GlassSurface appearance={onMap ? 'map' : 'surface'} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: dimensions.primaryButtonMinHeight, paddingHorizontal: spacing.lg, borderRadius: radius.chip, overflow: 'hidden' }}>
            <Icon sf="magnifyingglass" material="search" size={20} color={chromeText} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor={onMap ? mapTheme.textMuted : colors.textSecondary}
              returnKeyType="search"
              autoFocus
              accessibilityLabel={searchPlaceholder}
              style={{ flex: 1, fontSize: type.body.fontSize, color: chromeText, paddingVertical: spacing.sm }}
              testID="explore-search"
            />
          </GlassSurface>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={t('cityPicker.change', { city: cityName })} onPress={() => router.push('/city-picker')} style={{ flex: 1 }} testID="explore-city-picker">
            <GlassSurface appearance={onMap ? 'map' : 'surface'} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: dimensions.primaryButtonMinHeight, paddingHorizontal: spacing.lg, borderRadius: radius.chip, overflow: 'hidden', maxWidth: '100%' }}>
              <Wordmark size={14} color={chromeText} />
              <ThemedText variant="helperStrong" numberOfLines={1} style={{ color: chromeText, flexShrink: 1 }}>{cityName}</ThemedText>
              <Icon sf="chevron.down" material="expand-more" size={11} color={chromeText} />
            </GlassSurface>
          </Pressable>
        )}
        <IconButton
          appearance={onMap ? 'map' : 'surface'}
          accessibilityLabel={searchOpen ? t('common.close') : t('explore.search')}
          onPress={() => { if (searchOpen) setSearch(''); setSearchOpen((v) => !v); }}
          testID="explore-toggle-search"
        >
          <Icon sf={searchOpen ? 'xmark' : 'magnifyingglass'} material={searchOpen ? 'close' : 'search'} size={20} color={chromeText} />
        </IconButton>
        {!searchOpen ? (
          <IconButton appearance={onMap ? 'map' : 'surface'} accessibilityLabel={t(listActive ? 'explore.mapView' : 'explore.listView')} onPress={() => setListMode((v) => !v)} testID="explore-toggle-list">
            <Icon sf={listActive ? 'map' : 'list.bullet'} material={listActive ? 'map' : 'list'} size={20} color={chromeText} />
          </IconButton>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }} keyboardShouldPersistTaps="handled">
        <FilterChip
          label={t('creator.allCategories')}
          selected={categories.length === 0 && !trendingOnly}
          onPress={() => { setCategories([]); setTrendingOnly(false); }}
          fill={onMap ? categories.length === 0 && !trendingOnly ? mapTheme.paper : mapTheme.chrome : colors.surface}
          borderColor={onMap ? mapTheme.chromeBorder : hairline}
          textColor={onMap ? categories.length === 0 && !trendingOnly ? mapTheme.ink : mapTheme.text : colors.textPrimary}
          testID="chip-all"
        />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c} category={c} selected={categories.includes(c)} onPress={toggleCategory} appearance={onMap ? 'map' : 'surface'} />
        ))}
        <TrendingChip selected={trendingOnly} onPress={() => setTrendingOnly((v) => !v)} appearance={onMap ? 'map' : 'surface'} />
      </ScrollView>
      {location.state.status === 'denied' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.cardSmall, padding: spacing.md }}>
          <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>{t('explore.locationDenied')}</ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('explore.locationSettings')} onPress={() => Linking.openSettings()} style={{ minHeight: dimensions.iosTouchTargetMin, justifyContent: 'center' }}>
            <ThemedText variant="helperStrong" style={{ color: colors.primaryAction }}>{t('explore.locationSettings')}</ThemedText>
          </Pressable>
        </View>
      ) : null}
      <DemoBadge compact />
    </View>
  );

  const searching = search.trim().length >= 2;
  const listLoading = searching ? searchResults.isLoading : city.isLoading || map.isLoading;
  const listError = searching ? searchResults.isError : city.isError || map.isError;
  const listData = (searching ? searchResults.data ?? [] : items).filter((item) =>
    (categories.length === 0 || categories.includes(item.category)) &&
    (!trendingOnly || item.trend.trending) && (!familyOnly || item.familySupported),
  );

  return (
    <View style={{ flex: 1, backgroundColor: onMap ? mapTheme.background : colors.background }}>
      {listActive ? (
        <FlatList
          data={listData}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('a11y.mapAlternativeList')}
          contentContainerStyle={{ paddingBottom: NATIVE_TAB_BAR_HEIGHT + insets.bottom + spacing.xl, gap: spacing.sm }}
          ListEmptyComponent={
            listLoading ? (
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                <SkeletonBlock height={72} />
                <SkeletonBlock height={72} />
              </View>
            ) : listError ? (
              // Liste modunda hata da gösterilir; önceden yalnız haritada vardı ve liste "sonuç yok" diyordu.
              <View style={{ padding: spacing.lg }}>
                <ErrorState message={t('explore.dataUnavailable')} retryTitle={t('common.retry')} onRetry={() => { if (searching) void searchResults.refetch(); else { void city.refetch(); void map.refetch(); } }} />
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
                  <View style={{ flex: 1, gap: spacing.xxs }}>
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
            {city.data && headerHeight > 0 && sheetHeight > 0 ? (
              <VenueMap
                appearance="immersive"
                key={city.data.id}
                items={mapItems}
                serverClusters={serverClusters}
                selectedId={selectedId}
                onSelect={selectPlace}
                onClusterSelect={pickCluster}
                initialCamera={{ center: city.data.center, zoom: 12 }}
                onViewportSettled={onViewportSettled}
                bottomInset={bottomInset}
                topInset={mapTopInset}
                userLocation={userLocation}
                focus={userInCity ? userLocation : null}
                onSelectedPoint={setCalloutPoint}
                calloutHeight={cardHeight}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: mapTheme.background }} />
            )}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
              {header}
            </View>
            {city.isError || map.isError ? (
              <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, top: headerHeight + spacing.md }}>
                <ErrorState message={t('explore.dataUnavailable')} retryTitle={t('common.retry')} onRetry={() => { void city.refetch(); void map.refetch(); }} />
              </View>
            ) : null}
            {!selected && !map.isLoading && !map.isError && !city.isError && items.length === 0 && serverClusters.length === 0 && viewport ? (
              <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxxl * 2 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', boxShadow: shadows.raised }}>
                  <EmptyState title={t('explore.emptyFilter')} hint={t('explore.emptyFilterHint')} actionTitle={t('explore.clearFilters')} onAction={() => { setCategories([]); setTrendingOnly(false); }} testID="explore-empty" />
                </View>
              </View>
            ) : null}
            {selected && frame ? (
              <View style={{ position: 'absolute', left: frame.left, top: frame.top }} pointerEvents="box-none">
                <PlaceCallout
                  key={selected.id}
                  item={selected}
                  cityName={city.data?.name ?? null}
                  width={cardWidth}
                  maxHeight={cardMaxHeight}
                  tailX={frame.tailX}
                  onOpen={openPlace}
                  onSave={openSave}
                  onDismiss={clearSelection}
                  onHeightChange={setMeasuredCallout}
                />
              </View>
            ) : null}
            <View style={{ position: 'absolute', right: spacing.lg, bottom: bottomInset + spacing.lg }}>
              <IconButton appearance="map" accessibilityLabel={t('explore.nearMe')} onPress={() => location.request()} testID="explore-near-me">
                <Icon sf="location.fill" material="my-location" size={20} color={mapTheme.text} />
              </IconButton>
            </View>
          </View>
          {!selected ? (
          <MapSheet
            peekHeight={SHEET_PEEK}
            maxHeight={maxSheetHeight}
            bottomInset={tabBarAllowance}
            detent={sheetDetent}
            maxDetent="peek"
            grabberLabel={sheetMode === 'trending' ? t('explore.showList') : t('common.close')}
            onDetentChange={setSheetDetent}
            onDismissBelowPeek={sheetMode === 'trending' ? undefined : clearSelection}
            onGrabberPress={sheetMode === 'trending' ? () => setListMode(true) : clearSelection}
            onHeightChange={setSheetHeight}
            testID="map-sheet"
          >
            {/* İçerik anahtarla değişir; yükseklik ölçülen içeriğe yaylanır, içerik kısa bir solmayla gelir. */}
            <Animated.View key={sheetMode} entering={reducedMotion ? undefined : FadeIn.duration(durations.fast)}>
              {sheetMode === 'cluster' ? (
                <ClusterSelectionCard items={clusterPick!} onPick={selectPlace} onDismiss={clearSelection} />
              ) : city.isError || map.isError ? (
                <View style={{ padding: spacing.lg }}><ThemedText variant="helper" tone="secondary">{t('explore.dataUnavailable')}</ThemedText></View>
              ) : city.isLoading || map.isLoading ? (
                <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                  <SkeletonBlock height={14} width="40%" />
                  <SkeletonBlock height={80} />
                </View>
              ) : (
                <TrendingStrip items={items} onSelect={selectPlace} onOpen={openPlace} onShowList={() => setListMode(true)} />
              )}
            </Animated.View>
          </MapSheet>
          ) : null}
        </>
      )}
    </View>
  );
}
