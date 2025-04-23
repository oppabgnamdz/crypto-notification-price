import axios from 'axios';
import { Telegraf } from 'telegraf';
import Notification, { AlertType } from '../models/notification';
import config from '../config';

// Interface cho dữ liệu giá từ CoinGecko
interface CoinGeckoPrice {
	[key: string]: {
		usd: number;
	};
}

// Cache lưu trữ giá token để giảm số lượng request API
interface PriceCache {
	[tokenId: string]: {
		price: number;
		timestamp: number;
	};
}

// Cache lưu giá token trong 120 giây
const priceCache: PriceCache = {};
// Thời gian cache hợp lệ (120 giây - 2 phút)
const CACHE_TTL = 120 * 1000;
// Đếm số lần gọi API để giới hạn rate
let apiCallCount = 0;
let lastResetTime = Date.now();
// Giới hạn API CoinGecko miễn phí là khoảng 10-30 request/phút
const API_RATE_LIMIT = 10;
const API_RATE_WINDOW = 60 * 1000; // 1 phút

// Biến để theo dõi trạng thái của service
let monitoringActive = false;
let monitoringIntervalId: NodeJS.Timeout | null = null;

// Hàm để lấy giá hiện tại của token từ CoinGecko API
const getTokenPrice = async (tokenId: string): Promise<number | null> => {
	// Kiểm tra cache trước
	const cached = priceCache[tokenId];
	const now = Date.now();

	// Sử dụng giá từ cache nếu còn hợp lệ
	if (cached && now - cached.timestamp < CACHE_TTL) {
		console.log(`[CACHE] Sử dụng giá cache cho ${tokenId}: $${cached.price}`);
		return cached.price;
	}

	// Kiểm tra và reset đếm rate limit
	if (now - lastResetTime > API_RATE_WINDOW) {
		console.log(`[RATE] Reset bộ đếm API: ${apiCallCount} → 0`);
		apiCallCount = 0;
		lastResetTime = now;
	}

	// Kiểm tra nếu đã đạt giới hạn API
	if (apiCallCount >= API_RATE_LIMIT) {
		console.log(
			`[LIMIT] Đã đạt giới hạn API (${API_RATE_LIMIT} request/${API_RATE_WINDOW / 1000}s). Dùng cache nếu có hoặc bỏ qua.`
		);
		return cached ? cached.price : null;
	}

	try {
		// Tăng số lần gọi API
		apiCallCount++;

		// Gọi API CoinGecko miễn phí
		const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`;

		console.log(
			`[API] Gọi API CoinGecko cho ${tokenId} (lần gọi thứ ${apiCallCount}/${API_RATE_LIMIT} trong phút này)`
		);
		const response = await axios.get<CoinGeckoPrice>(url);

		if (response.data && response.data[tokenId] && response.data[tokenId].usd) {
			const price = response.data[tokenId].usd;

			// Lưu vào cache
			priceCache[tokenId] = {
				price,
				timestamp: now,
			};

			console.log(`[SUCCESS] Lấy giá ${tokenId}: $${price}`);
			return price;
		}
		console.log(`[ERROR] Không tìm thấy dữ liệu giá cho ${tokenId}`);
		return null;
	} catch (error) {
		console.error(`[ERROR] Lỗi khi lấy giá của ${tokenId}:`, error);
		// Trả về giá cache cũ nếu có, ngay cả khi đã hết hạn
		return cached ? cached.price : null;
	}
};

// Map tokenSymbol sang tokenId của CoinGecko
// Ví dụ: BTC -> bitcoin, ETH -> ethereum
const getTokenIdFromSymbol = (symbol: string): string => {
	const tokenMap: Record<string, string> = {
		BTC: 'bitcoin',
		ETH: 'ethereum',
		BNB: 'binancecoin',
		SOL: 'solana',
		XRP: 'ripple',
		ADA: 'cardano',
		DOGE: 'dogecoin',
		DOT: 'polkadot',
		AVAX: 'avalanche-2',
		MATIC: 'matic-network',
		// Thêm các token khác ở đây
	};

	return tokenMap[symbol] || symbol.toLowerCase();
};

// Hàm gửi thông báo đến user qua Telegram
const sendNotification = async (
	bot: Telegraf,
	userId: number,
	tokenSymbol: string,
	currentPrice: number,
	targetPrice: number,
	alertType: AlertType
): Promise<void> => {
	try {
		console.log(
			`[NOTIFY] Đang gửi thông báo về ${tokenSymbol} đến user ${userId}`
		);

		const message =
			`🚨 *CẢNH BÁO GIÁ* 🚨\n\n` +
			`Token: *${tokenSymbol}*\n` +
			`Giá hiện tại: *$${currentPrice}*\n` +
			`Ngưỡng đã đặt: *$${targetPrice}*\n` +
			`Điều kiện: Giá ${alertType === AlertType.ABOVE ? 'vượt trên' : 'xuống dưới'} ngưỡng\n\n` +
			`Thời gian: ${new Date().toLocaleString('vi-VN')}`;

		await bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
		console.log(
			`[NOTIFY] ✅ Đã gửi thông báo thành công đến user ${userId} về token ${tokenSymbol}`
		);
	} catch (error) {
		console.error(
			`[ERROR] ❌ Lỗi khi gửi thông báo đến user ${userId}:`,
			error
		);
	}
};

// Hàm chính để theo dõi giá và kiểm tra các notification
export const startPriceMonitoring = (bot: Telegraf): void => {
	// Nếu đã đang chạy, không khởi động lại
	if (monitoringActive) {
		console.log('[MONITOR] Service đã đang chạy. Bỏ qua lệnh khởi động.');
		return;
	}

	// Thêm logs ban đầu mạnh mẽ hơn để đảm bảo rằng hàm được gọi
	console.log('\n=================================================');
	console.log('🔄 KHỞI ĐỘNG THEO DÕI GIÁ TOKEN');
	console.log('=================================================');
	console.log('[MONITOR] Hệ thống sẽ kiểm tra mỗi 30 giây và gửi thông báo khi đạt ngưỡng giá');
	
	// Đánh dấu service đang hoạt động
	monitoringActive = true;

	// Thực hiện kiểm tra ngay lập tức khi khởi động
	console.log('[MONITOR] Thực hiện kiểm tra đầu tiên...');
	
	// Chạy một kiểm tra ngay lập tức, nhưng đảm bảo không chặn luồng chính
	setTimeout(async () => {
		try {
			await checkPrices(bot);
			console.log('[STARTUP] Kiểm tra đầu tiên hoàn tất');
		} catch (error) {
			console.error('[ERROR] Lỗi khi thực hiện kiểm tra ban đầu:', error);
		}
	}, 1000);

	// Thiết lập interval để chạy kiểm tra mỗi 30 giây
	monitoringIntervalId = setInterval(async () => {
		try {
			console.log('\n[INTERVAL] Thực hiện kiểm tra định kỳ...');
			await checkPrices(bot);
		} catch (error) {
			console.error('[ERROR] Lỗi trong interval kiểm tra giá:', error);
		}
	}, 30000); // 30 giây

	console.log(`[MONITOR] Đã thiết lập interval với ID: ${monitoringIntervalId}`);

	// Xử lý khi ứng dụng kết thúc
	const cleanup = () => {
		stopPriceMonitoring();
	};

	process.on('SIGINT', cleanup);
	process.on('SIGTERM', cleanup);
};

// Hàm để dừng việc theo dõi giá
export const stopPriceMonitoring = (): boolean => {
	if (!monitoringActive || !monitoringIntervalId) {
		console.log('[MONITOR] Service không hoạt động, không cần dừng.');
		return false;
	}

	clearInterval(monitoringIntervalId);
	monitoringIntervalId = null;
	monitoringActive = false;

	console.log('[MONITOR] Đã dừng theo dõi giá token.');
	return true;
};

// Hàm để kiểm tra trạng thái
export const isMonitoringActive = (): boolean => {
	return monitoringActive;
};

// Tách hàm kiểm tra giá thành một hàm riêng biệt để dễ quản lý
export async function checkPrices(bot: Telegraf): Promise<void> {
	try {
		console.log('\n[MONITOR] Đang kiểm tra giá token...');

		// Lấy tất cả các thông báo đang hoạt động
		const activeNotifications = await Notification.find({ isActive: true });

		if (activeNotifications.length === 0) {
			console.log('[MONITOR] Không có thông báo nào đang hoạt động để kiểm tra');
			return; // Không có thông báo nào để kiểm tra
		}

		console.log(`[MONITOR] Tìm thấy ${activeNotifications.length} thông báo đang hoạt động`);

		// Nhóm các thông báo theo token để tránh gọi API nhiều lần cho cùng một token
		const tokenGroups = activeNotifications.reduce<Record<string, typeof activeNotifications>>(
			(groups, notification) => {
				const symbol = notification.tokenSymbol;
				if (!groups[symbol]) {
					groups[symbol] = [];
				}
				groups[symbol].push(notification);
				return groups;
			},
			{}
		);

		const tokenSymbols = Object.keys(tokenGroups);
		console.log(`[MONITOR] Token cần kiểm tra (${tokenSymbols.length}): ${tokenSymbols.join(', ')}`);

		// Xử lý từng nhóm token
		for (const [symbol, notifications] of Object.entries(tokenGroups)) {
			console.log(`[MONITOR] Đang kiểm tra giá cho ${symbol}...`);
			const tokenId = getTokenIdFromSymbol(symbol);
			const price = await getTokenPrice(tokenId);

			if (price === null) {
				console.log(`[MONITOR] Không thể lấy giá cho token ${symbol}, bỏ qua`);
				continue;
			}

			console.log(`[MONITOR] Giá hiện tại của ${symbol}: $${price}`);
			console.log(`[MONITOR] Kiểm tra ${notifications.length} thông báo cho ${symbol}`);

			// Kiểm tra mỗi thông báo cho token này
			for (const notification of notifications) {
				const { userId, targetPrice, alertType } = notification;

				try {
					// Kiểm tra điều kiện cảnh báo một cách rõ ràng hơn
					let shouldAlert = false;
					
					if (alertType === AlertType.ABOVE && price >= targetPrice) {
						console.log(`[TRIGGER] Giá ${symbol} ($${price}) ≥ ngưỡng trên ($${targetPrice})`);
						shouldAlert = true;
					} else if (alertType === AlertType.BELOW && price <= targetPrice) {
						console.log(`[TRIGGER] Giá ${symbol} ($${price}) ≤ ngưỡng dưới ($${targetPrice})`);
						shouldAlert = true;
					}

					if (shouldAlert) {
						console.log(`[ALERT] Gửi cảnh báo cho user ${userId} về token ${symbol}`);
						// Gửi thông báo đến user - đảm bảo hàm này hoạt động đúng
						await sendNotification(bot, userId, symbol, price, targetPrice, alertType);
						console.log(`[ALERT] Đã gửi cảnh báo thành công cho user ${userId}`);
					} else {
						console.log(`[CHECK] ${symbol}: $${price} chưa đạt ngưỡng $${targetPrice} (${alertType})`);
					}
				} catch (notifyError) {
					console.error(`[ERROR] Lỗi khi xử lý thông báo cho ${symbol}:`, notifyError);
				}
			}
		}

		console.log('[MONITOR] Hoàn tất kiểm tra giá token');
	} catch (error) {
		console.error('[ERROR] Lỗi trong quá trình theo dõi giá:', error);
	}
}
