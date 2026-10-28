import React, { useState } from 'react';
import { MediaCategory, MediaItem } from '../types';
import { useStore } from '../data/store';
import { MediaModal } from '../components/MediaModal';
import { InstagramSection } from '../components/InstagramSection';
import {
  Images,
  Play,
  Sparkles,
  Camera,
  Film,
  Instagram,
  ExternalLink,
} from 'lucide-react';

const CATEGORIES: ('Todas' | MediaCategory)[] = [
  'Todas',
  'Barbearia',
  'Cílios',
  'Sobrancelhas',
  'Cabelos',
  'Unhas',
  'Tranças',
  'Produtos',
  'Ambiente',
  'Outros',
];

export const GalleryPage: React.FC = () => {
  const { media, company, store } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);

  const filteredMedia = media.filter((item) => {
    const matchesCategory =
      selectedCategory === 'Todas' || item.category === selectedCategory;
    const matchesType =
      mediaTypeFilter === 'all' || item.type === mediaTypeFilter;
    return matchesCategory && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-widest">
          <Images className="w-3.5 h-3.5" />
          <span>Galeria do Estabelecimento</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold font-display uppercase tracking-wider text-neutral-100">
          Trabalhos, Fotos & Vídeos
        </h1>
        <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
          Adicione fotos e vídeos para apresentar os serviços, a equipe e o ambiente do seu estabelecimento.
        </p>
      </div>

      {/* Type Toggle (Todas, Fotos, Vídeos) */}
      <div className="flex items-center justify-center gap-2">
        <div className="inline-flex p-1 rounded-xl bg-neutral-900 border border-neutral-800">
          <button
            onClick={() => setMediaTypeFilter('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mediaTypeFilter === 'all'
                ? 'bg-amber-500 text-neutral-950 shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos ({media.length})
          </button>
          <button
            onClick={() => setMediaTypeFilter('image')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mediaTypeFilter === 'image'
                ? 'bg-amber-500 text-neutral-950 shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Fotos</span>
          </button>
          <button
            onClick={() => setMediaTypeFilter('video')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mediaTypeFilter === 'video'
                ? 'bg-amber-500 text-neutral-950 shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Vídeos & Reels</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 justify-start sm:justify-center no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
              selectedCategory === cat
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Media Grid (Mobile Optimized) */}
      {filteredMedia.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900/40 rounded-2xl border border-neutral-800">
          <Images className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-neutral-300">
            Nenhuma mídia encontrada nesta categoria
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            Novas fotos e vídeos podem ser adicionados através do Painel Administrativo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveMedia(item)}
              className="group relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 cursor-pointer hover:border-amber-500/50 transition-all aspect-square sm:aspect-4/5"
            >
              {item.type === 'video' ? (
                <div className="w-full h-full relative bg-neutral-950 flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-neutral-700" />
                    </div>
                  )}

                  {/* Play badge */}
                  <div className="absolute inset-0 bg-neutral-950/40 flex items-center justify-center group-hover:bg-neutral-950/20 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-amber-500/90 text-neutral-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
                    </div>
                  </div>

                  {item.isReelVertical && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-950/90 text-amber-300 border border-amber-500/30">
                      Reel
                    </div>
                  )}
                </div>
              ) : (
                <img
                  src={item.url || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80'}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=400&q=80'; }}
                />
              )}

              {/* Tag & Title Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="flex justify-start">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-neutral-950/80 text-amber-300 border border-amber-500/20 backdrop-blur-xs">
                    {item.category}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-neutral-100 line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-amber-400 mt-0.5 font-medium">
                    Toque para ampliar
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instagram Embed & Feed Section */}
      <InstagramSection />

      {/* Media Detail Modal */}
      <MediaModal media={activeMedia} onClose={() => setActiveMedia(null)} />
    </div>
  );
};
