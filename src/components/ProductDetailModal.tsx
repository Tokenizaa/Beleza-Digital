import React, { useState } from 'react';
import { ProductItem } from '../types';
import { useStore } from '../data/store';
import { X, MessageCircle, Check, AlertCircle, Sparkles } from 'lucide-react';

interface ProductDetailModalProps {
  product: ProductItem | null;
  onClose: () => void;
  whatsappNumber?: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  whatsappNumber,
}) => {
  const { store } = useStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!product) return null;

  const cleanWhatsapp = (whatsappNumber || '').replace(/\D/g, '');
  const purchaseMessage = 'Olá! Tenho interesse no produto ' + product.name + '.';
  const purchaseUrl = cleanWhatsapp ? 'https://wa.me/' + cleanWhatsapp + '?text=' + encodeURIComponent(purchaseMessage) : store.buildProductInquiryUrl(product.name);

  const currentImg = selectedImage || product.mainImage;
  const allImages = [
    product.mainImage,
    ...(product.additionalImages || []),
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-neutral-950/70 text-neutral-300 hover:text-white hover:bg-neutral-950 border border-neutral-700 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Image Gallery */}
            <div className="space-y-3">
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative">
                <img
                  src={currentImg}
                  alt={product.name}
                  className="w-full h-full object-cover transition-all"
                  loading="lazy"
                />
                {!product.available && (
                  <div className="absolute inset-0 bg-neutral-950/70 flex items-center justify-center">
                    <span className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-300 text-xs font-semibold uppercase tracking-wider">
                      Indisponível no momento
                    </span>
                  </div>
                )}
              </div>

              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(img)}
                      className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        currentImg === img
                          ? 'border-amber-400 scale-95'
                          : 'border-neutral-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="flex flex-col justify-between h-full space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {product.category}
                  </span>
                  {product.available ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> Em Estoque
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Consulte Disponibilidade
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-bold font-display text-neutral-100">
                  {product.name}
                </h3>

                <div className="text-2xl font-bold text-amber-400 font-display">
                  {typeof product.price === 'number'
                    ? `R$ ${product.price.toFixed(2).replace('.', ',')}`
                    : 'Consulte valor'}
                </div>

                <div className="border-t border-neutral-800/80 pt-3">
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Descrição do Produto
                  </h4>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </div>

              {/* WhatsApp Purchase CTA */}
              <div className="pt-4 border-t border-neutral-800/80">
                <a
                  href={purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm shadow-lg hover:shadow-emerald-600/30 transition-all transform active:scale-98"
                >
                  <MessageCircle className="w-5 h-5 fill-white" />
                  <span>Comprar pelo WhatsApp</span>
                </a>
                <p className="text-[11px] text-center text-neutral-400 mt-2">
                  Atendimento direto com a equipe do estabelecimento para consultar disponibilidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
