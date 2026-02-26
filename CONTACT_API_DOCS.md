# Contact API Documentation

## Overview
Complete CRUD API for contact forms with user submission (POST) and admin management capabilities.

## API Endpoints

### Public Endpoint (No Authentication Required)

#### Submit Contact Form
```http
POST /api/contact
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "9876543210",
  "subject": "Regarding job opportunities",
  "message": "I would like to know more about available positions..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact form submitted successfully",
  "data": {
    "_id": "67b1234567890abcdef12345",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "subject": "Regarding job opportunities",
    "message": "I would like to know more about available positions...",
    "status": "pending",
    "createdAt": "2026-01-18T10:30:00.000Z",
    "updatedAt": "2026-01-18T10:30:00.000Z"
  }
}
```

### Admin Endpoints (Authentication Required)

#### Get All Contact Forms
```http
GET /api/contact?page=1&limit=10&status=pending&search=john
```

**Query Parameters:**
- `page` (default: 1) - Page number for pagination
- `limit` (default: 10) - Number of contacts per page
- `status` (optional) - Filter by status: pending, resolved, in-progress
- `search` (optional) - Search in name, email, or subject

**Response:**
```json
{
  "success": true,
  "message": "Contacts retrieved successfully",
  "data": {
    "contacts": [
      {
        "_id": "67b1234567890abcdef12345",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "9876543210",
        "subject": "Regarding job opportunities",
        "message": "I would like to know more about available positions...",
        "status": "pending",
        "createdAt": "2026-01-18T10:30:00.000Z",
        "updatedAt": "2026-01-18T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalContacts": 45,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Get Contact by ID
```http
GET /api/contact/67b1234567890abcdef12345
```

**Response:**
```json
{
  "success": true,
  "message": "Contact retrieved successfully",
  "data": {
    "_id": "67b1234567890abcdef12345",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "subject": "Regarding job opportunities",
    "message": "I would like to know more about available positions...",
    "status": "pending",
    "createdAt": "2026-01-18T10:30:00.000Z",
    "updatedAt": "2026-01-18T10:30:00.000Z"
  }
}
```

#### Update Contact
```http
PUT /api/contact/67b1234567890abcdef12345
```

**Request Body (partial update allowed):**
```json
{
  "status": "resolved",
  "message": "Updated message if needed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact updated successfully",
  "data": {
    "_id": "67b1234567890abcdef12345",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "subject": "Regarding job opportunities",
    "message": "Updated message if needed",
    "status": "resolved",
    "createdAt": "2026-01-18T10:30:00.000Z",
    "updatedAt": "2026-01-18T11:45:00.000Z"
  }
}
```

#### Delete Contact
```http
DELETE /api/contact/67b1234567890abcdef12345
```

**Response:**
```json
{
  "success": true,
  "message": "Contact deleted successfully",
  "data": {
    "_id": "67b1234567890abcdef12345",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "9876543210",
    "subject": "Regarding job opportunities",
    "message": "I would like to know more about available positions...",
    "status": "pending",
    "createdAt": "2026-01-18T10:30:00.000Z",
    "updatedAt": "2026-01-18T10:30:00.000Z"
  }
}
```

#### Get Contact Statistics
```http
GET /api/contact/stats
```

**Response:**
```json
{
  "success": true,
  "message": "Contact statistics retrieved successfully",
  "data": {
    "totalContacts": 45,
    "statusStats": [
      {
        "_id": "pending",
        "count": 25
      },
      {
        "_id": "resolved",
        "count": 15
      },
      {
        "_id": "in-progress",
        "count": 5
      }
    ],
    "recentContacts": [
      {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "subject": "Regarding job opportunities",
        "createdAt": "2026-01-18T10:30:00.000Z",
        "status": "pending"
      }
    ]
  }
}
```

## Data Validation

### Required Fields for Contact Submission:
- `name` (String, max 100 characters)
- `email` (Valid email format)
- `phone` (10-15 digits)
- `subject` (String, max 200 characters)
- `message` (String, max 2000 characters)

### Status Values:
- `pending` (default)
- `resolved`
- `in-progress`

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "All fields are required: name, email, phone, subject, message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Contact not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to submit contact form",
  "error": "Error details here"
}
```

## Authentication
Admin endpoints require:
1. Valid JWT token in Authorization header
2. User must have 'admin' role

**Header Format:**
```
Authorization: Bearer <your-jwt-token>
```

## Usage Examples

### Submitting a Contact Form (Frontend)
```javascript
const submitContactForm = async (formData) => {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Contact form submitted successfully!');
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error submitting contact form:', error);
    throw error;
  }
};
```

### Admin Panel Integration
```javascript
const fetchContacts = async (token, page = 1, status = null) => {
  try {
    const url = new URL('/api/contact');
    url.searchParams.append('page', page);
    if (status) url.searchParams.append('status', status);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
};
```

## Database Schema
The Contact model includes automatic timestamps and proper indexing for performance optimization.