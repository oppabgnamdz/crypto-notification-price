import { Telegraf, Markup, Context } from 'telegraf';
import config from './config';
import { connectToDatabase } from './controllers/database';
import {
	createNotification,
	getUserNotifications,
	deleteNotification,
} from './controllers/notification';
import { UserContext, ConversationState } from './models/userContext';
import { AlertType } from './models/notification';
import { getTokenNotificationsFromGist } from './controllers/gist';
import { initializeGist } from './controllers/initGist';
import { startPriceMonitoring, checkPrices } from './services/priceMonitor';

// Biến để kiểm tra trạng thái của bot
let isBotRunning = false;

// Tạo hàm khởi động bot an toàn
const startBot = async () => {
	// Nếu bot đã đang chạy, không khởi động lại
	if (isBotRunning) {
		console.log('Bot đã đang chạy, bỏ qua việc khởi động lại');
		return;
	}

	try {
		// Khởi tạo bot với token
		const bot = new Telegraf(config.telegramToken);

		// Kết nối đến cơ sở dữ liệu trước
		await connectToDatabase();
		console.log('Kết nối MongoDB thành công');

		// Xử lý lệnh /start
		bot.command('start', (ctx) => {
			const userId = ctx.from.id;
			const userContext = UserContext.getOrCreate(userId);

			// Reset context và chuyển sang trạng thái chờ nhập token
			userContext.reset();
			userContext.state = ConversationState.WAITING_FOR_TOKEN;

			ctx.reply(
				'Chào mừng đến với Bot thông báo giá! Vui lòng nhập ký hiệu token bạn muốn theo dõi (ví dụ: BTC, ETH):'
			);
		});

		// Thêm lệnh /myalerts để hiển thị tất cả thông báo của người dùng
		bot.command('myalerts', async (ctx) => {
			const userId = ctx.from.id;

			try {
				// Lấy tất cả thông báo của người dùng
				const notifications = await getUserNotifications(userId);

				if (notifications.length === 0) {
					ctx.reply(
						'Bạn chưa thiết lập thông báo nào. Sử dụng lệnh /start để tạo thông báo mới.'
					);
					return;
				}

				let message = '📊 *DANH SÁCH THÔNG BÁO CỦA BẠN* 📊\n\n';

				notifications.forEach((notification, index) => {
					const alertType =
						notification.alertType === AlertType.ABOVE
							? 'vượt trên'
							: 'xuống dưới';

					message += `*${index + 1}. ${notification.tokenSymbol}*\n`;
					message += `   Điều kiện: Giá ${alertType} $${notification.targetPrice}\n`;
					message += `   ID: \`${notification._id}\`\n\n`;
				});

				message +=
					'Để xóa một thông báo, hãy sử dụng lệnh: `/delete ID_THÔNG_BÁO`';

				ctx.reply(message, { parse_mode: 'Markdown' });
			} catch (error) {
				console.error('Lỗi khi lấy danh sách thông báo:', error);
				ctx.reply('Đã xảy ra lỗi khi lấy danh sách thông báo của bạn.');
			}
		});

		// Thêm lệnh /delete để xóa một thông báo
		bot.command('delete', async (ctx) => {
			const userId = ctx.from.id;
			const messageText = ctx.message.text.trim();
			const parts = messageText.split(' ');

			if (parts.length !== 2) {
				ctx.reply(
					'Cú pháp không đúng. Vui lòng sử dụng: `/delete ID_THÔNG_BÁO`'
				);
				return;
			}

			const notificationId = parts[1];

			try {
				// Xác minh thông báo tồn tại và thuộc về người dùng này
				const notifications = await getUserNotifications(userId);
				const targetNotification = notifications.find(
					(n) => n._id.toString() === notificationId
				);

				if (!targetNotification) {
					ctx.reply(
						'Không tìm thấy thông báo với ID đã cung cấp hoặc thông báo không thuộc về bạn.'
					);
					return;
				}

				// Xóa thông báo
				const success = await deleteNotification(notificationId);

				if (success) {
					ctx.reply(
						`✅ Đã xóa thành công thông báo cho ${targetNotification.tokenSymbol}.`
					);
				} else {
					ctx.reply('Không thể xóa thông báo. Vui lòng thử lại sau.');
				}
			} catch (error) {
				console.error('Lỗi khi xóa thông báo:', error);
				ctx.reply('Đã xảy ra lỗi khi xóa thông báo.');
			}
		});

		// Thêm lệnh /listgist để hiển thị dữ liệu từ GitHub Gist
		bot.command('listgist', async (ctx) => {
			try {
				const tokens = await getTokenNotificationsFromGist();

				if (tokens.length === 0) {
					ctx.reply('Không có dữ liệu thông báo nào trong GitHub Gist.');
					return;
				}

				let message = 'Danh sách thông báo trong GitHub Gist:\n\n';

				tokens.forEach((token, index) => {
					message += `${index + 1}. ${token.name} (${token.id})\n`;
					message += `   Ngưỡng: ${token.threshold} (${token.type === 'above' ? 'vượt trên' : 'dưới'})\n`;
					message += `   ID Telegram: ${token.idTelegram || 'Không có'}\n\n`;
				});

				ctx.reply(message);
			} catch (error) {
				console.error('Lỗi khi lấy dữ liệu từ Gist:', error);
				ctx.reply('Đã xảy ra lỗi khi lấy dữ liệu từ GitHub Gist.');
			}
		});

		// Thêm lệnh /initgist để khởi tạo Gist với dữ liệu mẫu
		bot.command('initgist', async (ctx) => {
			try {
				await initializeGist();
				ctx.reply(
					'Đã khởi tạo/cập nhật GitHub Gist với dữ liệu mẫu thành công.'
				);
			} catch (error) {
				console.error('Lỗi khi khởi tạo Gist:', error);
				ctx.reply('Đã xảy ra lỗi khi khởi tạo GitHub Gist.');
			}
		});

		// Thêm lệnh /forceprice để kiểm tra luồng xử lý giá
		bot.command('forceprice', async (ctx) => {
			try {
				console.log(
					'\n[MANUAL] Bắt đầu kiểm tra giá theo yêu cầu người dùng...'
				);
				const userId = ctx.from.id;

				// Lấy thông báo của người dùng này
				const notifications = await getUserNotifications(userId);

				if (notifications.length === 0) {
					ctx.reply(
						'Bạn chưa thiết lập thông báo nào. Sử dụng lệnh /start để tạo thông báo.'
					);
					return;
				}

				// Báo cáo cho người dùng
				ctx.reply(
					`Đang kiểm tra ${notifications.length} thông báo của bạn. Vui lòng đợi...`
				);

				// Gọi trực tiếp hàm checkPrices để kiểm tra ngay lập tức
				await checkPrices(bot);

				console.log('[MANUAL] Đã hoàn tất kiểm tra giá theo yêu cầu');
				// Thông báo hoàn tất
				ctx.reply(
					'Đã hoàn tất kiểm tra giá. Nếu có token nào đạt ngưỡng, bạn sẽ nhận được thông báo.'
				);
			} catch (error) {
				console.error('[ERROR] Lỗi khi kiểm tra giá thủ công:', error);
				ctx.reply('Đã xảy ra lỗi trong quá trình kiểm tra giá.');
			}
		});

		// Xử lý tin nhắn thông thường
		bot.on('text', async (ctx) => {
			const userId = ctx.from.id;
			const userContext = UserContext.getOrCreate(userId);
			const messageText = ctx.message.text;

			switch (userContext.state) {
				case ConversationState.WAITING_FOR_TOKEN:
					// Lưu token và chuyển sang bước tiếp theo
					userContext.setupData.tokenSymbol = messageText.toUpperCase();
					userContext.state = ConversationState.WAITING_FOR_ALERT_TYPE;

					// Hiển thị các lựa chọn loại thông báo
					ctx.reply(
						`Bạn muốn nhận thông báo khi giá ${userContext.setupData.tokenSymbol} như thế nào?`,
						Markup.inlineKeyboard([
							Markup.button.callback('Trên ngưỡng giá', 'alert_above'),
							Markup.button.callback('Dưới ngưỡng giá', 'alert_below'),
						])
					);
					break;

				case ConversationState.WAITING_FOR_PRICE:
					// Kiểm tra giá nhập vào có hợp lệ không
					const price = parseFloat(messageText);

					if (isNaN(price) || price <= 0) {
						ctx.reply('Vui lòng nhập một số hợp lệ lớn hơn 0:');
						return;
					}

					// Lưu giá và tạo thông báo mới
					userContext.setupData.targetPrice = price;

					try {
						// Tạo thông báo mới trong cơ sở dữ liệu
						const alertType =
							userContext.setupData.alertType === 'above'
								? AlertType.ABOVE
								: AlertType.BELOW;

						const notification = await createNotification({
							userId: userId,
							tokenSymbol: userContext.setupData.tokenSymbol!,
							alertType: alertType,
							targetPrice: price,
						});

						// Thông báo thành công và reset context
						ctx.reply(
							`✅ Đã thiết lập thành công thông báo cho ${userContext.setupData.tokenSymbol}!\n` +
								`Bạn sẽ nhận được thông báo khi giá ${alertType === AlertType.ABOVE ? 'vượt quá' : 'giảm xuống dưới'} ${price}.\n` +
								`Dữ liệu đã được lưu vào MongoDB.\n` +
								`Ghi chú: Nếu bạn đã cấu hình GitHub Gist, dữ liệu sẽ được đồng bộ (nếu token hợp lệ).`
						);

						userContext.reset();
					} catch (error) {
						console.error('Lỗi khi tạo thông báo:', error);
						ctx.reply('Có lỗi xảy ra khi tạo thông báo. Vui lòng thử lại sau.');
						userContext.reset();
					}
					break;

				default:
					// Nếu không trong trạng thái hội thoại nào, chỉ dẫn người dùng
					ctx.reply(
						'Vui lòng sử dụng lệnh /start để thiết lập thông báo giá mới.'
					);
					break;
			}
		});

		// Xử lý callback từ các nút nhấn
		bot.action(['alert_above', 'alert_below'], (ctx) => {
			const userId = ctx.from?.id;

			if (!userId) {
				ctx.reply('Có lỗi xảy ra. Vui lòng thử lại.');
				return;
			}

			const userContext = UserContext.getOrCreate(userId);

			// Chỉ xử lý nếu đang ở trạng thái chờ loại thông báo
			if (userContext.state !== ConversationState.WAITING_FOR_ALERT_TYPE) {
				return;
			}

			// Lấy loại thông báo từ callback data
			const action = String(ctx.match);
			const alertType = action === 'alert_above' ? 'above' : 'below';
			userContext.setupData.alertType = alertType;

			// Chuyển sang trạng thái chờ nhập giá
			userContext.state = ConversationState.WAITING_FOR_PRICE;

			const tokenSymbol = userContext.setupData.tokenSymbol;
			const alertTypeText =
				alertType === 'above' ? 'vượt quá' : 'giảm xuống dưới';

			ctx.reply(
				`Vui lòng nhập giá bạn muốn nhận thông báo khi ${tokenSymbol} ${alertTypeText}:`
			);

			// Thực hiện hoàn tất callback để ẩn nút loading
			ctx.answerCbQuery();
		});

		// Xử lý khi bot bị tắt
		process.once('SIGINT', () => {
			isBotRunning = false;
			bot.stop('SIGINT');
		});
		process.once('SIGTERM', () => {
			isBotRunning = false;
			bot.stop('SIGTERM');
		});

		// Khởi động bot
		await bot.launch();
		console.log('🤖 Bot Telegram đã khởi động thành công!');
		isBotRunning = true;

		// Khởi động luồng theo dõi giá token
		console.log('⏱️ Bắt đầu luồng theo dõi giá (kiểm tra mỗi 30 giây)...');
		console.log(
			'📌 Kiểm tra xem hàm startPriceMonitoring có được định nghĩa không:',
			typeof startPriceMonitoring === 'function' ? 'Có' : 'Không'
		);
		try {
			startPriceMonitoring(bot);
			console.log('✅ Đã khởi động thành công luồng theo dõi giá.');
		} catch (monitoringError) {
			console.error(
				'❌ Lỗi khi khởi động luồng theo dõi giá:',
				monitoringError
			);
		}
		console.log('✅ Hệ thống đã sẵn sàng và đang chạy.');
	} catch (error) {
		console.error('Lỗi khi khởi động bot:', error);
		isBotRunning = false;
	}
};

// Bắt đầu bot
startBot();
