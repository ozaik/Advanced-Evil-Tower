# Remote Browser System

[![Docker Build](https://github.com/ozaik/Advanced-remote-browser/workflows/Docker%20Build/badge.svg)](https://github.com/ozaik/Advanced-remote-browser/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Required-blue.svg)](https://www.docker.com/)

A containerized remote browser solution that provides isolated, stealth-configured browser sessions accessible via noVNC. Each user gets their own Chromium instance running in Docker, accessible through a web interface.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User's Browser                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    nginx (Port 8080)                         │
│                     Reverse Proxy                            │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──→ Next.js Web App (Port 3000)
             │    • UI & API Routes
             │    • Session Management
             │
             ├──→ Gateway Service
             │    • Container Orchestration
             │    • Session Creation/Deletion
             │
             └──→ Browser Containers (browser-{sid})
                  • Chromium + Playwright
                  • noVNC (Port 6080)
                  • Stealth Configuration
```

## 📦 Components

### 1. **BrowserBox** (`browserbox/`)
- Playwright-controlled Chromium browser
- Stealth configuration to bypass bot detection
- noVNC for remote desktop access
- Each session runs in isolated Docker container

### 2. **Gateway** (`gateway/`)
- Orchestrates browser container lifecycle
- Creates/destroys containers on demand
- Health monitoring and session management
- SQLite database for session persistence

### 3. **Web Application** (`web/`)
- Next.js 14 frontend
- Browser viewer with noVNC iframe
- Admin dashboard for session monitoring
- RESTful API for session control

### 4. **Nginx** (`nginx/`)
- Reverse proxy on port 8080
- Routes traffic to appropriate services
- Load balancing and SSL termination ready

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for development)
- 4GB+ RAM recommended

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ozaik/Advanced-remote-browser.git
cd Advanced-remote-browser
```

2. **Configure environment (optional)**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env to customize settings (optional for local dev)
# Change secrets if exposing beyond localhost
```

3. **Start the services**
```bash
docker-compose up -d
```

4. **Access the application**
```
Main App: http://localhost:8080
Admin Dashboard: http://localhost:8080/admin
```

### Create a Browser Session

**Via API:**
```bash
curl -X POST http://localhost:8080/api/remote-browser/session \
  -H "Content-Type: application/json" \
  -d '{
    "allowlist_hosts": "google.com,github.com",
    "start_url": "https://google.com"
  }'
```

**Response:**
```json
{
  "sid": "abc123xyz",
  "containerName": "browser-abc123xyz",
  "iframeUrl": "http://localhost:8080/s/abc123xyz/"
}
```

**Via Web Interface:**
- Navigate to `http://localhost:8080`
- Click "Create Session"
- Configure allowlist and start URL
- View browser in embedded noVNC iframe

### Admin Dashboard

Access the admin panel at `http://localhost:8080/admin` to:
- **View all active sessions** - See real-time list of running browser containers with auto-refresh every 5 seconds
- **Monitor session details** - Container name, session ID, allowlist hosts, start URL, creation time
- **Authentication status** - Track Google, Microsoft, and Facebook login status for each session
- **Open sessions** - Click "Open Session" to view any active browser in a new tab
- **Manage sessions** - Delete individual sessions or bulk delete all sessions
- **Custom settings** - Configure default start URL and allowlist hosts for new sessions
- **Session analytics** - View session duration and last accessed time

## 📡 API Reference

### Session Management

#### Create Session
```http
POST /api/remote-browser/session
Content-Type: application/json

{
  "allowlist_hosts": "example.com",
  "start_url": "https://example.com"
}
```

#### List Sessions
```http
GET /api/remote-browser/sessions
```

#### Get Session Details
```http
GET /api/remote-browser/sessions/{sid}
```

#### Delete Session
```http
DELETE /api/remote-browser/sessions/{sid}
```

#### Check Auth Status
```http
GET /api/remote-browser/session/{sid}/auth-status
```

#### Update Session URL
```http
POST /api/remote-browser/session/{sid}/url
Content-Type: application/json

{
  "url": "https://newsite.com"
}
```

#### Health Check
```http
GET /api/remote-browser/session/{sid}/health
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Gateway Configuration
GATEWAY_PORT=3001
DB_PATH=/data/sessions.db

# BrowserBox Configuration
BROWSERBOX_IMAGE=browserbox:latest
BROWSER_NETWORK=remote-browser-next-local_default

# Web Application
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Docker Compose

The `docker-compose.yml` defines the services. Key configurations:

- **nginx**: Port 8080 exposed
- **web**: Next.js app, port 3000 internal
- **gateway**: Container orchestration, port 3001 internal
- **browserbox**: Base image for browser containers

### BrowserBox Stealth Features

The browser is configured with:
- Custom user-agent (realistic Chrome profile)
- `--disable-automation` flag
- `--exclude-switches=enable-automation`
- `--disable-blink-features=AutomationControlled`
- Navigator properties override (webdriver, plugins, languages)
- `--app` mode (hides tabs and URL bar)

## 🛠️ Development

### Project Structure

```
.
├── browserbox/          # Browser container with Playwright
│   ├── Dockerfile
│   ├── server.js        # Playwright automation + stealth
│   ├── start.sh         # Container entrypoint
│   └── package.json
│
├── gateway/             # Container orchestration service
│   ├── Dockerfile
│   ├── index.js         # Express API + Docker SDK
│   ├── db.js            # SQLite session storage
│   └── package.json
│
├── web/                 # Next.js frontend
│   ├── Dockerfile
│   ├── next.config.mjs
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Home page
│   │   │   ├── browser/          # Browser viewer
│   │   │   ├── admin/            # Admin dashboard
│   │   │   └── api/              # API routes
│   │   └── middleware.ts
│   └── package.json
│
├── nginx/
│   └── default.conf     # Reverse proxy config
│
└── docker-compose.yml   # Service orchestration
```

### Running Locally

**Development mode with hot reload:**

```bash
# Terminal 1: Start infrastructure
docker-compose up nginx gateway

# Terminal 2: Run Next.js in dev mode
cd web
npm install
npm run dev

# Terminal 3: Test browser creation
cd browserbox
npm install
node server.js
```

### Building Images

```bash
# Build specific service
docker-compose build web

# Build all services
docker-compose build

# Build without cache
docker-compose build --no-cache
```

## 🐛 Debugging

### Check Service Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker logs remote-browser-next-local-gateway-1 --tail 50

# Specific browser container
docker logs browser-abc123xyz --tail 50
```

### Inspect Running Sessions
```bash
# List active sessions
curl -s http://localhost:8080/api/remote-browser/sessions | jq

# Check specific session
curl -s http://localhost:8080/api/remote-browser/sessions/{sid} | jq

# View browser container
docker exec -it browser-{sid} bash
```

### Common Issues

**Session returns 404:**
- Check if browser container is running: `docker ps | grep browser-`
- Check gateway logs: `docker logs remote-browser-next-local-gateway-1`
- Verify Docker network: `docker network inspect remote-browser-next-local_default`

**noVNC not loading:**
- Verify port 6080 is exposed in browser container
- Check if x11vnc is running inside container
- Test direct access: `http://localhost:6080/vnc.html`

**Container creation fails:**
- Check Docker socket access: `docker info`
- Verify gateway has permission to spawn containers
- Check available disk space and memory

## 🔒 Security Considerations

- **Isolation**: Each session runs in separate container
- **Allowlist**: Restrict accessible domains per session
- **Network**: Browser containers on isolated Docker network
- **Cleanup**: Implement session timeout and cleanup policies
- **Authentication**: Add user authentication before production use

## 📊 Monitoring

### Admin Dashboard

Access at `http://localhost:8080/admin`:
- View all active sessions
- Monitor container health
- Track resource usage
- Terminate sessions

### Metrics

Monitor via Docker:
```bash
# Container stats
docker stats

# Specific session
docker stats browser-{sid}
```

## 🚢 Deployment

### Production Recommendations

1. **Add authentication** (JWT, OAuth)
2. **Enable HTTPS** (Let's Encrypt with nginx)
3. **Set resource limits** (CPU/memory per container)
4. **Implement session timeouts** (auto-cleanup)
5. **Add rate limiting** (prevent abuse)
6. **Configure log aggregation** (ELK, Loki)
7. **Set up monitoring** (Prometheus, Grafana)

### Docker Compose Production

```yaml
version: '3.8'
services:
  browserbox:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- How to report bugs
- How to suggest features  
- How to submit pull requests
- Code style guidelines
- Development setup

Quick start:
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) - Browser automation
- [noVNC](https://novnc.com/) - VNC client using HTML5
- [Next.js](https://nextjs.org/) - React framework
- [Docker](https://www.docker.com/) - Containerization

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review Docker logs for troubleshooting
