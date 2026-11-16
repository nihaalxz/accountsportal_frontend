# Sales Operations API Inventory

This document lists all Sales Portal synchronization endpoints, transaction lookup endpoints, and Sales database operational query endpoints used by the Accounts Portal to display synchronized financial and operational sales data.

---

## 1. Accounts Portal Backend - Sales & Sync Endpoints

These endpoints reside on the **Accounts Portal Backend** (`http://localhost:5028`). They handle sales return postings, deposit sync actions from the Sales Portal, and transaction lookup queries.

### 1.1 `GET api/Transaction`
* **Purpose**: Query financial transactions in the Accounts DB. Used to display linked financial history (credits, deposits, and bookings/sales) next to operational sales data.
* **Request (Query Parameters)**:
  * `status`: Optional string (`pending`, `approved`, `rejected`)
  * `type`: Optional string (`incoming`, `outgoing`, `contra`)
  * `referenceType`: Optional string (`sale`, `expense`, `refund`, `supplierpayment`, `openingbalance`, `correction`, `transfer`, etc.)
  * `referenceId`: Optional string (matches booking ID or other operational identifiers)
  * `page`: Integer (default `1`)
  * `pageSize`: Integer (default `20`, max `100`)
* **Response**: `IEnumerable<TransactionResponse>`
  ```json
  [
    {
      "id": 1,
      "transactionType": "incoming",
      "sourceAccountId": null,
      "destinationAccountId": 12,
      "sourceBankId": null,
      "destinationBankId": 4,
      "amount": 250.75,
      "balanceAfter": 1500.0,
      "paymentMethod": "cash",
      "referenceType": "sale",
      "referenceId": "1",
      "description": "Flight Ticket Booking TX-FL-90210",
      "status": "approved",
      "approvedBy": 1,
      "approvedAt": "2026-07-10T12:00:00Z",
      "rejectedBy": null,
      "rejectedAt": null,
      "returnReason": null,
      "supplierId": null,
      "supplierName": null,
      "expenseHeaderId": null,
      "createdBy": 1,
      "createdAt": "2026-07-10T11:45:00Z"
    }
  ]
  ```
* **Permissions**: `RequireAccountant` (role: Accountant or Master Accountant).
* **Linked Entities**: Reference mapping to Booking/Customer entities in the Sales Database.

### 1.2 `POST api/sales-returns`
* **Purpose**: Register a sales return (refund/cancellation) and post it to the general ledger.
* **Request (JSON Body)**: `CreateSalesReturnRequest`
  ```json
  {
    "bookingType": "flight_booking",
    "bookingId": "1",
    "customerId": 1,
    "refundAmount": 50.0,
    "reason": "Customer cancelled flight"
  }
  ```
* **Response**: `SalesReturnResponse`
  ```json
  {
    "id": 1,
    "bookingType": "flight_booking",
    "bookingId": "1",
    "refundAmount": 50.0,
    "status": "pending",
    "journalEntryId": null
  }
  ```
* **Permissions**: `RequireAccountant`.

### 1.3 `POST api/sales-returns/{id}/approve`
* **Purpose**: Approve a pending sales return and execute General Ledger adjustments.
* **Response**: `SalesReturnResponse`
* **Permissions**: `RequireMasterAccountant`.

### 1.4 `POST api/sales-returns/{id}/reject`
* **Purpose**: Reject a pending sales return.
* **Request (JSON Body)**: `RejectSalesReturnRequest` (`reason` string).
* **Response**: `SalesReturnResponse`
* **Permissions**: `RequireMasterAccountant`.

### 1.5 `POST api/public/banks/{id}/deposit` & `POST api/public/accounts/{id}/deposit`
* **Purpose**: Integration endpoint called by the Sales Portal backend when bank/cash collections are received from customers.
* **Request (JSON Body)**: `CreateIncomingTransactionRequest`
* **Response**: `TransactionResponse`
* **Permissions**: Internal service authentication (`X-OPS-KEY` header verification).

---

## 2. Sales Portal Backend - Operational Endpoints

These endpoints reside on the **Sales Portal Backend** (`http://localhost:5003` in development). They provide raw operational sales data. The Accounts Portal queries these endpoints directly using Svelte's `apiFetch` with custom base URL.

### 2.1 `GET api/sales/dashboard/summary`
* **Purpose**: Returns salesman/operations dashboard KPI summary.
* **Response**: `DashboardSummaryResponse`
  ```json
  {
    "totalFlightBookings": 1,
    "totalHotelBookings": 2,
    "totalVisaApplications": 0,
    "totalVfsAppointments": 0,
    "totalHolidayPackages": 0,
    "totalTransportations": 0,
    "totalOtherServices": 0,
    "totalPayableAmount": 350.75,
    "totalPaidAmount": 100.0,
    "totalPendingAmount": 250.75,
    "totalProfit": 25.0,
    "cashInHand": 350.25,
    "activeLeads": 1,
    "totalHeads": 1
  }
  ```
* **Permissions**: Authenticated salesman (mocked in development with header `Authorization: Bearer dev-token-salesman-a`).

### 2.2 `GET api/sales/bookings/flights`
* **Purpose**: Lists operational flight bookings.
* **Request (Query Parameters)**:
  * `page`: Integer (default `1`)
  * `pageSize`: Integer (default `10`)
  * `paymentStatus`: Optional string (`pending`, `paid`, `partial`)
  * `processingStatus`: Optional string (`confirmed`, `pending`, `cancelled`)
* **Response**: `PagedResponse<FlightBookingSummaryResponse>`
  ```json
  {
    "items": [
      {
        "id": 1,
        "headName": "Alice A_Head",
        "fromLocation": "BAH",
        "toLocation": "DXB",
        "paymentMethod": "cash",
        "paymentStatus": "pending",
        "processingStatus": "confirmed",
        "payableAmount": 250.75,
        "passengerCount": 1,
        "createdAt": "2026-07-13T10:00:00Z"
      }
    ],
    "page": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1
  }
  ```
* **Permissions**: Salesman role.

### 2.3 `GET api/sales/bookings/hotels`
* **Purpose**: Lists operational hotel bookings.
* **Request (Query Parameters)**: Same as flights.
* **Response**: `PagedResponse<HotelBookingSummaryResponse>`
  ```json
  {
    "items": [
      {
        "id": 1,
        "headName": "Alice A_Head",
        "guestName": "Alice",
        "country": "UAE",
        "days": 2,
        "checkInDate": "2026-07-20T00:00:00Z",
        "paymentStatus": "paid",
        "processingStatus": "confirmed",
        "orderStatus": "confirmed",
        "payableAmount": 100.0,
        "profit": 25.0,
        "createdAt": "2026-07-14T09:30:00Z"
      }
    ]
  }
  ```
* **Permissions**: Salesman role.

### 2.4 `GET api/sales/bookings/visas`
* **Purpose**: Lists visa bookings.
* **Request (Query Parameters)**: Same as flights.
* **Response**: `PagedResponse<VisaApplicationSummaryResponse>`
* **Permissions**: Salesman role. (Can also review via `api/internal/operations/visas` using `X-OPS-KEY` header).

### 2.5 `GET api/sales/bookings/vfs`
* **Purpose**: Lists VFS appointments.
* **Request (Query Parameters)**: Same as flights.
* **Response**: `PagedResponse<VfsAppointmentSummaryResponse>`
* **Permissions**: Salesman role. (Can also review via `api/internal/operations/vfs-appointments`).

### 2.6 `GET api/sales/bookings/holidays`
* **Purpose**: Lists holiday packages.
* **Request (Query Parameters)**: Same as flights.
* **Response**: `PagedResponse<HolidayPackageSummaryResponse>`
* **Permissions**: Salesman role. (Can also review via `api/internal/operations/holiday-packages`).

### 2.7 `GET api/sales/bookings/transport`
* **Purpose**: Lists transportation bookings.
* **Request (Query Parameters)**: Same as flights.
* **Response**: `PagedResponse<TransportationSummaryResponse>`
* **Permissions**: Salesman role.

### 2.8 `GET api/sales/bookings/other`
* **Purpose**: Lists other services.
* **Request (Query Parameters)**: Same as flights.
* **Response**: `PagedResponse<OtherServiceSummaryResponse>`
* **Permissions**: Salesman role.

### 2.9 `GET api/sales/heads`
* **Purpose**: Lists customer heads directory.
* **Request (Query Parameters)**:
  * `page`: Integer (default `1`)
  * `pageSize`: Integer (default `10`)
  * `searchTerm`: Optional string (name/email lookup)
  * `sortBy`: String (`firstName`, `lastName`, `balance`, `createdAt`)
  * `sortOrder`: String (`asc`, `desc`)
* **Response**: `PagedResponse<HeadSummaryResponse>`
* **Permissions**: Salesman role.

### 2.10 `GET api/sales/heads/{id}/ledger`
* **Purpose**: Chronological ledger for a customer head account.
* **Request (Query Parameters)**:
  * `page`: Integer (default `1`)
  * `pageSize`: Integer (default `20`)
* **Response**: `PagedResponse<HeadLedgerEntryResponse>`
  ```json
  {
    "items": [
      {
        "id": 1,
        "type": "Flight",
        "description": "Flight Ticket Booking TX-FL-90210",
        "debit": 250.75,
        "credit": 0.0,
        "balance": 250.75,
        "createdAt": "2026-07-10T11:45:00Z"
      }
    ]
  }
  ```
* **Permissions**: Salesman role.

### 2.11 `GET api/sales/leads`
* **Purpose**: Lists sales leads.
* **Request (Query Parameters)**:
  * `page`, `pageSize`
  * `searchTerm`
  * `status`: Optional string (`new`, `qualified`, `archived`)
  * `sortBy`: String (`name`, `status`, `createdAt`)
  * `sortOrder`: String (`asc`, `desc`)
* **Response**: `PagedResponse<LeadSummaryResponse>`
* **Permissions**: Salesman role.

### 2.12 `GET api/sales/receipts`
* **Purpose**: Lists payment receipts.
* **Request (Query Parameters)**:
  * `page`, `pageSize`
  * `searchTerm`
* **Response**: `PagedResponse<ReceiptSummaryResponse>`
* **Permissions**: Salesman role.
