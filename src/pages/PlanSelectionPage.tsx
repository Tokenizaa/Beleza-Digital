import { useEffect, useState } from "react";
import { LoaderCircle, CreditCard, ShieldCheck, CheckCircle2, ArrowRight, Clock, Calendar, Smartphone, Globe, MessageCircle } from "lucide-react";

type BillingPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_brl_cents: number;
  billing_period: 'one_time' | 'monthly' | 'yearly';
  access_days: number;
  display_order: number;
};

type PlanFeature = {
  icon: React.ReactNode;
  label: string;
  included: boolean;
};

export function PlanSelectionPage({
  establishmentId,
  prospectId,
  onPlanSelect,
  onBack
}: {
  establishmentId: string;
  prospectId: string;
  onPlanSelect: (planId: string) => void;
  onBack: () => void;
}) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadPlans() {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabaseKey) throw new Error("Supabase não configurado.");

        const response = await fetch(`${supabaseUrl}/rest/v1/billing_plans?select=id,slug,name,description,price_brl_cents,billing_period,access_days,display_order&is_active=eq.true&order=display_order.asc`, {
          headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` },
        });
        if (!response.ok) throw new Error("Falha ao carregar planos.");
        const data = await response.json();
        if (active) setPlans(data);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar planos.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPlans();
    return () => { active = false; };
  }, []);

  function formatPrice(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  }

  function getPeriodLabel(period: string, accessDays: number): string {
    if (period === 'monthly') return `Mensal (acesso por ${accessDays} dias)`;
    if (period === 'yearly') return `Anual (acesso por ${accessDays} dias)`;
    return `Pagamento único (acesso por ${accessDays} dias)`;
  }

  function getPlanFeatures(plan: BillingPlan): PlanFeature[] {
    const horizonDays = plan.billing_period === 'monthly' ? 60 : plan.billing_period === 'yearly' ? 365 : plan.access_days;
    return [
      { icon: <Globe className="h-5 w-5" />, label: "Site profissional personalizado", included: true },
      { icon: <Smartphone className="h-5 w-5" />, label: "Agendamento online 24/7", included: true },
      { icon: <MessageCircle className="h-5 w-5" />, label: "WhatsApp Business integrado", included: true },
      { icon: <Calendar className="h-5 w-5" />, label: `Horizonte de agenda: ${horizonDays} dias`, included: true },
      { icon: <ShieldCheck className="h-5 w-5" />, label: "Hospedagem e SSL incluídos", included: true },
      { icon: <Clock className="h-5 w-5" />, label: `Acesso por ${plan.access_days} dias`, included: true },
    ];
  }

  async function handleCheckout(planId: string) {
    if (creatingCheckout) return;
    setCreatingCheckout(true);
    setCheckoutError("");

    try {
      // Get auth token from current session
      const { supabase } = await import("../lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao criar checkout.");

      if (body.payment?.checkout_url) {
        window.location.href = body.payment.checkout_url;
      } else if (body.payment?.pix_copy_paste) {
        // Show PIX copy-paste modal or redirect
        alert(`PIX gerado! Copie o código: ${body.payment.pix_copy_paste}`);
      } else {
        throw new Error("Checkout criado mas sem URL de pagamento.");
      }
    } catch (reason) {
      setCheckoutError(reason instanceof Error ? reason.message : "Erro ao criar checkout.");
    } finally {
      setCreatingCheckout(false);
    }
  }

  if (loading) return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-amber-500" />
      <span className="sr-only">Carregando planos</span>
    </div>
  );

  if (error && !plans.length) return (
    <div className="text-center p-8 text-red-400">
      <ShieldCheck className="h-10 w-10 mx-auto text-red-500 mb-2" />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-neutral-400 hover:text-white transition">
          <ArrowRight className="h-5 w-5 rotate-180" /> Voltar
        </button>
        <div className="text-right">
          <p className="text-xs text-neutral-500">Etapa 2 de 3</p>
          <p className="text-sm font-medium text-white">Escolha seu plano</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-neutral-700 rounded-full">
          <div className="h-full w-1/3 bg-amber-500 rounded-full transition-all" />
        </div>
        <div className="flex-1 h-1 bg-neutral-700 rounded-full">
          <div className="h-full w-full bg-amber-500 rounded-full transition-all" />
        </div>
        <div className="flex-1 h-1 bg-neutral-700 rounded-full">
          <div className="h-full w-0 bg-neutral-700 rounded-full transition-all" />
        </div>
      </div>
      <div className="flex justify-between text-xs text-neutral-500">
        <span>Cadastro</span>
        <span className="text-amber-500 font-medium">Plano</span>
        <span>Pagamento</span>
      </div>

      {checkoutError && (
        <div className="p-4 rounded-xl border border-red-900 bg-red-950/40 text-red-200 text-sm">
          {checkoutError}
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const features = getPlanFeatures(plan);
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              disabled={creatingCheckout}
              className={`relative p-6 rounded-2xl border-2 transition-all ${
                isSelected
                  ? "border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-500/10"
                  : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-600"
              }`}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-neutral-950" />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-neutral-400 mt-1">{getPeriodLabel(plan.billing_period, plan.access_days)}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-3xl font-bold text-white">{formatPrice(plan.price_brl_cents)}</span>
                  <span className="text-sm text-neutral-500">/{plan.billing_period === 'monthly' ? 'mês' : plan.billing_period === 'yearly' ? 'ano' : 'único'}</span>
                </div>

                <ul className="space-y-2">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-neutral-300">
                      <span className={`h-5 w-5 flex items-center justify-center ${feature.included ? 'text-emerald-400' : 'text-neutral-600'}`}>
                        {feature.icon}
                      </span>
                      <span>{feature.label}</span>
                    </li>
                  ))}
                </ul>

                {plan.description && (
                  <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-800">{plan.description}</p>
                )}
              </div>

              <button
                disabled={creatingCheckout || !isSelected}
                onClick={() => handleCheckout(plan.id)}
                className="mt-6 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold flex items-center justify-center gap-2 transition"
              >
                {creatingCheckout && isSelected ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Redirecionando para pagamento...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Confirmar e pagar
                  </>
                )}
              </button>
            </button>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <CreditCard className="h-12 w-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-lg">Nenhum plano disponível no momento.</p>
          <p className="text-sm mt-1">Entre em contato com a equipe comercial.</p>
        </div>
      )}
    </div>
  );
}