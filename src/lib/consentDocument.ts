type ConsentDocument = {
  nome: string;
  versao: string;
  conteudo_snapshot: string | null;
  data_assinatura: string | null;
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatSignedAt = (value: string | null) => {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
};

export function openConsentDocument(document: ConsentDocument) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=900');
  if (!win) throw new Error('O navegador bloqueou a abertura do documento. Libere pop-ups para visualizar o termo.');

  const title = `${document.nome} - v${document.versao}`;
  const body = escapeHtml(document.conteudo_snapshot || 'Conteúdo do termo indisponível.');

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1ef; color: #17211d; font-family: Arial, Helvetica, sans-serif; }
  .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; background: #10231c; }
  button { border: 0; border-radius: 5px; padding: 10px 14px; cursor: pointer; font-weight: 700; }
  .page { width: min(210mm, calc(100% - 32px)); min-height: 297mm; margin: 20px auto; background: white; padding: 22mm 18mm; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
  h1 { margin: 0 0 6px; font-size: 19px; }
  .meta { padding-bottom: 14px; margin-bottom: 20px; border-bottom: 1px solid #ccd4cf; font-size: 12px; color: #526059; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.55 Arial, Helvetica, sans-serif; margin: 0; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #ccd4cf; font-size: 10px; color: #6b7771; }
  @media print {
    body { background: white; }
    .toolbar { display: none; }
    .page { width: 100%; min-height: auto; margin: 0; padding: 12mm; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / salvar como PDF</button></div>
  <main class="page">
    <h1>${escapeHtml(document.nome)}</h1>
    <div class="meta">Versão ${escapeHtml(document.versao)} · aceite registrado em ${escapeHtml(formatSignedAt(document.data_assinatura))}</div>
    <pre>${body}</pre>
    <div class="footer">Documento gerado a partir do snapshot versionado preservado no MedicsPro. A impressão em PDF mantém o conteúdo aceito pelo paciente.</div>
  </main>
</body>
</html>`);
  win.document.close();
}
