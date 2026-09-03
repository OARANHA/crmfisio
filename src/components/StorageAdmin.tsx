import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import { Card, CardHead, Chip } from '../lib/ui';
import { IconDb, IconLock, IconShield } from './icons';

type StorageStatus = {
  provider: string;
  managed_by_platform: boolean;
  patient_avatars_enabled: boolean;
  patient_avatars_private: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
  clinic_avatar_objects: number;
};

const formatBytes = (value: number | null) => {
  if (!value) return '—';
  return `${Math.round(value / (1024 * 1024))} MB`;
};

export function StorageAdmin() {
  const { user } = useApp();
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user || !['owner', 'admin'].includes(user.role)) return;

    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_medicspro_storage_status');
        if (rpcError) throw rpcError;
        if (!active) return;
        setStatus(data as StorageStatus);
        setError('');
      } catch (loadError: unknown) {
        console.warn('[MedicsPro] status do storage:', loadError);
        if (active) setError('Armazenamento ainda não validado neste ambiente.');
      }
    })();

    return () => { active = false; };
  }, [user]);

  if (!user || !['owner', 'admin'].includes(user.role)) return null;

  return (
    <Card>
      <CardHead
        title="Armazenamento de arquivos"
        sub="gerenciado pela plataforma · sem credenciais expostas à clínica"
        right={<IconDb className="h-5 w-5 text-mint" />}
      />
      <div className="grid gap-4 p-5 md:grid-cols-[1.1fr_1.9fr]">
        <div className="rounded-2xl border border-line bg-deep/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-fog">Provider</p>
              <p className="mt-1 font-display text-lg font-semibold">Supabase Storage</p>
            </div>
            <Chip className={status?.patient_avatars_enabled ? 'border-mint/30 bg-mint/10 text-mint' : 'border-amber/30 bg-amber/10 text-amber'}>
              {status?.patient_avatars_enabled ? 'ativo' : 'aguardando validação'}
            </Chip>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">O MedicsPro controla autorização e caminhos por clínica. A clínica não precisa configurar endpoint, chave ou bucket.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-deep/60 p-4"><IconLock className="h-4 w-4 text-mint" /><p className="mt-3 text-[12px] text-fog">Bucket de pacientes</p><p className="mt-1 font-semibold">patient-avatars</p><p className="mt-1 text-[12px] text-mint">{status?.patient_avatars_private ? 'privado' : '—'}</p></div>
          <div className="rounded-2xl bg-deep/60 p-4"><IconShield className="h-4 w-4 text-mint" /><p className="mt-3 text-[12px] text-fog">Limite por foto</p><p className="mt-1 font-semibold">{formatBytes(status?.file_size_limit ?? null)}</p><p className="mt-1 text-[12px] text-fog">JPG · PNG · WEBP</p></div>
          <div className="rounded-2xl bg-deep/60 p-4"><IconDb className="h-4 w-4 text-aqua" /><p className="mt-3 text-[12px] text-fog">Avatares da clínica</p><p className="mt-1 font-display text-xl font-semibold">{status?.clinic_avatar_objects ?? '—'}</p><p className="mt-1 text-[12px] text-fog">objetos privados</p></div>
          <div className="rounded-2xl bg-deep/60 p-4"><IconShield className="h-4 w-4 text-aqua" /><p className="mt-3 text-[12px] text-fog">Acesso</p><p className="mt-1 font-semibold">Tenant-aware</p><p className="mt-1 text-[12px] text-fog">RLS + URL assinada</p></div>
        </div>
      </div>
      {error && <div className="border-t border-line px-5 py-3 text-[12.5px] text-amber">{error}</div>}
    </Card>
  );
}
