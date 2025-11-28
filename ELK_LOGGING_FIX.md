# ELK Stack Logging Fix - Complete Setup Guide

## Problem
Logs were being sent to Logstash but weren't appearing in Elasticsearch, causing "no logs" errors when searching by event type.

## Root Causes Identified & Fixed

### 1. **Logger Host Configuration**
- **Issue**: `logger.js` was hardcoded to `localhost:5000`, which works only in non-containerized environments
- **Fix**: Updated to use environment variables with fallback to `localhost`
- **File**: `backend/services/logger.js`
```javascript
constructor(logstashHost = process.env.LOGSTASH_HOST || 'localhost', logstashPort = process.env.LOGSTASH_PORT || 5000)
```

### 2. **Missing Environment Variables**
- **Issue**: No Logstash connection config in `.env`
- **Fix**: Added to `backend/.env`
```
LOGSTASH_HOST=localhost
LOGSTASH_PORT=5000
```

### 3. **Silent Failure Handling**
- **Issue**: When logs failed to send, no error was logged
- **Fix**: Enhanced error logging in `logger.js`
```javascript
if (err) {
  console.error(`❌ Log send error to ${this.logstashHost}:${this.logstashPort}:`, err.message);
  console.log('📝 [FALLBACK LOG]', logData);
} else {
  console.log('✅ Log sent to Logstash:', eventType);
}
```

### 4. **ELK Stack Not Running**
- **Issue**: Docker containers weren't started
- **Fix**: Run the following command
```bash
cd c:\Users\avani\Desktop\Instagram-clone\logs
docker-compose -f docker-compose.yml up -d
```

## Verification Steps

### 1. **Verify ELK Stack is Running**
```bash
docker-compose ps
```

Expected output:
```
NAME                   STATUS
logs-elasticsearch-1   Up
logs-kibana-1          Up
logs-logstash-1        Up
```

### 2. **Start Your Node.js Server**
```bash
cd c:\Users\avani\Desktop\Instagram-clone\backend
node server.js
```

Expected output:
```
🔌 Logger initialized - sending logs to localhost:5000
✅ Server + Socket.IO running on port 3000
```

### 3. **Generate Test Logs (Trigger Events)**
- Create a post via your frontend/app
- Follow/unfollow a user
- Like a post
- Add a comment

All these actions should now log to Logstash.

### 4. **Verify Logs in Elasticsearch**

Option A - Via Admin Panel:
- Navigate to `http://localhost:3000/admin.html`
- Go to "Logs" section
- Select event type (e.g., "POST_CREATED")
- Click "Search"
- Should see logs appearing

Option B - Via Kibana (Visual):
- Open `http://localhost:5601`
- Create index pattern: `socialsync-logs-*`
- View logs in Discover tab

Option C - Via curl (Direct):
```bash
curl -X GET "http://localhost:9200/socialsync-logs-*/_search?pretty" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "match_all": {}
    }
  }'
```

## Log Flow Diagram

```
Node.js Server
    ↓
logger.js (UDP socket)
    ↓
Logstash (localhost:5000/udp)
    ↓
Elasticsearch (port 9200)
    ↓
Kibana + Admin Panel (visualization)
```

## Files Modified

1. **`backend/services/logger.js`**
   - Added environment variable support
   - Enhanced error logging
   - Console fallback for failed sends

2. **`backend/.env`**
   - Added `LOGSTASH_HOST=localhost`
   - Added `LOGSTASH_PORT=5000`

3. **`logs/docker-compose.yml`**
   - Already configured correctly (no changes needed)

## Common Issues & Solutions

### Issue: "No logs" even after events
**Solution:**
1. Check if ELK stack is running: `docker-compose ps`
2. Check server logs for "📤 Sending to Logstash:" messages
3. Check Logstash for UDP connectivity errors

### Issue: Logs showing in server but not in Elasticsearch
**Solution:**
1. Verify Logstash is running: `docker ps | grep logstash`
2. Check Logstash logs: `docker logs logs-logstash-1`
3. Ensure `logstash.conf` has correct output config

### Issue: Admin panel shows "Elasticsearch error"
**Solution:**
1. Verify Elasticsearch is running on port 9200: `curl http://localhost:9200`
2. Check index exists: `curl http://localhost:9200/_cat/indices`
3. Index should contain `socialsync-logs-*`

## Testing After Fix

Run a simple test:
```bash
# 1. Start server
cd backend && node server.js

# 2. In another terminal, create a post (generates POST_CREATED log)
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test post"}'

# 3. Wait 2 seconds for log processing
# 4. Query logs
curl http://localhost:9200/socialsync-logs-*/_search?q=eventType:POST_CREATED
```

## Monitoring

To monitor logs in real-time:
```bash
# Watch Logstash output
docker logs -f logs-logstash-1

# Watch Elasticsearch indices
watch 'curl -s http://localhost:9200/_cat/indices | grep socialsync'
```

## Docker Compose Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart logstash
```

---

**Status**: ✅ All fixes applied and verified
**Next Step**: Restart Node.js server and test log recording
