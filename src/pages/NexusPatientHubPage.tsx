import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const modules: NexusModule[] = [
  { key: 'mental-health', title: 'Saúde Mental', description: 'Escalas, risco, sintomas e acompanhamento longitudinal.', status: 'available' },
  { key: 'eem', title: 'Exame do Estado Mental', description: 'EEM estruturado, narrativa clínica e histórico.', status: 'planned' },
  { key: 'cognition', title: 'Cognição', description: 'MEEM e instrumentos cognitivos com evolução longitudinal.', status: 'planned' },
  { key: 'psychopharmacology', title: 'Psicofarmacologia', description: 'Equivalências, trocas, redução e monitoramento.', status: 'planned' },
  { key: 'calculators', title: 'Calculadoras', description: 'Função renal, risco cardiovascular e ferramentas clínicas.', status: 'planned' },
  { key: 'education', title: 'Educação em Saúde', description: 'Conteúdo contextual orientado pelos achados clínicos.', status: 'planned' },
  { key: 'evidence', title: 'Evidências', description: 'Fontes, versões de regras e proveniência do Nexus.', status: 'planned' },
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

  const latestPhq9 = useMemo(() => results.find((item) => item.toolKey === 'phq-9') ?? null, [results]);
  const latestCssrs = useMemo(() => results.find((item) => item.toolKey === 'cssrs') ?? null, [results]);
  const latestGad7 = useMemo(() => results.find((item) => item.toolKey === 'gad-7') ?? null, [results]);
  const latestHcl32 = useMemo(() => results.find((item) => item.toolKey === 'hcl-32') ?? null, [results]);
  const phq9History = useMemo(() => results.filter((item) => item.toolKey === 'phq-9'), [results]);
  const cssrsHistory = useMemo(() => results.filter((item) => item.toolKey === 'cssrs'), [results]);
  const gad7History = useMemo(() => results.filter((item) => item.toolKey === 'gad-7'), [results]);
  const hcl32History = useMemo(() => results.filter((item) => item.toolKey === 'hcl-32'), [results]);
  const alcoholHistory = useMemo(() => results.filter((item) => ['audit', 'audit-c', 'cage'].includes(item.toolKey)), [results]);

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
            {redFlags.slice(0, 3).map((flag) => (
              <div key={flag.id} className="rounded-xl border border-pulse/25 bg-deep p-3">
                <p className="text-[12.5px] font-semibold text-paper">{flag.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-fog">{flag.message}</p>
                {flag.requiredAction && <p className="mt-2 text-[11px] font-medium text-pulse">Ação: {flag.requiredAction}</p>}
                {flag.flagCode === 'phq9.item9.positive' && <Link to={`/pacientes/${patient.id}/nexus/cssrs`} className="mt-3 inline-flex rounded-lg border border-pulse/35 bg-pulse/[0.06] px-3 py-2 text-[11px] font-semibold text-pulse hover:bg-pulse/10">Aplicar C-SSRS agora →</Link>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <div className="border-b border-line px-5 py-4"><p className="font-display font-semibold text-[15px]">Domínios Nexus</p><p className="mt-1 text-[11px] text-fog">A estrutura permanece estável enquanto os módulos clínicos são migrados em ondas.</p></div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {modules.map((module) => (
              <div key={module.key} className="rounded-xl border border-line bg-deep p-4">
                <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="font-display font-semibold text-[13.5px] text-paper">{module.title}</p><p className="mt-1 text-[11px] leading-relaxed text-fog">{module.description}</p></div><Chip className={module.status === 'available' ? 'border-mint/40 text-mint' : 'border-line text-fog'}>{module.status === 'available' ? 'ativo' : 'em migração'}</Chip></div>
                {module.key === 'mental-health' && (
                  <div className="mt-4 space-y-2 border-t border-line pt-3">
                    <ToolLink href={`/pacientes/${patient.id}/nexus/phq9`} title="PHQ-9" subtitle="Depressão · aplicação clínica e evolução" tone="mint" />
                    <ToolLink href={`/pacientes/${patient.id}/nexus/gad7`} title="GAD-7" subtitle="Ansiedade · aplicação clínica e evolução" tone="aqua" />
                    <ToolLink href={`/pacientes/${patient.id}/nexus/scales/hcl-32`} title="HCL-32" subtitle="Hipomania / espectro bipolar · Scale Runtime" tone="aqua" />
                    <ToolLink href={`/pacientes/${patient.id}/nexus/cssrs`} title="C-SSRS" subtitle="Segurança · ideação e comportamento suicida" tone="pulse" />
                    <div className="pt-2"><p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-fog">Álcool e substâncias</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <MiniToolLink href={`/pacientes/${patient.id}/nexus/scales/audit`} title="AUDIT" />
                        <MiniToolLink href={`/pacientes/${patient.id}/nexus/scales/audit-c`} title="AUDIT-C" />
                        <MiniToolLink href={`/pacientes/${patient.id}/nexus/scales/cage`} title="CAGE" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-line px-3 py-2 text-[10.5px] text-fog">Demais escalas Nexus <span className="float-right">próximos lotes</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="border-b border-line px-5 py-4"><p className="font-display font-semibold text-[15px]">Resumo Nexus</p><p className="mt-1 text-[11px] text-fog">Sinais úteis antes de abrir uma ferramenta.</p></div>
            <div className="p-5 space-y-3">
              {loading ? <p className="font-mono text-[11px] text-fog">Carregando contexto clínico…</p> : <>
                <Metric label="Resultados finalizados" value={String(results.length)} />
                <Metric label="Alertas em aberto" value={String(redFlags.length)} attention={redFlags.length > 0} />
                <Metric label="Aplicações PHQ-9" value={String(phq9History.length)} />
                <Metric label="Aplicações GAD-7" value={String(gad7History.length)} />
                <Metric label="Aplicações HCL-32" value={String(hcl32History.length)} />
                <Metric label="Rastreios álcool" value={String(alcoholHistory.length)} />
                <Metric label="Avaliações C-SSRS" value={String(cssrsHistory.length)} />
                {latestCssrs && <ResultCard label="Última C-SSRS" value={`Nível ${latestCssrs.totalScore ?? '—'}`} suffix="/5" classification={latestCssrs.classification || ''} attention={latestCssrs.severity === 'severe'} />}
                {latestHcl32 && <ResultCard label="Último HCL-32" value={String(latestHcl32.totalScore ?? '—')} suffix="/32" classification={latestHcl32.classification || ''} attention={latestHcl32.severity === 'high'} />}
                {latestGad7 && <ResultCard label="Último GAD-7" value={String(latestGad7.totalScore ?? '—')} suffix="/21" classification={latestGad7.classification || ''} />}
                {latestPhq9 ? <div className="rounded-xl border border-aqua/30 bg-aqua/[0.04] p-3"><p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-aqua">Último PHQ-9</p><div className="mt-2 flex items-baseline gap-2"><span className="font-display text-[25px] font-bold text-paper">{latestPhq9.totalScore ?? '—'}</span><span className="text-[11px] text-fog">/ {latestPhq9.maxScore ?? 27}</span></div><p className="mt-1 text-[11.5px] font-semibold text-paper">{latestPhq9.classification || 'Sem classificação'}</p><p className="mt-1 font-mono text-[9.5px] text-fog">{format(new Date(latestPhq9.finalizedAt || latestPhq9.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p></div> : <Empty title="Sem resultados Nexus" sub="As primeiras escalas Nexus já estão disponíveis nesta onda." />}
              </>}
            </div>
          </Card>
          <Card><div className="p-5"><p className="font-display font-semibold text-[13px]">Princípio de segurança</p><p className="mt-2 text-[11px] leading-relaxed text-fog">O Nexus não cria outro paciente nem outro prontuário. Resultados clínicos versionados podem ser propostos ao SOAP, mas só entram após revisão explícita do profissional.</p></div></Card>
        </div>
      </div>
    </div>
  );
}

function ToolLink({ href, title, subtitle, tone }: { href: string; title: string; subtitle: string; tone: 'mint' | 'aqua' | 'pulse' }) {
  const classes = tone === 'pulse' ? 'border-pulse/25 bg-pulse/[0.035] hover:border-pulse/50 text-pulse' : tone === 'aqua' ? 'border-aqua/25 bg-aqua/[0.035] hover:border-aqua/50 text-aqua' : 'border-mint/25 bg-mint/[0.04] hover:border-mint/50 text-mint';
  return <Link to={href} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${classes}`}><span><span className="block text-[12px] font-semibold text-paper">{title}</span><span className="block text-[10.5px] text-fog">{subtitle}</span></span><span className="font-mono text-[10px]">abrir →</span></Link>;
}

function MiniToolLink({ href, title }: { href: string; title: string }) {
  return <Link to={href} className="rounded-lg border border-line px-3 py-2 text-center text-[10.5px] font-semibold text-fog transition-colors hover:border-aqua/40 hover:text-aqua">{title}</Link>;
}

function ResultCard({ label, value, suffix, classification, attention = false }: { label: string; value: string; suffix: string; classification: string; attention?: boolean }) {
  return <div className={`rounded-xl border p-3 ${attention ? 'border-pulse/40 bg-pulse/[0.05]' : 'border-aqua/25 bg-aqua/[0.03]'}`}><p className={`font-mono text-[9.5px] uppercase tracking-[0.14em] ${attention ? 'text-pulse' : 'text-aqua'}`}>{label}</p><div className="mt-2 flex items-baseline gap-2"><span className="font-display text-[25px] font-bold text-paper">{value}</span><span className="text-[11px] text-fog">{suffix}</span></div><p className="mt-1 text-[11.5px] font-semibold text-paper">{classification}</p></div>;
}

function Metric({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return <div className="flex items-center justify-between rounded-xl border border-line bg-deep px-3.5 py-3"><span className="text-[11.5px] text-fog">{label}</span><span className={`font-mono text-[13px] font-semibold ${attention ? 'text-pulse' : 'text-paper'}`}>{value}</span></div>;
}
