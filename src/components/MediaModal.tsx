import React from 'react';
import { MediaItem } from '../types';
import { useStore } from '../data/store';
import { X, Sparkles, MessageCircle, Play } from 'lucide-react';

interface MediaModalProps {
  media: MediaItem | null;
  onClose: () => void;
  whatsappNumber?: string;
}

export const MediaModal: React.FC<MediaModalProps> = ({ media, onClose, whatsappNumber }) => {
  const { store } = useStore();

  if (!media) return null;

  const cleanWhatsapp = (whatsappNumber || '').replace(/\D/g, '');
  const contactMessage = 'Olá! Vi o trabalho "' + media.title + '" (' + media.category + ') no site e gostaria de agendar um horário.';
  const contactUrl = cleanWhatsapp ? 'https://wa.me/' + cleanWhatsapp + '?text=' + encodeURIComponent(contactMessage) : store.buildWhatsAppUrl(contactMessage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2.5 rounded-full bg-neutral-950/80 text-neutral-300 hover:text-white hover:bg-neutral-950 border border-neutral-700 transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media Container */}
        <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden max-h-[65vh]">
          {media.type === 'video' ? (
            <div className={`w-full flex items-center justify-center ${media.isReelVertical ? 'max-w-xs aspect-[9/16]' : 'aspect-video'}`}>
              <video
                src={media.url}
                controls
                playsInline
                autoPlay
                className="w-full h-full object-contain rounded-lg"
              >
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>
          ) : (
            <img
              src={media.url}
              alt={media.title}
              className="w-full h-full max-h-[65vh] object-contain"
            />
          )}
        </div>

        {/* Details & CTA */}
        <div className="p-5 bg-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-neutral-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                {media.category}
              </span>
              {media.type === 'video' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                  <Play className="w-3 h-3 fill-neutral-400" /> Vídeo / Reel
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold font-display text-neutral-100">
              {media.title}
            </h3>
          </div>

          <a
            href={contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm shadow-md transition-all shrink-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-neutral-950" />
            <span>Quero esse estilo</span>
          </a>
        </div>
      </div>
    </div>
  );
};
