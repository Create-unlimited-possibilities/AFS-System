---
sidebar_position: 4
---

# Frequently Asked Questions

This document collects common questions and solutions encountered when using AFS System.

## Installation and Deployment

### Q: Docker startup failed, port already in use

**A:** Check port usage and modify configuration:

```bash
# Windows - check port usage
netstat -ano | findstr :3001

# Stop the process occupying the port or modify port mapping in docker-compose.yml
```

### Q: Container exits immediately after startup

**A:** View container logs to troubleshoot:

```bash
# Check status of all containers
docker-compose ps

# View specific container logs
docker-compose logs server
docker-compose logs web
```

Common reasons:
- Environment variable configuration error
- Database connection failed
- Port conflict

### Q: MongoDB data persistence failed

**A:** Confirm volume mount configuration is correct:

```bash
# Check if volumes are created
docker volume ls

# View mongodb_data volume details
docker volume inspect afs-system_mongodb_data

# Confirm mongoserver configuration has correct volume mount
volumes:
  - ./mongoserver/mongodb_data:/data/db
```

## Configuration Issues

### Q: How to change default admin account?

**A:** Edit the following variables in `.env` file:

```bash
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=your-secure-password
ADMIN_INVITE_CODE=your-secure-invite-code
```

Note: After modification, you need to restart the server container, and the already created admin account will not be automatically updated.

### Q: Frontend cannot connect to backend API

**A:** Check the following configurations:

1. Confirm `NEXT_PUBLIC_API_URL` is correct:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

2. Check if backend service is running:
   ```bash
   curl http://localhost:3001/api/health
   ```

3. View Docker network configuration:
   ```bash
   docker network inspect afs-system_afs-network
   ```

### Q: How to switch LLM backend?

**A:** Modify `.env` file:

```bash
# Use local Ollama
LLM_BACKEND=ollama
OLLAMA_BASE_URL=http://modelserver:11434
OLLAMA_MODEL=deepseek-r1:14b

# Use DeepSeek API
LLM_BACKEND=deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_MODEL=deepseek-chat
```

Restart server container after modification:
```bash
docker-compose restart server
```

## AI Model Issues

### Q: Ollama model loading takes too long

**A:** Large models require longer loading time, increase timeout:

```bash
OLLAMA_TIMEOUT=60000  # Increase to 60 seconds
```

Or use a smaller model:
```bash
OLLAMA_MODEL=deepseek-chat:7b
```

### Q: Poor AI response quality

**A:** Try the following optimizations:

1. Adjust temperature parameter:
   ```bash
   LLM_TEMPERATURE=0.7  # Range 0.0-2.0
   ```

2. Switch to a larger model:
   ```bash
   OLLAMA_MODEL=deepseek-r1:14b
   ```

3. Check RAG retrieval configuration:
   - Confirm ChromaDB is running normally
   - Check embedding model configuration

### Q: How to download new Ollama models?

**A:** Enter modelserver container and download:

```bash
# Enter container
docker exec -it afs-system-modelserver-1 bash

# Download model
ollama pull qwen2.5:7b

# Exit container
exit

# Update .env configuration
OLLAMA_MODEL=qwen2.5:7b
```

## Development Issues

### Q: Frontend code changes don't take effect

**A:** Check Docker volume mount configuration:

In `docker-compose.yml` there should be:
```yaml
volumes:
  - ./web/app:/app/app
  - ./web/lib:/app/lib
  - ./web/components:/app/components
```

If still not working, try restarting web container:
```bash
docker-compose restart web
```

### Q: Backend code changes don't take effect

**A:** Nodemon should automatically restart, if not:

1. Check `server/nodemon.json` configuration
2. View server container logs:
   ```bash
   docker-compose logs -f server
   ```
3. Manually restart container:
   ```bash
   docker-compose restart server
   ```

### Q: How to run tests?

**A:** Enter respective directory to execute test commands:

```bash
# Backend tests
docker exec -it afs-system-server-1 npm test

# Frontend tests
docker exec -it afs-system-web-1 npm test
```

## Performance Issues

### Q: Slow system response

**A:** Possible causes and solutions:

1. **Slow database queries**
   - Check MongoDB indexes
   - Use `explain()` to analyze queries

2. **Slow LLM inference**
   - Consider using GPU acceleration
   - Reduce model size
   - Increase `LLM_TIMEOUT`

3. **Network latency**
   - Check Docker network configuration
   - Optimize inter-service communication

### Q: High memory usage

**A:** Optimization recommendations:

1. Limit Docker container resources:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

2. Use smaller models
3. Clean up old ChromaDB data
4. Restart services to free memory

## Data Management

### Q: How to backup MongoDB data?

**A:** Use mongodump tool:

```bash
# Backup to local
docker exec afs-system-mongoserver-1 mongodump --out /data/db/backup

# Copy from container to host
docker cp afs-system-mongoserver-1:/data/db/backup ./mongodb_backup
```

### Q: How to reset system data?

**A:** Warning: This operation will delete all data!

```bash
# Stop all services
docker-compose down

# Delete data volumes
docker volume rm afs-system_mongodb_data
docker volume rm afs-system_chroma_data

# Restart
docker-compose up -d
```

### Q: How to clean ChromaDB data?

**A:** ChromaDB data is stored in `server/storage/chroma_db`:

```bash
# Stop service
docker-compose stop chromaserver

# Delete data
rm -rf server/storage/chroma_db

# Restart service
docker-compose start chromaserver
```

## Browser Issues

### Q: Page displays blank

**A:** Check browser console for errors:

1. Open browser developer tools (F12)
2. Check error messages in Console tab
3. Check request status in Network tab

Common causes:
- JavaScript loading failed
- API request failed
- Route configuration error

### Q: Cannot upload files

**A:** Check the following configurations:

1. File size limit (in server.js):
   ```javascript
   app.use(express.json({ limit: '50mb' }));
   ```

2. Storage directory permissions:
   ```bash
   chmod -R 755 server/storage
   ```

3. Frontend upload configuration

## Security Issues

### Q: How to enable HTTPS?

**A:** Recommended to use reverse proxy (Nginx):

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3002;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
    }
}
```

### Q: How to prevent API abuse?

**A:** Implement rate limiting:

```javascript
// Add in server.js
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requests per user
});

app.use('/api/', limiter);
```

## More Help

If the above questions don't solve your problem, please:

1. Check [GitHub Issues](https://github.com/Create-unlimited-possibilities/AFS-System/issues)
2. Read detailed documentation
3. Submit a new issue with:
   - System environment information
   - Error logs
   - Reproduction steps

## Related Documentation

- [Tech Stack](./tech-stack.md)
- [Environment Variables](./env.md)
- [Configuration Files](./config.md)
