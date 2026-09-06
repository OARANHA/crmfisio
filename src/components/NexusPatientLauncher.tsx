import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Btn, Chip, Input } from '../lib/ui';

const normalized = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function NexusPatientLauncher() {
  const { patients } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = normalized(query);
    return patients
      .filter((patient) => !patient.anonimizado && patient.status !== 'alta')
      .filter((patient) => !q || normalized(`${patient.preferredName || patient.nome} ${patient.nome} ${patient.queixaPrincipal}`).includes(q))
      .slice(0, 6);
  }, [patients, query]);

  return (
    <section className="rounded-2xl border border-aqua/20 bg-panel/70 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-[14.5px] font-semibold">Abrir Nexus com contexto de paciente</p>
            <Chip className="border-aqua/25 bg-aqua/8 text-aqua">contextual</Chip>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fog">Selecione um paciente para continuar no mesmo prontuário MedicsPro. O Nexus não cria cadastro clínico paralelo.</p>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente…" className="!w-full sm:!w-72" />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((patient) => (
          <button
            key={patient.id}
            type="button"
            onClick={() => navigate(`/pacientes/${patient.id}/nexus`)}
            className="rounded-xl border border-line/70 bg-deep/55 p-3 text-left transition-colors hover:border-aqua/35 hover:bg-raise/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/30"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[13px] font-semibold">{patient.preferredName || patient.nome}</p>
                <p className="mt-1 truncate text-[10.5px] text-fog">{patient.queixaPrincipal || 'Sem queixa principal registrada'}</p>
              </div>
              <span className={`text-[9.5px] font-mono uppercase ${patient.status === 'ativo' ? 'text-mint' : 'text-fog'}`}>{patient.status}</span>
            </div>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-line/70 px-4 py-5 text-center text-[11.5px] text-fog">Nenhum paciente encontrado com este filtro.</div>
      )}

      <div className="mt-3 flex justify-end">
        <Btn variant="ghost" onClick={() => navigate('/pacientes')}>Ver todos os pacientes</Btn>
      </div>
    </section>
  );
}
