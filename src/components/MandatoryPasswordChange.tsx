import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PulseMark } from './Ecg';
import { IconAlert } from '../lib/ui';
import { IconLock } from './icons';

type MandatoryPasswordChangeProps = {
  onComplete: () => void;
  onSignOut: () => Promise<void>;
};

export function MandatoryPasswordChange({ onComplete, onSignOut }: MandatoryPasswordChangeProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMinimumLength = password.length >= 8;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const ready = hasMinimumLength && passwordsMatch;
  const progressLabel = useMemo(() => {
    if (!password) return 'Comece criando uma senha pessoal.';
    if (!hasMinimumLength) return 'Faltam alguns caracteres para atingir o mínimo.';
    if (!confirmPassword) return 'Agora confirme a nova senha.';
    if (!passwordsMatch) return 'As duas senhas ainda não conferem.';
    return 'Tudo certo para salvar sua nova senha.';
  }, [confirmPassword, hasMinimumLength, password, passwordsMatch]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!hasMinimumLength) {
      setError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (!passwordsMatch) {
      setError('As senhas não conferem.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-team', {
        body: { action: 'change_own_password', password },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.password_changed || data?.must_change_password !== false) {
        throw new Error('O servidor não confirmou a atualização da senha.');
      }
      onComplete();
    } catch (cause) {
      console.error('[MedicsPro] troca obrigatória de senha:', cause);
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-surface min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-lg overflow-hidden rounded-[26px] border border-line/75 bg-panel shadow-[0_24px_80px_rgba(15,28,24,0.12)]">
        <div className="px-7 pt-7 sm:px-8 sm:pt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PulseMark className="w-8 h-7" />
              <span className="font-display font-bold text-xl tracking-tight">MEDICSPRO<span className="text-pulse">.</span></span>
            </div>
            <span className="rounded-full border border-mint/25 bg-mint/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-mint">Primeiro acesso</span>
          </div>

          <div className="mt-7 flex h-11 w-11 items-center justify-center rounded-xl border border-mint/30 bg-mint/10 text-mint">
            <IconLock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-[28px] font-bold mt-4 leading-tight tracking-tight">Defina sua senha pessoal</h1>
          <p className="text-fog text-[14px] mt-2 leading-relaxed">
            Sua conta está usando uma senha temporária. Antes de acessar dados da clínica, crie uma nova senha que só você conheça.
          </p>
        </div>

        <form onSubmit={submit} className="px-7 py-6 sm:px-8 space-y-5">
          {error && (
            <div className="rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 flex items-start gap-2.5">
              <IconAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber" />
              <p className="text-[13px] text-paper leading-snug">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="new-password" className="block text-[13px] font-semibold text-paper/80">Nova senha</label>
              <button type="button" onClick={() => setShowPassword((current) => !current)} disabled={busy} className="text-[11.5px] font-semibold text-mint hover:brightness-110 disabled:opacity-50">
                {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              </button>
            </div>
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="w-full min-h-12 rounded-xl border border-line/80 bg-deep px-4 py-3 text-[15px] focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/10"
              placeholder="mínimo 8 caracteres"
              disabled={busy}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block text-[13px] font-semibold text-paper/80">Confirme a nova senha</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className="w-full min-h-12 rounded-xl border border-line/80 bg-deep px-4 py-3 text-[15px] focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/10"
              placeholder="repita a nova senha"
              disabled={busy}
              required
            />
          </div>

          <div className="rounded-2xl border border-line/70 bg-deep/55 p-4">
            <p className="text-[11.5px] font-semibold text-paper">Checklist de segurança</p>
            <div className="mt-3 grid gap-2 text-[11.5px]">
              <Requirement ok={hasMinimumLength} label="Pelo menos 8 caracteres" />
              <Requirement ok={passwordsMatch} label="As duas senhas são iguais" />
            </div>
            <p className={`mt-3 text-[11px] ${ready ? 'text-mint' : 'text-fog'}`}>{progressLabel}</p>
          </div>

          <button
            type="submit"
            disabled={busy || !ready}
            className="w-full min-h-12 rounded-xl bg-mint text-on-accent hover:brightness-105 font-display font-semibold py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-mint/10"
          >
            {busy ? 'Atualizando senha…' : 'Salvar nova senha e entrar no MedicsPro'}
          </button>

          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={busy}
            className="w-full text-center text-[12.5px] text-fog hover:text-paper disabled:opacity-50"
          >
            Sair desta conta
          </button>
        </form>

        <div className="border-t border-line/60 px-7 py-5 text-[11.5px] leading-relaxed text-fog sm:px-8">
          Esta etapa protege o primeiro acesso e também é exigida após uma redefinição administrativa de senha. A senha temporária deixa de ser válida após a confirmação.
        </div>
      </div>
    </div>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? 'text-mint' : 'text-fog'}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold ${ok ? 'border-mint/35 bg-mint/[0.08]' : 'border-line bg-panel'}`}>{ok ? '✓' : '·'}</span>
      <span>{label}</span>
    </div>
  );
}
