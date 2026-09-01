import { useEffect, useMemo, useState } from 'react';
import { resolveClinicId } from '../lib/repository';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import { Btn, Card, CardHead, Field, Input, Textarea } from '../lib/ui';

type ConsentTemplate = {
  id: string;
  nome: string;
  versao: string;
  conteudo: string;
  obrigatorio: boolean;
  ativo: boolean;
};

const DYNAMIC_FIELDS = [
  '{{PACIENTE_NOME}}', '{{PACIENTE_CPF}}', '{{PACIENTE_NASCIMENTO}}',
  '{{PACIENTE_TELEFONE}}', '{{PACIENTE_EMAIL}}', '{{QUEIXA_PRINCIPAL}}',
  '{{CID10}}', '{{OBJETIVOS_TERAPEUTICOS}}', '{{PLANO_TERAPEUTICO}}',
  '{{PROFISSIONAL_NOME}}', '{{PROFISSIONAL_REGISTRO}}', '{{DATA_ATUAL}}',
];

const nextVersion = (current: string) => {
  const parts = current.split('.').map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) return `${parts[0]}.${parts[1] + 1}`;
  return `${current}.1`;
};

export function ConsentTemplatesAdmin() {
  const { user, toast } = useApp();
  const [clinicId, setClinicId] = useState('');
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('Termo de consentimento para tratamento fisioterapêutico');
  const [versao, setVersao] = useState('1.0');
  const [conteudo, setConteudo] = useState('');
  const [saving, setSaving] = useState(false);

  const db = supabase as any;

  const load = async (cid: string) => {
    const [templateResult, usageResult] = await Promise.all([
      db.from('consent_templates').select('id,nome,versao,conteudo,obrigatorio,ativo').eq('clinic_id', cid).order('nome').order('created_at'),
      db.from('consent_terms').select('template_id').eq('clinic_id', cid).not('template_id', 'is', null),
    ]);
    if (templateResult.error) throw templateResult.error;
    if (usageResult.error) throw usageResult.error;
    setTemplates(templateResult.data ?? []);
    const counts: Record<string, number> = {};
    for (const row of usageResult.data ?? []) {
      if (row.template_id) counts[row.template_id] = (counts[row.template_id] ?? 0) + 1;
    }
    setUsage(counts);
  };

  useEffect(() => {
    if (!user?.id) return;
    resolveClinicId(user.id)
      .then(async (cid) => {
        setClinicId(cid);
        await load(cid);
      })
      .catch((error) => {
        console.error('[MedicsPro] modelos de consentimento:', error);
        toast('Não foi possível carregar os modelos de consentimento.', 'warn');
      });
  }, [user?.id]);

  const resetForm = () => {
    setEditingId(null);
    setNome('Termo de consentimento para tratamento fisioterapêutico');
    setVersao('1.0');
    setConteudo('');
  };

  const selectedEditing = useMemo(() => templates.find((t) => t.id === editingId) ?? null, [templates, editingId]);

  const save = async () => {
    if (!clinicId || !nome.trim() || !versao.trim() || !conteudo.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        if ((usage[editingId] ?? 0) > 0) throw new Error('Versão já utilizada; crie uma nova versão em vez de editar.');
        const { error } = await db.from('consent_templates').update({
          nome: nome.trim(),
          versao: versao.trim(),
          conteudo: conteudo.trim(),
        }).eq('id', editingId).eq('clinic_id', clinicId);
        if (error) throw error;
        toast('Modelo atualizado.');
      } else {
        const { error } = await db.from('consent_templates').insert({
          clinic_id: clinicId,
          nome: nome.trim(),
          versao: versao.trim(),
          conteudo: conteudo.trim(),
          obrigatorio: true,
          ativo: true,
        });
        if (error) throw error;
        toast('Modelo de consentimento criado e versionado.');
      }
      await load(clinicId);
      resetForm();
    } catch (error) {
      console.error('[MedicsPro] salvar modelo de consentimento:', error);
      toast(error instanceof Error ? error.message : 'Falha ao salvar modelo de consentimento.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const editTemplate = (t: ConsentTemplate) => {
    if ((usage[t.id] ?? 0) > 0) {
      toast('Essa versão já foi usada. Crie uma nova versão para preservar o histórico.', 'info');
      return;
    }
    setEditingId(t.id);
    setNome(t.nome);
    setVersao(t.versao);
    setConteudo(t.conteudo);
  };

  const cloneVersion = (t: ConsentTemplate) => {
    setEditingId(null);
    setNome(t.nome);
    setVersao(nextVersion(t.versao));
    setConteudo(t.conteudo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (t: ConsentTemplate) => {
    try {
      const { error } = await db.from('consent_templates').update({ ativo: !t.ativo }).eq('id', t.id).eq('clinic_id', clinicId);
      if (error) throw error;
      await load(clinicId);
      toast(t.ativo ? 'Versão desativada. Ela não será oferecida em novos consentimentos.' : 'Versão reativada.');
    } catch (error) {
      console.error('[MedicsPro] alternar modelo:', error);
      toast('Não foi possível alterar o status do modelo.', 'warn');
    }
  };

  const removeTemplate = async (t: ConsentTemplate) => {
    if ((usage[t.id] ?? 0) > 0) {
      toast('Versão já utilizada não pode ser excluída. Desative-a para preservar auditoria.', 'warn');
      return;
    }
    if (!window.confirm(`Excluir definitivamente ${t.nome} v${t.versao}?`)) return;
    try {
      const { error } = await db.from('consent_templates').delete().eq('id', t.id).eq('clinic_id', clinicId);
      if (error) throw error;
      await load(clinicId);
      if (editingId === t.id) resetForm();
      toast('Versão não utilizada excluída.');
    } catch (error) {
      console.error('[MedicsPro] excluir modelo:', error);
      toast('Não foi possível excluir o modelo.', 'warn');
    }
  };

  return (
    <Card>
      <CardHead title="Consentimentos da clínica" sub="versionamento sem perder o histórico jurídico do que já foi aceito" />
      <div className="p-5 space-y-5">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
          <div className="border border-line bg-deep p-4 space-y-3">
            {selectedEditing && (
              <div className="border border-amber/35 bg-amber/[0.04] p-3 text-[11px] text-amber">
                Editando versão ainda não utilizada. Depois do primeiro consentimento gerado, esta versão fica imutável e novas alterações devem virar uma nova versão.
              </div>
            )}
            <Field label="Nome do termo"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <Field label="Versão"><Input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="1.0" /></Field>
            <Field label="Conteúdo"><Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Texto integral que o paciente irá aceitar. Cada nova versão deve preservar o conteúdo anterior." /></Field>
            <div className="border border-mint/25 bg-mint/[0.03] p-3">
              <p className="font-display font-semibold text-[12px]">Campos preenchidos automaticamente</p>
              <p className="text-[10.5px] text-fog mt-1">Ao gerar o documento o MedicsPro vincula os dados reais do paciente e do profissional. Clique para inserir o campo no texto.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DYNAMIC_FIELDS.map((field) => (
                  <button key={field} type="button" onClick={() => setConteudo((prev) => `${prev}${prev ? '\n' : ''}${field}`)} className="font-mono text-[9px] border border-line px-2 py-1 text-mint hover:border-mint/50">
                    {field}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={save} disabled={saving || !nome.trim() || !versao.trim() || !conteudo.trim()}>{saving ? 'Salvando…' : editingId ? 'Salvar edição' : 'Criar modelo versionado'}</Btn>
              {editingId && <Btn variant="ghost" onClick={resetForm}>Cancelar edição</Btn>}
            </div>
          </div>
          <div>
            <p className="font-display font-semibold text-[14px]">Versões do termo</p>
            <p className="text-[11px] text-fog mt-1">Versões já usadas não são apagadas nem alteradas; podem ser desativadas e substituídas por uma nova.</p>
            <div className="mt-3 space-y-2">
              {templates.length === 0 ? (
                <div className="border border-amber/35 bg-amber/[0.04] p-4 text-[12px] text-amber">Nenhum modelo cadastrado. Crie o primeiro termo para liberar a coleta no prontuário.</div>
              ) : templates.map((t) => {
                const used = usage[t.id] ?? 0;
                return (
                  <div key={t.id} className="border border-line bg-deep p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold text-[13px]">{t.nome}</p>
                      <span className="font-mono text-[9.5px] text-mint">v{t.versao}</span>
                      <span className={`font-mono text-[9.5px] ${t.ativo ? 'text-mint' : 'text-fog'}`}>{t.ativo ? 'ativo' : 'inativo'}</span>
                      <span className="ml-auto font-mono text-[9.5px] text-fog">{used} documento(s) gerado(s)</span>
                    </div>
                    <p className="text-[11px] text-fog mt-2 line-clamp-3 whitespace-pre-wrap">{t.conteudo}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {used === 0 && <Btn variant="ghost" onClick={() => editTemplate(t)}>Editar</Btn>}
                      <Btn variant="ghost" onClick={() => cloneVersion(t)}>Criar nova versão</Btn>
                      <Btn variant="ghost" onClick={() => toggleActive(t)}>{t.ativo ? 'Desativar' : 'Reativar'}</Btn>
                      {used === 0 && <Btn variant="ghost" onClick={() => removeTemplate(t)}>Excluir</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
