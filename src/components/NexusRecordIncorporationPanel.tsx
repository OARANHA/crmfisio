import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Patient } from '../lib/types';
import { listPatientNexusRecordIncorporations, type NexusRecordIncorporation } from '../lib/nexusRecordIncorporation';
import { Card, CardHead, Chip, Empty } from '../lib/ui';
import { userName } from '../lib/displayNames';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';

export function NexusRecordIncorporationPanel({ patient }: { patient: Patient }) {
  const { users } = useClinicDirectory();
  const [items, setItems] = useState<NexusRecordIncorporation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listPatientNexusRecordIncorporations(patient.id)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((error) => console.error('[MedicsPro/Nexus] incorporações no prontuário:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patient.id]);

  return (
    <Card>
      <CardHead
        title="Nexus incorporado ao prontuário"
        sub="snapshots clínicos explicitamente revisados e assinados · origem e versão preservadas"
      />
      {loading ? (
        <div className="p-5 text-[11px] text-fog">Carregando incorporações Nexus…</div>
      ) : items.length === 0 ? (
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
    </Card>
  );
}
