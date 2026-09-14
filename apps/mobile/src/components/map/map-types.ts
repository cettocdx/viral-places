import type { MapPlaceItemDto } from '@viral-places/contracts';
import type { BBox } from '@viral-places/domain';

export interface Camera {
  center: { lat: number; lng: number };
  /** Yaklaşık zoom (0–22). Demo yüzeyde sabit. */
  zoom: number;
}

export interface VenueMapProps {
  items: MapPlaceItemDto[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  initialCamera: Camera;
  /** Kamera hareketi bitince debounce ile çağrılır; her frame istek yok (§7.2). */
  onViewportSettled: (bbox: BBox, zoom: number) => void;
  /** Alt kart yüksekliği: attribution/pin alanı sheet altında kalmasın. */
  bottomInset: number;
  /** Üstteki arama/chip başlığı yüksekliği; pinler bu alanın altına yerleşir. */
  topInset?: number;
  userLocation: { lat: number; lng: number } | null;
  /** DEMO canvas'ta odaklanacak nokta ("Yakınımdakiler"). */
  focus?: { lat: number; lng: number } | null;
}
