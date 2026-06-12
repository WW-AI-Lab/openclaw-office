# OpenClaw Office — 部署文档

> 版本：2026.6.11 | 镜像仓库：`ghcr.io/ww-ai-lab/openclaw-office`

---

## 目录

1. [前置条件](#前置条件)
2. [快速启动（docker compose）](#快速启动docker-compose)
3. [纯 Docker 命令部署](#纯-docker-命令部署)
4. [环境变量说明](#环境变量说明)
5. [本地构建镜像](#本地构建镜像)
6. [多平台镜像构建与推送](#多平台镜像构建与推送)
7. [反向代理配置（Nginx / Traefik）](#反向代理配置)
8. [健康检查](#健康检查)
9. [升级与回滚](#升级与回滚)
10. [常见问题](#常见问题)

---

## 前置条件

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Docker | ≥ 24.0 | 容器运行时 |
| Docker Compose | ≥ 2.20（插件版） | `docker compose` 命令 |
| OpenClaw Gateway | 任意版本 | 必须已运行并可网络访问 |

获取 Gateway Token：

```bash
openclaw config get gateway.auth.token
```

---

## 快速启动（docker compose）

### 1. 准备环境变量文件

```bash
cp .env.example .env
# 编辑 .env，填入真实的 OPENCLAW_GATEWAY_URL 和 OPENCLAW_GATEWAY_TOKEN
```

`.env` 文件内容示例：

```dotenv
OPENCLAW_GATEWAY_URL=ws://192.168.1.100:18789
OPENCLAW_GATEWAY_TOKEN=your-actual-token-here
```

> ⚠️ **安全提示**：`.env` 已加入 `.gitignore`，请勿将含 Token 的 `.env` 提交到版本控制。

### 2. 拉取并启动

```bash
docker compose pull
docker compose up -d
```

### 3. 验证运行

```bash
docker compose ps
docker compose logs -f
```

浏览器打开 → `http://localhost:5180`

### 4. 停止

```bash
docker compose down
```

---

## 纯 Docker 命令部署

```bash
docker run -d \
  --name openclaw-office \
  --restart unless-stopped \
  -p 5180:5180 \
  -e OPENCLAW_GATEWAY_URL="ws://YOUR_GATEWAY_HOST:18789" \
  -e OPENCLAW_GATEWAY_TOKEN="YOUR_TOKEN" \
  ghcr.io/ww-ai-lab/openclaw-office:latest
  # 或使用腾讯云镜像:
  # ccr.ccs.tencentyun.com/openclaw/openclaw-office:latest
```

如果 Gateway 运行在宿主机上：

```bash
docker run -d \
  --name openclaw-office \
  --restart unless-stopped \
  -p 5180:5180 \
  --add-host host.docker.internal:host-gateway \
  -e OPENCLAW_GATEWAY_URL="ws://host.docker.internal:18789" \
  -e OPENCLAW_GATEWAY_TOKEN="YOUR_TOKEN" \
  ghcr.io/ww-ai-lab/openclaw-office:latest
```

指定版本（推荐生产环境固定版本）：

```bash
docker run ... ghcr.io/ww-ai-lab/openclaw-office:2026.6.11
```

---

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `OPENCLAW_GATEWAY_URL` | ✅ | `ws://localhost:18789` | OpenClaw Gateway WebSocket 地址 |
| `OPENCLAW_GATEWAY_TOKEN` | ✅ | — | Gateway 认证 Token |
| `PORT` | ❌ | `5180` | 容器内监听端口（修改时同步修改 `ports` 映射） |
| `HOST` | ❌ | `0.0.0.0` | 监听地址 |

> Token 也可以通过挂载配置文件提供：
> ```bash
> -v ${HOME}/.openclaw/openclaw.json:/home/openclaw/.openclaw/openclaw.json:ro
> ```

---

## 本地构建镜像

```bash
# 当前平台构建（用于本地测试）
docker build -t openclaw-office:dev .

# 启动测试
docker run --rm -p 5180:5180 \
  -e OPENCLAW_GATEWAY_URL="ws://host.docker.internal:18789" \
  -e OPENCLAW_GATEWAY_TOKEN="your-token" \
  --add-host host.docker.internal:host-gateway \
  openclaw-office:dev
```

---

## 多平台镜像构建与推送

生产镜像支持 `linux/amd64`（x86_64 服务器）和 `linux/arm64`（Apple Silicon / ARM 服务器）双架构。

### 1. 初始化 buildx 构建器（首次）

```bash
docker buildx create --name multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

### 2. 登录镜像仓库

```bash
# GitHub Container Registry (推荐)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# 或腾讯云容器镜像
docker login ccr.ccs.tencentyun.com
```

### 3. 构建并推送多平台镜像

```bash
# 替换 VERSION 为实际版本号，如 2026.6.11
VERSION=$(node -p "require('./package.json').version")

# 推送到 ghcr.io (推荐)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --push \
  -t ghcr.io/ww-ai-lab/openclaw-office:${VERSION} \
  -t ghcr.io/ww-ai-lab/openclaw-office:latest \
  .

# 或推送到腾讯云
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --push \
  -t ccr.ccs.tencentyun.com/openclaw/openclaw-office:${VERSION} \
  -t ccr.ccs.tencentyun.com/openclaw/openclaw-office:latest \
  .
```

### 4. 验证多平台 Manifest

```bash
docker buildx imagetools inspect ghcr.io/ww-ai-lab/openclaw-office:latest
```

---

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name office.example.com;

    location / {
        proxy_pass http://127.0.0.1:5180;
        proxy_http_version 1.1;

        # WebSocket 支持（Gateway 代理透传）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
    }
}
```

### Traefik（docker-compose labels）

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.openclaw-office.rule=Host(`office.example.com`)"
  - "traefik.http.services.openclaw-office.loadbalancer.server.port=5180"
```

---

## 健康检查

容器内置 healthcheck，30 秒间隔检查服务是否响应：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' openclaw-office

# 手动检测
curl -f http://localhost:5180/
```

---

## 升级与回滚

### 升级到最新版

```bash
docker compose pull
docker compose up -d
```

### 固定版本升级

编辑 `docker-compose.yml`，将 `image` 改为指定版本：

```yaml
image: ghcr.io/ww-ai-lab/openclaw-office:2026.6.11
```

然后：

```bash
docker compose up -d
```

### 回滚

```bash
# 回滚到上一个版本
docker compose stop
# 修改 image 版本后
docker compose up -d
```

---

## 常见问题

**Q: 容器启动后无法连接 Gateway？**
- 检查 `OPENCLAW_GATEWAY_URL` 是否可达（在宿主机上测试 `curl http://GATEWAY_HOST:18789`）
- 如果 Gateway 在宿主机，URL 使用 `ws://host.docker.internal:18789` 并确保添加了 `extra_hosts`

**Q: 控制台报 `hello-ok` 超时？**
- 检查 `OPENCLAW_GATEWAY_TOKEN` 是否正确
- 确认 Gateway 已启用 `gateway.controlUi.dangerouslyDisableDeviceAuth true`（详见 GATEWAY-SETUP.md）

**Q: 端口冲突？**
- 修改 `.env` 中的 `PORT` 并同步修改 `docker-compose.yml` 的 `ports` 映射

**Q: 如何查看实时日志？**
```bash
docker compose logs -f openclaw-office
# 或
docker logs -f openclaw-office
```
