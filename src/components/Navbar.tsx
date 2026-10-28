import React, { useState } from 'react';
import { PageView } from '../types';
import { useStore } from '../data/store';
import {
  Menu,
  X,
  ShoppingBag,
  Images,
  Phone,
  Calendar,
  Scissors,
  LogIn,
} from 'lucide-react';

interface NavbarProps {
  currentPage: PageView;
  setCurrentPage: (page: PageView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  const { establishment, isSupabaseConfigured } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { label: string; page: PageView; icon?: React.ReactNode }[] = [
    { label: 'Início', page: 'home' },
    { label: 'Serviços', page: 'servicos', icon: <Scissors className="h-4 w-4" /> },
    { label: 'Produtos', page: 'produtos', icon: <ShoppingBag className="h-4 w-4" /> },
    { label: 'Galeria', page: 'galeria', icon: <Images className="h-4 w-4" /> },
    { label: 'Contato', page: 'contato', icon: <Phone className="h-4 w-4" /> },
  ];

  const handleNavClick = (page: PageView) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/95">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <button
            onClick={() => handleNavClick('home')}
            className="flex min-w-0 items-center gap-2.5 text-left"
            aria-label="Ir para o início"
          >
            <img
              src={establishment.logoUrl || '/icon.svg'}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="max-w-[190px] truncate text-sm font-semibold tracking-tight text-neutral-100 sm:max-w-[260px] sm:text-base">
              {establishment.name}
            </span>
          </button>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                aria-current={currentPage === item.page ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentPage === item.page
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => handleNavClick('agendamento')}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-amber-400 sm:px-4"
            >
              <Calendar className="h-4 w-4" />
              <span>Agendar</span>
            </button>

            <button
              onClick={() => { window.location.href = '/plataforma/acesso?mode=login'; }}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-neutral-800 px-3.5 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-900 hover:text-white"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
