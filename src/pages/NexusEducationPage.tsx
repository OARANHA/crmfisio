import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults } from '../lib/nexusClinical';
import { NEXUS_EDUCATION_MATERIALS, suggestEducationTopics } from '../lib/nexus/education';

export function NexusEducationPage() {
  const { id } = useParams();
  const { user, patients } = useApp();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [toolKeys, setToolKeys] = useState<string[]>([]);
  const patient = patients.find((item) => item.id === id);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    Promise.all([hasProfessionalCapability('nexus.education'), listPatientNexusResults(id)])
      .then(([canSee, results]) => { if (!cancelled) { setAllowed(canSee); setToolKeys(results.filter((r) => r.status === 'finalized').map((r) => r.toolKey)); } })
      .catch(() => { if (!cancelled) setAllowed(false); });
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const suggestedTopics = useMemo(() => suggestEducationTopics(toolKeys), [toolKeys]);
  const ordered = useMemo(() => [...NEXUS_EDUCATION_MATERIALS].sort((a, b) => Number(suggestedTopics.includes(b.topic)) - Number(suggestedTopics.includes(a.topic))), [suggestedTopics]);

  if (!user) return <Navigate to="/" replace />;
  if (allowed === false) return <Navigate to="/pacientes" replace />;
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A educação contextual exige o paciente canônico do MedicsPro." /></Card>;

  return <div className="space-y-4">
    <Card><CardHead title={`Nexus · Educação em Saúde · ${patient.preferredName || patient.nome}`} sub="Materiais curados do Nexus, priorizados pelo contexto clínico real do paciente" /><div className="p-5"><div className="flex flex-wrap gap-2"><Chip className="border-mint/40 text-mint">conteúdo curado</Chip><Chip className="border-line text-fog">nexus.education</Chip>{suggestedTopics.map((topic) => <Chip key={topic} className="border-aqua/30 text-aqua">sugerido: {topic}</Chip>)}</div><p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-fog">A priorização é determinística a partir dos instrumentos já utilizados. O conteúdo não é reescrito nem criado por IA e não substitui orientação individual do profissional.</p></div></Card>
    <div className="grid gap-3 lg:grid-cols-2">{ordered.map((material) => <Card key={material.id}><div className="p-5"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[9px] uppercase tracking-wide text-aqua">{material.topic}</p><h2 className="mt-1 font-display text-[15px] font-semibold text-paper">{material.title}</h2><p className="mt-1 text-[10.5px] text-fog">{material.targetAudience}</p></div>{suggestedTopics.includes(material.topic) && <Chip className="border-mint/30 text-mint">contextual</Chip>}</div><p className="mt-3 text-[11px] leading-relaxed text-fog">{material.summary}</p><div className="mt-3 rounded-xl border border-line bg-deep p-3"><p className="font-mono text-[9px] uppercase text-fog">Ações práticas</p><ul className="mt-2 space-y-1 text-[10.5px] leading-relaxed text-fog">{material.practicalActions.map((action, index) => <li key={index}>• {action}</li>)}</ul></div><details className="mt-3"><summary className="cursor-pointer text-[10.5px] font-semibold text-aqua">Ver conteúdo completo</summary><p className="mt-2 whitespace-pre-line text-[10.5px] leading-relaxed text-fog">{material.fullText}</p></details></div></Card>)}</div>
    <Link to={`/pacientes/${patient.id}/nexus`} className="text-[11px] text-fog hover:text-paper">← Voltar ao Nexus</Link>
  </div>;
}
