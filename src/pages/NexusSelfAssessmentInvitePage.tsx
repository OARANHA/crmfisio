import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Card, CardHead, Chip, Empty, Btn } from '../lib/ui';
import { listNexusRuntimeScales } from '../lib/nexus/scaleCatalog';
import { createSelfAssessmentInvite } from '../lib/nexus/selfAssessment';

export function NexusSelfAssessmentInvitePage() {
  const { id } = useParams();
  const { user, patients, appointments, toast } = useApp();
  const patient = patients.find((item) => item.id === id);
  const scales = useMemo(() => listNexusRuntimeScales(), []);
  const [scaleKey, setScaleKey] = useState(scales[0]?.toolKey ?? '');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeAppointment = appointments.find((item) => item.pacienteId === id && item.status === 'em_atendimento') ?? null;
  const definition = scales.find((item) => item.toolKey === scaleKey) ?? null;

  if (!user) return <Navigate to="/" replace />;
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A autoaplicação exige o paciente canônico do MedicsPro." /></Card>;

  const createInvite = async () => {
    if (!definition) return;
    setBusy(true);
    try {
      const invite = await createSelfAssessmentInvite({ patientId: patient.id, appointmentId: activeAppointment?.id ?? null, scaleKey: definition.toolKey, ruleVersion: definition.ruleVersion, expiresHours: 48 });
      const publicLink = `${window.location.origin}${window.location.pathname}#/autoavaliacao/${invite.token}`;
      setLink(publicLink);
      toast('Link seguro de autoaplicação criado.', 'info');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao criar autoaplicação.', 'warn');
    } finally { setBusy(false); }
  };

  return <div className="space-y-4">
    <Card><CardHead title={`Nexus · Autoaplicação · ${patient.preferredName || patient.nome}`} sub="Convite seguro, expirável e vinculado ao paciente, clínica e versão do instrumento" />
      <div className="space-y-4 p-5"><div className="flex flex-wrap gap-2"><Chip className="border-mint/40 text-mint">token opaco</Chip><Chip className="border-line text-fog">48h</Chip><Chip className="border-aqua/30 text-aqua">sem resultado calculado no browser</Chip></div>
      <label className="block max-w-xl"><span className="mb-1 block text-[10.5px] text-fog">Instrumento</span><select className="field" value={scaleKey} onChange={(e) => { setScaleKey(e.target.value); setLink(null); }}>{scales.map((scale) => <option key={scale.toolKey} value={scale.toolKey}>{scale.acronym} · {scale.title}</option>)}</select></label>
      {definition && <div className="rounded-xl border border-line bg-deep p-4"><p className="text-[11px] font-semibold text-paper">{definition.acronym}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">Versão {definition.ruleVersion} · {definition.questions.length} itens · estimativa {definition.estimatedMinutes} min</p></div>}
      <div className="flex justify-end"><Btn disabled={busy || !definition} onClick={() => void createInvite()}>{busy ? 'Criando…' : 'Criar link seguro'}</Btn></div>
      {link && <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4"><p className="font-mono text-[9px] uppercase text-mint">Link criado — exibido uma vez</p><p className="mt-2 break-all text-[10.5px] text-paper">{link}</p><button type="button" onClick={() => navigator.clipboard.writeText(link)} className="mt-3 rounded-lg border border-mint/30 px-3 py-2 text-[10.5px] font-semibold text-mint">Copiar link</button></div>}</div>
    </Card>
    <Card><div className="p-5"><p className="font-display text-[13px] font-semibold text-paper">Contrato de segurança</p><p className="mt-2 text-[10.5px] leading-relaxed text-fog">O paciente responde sem acesso ao prontuário. A submissão fica pendente de processamento clínico server-side; ela não cria nem finaliza um resultado Nexus diretamente.</p></div></Card>
    <Link to={`/pacientes/${patient.id}/nexus`} className="text-[11px] text-fog hover:text-paper">← Voltar ao Nexus</Link>
  </div>;
}
