---
sidebar_position: 3
---

# WebSocket API

The AFS System uses Server-Sent Events (SSE) for real-time streaming of AI-generated content. SSE is preferred over WebSocket for this use case because it's simpler for one-way streaming from server to client.

## Server-Sent Events (SSE)

### Connecting to SSE Stream

To connect to an SSE endpoint:

```javascript
const eventSource = new EventSource('/api/rolecard/generate/stream', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};

// Clean up when done
eventSource.close();
```

### SSE Event Types

#### Progress Events

```json
{
  "type": "progress",
  "stage": "generating_core_layer",
  "progress": 45,
  "message": "Generating core personality layer..."
}
```

#### Data Events

```json
{
  "type": "data",
  "content": "Generated content chunk..."
}
```

#### Complete Events

```json
{
  "type": "complete",
  "result": {
    "rolecard": { ... }
  }
}
```

#### Error Events

```json
{
  "type": "error",
  "error": "Error message"
}
```

## SSE Endpoints

### RoleCard Generation Stream

**Endpoint:** `POST /api/rolecard/generate/stream`

Generate a complete role card with real-time progress updates.

**Authentication:** Required

**Request Body:**

```json
{
  "options": {
    "includeCore": true,
    "includeRelations": true
  }
}
```

**Event Flow:**

1. `progress` - Progress updates (0-100%)
2. `data` - Generated content chunks
3. `complete` - Final role card data

**Example Response Stream:**

```javascript
// Progress at 25%
{
  "type": "progress",
  "stage": "analyzing_memories",
  "progress": 25,
  "message": "Analyzing user memories..."
}

// Progress at 50%
{
  "type": "progress",
  "stage": "generating_core_layer",
  "progress": 50,
  "message": "Generating core personality layer..."
}

// Progress at 75%
{
  "type": "progress",
  "stage": "generating_relation_layers",
  "progress": 75,
  "message": "Generating relationship layers..."
}

// Complete
{
  "type": "complete",
  "result": {
    "rolecard": {
      "coreLayer": { ... },
      "relationLayers": [ ... ]
    }
  }
}
```

### Core Layer Generation Stream

**Endpoint:** `POST /api/rolecard/layers/core/stream`

Generate only the core layer of a role card.

**Authentication:** Required

**Event Flow:**

```javascript
// Initial
{
  "type": "progress",
  "stage": "starting",
  "progress": 0
}

// Processing
{
  "type": "progress",
  "stage": "analyzing",
  "progress": 50
}

// Complete
{
  "type": "complete",
  "result": {
    "coreLayer": { ... }
  }
}
```

### Relation Layer Generation Stream

**Endpoint:** `POST /api/rolecard/layers/relation/:relationId/stream`

Generate a specific relationship layer.

**Authentication:** Required

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `relationId` | string | The relationship ID |

**Event Flow:** Similar to core layer generation

### Batch Layer Generation Stream

**Endpoint:** `POST /api/rolecard/layers/batch/stream`

Generate all pending layers in batch.

**Authentication:** Required

**Event Flow:**

```javascript
// Batch start
{
  "type": "batch_start",
  "total": 5,
  "pending": ["core", "relation1", "relation2", "relation3", "relation4"]
}

// Individual layer progress
{
  "type": "layer_progress",
  "layer": "core",
  "progress": 75
}

// Layer complete
{
  "type": "layer_complete",
  "layer": "core"
}

// Batch complete
{
  "type": "batch_complete",
  "result": { ... }
}
```

## Client Implementation Examples

### JavaScript/TypeScript (Browser)

```typescript
class RoleCardStreamClient {
  private eventSource: EventSource | null = null;
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async generateRoleCard(
    options: RoleCardOptions,
    callbacks: {
      onProgress?: (progress: ProgressData) => void;
      onComplete?: (result: RoleCardResult) => void;
      onError?: (error: ErrorData) => void;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Note: Standard EventSource doesn't support custom headers
      // Use token in URL query parameter instead
      const url = `/api/rolecard/generate/stream?token=${encodeURIComponent(this.token)}`;

      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'progress':
            callbacks.onProgress?.(data);
            break;
          case 'complete':
            callbacks.onComplete?.(data.result);
            this.close();
            resolve();
            break;
          case 'error':
            callbacks.onError?.(data);
            this.close();
            reject(new Error(data.error));
            break;
        }
      };

      this.eventSource.onerror = (error) => {
        callbacks.onError?.({ error: 'Connection error' });
        this.close();
        reject(error);
      };
    });
  }

  close(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// Usage
const client = new RoleCardStreamClient(userToken);

await client.generateRoleCard(
  { includeCore: true, includeRelations: true },
  {
    onProgress: (progress) => {
      console.log(`Progress: ${progress.progress}% - ${progress.message}`);
      updateProgressBar(progress.progress);
    },
    onComplete: (result) => {
      console.log('Role card generated:', result.rolecard);
      displayRoleCard(result.rolecard);
    },
    onError: (error) => {
      console.error('Error:', error.error);
      showErrorMessage(error.error);
    }
  }
);
```

### React Hook

```typescript
import { useEffect, useState, useCallback } from 'react';

interface UseSSEOptions {
  url: string;
  token: string;
  enabled?: boolean;
}

function useSSE<T>({ url, token, enabled = true }: UseSSEOptions) {
  const [data, setData] = useState<T | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!enabled) return;

    const eventSource = new EventSource(`${url}?token=${encodeURIComponent(token)}`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'progress':
          setProgress(message.progress);
          break;
        case 'complete':
          setData(message.result);
          setIsConnected(false);
          eventSource.close();
          break;
        case 'error':
          setError(message.error);
          setIsConnected(false);
          eventSource.close();
          break;
      }
    };

    eventSource.onerror = () => {
      setError('Connection error');
      setIsConnected(false);
      eventSource.close();
    };

    return eventSource;
  }, [url, token, enabled]);

  useEffect(() => {
    const eventSource = connect();
    return () => {
      eventSource?.close();
    };
  }, [connect]);

  return { data, progress, error, isConnected };
}

// Usage in component
function RoleCardGenerator({ token }: { token: string }) {
  const { data, progress, error, isConnected } = useSSE<RoleCard>({
    url: '/api/rolecard/generate/stream',
    token,
    enabled: true
  });

  return (
    <div>
      {isConnected && (
        <progress value={progress} max={100}>
          {progress}%
        </progress>
      )}
      {error && <div className="error">{error}</div>}
      {data && <RoleCardDisplay rolecard={data} />}
    </div>
  );
}
```

### Python (using requests)

```python
import requests
import json

def generate_rolecard_stream(base_url, token, options=None):
    """Generate role card with SSE stream."""
    url = f"{base_url}/api/rolecard/generate/stream"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "text/event-stream"
    }

    with requests.post(url, headers=headers, json=options or {}, stream=True) as response:
        response.raise_for_status()

        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')

                # SSE format: "data: {json}\n\n"
                if line.startswith('data: '):
                    data = json.loads(line[6:])
                    handle_sse_event(data)

def handle_sse_event(data):
    """Handle SSE event based on type."""
    event_type = data.get('type')

    if event_type == 'progress':
        print(f"Progress: {data['progress']}% - {data['message']}")
    elif event_type == 'complete':
        print("Generation complete!")
        print(f"Result: {data['result']}")
    elif event_type == 'error':
        print(f"Error: {data['error']}")
```

## Error Handling

### Common SSE Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid or missing token | Refresh authentication token |
| `403 Forbidden` | Insufficient permissions | Check user permissions |
| `Connection lost` | Network issue | Implement reconnection logic |
| `Stream timeout` | Server timeout | Handle gracefully and retry |

### Reconnection Strategy

```javascript
class ReconnectableEventSource {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };
    this.retryCount = 0;
    this.connect();
  }

  connect() {
    this.eventSource = new EventSource(this.url);

    this.eventSource.onerror = () => {
      if (this.retryCount < this.options.maxRetries) {
        this.retryCount++;
        setTimeout(() => {
          this.eventSource.close();
          this.connect();
        }, this.options.retryDelay * this.retryCount);
      } else {
        this.eventSource.close();
      }
    };
  }

  close() {
    this.eventSource?.close();
  }
}
```

## Best Practices

1. **Always close SSE connections** when done to free server resources
2. **Handle errors gracefully** and show user-friendly messages
3. **Show progress indicators** for better UX
4. **Implement timeout handling** for long-running operations
5. **Use exponential backoff** for reconnection attempts
6. **Sanitize and validate** all received data
7. **Monitor connection state** and show connection status to users
