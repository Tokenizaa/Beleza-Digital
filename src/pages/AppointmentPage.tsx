import React, { useState, useEffect, useMemo } from 'react';
import { PageView, ServiceItem } from '../types';
import { useStore } from '../data/store';
import { MonthCalendar } from '../components/MonthCalendar';
import {
  Calendar,
  Clock,
  Scissors,
  User,
  Phone,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info,
  CalendarCheck,
  Lock,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface AppointmentPageProps {
  preselectedServiceId?: string | null;
  setCurrentPage: (page: PageView) => void;
}

export const AppointmentPage: React.FC<AppointmentPageProps> = ({
  preselectedServiceId,
  setCurrentPage,
}) => {
  const { services, company, appointments, store } = useStore();

  // Find preselected service or default to first
  const initialService =
    services.find((s) => s.id === preselectedServiceId) || services[0] || null;

  const [selectedService, setSelectedService] = useState<ServiceItem | null>(
    initialService
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Next 14 days generator
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayOfWeek = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      const dayOfMonth = d.getDate();
      const month = d.toLocaleDateString('pt-BR', { month: 'short' });
      const isSunday = d.getDay() === 0;

      // Check how many confirmed appointments exist on this date
      const bookedCount = appointments.filter(
        (a) => a.date === iso && a.status === 'confirmado'
      ).length;

      dates.push({
        iso,
        dayOfWeek: dayOfWeek.toUpperCase().replace('.', ''),
        dayOfMonth,
        month: month.toUpperCase().replace('.', ''),
        isToday: i === 0,
        isSunday,
        bookedCount,
      });
    }
    return dates;
  }, [appointments]);

  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates[0]?.iso || ''
  );
  const [calendarMode, setCalendarMode] = useState<'month' | 'quick'>('month');

  // Suggested times by shift
  const timeslots = {
    morning: ['09:00', '09:45', '10:30', '11:15'],
    afternoon: ['13:00', '14:00', '15:00', '16:00', '17:00'],
    evening: ['18:00', '18:45', '19:30'],
  };

  const allTimesList = useMemo(() => [
    ...timeslots.morning,
    ...timeslots.afternoon,
    ...timeslots.evening,
  ], []);

  // List of confirmed times for the selected date
  const confirmedTimesForSelectedDate = useMemo(() => {
    return appointments
      .filter((a) => a.date === selectedDate && a.status === 'confirmado')
      .map((a) => a.time);
  }, [appointments, selectedDate]);

  const [selectedTime, setSelectedTime] = useState<string>('14:00');

  // Auto-switch selectedTime if the current selectedTime is confirmed/occupied
  useEffect(() => {
    if (confirmedTimesForSelectedDate.includes(selectedTime)) {
      const nextFree = allTimesList.find(
        (t) => !confirmedTimesForSelectedDate.includes(t)
      );
      if (nextFree) {
        setSelectedTime(nextFree);
      }
    }
  }, [selectedDate, confirmedTimesForSelectedDate, selectedTime, allTimesList]);

  // Client Details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Flow State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submittedWhatsAppUrl, setSubmittedWhatsAppUrl] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Filter services by category
  const categories = [
    'Todos',
    ...Array.from(new Set(services.map((s) => s.category))),
  ];
  const filteredServices =
    selectedCategory === 'Todos'
      ? services
      : services.filter((s) => s.category === selectedCategory);

  const handleNextToClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime) return;
    if (confirmedTimesForSelectedDate.includes(selectedTime)) {
      alert('Este horário acabou de ser confirmado por outro cliente. Por favor, escolha outro horário disponível.');
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmAndOpenWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !clientName.trim() || !clientPhone.trim() || isSubmittingBooking) return;
    setBookingError(null);
    setIsSubmittingBooking(true);

    const waUrl = store.buildScheduledAppointmentWhatsAppUrl({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      serviceName: selectedService.name,
      date: selectedDate,
      time: selectedTime,
      notes: clientNotes.trim() || undefined,
    });
    // Open synchronously from the click gesture so browsers do not block the WhatsApp tab.
    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      const response = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          establishmentSlug: company.slug,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
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
      setBookingError(error instanceof Error ? error.message : 'Falha ao salvar o agendamento.');
      setIsSubmittingBooking(false);
      return;
    }

    // Registra na store para atualização imediata da interface
    try {
      store.addAppointment({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        serviceDuration: selectedService.durationMinutes,
        date: selectedDate,
        time: selectedTime,
        notes: clientNotes.trim() || undefined,
        status: 'pendente',
        establishmentId: company.id,
      });
    } catch {
      // Ignora erro local caso o agendamento já tenha sido registrado no servidor
    }

    setSubmittedWhatsAppUrl(waUrl);
    setStep(3);
    if (whatsappWindow) whatsappWindow.location.href = waUrl;
    setIsSubmittingBooking(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-widest">
          <CalendarCheck className="w-4 h-4 text-amber-400" />
          <span>Agendamento Online Integrado</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-display uppercase tracking-wider text-neutral-100">
          Reserve seu Horário
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Escolha seu serviço, selecione o dia e horário de preferência e confirme diretamente no WhatsApp do <strong className="text-neutral-200">{company.name}</strong>.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center max-w-xs mx-auto">
        <div className="flex items-center w-full">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
              step >= 1
                ? 'bg-amber-500 text-neutral-950'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            1
          </div>
          <div
            className={`flex-1 h-0.5 mx-2 transition-colors ${
              step >= 2 ? 'bg-amber-500' : 'bg-neutral-800'
            }`}
          />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
              step >= 2
                ? 'bg-amber-500 text-neutral-950'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            2
          </div>
          <div
            className={`flex-1 h-0.5 mx-2 transition-colors ${
              step >= 3 ? 'bg-amber-500' : 'bg-neutral-800'
            }`}
          />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
              step >= 3
                ? 'bg-emerald-500 text-white'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            ✓
          </div>
        </div>
      </div>

      {/* STEP 1: Escolha de Serviço, Data e Horário */}
      {step === 1 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* 1. Escolha do Serviço */}
          <section className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold font-display text-neutral-100 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>1. Escolha o Procedimento</span>
              </h3>
              {selectedService && (
                <span className="text-xs text-amber-400 font-medium truncate max-w-[200px]">
                  Selecionado: {selectedService.name}
                </span>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {filteredServices.map((service) => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3.5 items-center ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-white shadow-xs'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                      <img
                        src={
                          service.imageUrl ||
                          'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=300&q=80'
                        }
                        alt={service.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                        {service.category}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-neutral-100 truncate">
                        {service.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                        {service.durationMinutes ? (
                          <span>{service.durationMinutes} min</span>
                        ) : null}
                        {typeof service.price === 'number' ? (
                          <span className="text-amber-300 font-bold">
                            R$ {service.price.toFixed(2).replace('.', ',')}
                          </span>
                        ) : (
                          <span>Consulte valor</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center shrink-0">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Escolha da Data */}
          <section className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-3 gap-3">
              <div>
                <h3 className="text-base font-bold font-display text-neutral-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>2. Escolha a Data</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Avance pelos próximos meses ou use o atalho dos próximos dias.
                </p>
              </div>

              <div className="inline-flex p-1 rounded-xl bg-neutral-950 border border-neutral-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCalendarMode('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    calendarMode === 'month'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Calendário Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMode('quick')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    calendarMode === 'quick'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Próximos Dias
                </button>
              </div>
            </div>

            {/* View Mode 1: Full Month Calendar with month navigation */}
            {calendarMode === 'month' ? (
              <div className="space-y-3">
                <MonthCalendar
                  selectedDate={selectedDate}
                  onSelectDate={(newDate) => setSelectedDate(newDate)}
                  appointments={appointments}
                />
                <div className="text-center">
                  <span className="text-xs text-neutral-400">
                    Data selecionada: <strong className="text-amber-400 font-bold">{selectedDate.split('-').reverse().join('/')}</strong>
                  </span>
                </div>
              </div>
            ) : (
              /* View Mode 2: Quick horizontal cards */
              <div className="space-y-3">
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 overflow-x-auto pb-1">
                  {availableDates.map((item) => {
                    const isSelected = selectedDate === item.iso;
                    const isFull = item.bookedCount >= 12;

                    return (
                      <button
                        key={item.iso}
                        type="button"
                        disabled={isFull}
                        onClick={() => setSelectedDate(item.iso)}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center border transition-all relative ${
                          isFull
                            ? 'bg-neutral-950/40 border-neutral-900 text-neutral-600 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400 shadow-md cursor-pointer'
                            : item.isSunday
                            ? 'bg-neutral-950/60 border-neutral-900 text-neutral-400 hover:border-neutral-800 cursor-pointer'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700 cursor-pointer'
                        }`}
                      >
                        <span className="text-[10px] font-semibold tracking-wider">
                          {item.isToday ? 'HOJE' : item.dayOfWeek}
                        </span>
                        <span className="text-lg font-bold font-display my-0.5">
                          {item.dayOfMonth}
                        </span>
                        <span className="text-[10px]">{item.month}</span>

                        {item.bookedCount > 0 && !isFull && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full mt-1 font-bold ${
                              isSelected
                                ? 'bg-neutral-950/80 text-amber-300'
                                : 'bg-rose-950/80 text-rose-300 border border-rose-900/40'
                            }`}
                          >
                            {item.bookedCount} {item.bookedCount === 1 ? 'ocupado' : 'ocupados'}
                          </span>
                        )}

                        {isFull && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full mt-1 font-bold bg-neutral-900 text-neutral-500">
                            Lotado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="text-center">
                  <span className="text-xs text-neutral-400">
                    Data selecionada: <strong className="text-amber-400 font-bold">{selectedDate.split('-').reverse().join('/')}</strong>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* 3. Escolha do Horário */}
          <section className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-3 gap-2">
              <h3 className="text-base font-bold font-display text-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>3. Escolha o Horário</span>
              </h3>

              <div className="flex items-center gap-2">
                {confirmedTimesForSelectedDate.length > 0 && (
                  <span className="text-xs text-rose-400 flex items-center gap-1 font-medium bg-rose-950/40 border border-rose-900/50 px-2.5 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    <span>{confirmedTimesForSelectedDate.length} {confirmedTimesForSelectedDate.length === 1 ? 'horário reservado' : 'horários reservados'}</span>
                  </span>
                )}
                <span className="text-xs text-amber-400 font-semibold">
                  Selecionado: {selectedTime}
                </span>
              </div>
            </div>

            {/* Anti-Conflict Notice */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-start gap-2.5 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-neutral-200">Proteção contra conflitos de horário:</strong> Horários confirmados pela nossa equipe ficam automaticamente bloqueados com a etiqueta <span className="text-rose-400 font-semibold">Reservado</span> para impedir qualquer duplicidade.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                  Manhã
                </span>
                <div className="flex flex-wrap gap-2">
                  {timeslots.morning.map((time) => {
                    const isBooked = confirmedTimesForSelectedDate.includes(time);
                    const isSelected = selectedTime === time && !isBooked;

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        onClick={() => !isBooked && setSelectedTime(time)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isBooked
                            ? 'bg-neutral-950/80 border-rose-950/60 text-neutral-500 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-bold cursor-pointer'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700 cursor-pointer'
                        }`}
                        title={isBooked ? 'Horário já confirmado e reservado' : 'Disponível para agendamento'}
                      >
                        <span className={isBooked ? 'line-through text-neutral-500' : ''}>{time}</span>
                        {isBooked ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-900/60">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Reservado</span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                  Tarde
                </span>
                <div className="flex flex-wrap gap-2">
                  {timeslots.afternoon.map((time) => {
                    const isBooked = confirmedTimesForSelectedDate.includes(time);
                    const isSelected = selectedTime === time && !isBooked;

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        onClick={() => !isBooked && setSelectedTime(time)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isBooked
                            ? 'bg-neutral-950/80 border-rose-950/60 text-neutral-500 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-bold cursor-pointer'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700 cursor-pointer'
                        }`}
                        title={isBooked ? 'Horário já confirmado e reservado' : 'Disponível para agendamento'}
                      >
                        <span className={isBooked ? 'line-through text-neutral-500' : ''}>{time}</span>
                        {isBooked ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-900/60">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Reservado</span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                  Noite
                </span>
                <div className="flex flex-wrap gap-2">
                  {timeslots.evening.map((time) => {
                    const isBooked = confirmedTimesForSelectedDate.includes(time);
                    const isSelected = selectedTime === time && !isBooked;

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={isBooked}
                        onClick={() => !isBooked && setSelectedTime(time)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isBooked
                            ? 'bg-neutral-950/80 border-rose-950/60 text-neutral-500 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-bold cursor-pointer'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700 cursor-pointer'
                        }`}
                        title={isBooked ? 'Horário já confirmado e reservado' : 'Disponível para agendamento'}
                      >
                        <span className={isBooked ? 'line-through text-neutral-500' : ''}>{time}</span>
                        {isBooked ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-900/60">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Reservado</span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleNextToClient}
              disabled={!selectedService || !selectedDate || !selectedTime}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-bold text-base shadow-xl transition-all cursor-pointer"
            >
              <span>Avançar para Meus Dados</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Dados do Cliente e Envio para WhatsApp */}
      {step === 2 && (
        <form
          onSubmit={handleConfirmAndOpenWhatsApp}
          className="space-y-6 bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 sm:p-8 animate-in fade-in duration-200"
        >
          {bookingError && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{bookingError}</div>}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h3 className="text-lg font-bold font-display text-neutral-100">
                Seus Dados de Contato
              </h3>
              <p className="text-xs text-neutral-400">
                A confirmação do agendamento será enviada diretamente pelo WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Alterar data/serviço</span>
            </button>
          </div>

          {/* Resumo Selecionado */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Serviço:</span>
              <span className="font-bold text-neutral-100">
                {selectedService?.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Data e Horário:</span>
              <span className="font-bold text-amber-400">
                {selectedDate.split('-').reverse().join('/')} às {selectedTime}
              </span>
            </div>
            {selectedService?.durationMinutes && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Duração estimada:</span>
                <span className="text-neutral-300">
                  {selectedService.durationMinutes} minutos
                </span>
              </div>
            )}
            {typeof selectedService?.price === 'number' && (
              <div className="flex items-center justify-between border-t border-neutral-800 pt-1.5">
                <span className="text-neutral-400">Valor estimado:</span>
                <span className="font-bold text-amber-300 text-sm">
                  R$ {selectedService.price.toFixed(2).replace('.', ',')}
                </span>
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1.5">
                Seu Nome Completo *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Como gostaria de ser chamado(a)?"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1.5">
                Seu Telefone / WhatsApp *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(92) 9XXXX-XXXX"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1.5">
                Observações ou Pedido Especial (Opcional)
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

          {/* Buttons */}
          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-3.5 px-5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              Voltar
            </button>

            <button
              type="submit"
              disabled={isSubmittingBooking}
              className="flex-1 inline-flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl hover:shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 fill-white" />
              <span>Enviar Agendamento pelo WhatsApp</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Sucesso */}
      {step === 3 && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 sm:p-12 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-bold font-display text-neutral-100">
              Solicitação Enviada com Sucesso!
            </h3>
            <p className="text-sm text-neutral-300 max-w-lg mx-auto leading-relaxed">
              Sua solicitação para <strong className="text-amber-400">{selectedService?.name}</strong> no dia{' '}
              <strong className="text-neutral-100">
                {selectedDate.split('-').reverse().join('/')} às {selectedTime}
              </strong>{' '}
              foi gerada e encaminhada para o WhatsApp do estabelecimento.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 max-w-md mx-auto space-y-1">
            <p className="font-semibold text-neutral-200">
              O WhatsApp não abriu automaticamente?
            </p>
            <p>Clique no botão abaixo para abrir a conversa com nossa equipe agora mesmo:</p>
            {submittedWhatsAppUrl && (
              <a
                href={submittedWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Abrir WhatsApp Novamente</span>
              </a>
            )}
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setStep(1);
                setClientName('');
                setClientPhone('');
                setClientNotes('');
              }}
              className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Fazer Outro Agendamento
            </button>

            <button
              onClick={() => {
                setCurrentPage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors cursor-pointer"
            >
              Voltar para o Início
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
