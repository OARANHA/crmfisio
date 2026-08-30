import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp, userName } from '../lib/store';
import { ROLE_META, maskCpf, type Access, type ModuleKey, type Role } from '../lib/types';
import { Card, CardHead, Btn, Chip, Select } from '../lib/ui';
import { IconLock, IconShield, IconCheck, IconX, IconEye, IconDb } from '../components/icons';
import { Reveal } from '../components/Reveal';

const RBAC_ROWS: { module: string; admin: Access; fisio: Access; recep: Access }[] = [
  { module: 'Agenda (agendar, mover, cancelar)', admin: 'full', fisio: 'full', recep: 'full' },
  { module: 'Prontuário / Anamnese', admin: 'read', fisio: 'full', recep: 'none' },
  { module: 'Evolução clínica + anexos', admin: 'none', fisio: 'full', recep: 'none' },
  { module: 'Financeiro (caixa, pacotes, repasse)', admin: 'full', fisio: 'read', recep: 'read' },
  { module: 'CRM (funil, NPS, lembretes)', admin: 'full', fisio: 'read', recep: 'full' },
  { module: 'Mensagens (automação WhatsApp)', admin: 'full', fisio: 'read', recep: 'full' },
  { module: 'Relatórios + exportações', admin: 'full', fisio: 'read', recep: 'none' },
  { module: 'Usuários, unidades e configurações', admin: 'full', fisio: 'none', recep: 'none' },
];

const ACC_META: Record<Access, { label: string; cls: string; icon: React.ReactNode }> = {
  full: { label: 'Total', cls: 'text-mint', icon: <IconCheck className="w-3.5 h-3.5" /> },
  read: { label: 'Leitura', cls: 'text-aqua', icon: <IconEye className="w-3.5 h-3.5" /> },
  none: { label: 'Sem acesso', cls: 'text-fog/60', icon: <IconX className="w-3.5 h-3.5" /> },
};

const LGPD_PILLARS = [
  { title: 'Criptografia de dados sensíveis', text: 'CPF, anamnese e evoluções com AES-256-GCM (envelope encryption via KMS). Dados de saúde são sensíveis (art. 5º, II).' },
  { title: 'Consentimento versionado', text: 'Termos com hash do conteúdo, versão, IP e timestamp. Histórico nunca sobrescrito — só versionado.' },
  { title: 'Auditoria completa', text: 'Toda ação sensível gera trilha: usuário, ação, entidade, IP e horário. Imutável (append-only).' },
  { title: 'Portabilidade & esquecimento', text: 'Export completo do titular em JSON e anonimização irreversível, com retenção clínica de 20 anos (CFM).' },
  { title: 'Mínimo acesso necessário', text: 'RBAC garante que a recepção nunca abra evolução clínica; o fisioterapeuta nunca altere repasses.' },
  { title: 'Retenção e backup seguros', text: 'Backups criptografados, plano de resposta a incidentes com notificação à ANPD em até 48h.' },
];

export function Config() {
  const { patients, users, audit, access, exportarTitular, anonimizarPaciente, toast, unidades } = useApp();
  const [tab, setTab] = useState<'rbac' | 'lgpd' | 'audit'>('rbac');
  const [exportando, setExportando] = useState('');
  const [anon, setAnon] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const elegiveis = patients.filter((p) => !p.anonimizado);
  const isAdmin = access('config') === 'full';

  const baixarExport = () => {
    const p = patients.find((x) => x.id === exportando);
    const pacote = exportarTitular(exportando);
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lgpd-portabilidade-${p?.nome.toLowerCase().replace(/\s+/g, '-') ?? exportando}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Portabilidade exportada — ${p?.nome} (ação registrada em auditoria)`);
    setExportando('');
  };

  const confirmarAnon = () => {
    if (!anon) return;
    if (!armed) { setArmed(true); return; }
    const p = patients.find((x) => x.id === anon);
    anonimizarPaciente(anon);
    toast(`Registro de ${p?.nome ?? 'paciente'} anonimizado de forma irreversível`, 'warn');
    setAnon(null); setArmed(false);
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
            <p className="text-fog text-[13px] mt-0.5">permissões, conformidade LGPD e trilha de auditoria</p>
          </div>
          <Chip className="ml-auto border-pulse/40 text-pulse"><IconLock className="w-3.5 h-3.5" /> área restrita ao administrador</Chip>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="flex border-b border-line overflow-x-auto">
          {([
            { k: 'rbac', l: 'Níveis de acesso (RBAC)' },
            { k: 'lgpd', l: 'LGPD · direitos do titular' },
            { k: 'audit', l: `Trilha de auditoria (${audit.length})` },
          ] as { k: typeof tab; l: string }[]).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 font-display font-semibold text-[13px] border-b-2 whitespace-nowrap transition-colors ${tab === t.k ? 'border-mint text-mint' : 'border-transparent text-fog hover:text-paper'}`}>
              {t.l}
            </button>
          ))}
        </div>
      </Reveal>

      {tab === 'rbac' && (
        <Reveal delay={120}>
          <Card className="overflow-x-auto">
            <CardHead
              title="Matriz de permissões por módulo"
              sub="decidida na API via Guards — a UI apenas reflete"
              right={<IconShield className="w-4.5 h-4.5 text-mint" />}
            />
            <table className="w-full min-w-[680px] text-[13px]">
              <thead>
                <tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                  <th className="text-left px-4 py-3 font-medium">Módulo</th>
                  {(Object.keys(ROLE_META) as Role[]).map((r) => (
                    <th key={r} className={`px-4 py-3 font-medium ${ROLE_META[r].text}`}>{ROLE_META[r].label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RBAC_ROWS.map((row, i) => (
                  <tr key={row.module} className={`border-b border-line/60 last:border-0 ${i % 2 ? 'bg-deep/40' : ''} hover:bg-raise/50 transition-colors`}>
                    <td className="px-4 py-3">{row.module}</td>
                    {(['admin', 'fisio', 'recep'] as Role[]).map((r) => {
                      const m = ACC_META[row[r]];
                      return (
                        <td key={r} className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 font-mono text-[11.5px] ${m.cls}`}>{m.icon}{m.label}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHead title="Usuários do sistema" sub="perfis ativos" />
              <ul className="divide-y divide-line/70">
                {users.map((u) => {
                  const rm = ROLE_META[u.role];
                  return (
                    <li key={u.id} className="px-5 py-3 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full grid place-items-center font-display font-bold text-[11px] text-ink" style={{ background: u.cor }}>
                        {u.nome.replace(/^(Dra?\.|Dr\.?)\s/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-[13px] truncate">{u.nome}</p>
                        <p className="font-mono text-[10px] text-fog">{u.email} · {u.registro}</p>
                      </div>
                      <Chip className={rm.chip}>{rm.label}</Chip>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card>
              <CardHead title="Unidades" sub="Fase 3 — operação multi-unidade" />
              <ul className="divide-y divide-line/70">
                {unidades.map((u) => (
                  <li key={u.id} className="px-5 py-3.5">
                    <p className="font-display font-semibold text-[13.5px]">{u.nome}</p>
                    <p className="font-mono text-[10.5px] text-fog mt-0.5">{u.endereco}</p>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3 border-t border-line font-mono text-[10.5px] text-fog">
                salas e sessões são vinculadas por unidade · o seletor global filtra agenda, dashboard e relatórios
              </div>
            </Card>
          </div>
        </Reveal>
      )}

      {tab === 'lgpd' && (
        <Reveal delay={120}>
          <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 items-start">
            <Card>
              <CardHead
                title="Direitos do titular — self-service"
                sub="portabilidade (art. 18, V) e esquecimento (art. 18, VI)"
                right={<IconLock className="w-4.5 h-4.5 text-pulse" />}
              />
              <div className="p-5 space-y-5">
                <div className="border border-line bg-deep p-4">
                  <p className="font-display font-semibold text-[14px] flex items-center gap-2"><IconDb className="w-4 h-4 text-aqua" /> Exportar dados do titular</p>
                  <p className="text-[12.5px] text-fog mt-1 leading-relaxed">
                    Gera o pacote completo do paciente: cadastro, sessões, evoluções, consentimentos, pesquisas, pacotes e financeiro — em JSON.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Select value={exportando} onChange={(e) => setExportando(e.target.value)} className="!w-64">
                      <option value="">Selecionar paciente…</option>
                      {elegiveis.map((p) => <option key={p.id} value={p.id}>{p.nome} · {maskCpf(p.cpf)}</option>)}
                    </Select>
                    <Btn onClick={baixarExport} disabled={!exportando || !isAdmin}>
                      <IconDb className="w-4 h-4" /> Baixar JSON
                    </Btn>
                  </div>
                </div>

                <div className="border border-pulse/35 bg-pulse/[0.04] p-4">
                  <p className="font-display font-semibold text-[14px] text-pulse flex items-center gap-2"><IconX className="w-4 h-4" /> Anonimização irreversível</p>
                  <p className="text-[12.5px] text-fog mt-1 leading-relaxed">
                    Remove todos os dados identificáveis do paciente (nome, CPF, contatos, anamnese). O registro clínico é preservado de forma anônima para a retenção legal de 20 anos.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Select value={anon ?? ''} onChange={(e) => { setAnon(e.target.value || null); setArmed(false); }} className="!w-64">
                      <option value="">Selecionar paciente…</option>
                      {elegiveis.map((p) => <option key={p.id} value={p.id}>{p.nome} · {maskCpf(p.cpf)}</option>)}
                    </Select>
                    <Btn variant={armed ? 'danger' : 'ghost'} className={armed ? '' : '!border-pulse/40 !text-pulse hover:!bg-pulse/10'} onClick={confirmarAnon} disabled={!anon || !isAdmin}>
                      {armed ? 'Confirmar — irreversível' : 'Anonimizar'}
                    </Btn>
                  </div>
                  {armed && <p className="font-mono text-[10.5px] text-pulse mt-2">⚠ Esta ação não pode ser desfeita. Confirma?</p>}
                </div>
                <p className="font-mono text-[10.5px] text-fog/70">
                  toda exportação e anonimização gera entrada na trilha de auditoria ao lado →
                </p>
              </div>
            </Card>

            <Card>
              <CardHead title="Pilares de conformidade" sub="LGPD by design desde a primeira migration" />
              <ul className="divide-y divide-line/70">
                {LGPD_PILLARS.map((p, i) => (
                  <li key={p.title} className="px-5 py-3.5 hover:bg-raise/40 transition-colors">
                    <p className="font-mono text-[10.5px] text-mint">{String(i + 1).padStart(2, '0')} <span className="text-fog/60">/0{LGPD_PILLARS.length}</span></p>
                    <p className="font-display font-semibold text-[13.5px] mt-1">{p.title}</p>
                    <p className="text-[12px] text-fog leading-relaxed mt-1">{p.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Reveal>
      )}

      {tab === 'audit' && (
        <Reveal delay={120}>
          <Card>
            <CardHead
              title="audit_log — trilha imutável"
              sub="append-only · quem fez o quê, quando"
              right={<IconShield className="w-4.5 h-4.5 text-mint" />}
            />
            <ul className="divide-y divide-line/70 max-h-[640px] overflow-y-auto">
              {audit.map((e) => {
                const acaoCls =
                  e.acao.includes('ANONIMIZACAO') ? 'border-pulse/40 text-pulse'
                  : e.acao.includes('EXPORTACAO') ? 'border-aqua/40 text-aqua'
                  : e.acao.includes('ASSINATURA') || e.acao.includes('LOGIN') ? 'border-mint/40 text-mint'
                  : 'border-amber/40 text-amber';
                return (
                  <li key={e.id} className="px-5 py-3 flex flex-wrap items-center gap-3 hover:bg-raise/40 transition-colors">
                    <span className="font-mono text-[10.5px] text-fog tabular-nums w-32 shrink-0">
                      {format(new Date(e.ts), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </span>
                    <Chip className={acaoCls}>{e.acao}</Chip>
                    <span className="text-[12.5px] flex-1 min-w-[200px]">{e.detalhe}</span>
                    <span className="font-mono text-[10.5px] text-fog">{userName(users, e.usuarioId)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      )}

    </div>
  );
}
