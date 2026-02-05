---
id: demo-scripts-en
title: Demo Scripts Guide (English)
sidebar_label: Demo Scripts (English)
slug: /demo-scripts-en
---

# AFS System Demo Scripts Guide (English Version)

## Overview

This guide explains how to use the English version batch files for exporting, importing, and verifying demo data for the AFS System.

## Why English Version?

The original scripts used Chinese characters which caused encoding errors on Windows 10. The English versions avoid this problem completely, making them more reliable and compatible.

## Available Scripts

### 1. export-demo-data-en.bat
**Purpose:** Export MongoDB database data to a compressed backup file

**What it does:**
- Checks if Docker is running
- Checks MongoDB container status
- Exports afs_db database
- Creates afs-demo-backup.tar.gz file

**When to use:**
- Before preparing for presentation
- After making changes to demo data
- When you need to transfer data to another computer

**Output:**
```
afs-demo-backup.tar.gz
```

**File size:** Typically 10-200MB (depends on data amount)

---

### 2. import-demo-data-en.bat
**Purpose:** Import demo data from backup file to database

**What it does:**
- Checks Docker and MongoDB status
- Extracts backup file
- Imports data to MongoDB database
- Verifies import success

**When to use:**
- On presentation computer after setup
- After transferring project and backup file
- When you need to restore demo data

**Input:**
```
afs-demo-backup.tar.gz
```

**Usage:**
```batch
import-demo-data-en.bat
```

---

### 3. verify-backup-en.bat
**Purpose:** Verify backup file integrity

**What it does:**
- Checks if backup file exists
- Verifies file can be extracted
- Checks data content
- Reports backup status

**When to use:**
- After creating backup
- Before transferring to portable drive
- On presentation computer before importing

**Output:**
```
File size: XXXXX bytes
Approx. XX MB
File is valid
```

---

### 4. test-demo-functionality-en.bat
**Purpose:** Automated functionality testing

**What it does:**
- Tests 10 system components
- Reports pass/fail status
- Provides summary of all tests

**What it tests:**
1. Docker service
2. MongoDB container
3. Database connection
4. Database collections
5. User data
6. Answer data
7. Question data
8. Web service accessibility
9. API service accessibility
10. Demo environment integrity

**When to use:**
- Before presentation
- After system setup
- After data import
- When troubleshooting issues

---

## Workflow: Complete Demo Preparation

### Phase 1: On Your Development Computer (Before Presentation)

**Step 1: Ensure System is Running**
```batch
docker-compose up -d
docker ps
```

**Step 2: Export Demo Data**
```batch
scripts/export-demo-data-en.bat
```

Output: `afs-demo-backup.tar.gz`

**Step 3: Verify Backup**
```batch
scripts/verify-backup-en.bat
```

**Step 4: Run Functionality Test**
```batch
scripts/test-demo-functionality-en.bat
```

All 10 tests should pass.

**Step 5: Copy to Portable Drive**

Copy these files to your portable drive (1TB drive):
```
Portable Drive/
├── AFS-System/                    (Entire project directory)
└── afs-demo-backup.tar.gz          (Demo data backup)
```

---

### Phase 2: On Presentation Computer (At School/Demo Location)

**Step 1: Copy Project to Computer**
```
From Portable Drive ->
To: C:\AFS-System\
```

**Step 2: Copy Backup File**
```
From Portable Drive ->
To: C:\AFS-System\
```

**Step 3: Check Docker**
```batch
docker --version
docker ps
```

If Docker is not running, start Docker Desktop.

**Step 4: Start System**
```batch
cd C:\AFS-System
docker-compose up -d
```

Wait 1-2 minutes for all services to start.

**Step 5: Import Demo Data**
```batch
scripts\import-demo-data-en.bat
```

**Step 6: Verify System**
```batch
scripts\test-demo-functionality-en.bat
```

All 10 tests should pass.

**Step 7: Access System**
Open browser: http://localhost:8080

---

### Phase 3: Presentation Setup (Final Check)

**Test Critical Functions:**

1. **User Login**
   - Visit: http://localhost:8080/login.html
   - Test with registered credentials

2. **Question Answering**
   - Visit: http://localhost:8080/answer-questions.html
   - Verify imported answers are displayed

3. **Progress Display**
   - Check if layer selector works
   - Verify progress bars update correctly

4. **Submit Function**
   - Use floating submit button
   - Test data persistence

---

## Troubleshooting

### Script Fails: "docker is not recognized"

**Cause:** Docker not in PATH

**Solution:**
1. Open Docker Desktop
2. Wait for Docker to fully start
3. Close and reopen CMD/PowerShell
4. Try script again

---

### Script Fails: "MongoDB container is not running"

**Cause:** MongoDB container failed to start

**Solution:**
```batch
docker-compose up -d mongoserver
docker-compose ps
```

Check all containers show "Up" status.

---

### Backup File Not Found

**Cause:** Export script was not run or file is in wrong location

**Solution:**
1. Check if afs-demo-backup.tar.gz exists in project root
2. If not, run export-demo-data-en.bat

---

### Import Shows Corrupted File

**Cause:** Backup file was corrupted during transfer

**Solution:**
1. Verify backup file with verify-backup-en.bat
2. If corrupted, re-export on original computer
3. Transfer again using copy (not sync)

---

### Tests Fail on Web Service

**Cause:** Web service not responding

**Solution:**
```batch
docker-compose restart client
docker-compose logs client
```

---

### Tests Fail on API Service

**Cause:** Server not responding

**Solution:**
```batch
docker-compose restart server
docker-compose logs server
```

---

## File Format Details

All English scripts use:
- **File Encoding:** ASCII (only English characters)
- **Line Endings:** CRLF (Windows format)
- **Purpose:** Maximum compatibility with Windows 10

This ensures the scripts will run correctly when:
- Double-clicked in File Explorer
- Run from CMD
- Run from PowerShell
- Run from any other Windows environment

---

## Comparison: English vs. Chinese Scripts

| Feature | English Scripts | Chinese Scripts |
|---------|----------------|----------------|
| Encoding | ASCII | UTF-8 |
| Compatibility | 100% (Windows 10) | May fail (encodings issues) |
| Ease of Use | Simple (no encoding issues) | Complex (chcp 65001 needed) |
| Debugging | Easy (English logs) | Hard (Chinese may garble) |
| Maintenance | Low (no special characters) | High (requires care) |

---

## Advanced Usage

### Export Specific Collections Only

If you only need certain data, modify export-demo-data-en.bat:

```batch
docker exec afs-system-mongoserver-1 mongodump ^
  --db afs_db ^
  --collection users ^
  --collection answers ^
  --out /tmp/afs-demo-backup ^
  --quiet
```

### Skip Clear Existing Data

When running import-demo-data-en.bat, if you want to keep existing data:

```batch
choice /C N /M "Clear existing database [Y/N]?"
```

Or modify the script to skip that step.

### Custom Output Location

To export to a different location, modify the export path:

```batch
docker cp afs-system-mongoserver-1:/tmp/afs-demo-backup ./custom-location/
```

---

## Security Notes

### After Presentation

**IMPORTANT:** Clean up demo data to protect user privacy

```batch
# Stop all containers
docker-compose down

# Remove volumes with data
docker-compose down -v

# Delete project files
rmdir /s /q C:\AFS-System

# Remove backup from portable drive
```

### Data Privacy

The afs-demo-backup.tar.gz file contains:
- User accounts with credentials
- Personal answers to questions
- User profile information

**Never commit this file to Git.**
**Always delete it after demo is complete.**

---

## Checklist

### Pre-Demo Checklist

- [ ] System is running (docker-compose up -d)
- [ ] All containers are up (docker-compose ps)
- [ ] Export script completed successfully
- [ ] Backup verified with verify-backup-en.bat
- [ ] All 10 function tests passed
- [ ] Portable drive has afs-demo-backup.tar.gz
- [ ] Portable drive has AFS-System/ project

### On-Site Checklist

- [ ] Project copied to C:\AFS-System\
- [ ] Backup file copied to C:\AFS-System\
- [ ] Docker Desktop is running
- [ ] System started (docker-compose up -d)
- [ ] Data imported successfully
- [ ] All 10 function tests passed
- [ ] Browser can access http://localhost:8080
- [ ] User login works
- [ ] Question answers are displayed

### Post-Demo Checklist

- [ ] System shut down (docker-compose down)
- [ ] Volumes removed (docker-compose down -v)
- [ ] Project files deleted (rmdir /s /q C:\AFS-System)
- [ ] Portable drive backup deleted
- [ ] Docker cleaned (docker system prune -a)

---

## Quick Reference Commands

### Export
```batch
cd F:\FPY\AFS-System
scripts\export-demo-data-en.bat
```

### Import
```batch
cd F:\FPY\AFS-System
scripts\import-demo-data-en.bat
```

### Verify
```batch
cd F:\FPY\AFS-System
scripts\verify-backup-en.bat
```

### Test
```batch
cd F:\FPY\AFS-System
scripts\test-demo-functionality-en.bat
```

---

## Need Help?

### Log Files

If you encounter issues, check these logs:
```batch
docker logs afs-system-mongoserver-1
docker logs afs-system-server-1
docker logs afs-system-client-1
```

### Common Port Conflicts

If ports are occupied, modify docker-compose.yml:
- Client: 8080 → 8888
- Server: 3001 → 3333
- MongoDB: 27018 → 27019

---

**Version:** 1.0  
**Date:** February 1, 2026  
**System:** Windows 10 + Docker Desktop