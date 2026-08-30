import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp, userName } from '../lib/store';
import { fmtBRL, dayOf, type FinancialTransaction } from '../lib/types';
import { Card, CardHead, Btn, Chip, Select, Field, Modal, Input, Bar, IconDollar } from '../lib/ui';
import { IconPlug, IconWhats, IconCardPay } from '../components/icons';
import { Reveal, CountUp } from '../components/Reveal';

const STATUS_TX: Record<FinancialTransaction['status'], { label: string; chip: string }> = {
  pendente: { label: 'Pendente', chip: 'border-amber/40 text-amber bg-amber/10' },
  pago: { label: 'Pago', chip: 'border-mint/40 text-mint bg-mint/10' },
  atrasado: { label: 'Atrasado', chip: 'border-pulse/40 text-pulse bg-pulse/10' },
};

export function Financeiro() {
  const { user, access, transactions, setTxStatus, patientPackages, patients, packages, commissions, users, venderPacote, setCommissionStatus, toast } = useApp();
  const [tab, setTab] = useState<'receber' | 'pagar' | 'pacotes' | 'repasse'>('receber');
  const [venda, setVenda] = useState(false);
  const [repasse, setRepasse] = useState(false);

  const isRecep = user?.role === 'recep';
  const isFisio = user?.role === 'fisio';
  const isAdmin = user?.role === 'admin';
  const canWriteTipo = (tipo: 'receber' | 'pagar') =>
    access('financeiro') === 'full' && (isAdmin || (isRecep && tipo === 'receber'));

  const m = useMemo(() => {
    const recebido = transactions.filter((t) => t.tipo === 'receber' && t.status === 'pago').reduce((s, t) => s + t.valor, 0);
    const receber = transactions.filter((t) => t.tipo === 'receber' && t.status !== 'pago').reduce((s, t) => s + t.valor, 0);
    const pago = transactions.filter((t) => t.tipo === 'pagar' && t.status === 'pago').reduce((s, t) => s + t.valor, 0);
    const pagar = transactions.filter((t) => t.tipo === 'pagar' && t.status !== 'pago').reduce((s, t) => s + t.valor, 0);
    return { recebido, receber, pago, pagar };
  }, [transactions]);

  const list = transactions.filter((t) => t.tipo === tab).sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));

  const cobrarWhats = (t: FinancialTransaction) => {
    const p = t.pacienteId ? patients.find((x) => x.id === t.pacienteId) : null;
    toast(`Cobrança de ${fmtBRL(t.valor)} enviada via WhatsApp para ${p?.nome ?? 'paciente'}`);
  };

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Financeiro</h1>
            <p className="text-fog text-[13px] mt-0.5">
              {isFisio ? 'modo somente leitura (RBAC) — suas comissões em "Repasse"' : 'fluxo de caixa, pacotes e repasses · valores em centavos (nunca float)'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Chip className="border-aqua/40 text-aqua"><IconPlug className="w-3.5 h-3.5" /> integração pronta: PIX · cartão · boleto</Chip>
            {isAdmin && <Btn onClick={() => setVenda(true)}><IconDollar className="w-4 h-4" /> Vender pacote</Btn>}
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
            { k: 'pacotes', l: 'Pacotes' },
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
              <thead>
                <tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                  <th className="text-left px-4 py-3 font-medium">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium">Vencimento</th>
                  <th className="text-right px-4 py-3 font-medium">Valor</th>
                  <th className="text-left px-4 py-3 font-medium">Método</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {canWriteTipo(tab) && <th className="text-right px-4 py-3 font-medium">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const st = STATUS_TX[t.status];
                  const p = t.pacienteId ? patients.find((x) => x.id === t.pacienteId) : null;
                  return (
                    <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-raise/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[13px]">{t.descricao}</p>
                        {p && <p className="font-mono text-[10px] text-fog mt-0.5">{p.nome}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-fog">{t.categoria}</td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-fog">{format(new Date(t.vencimento + 'T12:00'), 'dd/MM/yy', { locale: ptBR })}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${t.tipo === 'pagar' ? 'text-pulse' : 'text-mint'}`}>{t.tipo === 'pagar' ? '−' : '+'}{fmtBRL(t.valor)}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-fog uppercase">
                        <span className="inline-flex items-center gap-1.5">{t.metodo === 'cartao' && <IconCardPay className="w-3.5 h-3.5" />}{t.metodo ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3"><Chip className={st.chip}>{st.label}</Chip></td>
                      {canWriteTipo(tab) && (
                        <td className="px-4 py-3 text-right">
                          {t.status !== 'pago' ? (
                            <div className="inline-flex gap-1.5">
                              {tab === 'receber' && <Btn variant="subtle" className="!px-2.5 !py-1 !text-[11px]" onClick={() => cobrarWhats(t)} title="Cobrar via WhatsApp"><IconWhats className="w-3.5 h-3.5" /></Btn>}
                              <Btn className="!px-2.5 !py-1 !text-[11px]" onClick={() => { setTxStatus(t.id, 'pago', tab === 'receber' ? 'pix' : 'boleto'); toast(`${tab === 'receber' ? 'Recebimento' : 'Pagamento'} baixado: ${fmtBRL(t.valor)}`); }}>
                                Baixar ({tab === 'receber' ? 'Pix' : 'Boleto'})
                              </Btn>
                            </div>
                          ) : (
                            <span className="font-mono text-[10.5px] text-fog/60">liquidado ✓</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'pacotes' && (
          <Card>
            <CardHead title="Pacotes de sessões" sub="saldo por paciente · alerta de esgotamento" />
            <ul className="divide-y divide-line/70">
              {patientPackages.map((x) => {
                const p = patients.find((y) => y.id === x.pacienteId);
                const pk = packages.find((y) => y.id === x.pacoteId);
                const restam = x.sessoesTotais - x.sessoesUsadas;
                return (
                  <li key={x.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-[13.5px]">{p?.nome}</p>
                        <p className="font-mono text-[10.5px] text-fog mt-0.5">{pk?.nome} · compra {format(new Date(x.compraData + 'T12:00'), 'dd/MM/yy', { locale: ptBR })} · validade {pk?.validadeDias} dias</p>
                      </div>
                      <span className={`font-mono text-[12px] font-semibold ${restam <= 2 ? 'text-pulse' : 'text-mint'}`}>{restam}/{x.sessoesTotais}</span>
                      <Chip className={restam === 0 ? 'border-pulse/40 text-pulse' : restam <= 2 ? 'border-amber/45 text-amber' : 'border-mint/40 text-mint'}>
                        {restam === 0 ? 'esgotado' : restam <= 2 ? 'reposição sugerida' : 'ativo'}
                      </Chip>
                    </div>
                    <Bar pct={(x.sessoesUsadas / x.sessoesTotais) * 100} color={restam <= 2 ? '#f2545b' : '#4fd1a5'} className="mt-2.5" />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {tab === 'repasse' && !isRecep && (
          <Card className="overflow-x-auto">
            <CardHead
              title="Repasse / comissão de fisioterapeutas"
              sub="40% sobre as sessões finalizadas no período · split preparado para o gateway"
              right={isAdmin ? (
                <Btn className="!px-3 !py-1.5 !text-[12px]" onClick={() => setRepasse(true)}>
                  <IconDollar className="w-3.5 h-3.5" /> Fechar repasse do mês
                </Btn>
              ) : undefined}
            />
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                  <th className="text-left px-4 py-3 font-medium">Profissional</th>
                  <th className="text-left px-4 py-3 font-medium">Período</th>
                  <th className="text-right px-4 py-3 font-medium">Base produzida</th>
                  <th className="text-right px-4 py-3 font-medium">%</th>
                  <th className="text-right px-4 py-3 font-medium">Comissão</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-medium">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {commissions
                  .filter((c) => !isFisio || c.fisioId === user?.id)
                  .map((c) => {
                    const valor = Math.round((c.base * c.percentual) / 100);
                    const u = users.find((x) => x.id === c.fisioId);
                    return (
                      <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-raise/40">
                        <td className="px-4 py-3 font-semibold">
                          {userName(users, c.fisioId)}
                          <span className="block font-mono text-[10px] text-fog font-normal">{u?.registro ?? ''}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11.5px] text-fog">{c.periodo}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtBRL(c.base)}</td>
                        <td className="px-4 py-3 text-right font-mono">{c.percentual}%</td>
                        <td className="px-4 py-3 text-right font-mono text-mint font-semibold">{fmtBRL(valor)}</td>
                        <td className="px-4 py-3"><Chip className={c.status === 'pago' ? STATUS_TX.pago.chip : STATUS_TX.pendente.chip}>{c.status}</Chip></td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            {c.status === 'aberto' ? (
                              <Btn variant="subtle" className="!px-2.5 !py-1 !text-[11px]"
                                onClick={() => { setCommissionStatus(c.id, 'pago'); toast(`Repasse de ${fmtBRL(valor)} pago a ${userName(users, c.fisioId)}`); }}>
                                Marcar pago
                              </Btn>
                            ) : (
                              <span className="font-mono text-[10.5px] text-fog/60">liquidado ✓</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </Card>
        )}
      </Reveal>

      <SellPackageModal open={venda} onClose={() => setVenda(false)} onSell={(pid, pkid) => { venderPacote(pid, pkid); toast('Pacote vendido — saldo criado + cobrança gerada em A receber'); }} />
      {repasse && <RepasseModal onClose={() => setRepasse(false)} />}
    </div>
  );
}

function SellPackageModal({ open, onClose, onSell }: { open: boolean; onClose: () => void; onSell: (pacienteId: string, pacoteId: string) => void }) {
  const { patients, packages } = useApp();
  const [pacId, setPacId] = useState('');
  const [pkId, setPkId] = useState('');
  const pk = packages.find((x) => x.id === pkId);

  return (
    <Modal open={open} onClose={onClose} title="Vender pacote de sessões">
      <div className="space-y-4">
        <Field label="Paciente">
          <Select value={pacId} onChange={(e) => setPacId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.filter((p) => p.status === 'ativo' && !p.anonimizado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <Field label="Pacote">
          <Select value={pkId} onChange={(e) => setPkId(e.target.value)}>
            <option value="">Selecionar…</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.nome} — {fmtBRL(p.preco)}</option>)}
          </Select>
        </Field>
        {pk && (
          <div className="border border-line bg-deep px-3 py-2.5 flex items-center justify-between font-mono text-[12px]">
            <span className="text-fog uppercase text-[10px]">Total a cobrar</span>
            <span className="text-mint font-semibold">{fmtBRL(pk.preco)}</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={() => { if (pacId && pkId) { onSell(pacId, pkId); onClose(); setPacId(''); setPkId(''); } }} disabled={!pacId || !pkId}>
            <IconDollar className="w-4 h-4" /> Gerar cobrança
          </Btn>
        </div>
      </div>
    </Modal>
  );
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

  const fechar = () => {
    const n = fecharRepasse(mes);
    toast(n ? `Repasse de ${format(new Date(mes + '-01T12:00'), 'MMMM/yyyy', { locale: ptBR })} fechado: ${n} comissão(ões) · ${fmtBRL(total)}` : 'Nada novo a fechar neste período', n ? 'ok' : 'info');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Fechar repasse do mês" wide>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Field label="Período (competência)">
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="!w-44" />
        </Field>
        <p className="font-mono text-[11px] text-fog mb-2">
          base: sessões <span className="text-aqua">finalizadas</span> · percentual padrão <span className="text-mint">40%</span>
        </p>
      </div>
      <div className="border border-line overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead>
            <tr className="bg-deep border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-fog">
              <th className="text-left px-3.5 py-2.5 font-medium">Profissional</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Sessões</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Base</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Comissão (40%)</th>
              <th className="text-left px-3.5 py-2.5 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.f.id} className="border-b border-line/60 last:border-0">
                <td className="px-3.5 py-2.5 font-semibold">{l.f.nome}</td>
                <td className="px-3.5 py-2.5 text-right font-mono">{l.n}</td>
                <td className="px-3.5 py-2.5 text-right font-mono">{fmtBRL(l.base)}</td>
                <td className="px-3.5 py-2.5 text-right font-mono text-mint font-semibold">{fmtBRL(l.comissao)}</td>
                <td className="px-3.5 py-2.5">
                  {l.jaFechado ? <Chip className="border-aqua/40 text-aqua">já fechado</Chip>
                    : l.base === 0 ? <Chip className="border-line text-fog">sem produção</Chip>
                    : <Chip className="border-amber/45 text-amber">a fechar</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="font-mono text-[12px] text-fog">
          Total a provisionar: <span className="text-mint font-semibold">{fmtBRL(total)}</span>
        </p>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={fechar} disabled={fechaveis.length === 0}>
            <IconDollar className="w-4 h-4" /> Gerar {fechaveis.length} comissão(ões)
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
