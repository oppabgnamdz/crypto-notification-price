import axios from 'axios';
import config from '../config';
import { INotification } from '../models/notification';

interface TokenNotification {
	id: string; // ID của token (ví dụ: bitcoin, ethereum)
	threshold: number; // Giá ngưỡng
	type: string; // Loại thông báo (above/below)
	name: string; // Tên của token
	idTelegram?: number; // ID Telegram của người dùng
}

/**
 * Lấy dữ liệu thông báo hiện tại từ Gist
 * @returns Mảng các thông báo token hiện có
 */
export const getTokenNotificationsFromGist = async (): Promise<
	TokenNotification[]
> => {
	try {
		// Nếu không có gistId hoặc githubToken, trả về mảng rỗng
		if (!config.gistId || !config.githubToken) {
			console.warn(
				'GITHUB_TOKEN hoặc GIST_ID chưa được cấu hình. Không thể lấy dữ liệu từ Gist.'
			);
			return [];
		}

		// Headers cho GitHub API
		const headers = {
			Accept: 'application/vnd.github.v3+json',
			Authorization: `Bearer ${config.githubToken}`,
			'Content-Type': 'application/json',
		};

		// Lấy nội dung Gist
		const gistUrl = `https://api.github.com/gists/${config.gistId}`;
		const gistResponse = await axios.get(gistUrl, { headers });

		// Lấy tên file đầu tiên trong Gist
		const files = gistResponse.data.files || {};
		const fileName = Object.keys(files)[0] || 'token-notification';

		// Lấy và parse nội dung
		if (files[fileName] && files[fileName].content) {
			try {
				const content = JSON.parse(files[fileName].content);
				if (content.tokens && Array.isArray(content.tokens)) {
					return content.tokens;
				}
				return [];
			} catch (e) {
				console.error('Lỗi khi phân tích nội dung Gist:', e);
				return [];
			}
		}

		return [];
	} catch (error) {
		console.error('Lỗi khi lấy dữ liệu từ Gist:', error);
		return [];
	}
};

/**
 * Thêm một thông báo mới vào Gist
 * @param notification - Đối tượng thông báo để thêm vào Gist
 */
export const addNotificationToGist = async (
	notification: any
): Promise<void> => {
	try {
		// Nếu không có gistId hoặc githubToken, bỏ qua
		if (!config.gistId || !config.githubToken) {
			console.warn(
				'GITHUB_TOKEN hoặc GIST_ID chưa được cấu hình. Bỏ qua việc cập nhật Gist.'
			);
			return;
		}

		// Headers cho GitHub API
		const headers = {
			Accept: 'application/vnd.github.v3+json',
			Authorization: `Bearer ${config.githubToken}`,
			'Content-Type': 'application/json',
		};

		try {
			// Lấy dữ liệu thông báo hiện tại từ Gist
			const existingTokens = await getTokenNotificationsFromGist();

			// Tạo thông báo mới theo định dạng yêu cầu
			const newToken: TokenNotification = {
				id: notification.tokenSymbol.toLowerCase(),
				threshold: notification.targetPrice,
				type: notification.alertType === 'above' ? 'above' : 'below',
				name: notification.tokenSymbol,
				idTelegram: notification.userId,
			};

			// Thêm vào mảng hiện có
			existingTokens.push(newToken);

			// Tạo cấu trúc dữ liệu cuối cùng
			const finalContent = {
				tokens: existingTokens,
			};

			// Cập nhật Gist với nội dung mới
			const gistUrl = `https://api.github.com/gists/${config.gistId}`;
			await axios.patch(
				gistUrl,
				{
					files: {
						'token-notification': {
							content: JSON.stringify(finalContent, null, 2),
						},
					},
				},
				{ headers }
			);

			console.log(
				`Đã thêm thông báo thành công vào Gist: ${notification.tokenSymbol}`
			);
		} catch (apiError: any) {
			if (apiError.response?.status === 403) {
				console.error(
					'Lỗi quyền truy cập GitHub Gist: Token không có quyền chỉnh sửa Gist này hoặc Gist ID không hợp lệ.'
				);
				console.error('Vui lòng kiểm tra lại:');
				console.error('1. Token GitHub có quyền "gist" không?');
				console.error('2. Gist ID có thuộc về tài khoản của bạn không?');
				console.error(
					'Chi tiết lỗi:',
					apiError.response?.data?.message || 'Không có thông tin chi tiết'
				);
			} else if (apiError.response?.status === 404) {
				console.error(
					'Lỗi GitHub Gist: Không tìm thấy Gist với ID đã cung cấp.'
				);
			} else {
				console.error('Lỗi khi gọi GitHub API:', apiError.message);
			}

			// Ghi lại lỗi nhưng không làm gián đoạn luồng chính của ứng dụng
			// Dữ liệu vẫn được lưu trong MongoDB
		}
	} catch (error) {
		console.error('Lỗi khi cập nhật Gist:', error);
		// Lỗi này không nên ảnh hưởng đến luồng chính của ứng dụng
	}
};
