import React from 'react';
import { ArrowRight, Check, CalendarDays, Database, Globe2, LayoutTemplate, LogIn, Sparkles } from 'lucide-react';

const goDemo = () => { window.location.assign('/demo'); };

const templates = [
  { name: 'Ouro Clássico', detail: 'Elegância e apresentação premium', tone: 'bg-amber-400' },
  { name: 'Preto Esmeralda', detail: 'Presença urbana e marcante', tone: 'bg-emerald-500' },
  { name: 'Minimal Studio', detail: 'Visual limpo e essencial', tone: 'bg-stone-300' },
  { name: 'Safira Executivo', detail: 'Estética corporativa', tone: 'bg-blue-500' },
  { name: 'Rubi Lounge', detail: 'Experiência sofisticada', tone: 'bg-rose-500' },
];

function ScreenshotFrame({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex min-h-56 h-full items-center justify-center p-8 text-center">
          <div>
            <LayoutTemplate className="mx-auto h-8 w-8 text-amber-400" />
            <p className="mt-3 text-sm font-semibold text-neutral-200">Captura do template Ouro Clássico</p>
            <p className="mt-1 text-xs text-neutral-500">Imagem gerada pelo fluxo Playwright</p>
          </div>
        </div>
      )}
    </div>
  );
}

export const HomePage: React.FC = () => (
  <main className="min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-5 px-5 py-3">
        <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-neutral-950"><Sparkles className="h-5 w-5" /></span>
          Beleza Digital
        </a>
        <nav className="hidden items-center gap-6 text-sm text-neutral-400 md:flex">
          <a href="#plataforma" className="hover:text-white">Plataforma</a>
          <a href="#servicos" className="hover:text-white">Recursos</a>
          <a href="#modelos" className="hover:text-white">Modelos</a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="/plataforma/acesso?mode=login"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-semibold text-neutral-100 transition-colors hover:border-neutral-600 hover:bg-neutral-900"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </a>
          <button onClick={goDemo} className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-amber-400">
            Ver demonstração
          </button>
        </div>
      </div>
    </header>

    {/* 1. Hero */}
    <section data-landing-section="hero" className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:py-24 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
      <div>
        <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-amber-400">
          <Sparkles className="h-4 w-4" /> Presença digital para negócios da beleza
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
          Seu negócio merece uma presença digital à altura.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-neutral-400">
          Sites profissionais para barbearias, salões e espaços de estética, com apresentação dos serviços, contato e caminhos claros para agendamento.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={goDemo} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3.5 font-semibold text-neutral-950 hover:bg-amber-400">
            Explorar demonstração <ArrowRight className="h-4 w-4" />
          </button>
          <a href="#plataforma" className="rounded-lg border border-neutral-700 px-5 py-3.5 font-semibold text-neutral-200 hover:bg-neutral-900">
            Conhecer a plataforma
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-neutral-400">
          <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-amber-400" /> Feito para celular</span>
          <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-amber-400" /> Cinco identidades visuais</span>
          <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-amber-400" /> Dados conferíveis</span>
        </div>
      </div>
      <ScreenshotFrame
        src="/assets/landing/showcase/sections/hero.png"
        alt="Captura da seção inicial do template Ouro Clássico"
        className="aspect-[16/10] shadow-2xl"
      />
    </section>

    {/* 2. Plataforma integrada */}
    <section id="plataforma" data-landing-section="plataforma" className="border-y border-neutral-800 bg-neutral-900/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-400">Uma operação conectada</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Site, agenda e gestão no mesmo fluxo.</h2>
          <p className="mt-5 max-w-xl leading-7 text-neutral-400">
            A presença digital não termina na página. O estabelecimento pode organizar serviços, apresentar seu trabalho e conduzir clientes para os próximos passos.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-neutral-300">
            <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-amber-400" /> Caminho direto para agendamento e contato</li>
            <li className="flex items-center gap-3"><LayoutTemplate className="h-4 w-4 text-amber-400" /> Conteúdo alinhado ao modelo visual escolhido</li>
            <li className="flex items-center gap-3"><Globe2 className="h-4 w-4 text-amber-400" /> Site público independente do painel administrativo</li>
          </ul>
        </div>
        <ScreenshotFrame
          src="/assets/landing/showcase/sections/agendamento.png"
          alt="Captura da seção de agendamento do template Ouro Clássico"
          className="aspect-[16/10]"
        />
      </div>
    </section>

    {/* 3. Serviços e catálogo */}
    <section id="servicos" data-landing-section="servicos" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:py-20 lg:grid-cols-2 lg:items-center">
      <ScreenshotFrame
        src="/assets/landing/showcase/sections/servicos.png"
        alt="Captura dos serviços apresentados no template Ouro Clássico"
        className="aspect-[16/10] lg:order-1"
      />
      <div className="lg:order-2">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-400">Serviços e catálogo</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Apresente o que você faz com clareza.</h2>
        <p className="mt-5 leading-7 text-neutral-400">
          Serviços, descrições, preços e produtos podem compor uma vitrine organizada. O conteúdo exibido acompanha os dados disponíveis e não inventa informações ausentes.
        </p>
      </div>
    </section>

    {/* 4. Agenda e clientes */}
    <section id="agenda" data-landing-section="agenda" className="border-y border-neutral-800 bg-neutral-900/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-400">Relacionamento com clientes</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Menos atrito entre conhecer e entrar em contato.</h2>
          <p className="mt-5 leading-7 text-neutral-400">
            Informações de contato, localização e chamadas de ação ficam acessíveis em uma experiência responsiva, sem obrigar o visitante a procurar os dados.
          </p>
          <a href="/demo" className="mt-7 inline-flex items-center gap-2 font-semibold text-amber-400 hover:text-amber-300">
            Ver a experiência completa <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <ScreenshotFrame
          src="/assets/landing/showcase/sections/contato.png"
          alt="Captura da seção de contato do template Ouro Clássico"
          className="aspect-[16/10]"
        />
      </div>
    </section>

    {/* 5. Cinco templates */}
    <section id="modelos" data-landing-section="modelos" className="mx-auto max-w-7xl px-5 py-16 md:py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-400">Cinco modelos oficiais</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Uma estrutura. Cinco identidades visuais.</h2>
        <p className="mt-5 leading-7 text-neutral-400">Explore o primeiro modelo em detalhes e compare as cinco direções visuais disponíveis na demonstração.</p>
      </div>
      <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {templates.map((template, index) => (
          <div key={template.name} className="border-t border-neutral-800 py-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${template.tone}`} />
              <span className="text-sm font-semibold text-neutral-100">{index + 1}. {template.name}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">{template.detail}</p>
          </div>
        ))}
      </div>
      <ScreenshotFrame
        src="/assets/landing/showcase/ouro-classico-scroll.gif"
        alt="Animação vertical percorrendo a página completa do template Ouro Clássico"
        className="mt-8 aspect-[16/10] bg-neutral-950"
      />
      <p className="mt-3 text-xs text-neutral-500">Prévia ilustrativa do template Ouro Clássico. Os demais modelos podem ser explorados na demonstração.</p>
    </section>

    {/* 6. Dados e presença digital */}
    <section data-landing-section="dados" className="border-y border-neutral-800 bg-neutral-900/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-amber-400"><Database className="h-4 w-4" /> Dados com origem</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Sua presença digital começa com informações verificáveis.</h2>
          <p className="mt-5 leading-7 text-neutral-400">
            Dados públicos ajudam a montar a primeira versão. Informações ausentes ficam identificadas para complementação, e o estabelecimento pode revisar o conteúdo antes da publicação.
          </p>
        </div>
        <ScreenshotFrame
          src="/assets/landing/showcase/sections/galeria.png"
          alt="Captura da galeria visual do template Ouro Clássico"
          className="aspect-[16/10]"
        />
      </div>
    </section>

    {/* 7. CTA final */}
    <section data-landing-section="cta-final" className="mx-auto max-w-7xl px-5 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-400">Primeiro veja. Depois escolha.</p>
      <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Veja como seu negócio pode se apresentar online.</h2>
      <p className="mx-auto mt-5 max-w-2xl leading-7 text-neutral-400">Navegue pela demonstração completa, compare os cinco modelos e conheça a experiência antes de decidir.</p>
      <button onClick={goDemo} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-4 font-semibold text-neutral-950 hover:bg-amber-400">
        Abrir demonstração <ArrowRight className="h-4 w-4" />
      </button>
    </section>

    <footer className="border-t border-neutral-800 px-5 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-neutral-200">Beleza Digital</span>
        <div className="flex gap-5">
          <a href="/plataforma/acesso?mode=login" className="hover:text-white">Entrar</a>
          <a href="/demo" className="hover:text-white">Demonstração</a>
        </div>
      </div>
    </footer>
  </main>
);
