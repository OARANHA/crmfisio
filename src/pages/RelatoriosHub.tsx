import { useState } from 'react';
import { format } from 'date-fns';
import { Relatorios } from './Relatorios';
import { MonthlyRoiRetention } from '../components/MonthlyRoiRetention';
import { Card, Btn, Input } from '../lib/ui';

export function RelatoriosHub() {
  const [view, setView] = useState<'roi' | 'producao'>('roi');
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          <Btn variant={view === 'roi' ? 'primary' : 'ghost'} onClick={() => setView('roi')}>ROI & Retenção</Btn>
          <Btn variant={view === 'producao' ? 'primary' : 'ghost'} onClick={() => setView('producao')}>Produção</Btn>
        </div>
        {view === 'roi' && (
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">Competência</span>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="!w-44" />
          </div>
        )}
      </Card>

      {view === 'roi' ? <MonthlyRoiRetention month={month} /> : <Relatorios />}
    </div>
  );
}
