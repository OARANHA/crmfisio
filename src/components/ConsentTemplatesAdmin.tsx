import { useEffect, useState } from 'react';
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

export function ConsentTemplatesAdmin() {
  const { user, toast } = useApp();
  const [clinicId, setClinicId] = useState('');
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [nome, setNome] = useState('Termo de consentimento para tratamento fisioterapêutico');
  const [versao, setVersao] = useState('1.0');
  const [conteudo, setConteudo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (cid: string) => {
    const db = supabase as any;
    const { data, error } = await db
      .from('consent_templates')
      .select('id,nome,versao,conteudo,obrigatorio,ativo')
      .eq('clinic_id', cid)
      .order('nome');
    if (error) throw error;
    setTemplates(data ?? []);
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

  const save = async () => {
    if (!clinicId || !nome.trim() || !versao.trim() || !conteudo.trim()) return;
    setSaving(true);
    try {
      const db = supabase as any;
      const { error } = await db.from('consent_templates').insert({
        clinic_id: clinicId,
        nome: nome.trim(),
        versao: versao.trim(),
        conteudo: conteudo.trim(),
        obrigatorio: true,
        ativo: true,
      });
      if (error) throw error;
      await load(clinicId);
      setVersao('1.0');
      setConteudo('');
      toast('Modelo de consentimento criado e versionado.');
    } catch (error) {
      console.error('[MedicsPro] criar modelo de consentimento:', error);
      toast('Falha ao criar modelo de consentimento.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHead title="Consentimentos da clínica" sub="modelos versionados usados pela recepção e pelo prontuário" />
      <div className="p-5 space-y-5">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
          <div className="border border-line bg-deep p-4 space-y-3">
            <Field label="Nome do termo"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <Field label="Versão"><Input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="1.0" /></Field>
            <Field label="Conteúdo"><Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Texto integral que o paciente irá aceitar. Cada nova versão deve preservar o conteúdo anterior." /></Field>
            <Btn onClick={save} disabled={saving || !nome.trim() || !versao.trim() || !conteudo.trim()}>{saving ? 'Salvando…' : 'Criar modelo versionado'}</Btn>
          </div>
          <div>
            <p className="font-display font-semibold text-[14px]">Modelos ativos</p>
            <div className="mt-3 space-y-2">
              {templates.length === 0 ? (
                <div className="border border-amber/35 bg-amber/[0.04] p-4 text-[12px] text-amber">Nenhum modelo cadastrado. Crie o primeiro termo para liberar a coleta no prontuário.</div>
              ) : templates.map((t) => (
                <div key={t.id} className="border border-line bg-deep p-3">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-[13px]">{t.nome}</p>
                    <span className="font-mono text-[9.5px] text-mint">v{t.versao}</span>
                    <span className="ml-auto font-mono text-[9.5px] text-fog">{t.ativo ? 'ativo' : 'inativo'}</span>
                  </div>
                  <p className="text-[11px] text-fog mt-2 line-clamp-3 whitespace-pre-wrap">{t.conteudo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
