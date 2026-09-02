import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { buildProfessionalCapacity, CAPACITY_DAY_END, CAPACITY_DAY_START, formatMinutes } from '../lib/agendaCapacity';
import { useApp, patientName } from '../lib/store';
import { STATUS_META, type Appointment } from '../lib/types';
import { Btn, Card } from '../lib/ui';

const SLOT_MINUTES = 30;
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMin = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

export function AgendaCapacityInsights() {
  const { user, users, patients, appointments } = useApp();
  const [day, setDay] = useState(() => new Date());
  const dayIso = format(day, 'yyyy-MM-dd');
  const professionals = useMemo(() => {
    const all = users.filter((item) => item.role === 'fisio');
    return user?.role === 'fisio' ? all.filter((item) => item.id === user.id) : all;
  }, [users, user?.id, user?.role]);
  const capacities = useMemo(() => buildProfessionalCapacity(appointments, professionals, dayIso), [appointments, professionals, dayIso]);
  const slots = useMemo(() => Array.from({ length: (CAPACITY_DAY_END - CAPACITY_DAY_START) / SLOT_MINUTES }, (_, index) => CAPACITY_DAY_START + index * SLOT_MINUTES), []);

  const appointmentAt = (professionalId: string, minute: number): Appointment | undefined => capacities
    .find((item) => item.professional.id === professionalId)
    ?.appointments.find((appointment) => toMin(appointment.inicio) <= minute && toMin(appointment.fim) > minute);

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="font-display font-semibold">Capacidade por profissional</p>
            <p className="font-mono text-[10px] text-fog mt-1">Ocupação agendada entre 07:00 e 19:00 · cancelamentos e faltas não consomem capacidade.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Btn variant="ghost" onClick={() => setDay((value) => addDays(value, -1))}>←</Btn>
            <Btn variant="ghost" onClick={() => setDay(new Date())}>Hoje</Btn>
            <Btn variant="ghost" onClick={() => setDay((value) => addDays(value, 1))}>→</Btn>
            <span className="font-mono text-[11px] text-fog min-w-[118px] text-right">{format(day, "dd/MM · EEE", { locale: ptBR }).replace('.', '')}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {capacities.map((item) => (
            <div key={item.professional.id} className="border border-line bg-deep p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold truncate">{item.professional.nome}</p>
                  <p className="font-mono text-[9px] uppercase text-fog mt-1">{item.sessions} sessões · {formatMinutes(item.bookedMinutes)} ocupados</p>
                </div>
                <span className="font-display text-xl font-bold text-mint">{item.occupancyPercent}%</span>
              </div>
              <div className="h-1.5 bg-line/50 mt-3 overflow-hidden">
                <div className="h-full bg-mint transition-all" style={{ width: `${Math.min(100, item.occupancyPercent)}%` }} />
              </div>
              <p className="font-mono text-[9px] text-fog mt-2">{formatMinutes(item.freeMinutes)} livres na janela operacional</p>
            </div>
          ))}
          {capacities.length === 0 && <p className="text-fog text-[12px]">Nenhum profissional ativo encontrado.</p>}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid border-b border-line bg-deep" style={{ gridTemplateColumns: `72px repeat(${Math.max(1, capacities.length)}, minmax(160px, 1fr))` }}>
            <div className="p-2 font-mono text-[9px] uppercase text-fog">Horário</div>
            {capacities.map((item) => (
              <div key={item.professional.id} className="p-2 border-l border-line text-center">
                <p className="font-display font-semibold text-[13px]">{item.professional.nome}</p>
                <p className="font-mono text-[9px] text-fog">{item.occupancyPercent}% ocupado</p>
              </div>
            ))}
          </div>

          {slots.map((minute) => (
            <div key={minute} className="grid border-b border-line/40 last:border-b-0" style={{ gridTemplateColumns: `72px repeat(${Math.max(1, capacities.length)}, minmax(160px, 1fr))` }}>
              <div className="p-2 font-mono text-[10px] text-fog bg-deep/40">{toHHMM(minute)}</div>
              {capacities.map((item) => {
                const appointment = appointmentAt(item.professional.id, minute);
                const startsHere = appointment && toMin(appointment.inicio) === minute;
                const meta = appointment ? STATUS_META[appointment.status] : null;
                return (
                  <div key={item.professional.id} className="min-h-[36px] border-l border-line/40 p-1.5">
                    {appointment ? (
                      startsHere ? (
                        <div className="border-l-[3px] bg-panel px-2 py-1" style={{ borderColor: meta?.dot }}>
                          <p className="text-[11px] font-semibold truncate">{patientName(patients, appointment.pacienteId)}</p>
                          <p className="font-mono text-[9px] text-fog truncate">{appointment.inicio}–{appointment.fim} · {appointment.tipo}</p>
                        </div>
                      ) : <div className="h-full bg-panel/40" />
                    ) : (
                      <span className="font-mono text-[9px] text-mint/70">livre</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
