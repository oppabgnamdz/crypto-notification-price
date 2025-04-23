import Notification, { AlertType, INotification } from '../models/notification';

// Interface cho dữ liệu tạo thông báo mới
interface CreateNotificationData {
	userId: number;
	tokenSymbol: string;
	alertType: AlertType;
	targetPrice: number;
}

// Thêm thông báo mới
export const createNotification = async (
	data: CreateNotificationData
): Promise<INotification> => {
	try {
		const notification = new Notification(data);
		const savedNotification = await notification.save();

		return savedNotification;
	} catch (error) {
		console.error('Lỗi khi tạo thông báo:', error);
		throw error;
	}
};

// Lấy tất cả thông báo của một người dùng
export const getUserNotifications = async (
	userId: number
): Promise<INotification[]> => {
	try {
		return await Notification.find({ userId, isActive: true });
	} catch (error) {
		console.error('Lỗi khi lấy thông báo của người dùng:', error);
		throw error;
	}
};

// Xóa thông báo
export const deleteNotification = async (
	notificationId: string
): Promise<boolean> => {
	try {
		const result = await Notification.findByIdAndDelete(notificationId);
		return !!result;
	} catch (error) {
		console.error('Lỗi khi xóa thông báo:', error);
		throw error;
	}
};
