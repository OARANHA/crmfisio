import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import { STAGE_META, maskCpf, ageFrom, type FunilStage } from '../lib/types';
import { Card, Btn, Input, Select, Chip, Empty, IconSearch, IconPlus, IconChevronL } from '../lib/ui';
import { Reveal } from '../components/Reveal';
import { ClinicalWorkspace } from '../components/ClinicalWorkspace';
import { PatientOperationalActions } from '../components/PatientOperationalActions';
import { PatientProfileHeader } from '../components/PatientProfileHeader';
import { PatientRegistrationPage } from './PatientRegistrationPage';

export function Pacientes() {
  const { id } = useParams();
  if (id === 'novo') return <PatientRegistrationPage />;
  return id ? <Pep id={id} /> : <Lista />;
}

function Lista() {
  const { patients } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | FunilStage>('all');

  const filtered = useMemo(
    () => patients.filter((patient) =>
      !patient.anonimizado &&
      (stage === 'all' || patient.funilStage === stage) &&
      (patient.nome.toLowerCase().includes(q.toLowerCase()) || patient.queixaPrincipal.toLowerCase().includes(q.toLowerCase()))
    ),
    [patients, q, stage],
  );

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mint">Cadastro e prontuário</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Pacientes</h1>
            <p className="mt-1 text-[14px] text-fog">{patients.filter((patient) => !patient.anonimizado).length} cadastrados · acesso protegido por perfil e LGPD</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
              <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nome ou queixa…" className="!w-72 !pl-9" />
            </div>
            <Select value={stage} onChange={(event) => setStage(event.target.value as 'all' | FunilStage)} className="!w-auto">
              <option value="all">Toda a jornada</option>
              {(Object.keys(STAGE_META) as FunilStage[]).map((item) => <option key={item} value={item}>{STAGE_META[item].label}</option>)}
            </Select>
            <Btn onClick={() => nav('/pacientes/novo')}><IconPlus className="h-4 w-4" /> Novo paciente</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        {filtered.length === 0 ? (
          <Empty title="Nenhum paciente encontrado" sub="Cadastre o primeiro paciente ou ajuste os filtros." />
        ) : (
          <Card className="overflow-x-auto !p-0">
            <table className="w-full min-w-[860px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-deep/70 text-[12px] font-semibold uppercase tracking-[0.06em] text-fog">
                  <th className="px-5 py-3.5 text-left">Paciente</th>
                  <th className="px-5 py-3.5 text-left">Queixa principal</th>
                  <th className="px-5 py-3.5 text-left">Jornada</th>
                  <th className="px-5 py-3.5 text-left">Última visita</th>
                  <th className="px-5 py-3.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => {
                  const stageMeta = STAGE_META[patient.funilStage];
                  return (
                    <tr key={patient.id} onClick={() => nav(`/pacientes/${patient.id}`)} className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-raise/45">
                      <td className="px-5 py-4">
                        <p className="font-display text-[14.5px] font-semibold">{patient.preferredName || patient.nome}</p>
                        <p className="mt-1 text-[12.5px] text-fog">{ageFrom(patient.nascimento)} anos · {maskCpf(patient.cpf)}</p>
                      </td>
                      <td className="max-w-[340px] px-5 py-4">
                        <p className="truncate text-paper/90">{patient.queixaPrincipal || 'Sem queixa registrada'}</p>
                        {patient.cid10.length > 0 && <p className="mt-1 text-[12px] font-medium text-amber">{patient.cid10.join(' · ')}</p>}
                      </td>
                      <td className="px-5 py-4"><Chip className={stageMeta.chip}>{stageMeta.label}</Chip></td>
                      <td className="px-5 py-4 text-[13px] text-fog">{patient.ultimaVisita ? format(new Date(`${patient.ultimaVisita}T12:00`), 'dd/MM/yy', { locale: ptBR }) : '—'}</td>
                      <td className="px-5 py-4"><span className={`text-[12.5px] font-semibold capitalize ${patient.status === 'ativo' ? 'text-mint' : patient.status === 'alta' ? 'text-aqua' : 'text-pulse'}`}>{patient.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </Reveal>
    </div>
  );
}

function Pep({ id }: { id: string }) {
  const { patients } = useApp();
  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Empty title="Paciente não encontrado" action={<Link to="/pacientes"><Btn variant="ghost">Voltar</Btn></Link>} />;

  return (
    <div className="space-y-4">
      <Reveal>
        <Link to="/pacientes" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fog transition-colors hover:text-mint">
          <IconChevronL className="h-4 w-4" /> Pacientes
        </Link>
        <div className="mt-2"><PatientProfileHeader patient={patient} /></div>
      </Reveal>

      <Reveal delay={60}>
        <PatientOperationalActions patient={patient} />
      </Reveal>

      <Reveal delay={80}>
        <ClinicalWorkspace patient={patient} />
      </Reveal>
    </div>
  );
}
