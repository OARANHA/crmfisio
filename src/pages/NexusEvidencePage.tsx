import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Card, CardHead, Chip, Empty } from '../lib/ui';
import { groupEvidenceByTopic, listNexusEvidence, type NexusEvidenceSource } from '../lib/nexus/evidence';
import { hasProfessionalCapability } from '../lib/nexusClinical';

export function NexusEvidencePage() {
  const { user } = useApp();
  const [items, setItems] = useState<NexusEvidenceSource[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([hasProfessionalCapability('nexus.evidence'), listNexusEvidence()])
      .then(([canSee, data]) => { if (!cancelled) { setAllowed(canSee); setItems(data); } })
      .catch(() => { if (!cancelled) setAllowed(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.topic, item.title, item.source, item.summary ?? ''].join(' ').toLowerCase().includes(q));
  }, [items, query]);

  if (!user) return <Navigate to="/" replace />;
  if (allowed === false) return <Navigate to="/pacientes" replace />;

  return <div className="space-y-4">
    <Card><CardHead title="Nexus · Evidências Clínicas" sub="Fontes, versões e proveniência das regras clínicas integradas ao MedicsPro" />
      <div className="p-5"><div className="flex flex-wrap items-center gap-2"><Chip className="border-aqua/40 text-aqua">Evidence Engine</Chip><Chip className="border-line text-fog">nexus.evidence</Chip></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tema, instrumento ou fonte..." className="field mt-4 max-w-xl" /></div>
    </Card>
    {groupEvidenceByTopic(filtered).map((group) => <Card key={group.topic}><div className="border-b border-line px-5 py-4"><p className="font-display text-[14px] font-semibold text-paper">{group.topic}</p></div><div className="grid gap-3 p-5">{group.sources.map((source) => <article key={source.id} className="rounded-xl border border-line bg-deep p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[12.5px] font-semibold text-paper">{source.title}</p><p className="mt-1 text-[10.5px] text-fog">{source.source}</p></div><Chip className="border-mint/30 text-mint">v{source.evidenceVersion}</Chip></div>{source.summary && <p className="mt-3 text-[11px] leading-relaxed text-fog">{source.summary}</p>}{source.keyPoints.length > 0 && <ul className="mt-3 space-y-1 text-[10.5px] text-fog">{source.keyPoints.map((point, index) => <li key={index}>• {point}</li>)}</ul>}{source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[10.5px] font-semibold text-aqua">Abrir fonte →</a>}</article>)}</div></Card>)}
    {!filtered.length && <Card><Empty title="Nenhuma evidência encontrada" sub="As fontes aparecem aqui após aplicação dos seeds/migrations do Nexus." /></Card>}
    <Link to="/pacientes" className="text-[11px] text-fog hover:text-paper">← Voltar</Link>
  </div>;
}
