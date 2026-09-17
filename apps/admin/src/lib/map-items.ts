/**
 * Harita yanıtı öğeleri (§19.3): düşük zoom'da mekanlar sunucuda kümelenir, aksi halde tek tek döner.
 * Filtreler (kategori/trend/aile) kümelemeden ÖNCE uygulanır; küme sayısı yalnız filtreyi geçen mekanları sayar.
 * Saf fonksiyon: route ince kalır, DB olmadan test edilir.
 */
import { MapClusterItemDto, type MapPlaceItemDto } from '@viral-places/contracts';
import { gridClusterAtZoom, shouldClusterOnServer } from '@viral-places/domain';

export type MapItemDto = MapPlaceItemDto | MapClusterItemDto;

export function toMapItems(places: readonly MapPlaceItemDto[], zoom: number): MapItemDto[] {
  if (!shouldClusterOnServer(zoom)) return [...places];
  return gridClusterAtZoom(places, zoom).map((node) =>
    node.type === 'place' ? node.item : MapClusterItemDto.parse({ type: 'cluster', id: node.id, location: node.location, count: node.count }),
  );
}
