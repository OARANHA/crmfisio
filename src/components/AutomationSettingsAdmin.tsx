import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { resolveClinicId } from '../lib/repository';
import { supabase } from '../lib/supabaseClient';
import { Btn, Card, CardHead, Field, Input } from '../lib/ui';

type AutomationSettings = {
  clinic_id: string;
  confirmations_enabled: boolean;
  confirmation_hours: number;
  nps_enabled: boolean;
  nps_delay_minutes: number;
  nps_lookback_days: number;
  send_window_start: string;
  send_window_end: string;
  timezone: string;
  active: boolean;
  updated_at: string;
};

const DEFAULTS: Omit<AutomationSettings, 'clinic_id' | 'updated_at'> = {
  confirmations_enabled: true,
  confirmation_hours: 48,
  nps_enabled: true,
  nps_delay_minutes: 15,
  nps_lookback_days: 7,
  send_window_start: '08:00',
  send_window_end: '20:00',
  timezone: 'America/Sao_Paulo',
  active: true,
};

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/70 bg-deep px-4 py-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-mint"
      />
      <span>
        <span className="block font-display text-[13.5px] font-semibold">{label}</span>
        <span className="mt-1 block text-[12px] leading-relaxed text-fog">{description}</span>
      </span>
    </label>
  );
}

export function AutomationSettingsAdmin() {
  const { user, toast } = useApp();
  const [clinicId, setClinicId] = useState('');
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;

    setLoading(true);
    resolveClinicId(user.id)
      .then(async (resolvedClinicId) => {
        if (!active) return;
        setClinicId(resolvedClinicId);

        const { data, error } = await supabase
          .from('automation_settings')
          .select('*')
          .eq('clinic_id', resolvedClinicId)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;

        if (data) {
          setSettings(data as AutomationSettings);
          return;
        }

        const { data: created, error: createError } = await supabase
          .from('automation_settings')
          .insert({ clinic_id: resolvedClinicId, ...DEFAULTS })
          .select('*')
          .single();

        if (createError) throw createError;
        if (active) setSettings(created as AutomationSettings);
      })
      .catch((error) => {
        console.error('[MedicsPro] configurações de automação:', error);
        toast('Não foi possível carregar as automações da clínica.', 'warn');
      })
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [user?.id]);

  const patch = <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!settings || !clinicId) return;
    setSaving(true);
    try {
      const payload = {
        active: settings.active,
        confirmations_enabled: settings.confirmations_enabled,
        confirmation_hours: Math.max(1, Math.min(168, Number(settings.confirmation_hours) || 48)),
        nps_enabled: settings.nps_enabled,
        nps_delay_minutes: Math.max(0, Math.min(1440, Number(settings.nps_delay_minutes) || 0)),
        nps_lookback_days: Math.max(1, Math.min(90, Number(settings.nps_lookback_days) || 7)),
        send_window_start: settings.send_window_start,
        send_window_end: settings.send_window_end,
        timezone: settings.timezone.trim() || 'America/Sao_Paulo',
      };

      if (payload.send_window_start >= payload.send_window_end) {
        toast('A janela de envio precisa terminar depois do horário inicial.', 'warn');
        return;
      }

      const { data, error } = await supabase
        .from('automation_settings')
        .update(payload)
        .eq('clinic_id', clinicId)
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data as AutomationSettings);
      toast('Automações da clínica atualizadas.');
    } catch (error) {
      console.error('[MedicsPro] salvar automações:', error);
      toast('Não foi possível salvar as automações.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="Automações da clínica"
        sub="controle operacional da clínica; disponibilidade de módulos e plano continua sendo responsabilidade da plataforma"
      />

      {loading ? (
        <div className="p-5 font-mono text-[11px] text-fog">Carregando automações…</div>
      ) : !settings ? (
        <div className="p-5 text-[12.5px] text-amber">Configuração indisponível para este perfil.</div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <Toggle
              checked={settings.active}
              onChange={(value) => patch('active', value)}
              label="Motor de automações"
              description="Pausa ou libera os disparos automáticos desta clínica sem desligar o scheduler da plataforma."
            />
            <Toggle
              checked={settings.confirmations_enabled}
              onChange={(value) => patch('confirmations_enabled', value)}
              label="Confirmação de agenda"
              description="Enfileira confirmações para pacientes elegíveis dentro da antecedência configurada."
            />
            <Toggle
              checked={settings.nps_enabled}
              onChange={(value) => patch('nps_enabled', value)}
              label="NPS pós-atendimento"
              description="Enfileira pesquisa após atendimento finalizado, respeitando atraso e janela de busca."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Antecedência da confirmação (horas)" hint="1 a 168 horas.">
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.confirmation_hours}
                onChange={(event) => patch('confirmation_hours', Number(event.target.value))}
              />
            </Field>
            <Field label="Atraso do NPS (minutos)" hint="0 a 1440 minutos após finalizar.">
              <Input
                type="number"
                min={0}
                max={1440}
                value={settings.nps_delay_minutes}
                onChange={(event) => patch('nps_delay_minutes', Number(event.target.value))}
              />
            </Field>
            <Field label="Janela retroativa do NPS (dias)" hint="1 a 90 dias.">
              <Input
                type="number"
                min={1}
                max={90}
                value={settings.nps_lookback_days}
                onChange={(event) => patch('nps_lookback_days', Number(event.target.value))}
              />
            </Field>
            <Field label="Início da janela de envio">
              <Input type="time" value={settings.send_window_start.slice(0, 5)} onChange={(event) => patch('send_window_start', event.target.value)} />
            </Field>
            <Field label="Fim da janela de envio">
              <Input type="time" value={settings.send_window_end.slice(0, 5)} onChange={(event) => patch('send_window_end', event.target.value)} />
            </Field>
            <Field label="Fuso horário" hint="Identificador IANA usado pelo orquestrador.">
              <Input value={settings.timezone} onChange={(event) => patch('timezone', event.target.value)} placeholder="America/Sao_Paulo" />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
            <Btn onClick={() => void save()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar automações'}</Btn>
            <p className="text-[11.5px] leading-relaxed text-fog">
              Alterações aqui não modificam timer, secrets, Edge Functions ou infraestrutura do servidor.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
