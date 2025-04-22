import mongoose, { Document, Schema, Types } from 'mongoose';

// Định nghĩa kiểu PriceAlert
export enum AlertType {
  ABOVE = 'above',
  BELOW = 'below',
}

// Interface cho document Notification
export interface INotification extends Document {
  _id: Types.ObjectId;   // ID của document trong MongoDB
  userId: number;        // ID Telegram của người dùng
  tokenSymbol: string;   // Ký hiệu của token (ví dụ: BTC, ETH)
  alertType: AlertType;  // Loại cảnh báo (trên hoặc dưới)
  targetPrice: number;   // Giá mục tiêu
  isActive: boolean;     // Trạng thái hoạt động của thông báo
  createdAt: Date;       // Thời điểm tạo
  updatedAt: Date;       // Thời điểm cập nhật gần nhất
}

// Schema cho notification
const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    tokenSymbol: {
      type: String,
      required: true,
      uppercase: true,
    },
    alertType: {
      type: String,
      enum: Object.values(AlertType),
      required: true,
    },
    targetPrice: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Tạo và xuất model
export default mongoose.model<INotification>('Notification', NotificationSchema); 