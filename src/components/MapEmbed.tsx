import React from 'react';

export interface MapEmbedProps {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mapsUrl?: string | null;
  className?: string;
}

/**
 * Shared Google Maps embed. A map is rendered only when a real address,
 * city or coordinate pair is available; a Maps hyperlink alone is not a map.
 */
export const MapEmbed: React.FC<MapEmbedProps> = ({
  name, address, city, state, latitude, longitude, mapsUrl, className = '',
}) => {
  const hasCoordinates =
    typeof latitude === 'number' && Number.isFinite(latitude) &&
    typeof longitude === 'number' && Number.isFinite(longitude);
  const location = hasCoordinates
    ? `${latitude},${longitude}`
    : [address, city, state].filter((part) => typeof part === 'string' && part.trim()).join(', ');
  if (!location.trim()) return null;

  const query = encodeURIComponent(location);
  const embedUrl = `https://maps.google.com/maps?q=${query}&z=16&output=embed`;
  const externalUrl = mapsUrl || `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 ${className}`}
      onClick={() => window.open(externalUrl, '_blank')}
    >
      <iframe
        title={`Mapa de localização de ${name}`}
        src={embedUrl}
        className="h-[320px] w-full border-0 sm:h-[380px]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex items-center justify-between gap-3 border-t border-neutral-800 px-4 py-3">
        <span className="min-w-0 truncate text-xs text-neutral-400">{location}</span>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-amber-400 hover:underline">
          Abrir rota
        </a>
      </div>
    </div>
  );
};
