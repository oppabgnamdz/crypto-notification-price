FROM node:20-alpine

# Tạo thư mục làm việc
WORKDIR /app

# Sao chép package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies
RUN npm ci

# Sao chép mã nguồn
COPY . .

# Build TypeScript thành JavaScript
RUN npm run build

# Đặt biến môi trường NODE_ENV
ENV NODE_ENV=production

# Expose cổng nếu cần (tuy nhiên bot Telegram không cần expose cổng)
# EXPOSE 3000

# Khởi động ứng dụng
CMD ["node", "dist/index.js"] 