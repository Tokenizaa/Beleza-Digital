import React from 'react';
import { ArrowRight, Check, CheckCircle2, Eye, Globe2, LayoutTemplate, MessageCircle, Search, Sparkles, Star, Zap } from 'lucide-react';

const goDemo = () => { window.location.href = '/demo'; };

export const HomePage: React.FC = () => (
  <main className="min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2 font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500 text-neutral-950"><Sparkles className="h-5 w-5"/></span>Beleza Digital</a>
        <nav className="hidden gap-6 text-sm text-neutral-400 md:flex"><a href="#como-funciona" className="hover:text-white">Como funciona</a><a href="#modelos" className="hover:text-white">Modelos</a><a href="#planos" className="hover:text-white">Planos</a></nav>
        <button onClick={goDemo} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-amber-400">Quero ver meu site</button>
      </div>
    </header>

    <section className="relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.18),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(120,53,15,.18),transparent_30%)]"/>
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300"><Sparkles className="h-4 w-4"/> Sites profissionais para o mercado da beleza</div>
          <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-tight sm:text-7xl">Seu negócio é bonito.<br/><span className="text-amber-400">Seu site também precisa ser.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-neutral-400">O Beleza Digital transforma a presença online de barbearias, salões e negócios de estética em uma experiência profissional, feita para apresentar seu trabalho e facilitar novos agendamentos.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={goDemo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-4 font-bold text-neutral-950 hover:bg-amber-400">Quero ver meu site <ArrowRight className="h-5 w-5"/></button><a href="#como-funciona" className="inline-flex items-center justify-center rounded-xl border border-neutral-700 px-6 py-4 font-semibold hover:bg-neutral-900">Entender como funciona</a></div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-neutral-400"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-400"/>Feito para celular</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-400"/>Identidade personalizada</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-400"/>Caminhos para agendamento</span></div>
        </div>
        <button onClick={goDemo} className="group text-left">
          <div className="relative overflow-hidden rounded-[2rem] border border-neutral-700 bg-neutral-900 p-3 shadow-2xl">
            <div className="rounded-[1.4rem] border border-neutral-800 bg-neutral-950 p-6">
              <div className="flex items-center justify-between"><span className="font-bold">Seu negócio online</span><span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">Pronto para receber</span></div>
              <div className="mt-8 grid gap-4"><div className="h-40 rounded-2xl bg-gradient-to-br from-amber-500/35 to-neutral-800"/><div className="grid grid-cols-3 gap-3">{[1,2,3].map(i=><div key={i} className="h-20 rounded-xl border border-neutral-800 bg-neutral-900"/>)}</div><div className="h-14 rounded-xl bg-amber-500 text-center leading-[3.5rem] font-black text-neutral-950">AGENDAR AGORA</div></div>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-neutral-950/90 px-4 py-2 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">Clique para abrir a demonstração</div>
          </div>
        </button>
      </div>
    </section>

    <section id="como-funciona" className="border-y border-neutral-800 bg-neutral-900/40">
      <div className="mx-auto max-w-7xl px-5 py-20"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-amber-400">Simples e direto</p><h2 className="mt-4 text-4xl font-black tracking-tight">Da descoberta ao site pronto.</h2></div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">{[
        ['01','Encontramos o potencial do seu negócio',Search,'Partimos das informações, serviços e identidade que representam sua marca.'],
        ['02','Montamos uma presença que parece sua',LayoutTemplate,'Você visualiza o modelo e escolhe a direção que combina com seu negócio.'],
        ['03','Transformamos visitas em próximos passos',Zap,'Botões e chamadas claras conduzem o cliente para contato e agendamento.']
      ].map(([n,t,I,d])=>{const Icon=I as any;return <article key={n as string} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-7"><span className="text-xs font-black text-amber-400">{n as string}</span><Icon className="mt-7 h-7 w-7 text-white"/><h3 className="mt-5 text-xl font-bold">{t as string}</h3><p className="mt-3 leading-relaxed text-neutral-400">{d as string}</p></article>})}</div></div>
    </section>

    <section id="modelos" className="mx-auto max-w-7xl px-5 py-24">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-amber-400">Escolha visual</p><h2 className="mt-4 text-4xl font-black tracking-tight">Não mostramos um print. Mostramos o site funcionando.</h2><p className="mt-5 leading-relaxed text-neutral-400">Na demonstração você navega pelo modelo completo e troca entre as variações originais disponíveis no projeto.</p><button onClick={goDemo} className="mt-7 inline-flex items-center gap-2 font-bold text-amber-400 hover:text-amber-300">Explorar todos os modelos <ArrowRight className="h-4 w-4"/></button></div>
      <div className="grid gap-4 sm:grid-cols-2">{['Hero e apresentação da marca','Serviços e destaques','Galeria e prova visual','Informações e contato'].map((x,i)=><div key={x} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6"><Eye className="h-6 w-6 text-amber-400"/><h3 className="mt-5 font-bold">{x}</h3><p className="mt-2 text-sm text-neutral-400">Parte da experiência completa do modelo, não uma prévia simplificada.</p></div>)}</div></div>
    </section>

    <section className="bg-amber-500 px-5 py-16 text-neutral-950"><div className="mx-auto flex max-w-7xl flex-col gap-7 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-sm font-bold"><Star className="h-5 w-5 fill-current"/> Primeiro veja. Depois escolha.</div><h2 className="mt-3 text-4xl font-black tracking-tight">Você não precisa imaginar como vai ficar.</h2><p className="mt-3 max-w-2xl text-neutral-800">Abra a demonstração completa e explore os modelos antes de decidir.</p></div><button onClick={goDemo} className="rounded-xl bg-neutral-950 px-7 py-4 font-bold text-white hover:bg-neutral-900">Quero ver meu site</button></div></section>

    <section id="planos" className="mx-auto max-w-7xl px-5 py-24"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-amber-400">Planos</p><h2 className="mt-4 text-4xl font-black tracking-tight">Comece com o plano que faz sentido para o seu momento.</h2><p className="mx-auto mt-4 max-w-2xl text-neutral-400">Uma estrutura clara para sair da ideia e colocar seu negócio online.</p></div>
    <div className="mt-12 grid gap-5 lg:grid-cols-3">{[
      ['Essencial','Sua primeira presença profissional',['Site responsivo','Serviços e contatos','CTA para atendimento']],
      ['Profissional','Para transformar presença em oportunidade',['Tudo do Essencial','Mais personalização','Experiência ampliada']],
      ['Premium','Para uma presença digital mais completa',['Tudo do Profissional','Maior profundidade visual','Prioridade de personalização']]
    ].map(([name,desc,items],i)=><article key={name as string} className={'relative rounded-3xl border p-8 '+(i===1?'border-amber-500 bg-amber-500/5 shadow-xl shadow-amber-500/5':'border-neutral-800 bg-neutral-900/50')}>{i===1&&<span className="absolute -top-3 left-8 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black text-neutral-950">MAIS EQUILIBRADO</span>}<h3 className="text-2xl font-black">{name as string}</h3><p className="mt-3 min-h-12 text-neutral-400">{desc as string}</p><ul className="mt-7 space-y-3">{(items as string[]).map(x=><li key={x} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-amber-400"/>{x}</li>)}</ul><button onClick={goDemo} className={'mt-9 w-full rounded-xl px-4 py-3.5 font-bold '+(i===1?'bg-amber-500 text-neutral-950':'border border-neutral-700 hover:bg-neutral-800')}>Quero ver meu site</button></article>)}</div></section>

    <footer className="border-t border-neutral-800 px-5 py-10"><div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="font-bold">Beleza Digital</div><div className="flex gap-5 text-sm text-neutral-500"><a href="/plataforma/acesso?mode=login">Entrar</a><button onClick={goDemo}>Ver demonstração</button></div></div></footer>
  </main>
);