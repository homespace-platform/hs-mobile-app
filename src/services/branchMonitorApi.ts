// Floor map, room links, status layers and attention list of a branch. Ports of hs-web-app
// services/branch-layout.service.ts, branch-assignment.service.ts and the requests of
// branch-overview.service.ts. Parsing lives in the pure lib/branch-* modules.
import axiosClient from '@/lib/axios-client';
import { PAGE_SIZE, parseAssignments, parseCandidates } from '@/lib/branch-assignment';
import { parseAttention, parseAttentionSummary, parseOverview } from '@/lib/branch-overview';
import type { ApiResponse } from '@/types/api';
import type { AssignmentKind, RoomManualStatus } from '@/types/branch-assignment';
import type { BranchLayout, SaveBranchLayoutRequest } from '@/types/branch-layout';

const base = (branchId: string) => `/api/v1/branches/${encodeURIComponent(branchId)}`;
const roomPath = (branchId: string, roomId: string) =>
  `${base(branchId)}/rooms/${encodeURIComponent(roomId)}`;
const listingLink = (branchId: string, roomId: string, listingId: string) =>
  `${roomPath(branchId, roomId)}/listings/${encodeURIComponent(listingId)}`;
const contractLink = (branchId: string, contractId: string) =>
  `${base(branchId)}/contracts/${encodeURIComponent(contractId)}`;

/** A reply that is not a map must not read as "no map yet" (and then be saved over). */
function parseLayout(value: BranchLayout | undefined): BranchLayout {
  if (!value || !Number.isInteger(value.revision) || !Array.isArray(value.floors ?? []))
    throw new Error('Máy chủ trả về dữ liệu không đúng định dạng.');
  return value;
}

export const branchLayoutApi = {
  async getLayout(branchId: string) {
    const response = await axiosClient.get<ApiResponse<BranchLayout>>(`${base(branchId)}/layout`);
    return parseLayout(response.data?.result);
  },
  async saveLayout(branchId: string, request: SaveBranchLayoutRequest) {
    const path = `${base(branchId)}/layout`;
    const response = await axiosClient.put<ApiResponse<BranchLayout>>(path, request);
    return parseLayout(response.data?.result);
  },
};

export const branchAssignmentApi = {
  async getAssignments(branchId: string, page = 0, size = PAGE_SIZE) {
    const response = await axiosClient.get<ApiResponse<unknown>>(`${base(branchId)}/assignments`, {
      params: { page, size },
    });
    return parseAssignments(response.data?.result);
  },

  async getCandidates(branchId: string, kind: AssignmentKind, page = 0, size = PAGE_SIZE) {
    const response = await axiosClient.get<ApiResponse<unknown>>(
      `${base(branchId)}/assignment-candidates`,
      { params: { kind, page, size } }
    );
    return parseCandidates(response.data?.result);
  },

  async linkListing(branchId: string, roomId: string, listingId: string): Promise<void> {
    await axiosClient.put(listingLink(branchId, roomId, listingId));
  },

  async unlinkListing(branchId: string, roomId: string, listingId: string): Promise<void> {
    await axiosClient.delete(listingLink(branchId, roomId, listingId));
  },

  /** roomId null = the "Chưa xếp phòng" tray. Also moves a contract between rooms of the branch. */
  async putContract(branchId: string, contractId: string, roomId: string | null): Promise<void> {
    await axiosClient.put(contractLink(branchId, contractId), { roomId });
  },

  async addContractToTray(branchId: string, contractId: string): Promise<void> {
    await axiosClient.put(contractLink(branchId, contractId), { addToTray: true });
  },

  async removeContract(branchId: string, contractId: string): Promise<void> {
    await axiosClient.delete(contractLink(branchId, contractId));
  },

  async setManualStatus(branchId: string, roomId: string, status: RoomManualStatus): Promise<void> {
    await axiosClient.put(`${roomPath(branchId, roomId)}/manual-status`, { status });
  },
};

export const branchOverviewApi = {
  async getAttention(branchId: string, page = 0, size = 20) {
    const response = await axiosClient.get<ApiResponse<unknown>>(`${base(branchId)}/attention`, {
      params: { page, size },
    });
    return parseAttention(response.data?.result);
  },

  async getAttentionSummary() {
    const path = '/api/v1/branches/attention-summary';
    const response = await axiosClient.get<ApiResponse<unknown>>(path);
    return parseAttentionSummary(response.data?.result);
  },

  /** Without `month` the server picks its current billing month. */
  async getOverview(branchId: string, month?: string) {
    const response = await axiosClient.get<ApiResponse<unknown>>(`${base(branchId)}/overview`, {
      params: month ? { month } : undefined,
    });
    return parseOverview(response.data?.result);
  },
};
