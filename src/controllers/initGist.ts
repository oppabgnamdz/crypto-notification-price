import axios from 'axios';
import config from '../config';

// Dữ liệu mẫu cho Gist ban đầu
const initialData = {
	tokens: [
		{ id: 'suins-token', threshold: 0.19, type: 'above', name: 'Suins Token' },
		{ id: 'suins-token', threshold: 0.16, type: 'below', name: 'Suins Token' },
		{ id: 'bitcoin', threshold: 93000, type: 'above', name: 'Bitcoin' },
	],
};

/**
 * Khởi tạo hoặc cập nhật Gist với dữ liệu ban đầu
 */
export const initializeGist = async (): Promise<void> => {
	try {
		// Nếu không có gistId hoặc githubToken, bỏ qua
		if (!config.gistId || !config.githubToken) {
			console.warn(
				'GITHUB_TOKEN hoặc GIST_ID chưa được cấu hình. Không thể khởi tạo Gist.'
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
			// Kiểm tra xem Gist có tồn tại không
			const gistUrl = `https://api.github.com/gists/${config.gistId}`;
			const gistResponse = await axios.get(gistUrl, { headers });

			// Cập nhật Gist với dữ liệu mẫu
			await axios.patch(
				gistUrl,
				{
					files: {
						'token-notification': {
							content: JSON.stringify(initialData, null, 2),
						},
					},
				},
				{ headers }
			);

			console.log(
				'Đã khởi tạo/cập nhật GitHub Gist với dữ liệu mẫu thành công.'
			);
		} catch (apiError: any) {
			if (apiError.response?.status === 404) {
				console.error(
					'Không tìm thấy Gist với ID đã cung cấp. Vui lòng kiểm tra lại Gist ID.'
				);
			} else {
				console.error('Lỗi khi truy cập GitHub API:', apiError.message);
			}
		}
	} catch (error) {
		console.error('Lỗi khi khởi tạo Gist:', error);
	}
};
