# Phase 2 Real Backend Runtime Evidence

This document registers the runtime status and configuration of the local backend server used for E2E acceptance validation.

## Environment Details

- **Backend Environment**: `Development`
- **Local Backend API Port**: `5028`
- **Base URL**: `http://localhost:5028`
- **Database Server**: SQL Server LocalDB (`(localdb)\mssqllocaldb`)
- **Safe Database Name**: `TexasAccountsPortalDb_Dev`

## Startup Status

- **Process Launch Status**: Success (Running background task)
- **Migrations Application**: Success (EF Migrations up-to-date, database initialized)
- **Health Live Check Endpoint (`/health/live`)**: Active
- **Health Ready Check Endpoint (`/health/ready`)**: Active (Returns `"Healthy"`)

## Endpoint Verification Evidence

### Root Endpoint (`/`)

```json
{
	"portal": "Texas Accounts Portal API",
	"status": "Healthy",
	"version": "1.0.0"
}
```

### Health Endpoint (`/health/ready`)

```text
Healthy
```
