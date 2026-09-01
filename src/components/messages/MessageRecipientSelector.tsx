import { useEffect, useMemo, useState } from 'react';
import { Btn, Card, CardHead, Chip } from '../../lib/ui';

export interface MessageRecipientCandidate {
  id: string;
  patientId: string;
  patientName: string;
  primary: string;
  secondary?: string;
}

interface Props {
  title: string;
  sub: string;
  candidates: MessageRecipientCandidate[];
  blockedSummary?: string;
  busy?: boolean;
  canSend?: boolean;
  accent?: 'mint' | 'aqua';
  onSend: (ids: string[]) => Promise<void> | void;
}

export function MessageRecipientSelector({ title, sub, candidates, blockedSummary, busy, canSend = true, accent = 'mint', onSend }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const ids = useMemo(() => candidates.map((item) => item.id), [candidates]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));

  useEffect(() => {
    setSelected((current) => current.filter((id) => ids.includes(id)));
  }, [ids.join('|')]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAll = () => setSelected(allSelected ? [] : ids);
  const accentClass = accent === 'mint' ? 'border-mint/45 text-mint' : 'border-aqua/45 text-aqua';

  return (
    <Card>
      <CardHead title={title} sub={sub} />
      <div className="px-5 py-3 border-b border-line/70 flex flex-wrap items-center gap-2">
        <Chip className={accentClass}>{candidates.length} elegível{candidates.length === 1 ? '' : 'is'}</Chip>
        {blockedSummary && <span className="font-mono text-[10px] text-fog">{blockedSummary}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Btn variant="subtle" disabled={!candidates.length || busy} onClick={toggleAll}>{allSelected ? 'Limpar seleção' : 'Selecionar todos'}</Btn>
          <Btn disabled={!canSend || busy || selected.length === 0} onClick={() => onSend(selected)}>
            Enviar {selected.length ? `${selected.length} selecionado${selected.length === 1 ? '' : 's'}` : 'selecionados'}
          </Btn>
        </div>
      </div>
      {!candidates.length ? (
        <div className="px-5 py-7 text-[12px] text-fog">Nenhum destinatário elegível neste momento.</div>
      ) : (
        <div className="divide-y divide-line/70 max-h-[320px] overflow-y-auto">
          {candidates.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <label key={item.id} className={`px-5 py-3 flex gap-3 items-start cursor-pointer transition-colors ${checked ? 'bg-raise/70' : 'hover:bg-raise/35'}`}>
                <input className="mt-1 accent-current" type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold text-[13px]">{item.patientName}</span>
                    {checked && <Chip className={accentClass}>selecionado</Chip>}
                  </div>
                  <p className="text-[12px] text-paper/85 mt-0.5">{item.primary}</p>
                  {item.secondary && <p className="font-mono text-[10px] text-fog mt-1">{item.secondary}</p>}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}
