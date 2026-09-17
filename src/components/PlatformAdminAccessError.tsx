export function PlatformAdminAccessError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="app-surface min-h-screen grid place-items-center p-5">
      <div className="w-full max-w-lg rounded-[24px] border border-amber/30 bg-panel p-7 shadow-[0_24px_80px_rgba(3,16,48,0.10)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber">Verificação indisponível</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Não foi possível verificar os privilégios de Platform Admin</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-fog">
          Por segurança, nenhuma ação da plataforma foi liberada. Isso não significa que o acesso foi negado.
        </p>
        <button type="button" onClick={onRetry} className="mt-6 rounded-xl border border-line bg-deep px-4 py-2.5 text-[13px] font-semibold text-paper hover:border-amber/35">
          Verificar novamente
        </button>
      </div>
    </div>
  );
}
