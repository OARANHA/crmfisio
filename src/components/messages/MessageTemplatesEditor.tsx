import { useEffect, useState } from 'react';
import type { MessageTemplate, MessageTemplateRow } from '../../lib/messageOutbox';
import { Btn, Card, CardHead, Textarea } from '../../lib/ui';

const LABEL: Record<MessageTemplate, string> = {
  confirmacao: 'Confirmação de sessão',
  nps: 'Pesquisa NPS',
  reativacao: 'Reativação de inativo',
  vaga_espera: 'Oferta de vaga da lista de espera',
};

export function MessageTemplatesEditor({
  templates,
  busy,
  onSave,
}: {
  templates: MessageTemplateRow[];
  busy: boolean;
  onSave: (id: string, body: string) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(templates.map((item) => [item.id, item.body])));
  }, [templates]);

  return (
    <Card>
      <CardHead title="Modelos de mensagem" sub="persistidos por clínica · variáveis: {nome} {tipo} {data} {hora} {profissional}" />
      <div className="p-5 space-y-4">
        {templates.map((item) => (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-fog">{LABEL[item.template]}</p>
              <Btn variant="subtle" className="!px-3 !py-1.5 !text-[11px]" disabled={busy || !drafts[item.id]?.trim()} onClick={() => onSave(item.id, drafts[item.id] ?? '')}>Salvar</Btn>
            </div>
            <Textarea value={drafts[item.id] ?? ''} onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))} className="!min-h-[76px] !text-[12.5px]" />
          </div>
        ))}
        {templates.length === 0 && <p className="text-[11px] text-fog">Modelos serão criados automaticamente após a ativação da migration.</p>}
      </div>
    </Card>
  );
}
