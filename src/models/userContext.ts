// Định nghĩa các bước trong quá trình thiết lập thông báo
export enum ConversationState {
	IDLE = 'idle',
	WAITING_FOR_TOKEN = 'waiting_for_token',
	WAITING_FOR_ALERT_TYPE = 'waiting_for_alert_type',
	WAITING_FOR_PRICE = 'waiting_for_price',
}

// Interface cho thông tin tạm thời trong quá trình thiết lập thông báo
export interface NotificationSetupData {
	tokenSymbol?: string;
	alertType?: string;
	targetPrice?: number;
}

// Lưu trữ context của người dùng
export class UserContext {
	private static contexts: Map<number, UserContext> = new Map();

	private constructor(
		public userId: number,
		public state: ConversationState = ConversationState.IDLE,
		public setupData: NotificationSetupData = {}
	) {}

	// Lấy hoặc tạo mới context cho người dùng
	public static getOrCreate(userId: number): UserContext {
		if (!this.contexts.has(userId)) {
			this.contexts.set(userId, new UserContext(userId));
		}
		return this.contexts.get(userId)!;
	}

	// Xóa context của người dùng
	public static delete(userId: number): void {
		this.contexts.delete(userId);
	}

	// Reset trạng thái về ban đầu
	public reset(): void {
		this.state = ConversationState.IDLE;
		this.setupData = {};
	}
}
