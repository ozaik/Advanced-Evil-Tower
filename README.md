# Remote Browser System

[![Docker Build](https://github.com/ozaik/Advanced-remote-browser/workflows/Docker%20Build/badge.svg)](https://github.com/ozaik/Advanced-remote-browser/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Required-blue.svg)](https://www.docker.com/)

> ⚠️ **EDUCATIONAL PURPOSE ONLY**: This project is designed for educational and research purposes. Administrator access to user browser sessions could be misused for malicious purposes such as credential theft or data interception. Users must be informed that their browser activity may be monitored. Only deploy this in controlled environments where users provide explicit consent. Unauthorized interception of user sessions may violate privacy laws.

A containerized remote browser solution that provides isolated, stealth-configured browser sessions accessible via noVNC. Each user gets their own Chromium instance running in Docker, accessible through a web interface.

## ✨ Key Features

- **🖥️ Isolated Browser Sessions** - Each user gets a dedicated Chromium instance in Docker
- **🔒 Stealth Configuration** - Bypass bot detection with custom user-agent and automation flags
- **🌐 noVNC Access** - Remote desktop access to browser without plugins
- **📱 WiFi Captive Portal** - Can be deployed as a WiFi hotspot login portal
- **🔐 OAuth Integration** - Pre-configured for Google, Microsoft, and Facebook authentication
- **📊 Admin Dashboard** - Monitor and manage all active sessions
- **👁️ Session Monitoring** - Administrators can view and interact with any active browser session
- **🎯 Domain Allowlist** - Restrict browsing to specific domains per session
- **🐳 Docker-Based** - Easy deployment and scaling

## 🎯 Use Cases

### 1. WiFi Captive Portal
Deploy as a WiFi hotspot authentication system:
- Users connect to open WiFi network
- Automatic redirect to login page
- Authenticate via Google/Microsoft/Facebook in isolated browser
- Grant internet access upon successful authentication
- Monitor authenticated users via admin dashboard
- **⚠️ Admin can access user sessions**: Administrators can view any active browser session through the admin panel, including after authentication. This allows monitoring of user activity but raises significant privacy concerns.

### 2. Remote Browser Access
Provide controlled browser access:
- Corporate environments with restricted browsing
- Shared devices in libraries or kiosks
- Development/testing environments
- Bot detection testing and research

### ⚠️ Security & Privacy Warnings

**Administrator Access to User Sessions:**
- Admins can click "Open Session" in the dashboard to view any user's browser in real-time
- This includes viewing authenticated sessions (Google, Facebook, Microsoft accounts)
- Browser activity, credentials, and personal data are potentially visible to administrators
- Cookies and session tokens can be intercepted

**Potential Misuse:**
- Session hijacking and credential theft
- Privacy violation and unauthorized surveillance
- Man-in-the-middle attacks on user authentication
- Interception of sensitive personal information

**Legal Considerations:**
- Users MUST be informed that their sessions may be monitored
- Explicit consent is required in most jurisdictions
- May violate GDPR, CCPA, and other privacy regulations if misused
- Unauthorized access to user sessions may constitute a criminal offense

**Recommended Use:**
- Educational environments with explicit consent
- Security research and penetration testing (authorized only)
- Controlled testing environments
- Development and debugging purposes

**NOT recommended for:**
- Public WiFi without clear privacy warnings
- Production environments handling real user data
- Any scenario without explicit user consent

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

Access the admin panel at `http://localhost:8080/admin`:

**🔒 Login Required:**
- Default password: `admin123`
- Change via environment variable: `ADMIN_PASSWORD=your_secure_password`
- Sessions persist for 24 hours

**Features:**
- **View all active sessions** - See real-time list of running browser containers with auto-refresh every 5 seconds
- **Monitor session details** - Container name, session ID, allowlist hosts, start URL, creation time
- **Authentication status** - Track Google, Microsoft, and Facebook login status for each session
- **⚠️ Open sessions** - Click "Open Session" to view any active browser in a new tab, including authenticated sessions
- **Manage sessions** - Delete individual sessions or bulk delete all sessions
- **Custom settings** - Configure default start URL and allowlist hosts for new sessions
- **Session analytics** - View session duration and last accessed time

> **Privacy Warning**: The "Open Session" feature allows administrators to access users' authenticated browser sessions in real-time. This provides complete visibility into user activity, including logged-in accounts and personal data. This feature is intended for educational purposes and security research only.

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
- **WiFi Portal**: When used as captive portal, ensure proper firewall rules and network isolation

## 🌐 WiFi Captive Portal Setup

To deploy as a WiFi hotspot authentication system:

### Prerequisites
- Raspberry Pi or Linux server with WiFi capability
- `hostapd` for access point
- `dnsmasq` for DNS/DHCP
- `iptables` for network routing

### Quick Setup (Linux)
```bash
# 1. Configure WiFi access point (hostapd)
sudo nano /etc/hostapd/hostapd.conf
# Set: interface=wlan0, ssid=YourWiFi, wpa=0 (open network)

# 2. Configure DNS/DHCP (dnsmasq)
sudo nano /etc/dnsmasq.conf
# Add: address=/#/192.168.4.1 (redirect all DNS to gateway)

# 3. Configure network interface
sudo ip addr add 192.168.4.1/24 dev wlan0

# 4. Enable IP forwarding and NAT
sudo sysctl -w net.ipv4.ip_forward=1
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 443 -j REDIRECT --to-port 8080

# 5. Start services
sudo systemctl start hostapd dnsmasq
docker-compose up -d
```

### Captive Portal Flow
1. User connects to open WiFi network
2. Device attempts to access internet
3. DNS redirects all requests to portal (192.168.4.1:8080)
4. User sees `/wifi-login` page
5. User authenticates via Google/Microsoft/Facebook in isolated browser
6. System detects successful authentication via `/api/remote-browser/session/{sid}/auth-status`
7. User's MAC address added to authenticated list
8. User granted internet access through NAT

### Nginx Configuration for Portal Detection
Add to `nginx/default.conf`:
```nginx
# Captive portal detection endpoints
location /generate_204 { return 302 http://192.168.4.1:8080/wifi-login; }
location /hotspot-detect.html { return 302 http://192.168.4.1:8080/wifi-login; }
location /ncsi.txt { return 302 http://192.168.4.1:8080/wifi-login; }
location /connecttest.txt { return 302 http://192.168.4.1:8080/wifi-login; }
```

This triggers the automatic "Sign in to network" pop-up on phones and laptops.

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
