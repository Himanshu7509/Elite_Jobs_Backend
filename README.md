# Elite Jobs Backend

This is the backend service for the Elite Jobs platform, a job portal application built with Node.js and Express. The system supports job seekers and job hosters (employers) with features like user authentication, job posting, applications, and file uploads.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication)
  - [User Profile](#user-profile)
  - [File Upload](#file-upload)
  - [Jobs](#jobs)
  - [Applications](#applications)
- [File Storage](#file-storage)
- [Database Schema](#database-schema)
- [Role-Based Access Control](#role-based-access-control)
- [Development](#development)
- [Deployment](#deployment)

## Features

- User authentication (JWT-based)
- Role-based access control (Job Seeker / Job Hoster)
- User profile management with separate schemas for each role
- Job posting and management
- Job application system
- File upload to AWS S3 (resumes, photos, company logos)
- Automatic synchronization of company logos across all job postings
- Profile completeness validation for job applications

### User Roles

1. **Job Seeker**
   - Create and update profile with education, experience, etc.
   - Upload resume and profile photo
   - Apply for jobs
   - Track application status

2. **Job Hoster (Employer)**
   - Create and manage job postings
   - Upload company logo and profile photo
   - Review job applications
   - Update application status

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Database**: MongoDB with Mongoose ODM v8.19.2
- **Authentication**: JSONWebToken v9.0.2, bcrypt v6.0.0
- **File Upload**: multer v2.0.2, aws-sdk v2.1692.0
- **Environment Management**: dotenv v17.2.3
- **Validation**: express-validator (implied)
- **Development**: nodemon v3.1.10
- **Other Libraries**: uuid v13.0.0, cors v2.8.5

## Prerequisites

- Node.js (v14 or higher)
- MongoDB database
- AWS S3 bucket (for file storage)
- npm or yarn package manager

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd elite-jobs-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Start the development server:
   ```bash
   npm run dev
   ```

5. For production:
   ```bash
   npm start
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_s3_bucket_name

# Other configurations as needed
```

## API Endpoints

### Authentication

#### Signup
```http
POST /api/v1/auth/signup
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "role": "jobSeeker",
  "profile": {
    // Role-specific profile data
  }
}
```

#### Login
```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

### User Profile

#### Get Profile
```http
GET /api/v1/auth/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PATCH /api/v1/auth/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "profile": {
    // Profile fields to update
  }
}
```

#### Delete Profile
```http
DELETE /api/v1/auth/profile
Authorization: Bearer <token>
```

### File Upload

#### Upload Multiple Files
```http
POST /api/v1/auth/profile/upload-multiple
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Fields:**
- `resume` (PDF, job seekers only)
- `photo` (Images, both roles)
- `companyLogo` (Images, job hosters only)

#### Update Profile Picture
```http
PUT /api/v1/auth/profile/photo
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Field:**
- `photo` (Image file)

#### Update Resume (Job Seekers Only)
```http
PUT /api/v1/auth/profile/resume
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Field:**
- `resume` (PDF file)

#### Update Company Logo (Job Hosters Only)
```http
PUT /api/v1/auth/profile/company-logo
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Field:**
- `companyLogo` (Image file)

**Note:** When a job hoster updates their company logo through this endpoint, all jobs previously posted by this hoster are automatically updated with the new company logo. This ensures brand consistency across all job listings.

#### General File Upload
```http
POST /api/v1/auth/profile/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Fields:**
- `file` (The file to upload)
- `fileType` (Optional: 'resume', 'photo', or 'companyLogo')

**Note:** When uploading a company logo through this endpoint, all jobs posted by the job hoster are automatically updated with the new company logo.

### Jobs

#### Create Job (Job Hoster Only)
```http
POST /api/v1/jobs
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Software Engineer",
  "description": "We are looking for a skilled software engineer...",
  "company": {
    "name": "Tech Solutions Inc.",
    "description": "Leading technology company",
    "website": "https://techsolutions.com"
  },
  "location": "San Francisco, CA",
  "employmentType": "Full-time",
  "salary": {
    "min": 80000,
    "max": 120000,
    "currency": "USD"
  },
  "requirements": ["JavaScript", "React", "Node.js"],
  "responsibilities": ["Develop web applications", "Collaborate with team"],
  "experienceLevel": "Mid",
  "applicationDeadline": "2025-12-31",
  "category": "IT"
}
```

**Note:** When creating a job, if the company logo is not provided in the request, it will be automatically populated from the job hoster's profile.

#### Get All Jobs (Public)
```http
GET /api/v1/jobs
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (search in title, description, or company name)
- `location` (filter by location)
- `employmentType` (filter by employment type)
- `experienceLevel` (filter by experience level)

#### Get Job Counts by Category (Public)
```http
GET /api/v1/jobs/categories
```

Retrieves the count of active jobs in each category. Useful for displaying job statistics or building category filter UIs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "category": "IT",
      "count": 12
    },
    {
      "category": "Sales",
      "count": 7
    },
    {
      "category": "Finance",
      "count": 3
    },
    {
      "category": "Marketing",
      "count": 4
    },
    {
      "category": "HR",
      "count": 2
    },
    {
      "category": "Operations",
      "count": 3
    },
    {
      "category": "Engineering",
      "count": 5
    },
    {
      "category": "Other",
      "count": 1
    }
  ],
  "totalJobs": 37
}
```

#### Get Job by ID (Public)
```http
GET /api/v1/jobs/:id
```

#### Update Job (Job Hoster Only)
```http
PUT /api/v1/jobs/:id
Authorization: Bearer <token>
```

**Note:** When updating a job's company information, if the company logo is not provided, it will be automatically populated from the job hoster's profile.

#### Delete Job (Job Hoster Only)
```http
DELETE /api/v1/jobs/:id
Authorization: Bearer <token>
```

#### Get My Jobs (Job Hoster Only)
```http
GET /api/v1/jobs/my
Authorization: Bearer <token>
```

### Applications

#### Apply for Job (Job Seeker Only)
```http
POST /api/v1/jobs/:id/apply
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "coverLetter": "Optional cover letter",
  "resume": "Optional resume URL (if not using profile resume)"
}
```

#### Get My Applications (Job Seeker Only)
```http
GET /api/v1/jobs/applications/my
Authorization: Bearer <token>
```

#### Get Job Applications (Job Hoster Only)
```http
GET /api/v1/jobs/:id/applications
Authorization: Bearer <token>
```

#### Update Application Status (Job Hoster Only)
```http
PATCH /api/v1/jobs/applications/:id/status
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "interview" // pending, reviewed, interview, accepted, rejected
}
```

#### Delete Account (Both Roles)
```http
DELETE /api/v1/jobs/account
Authorization: Bearer <token>
```

## File Storage

All files are stored in AWS S3 with the following organization:

- **Resumes**: `job-files/resumes/`
- **Profile Photos**: `job-files/photos/`
- **Company Logos**: `job-files/logos/`

When users delete their profiles, all associated files are automatically removed from S3 storage.

### File Validation

- **Resumes**: PDF files only
- **Photos/Logos**: JPEG, PNG, GIF images only
- **File Size Limit**: 5MB maximum

### Automatic Company Logo Synchronization

The Elite Jobs platform automatically synchronizes company logos across all job postings. When a job hoster updates their company logo through any of the file upload endpoints:
- Their profile is updated with the new company logo URL
- All jobs they've previously posted are automatically updated with the same company logo URL
- This ensures brand consistency across all job listings without manual intervention

This feature works with all file upload methods:
1. Dedicated company logo endpoint (`PUT /api/v1/auth/profile/company-logo`)
2. General file upload endpoint (`POST /api/v1/auth/profile/upload`)
3. Multiple file upload endpoint (`POST /api/v1/auth/profile/upload-multiple`)

## Database Schema

### User Model

#### Job Seeker Profile
```javascript
{
  name: String,
  email: String,
  password: String,
  role: "jobSeeker",
  profile: {
    age: Number,
    address: String,
    phone: String,
    githubUrl: String,
    linkedinUrl: String,
    skills: [String], // New field for job seeker skills
    education: [{
      degree: String,
      institution: String,
      field: String,
      startDate: Date,
      endDate: Date
    }],
    experience: [{
      position: String,
      company: String,
      startDate: Date,
      endDate: Date,
      description: String
    }],
    photo: String, // URL to S3
    resume: String  // URL to S3
  }
}
```

#### Job Hoster Profile
```javascript
{
  name: String,
  email: String,
  password: String,
  role: "jobHoster",
  profile: {
    companyName: String,
    companyDescription: String,
    companyWebsite: String,
    companyEmail: String, // New field
    numberOfEmployees: Number, // New field
    companyPhone: String, // New field
    companyLogo: String, // URL to S3
    photo: String, // URL to S3
    phone: String,
    panCardNumber: String,
    gstNumber: String
  }
}
```

### Job Model
```javascript
{
  title: String,
  description: String,
  company: {
    name: String,
    description: String,
    website: String,
    logo: String  // URL to S3 - automatically synchronized with job hoster's profile
  },
  location: String,
  jobType: String, // Full-time, Part-time (replaces employmentType)
  interviewType: String, // Online, On-site
  workType: String, // Remote, On-site, Hybrid
  minEducation: String, // Required education level
  salary: {
    min: Number,
    max: Number,
    currency: String
  },
  requirements: [String],
  responsibilities: [String],
  skills: [String],
  experienceLevel: String, // Entry, Junior, Mid, Senior, Executive, Intern
  applicationDeadline: Date,
  postedBy: ObjectId (ref: User),
  isActive: Boolean,
  category: String // IT, Sales, Finance, Marketing, HR, Operations, Engineering, Other
}
```

### Application Model
```javascript
{
  jobId: ObjectId (ref: Job),
  applicantId: ObjectId (ref: User),
  resume: String, // URL to S3
  coverLetter: String,
  status: String, // pending, reviewed, interview, accepted, rejected
  appliedAt: Date
}
```

## Role-Based Access Control

The application implements role-based access control with two user roles:

1. **jobSeeker**: Can apply for jobs, manage their profile, and track applications
2. **jobHoster**: Can post jobs, review applications, and manage their company profile

Middleware functions ensure that users can only access endpoints appropriate for their role.

## Development

### Project Structure
```
src/
├── config/          # Configuration files (database, S3, multer)
├── controllers/     # Request handlers
├── middleware/      # Custom middleware (auth, validation)
├── models/          # Database models
├── routes/          # API route definitions
└── utils/           # Utility functions
```

### Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (if implemented)

### Code Standards

- ES6+ JavaScript with async/await
- Consistent error handling
- RESTful API design
- Environment-based configuration
- Modular code organization

## Deployment

1. Set `NODE_ENV=production` in environment variables
2. Ensure all environment variables are configured
3. Run `npm start` to start the production server
4. Use a process manager like PM2 for production deployments

### Health Checks

The application includes health check endpoints for monitoring:
- Database connection status
- S3 connectivity
- Server uptime

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue on the GitHub repository or contact the development team.