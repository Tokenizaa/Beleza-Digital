import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Eye, Globe2, Sparkles, Zap } from 'lucide-react';

export const HomePage: React.FC = () => {
  const goDemo = () => { window.location.href = '/demo'; };
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="/" className="font-bold tracking-tight text-lg">Beleza Digital</a>
          <div className="flex items-center gap-3">
            <a href="/plataforma/acesso?mode=login" className="hidden sm:inline text-sm text-neutral-300 hover:text-white">Entrar</a>
            <button onClick={goDemo} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-neutral-950 hover:bg-amber-400">Quero ver meu site</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300"><Sparkles className="h-4 w-4"/> Presença digital para negócios de beleza</div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Seu negócio merece um site que transforma visitas em agendamentos.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400">O Beleza Digital cria uma presença profissional para barbearias, salões e estética, com identidade, serviços e caminhos claros para o cliente agendar.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button onClick={goDemo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 font-bold text-neutral-950 hover:bg-amber-400">Quero ver meu site <ArrowRight className="h-5 w-5"/></button>
            <a href="#planos" className="inline-flex items-center justify-center rounded-xl border border-neutral-700 px-6 py-3.5 font-semibold hover:bg-neutral-900">Ver planos</a>
          </div>
        </div>
      </section>

      <section className="border-y border-neutral-800 bg-neutral-900/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
          {[['1. Mostre seu negócio',Globe2,'Um site profissional com seus serviços e sua identidade.'],['2. Personalize o modelo',Eye,'Escolha uma base e adapte o visual ao seu segmento.'],['3. Receba agendamentos',Zap,'CTAs e botão flutuante levam o cliente à ação.']].map(([title,Icon,desc]) => {
            const I=Icon as any; return <div key={title as string}><I className="mb-4 h-7 w-7 text-amber-400"/><h2 className="font-bold">{title as string}</h2><p className="mt-2 text-sm leading-relaxed text-neutral-400">{desc as string}</p></div>
          })}
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-wider text-amber-400">Planos</p><h2 className="mt-3 text-3xl font-bold">Escolha a presença digital certa para começar.</h2><p className="mt-3 text-neutral-400">Sem complicar: escolha o plano, veja o modelo e avance para colocar seu negócio online.</p></div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ['Essencial','Para começar com presença profissional','Site responsivo','Serviços e contato'],
            ['Profissional','Mais foco em conversão e agendamentos','Tudo do Essencial','Fluxos de agendamento','Personalização ampliada'],
            ['Premium','Uma experiência digital completa','Tudo do Profissional','Prioridade de personalização','Estrutura avançada']
          ].map((plan,i)=><article key={plan[0]} className={'rounded-2xl border p-6 '+(i===1?'border-amber-500 bg-amber-500/5':'border-neutral-800 bg-neutral-900/50')}>
            {i===1&&<div className="mb-4 text-xs font-bold text-amber-400">MAIS ESCOLHIDO</div>}
            <h3 className="text-xl font-bold">{plan[0]}</h3><p className="mt-2 text-sm text-neutral-400">{plan[1]}</p>
            <ul className="mt-6 space-y-3 text-sm text-neutral-300">{plan.slice(2).map(x=><li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400"/>{x}</li>)}</ul>
            <button onClick={goDemo} className="mt-8 w-full rounded-xl bg-neutral-100 px-4 py-3 font-bold text-neutral-950 hover:bg-white">Quero ver meu site</button>
          </article>)}
        </div>
      </section>

      <section className="border-t border-neutral-800 px-5 py-20 text-center">
        <Clock3 className="mx-auto h-8 w-8 text-amber-400"/><h2 className="mt-4 text-3xl font-bold">Veja como seu negócio pode ficar.</h2><p className="mx-auto mt-3 max-w-xl text-neutral-400">Abra a demonstração, alterne entre as variações e veja o modelo base funcionando.</p>
        <button onClick={goDemo} className="mt-7 rounded-xl bg-amber-500 px-7 py-3.5 font-bold text-neutral-950 hover:bg-amber-400">Quero ver meu site</button>
      </section>
    </main>
  );
};