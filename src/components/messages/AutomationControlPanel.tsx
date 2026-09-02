import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadAutomationRuns, loadAutomationSettings, saveAutomationSettings, type AutomationRun, type AutomationSettings } from '../../lib/automation';
import { Btn, Card, CardHead, Chip } from '../../lib/ui';

export function AutomationControlPanel({ onToast }: { onToast: (message: string, tone?: 'ok' | 'warn' | 'info') => void }) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextSettings, nextRuns] = await Promise.all([loadAutomationSettings(), loadAutomationRuns()]);
      setSettings(nextSettings);
      setRuns(nextRuns);
    } catch (error) {
      console.error('[MedicsPro] automação:', error);
      onToast('Não foi possível carregar a saúde das automações.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveAutomationSettings(settings);
      onToast('Regras de automação atualizadas.');
      await refresh();
    } catch (error) {
      console.error('[MedicsPro] salvar automação:', error);
      onToast('Não foi possível salvar as regras de automação.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const last = runs[0];
  const lastTone = !last ? 'border-line text-fog' : last.status === 'completed' ? 'border-mint/45 text-mint' : last.status === 'failed' ? 'border-pulse/45 text-pulse' : 'border-amber/45 text-amber';

  return <Card>
    <CardHead
      title="Automação operacional"
      sub="confirmações, NPS e manutenção da lista de espera sem depender de disparo manual"
      right={<div className="flex items-center gap-2"><Chip className={lastTone}>{!last ? 'sem execução' : last.status === 'completed' ? 'saudável' : last.status === 'failed' ? 'falha' : 'executando'}</Chip><Btn variant="ghost" className="!px-3 !py-1.5 !text-[11px]" disabled={loading} onClick={() => void refresh()}>Atualizar</Btn></div>}
    />
    <div className="p-5 space-y-4">
      {!settings && !loading && <p className="font-mono text-[11px] text-fog">A configuração será disponibilizada após a migration da automação.</p>}
      {settings && <>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="border border-line bg-deep/50 p-3 flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={settings.active} onChange={(e) => setSettings({ ...settings, active: e.target.checked })} />
            <span><strong className="block text-[12px]">Automação ativa</strong><span className="text-[10.5px] text-fog">pausa todos os novos disparos automáticos</span></span>
          </label>
          <label className="border border-line bg-deep/50 p-3 flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={settings.confirmationsEnabled} onChange={(e) => setSettings({ ...settings, confirmationsEnabled: e.target.checked })} />
            <span><strong className="block text-[12px]">Confirmações automáticas</strong><span className="text-[10.5px] text-fog">até {settings.confirmationHours}h antes</span></span>
          </label>
          <label className="border border-line bg-deep/50 p-3 flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={settings.npsEnabled} onChange={(e) => setSettings({ ...settings, npsEnabled: e.target.checked })} />
            <span><strong className="block text-[12px]">NPS automático</strong><span className="text-[10.5px] text-fog">{settings.npsDelayMinutes} min após finalizar</span></span>
          </label>
          <div className="border border-line bg-deep/50 p-3">
            <strong className="block text-[12px]">Janela de envio</strong>
            <span className="font-mono text-[11px] text-fog">{settings.sendWindowStart.slice(0,5)}–{settings.sendWindowEnd.slice(0,5)}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="font-mono text-[10.5px] text-fog">Confirmação (horas antes)<input className="mt-1 w-full border border-line bg-deep px-3 py-2 text-paper" type="number" min={1} max={168} value={settings.confirmationHours} onChange={(e) => setSettings({ ...settings, confirmationHours: Number(e.target.value) })} /></label>
          <label className="font-mono text-[10.5px] text-fog">NPS (min após finalizar)<input className="mt-1 w-full border border-line bg-deep px-3 py-2 text-paper" type="number" min={0} max={1440} value={settings.npsDelayMinutes} onChange={(e) => setSettings({ ...settings, npsDelayMinutes: Number(e.target.value) })} /></label>
          <label className="font-mono text-[10.5px] text-fog">Enviar a partir de<input className="mt-1 w-full border border-line bg-deep px-3 py-2 text-paper" type="time" value={settings.sendWindowStart.slice(0,5)} onChange={(e) => setSettings({ ...settings, sendWindowStart: e.target.value })} /></label>
          <label className="font-mono text-[10.5px] text-fog">Enviar até<input className="mt-1 w-full border border-line bg-deep px-3 py-2 text-paper" type="time" value={settings.sendWindowEnd.slice(0,5)} onChange={(e) => setSettings({ ...settings, sendWindowEnd: e.target.value })} /></label>
        </div>
        <div className="flex justify-end"><Btn disabled={saving || loading} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar automação'}</Btn></div>
      </>}

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-2"><span className="font-display font-semibold text-[12px]">Últimas execuções</span>{last && <span className="font-mono text-[10px] text-fog">última {formatDistanceToNow(new Date(last.startedAt), { addSuffix: true, locale: ptBR })}</span>}</div>
        <div className="space-y-2">
          {runs.length === 0 && <p className="font-mono text-[10.5px] text-fog">Nenhuma execução registrada ainda.</p>}
          {runs.slice(0, 5).map((run) => <div key={run.id} className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] gap-2 items-center border border-line px-3 py-2 text-[10.5px]">
            <span className={`w-2 h-2 rounded-full ${run.status === 'completed' ? 'bg-mint' : run.status === 'failed' ? 'bg-pulse' : 'bg-amber'}`} />
            <span className="font-mono text-fog">{new Date(run.startedAt).toLocaleString('pt-BR')} · {run.queuedConfirmations} confirmação(ões) · {run.queuedNps} NPS · {run.workerSent}/{run.workerProcessed} enviados</span>
            <span className="font-mono text-fog">{run.workerFailed ? `${run.workerFailed} falha(s)` : run.status}</span>
            {run.errorMessage && <span className="md:col-start-2 md:col-span-2 text-pulse">{run.errorMessage}</span>}
          </div>)}
        </div>
      </div>
    </div>
  </Card>;
}
