import { supabase } from '../supabaseClient';
import { hasProfessionalCapability } from '../nexusClinical';

export type NexusEvidenceSource = {
  id: string;
  evidenceKey: string;
  topic: string;
  title: string;
  source: string;
  publicationYear: number | null;
  summary: string | null;
  keyPoints: string[];
  sourceUrl: string | null;
  evidenceVersion: string;
};

const db = supabase as any;

const mapEvidence = (row: any): NexusEvidenceSource => ({
  id: row.id,
  evidenceKey: row.evidence_key,
  topic: row.topic,
  title: row.title,
  source: row.source,
  publicationYear: row.publication_year == null ? null : Number(row.publication_year),
  summary: row.summary ?? null,
  keyPoints: Array.isArray(row.key_points) ? row.key_points.map(String) : [],
  sourceUrl: row.source_url ?? null,
  evidenceVersion: row.evidence_version,
});

export async function listNexusEvidence(): Promise<NexusEvidenceSource[]> {
  if (!(await hasProfessionalCapability('nexus.evidence'))) return [];
  const { data, error } = await db
    .from('nexus_evidence_sources')
    .select('*')
    .eq('active', true)
    .order('topic')
    .order('publication_year', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEvidence);
}

export function groupEvidenceByTopic(items: NexusEvidenceSource[]) {
  const groups = new Map<string, NexusEvidenceSource[]>();
  for (const item of items) groups.set(item.topic, [...(groups.get(item.topic) ?? []), item]);
  return [...groups.entries()].map(([topic, sources]) => ({ topic, sources }));
}
