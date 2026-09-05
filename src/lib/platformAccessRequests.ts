import { platformSupabase } from './platformSupabaseClient';

export type ClinicAccessRequestStatus = 'pending' | 'rejected' | 'provisioned';

export type ClinicAccessRequest = {
  id: string;
  publicId: string;
  clinicName: string;
  cnpj: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  status: ClinicAccessRequestStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  provisioningRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

const db = platformSupabase as any;

export async function loadClinicAccessRequests(status: ClinicAccessRequestStatus | null = null): Promise<ClinicAccessRequest[]> {
  const { data, error } = await db.rpc('platform_list_clinic_access_requests', {
    p_status: status,
    p_limit: 100,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.request_id),
    publicId: String(row.public_id),
    clinicName: String(row.clinic_name),
    cnpj: row.cnpj ? String(row.cnpj) : null,
    ownerName: String(row.owner_name),
    ownerEmail: String(row.owner_email),
    ownerPhone: row.owner_phone ? String(row.owner_phone) : null,
    status: row.status as ClinicAccessRequestStatus,
    reviewNote: row.review_note ? String(row.review_note) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    provisioningRequestId: row.provisioning_request_id ? String(row.provisioning_request_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function rejectClinicAccessRequest(requestId: string, note?: string): Promise<void> {
  const { error } = await db.rpc('platform_reject_clinic_access_request', {
    p_request_id: requestId,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}
