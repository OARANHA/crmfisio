import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/store';
import { isClinicManager } from '../lib/permissions';
import { Card, Chip, Empty } from '../lib/ui';
import {
  listPatientNexusResults,
  listPatientOpenNexusRedFlags,
  type NexusClinicalResult,
  type NexusRedFlag,
} from '../lib/nexusClinical';

type NexusModule = { key: string; title: string; description: string; status: 'available' | 'planned' };
type Tool = { key: string; title: string; subtitle: string; href: (patientId: string) => string; tone?: 'mint' | 'aqua' | 'pulse' };

const modules: NexusModule[] = [
  { key: 'mental-health', title: 'Saúde Mental', description: 'Escalas, risco, sintomas e acompanhamento longitudinal.', status: 'available' },
  { key: 'eem', title: 'Exame do Estado Mental', description: 'EEM estruturado, narrativa clínica e histórico.', status: 'planned' },
  { key: 'cognition', title: 'Cognição', description: 'MEEM e instrumentos cognitivos com evolução longitudinal.', status: 'planned' },
  { key: 'psychopharmacology', title: 'Psicofarmacologia', description: 'Equivalências, trocas, redução e monitoramento.', status: 'planned' },
  { key: 'calculators', title: 'Calculadoras', description: 'Função renal, risco cardiovascular e ferramentas clínicas.', status: 'planned' },
  { key: 'education', title: 'Educação em Saúde', description: 'Conteúdo contextual orientado pelos achados clínicos.', status: 'planned' },
  { key: 'evidence', title: 'Evidências', description: 'Fontes, versões de regras e proveniência do Nexus.', status: 'planned' },
];

const groups: { title: string; tools: Tool[] }[] = [
  { title: 'Humor e depressão', tools: [
    { key: 'phq-9', title: 'PHQ-9', subtitle: 'Depressão · evolução longitudinal', tone: 'mint', href: (id) => `/pacientes/${id}/nexus/phq9` },
    { key: 'hcl-32', title: 'HCL-32', subtitle: 'Hipomania / espectro bipolar', href: (id) => `/pacientes/${id}/nexus/scales/hcl-32` },
    { key: 'epds', title: 'EPDS', subtitle: 'Depressão perinatal · item 10 de segurança', tone: 'pulse', href: (id) => `/pacientes/${id}/nexus/scales/epds` },
  ]},
  { title: 'Ansiedade, TOC e sofrimento psíquico', tools: [
    { key: 'gad-7', title: 'GAD-7', subtitle: 'Ansiedade · evolução longitudinal', href: (id) => `/pacientes/${id}/nexus/gad7` },
    { key: 'ybocs', title: 'Y-BOCS', subtitle: 'Obsessões e compulsões', href: (id) => `/pacientes/${id}/nexus/scales/ybocs` },
    { key: 'srq-20', title: 'SRQ-20', subtitle: 'Transtornos mentais comuns · item 17 de segurança', tone: 'pulse', href: (id) => `/pacientes/${id}/nexus/scales/srq-20` },
    { key: 'phq-15', title: 'PHQ-15', subtitle: 'Sintomas somáticos', href: (id) => `/pacientes/${id}/nexus/scales/phq-15` },
  ]},
  { title: 'TDAH / neurodesenvolvimento', tools: [
    { key: 'asrs-18', title: 'ASRS-18', subtitle: 'TDAH em adultos · desatenção e hiperatividade', href: (id) => `/pacientes/${id}/nexus/scales/asrs-18` },
  ]},
  { title: 'Álcool e substâncias', tools: [
    { key: 'audit', title: 'AUDIT', subtitle: 'Uso de risco, nocivo e dependência', href: (id) => `/pacientes/${id}/nexus/scales/audit` },
    { key: 'audit-c', title: 'AUDIT-C', subtitle: 'Rastreio breve · divergência de corte em revisão', href: (id) => `/pacientes/${id}/nexus/scales/audit-c` },
    { key: 'cage', title: 'CAGE', subtitle: 'Rastreio breve de dependência', href: (id) => `/pacientes/${id}/nexus/scales/cage` },
  ]},
  { title: 'Segurança', tools: [
    { key: 'cssrs', title: 'C-SSRS', subtitle: 'Ideação e comportamento suicida', tone: 'pulse', href: (id) => `/pacientes/${id}/nexus/cssrs` },
  ]},
];

export function NexusPatientHubPage() {
  const { id } = useParams();
  const { user, patients } = useApp();
  const [results, setResults] = useState<NexusClinicalResult[]>([]);
  const [redFlags, setRedFlags] = useState<NexusRedFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const canSeeClinical = Boolean(user && (user.role === 'fisio' || isClinicManager(user.role)));
  const patient = patients.find((item) => item.id === id);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id || !canSeeClinical) { setLoading(false); return; }
      setLoading(true);
      try {
        const [patientResults, patientFlags] = await Promise.all([
          listPatientNexusResults(id),
          listPatientOpenNexusRedFlags(id),
        ]);
        if (!cancelled) { setResults(patientResults); setRedFlags(patientFlags); }
      } catch (error) {
        console.error('[MedicsPro] Nexus patient hub:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, canSeeClinical]);

  const resultCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const result of results) counts.set(result.toolKey, (counts.get(result.toolKey) ?? 0) + 1);
    return counts;
  }, [results]);

  if (!user) return <Navigate to="/" replace />;
  if (!canSeeClinical) return <Navigate to="/pacientes" replace />;
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="O Nexus funciona sempre no contexto do paciente canônico do MedicsPro." /></Card>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-aqua/25 bg-panel/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-aqua">Nexus Clinical Engine</p>
            <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight text-paper">Visão clínica · {patient.preferredName || patient.nome}</h1>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Inteligência clínica contextual ao paciente, conectada ao prontuário, resultados versionados, alertas e evolução longitudinal.</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/pacientes/${patient.id}/prontuario`} className="rounded-xl border border-mint/30 bg-mint/[0.04] px-3.5 py-2 text-[12px] font-semibold text-mint hover:bg-mint/10">Prontuário SOAP</Link>
            <Link to={`/pacientes/${patient.id}`} className="rounded-xl border border-line px-3.5 py-2 text-[12px] font-semibold text-fog hover:bg-raise hover:text-paper">Voltar ao paciente</Link>
          </div>
        </div>
      </section>

      {redFlags.length > 0 && (
        <section className="rounded-2xl border border-pulse/40 bg-pulse/[0.05] p-4">
          <div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold text-[14px] text-pulse">Alertas clínicos em aberto</p><Chip className="border-pulse/40 text-pulse">{redFlags.length}</Chip></div>
          <div className="mt-3 grid gap-2">
            {redFlags.slice(0, 4).map((flag) => (
              <div key={flag.id} className="rounded-xl border border-pulse/25 bg-deep p-3">
                <p className="text-[12.5px] font-semibold text-paper">{flag.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-fog">{flag.message}</p>
                {flag.requiredAction && <p className="mt-2 text-[11px] font-medium text-pulse">Ação: {flag.requiredAction}</p>}
                {['phq9.item9.positive', 'epds.item10.self-harm', 'srq20.item17.death-ideation'].includes(flag.flagCode) && (
                  <Link to={`/pacientes/${patient.id}/nexus/cssrs`} className="mt-3 inline-flex rounded-lg border border-pulse/35 bg-pulse/[0.06] px-3 py-2 text-[11px] font-semibold text-pulse hover:bg-pulse/10">Aplicar C-SSRS agora →</Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <Card>
          <div className="border-b border-line px-5 py-4"><p className="font-display font-semibold text-[15px]">Saúde Mental · instrumentos Nexus</p><p className="mt-1 text-[11px] text-fog">Organizados pelo problema clínico, não por ordem alfabética.</p></div>
          <div className="space-y-5 p-5">
            {groups.map((group) => (
              <section key={group.title}>
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-fog">{group.title}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {group.tools.map((tool) => <ToolLink key={tool.key} href={tool.href(patient.id)} title={tool.title} subtitle={tool.subtitle} tone={tool.tone ?? 'aqua'} count={resultCounts.get(tool.key) ?? 0} />)}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="border-b border-line px-5 py-4"><p className="font-display font-semibold text-[15px]">Resumo Nexus</p><p className="mt-1 text-[11px] text-fog">Contexto longitudinal antes de abrir uma ferramenta.</p></div>
            <div className="space-y-3 p-5">
              {loading ? <p className="font-mono text-[11px] text-fog">Carregando contexto clínico…</p> : <>
                <Metric label="Resultados finalizados" value={String(results.length)} />
                <Metric label="Alertas em aberto" value={String(redFlags.length)} attention={redFlags.length > 0} />
                <Metric label="Instrumentos já utilizados" value={String(resultCounts.size)} />
                <Metric label="Instrumentos ativos neste Hub" value={String(groups.reduce((sum, group) => sum + group.tools.length, 0))} />
              </>}
            </div>
          </Card>
          <Card><div className="p-5"><p className="font-display font-semibold text-[13px]">Outros domínios Nexus</p><div className="mt-3 space-y-2">{modules.filter((module) => module.key !== 'mental-health').map((module) => <div key={module.key} className="rounded-xl border border-line bg-deep p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11.5px] font-semibold text-paper">{module.title}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{module.description}</p></div><Chip className="border-line text-fog">em migração</Chip></div></div>)}</div></div></Card>
          <Card><div className="p-5"><p className="font-display font-semibold text-[13px]">Princípio de segurança</p><p className="mt-2 text-[11px] leading-relaxed text-fog">O Nexus não cria outro paciente nem outro prontuário. Resultados versionados podem ser propostos ao SOAP, mas só entram após revisão explícita do profissional.</p></div></Card>
        </div>
      </div>
    </div>
  );
}

function ToolLink({ href, title, subtitle, tone, count }: { href: string; title: string; subtitle: string; tone: 'mint' | 'aqua' | 'pulse'; count: number }) {
  const classes = tone === 'pulse' ? 'border-pulse/25 bg-pulse/[0.035] hover:border-pulse/50 text-pulse' : tone === 'mint' ? 'border-mint/25 bg-mint/[0.04] hover:border-mint/50 text-mint' : 'border-aqua/25 bg-aqua/[0.035] hover:border-aqua/50 text-aqua';
  return <Link to={href} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors ${classes}`}><span className="min-w-0"><span className="block text-[12px] font-semibold text-paper">{title}</span><span className="block text-[10.5px] text-fog">{subtitle}</span></span><span className="shrink-0 text-right"><span className="block font-mono text-[10px]">abrir →</span>{count > 0 && <span className="mt-1 block font-mono text-[8.5px] text-fog">{count} resultado{count === 1 ? '' : 's'}</span>}</span></Link>;
}

function Metric({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return <div className="flex items-center justify-between rounded-xl border border-line bg-deep px-3.5 py-3"><span className="text-[11.5px] text-fog">{label}</span><span className={`font-mono text-[13px] font-semibold ${attention ? 'text-pulse' : 'text-paper'}`}>{value}</span></div>;
}
