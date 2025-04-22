# Bot Thông Báo Giá Token Telegram

Bot Telegram thông báo giá token cryptocurrency khi đạt đến ngưỡng giá đã cài đặt.

## Tính năng

- Người dùng có thể cài đặt thông báo cho bất kỳ token nào
- Hỗ trợ thông báo khi giá vượt ngưỡng trên hoặc giảm xuống dưới ngưỡng
- Lưu thông tin thông báo vào MongoDB để xử lý
- Đồng bộ dữ liệu thông báo lên GitHub Gist tự động

## Cài đặt

### Sử dụng Docker (Khuyên dùng)

1. Clone repository này:

```bash
git clone <url-repository>
cd notification-price-bot
```

2. Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

3. Chỉnh sửa file `.env` với thông tin của bạn:

```
BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=mongodb://mongodb:27017/telegram-price-bot
GITHUB_TOKEN=ghp_your_github_personal_access_token
GIST_ID=your_gist_id
```

4. Khởi động ứng dụng với Docker Compose:

```bash
docker-compose up -d
```

### Cài đặt thủ công

1. Clone repository này:

```bash
git clone <url-repository>
cd notification-price-bot
```

2. Cài đặt các dependencies:

```bash
npm install
```

3. Tạo file `.env` với nội dung:

```
BOT_TOKEN=your_telegram_bot_token
MONGODB_URI=mongodb://localhost:27017/telegram-price-bot
GITHUB_TOKEN=ghp_your_github_personal_access_token
GIST_ID=your_gist_id
```

4. Khởi động MongoDB:

- Đảm bảo MongoDB đã được cài đặt và đang chạy

5. Build và chạy dự án:

```bash
npm run build
npm start
```

## Sử dụng

1. Bắt đầu trò chuyện với bot bằng lệnh `/start`
2. Nhập ký hiệu token bạn muốn theo dõi (ví dụ: BTC, ETH)
3. Chọn loại thông báo (trên ngưỡng hoặc dưới ngưỡng)
4. Nhập giá ngưỡng bạn muốn nhận thông báo
5. Bot sẽ xác nhận rằng thông báo đã được thiết lập

### Các lệnh khác

- `/listgist` - Hiển thị danh sách thông báo đã lưu trong GitHub Gist
- `/initgist` - Khởi tạo GitHub Gist với dữ liệu mẫu ban đầu

## Triển khai lên server

### Sử dụng Docker

1. Đảm bảo server đã cài đặt Docker và Docker Compose
2. Clone repository và cấu hình như hướng dẫn ở phần Cài đặt với Docker
3. Khởi động dịch vụ:

```bash
docker-compose up -d
```

4. Kiểm tra logs để đảm bảo dịch vụ hoạt động đúng:

```bash
docker-compose logs -f
```

## Cấu trúc dự án

```
notification-price-bot/
├── src/
│   ├── config/
│   │   └── index.ts         # Cấu hình và biến môi trường
│   ├── controllers/
│   │   ├── database.ts      # Xử lý kết nối database
│   │   ├── gist.ts          # Xử lý đồng bộ dữ liệu với GitHub Gist
│   │   ├── initGist.ts      # Khởi tạo Gist với dữ liệu mẫu
│   │   └── notification.ts  # Xử lý các thao tác với thông báo
│   ├── models/
│   │   ├── notification.ts  # Model thông báo giá
│   │   └── userContext.ts   # Quản lý trạng thái hội thoại của người dùng
│   └── index.ts             # Điểm khởi đầu của ứng dụng
├── .env                     # Biến môi trường (không đưa vào git)
├── .env.example             # Mẫu biến môi trường
├── package.json             # Thông tin dự án và dependencies
├── tsconfig.json            # Cấu hình TypeScript
├── Dockerfile               # Cấu hình build Docker image
└── docker-compose.yml       # Cấu hình Docker Compose
```
