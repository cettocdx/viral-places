import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapPlacesQuery } from '@viral-places/contracts';
import { CATEGORIES, CATEGORY_META, type BBox, type Category } from '@viral-places/domain';
import { colors, hairline, radius, spacing, dimensions, categoryTextColor, categoryTint } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useForegroundLocation } from '@/hooks/use-foreground-location';
import { useCity, useMapPlaces, useSearchPlaces } from '@/lib/api/hooks';
import { appConfig } from '@/lib/config';
import { CategoryChip, TrendingChip } from '@/components/category-chip';
import { CoverageNotice } from '@/components/coverage-notice';
import { DemoBadge } from '@/components/demo-badge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/button';
import { PlacePreviewCard } from '@/components/place-preview-card';
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';
import { VenueMap } from '@/components/map/venue-map';
import { MapSheet, type SheetDetent } from '@/components/map/map-sheet';
import { TrendingStrip } from '@/components/trending-strip';
import { GlassSurface } from '@/components/glass-surface';
import { Link } from 'expo-router';

/** Native (yüzen) tab bar haritanın üstünde durur; attribution ve düğmeler onun üstünde kalmalı (§21.1). */
const NATIVE_TAB_BAR_HEIGHT = 58;

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
  const [cardHeight, setCardHeight] = useState(0);
  const [sheetDetent, setSheetDetent] = useState<SheetDetent>('peek');
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

  const items = useMemo(() => (map.data?.items ?? []).filter((i) => i.type === 'place'), [map.data]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null);
  }, [items, selectedId]);

  const toggleCategory = useCallback((c: Category) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }, []);

  const onViewportSettled = useCallback((bbox: BBox, zoom: number) => setViewport({ bbox, zoom }), []);
  const userLocation = location.state.status === 'granted' ? location.state.coords : null;
  const tabBarAllowance = NATIVE_TAB_BAR_HEIGHT + insets.bottom;
  const SHEET_PEEK = 128;
  const bottomInset = (selected ? cardHeight + spacing.xl : sheetHeight || SHEET_PEEK) + tabBarAllowance;
  const cityName = city.data?.name ?? '…';

  const openPlace = (id: string) => router.push({ pathname: '/places/[id]', params: { id } });
  const openSave = (id: string) => router.push({ pathname: '/save-to-collection', params: { venueId: id } });

  const header = (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.md }} pointerEvents="box-none" onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
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
        <TrendingChip selected={trendingOnly} onPress={() => setTrendingOnly((v) => !v)} />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c} category={c} selected={categories.includes(c)} onPress={toggleCategory} />
        ))}
      </ScrollView>
      {city.data ? <CoverageNotice coverage={city.data.coverage} /> : null}
      {location.state.status === 'denied' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.cardSmall, padding: spacing.md }}>
          <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>
            {t('explore.locationDenied')}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()}>
            <ThemedText variant="helper" style={{ color: colors.primaryAction, fontWeight: '600' }}>
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
                  <View style={{ width: 40, height: 40, borderRadius: radius.chip, backgroundColor: categoryTint(item.category), alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={18} color={categoryTextColor(item.category)} />
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
                  <ViralBadge score={item.trend.score} status={item.trend.status} trending={item.trend.trending} size="sm" />
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
                selectedId={selectedId}
                onSelect={setSelectedId}
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
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', boxShadow: '0 6px 16px rgba(17, 24, 39, 0.12)' }}>
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
          {selected ? (
            <View style={{ position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: tabBarAllowance + spacing.sm }}>
              <PlacePreviewCard item={selected} asOf={map.data?.asOf ?? new Date().toISOString()} userLocation={userLocation} onOpen={openPlace} onSave={openSave} onDismiss={() => setSelectedId(null)} onLayoutHeight={setCardHeight} />
            </View>
          ) : (
            <MapSheet
              peekHeight={SHEET_PEEK}
              bottomInset={tabBarAllowance}
              detent={sheetDetent}
              onDetentChange={setSheetDetent}
              onHeightChange={setSheetHeight}
              testID="map-sheet"
            >
              {map.isLoading ? (
                <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                  <SkeletonBlock height={14} width="40%" />
                  <SkeletonBlock height={80} />
                </View>
              ) : (
                <TrendingStrip items={items} onSelect={(id) => { setSelectedId(id); setSheetDetent('peek'); }} onOpen={openPlace} />
              )}
            </MapSheet>
          )}
        </>
      )}
      {!appConfig.googleMapsConfigured ? null : null}
    </View>
  );
}
