# VANIGAR SANGAM — VALIDATION & API CONTRACT INTEGRATION SPECIFICATION

**Version:** 1.0.0  
**Phase:** Phase 3.4 — Validation & API Contract Integration Foundation  
**Status:** Approved Architectural Standard  

---

## 1. Overview & Objective

This specification establishes the standardized contract boundary for all HTTP communication in the **Vanigar Sangam** backend:
- Unambiguous request validation before touching controllers or business services.
- Deterministic response envelopes (`data` and `error`) across all endpoints.
- Strict error sanitization preventing leakage of credentials, tokens, SQL statements, or stack traces.
- Reusable structural validation primitives for path parameters, query parameters, pagination, and request bodies.

---

## 2. Request Validation Flow

Every incoming HTTP request traverses a strict unidirectional boundary:

```
┌──────────────────────────────────────────────┐
│           Incoming HTTP Request              │
│       (Headers, Params, Query, Body)         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│         Request Validation Boundary          │
│       (@vanigar/validation middleware)       │
└──────────────┬───────────────────────────────┘
               │
      [Invalid Payload?]
      ├───────────────► 400 Bad Request
      │                 { data: null, error: { code: 'INVALID_INPUT', ... } }
      ▼ [Valid]
┌──────────────────────────────────────────────┐
│          Controller (Typed DTO)              │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              Domain Service                  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           Database Repository                │
└──────────────────────────────────────────────┘
```

---

## 3. Standard API Response Envelopes

All endpoints in the Vanigar Sangam REST API must return responses formatted in one of the three standardized shapes defined in `@vanigar/shared-types`:

### 3.1 Success Response (`ApiSuccessResponse<T>`)
```json
{
  "data": { ... },
  "error": null
}
```
*HTTP Status Codes:* `200 OK`, `201 Created`

### 3.2 Error Response (`ApiErrorResponse`)
```json
{
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "username",
          "message": "Username is required",
          "code": "REQUIRED"
        }
      ]
    }
  }
}
```
*HTTP Status Codes:* `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `500 Internal Error`

### 3.3 Paginated Success Response (`PaginatedSuccessResponse<T>`)
```json
{
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 142,
      "totalPages": 8
    }
  },
  "error": null
}
```

---

## 4. Machine-Readable Error Codes

All API error envelopes carry a machine-readable `code` field defined in `API_ERROR_CODES` or `AUTH_ERROR_CODES`:

| Error Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| **`INVALID_INPUT`** | `400` | Request body, query, or path parameter failed structural validation |
| **`BAD_REQUEST`** | `400` | Malformed request or invalid state pre-condition |
| **`UNAUTHENTICATED`** | `401` | Missing, expired, or invalid session |
| **`FORBIDDEN`** | `403` | Authenticated user lacks required role or account is inactive/suspended |
| **`NOT_FOUND`** | `404` | Requested entity or route does not exist |
| **`CONFLICT`** | `409` | State transition conflict or duplicate unique identifier |
| **`INTERNAL_ERROR`** | `500` | Unexpected server/database failure (sanitized, zero details leaked) |

---

## 5. Infrastructure Validation Conventions

All structural validations are handled by `@vanigar/validation`:

### 5.1 Common ID & Path Parameter Validation
- **Convention:** Entity IDs must be valid UUIDs.
- **Helper:** `validateUuidParam(paramValue, paramName)`
- **Behavior:** Rejects malformed strings, non-UUIDs, and empty values with code `'INVALID_FORMAT'`.

### 5.2 Date Parameter Validation
- **Convention:** Calendar dates must be `YYYY-MM-DD` strings.
- **Helper:** `validateDateParam(value, fieldName)`
- **Behavior:** Validates format and checks calendar authenticity (e.g., rejects `2026-02-31`).

### 5.3 Pagination Query Validation
- **Convention:** `page` defaults to `1` (min: `1`), `pageSize` defaults to `20` (min: `1`, max: `100`).
- **Helper:** `validatePaginationQuery(query)`
- **Behavior:** Safely parses numbers from string queries, rejects non-integers or negative values, and enforces maximum bounds.

### 5.4 Error Sanitization Rule
- **Helper:** `sanitizeValidationErrors(errors)`
- **Security Invariant:** Sensitive field names (`password`, `secret`, `token`, `session`, `cookie`) never echo raw user inputs or stack traces in validation error details.

---

## 6. Implementation Patterns for Route Handlers

Future business modules can utilize two equivalent integration styles:

### Pattern A: Declarative Middleware
```typescript
router.post(
  '/members',
  validateBody(validateCreateMemberPayload),
  createMemberController
);
```

### Pattern B: Controller Functional Assertion
```typescript
export async function createMemberController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = assertValid(validateCreateMemberPayload(req.body));
    const member = await memberService.createMember(input);
    sendCreated(res, member);
  } catch (err) {
    next(err);
  }
}
```
Both patterns produce identical, standardized API error responses and enforce total parameter safety.
