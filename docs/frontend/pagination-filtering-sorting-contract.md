# Pagination, Filtering, and Sorting Contract

This document logs standard query parameter conventions for list endpoints in the accounts portal API.

## Pagination

List endpoints that support pagination use standard zero-indexed limit/offset parameters:

- `pageNumber`: The 1-based page index. (Default: `1`)
- `pageSize`: Number of items per page. (Default: `20`, Max: `100`)

### Success Response Shape

```typescript
interface PaginatedResponse<T> {
	items: T[];
	pageNumber: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
	hasPreviousPage: boolean;
	hasNextPage: boolean;
}
```

## Sorting

- `sortBy`: String representing the field name to sort on. E.g. `createdAt`, `amount`.
- `sortOrder`: Sorting direction. Either `asc` or `desc`.

## Filtering

- String filters (like supplier name, reference codes) are passed as text queries: `search=xyz`.
- Date filters: `startDate=2026-01-01&endDate=2026-12-31`.
- Enum and status lists: E.g., `status=Pending&status=Approved`.
