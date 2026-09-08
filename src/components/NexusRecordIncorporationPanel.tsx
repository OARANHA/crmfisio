import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Patient } from '../lib/types';
import { listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import {
  incorporateNexusResultIntoClinicalRecord,
  listPatientNexusRecordIncorporations,
  type NexusRecordIncorporation,
} from '../lib/nexusRecordIncorporation';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { userName } from '../lib/displayNames';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useToast } from '../lib/toastContext';

export function NexusRecordIncorporationPanel({ patient }: { patient: Patient }) {
  const { users } = useClinicDirectory();
  const { toast } = useToast();
  const [items, setItems] = useState<NexusRecordIncorporation[]>([]);
  const [results, setResults] = useState<NexusClinicalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyResultId, setBusyResultId] = useState<string | null>(null);

  const load = async () => {
    const [incorporations, nexusResults] = await Promise.all([
      listPatientNexusRecordIncorporations(patient.id),
      listPatientNexusResults(patient.id),
    ]);
    setItems(incorporations);
    setResults(nexusResults);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      listPatientNexusRecordIncorporations(patient.id),
      listPatientNexusResults(patient.id),
    ])
      .then(([incorporations, nexusResults]) => {
        if (cancelled) return;
        setItems(incorporations);
        setResults(nexusResults);
      })
      .catch((error) => console.error('[MedicsPro/Nexus] prontuário Nexus:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patient.id]);

  const incorporatedResultIds = useMemo(() => new Set(items.map((item) => item.nexusResultId)), [items]);
  const pendingSigned = useMemo(
    () => results.filter((result) => result.lifecycleState === 'signed' && !incorporatedResultIds.has(result.id)),
    [results, incorporatedResultIds],
  );

  const incorporate = async (result: NexusClinicalResult) => {
    if (result.lifecycleState !== 'signed' || busyResultId) return;
    setBusyResultId(result.id);
    try {
      await incorporateNexusResultIntoClinicalRecord(result.id);
      await load();
      toast('Resultado Nexus incorporado ao prontuário com proveniência preservada.', 'info');
    } catch (error) {
      console.error('[MedicsPro/Nexus] incorporar ao prontuário:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível incorporar o resultado Nexus.', 'warn');
    } finally {
      setBusyResultId(null);
    }
  };

  return (
    <Card>
      <CardHead
        title="Nexus no prontuário"
        sub="incorporação clínica explícita · somente resultados revisados e assinados · origem e versão preservadas"
      />
      {loading ? (
        <div className="p-5 text-[11px] text-fog">Carregando incorporações Nexus…</div>
      ) : (
        <div>
          {pendingSigned.length > 0 && (
            <div className="border-b border-line/70 p-5">
              <p className="font-display text-[13px] font-semibold text-paper">Resultados assinados disponíveis</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-fog">A assinatura Nexus não cria prontuário automaticamente. Escolha explicitamente o que deve ser incorporado ao registro oficial.</p>
              <div className="mt-3 space-y-2">
                {pendingSigned.map((result) => (
                  <div key={result.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-deep/40 p-3">
                    <Chip className="border-aqua/40 text-aqua">{result.toolKey.toUpperCase()}</Chip>
                    <Chip className="border-line text-fog">{result.ruleVersion}</Chip>
                    {result.classification && <span className="text-[10.5px] text-fog">{result.classification}</span>}
                    <Btn className="ml-auto" variant="subtle" disabled={busyResultId !== null} onClick={() => void incorporate(result)}>
                      {busyResultId === result.id ? 'Incorporando…' : 'Incorporar ao prontuário'}
                    </Btn>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <Empty title="Nenhum resultado Nexus incorporado" sub="Resultados técnicos ou apenas revisados não entram aqui. A incorporação exige assinatura clínica explícita." />
          ) : (
            <ul className="divide-y divide-line/70">
              {items.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-mint">
                      {format(new Date(item.incorporatedAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-[10.5px] text-fog">por {userName(users, item.professionalId)}</span>
                    <Chip className="border-aqua/40 text-aqua">Nexus · {item.toolKey.toUpperCase()}</Chip>
                    <Chip className="border-mint/40 text-mint">incorporado ✓</Chip>
                    <Chip className="border-line text-fog">{item.ruleVersion}</Chip>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-paper/90">{item.clinicalSummary}</p>
                  {item.soapText && (
                    <div className="mt-3 rounded-xl border border-line/70 bg-deep/45 p-3">
                      <p className="font-mono text-[9.5px] uppercase tracking-wide text-fog">SOAP / conteúdo clínico aprovado</p>
                      <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-paper/85">{item.soapText}</p>
                    </div>
                  )}
                  {item.redFlags.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {item.redFlags.map((flag) => (
                        <div key={`${item.id}-${flag.flagCode}`} className="rounded-lg border border-amber/30 bg-amber/[0.04] px-3 py-2 text-[11px] text-paper/85">
                          <span className="font-semibold">{flag.title}</span>{flag.requiredAction ? ` · ${flag.requiredAction}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 font-mono text-[9.5px] text-fog">
                    Origem Nexus {item.nexusResultId.slice(0, 8)}… · regra {item.ruleKey} · assinado {format(new Date(item.sourceSignedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
