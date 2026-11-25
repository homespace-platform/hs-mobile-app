import axiosClient from './client';
import type { ApiResponse } from '@/types/api';
import type {
  RentalReview,
  RentalReviewAnswer,
  RentalReviewTurn,
} from '@/types/rental/rental-request.type';

const prefix = '/api/v1/ai/agent/rental-requests';

/** Hỏi AI: yêu cầu thuê nào tốt hơn cho chủ nhà (chỉ đọc, không tự duyệt/từ chối). */
const rentalRequestReviewService = {
  async review(listingId: string): Promise<RentalReview> {
    const response = await axiosClient.post<ApiResponse<RentalReview>>(`${prefix}/review`, {
      listingId,
    });
    return response.data.result;
  },

  async ask(
    listingId: string,
    question: string,
    history: RentalReviewTurn[]
  ): Promise<RentalReviewAnswer> {
    const response = await axiosClient.post<ApiResponse<RentalReviewAnswer>>(
      `${prefix}/review/ask`,
      {
        listingId,
        question,
        history: history.slice(-6),
      }
    );
    return response.data.result;
  },
};

export default rentalRequestReviewService;
