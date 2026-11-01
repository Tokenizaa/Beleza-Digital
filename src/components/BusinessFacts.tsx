import React from 'react';

export interface BusinessFactsProps {
  rating?: number | null;
  reviewCount?: number | string | null;
  priceRange?: string | null;
  status?: string | null;
  openingHours?: string | null;
  variation?: 'ouro-classico' | 'preto-esmeralda' | 'minimal-studio' | 'safira-executivo' | 'rubi-lounge';
}

/** Displays only facts actually captured from the business source. */
export const BusinessFacts: React.FC<BusinessFactsProps> = ({
  rating, reviewCount, priceRange, status, openingHours, variation = 'ouro-classico',
}) => {
  const reviews = typeof reviewCount === 'number' ? reviewCount.toLocaleString('pt-BR') : String(reviewCount ?? '').trim();
  const facts = [
    rating != null && Number.isFinite(Number(rating)) ? { label: 'Avaliação no Google', value: `${Number(rating).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/5` } : null,
    reviews ? { label: 'Avaliações', value: reviews } : null,
    priceRange?.trim() ? { label: 'Faixa de preço', value: priceRange.trim() } : null,
    status?.trim() ? { label: 'Funcionamento', value: status.trim() } : null,
    openingHours?.trim() ? { label: 'Horários', value: openingHours.trim() } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  if (!facts.length) return null;

  const styles = {
    'ouro-classico': 'border-amber-900/40 bg-[#17140f] text-amber-100',
    'preto-esmeralda': 'border-emerald-900/50 bg-[#090e0b] text-emerald-100',
    'minimal-studio': 'border-slate-200 bg-white text-slate-900',
    'safira-executivo': 'border-blue-900/60 bg-[#0b142d] text-blue-100',
    'rubi-lounge': 'border-rose-950 bg-[#1c080e] text-rose-100',
  };

  return (
    <section aria-label="Informações confirmadas do estabelecimento" className={`border-y px-4 py-8 sm:px-8 ${styles[variation]}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{fact.label}</p>
            <p className="mt-1 break-words text-sm font-semibold">{fact.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
