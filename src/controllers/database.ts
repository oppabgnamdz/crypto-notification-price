import mongoose from 'mongoose';
import config from '../config';

// Kết nối đến MongoDB
export const connectToDatabase = async (): Promise<void> => {
	try {
		if (!config.mongodbUri) {
			throw new Error('MONGODB_URI không được cung cấp trong biến môi trường');
		}

		await mongoose.connect(config.mongodbUri);
		console.log('Kết nối thành công đến MongoDB');
	} catch (error) {
		console.error('Lỗi kết nối đến MongoDB:', error);
		process.exit(1);
	}
};

// Đóng kết nối khi ứng dụng kết thúc
export const closeDatabaseConnection = async (): Promise<void> => {
	try {
		await mongoose.connection.close();
		console.log('Đã đóng kết nối MongoDB');
	} catch (error) {
		console.error('Lỗi khi đóng kết nối MongoDB:', error);
	}
};
