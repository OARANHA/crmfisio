import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUserAccess } from '../../lib/currentUserAccess';
import {
  CLINIC_WEEKDAYS,
  getCurrentClinicIdentity,
  listIanaTimeZones,
  loadClinicOpeningHours,
  openingHourForToggle,
  saveClinicOpeningHours,
  updateCurrentClinicIdentity,
  validateOpeningHours,
  type ClinicIdentity,
  type ClinicOpeningHourDraft,
} from '../../lib/clinicConfiguration';
import { useToast } from '../../lib/toastContext';
import { Btn, Field, Input, Select } from '../../lib/ui';
import { InfrastructureAdmin } from '../InfrastructureAdmin';

const EMPTY_IDENTITY: ClinicIdentity = {
  id: '',
  name: '',
  cnpj: null,
  phone: null,
  email: null,
  address: null,
  timezone: 'UTC',
};

export function ClinicGeneralAdmin() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const [identity, setIdentity] = useState<ClinicIdentity>(EMPTY_IDENTITY);
  const [hours, setHours] = useState<ClinicOpeningHourDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const timezones = useMemo(() => listIanaTimeZones(), []);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentClinicIdentity();
      const weeklyHours = await loadClinicOpeningHours(current.id);
      setIdentity(current);
      setHours(weeklyHours);
    } catch (loadError) {
      console.error('[MedicsPro] configuração geral:', loadError);
      setError('Não foi possível carregar as configurações gerais da clínica.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const setIdentityField = <K extends keyof ClinicIdentity>(key: K, value: ClinicIdentity[K]) => {
    setIdentity((current) => ({ ...current, [key]: value }));
  };

  const saveIdentity = async () => {
    if (!canManage || !identity.name.trim()) return;
    setSavingIdentity(true);
    try {
      const updated = await updateCurrentClinicIdentity({
        name: identity.name,
        cnpj: identity.cnpj,
        phone: identity.phone,
        email: identity.email,
        address: identity.address,
        timezone: identity.timezone,
      });
      setIdentity(updated);
      toast('Informações da clínica atualizadas.');
    } catch (saveError) {
      console.error('[MedicsPro] identidade da clínica:', saveError);
      toast('Não foi possível salvar as informações da clínica.', 'warn');
    } finally {
      setSavingIdentity(false);
    }
  };

  const updateHour = (day: number, patch: Partial<ClinicOpeningHourDraft>) => {
    setHours((current) => current.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)));
  };

  const toggleDay = (day: number, isOpen: boolean) => {
    setHours((current) => current.map((row) => (row.day_of_week === day ? openingHourForToggle(row, isOpen) : row)));
  };

  const saveHours = async () => {
    if (!canManage || !identity.id) return;
    const validation = validateOpeningHours(hours);
    if (validation) {
      toast(validation, 'warn');
      return;
    }
    setSavingHours(true);
    try {
      await saveClinicOpeningHours(identity.id, hours);
      toast('Horários de funcionamento atualizados.');
    } catch (saveError) {
      console.error('[MedicsPro] horários da clínica:', saveError);
      toast(saveError instanceof Error ? saveError.message : 'Não foi possível salvar os horários.', 'warn');
    } finally {
      setSavingHours(false);
    }
  };

  if (loading) {
    return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Carregando configurações da clínica…</div>;
  }

  if (!user) {
    return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Configurações indisponíveis para o acesso atual.</div>;
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-line/70 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Geral</p>
        <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[23px] font-bold tracking-tight">Base operacional da clínica</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Identidade, unidades e horário semanal usados pela operação. Permissões continuam protegidas no servidor.</p>
          </div>
          {!canManage && <span className="w-fit rounded-full border border-line px-3 py-1 text-[10px] font-medium text-fog">Somente leitura</span>}
        </div>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-pulse/30 bg-pulse/[0.05] px-4 py-3 text-[11.5px] text-pulse">
          <span>{error}</span>
          <Btn variant="ghost" onClick={() => void load()}>Tentar novamente</Btn>
        </div>
      )}

      {!error && (
        <section className="rounded-[20px] border border-line bg-panel p-5 md:p-6" aria-labelledby="clinic-identity-title">
          <div className="mb-5 border-b border-line/60 pb-4">
            <h3 id="clinic-identity-title" className="font-display text-[17px] font-semibold">Informações da clínica</h3>
            <p className="mt-1 text-[11.5px] text-fog">Dados administrativos da clínica ativa. O fuso usa identificadores IANA e será a referência para regras operacionais futuras.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2"><Field label="Nome da clínica"><Input value={identity.name} disabled={!canManage} onChange={(event) => setIdentityField('name', event.target.value)} /></Field></div>
            <Field label="CNPJ"><Input value={identity.cnpj ?? ''} disabled={!canManage} onChange={(event) => setIdentityField('cnpj', event.target.value || null)} placeholder="00.000.000/0000-00" /></Field>
            <Field label="Telefone"><Input value={identity.phone ?? ''} disabled={!canManage} onChange={(event) => setIdentityField('phone', event.target.value || null)} placeholder="(00) 00000-0000" /></Field>
            <Field label="E-mail"><Input type="email" value={identity.email ?? ''} disabled={!canManage} onChange={(event) => setIdentityField('email', event.target.value || null)} placeholder="contato@clinica.com.br" /></Field>
            <Field label="Fuso horário">
              <Select value={identity.timezone} disabled={!canManage} onChange={(event) => setIdentityField('timezone', event.target.value)}>
                {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </Select>
            </Field>
            <div className="lg:col-span-2"><Field label="Endereço"><Input value={identity.address ?? ''} disabled={!canManage} onChange={(event) => setIdentityField('address', event.target.value || null)} placeholder="Rua, número, complemento, cidade — UF" /></Field></div>
          </div>

          {canManage && (
            <div className="mt-5 flex justify-end">
              <Btn onClick={saveIdentity} disabled={savingIdentity || !identity.name.trim()}>{savingIdentity ? 'Salvando…' : 'Salvar informações'}</Btn>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="clinic-units-title">
        <div className="mb-3">
          <h3 id="clinic-units-title" className="font-display text-[17px] font-semibold">Unidades</h3>
          <p className="mt-1 text-[11.5px] text-fog">Locais de atendimento da clínica. Salas e recursos continuam na área de Agenda & Atendimento.</p>
        </div>
        <InfrastructureAdmin mode="units" readOnly={!canManage} />
      </section>

      {!error && (
        <section className="rounded-[20px] border border-line bg-panel p-5 md:p-6" aria-labelledby="clinic-hours-title">
          <div className="mb-5 border-b border-line/60 pb-4">
            <h3 id="clinic-hours-title" className="font-display text-[17px] font-semibold">Horário de funcionamento</h3>
            <p className="mt-1 text-[11.5px] text-fog">Uma janela operacional por dia. Feriados, intervalos e horários por profissional permanecem fora deste contrato.</p>
          </div>

          <div className="divide-y divide-line/60">
            {CLINIC_WEEKDAYS.map(({ day, label }) => {
              const row = hours.find((item) => item.day_of_week === day);
              if (!row) return null;
              return (
                <div key={day} className="grid gap-3 py-3 sm:grid-cols-[140px_120px_1fr] sm:items-center">
                  <span className="text-[12.5px] font-semibold text-paper">{label}</span>
                  <label className="flex items-center gap-2 text-[11px] text-fog">
                    <input type="checkbox" checked={row.is_open} disabled={!canManage} onChange={(event) => toggleDay(day, event.target.checked)} className="h-4 w-4 accent-mint" />
                    {row.is_open ? 'Aberto' : 'Fechado'}
                  </label>
                  <div className="flex items-center gap-2">
                    {row.is_open ? (
                      <>
                        <Input aria-label={`${label} abertura`} type="time" value={row.opens_at ?? ''} disabled={!canManage} onChange={(event) => updateHour(day, { opens_at: event.target.value || null })} />
                        <span className="text-[11px] text-fog">—</span>
                        <Input aria-label={`${label} fechamento`} type="time" value={row.closes_at ?? ''} disabled={!canManage} onChange={(event) => updateHour(day, { closes_at: event.target.value || null })} />
                      </>
                    ) : <span className="text-[11px] text-fog">Sem atendimento regular</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {canManage && (
            <div className="mt-5 flex justify-end border-t border-line/60 pt-4">
              <Btn onClick={saveHours} disabled={savingHours}>{savingHours ? 'Salvando…' : 'Salvar horários'}</Btn>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
