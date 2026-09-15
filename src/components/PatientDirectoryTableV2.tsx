import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Card, Chip } from '../lib/ui';
import { STAGE_META, ageFrom, maskCpf, type Patient } from '../lib/types';

const patientTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

interface PatientDirectoryTableV2Props {
  patients: Patient[];
  onOpenPatient: (patientId: string) => void;
}

const STATUS_LABEL: Record<Patient['status'], string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  alta: 'Alta',
};

export function PatientDirectoryTableV2({ patients, onOpenPatient }: PatientDirectoryTableV2Props) {
  const columns: Array<ColumnDef<typeof patientTableFeatures, Patient>> = [
    {
      id: 'patient',
      accessorFn: (patient) => patient.preferredName || patient.nome,
      header: 'Paciente',
      cell: (info) => {
        const patient = info.row.original;
        return (
          <div className="min-w-[240px]">
            <p className="font-display text-base font-semibold leading-snug text-paper">
              {patient.preferredName || patient.nome}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-fog">
              {ageFrom(patient.nascimento)} anos · {maskCpf(patient.cpf)}
            </p>
          </div>
        );
      },
    },
    {
      id: 'contact',
      accessorFn: (patient) => `${patient.telefone} ${patient.email}`,
      header: 'Contato',
      cell: (info) => {
        const patient = info.row.original;
        return (
          <div className="min-w-[220px]">
            <p className="text-[15px] font-medium text-paper/90">{patient.telefone || 'Sem telefone'}</p>
            <p className="mt-1.5 max-w-[250px] truncate text-sm text-fog">{patient.email || 'Sem e-mail'}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'convenio',
      header: 'Convênio',
      cell: (info) => (
        <span className="min-w-[170px] text-[15px] text-fog">
          {info.row.original.convenio || 'Particular / não informado'}
        </span>
      ),
    },
    {
      accessorKey: 'funilStage',
      header: 'Jornada',
      cell: (info) => {
        const stageMeta = STAGE_META[info.row.original.funilStage];
        return <Chip className={`${stageMeta.chip} !px-3 !py-1.5 !text-sm`}>{stageMeta.label}</Chip>;
      },
    },
    {
      accessorKey: 'ultimaVisita',
      header: 'Última visita',
      cell: (info) => (
        <span className="whitespace-nowrap text-[15px] text-fog">
          {info.row.original.ultimaVisita
            ? format(new Date(`${info.row.original.ultimaVisita}T12:00`), 'dd/MM/yyyy', { locale: ptBR })
            : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.row.original.status;
        const statusClass = status === 'ativo'
          ? 'border-mint/35 bg-mint/10 text-mint'
          : status === 'alta'
            ? 'border-aqua/35 bg-aqua/10 text-aqua'
            : 'border-pulse/30 bg-pulse/10 text-pulse';
        return (
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusClass}`}>
            {STATUS_LABEL[status]}
          </span>
        );
      },
    },
  ];

  const table = useTable({
    key: 'patients-directory-v2',
    features: patientTableFeatures,
    columns,
    data: patients,
  });

  return (
    <Card className="overflow-hidden !rounded-ui-data-surface !p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-line bg-deep/70">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortable = header.column.getCanSort();
                  return (
                    <th key={header.id} className="px-6 py-4 text-left align-middle">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                          className={`inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.075em] text-fog ${sortable ? 'hover:text-paper' : 'cursor-default'}`}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' && <span aria-label="ordem crescente">↑</span>}
                          {sorted === 'desc' && <span aria-label="ordem decrescente">↓</span>}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onOpenPatient(row.original.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenPatient(row.original.id);
                  }
                }}
                tabIndex={0}
                aria-label={`Abrir paciente ${row.original.preferredName || row.original.nome}`}
                className="cursor-pointer border-b border-line/45 outline-none transition-colors last:border-0 hover:bg-raise/50 focus:bg-raise/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint/35"
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-5 align-middle">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
