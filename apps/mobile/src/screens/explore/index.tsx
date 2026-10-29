import { useCallback, useEffect, useMemo, useState } from 'react';
import { VenueLogo } from '@/components/venue-logo';
import { FlatList, Linking, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapClusterItemDto, MapPlaceItemDto, MapPlacesQuery } from '@viral-places/contracts';
import { CATEGORIES, CATEGORY_META, type BBox, type Category } from '@viral-places/domain';
import { categoryColor, categoryTextColor, categoryTint, colors, dimensions, durations, hairline, mapTheme, radius, shadows, spacing, type } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useForegroundLocation } from '@/hooks/use-foreground-location';
import { useCity, useCityPlaces, useMapPlaces, usePrefetchPlaces, useSearchPlaces } from '@/lib/api/hooks';
import { locativeTr } from '@/lib/turkish';

import { CategoryChip, FilterChip, TrendingChip } from '@/components/category-chip';
import { STICKER_FONT } from '@/components/map/sticker-text';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/button';
import { PlaceCallout } from '@/components/map/place-callout';
import { PIN_THUMB_PX, pinTopExtent } from '@/components/map/venue-marker';
import { thumbUrl } from '@/lib/media-url';
import { calloutFrame, calloutMaxHeight, calloutWidth } from '@/lib/callout-layout';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';
import { VenueMap } from '@/components/map/venue-map';
import { MapSheet, type SheetDetent } from '@/components/map/map-sheet';
import { ClusterSelectionCard } from '@/components/map/cluster-selection-card';
import { ReelsFeed } from '@/components/reels/reels-feed';
import { AccountMenu, AvatarButton, CONTROL, ControlCluster } from '@/components/map/map-controls';
import { useLibraryStore } from '@/features/library/store';
import { GlassSurface } from '@/components/glass-surface';
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
  const [sheetHeight, setSheetHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  /** Seçili pinin ekran noktası ve üstündeki kartın yüksekliği (ADR-020). */
  const [calloutPoint, setCalloutPoint] = useState<{ x: number; y: number } | null>(null);
  const [measuredCallout, setMeasuredCallout] = useState(0);
  /** Temiz harita (ADR-024): kategori çipleri yalnız filtre düğmesiyle açılır. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const librarySaves = useLibraryStore((st) => st.library.saves.length);
  const libraryFollows = useLibraryStore((st) => st.library.follows.length);
  const filterActive = categories.length > 0 || trendingOnly;
  const [reelIndex, setReelIndex] = useState(0);
  const location = useForegroundLocation();

  const familyOnly = categories.length === 1 && categories[0] === 'family';
  const query = useMemo<MapPlacesQuery | null>(
    () => (viewport ? { bbox: viewport.bbox, zoom: viewport.zoom, categories, trendingOnly, familyOnly, locale, limit: 200 } : null),
    [viewport, categories, trendingOnly, familyOnly, locale],
  );
  const map = useMapPlaces(query);
  const cityPlaces = useCityPlaces(city.data);
  const searchResults = useSearchPlaces(search);

  const items = useMemo(() => (map.data?.items ?? []).filter((i): i is MapPlaceItemDto => i.type === 'place'), [map.data]);
  const serverClusters = useMemo(() => (map.data?.items ?? []).filter((i): i is MapClusterItemDto => i.type === 'cluster'), [map.data]);
  // Warm the pin covers as soon as the places arrive: pins render with photos instead of placeholders (ADR-027).
  // The whole city's covers too, so panning around shows photos at once (owner, 29.10.2026).
  useEffect(() => {
    // Same cache as the pins (expo-image, memory + disk): a prefetched cover shows without a network trip.
    const urls = [...items, ...(cityPlaces.data ?? [])].map((i) => (i.media.mode !== 'unavailable' ? thumbUrl(i.media.thumbnailUrl, PIN_THUMB_PX) : null)).filter((u): u is string => !!u);
    if (urls.length) void Image.prefetch([...new Set(urls)], 'memory-disk').catch(() => {});
  }, [items, cityPlaces.data]);
  const viewCenter = useMemo(() => (viewport ? { lat: (viewport.bbox.north + viewport.bbox.south) / 2, lng: (viewport.bbox.east + viewport.bbox.west) / 2 } : null), [viewport]);
  usePrefetchPlaces(items, viewCenter);
  // Haritada her zoomda şehrin tamamı (ürün sahibi, 29.10.2026): uzaktan bakınca sunucunun 200 sınırı başka şehirlerle
  // doluyor ve şehir 36 mekana düşüyordu. Görünen alanın sonucu + şehrin tüm mekanları (aynı filtrelerle), tekrarsız.
  const allPlaces = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i] as const));
    for (const i of cityPlaces.data ?? []) {
      if (byId.has(i.id)) continue;
      if ((categories.length === 0 || familyOnly || categories.includes(i.category)) && (!trendingOnly || i.trend.trending) && (!familyOnly || i.familySupported)) byId.set(i.id, i);
    }
    return [...byId.values()];
  }, [items, cityPlaces.data, categories, trendingOnly, familyOnly]);
  const mapItems = useMemo(() => (selected && !allPlaces.some((item) => item.id === selected.id) ? [...allPlaces, selected] : allPlaces), [allPlaces, selected]);
  useEffect(() => {
    setSelected(null);
    setClusterPick(null);
  }, [city.data?.id, categories, trendingOnly]);

  useEffect(() => {
    if (clusterPick && !clusterPick.every((c) => allPlaces.some((i) => i.id === c.id))) setClusterPick(null);
  }, [allPlaces, clusterPick]);

  // Seçim değişince sheet kısa duruma döner: mekan/küme içeriği tek detent'lidir.
  const selectPlace = useCallback((id: string | null) => {
    setClusterPick(null);
    setSelected((previous) => id ? allPlaces.find((item) => item.id === id) ?? (previous?.id === id ? previous : null) : null);
    setSheetDetent('peek');
  }, [allPlaces]);
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
  // Haritada sekme çubuğu gizli (ADR-024): alt pay yalnız güvenli alan.
  const tabBarAllowance = insets.bottom + spacing.xs;
  // Peek = tutamaç + başlık + kart; sabit 128 pt içerikten küçüktü, ölçüm ise geri besleme yüzünden büyüyordu.
  const SHEET_PEEK = GRABBER_HEIGHT + Math.round(114 * Math.min(fontScale, 1.6));
  const maxSheetHeight = Math.max(180, Math.min(screenHeight * 0.58, screenHeight - headerHeight - tabBarAllowance - mapTheme.marker.height - spacing.xxxl));
  // Seçili mekan alt sayfada değil, pinin üstündeki kartta: sayfa kalkar, harita aşağıya kadar açılır.
  /** Alt alan: seçili mekan → yalnız pin kartı; küme → liste sayfası; yoksa haritada yüzen fotoğraf kartları. */
  const sheetMode = clusterPick ? 'cluster' : 'trending';
  const bottomInset = selected ? tabBarAllowance + spacing.sm : sheetMode === 'cluster' ? (sheetHeight || SHEET_PEEK) + tabBarAllowance + spacing.sm : tabBarAllowance + spacing.sm;
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
  // Gece baskısı (ADR-021): her ekran koyu, durum çubuğu hep açık renk.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
  }, []));

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
          <Pressable accessibilityRole="button" accessibilityLabel={t('cityPicker.change', { city: cityName })} onPress={() => router.push('/city-picker')} hitSlop={8} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })} testID="explore-city-picker">
            {/* Temiz harita (ADR-024): referanstaki gibi yalnız şehir adı; hap/arka plan yok. */}
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 }}>
              <Text style={{ fontFamily: STICKER_FONT, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: chromeText, textShadowColor: onMap ? 'rgba(0,0,0,0.55)' : 'transparent', textShadowRadius: 8 }} numberOfLines={1}>{cityName}</Text>
              <Icon sf="chevron.down" material="expand-more" size={12} color={chromeText} weight="bold" />
            </View>
          </Pressable>
        )}
        {searchOpen || !onMap ? (
          <Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? t('common.close') : t('explore.search')} onPress={() => { if (searchOpen) setSearch(''); setSearchOpen((v) => !v); }} hitSlop={6} testID="explore-toggle-search">
            <GlassSurface appearance={onMap ? 'map' : 'surface'} style={{ width: CONTROL, height: CONTROL, borderRadius: CONTROL / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Icon sf={searchOpen ? 'xmark' : 'magnifyingglass'} material={searchOpen ? 'close' : 'search'} size={17} color={chromeText} />
            </GlassSurface>
          </Pressable>
        ) : (
          <>
            {/* Apple Maps–style grouped glass (ADR-025): search and filters share one capsule; the avatar opens the menu. */}
            <ControlCluster
              direction="row"
              items={[
                { key: 'search', sf: 'magnifyingglass', material: 'search', label: t('explore.search'), onPress: () => setSearchOpen(true), testID: 'explore-toggle-search' },
                { key: 'filter', sf: 'line.3.horizontal.decrease', material: 'filter-list', label: t('explore.filters'), onPress: () => setFiltersOpen((v) => !v), dot: filterActive, expanded: filtersOpen, testID: 'explore-toggle-filters' },
              ]}
            />
            <AvatarButton label={t('explore.menu')} open={menuOpen} onPress={() => setMenuOpen((v) => !v)} />
          </>
        )}
      </View>
      {filtersOpen || !onMap ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }} keyboardShouldPersistTaps="handled">
        <FilterChip
          compact={onMap}
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
      </ScrollView> : null}
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

  // "Bu haritada keşfet" / liste düğmesi: arama yoksa reels akışı (ADR-022); arama sonuçları liste olarak kalır.
  if (listMode && !searching) {
    // Önce ekranda görünenler, sonra şehrin geri kalanı (aynı filtrelerle); her mekan bir kez.
    const visibleIds = new Set(listData.map((i) => i.id));
    const rest = (cityPlaces.data ?? []).filter((item) => !visibleIds.has(item.id) && (categories.length === 0 || categories.includes(item.category)) && (!trendingOnly || item.trend.trending) && (!familyOnly || item.familySupported));
    const byTrend = (a: MapPlaceItemDto, b: MapPlaceItemDto) => Number(b.trend.trending) - Number(a.trend.trending) || (b.trend.score ?? -1) - (a.trend.score ?? -1);
    const reelItems = [...[...listData].sort(byTrend), ...rest.sort(byTrend)];
    return (
      <ReelsFeed
        items={reelItems}
        title={`${cityName} · ${t('saved.placesCount', { count: reelItems.length })}`}
        onClose={() => { setListMode(false); setReelIndex(0); }}
        initialIndex={reelIndex}
        onIndexChange={setReelIndex}
        onOpen={openPlace}
        onSave={openSave}
      />
    );
  }

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
            {city.data && headerHeight > 0 ? (
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
            {!selected ? (
              <View style={{ position: 'absolute', right: spacing.lg, bottom: bottomInset + spacing.md }}>
                <ControlCluster
                  items={[
                    ...(items.length > 0 || (cityPlaces.data?.length ?? 0) > 0 ? [{ key: 'reels', sf: 'play.fill', material: 'play-arrow', label: `${t('explore.onMap')}, ${t('saved.placesCount', { count: Math.max(items.length, cityPlaces.data?.length ?? 0) })}`, onPress: () => setListMode(true), emphasized: true, testID: 'explore-show-list' }] : []),
                    { key: 'near', sf: location.state.status === 'granted' ? 'location.fill' : 'location', material: 'my-location', label: t('explore.nearMe'), onPress: () => location.request(), testID: 'explore-near-me' },
                  ]}
                />
              </View>
            ) : null}
          </View>
          {menuOpen ? (
            <AccountMenu
              top={insets.top + spacing.sm + CONTROL + 10}
              title={t('profile.guest')}
              subtitle={t('profile.guestBody')}
              onClose={() => setMenuOpen(false)}
              rows={[
                { key: 'saved', sf: 'bookmark.fill', material: 'bookmark', label: t('tab.saved'), detail: String(librarySaves), color: categoryColor('food'), onPress: () => { setMenuOpen(false); router.navigate('/saved'); } },
                { key: 'following', sf: 'person.2.fill', material: 'group', label: t('tab.following'), detail: String(libraryFollows), color: categoryColor('nightlife'), onPress: () => { setMenuOpen(false); router.navigate('/following'); } },
                { key: 'profile', sf: 'gearshape.fill', material: 'settings', label: t('tab.profile'), color: categoryColor('sightseeing'), onPress: () => { setMenuOpen(false); router.navigate('/profile'); } },
              ]}
            />
          ) : null}
          {!selected && sheetMode === 'cluster' ? (
          <MapSheet
            peekHeight={SHEET_PEEK}
            maxHeight={maxSheetHeight}
            bottomInset={tabBarAllowance}
            detent={sheetDetent}
            maxDetent="peek"
            grabberLabel={t('common.close')}
            onDetentChange={setSheetDetent}
            onDismissBelowPeek={clearSelection}
            onGrabberPress={clearSelection}
            onHeightChange={setSheetHeight}
            testID="map-sheet"
          >
            <ClusterSelectionCard items={clusterPick!} onPick={selectPlace} onDismiss={clearSelection} />
          </MapSheet>
          ) : null}
        </>
      )}
    </View>
  );
}
