// 自動更新腳本(Deployment Script)
#!/bin/bash

# 停止並移除舊容器
docker stop espace_app
docker rm espace_app

# 拉取最新映像
docker pull junmin765677/espace

# 啟動新容器
docker run -d \\
  --name espace_app \\
  -p 8000:8000 \\
  junmin765677/espace

echo "更新完成！"




// Dockerfile
# 使用 Node.js 官方的輕量化映像檔 (Alpine 版)，節省映像檔大小並減少安全風險。
# Alpine 是一個基於 musl libc 和 busybox 的輕量 Linux 發行版本。
FROM node:16-alpine

# 安裝 pm2
RUN npm install -g pm2

# 設置環境變數 NODE_ENV 為 production，告訴應用程式和 npm 它將運行在生產環境。
# 這樣可以避免安裝開發依賴，並啟用某些優化設置。
ENV NODE_ENV=production

# 設定容器內的工作目錄為 /app，之後的所有操作都會在這個目錄下進行。
WORKDIR /app

# 複製 package.json 和 package-lock.json 到工作目錄。
# 這樣做的原因是，如果代碼更新了但依賴未改變，Docker 會利用緩存跳過重新安裝依賴的步驟，減少構建時間。
COPY package*.json ./

# 安裝生產環境所需的 npm 依賴，並清除 npm 的快取以減少映像檔大小。
RUN npm install --production && npm cache clean --force

# 複製應用程式的所有代碼到工作目錄中。
# 注意：`.dockerignore` 文件會排除不必要的檔案（例如 node_modules 和 .git）。
COPY . .

# 指定應用程式的埠（8000），這樣可以讓 Docker 知道容器內的這個埠會有流量進出。
# 在容器運行時，Docker 可以根據這個設定進行埠映射。
EXPOSE 8000

# 建立應用程式用戶，以非 root 用戶的身份運行應用程式，增加安全性。
# `addgroup` 和 `adduser` 用於創建一個新的群組和用戶。
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 設置用戶為剛創建的 appuser，接下來的命令都將以這個用戶的權限運行，避免使用 root 權限。
USER appuser

# 設置健康檢查，Docker 會每隔 30 秒檢查一次應用是否在正常運行。
# `--timeout=10s` 設定超過 10 秒無回應則視為失敗，`--retries=3` 設定最多嘗試 3 次。
# 若容器無法在指定路徑 (/health) 上響應，則判定為健康檢查失敗。
# 注意：您需要在應用程式中實現 /health 路由，以提供健康檢查的回應。
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:8000/health || exit 1

# 指定容器啟動時要執行的命令，這裡是啟動 Node.js 應用程式。
# 會執行位於容器內 /app 目錄下的 app.js 文件。
CMD ["pm2-runtime", "app.js"]


