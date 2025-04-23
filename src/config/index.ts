import dotenv from 'dotenv';
import path from 'path';

// Đọc các biến môi trường từ file .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
	telegramToken: process.env.BOT_TOKEN || '',
	mongodbUri: process.env.MONGODB_URI || '',
	githubToken: process.env.GITHUB_TOKEN || '',
	gistId: process.env.GIST_ID || '',
	// API key CoinGecko là tùy chọn, phiên bản miễn phí vẫn hoạt động bình thường
	coinGeckoApiKey: process.env.COINGECKO_API_KEY || '',
};
