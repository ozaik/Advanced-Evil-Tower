# Contributing to Remote Browser System

Thank you for considering contributing to the Remote Browser System! This document provides guidelines for contributing to the project.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Docker logs if applicable
- Your environment (OS, Docker version, etc.)

### Suggesting Features

Feature requests are welcome! Please open an issue with:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/remote-browser-system.git
   cd remote-browser-system
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**
   ```bash
   # Rebuild affected services
   docker-compose build
   
   # Test the system
   docker-compose up -d
   
   # Verify functionality
   curl http://localhost:8080/api/remote-browser/sessions
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for code refactoring
   - `test:` for tests
   - `chore:` for maintenance

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Open a Pull Request**
   - Provide clear description
   - Reference related issues
   - Include screenshots if UI changes

## 🏗️ Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### Local Development

```bash
# Clone the repo
git clone https://github.com/yourusername/remote-browser-system.git
cd remote-browser-system

# Start services
docker-compose up -d

# For web development (hot reload)
cd web
npm install
npm run dev

# Access the application
open http://localhost:8080
```

### Project Structure

```
browserbox/     # Browser container (Playwright + noVNC)
gateway/        # Container orchestration service
web/            # Next.js frontend application
nginx/          # Reverse proxy configuration
```

## 📝 Code Style

### TypeScript/JavaScript
- Use TypeScript for new code
- Follow existing patterns
- Use meaningful variable names
- Add JSDoc comments for public APIs

### Docker
- Use multi-stage builds when possible
- Minimize layer count
- Add health checks
- Use specific version tags

### Commits
- Write clear commit messages
- One logical change per commit
- Reference issues when applicable

## 🧪 Testing

Before submitting:
- [ ] Services build without errors
- [ ] Browser sessions can be created
- [ ] noVNC displays correctly
- [ ] Admin dashboard loads
- [ ] No console errors

## 📚 Documentation

Update documentation for:
- New features
- API changes
- Configuration options
- Breaking changes

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

Feel free to open an issue for questions or discussion!
