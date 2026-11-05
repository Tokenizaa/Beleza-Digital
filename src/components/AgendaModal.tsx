import React, { useState, useCallback } from 'react';
import { ServiceItem } from '../types';
import { useStore } from '../data/store';
import {
  X,
  Calendar,
  Clock,
  MessageCircle,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface AgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceItem[];
  businessName: string;
  whatsappNumber?: string;
  variation?: 'ouro-classico' | 'preto-esmeralda' | 'minimal-studio' | 'safira-executivo' | 'rubi-lounge';
}

export const AgendaModal: React.FC<AgendaModalProps> = ({
  isOpen,
  onClose,
  services,
  businessName,
  whatsappNumber,
  variation = 'ouro-classico',
}) => {
  const { store } = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(services[0] || null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState<string>('14:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const timeslots = ['09:00', '10:00', '11:00', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30'];

  const whatsappClean = (whatsappNumber || '').replace(/\D/g, '');

  const handleNext = useCallback(() => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setStep(2);
  }, [selectedService, selectedDate, selectedTime]);

  const handleConfirm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !clientName.trim() || !clientPhone.trim() || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);

    const waUrl = store.buildScheduledAppointmentWhatsAppUrl({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      serviceName: selectedService.name,
      date: selectedDate,
      time: selectedTime,
      notes: clientNotes.trim() || undefined,
    });

    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      const response = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          servicePrice: selectedService.price ?? null,
          serviceDurationMinutes: selectedService.durationMinutes ?? null,
          date: selectedDate,
          time: selectedTime,
          notes: clientNotes.trim() || null,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível confirmar o agendamento.');
    } catch (error) {
      whatsappWindow?.close();
      setSubmitError(error instanceof Error ? error.message : 'Falha ao salvar o agendamento.');
      setIsSubmitting(false);
      return;
    }

    try {
      store.recordPublicAppointment({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price ?? null,
        serviceDuration: selectedService.durationMinutes ?? null,
        date: selectedDate,
        time: selectedTime,
        notes: clientNotes.trim() || undefined,
        status: 'pendente',
      });
    } catch {
      // Ignore local storage errors
    }

    setStep(3);
    if (whatsappWindow) whatsappWindow.location.href = waUrl;
    setIsSubmitting(false);
  }, [selectedService, selectedDate, selectedTime, clientName, clientPhone, clientNotes, isSubmitting, store, whatsappNumber]);

  const themeStyles = {
    'ouro-classico': {
      accent: 'text-amber-400',
      accentBg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      button: 'bg-gradient-to-r from-amber-500 to-amber-700 text-neutral-950 hover:from-amber-400 hover:to-amber-600',
      buttonText: 'text-neutral-950',
    },
    'preto-esmeralda': {
      accent: 'text-emerald-400',
      accentBg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      button: 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950',
      buttonText: 'text-neutral-950',
    },
    'minimal-studio': {
      accent: 'text-slate-600',
      accentBg: 'bg-slate-200/50',
      border: 'border-slate-500/30',
      button: 'bg-slate-900 hover:bg-slate-800 text-white',
      buttonText: 'text-white',
    },
    'safira-executivo': {
      accent: 'text-blue-400',
      accentBg: 'bg-blue-600/10',
      border: 'border-blue-600/30',
      button: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white',
      buttonText: 'text-white',
    },
    'rubi-lounge': {
      accent: 'text-rose-400',
      accentBg: 'bg-rose-600/10',
      border: 'border-rose-600/30',
      button: 'bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 text-white',
      buttonText: 'text-white',
    },
  };

  const theme = themeStyles[variation];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-neutral-950/80 text-neutral-300 hover:text-white hover:bg-neutral-950 border border-neutral-700 transition-colors cursor-pointer"
        aria-label="Fechar"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`px-6 py-5 border-b border-neutral-800 ${theme.accentBg}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-5 h-5 ${theme.accent}`} />
            <h3 className="text-base font-bold font-display text-neutral-100 uppercase tracking-wider">
              Agendar Atendimento
            </h3>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Escolha serviço, data e horário para {businessName}
          </p>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 max-h-[70vh]">
          {/* Step 1: Service, Date, Time */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  1. Serviço, Data e Horário
                </span>
                <span className={`text-xs font-bold ${theme.accent}`}>
                  {selectedService?.name}
                </span>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Serviço
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((s) => {
                    const isSel = selectedService?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedService(s)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                          isSel
                            ? `bg-amber-500/10 border-amber-400 text-white ${theme.border}`
                            : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                          <img
                            src={s.imageUrl || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=100&q=80'}
                            alt={s.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
                            {s.category}
                          </span>
                          <h4 className="text-sm font-bold text-neutral-100 truncate">{s.name}</h4>
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                            {s.durationMinutes && <span>{s.durationMinutes} min</span>}
                            {typeof s.price === 'number' && <span>• R$ {s.price.toFixed(2).replace('.', ',')}</span>}
                          </div>
                        </div>
                        {isSel && (
                          <div className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center shrink-0">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Data
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {Array.from({ length: 14 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() + i);
                      const iso = d.toISOString().split('T')[0];
                      const isSel = selectedDate === iso;
                      return (
                        <button
                          key={iso}
                          onClick={() => setSelectedDate(iso)}
                          className={`p-2.5 rounded-xl flex flex-col items-center justify-center border text-center transition-all ${
                            isSel
                              ? `bg-amber-500 text-neutral-950 font-bold border-amber-400`
                              : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <span className="text-[10px] font-semibold tracking-wider">
                            {d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
                          </span>
                          <span className="text-sm font-bold">{d.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Horário
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeslots.map((t) => {
                      const isSel = selectedTime === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={`p-2 rounded-lg text-xs font-bold border transition-all ${
                            isSel
                              ? `bg-amber-500 text-neutral-950 border-amber-400`
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleNext}
                    disabled={!selectedService || !selectedDate || !selectedTime}
                    className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${theme.button}`}
                  >
                    <span>Avançar para seus dados</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Client Details */}
          {step === 2 && (
            <form onSubmit={handleConfirm} className="space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  2. Seus Dados
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 rotate-180" /> Alterar
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-950/50 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Serviço:</span>
                  <span className="font-bold text-neutral-100">{selectedService?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Data:</span>
                  <span className="font-bold text-amber-400">
                    {selectedDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Horário:</span>
                  <span className="font-bold text-amber-400">{selectedTime}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1.5">
                    Seu Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Como gostaria de ser chamado(a)?"
                    className="w-full pl-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1.5">
                    Seu Telefone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(92) 9XXXX-XXXX"
                    className="w-full pl-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1.5">
                    Observações (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="Ex: Primeira vez no salão, preferência por navalha, etc."
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {submitError && (
                <div role="alert" className={`rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300`}>
                  {submitError}
                </div>
              )}

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 px-5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 inline-flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 ${theme.button} shadow-lg`}
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Enviar pelo WhatsApp</span>
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-5 py-10">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold font-display text-neutral-100">
                  Solicitação Enviada!
                </h3>
                <p className="text-sm text-neutral-300 max-w-md mx-auto leading-relaxed">
                  Sua solicitação para <strong className="text-neutral-100">{selectedService?.name}</strong>
                  foi encaminhada para o WhatsApp da {businessName}.
                </p>
              </div>
              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setStep(1);
                    setClientName('');
                    setClientPhone('');
                    setClientNotes('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Novo Agendamento
                </button>
                <button
                  onClick={onClose}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all ${theme.button} shadow-lg`}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
