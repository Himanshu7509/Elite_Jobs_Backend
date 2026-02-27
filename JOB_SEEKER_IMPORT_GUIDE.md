# Job Seeker Excel Data Import Guide

This guide explains how to import job seeker data from Excel files using the admin panel.

## Overview

The system allows administrators to import job seeker data from Excel files directly into the database. This creates user accounts for job seekers that can later log in, update their profiles, and apply for jobs.

## Excel File Format

Your Excel file must contain the following columns:

| Column Name | Description | Required |
|-------------|-------------|----------|
| Full Name | The full name of the job seeker | Yes |
| Email | Email address (used for login) | Yes |
| Gender | Gender of the job seeker | No |
| Age | Age of the job seeker | No |
| Phone No. | Primary phone number | No |
| Alternate No. | Alternate phone number | No |
| Address | Address of the job seeker | No |
| Highest Education | Educational qualification | No |
| Certification | Comma-separated certifications | No |
| Skills | Comma-separated skills | No |
| Work Experience | Comma-separated work experiences | No |
| Applied Post | Position they applied for | No |

### Sample Excel Data:
```
Full Name,Email,Gender,Age,Phone No.,Alternate No.,Address,Highest Education,Certification,Skills,Work Experience,Applied Post
John Doe,john.doe@example.com,Male,28,9876543210,9876543211,123 Main St,Bachelor's Degree,Cert1,JavaScript,Software Developer,Software Engineer
Jane Smith,jane.smith@example.com,Female,32,9876543212,9876543213,456 Oak Ave,Master's Degree,Cert2,React,Senior Developer,Senior Software Engineer
```

## API Endpoints

### 1. Import Job Seekers
- **Endpoint**: `POST /import/jobseekers`
- **Authorization**: Admin only
- **Content-Type**: multipart/form-data
- **Request Body**: 
  - `excelFile`: The Excel file to import

#### Example Request:
```bash
curl -X POST \
  http://localhost:3000/import/jobseekers \
  -H 'Authorization: Bearer YOUR_ADMIN_JWT_TOKEN' \
  -F 'excelFile=@path/to/your/excel-file.xlsx'
```

#### Response:
```json
{
  "success": true,
  "message": "Import completed successfully",
  "data": {
    "totalRecords": 100,
    "processedRecords": 95,
    "insertedRecords": 90,
    "skippedRecords": 5,
    "errors": ["Row 1: Invalid email format", ...]
  }
}
```

### 2. Get Imported Job Seekers
- **Endpoint**: `GET /import/jobseekers`
- **Authorization**: Admin only
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Records per page (default: 10)
  - `search`: Search by name or email

#### Example Request:
```bash
curl -X GET \
  http://localhost:3000/import/jobseekers?page=1&limit=10&search=john \
  -H 'Authorization: Bearer YOUR_ADMIN_JWT_TOKEN'
```

### 3. Send Welcome Emails
- **Endpoint**: `POST /import/jobseekers/welcome-emails`
- **Authorization**: Admin only
- **Request Body**:
  - `userIds`: Array of user IDs to send welcome emails to

#### Example Request:
```bash
curl -X POST \
  http://localhost:3000/import/jobseekers/welcome-emails \
  -H 'Authorization: Bearer YOUR_ADMIN_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"userIds": ["user_id_1", "user_id_2"]}'
```

### 4. Get Import Statistics
- **Endpoint**: `GET /import/statistics`
- **Authorization**: Admin only

#### Example Request:
```bash
curl -X GET \
  http://localhost:3000/import/statistics \
  -H 'Authorization: Bearer YOUR_ADMIN_JWT_TOKEN'
```

## Frontend Integration for Admin Panel

### 1. Import Job Seekers Component

Create a component that allows uploading Excel files:

```javascript
// Example React component for importing job seekers
import React, { useState } from 'react';

const ImportJobSeekers = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    
    const formData = new FormData();
    formData.append('excelFile', file);

    try {
      const response = await fetch('/import/jobseekers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} required />
        <button type="submit" disabled={loading}>
          {loading ? 'Importing...' : 'Import Job Seekers'}
        </button>
      </form>
      
      {result && (
        <div>
          <h3>Import Result:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

### 2. View Imported Job Seekers Component

```javascript
// Example React component for viewing imported job seekers
import React, { useState, useEffect } from 'react';

const ViewImportedJobSeekers = () => {
  const [jobSeekers, setJobSeekers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetchJobSeekers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/import/jobseekers?page=${page}&search=${search}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      const data = await response.json();
      setJobSeekers(data.data);
    } catch (error) {
      console.error('Fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobSeekers();
  }, [page, search]);

  return (
    <div>
      <input 
        type="text" 
        placeholder="Search job seekers..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {jobSeekers.users?.map(user => (
            <div key={user._id}>
              <h4>{user.name}</h4>
              <p>Email: {user.email}</p>
              <p>Status: {user.isVerified ? 'Verified' : 'Unverified'}</p>
            </div>
          ))}
          
          {/* Pagination controls */}
        </div>
      )}
    </div>
  );
};
```

## User Experience for Imported Job Seekers

### First-Time Login Process

1. **Account Creation**: When imported, users get accounts with temporary passwords
2. **Email Notification**: Imported users receive a welcome email with instructions
3. **Password Setup**: Users must use the "Forgot Password" feature to set their own password
4. **Account Verification**: Once they set their password, their account becomes verified
5. **Normal Usage**: After verification, they can use all features normally

### Welcome Email Content

The system automatically sends a welcome email to imported users with instructions:

- Visit the website
- Click on "Forgot Password"
- Enter their email address
- Receive OTP to set their password
- Log in and update their profile

## Security Considerations

1. **Access Control**: Import functionality is restricted to admin users only
2. **Data Validation**: All imported data is validated before insertion
3. **Email Verification**: Imported users must verify their accounts through password setup
4. **Duplicate Prevention**: The system checks for existing email addresses to prevent duplicates
5. **Error Handling**: Proper error handling prevents system crashes

## Troubleshooting

### Common Issues:

1. **File Format Errors**: Ensure your Excel file has the correct column headers
2. **Email Validation**: Make sure all email addresses are valid
3. **Duplicate Emails**: The system skips users with duplicate emails
4. **Missing Required Fields**: "Full Name" and "Email" are required for all entries

### Checking Results:

- Monitor the response after import to see how many records were processed
- Check the "errors" array in the response for specific row issues
- Use the statistics endpoint to monitor import progress
- View imported users to confirm successful import

## Best Practices

1. **Data Quality**: Ensure Excel data is clean and consistent
2. **Batch Size**: For large datasets, consider breaking them into smaller batches
3. **Testing**: Test with a small sample first before importing large datasets
4. **Backup**: Always backup your database before large imports
5. **Validation**: Validate the imported data after import is complete

## API Response Codes

- `200`: Success
- `400`: Bad request (invalid file, missing columns, etc.)
- `401`: Unauthorized (invalid or missing JWT token)
- `403`: Forbidden (user doesn't have admin role)
- `500`: Internal server error