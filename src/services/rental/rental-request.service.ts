import axiosClient from './client';
import type { ApiResponse, PageResponse } from '@/types/api';
import type {
  CreateRentalRequestPayload,
  RentalRequestResponse,
  RentalRequestConflict,
  RentalRequestStatus,
} from '@/types/rental/rental-request.type';

const rentalRequestService = {
  /**
   * Khách hàng gửi yêu cầu thuê nhà
   */
  async createRentalRequest(payload: CreateRentalRequestPayload): Promise<RentalRequestResponse> {
    const response = await axiosClient.post<ApiResponse<RentalRequestResponse>>(
      '/api/v1/rental-requests',
      payload
    );
    return response.data.result!;
  },

  /**
   * Ước tính chi phí thuê nhà và kiểm tra chỗ đỗ xe
   */
  async estimateRentalCost(
    payload: import('@/types/rental/rental-request.type').RentalEstimatePayload
  ): Promise<import('@/types/rental/rental-request.type').RentalEstimateResponse> {
    const response = await axiosClient.post<
      ApiResponse<import('@/types/rental/rental-request.type').RentalEstimateResponse>
    >('/api/v1/rental-requests/estimate', payload);
    return response.data.result!;
  },

  /**
   * Khách hàng lấy danh sách yêu cầu thuê của mình
   */
  async getMyRequests(params?: {
    status?: RentalRequestStatus | 'ALL';
    page?: number;
    size?: number;
  }): Promise<PageResponse<RentalRequestResponse>> {
    const response = await axiosClient.get<PageResponse<RentalRequestResponse>>(
      '/api/v1/rental-requests/my-requests',
      {
        params: {
          status: params?.status && params.status !== 'ALL' ? params.status : undefined,
          page: params?.page ?? 1,
          size: params?.size ?? 10,
        },
      }
    );
    return response.data;
  },

  /**
   * Lấy yêu cầu thuê của người dùng hiện tại đối với một bài đăng cụ thể
   */
  async getMyRequestByListing(listingId: string): Promise<RentalRequestResponse | null> {
    try {
      const response = await axiosClient.get<ApiResponse<RentalRequestResponse | null>>(
        `/api/v1/rental-requests/by-listing/${listingId}`
      );
      return response.data.result ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Lấy chi tiết 1 yêu cầu thuê
   */
  async getRequestById(id: string): Promise<RentalRequestResponse> {
    const response = await axiosClient.get<ApiResponse<RentalRequestResponse>>(
      `/api/v1/rental-requests/${id}`
    );
    return response.data.result!;
  },

  /**
   * Hai bên hủy yêu cầu chờ duyệt / giữ chỗ chưa báo chuyển. Server kiểm tra lại giao dịch.
   */
  async cancelRentalRequest(id: string): Promise<RentalRequestResponse> {
    const response = await axiosClient.put<ApiResponse<RentalRequestResponse>>(
      `/api/v1/rental-requests/${id}/cancel`
    );
    return response.data.result!;
  },

  /**
   * Chủ nhà xem danh sách yêu cầu thuê gửi đến các bài đăng của mình
   */
  async getOwnerRequests(params?: {
    listingId?: string;
    status?: RentalRequestStatus | 'ALL';
    page?: number;
    size?: number;
  }): Promise<PageResponse<RentalRequestResponse>> {
    const response = await axiosClient.get<PageResponse<RentalRequestResponse>>(
      '/api/v1/rental-requests/owner',
      {
        params: {
          listingId: params?.listingId || undefined,
          status: params?.status && params.status !== 'ALL' ? params.status : undefined,
          page: params?.page ?? 1,
          size: params?.size ?? 10,
        },
      }
    );
    return response.data;
  },

  /**
   * Chủ nhà: các bài đăng đang có từ 2 yêu cầu chờ duyệt cạnh tranh nhau
   */
  async getOwnerConflicts(): Promise<RentalRequestConflict[]> {
    const response = await axiosClient.get<ApiResponse<RentalRequestConflict[]>>(
      '/api/v1/rental-requests/owner/conflicts'
    );
    return response.data.result ?? [];
  },

  /**
   * Chủ nhà chấp thuận yêu cầu thuê, giữ chỗ và từ chối các yêu cầu còn chờ của cùng tin đăng.
   */
  async acceptRentalRequest(id: string): Promise<RentalRequestResponse> {
    const response = await axiosClient.put<ApiResponse<RentalRequestResponse>>(
      `/api/v1/rental-requests/${id}/accept`
    );
    return response.data.result!;
  },

  /**
   * Chủ nhà từ chối yêu cầu thuê
   */
  async rejectRentalRequest(id: string, rejectReason?: string): Promise<RentalRequestResponse> {
    const response = await axiosClient.put<ApiResponse<RentalRequestResponse>>(
      `/api/v1/rental-requests/${id}/reject`,
      { rejectReason }
    );
    return response.data.result!;
  },

  /**
   * Điều kiện giữ chỗ người thuê phải đồng ý. Web gọi thẳng trong RentalRequestModal.
   */
  async getReservationPolicy(): Promise<{ version: string; text: string }> {
    const response = await axiosClient.get<ApiResponse<{ version: string; text: string }>>(
      '/api/v1/rental-requests/reservation-policy'
    );
    return response.data.result;
  },

  /**
   * Chính sách giữ chỗ hiện hành (số phút giữ phòng)
   */
  async getPolicy(): Promise<{ holdMinutes?: number } | undefined> {
    const response = await axiosClient.get<ApiResponse<{ holdMinutes?: number }>>(
      '/api/v1/rental-requests/policy'
    );
    return response.data.result;
  },
};

export default rentalRequestService;
