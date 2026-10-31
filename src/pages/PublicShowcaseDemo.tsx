import React, { useState } from 'react';
import { Calendar, Palette } from 'lucide-react';
import { SharedSitePreview, type ShareableSitePreview } from './SharedSitePreview';

const variants: Record<string, ShareableSitePreview> = {
  barbearia:{version:1,businessName:'Barbearia Modelo',category:'Barbearia',tagline:'Estilo, precisão e tradição',description:'Uma experiência profissional para quem valoriza estilo e praticidade.',phone:'(51) 99999-9999',whatsapp:'5551999999999',email:'contato@exemplo.com',address:'Porto Alegre - RS',city:'Porto Alegre',state:'RS',websiteUrl:'',templateId:'preto-esmeralda',templateName:'Barbearia',projectVersion:1,generatedAt:new Date().toISOString(),status:'OPERATIONAL'},
  salao:{version:1,businessName:'Studio Modelo',category:'Salão de Beleza',tagline:'Beleza que combina com você',description:'Cabelos, beleza e atendimento pensado para cada cliente.',phone:'(51) 99999-9999',whatsapp:'5551999999999',email:'contato@exemplo.com',address:'Porto Alegre - RS',city:'Porto Alegre',state:'RS',websiteUrl:'',templateId:'ouro-classico',templateName:'Salão',projectVersion:1,generatedAt:new Date().toISOString(),status:'OPERATIONAL'},
  estetica:{version:1,businessName:'Estética Modelo',category:'Estética e Bem-estar',tagline:'Seu momento de cuidado começa aqui',description:'Tratamentos e bem-estar em uma experiência digital elegante.',phone:'(51) 99999-9999',whatsapp:'5551999999999',email:'contato@exemplo.com',address:'Porto Alegre - RS',city:'Porto Alegre',state:'RS',websiteUrl:'',templateId:'minimal-studio',templateName:'Estética',projectVersion:1,generatedAt:new Date().toISOString(),status:'OPERATIONAL'}
};

export const PublicShowcaseDemo: React.FC = () => {
  const [active,setActive]=useState('salao');
  const book=()=>window.open('https://wa.me/5551999999999','_blank','noopener,noreferrer');
  return <div className="min-h-screen bg-neutral-950 text-neutral-100">
    <aside className="fixed left-3 top-1/2 z-[60] -translate-y-1/2 rounded-2xl border border-neutral-700 bg-neutral-950/95 p-2 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-center text-amber-400"><Palette className="h-5 w-5"/></div>
      {Object.keys(variants).map(id=><button key={id} onClick={()=>setActive(id)} className={'block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold capitalize '+(active===id?'bg-amber-500 text-neutral-950':'text-neutral-300 hover:bg-neutral-800')}>{id==='salao'?'Salão':id==='barbearia'?'Barbearia':'Estética'}</button>)}
    </aside>
    <div className="border-b border-neutral-800 bg-neutral-950 px-5 py-3 text-center text-xs text-neutral-400">Demonstração do modelo base do Beleza Digital · <a href="/" className="text-amber-400 hover:text-amber-300">Voltar para a plataforma</a></div>
    <SharedSitePreview preview={variants[active]} />
    <button onClick={book} className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-4 font-bold text-neutral-950 shadow-2xl hover:bg-amber-400"><Calendar className="h-5 w-5"/> Agendar agora</button>
  </div>
};