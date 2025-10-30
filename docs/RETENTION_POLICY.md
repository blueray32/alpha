# Memory Retention Policy

## Overview

Alpha implements automatic memory cleanup to prevent unbounded disk usage. The retention policy system manages:

- **Conversation history** - User/agent dialogue stored in `memory/conversations/`
- **Recovery checkpoints** - Orchestration state snapshots in `memory/checkpoints/`
- **Outcome ledger** - Historical orchestration results in `ledger/outcomes.json`

## Configuration

### Environment Variables

Create or update your `.env` file with retention periods (in days):

```bash
# Memory retention (days)
CONVERSATION_RETENTION_DAYS=30
CHECKPOINT_RETENTION_DAYS=7
OUTCOME_RETENTION_DAYS=90

# Ledger size limits (optional)
MAX_LEDGER_SIZE_MB=100
MAX_CHECKPOINTS=1000
```

### Default Values

If not specified, the following defaults are used:

- **Conversations:** 30 days
- **Checkpoints:** 7 days
- **Outcomes:** 90 days

## Manual Cleanup

### Run Cleanup Script

```bash
npm run cleanup:memory
```

### Example Output

```
=== Memory Cleanup Starting ===
Retention policies:
  - Conversations: 30 days
  - Checkpoints: 7 days
  - Outcomes: 90 days

Alpha: Deleted 15 conversation(s) older than 30 days
Forge: Deleted 8 conversation(s) older than 30 days
Blink: Deleted 3 conversation(s) older than 30 days
QA-Lens: Deleted 12 conversation(s) older than 30 days
Cleared 45 checkpoint(s) older than 7 days
Outcome ledger size: 12.34 MB

=== Cleanup Complete ===
Total items removed:
  - Conversations: 38
  - Checkpoints: 45
  - Outcomes: 0
Disk usage:
  - Before: 145.67 MB
  - After: 98.23 MB
  - Freed: 47.44 MB
```

## Automated Cleanup

### Cron Setup (Unix/Linux/macOS)

1. Open crontab editor:
```bash
crontab -e
```

2. Add daily cleanup at 2 AM:
```bash
0 2 * * * cd /path/to/alpha && npm run cleanup:memory >> /tmp/alpha-cleanup.log 2>&1
```

3. Alternative schedules:

```bash
# Run every 12 hours
0 */12 * * * cd /path/to/alpha && npm run cleanup:memory

# Run weekly on Sunday at 3 AM
0 3 * * 0 cd /path/to/alpha && npm run cleanup:memory

# Run daily at midnight
0 0 * * * cd /path/to/alpha && npm run cleanup:memory
```

### Systemd Timer (Linux)

**Create service:** `/etc/systemd/system/alpha-cleanup.service`
```ini
[Unit]
Description=Alpha Memory Cleanup
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/alpha
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run cleanup:memory
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Create timer:** `/etc/systemd/system/alpha-cleanup.timer`
```ini
[Unit]
Description=Run Alpha Memory Cleanup Daily
Requires=alpha-cleanup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable alpha-cleanup.timer
sudo systemctl start alpha-cleanup.timer

# Check timer status
sudo systemctl status alpha-cleanup.timer

# View logs
sudo journalctl -u alpha-cleanup.service
```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task → "Alpha Memory Cleanup"
3. Trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `node`
   - Arguments: `--loader tsx scripts/cleanup-memory.ts`
   - Start in: `C:\path\to\alpha`
5. Settings:
   - Run whether user is logged on or not
   - Run with highest privileges

### Docker/Docker Compose

Add a cleanup service to your `docker-compose.yml`:

```yaml
services:
  alpha-cleanup:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: sh -c "while true; do npm run cleanup:memory && sleep 86400; done"
    environment:
      - CONVERSATION_RETENTION_DAYS=30
      - CHECKPOINT_RETENTION_DAYS=7
      - OUTCOME_RETENTION_DAYS=90
    restart: unless-stopped
```

Or use a cron container:

```yaml
services:
  alpha-cron:
    image: alpine:latest
    working_dir: /app
    volumes:
      - ./:/app
    command: >
      sh -c "echo '0 2 * * * cd /app && npm run cleanup:memory' | crontab - && crond -f"
    restart: unless-stopped
```

## Monitoring Cleanup

### Check Disk Usage

```bash
# Memory directories
du -sh memory/conversations/*
du -sh memory/checkpoints
du -sh ledger

# Total memory usage
du -sh memory ledger
```

### Cleanup Logs

View recent cleanup runs:

```bash
# If using cron
tail -f /tmp/alpha-cleanup.log

# If using systemd
sudo journalctl -u alpha-cleanup.service -f

# Check last run time
ls -lt memory/conversations/
```

### Health Check Script

Create a simple health check:

```bash
#!/bin/bash
# Check if memory directories are growing too large

MAX_SIZE_MB=500
CURRENT_SIZE=$(du -sm memory ledger | awk '{sum+=$1} END {print sum}')

if [ "$CURRENT_SIZE" -gt "$MAX_SIZE_MB" ]; then
  echo "WARNING: Memory usage at ${CURRENT_SIZE}MB exceeds ${MAX_SIZE_MB}MB limit"
  exit 1
fi

echo "Memory usage OK: ${CURRENT_SIZE}MB"
```

## Retention Policy Guidelines

### Recommended Settings

| Environment | Conversations | Checkpoints | Outcomes |
|-------------|--------------|-------------|----------|
| Development | 7 days | 1 day | 30 days |
| Staging | 14 days | 3 days | 60 days |
| Production | 30-90 days | 7 days | 90-180 days |

### Considerations

**Conversations:**
- Keep longer for debugging and analysis
- Consider user privacy and compliance requirements
- Archive important conversations before deletion

**Checkpoints:**
- Short retention - only for crash recovery
- Active orchestrations need their checkpoints
- Cleared checkpoints can't be resumed

**Outcomes:**
- Longest retention for metrics and trends
- Essential for debugging patterns over time
- Can be exported before cleanup

## Advanced: Archival Strategy

Before cleanup, export important data:

```bash
# Archive conversations older than 60 days but keep a backup
ARCHIVE_DATE=$(date -d '60 days ago' +%Y-%m-%d)
tar -czf "conversations-archive-${ARCHIVE_DATE}.tar.gz" \
  memory/conversations/

# Archive outcomes to separate storage
cp ledger/outcomes.json "archives/outcomes-$(date +%Y-%m-%d).json"

# Then run cleanup
npm run cleanup:memory
```

## Troubleshooting

### Cleanup Not Running

```bash
# Test script manually
npm run cleanup:memory

# Check cron is running
pgrep cron

# View cron logs
grep CRON /var/log/syslog

# Verify crontab entry
crontab -l
```

### Out of Disk Space

Emergency cleanup with aggressive retention:

```bash
CONVERSATION_RETENTION_DAYS=1 \
CHECKPOINT_RETENTION_DAYS=1 \
npm run cleanup:memory
```

### Script Errors

Check file permissions:

```bash
# Ensure directories are writable
chmod -R u+w memory/ ledger/

# Check script permissions
chmod +x scripts/cleanup-memory.ts
```

## See Also

- [Conversation Memory](../src/lib/conversation-memory.ts) - Memory persistence implementation
- [Recovery Hooks](../src/lib/recovery-hooks.ts) - Checkpoint management
- [Outcome Ledger](../src/lib/outcome-ledger.ts) - Observability system
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md) - Full deployment checklist

---

**Last Updated:** 2025-10-30
**Version:** 1.0.0
