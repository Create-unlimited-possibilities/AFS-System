# Answer Relation Migration Scripts

## Overview

These scripts migrate Answer records from the old `relationshipType` field to the new `assistRelationId` and `specificRelation` fields.

## Files

### migrate-answer-relation-dry-run.js
A dry-run script that analyzes the current state of Answer records and previews what will be migrated without making any changes.

**Usage:**
```bash
cd server
node scripts/migrate-answer-relation-dry-run.js
```

**Output:**
- Total answers count
- Breakdown by type (self/assist)
- Number of answers needing migration
- Preview of first 10 answers that will be updated
- Orphan detection (answers without matching AssistRelation)

### migrate-answer-relation.js
The actual migration script that updates Answer records.

**Usage:**
```bash
cd server
node scripts/migrate-answer-relation.js
```

**Features:**
- Creates a timestamped backup before migration
- Processes answers in batches (100 per batch)
- Handles self answers (sets `assistRelationId = null`, `specificRelation = ''`)
- Handles assist answers (links to AssistRelation)
- Identifies and reports orphan records
- Idempotent (can be run multiple times safely)
- Provides detailed statistics

**Output:**
- Backup location
- Processing progress
- Migration summary with statistics
- Orphan report (if any)

## Migration Logic

### Self Answers (`isSelfAnswer: true`)
- Set `assistRelationId = null`
- Set `specificRelation = ''`

### Assist Answers (`isSelfAnswer: false`)
- Find corresponding `AssistRelation` where:
  - `assistantId = answer.userId`
  - `targetId = answer.targetUserId`
  - `isActive = true`
- If found:
  - Set `assistRelationId = relation._id`
  - Set `specificRelation = relation.specificRelation`
- If not found:
  - Mark as orphan
  - Log to orphan-records.json

## Backup

Backups are created in `server/backups/answer-relation-migration-{timestamp}/`:
- `answers-backup.json`: Complete backup of all Answer records before migration
- `orphan-records.json`: List of orphan records (if any)

## Recovery

If needed, restore from backup:
```bash
# Restore from a specific backup
node -e "import('./restore-backup.js').then(m => m.restore('backup-timestamp'))"
```

Or use MongoDB's mongorestore command if you have MongoDB dumps.

## Testing

Run dry-run first to preview:
```bash
node scripts/migrate-answer-relation-dry-run.js
```

Verify the output looks correct, then run the actual migration.

## Idempotency

The migration is idempotent - running it multiple times will:
- Skip already-migrated records
- Only update records that need migration
- Create a new backup each time

## Orphan Records

Orphan records are assist answers without a matching AssistRelation. These are:
- Logged to the orphan-records.json file
- Listed in the migration summary
- Not updated (they remain in their current state)

These may need manual review to determine if:
- The AssistRelation was deleted
- The Answer is invalid
- A new AssistRelation should be created
