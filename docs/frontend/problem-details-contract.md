# Problem Details Contract

This document registers the mapping of C# exceptions to RFC-7807 Problem Details status codes.

## Standard Problem Details Shape (RFC-7807)

Every API error response is formatted using the standard Problem Details structure:

```json
{
	"type": "string (URL identifier of error type)",
	"title": "string (Short human-readable summary)",
	"status": 400,
	"detail": "string (Detailed explanation of what failed)",
	"instance": "string (Request path that caused the error)",
	"traceId": "string (Optional server-side telemetry code)",
	"correlationId": "string (Optional request context uuid)",
	"errors": {
		"FieldName": ["Validation error message description"]
	}
}
```

## Exception to Status Mappings

| Exception Class                           | Status Code                 | Title                 | Detail Content                                                                                     |
| ----------------------------------------- | --------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `ArgumentException`                       | `400 Bad Request`           | Bad Request           | Exception message detail                                                                           |
| `UnauthorizedAccessException`             | `401 Unauthorized`          | Unauthorized          | Exception message detail                                                                           |
| `KeyNotFoundException`                    | `404 Not Found`             | Not Found             | Exception message detail                                                                           |
| `DbUpdateConcurrencyException`            | `409 Conflict`              | Conflict              | Exception message detail                                                                           |
| `InvalidOperationException` (Idempotency) | `409 Conflict`              | Conflict              | Exception message detail                                                                           |
| `InvalidOperationException` (Other)       | `422 Unprocessable Entity`  | Unprocessable Entity  | Exception message detail                                                                           |
| Generic `Exception`                       | `500 Internal Server Error` | Internal Server Error | "An unexpected error occurred. Please contact system support." (Excludes stacktraces for security) |
