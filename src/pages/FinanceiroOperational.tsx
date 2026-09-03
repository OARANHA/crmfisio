import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp, userName } from '../lib/store';
import { dayOf, fmtBRL, type FinancialTransaction } from '../lib/types';
import { Bar, Btn, Card, CardHead, Chip, Field, IconDollar, Input, Modal, Select } from '../lib/ui';
import { IconCardPay, IconPlug } from '../components/icons';
import { CountUp, Reveal } from '../components/Reveal';
import {
  loadPackageCatalog,
  loadPackageRenewalCandidates,
  sellSessionPackage,
  upsertSessionPackage,
  type PackageCatalogItem,
  type PackageRenewalCandidate,
} from '../lib/packageLifecycle';
import { isClinicManager } from '../lib/permissions';

const STATUS_TX: Record<FinancialTransaction['status'], { label: string; chip: string }> = {
  pendente: { label: 'Pendente', chip: 'border-amber/40 text-amber bg-amber/10' },
  pago: { label: 'Pago', chip: 'border-mint/40 text-mint bg-mint/10' },
  atrasado: { label: 'Atrasado', chip: 'border-pulse/40 text-pulse bg-pulse/10' },
};

const RISK_LABEL: Record<PackageRenewalCandidate['riskReason'], string> = {
  vencido: 'vencido',
  saldo_baixo: 'saldo baixo',
  validade_proxima: 'validade próxima',
  continuidade: 'continuidade',
};

export function FinanceiroOperational() {
  const {
    user, access, transactions, setTxStatus, patientPackages, patients, packages,
    commissions, users, setCommissionStatus, fecharRepasse, addTransaction, refreshClinicData, toast,
  } = useApp();
  const [tab, setTab] = useState<'receber' | 'pagar' | 'pacotes' | 'repasse'>('receber');
  const [repasse, setRepasse] = useState(false);
  const [catalog, setCatalog] = useState<PackageCatalogItem[]>([]);
  const [renewals, setRenewals] = useState<PackageRenewalCandidate[]>([]);
  const [packageModal, setPackageModal] = useState<PackageCatalogItem | 'new' | null>(null);
  const [sellModal, setSellModal] = useState<{ patientId?: string; renewedFromId?: string; packageId?: string } | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [transactionModal, setTransactionModal] = useState<'receber' | 'pagar' | null>(null);
  const [settling, setSettling] = useState<FinancialTransaction | null>(null);

  const isRecep = user?.role === 'recep';
  const isFisio = user?.role === 'fisio';
  const isAdmin = isClinicManager(user?.role);
  const isFinance = user?.role === 'financeiro';
  const canOperatePackages = !isFisio && access('financeiro') === 'full';
  const canWriteTipo = (tipo: 'receber' | 'pagar') =>
    access('financeiro') === 'full' && (isAdmin || isFinance || (isRecep && tipo === 'receber'));

  const refreshPackages = async () => {
    try {
      const [nextCatalog, nextRenewals] = await Promise.all([
        loadPackageCatalog(),
        loadPackageRenewalCandidates().catch(() => []),
      ]);
      setCatalog(nextCatalog);
      setRenewals(nextRenewals);
      setPackageError(null);
    } catch (error) {
      console.error('[MedicsPro] pacotes:', error);
      setPackageError('Pacotes indisponíveis. Confirme se a migration de ciclo de pacotes foi aplicada.');
    }
  };

  useEffect(() => {
    void refreshPackages();
  }, []);

  const m = useMemo(() => {
    const recebido = transactions.filter((t) => t.tipo === 'receber' && t.status === 'pago').reduce((s, t) => s + t.valor, 0);
    const receber = transactions.filter((t) => t.tipo === 'receber' && t.status !== 'pago').reduce((s, t) => s + t.valor, 0);
    const pago = transactions.filter((t) => t.tipo === 'pagar' && t.status === 'pago').reduce((s, t) => s + t.valor, 0);
    const pagar = transactions.filter((t) => t.tipo === 'pagar' && t.status !== 'pago').reduce((s, t) => s + t.valor, 0);
    return { recebido, receber, pago, pagar };
  }, [transactions]);

  const list = transactions.filter((t) => t.tipo === tab).sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));

  const payCommission = async (id: string) => {
    try {
      await setCommissionStatus(id, 'pago');
      toast('Repasse marcado como pago.');
    } catch (error) {
      console.error('[MedicsPro] pagar repasse:', error);
      toast('Não foi possível baixar o repasse.', 'warn');
    }
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Financeiro</h1>
            <p className="text-fog text-[13px] mt-0.5">
              {isFisio ? 'modo somente leitura — produção, pacotes e repasses' : 'fluxo de caixa, pacotes e retenção conectados ao Supabase'}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Chip className="border-aqua/40 text-aqua"><IconPlug className="w-3.5 h-3.5" /> Baixa manual · PIX · cartão · boleto</Chip>
            {(tab === 'receber' || tab === 'pagar') && canWriteTipo(tab) && <Btn variant="subtle" onClick={() => setTransactionModal(tab)}><IconDollar className="w-4 h-4" /> Novo lançamento</Btn>}
            {canOperatePackages && <Btn variant="subtle" onClick={() => { setTab('pacotes'); setSellModal({}); }}><IconDollar className="w-4 h-4" /> Vender pacote</Btn>}
            {isAdmin && <Btn onClick={() => { setTab('pacotes'); setPackageModal('new'); }}>Novo pacote</Btn>}
          </div>
        </div>
      </Reveal>

      <Reveal delay={70}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {[
            { l: 'Recebido', v: m.recebido, c: 'text-mint' },
            { l: 'A receber', v: m.receber, c: 'text-amber' },
            { l: 'A pagar', v: m.pagar, c: 'text-pulse' },
            { l: 'Saldo do caixa', v: m.recebido - m.pago, c: m.recebido - m.pago >= 0 ? 'text-aqua' : 'text-pulse' },
          ].map((x) => (
            <div key={x.l} className="bg-panel px-5 py-4 hover:bg-raise/60 transition-colors">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog">{x.l}</p>
              <p className={`font-display text-[22px] font-bold mt-1 ${x.c}`}>R$ <CountUp to={Math.round(x.v / 100)} /></p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="flex border-b border-line overflow-x-auto">
          {([
            { k: 'receber', l: 'A receber' },
            ...(!isRecep ? [{ k: 'pagar', l: 'A pagar' }] : []),
            { k: 'pacotes', l: `Pacotes${renewals.length ? ` · ${renewals.length} atenção` : ''}` },
            ...(!isRecep ? [{ k: 'repasse', l: 'Comissões / Repasse' }] : []),
          ] as { k: typeof tab; l: string }[]).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 font-display font-semibold text-[13px] border-b-2 whitespace-nowrap transition-colors ${tab === t.k ? 'border-mint text-mint' : 'border-transparent text-fog hover:text-paper'}`}>
              {t.l}
            </button>
          ))}
        </div>

        {(tab === 'receber' || tab === 'pagar') && (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead><tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                <th className="text-left px-4 py-3 font-medium">Descrição</th><th className="text-left px-4 py-3 font-medium">Categoria</th>
                <th className="text-left px-4 py-3 font-medium">Vencimento</th><th className="text-right px-4 py-3 font-medium">Valor</th>
                <th className="text-left px-4 py-3 font-medium">Método</th><th className="text-left px-4 py-3 font-medium">Status</th>
                {canWriteTipo(tab) && <th className="text-right px-4 py-3 font-medium">Ação</th>}
              </tr></thead>
              <tbody>
                {list.map((t) => {
                  const st = STATUS_TX[t.status];
                  const p = t.pacienteId ? patients.find((x) => x.id === t.pacienteId) : null;
                  return <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-raise/40">
                    <td className="px-4 py-3"><p className="font-semibold">{t.descricao}</p>{p && <p className="font-mono text-[10px] text-fog mt-0.5">{p.nome}</p>}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-fog">{t.categoria}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-fog">{format(new Date(t.vencimento + 'T12:00'), 'dd/MM/yy', { locale: ptBR })}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${t.tipo === 'pagar' ? 'text-pulse' : 'text-mint'}`}>{t.tipo === 'pagar' ? '−' : '+'}{fmtBRL(t.valor)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-fog uppercase"><span className="inline-flex items-center gap-1.5">{t.metodo === 'cartao' && <IconCardPay className="w-3.5 h-3.5" />}{t.metodo ?? '—'}</span></td>
                    <td className="px-4 py-3"><Chip className={st.chip}>{st.label}</Chip></td>
                    {canWriteTipo(tab) && <td className="px-4 py-3 text-right">{t.status !== 'pago' ? <div className="inline-flex gap-1.5">
                      <Btn className="!px-2.5 !py-1 !text-[11px]" onClick={() => setSettling(t)}>Baixar</Btn>
                    </div> : <span className="font-mono text-[10.5px] text-fog/60">liquidado ✓</span>}</td>}
                  </tr>;
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'pacotes' && (
          <div className="space-y-4">
            {packageError && <div className="border border-pulse/35 bg-pulse/[0.05] px-4 py-3 text-[12px] text-pulse">{packageError}</div>}

            <div className="grid xl:grid-cols-2 gap-4">
              <Card>
                <CardHead title="Catálogo de pacotes" sub="produtos reais da clínica" right={isAdmin ? <Btn className="!px-3 !py-1.5 !text-[11px]" onClick={() => setPackageModal('new')}>Novo</Btn> : undefined} />
                <ul className="divide-y divide-line/70">
                  {catalog.length === 0 && <li className="px-5 py-6 text-[12px] text-fog">Nenhum pacote cadastrado.</li>}
                  {catalog.map((pk) => <li key={pk.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1"><p className="font-display font-semibold text-[13.5px]">{pk.nome}</p><p className="font-mono text-[10.5px] text-fog">{pk.sessoes} sessões · {pk.validadeDias} dias · {fmtBRL(pk.preco)}</p>{pk.descricao && <p className="text-[11.5px] text-fog mt-1">{pk.descricao}</p>}</div>
                    <Chip className={pk.ativo ? 'border-mint/40 text-mint' : 'border-line text-fog'}>{pk.ativo ? 'ativo' : 'inativo'}</Chip>
                    {isAdmin && <Btn variant="ghost" className="!px-2.5 !py-1 !text-[11px]" onClick={() => setPackageModal(pk)}>Editar</Btn>}
                  </li>)}
                </ul>
              </Card>

              <Card>
                <CardHead title="Renovação / risco" sub="saldo baixo, vencimento e esgotamento" />
                <ul className="divide-y divide-line/70">
                  {renewals.length === 0 && <li className="px-5 py-6 text-[12px] text-fog">Nenhum pacote exige atenção agora.</li>}
                  {renewals.map((r) => <li key={r.patientPackageId} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1"><p className="font-display font-semibold text-[13.5px]">{r.patientName}</p><p className="font-mono text-[10.5px] text-fog">{r.packageName} · restam {r.sessionsRemaining}/{r.sessionsTotal}{r.validUntil ? ` · até ${format(new Date(r.validUntil + 'T12:00'), 'dd/MM/yy')}` : ''}</p></div>
                    <Chip className="border-amber/45 text-amber">{RISK_LABEL[r.riskReason]}</Chip>
                    {canOperatePackages && <Btn className="!px-3 !py-1.5 !text-[11px]" onClick={() => setSellModal({ patientId: r.patientId, renewedFromId: r.patientPackageId, packageId: r.packageId })}>Renovar</Btn>}
                  </li>)}
                </ul>
              </Card>
            </div>

            <Card>
              <CardHead title="Pacotes dos pacientes" sub="saldo atual e consumo por sessões finalizadas" />
              <ul className="divide-y divide-line/70">
                {patientPackages.length === 0 && <li className="px-5 py-6 text-[12px] text-fog">Nenhum pacote vendido.</li>}
                {patientPackages.map((x) => {
                  const p = patients.find((y) => y.id === x.pacienteId);
                  const pk = catalog.find((y) => y.id === x.pacoteId) ?? packages.find((y) => y.id === x.pacoteId);
                  const restam = Math.max(0, x.sessoesTotais - x.sessoesUsadas);
                  return <li key={x.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1"><p className="font-display font-semibold text-[13.5px]">{p?.nome ?? 'Paciente'}</p><p className="font-mono text-[10.5px] text-fog mt-0.5">{pk?.nome ?? 'Pacote'} · compra {format(new Date(x.compraData + 'T12:00'), 'dd/MM/yy', { locale: ptBR })}</p></div>
                    <span className={`font-mono text-[12px] font-semibold ${restam <= 2 ? 'text-pulse' : 'text-mint'}`}>{restam}/{x.sessoesTotais}</span>
                    <Chip className={x.status === 'ativo' && restam > 2 ? 'border-mint/40 text-mint' : 'border-amber/45 text-amber'}>{x.status}</Chip>
                    {canOperatePackages && restam <= 2 && <Btn variant="subtle" className="!px-3 !py-1.5 !text-[11px]" onClick={() => setSellModal({ patientId: x.pacienteId, renewedFromId: x.id, packageId: x.pacoteId })}>Renovar</Btn>}
                  </div><Bar pct={x.sessoesTotais ? (x.sessoesUsadas / x.sessoesTotais) * 100 : 0} color={restam <= 2 ? '#f2545b' : '#4fd1a5'} className="mt-2.5" /></li>;
                })}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'repasse' && !isRecep && (
          <Card className="overflow-x-auto">
            <CardHead title="Repasse / comissão" sub="40% sobre sessões finalizadas" right={isAdmin ? <Btn className="!px-3 !py-1.5 !text-[12px]" onClick={() => setRepasse(true)}><IconDollar className="w-3.5 h-3.5" /> Fechar mês</Btn> : undefined} />
            <table className="w-full min-w-[700px] text-[13px]"><thead><tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog"><th className="text-left px-4 py-3">Profissional</th><th className="text-left px-4 py-3">Período</th><th className="text-right px-4 py-3">Base</th><th className="text-right px-4 py-3">Comissão</th><th className="text-left px-4 py-3">Status</th>{isAdmin && <th className="px-4 py-3" />}</tr></thead>
              <tbody>{commissions.filter((c) => !isFisio || c.fisioId === user?.id).map((c) => <tr key={c.id} className="border-b border-line/60 last:border-0"><td className="px-4 py-3 font-semibold">{userName(users, c.fisioId)}</td><td className="px-4 py-3 font-mono text-fog">{c.periodo}</td><td className="px-4 py-3 text-right font-mono">{fmtBRL(c.base)}</td><td className="px-4 py-3 text-right font-mono text-mint">{fmtBRL(Math.round(c.base * c.percentual / 100))}</td><td className="px-4 py-3"><Chip className={c.status === 'pago' ? STATUS_TX.pago.chip : STATUS_TX.pendente.chip}>{c.status}</Chip></td>{isAdmin && <td className="px-4 py-3 text-right">{c.status === 'aberto' && <Btn variant="subtle" className="!px-2.5 !py-1 !text-[11px]" onClick={() => void payCommission(c.id)}>Marcar pago</Btn>}</td>}</tr>)}</tbody>
            </table>
          </Card>
        )}
      </Reveal>

      {packageModal && <PackageCatalogModal initial={packageModal === 'new' ? null : packageModal} onClose={() => setPackageModal(null)} onSaved={async () => { setPackageModal(null); await refreshPackages(); toast('Catálogo de pacotes atualizado.'); }} />}
      {transactionModal && <TransactionModal tipo={transactionModal} patients={patients} onClose={() => setTransactionModal(null)} onSave={(transaction) => { addTransaction(transaction); setTransactionModal(null); }} />}
      {settling && <SettleTransactionModal transaction={settling} onClose={() => setSettling(null)} onConfirm={(method) => { setTxStatus(settling.id, 'pago', method); setSettling(null); }} />}
      {sellModal && <SellPackageModal initial={sellModal} catalog={catalog.filter((p) => p.ativo)} patients={patients} onClose={() => setSellModal(null)} onSaved={async () => { const renewed = Boolean(sellModal.renewedFromId); setSellModal(null); await Promise.all([refreshClinicData(), refreshPackages()]); toast(renewed ? 'Renovação registrada com cobrança vinculada.' : 'Pacote vendido com cobrança vinculada.'); }} />}
      {repasse && <RepasseModal onClose={() => setRepasse(false)} />}
    </div>
  );
}

type PaymentMethod = Exclude<FinancialTransaction['metodo'], null>;

function TransactionModal({ tipo, patients, onClose, onSave }: { tipo: 'receber' | 'pagar'; patients: ReturnType<typeof useApp>['patients']; onClose: () => void; onSave: (transaction: Omit<FinancialTransaction, 'id'>) => void }) {
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [pacienteId, setPacienteId] = useState('');
  const cents = Math.round(Number(valor.replace(',', '.')) * 100);
  const valid = descricao.trim() && categoria.trim() && vencimento && Number.isFinite(cents) && cents > 0;

  const save = () => {
    if (!valid) return;
    onSave({ tipo, descricao: descricao.trim(), categoria: categoria.trim(), valor: cents, vencimento, status: 'pendente', pacienteId: tipo === 'receber' && pacienteId ? pacienteId : null, metodo: null, paidAt: null });
  };

  return <Modal open onClose={onClose} title={tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}>
    <div className="space-y-4">
      <Field label="Descrição"><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === 'receber' ? 'Ex.: Avaliação fisioterapêutica' : 'Ex.: Aluguel da unidade'} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Categoria"><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex.: Sessões" /></Field><Field label="Valor (R$)"><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></Field></div>
      <Field label="Vencimento"><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
      {tipo === 'receber' && <Field label="Paciente (opcional)"><Select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}><option value="">Sem vínculo</option>{patients.filter((p) => !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>}
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={!valid}>Salvar lançamento</Btn></div>
    </div>
  </Modal>;
}

function SettleTransactionModal({ transaction, onClose, onConfirm }: { transaction: FinancialTransaction; onClose: () => void; onConfirm: (method: PaymentMethod) => void }) {
  const [method, setMethod] = useState<PaymentMethod>(transaction.tipo === 'receber' ? 'pix' : 'boleto');
  return <Modal open onClose={onClose} title="Confirmar baixa manual">
    <div className="space-y-4">
      <div className="border border-line bg-deep p-3"><p className="font-semibold text-[13px]">{transaction.descricao}</p><p className="font-mono text-[12px] text-mint mt-1">{fmtBRL(transaction.valor)}</p></div>
      <Field label="Método utilizado"><Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option></Select></Field>
      <p className="text-[11.5px] text-fog">Esta ação apenas registra a liquidação no sistema; ela não processa o pagamento no banco ou na operadora.</p>
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => onConfirm(method)}>Confirmar baixa</Btn></div>
    </div>
  </Modal>;
}

function PackageCatalogModal({ initial, onClose, onSaved }: { initial: PackageCatalogItem | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [sessoes, setSessoes] = useState(String(initial?.sessoes ?? 10));
  const [preco, setPreco] = useState(initial ? String(initial.preco / 100).replace('.', ',') : '');
  const [validade, setValidade] = useState(String(initial?.validadeDias ?? 60));
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const cents = Math.round(Number(preco.replace(',', '.')) * 100);
    if (!nome.trim() || Number(sessoes) <= 0 || !Number.isFinite(cents) || cents < 0 || Number(validade) <= 0) return;
    setSaving(true);
    try {
      await upsertSessionPackage({ id: initial?.id, nome, sessoes: Number(sessoes), preco: cents, validadeDias: Number(validade), descricao, ativo });
      await onSaved();
    } finally { setSaving(false); }
  };

  return <Modal open onClose={onClose} title={initial ? 'Editar pacote' : 'Novo pacote de sessões'}>
    <div className="space-y-4">
      <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Fisioterapia 10 sessões" /></Field>
      <div className="grid grid-cols-3 gap-3"><Field label="Sessões"><Input type="number" min="1" value={sessoes} onChange={(e) => setSessoes(e.target.value)} /></Field><Field label="Preço (R$)"><Input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} /></Field><Field label="Validade (dias)"><Input type="number" min="1" value={validade} onChange={(e) => setValidade(e.target.value)} /></Field></div>
      <Field label="Descrição"><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" /></Field>
      <label className="flex items-center gap-2 text-[12px] text-fog"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Disponível para novas vendas</label>
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => void save()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar pacote'}</Btn></div>
    </div>
  </Modal>;
}

function SellPackageModal({ initial, catalog, patients, onClose, onSaved }: { initial: { patientId?: string; renewedFromId?: string; packageId?: string }; catalog: PackageCatalogItem[]; patients: ReturnType<typeof useApp>['patients']; onClose: () => void; onSaved: () => Promise<void> }) {
  const [patientId, setPatientId] = useState(initial.patientId ?? '');
  const [packageId, setPackageId] = useState(initial.packageId ?? '');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<'pendente' | 'pago'>('pendente');
  const [method, setMethod] = useState<'pix' | 'cartao' | 'dinheiro' | 'boleto'>('pix');
  const [saving, setSaving] = useState(false);
  const pk = catalog.find((x) => x.id === packageId);

  const save = async () => {
    if (!patientId || !packageId) return;
    setSaving(true);
    try {
      await sellSessionPackage({ patientId, packageId, dueDate, paymentStatus: status, paymentMethod: status === 'pago' ? method : null, renewedFromId: initial.renewedFromId ?? null });
      await onSaved();
    } finally { setSaving(false); }
  };

  return <Modal open onClose={onClose} title={initial.renewedFromId ? 'Renovar pacote' : 'Vender pacote de sessões'}>
    <div className="space-y-4">
      <Field label="Paciente"><Select value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={Boolean(initial.patientId)}><option value="">Selecionar…</option>{patients.filter((p) => p.status === 'ativo' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
      <Field label="Pacote"><Select value={packageId} onChange={(e) => setPackageId(e.target.value)}><option value="">Selecionar…</option>{catalog.map((p) => <option key={p.id} value={p.id}>{p.nome} — {fmtBRL(p.preco)}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Vencimento"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field><Field label="Situação"><Select value={status} onChange={(e) => setStatus(e.target.value as 'pendente' | 'pago')}><option value="pendente">Gerar a receber</option><option value="pago">Pago agora</option></Select></Field></div>
      {status === 'pago' && <Field label="Método"><Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option></Select></Field>}
      {pk && <div className="border border-line bg-deep px-3 py-2.5 flex items-center justify-between font-mono text-[12px]"><span className="text-fog">{pk.sessoes} sessões · {pk.validadeDias} dias</span><span className="text-mint font-semibold">{fmtBRL(pk.preco)}</span></div>}
      <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => void save()} disabled={!patientId || !packageId || saving}><IconDollar className="w-4 h-4" /> {saving ? 'Salvando…' : initial.renewedFromId ? 'Confirmar renovação' : 'Gerar venda'}</Btn></div>
    </div>
  </Modal>;
}

function RepasseModal({ onClose }: { onClose: () => void }) {
  const { users, appointments, commissions, fecharRepasse, toast } = useApp();
  const fisios = users.filter((u) => u.role === 'fisio');
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'));
  const linhas = fisios.map((f) => {
    const sess = appointments.filter((a) => a.fisioId === f.id && a.status === 'finalizado' && dayOf(a).startsWith(mes));
    const base = sess.reduce((s, a) => s + a.valor, 0);
    const jaFechado = commissions.some((c) => c.fisioId === f.id && c.periodo === mes);
    return { f, n: sess.length, base, comissao: Math.round(base * 0.4), jaFechado };
  });
  const fechaveis = linhas.filter((l) => !l.jaFechado && l.base > 0);
  const total = fechaveis.reduce((s, l) => s + l.comissao, 0);
  const fechar = async () => { try { const n = await fecharRepasse(mes); toast(n ? `Repasse fechado: ${n} comissão(ões) · ${fmtBRL(total)}` : 'Nada novo a fechar neste período', n ? 'ok' : 'info'); onClose(); } catch (error) { console.error('[MedicsPro] fechar repasse:', error); toast('Não foi possível fechar os repasses.', 'warn'); } };
  return <Modal open onClose={onClose} title="Fechar repasse do mês" wide><div className="space-y-4"><Field label="Período"><Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="!w-44" /></Field><div className="border border-line overflow-x-auto"><table className="w-full min-w-[560px] text-[12.5px]"><thead><tr className="bg-deep border-b border-line font-mono text-[10px] uppercase text-fog"><th className="text-left px-3.5 py-2.5">Profissional</th><th className="text-right px-3.5 py-2.5">Sessões</th><th className="text-right px-3.5 py-2.5">Base</th><th className="text-right px-3.5 py-2.5">Comissão</th></tr></thead><tbody>{linhas.map((l) => <tr key={l.f.id} className="border-b border-line/60 last:border-0"><td className="px-3.5 py-2.5 font-semibold">{l.f.nome}</td><td className="px-3.5 py-2.5 text-right font-mono">{l.n}</td><td className="px-3.5 py-2.5 text-right font-mono">{fmtBRL(l.base)}</td><td className="px-3.5 py-2.5 text-right font-mono text-mint">{fmtBRL(l.comissao)}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={fechar} disabled={!fechaveis.length}>Gerar {fechaveis.length} comissão(ões)</Btn></div></div></Modal>;
}
