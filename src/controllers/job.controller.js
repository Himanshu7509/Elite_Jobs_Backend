import Job, { 
  JOB_TYPE_OPTIONS, 
  INTERVIEW_TYPE_OPTIONS, 
  WORK_TYPE_OPTIONS, 
  EXPERIENCE_LEVEL_OPTIONS, 
  NOTICE_PERIOD_OPTIONS, 
  CATEGORY_OPTIONS, 
  SHIFT_OPTIONS, 
  VERIFICATION_STATUS_OPTIONS 
} from '../models/job.model.js';
import Application from '../models/application.model.js';
import User from '../models/auth.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';

// Helper function to handle salary values as strings
const handleSalaryValue = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  
  // Convert to string and trim
  return String(value).trim();
};

// Get enum options for job creation
const getJobEnumOptions = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        jobType: JOB_TYPE_OPTIONS,
        interviewType: INTERVIEW_TYPE_OPTIONS,
        workType: WORK_TYPE_OPTIONS,
        experienceLevel: EXPERIENCE_LEVEL_OPTIONS,
        noticePeriod: NOTICE_PERIOD_OPTIONS,
        category: CATEGORY_OPTIONS,
        shift: SHIFT_OPTIONS,
        verificationStatus: VERIFICATION_STATUS_OPTIONS
      }
    });
  } catch (error) {
    console.error('Get job enum options error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create job (Job Hoster, Admin, EliteTeam)
const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      jobType,
      interviewType,
      workType,
      minEducation,
      salary,
      requirements,
      responsibilities,
      skills,
      experienceLevel,
      noticePeriod,
      company,
      applicationDeadline,
      category,
      numberOfOpenings,
      yearOfPassing,
      shift,
      walkInDate,
      walkInTime,
      directLink // Add directLink field
    } = req.body;
    
    // Validate required fields (only the ones that are still required)
    if (!title || !description || !location || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, location, category'
      });
    }
    
    // Additional validation for walk-in interviews (only if interviewType is provided)
    if (interviewType === 'Walk-in' && (!walkInDate || !walkInTime)) {
      return res.status(400).json({
        success: false,
        message: 'Walk-in date and time are required for walk-in interviews'
      });
    }
    
    // Handle salary values as strings
    let processedSalary = {};
    if (salary) {
      if (salary.min !== undefined) {
        processedSalary.min = handleSalaryValue(salary.min);
      }
      
      if (salary.max !== undefined) {
        processedSalary.max = handleSalaryValue(salary.max);
      }
      
      if (salary.currency) {
        processedSalary.currency = salary.currency;
      } else {
        processedSalary.currency = 'INR'; // Default currency
      }
    }
    
    // Prepare job data
    const jobData = {
      title,
      description,
      location,
      category,
      postedBy: req.user.userId,
      isActive: true
    };
    
    // Add optional fields if provided
    if (jobType) jobData.jobType = jobType;
    if (interviewType) jobData.interviewType = interviewType;
    if (workType) jobData.workType = workType;
    if (minEducation) jobData.minEducation = minEducation;
    if (requirements) jobData.requirements = requirements;
    if (responsibilities) jobData.responsibilities = responsibilities;
    if (skills) jobData.skills = skills;
    if (experienceLevel) jobData.experienceLevel = experienceLevel;
    if (noticePeriod) jobData.noticePeriod = noticePeriod;
    if (company) jobData.company = company;
    if (applicationDeadline) jobData.applicationDeadline = applicationDeadline;
    if (numberOfOpenings) jobData.numberOfOpenings = numberOfOpenings;
    if (yearOfPassing) jobData.yearOfPassing = yearOfPassing;
    if (shift) jobData.shift = shift;
    if (walkInDate) jobData.walkInDate = walkInDate;
    if (walkInTime) jobData.walkInTime = walkInTime;
    if (directLink) jobData.directLink = directLink; // Add directLink field
    
    // Add processed salary if provided
    if (Object.keys(processedSalary).length > 0) {
      jobData.salary = processedSalary;
    }
    
    // For job hosters, populate company info from their profile if not provided
    if (req.user.role === 'jobHoster' && !jobData.company) {
      const jobHoster = await User.findById(req.user.userId);
      if (jobHoster && jobHoster.profile) {
        jobData.company = {
          name: jobHoster.profile.companyName || '',
          description: jobHoster.profile.companyDescription || '',
          website: jobHoster.profile.companyWebsite || '',
          logo: jobHoster.profile.companyLogo || ''
        };
      }
    }
    
    // For admin and eliteTeam, company info must be provided in request
    // They should not automatically use their profile company info since they post for different companies
    if ((req.user.role === 'admin' || req.user.role === 'eliteTeam') && !jobData.company) {
      return res.status(400).json({
        success: false,
        message: 'Company information is required for admin and eliteTeam users'
      });
    }
    
    const job = new Job(jobData);
    await job.save();
    
    // Populate the job with profile information
    const populatedJob = await Job.findById(job._id)
      .populate({
        path: 'postedBy',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      });
    
    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: populatedJob
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all jobs (Public)
const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, location, employmentType, experienceLevel, verificationStatus, category, postedBy, postedByAdmin, sortBy } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'company.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (location) {
      filter.location = { $elemMatch: { $regex: location, $options: 'i' } };
    }
    
    if (employmentType) {
      filter.employmentType = employmentType;
    }
    
    if (experienceLevel) {
      filter.experienceLevel = experienceLevel;
    }
    
    // Add category filter if provided
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    // Add verification status filter if provided
    if (verificationStatus) {
      // Handle URL encoding issues for "not verified" status
      let status = verificationStatus;
      if (status) {
        // If status is an array (due to multiple values), take the first one
        if (Array.isArray(status)) {
          status = status[0];
        }
        
        // Normalize the status by trimming and handling common variations
        status = status.trim();
        
        // Handle common URL encoding variations for "not verified"
        if (status.toLowerCase() === "not verified" || 
            status === "not_verified" || 
            status === "not-verified" ||
            status === "not%20verified" ||
            status === "not+verified") {
          status = "not verified";
        } else if (status.toLowerCase() === "verified") {
          status = "verified";
        }
        
        filter.verificationStatus = status;
      }
    }
    
    // Add postedBy filter if provided
    if (postedBy) {
      filter.postedBy = postedBy;
    }
    
    // Add postedByAdmin filter if provided
    if (postedByAdmin === 'true') {
      // Find admin user
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        filter.postedBy = adminUser._id;
      }
    }
    
    // Determine sort order
    let sortOption = { createdAt: -1 }; // Default: newest first
    
    if (sortBy) {
      switch (sortBy) {
        case 'oldest':
          sortOption = { createdAt: 1 }; // Oldest first
          break;
        case 'salaryHighLow':
          // Sort by max salary descending (handling potential missing salary data)
          sortOption = { 'salary.max': -1 };
          break;
        case 'salaryLowHigh':
          // Sort by max salary ascending (handling potential missing salary data)
          sortOption = { 'salary.max': 1 };
          break;
        case 'company':
          // Sort by company name ascending
          sortOption = { 'company.name': 1 };
          break;
        default:
          // Default to newest
          sortOption = { createdAt: -1 };
      }
    }
    
    // Get jobs with pagination
    const jobs = await Job.find(filter)
      .populate({
        path: 'postedBy',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      })
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    // Get total count for pagination
    const total = await Job.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        jobs,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalJobs: total,
        filterOptions: {
          categories: CATEGORY_OPTIONS,
          experienceLevels: EXPERIENCE_LEVEL_OPTIONS,
          jobTypes: JOB_TYPE_OPTIONS,
          workTypes: WORK_TYPE_OPTIONS,
          interviewTypes: INTERVIEW_TYPE_OPTIONS
        }
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job by ID (Public)
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await Job.findById(id)
      .populate({
        path: 'postedBy',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      });
      
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update job (Job Hoster only - own jobs, Admin can update any job)
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    let job;
    
    // If user is admin or eliteTeam, allow updating any job
    if (req.user.role === 'admin' || req.user.role === 'eliteTeam') {
      job = await Job.findById(id);
    } else {
      // Find job and check ownership
      job = await Job.findOne({ _id: id, postedBy: req.user.userId });
    }
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you do not have permission to update this job'
      });
    }
    
    // Additional validation for walk-in interviews (only if interviewType is being updated)
    if (updateData.interviewType === 'Walk-in' && 
        (updateData.walkInDate || updateData.walkInTime) &&
        (!updateData.walkInDate || !updateData.walkInTime)) {
      return res.status(400).json({
        success: false,
        message: 'Both walk-in date and time are required for walk-in interviews'
      });
    }
    
    // Handle salary values as strings
    if (updateData.salary) {
      if (updateData.salary.min !== undefined) {
        updateData.salary.min = handleSalaryValue(updateData.salary.min);
      }
      
      if (updateData.salary.max !== undefined) {
        updateData.salary.max = handleSalaryValue(updateData.salary.max);
      }
      
      if (!updateData.salary.currency) {
        updateData.salary.currency = 'INR'; // Default currency
      }
    }
    
    // If company information is being updated, ensure it includes logo from profile
    if (updateData.company) {
      const jobHoster = await User.findById(req.user.userId);
      if (jobHoster && jobHoster.profile && jobHoster.profile.companyLogo && !updateData.company.logo) {
        updateData.company.logo = jobHoster.profile.companyLogo;
      }
    }
    
    // Handle conditional fields for walk-in interviews
    if (updateData.interviewType === 'Walk-in') {
      // walkInDate and walkInTime are required only if interviewType is Walk-in
    } else {
      // Clear walk-in fields if interview type is changed from walk-in
      if (updateData.walkInDate !== undefined) {
        updateData.walkInDate = undefined;
      }
      if (updateData.walkInTime !== undefined) {
        updateData.walkInTime = undefined;
      }
    }
    
    // Update job with provided fields
    Object.keys(updateData).forEach(key => {
      // Skip walk-in fields handling as they're handled above
      if (key !== 'walkInDate' && key !== 'walkInTime') {
        job[key] = updateData[key];
      }
    });
    
    // Handle walk-in fields separately
    if (updateData.walkInDate !== undefined) {
      job.walkInDate = updateData.walkInDate;
    }
    if (updateData.walkInTime !== undefined) {
      job.walkInTime = updateData.walkInTime;
    }
    
    await job.save();
    
    // Populate the updated job with profile information
    const populatedJob = await Job.findById(job._id)
      .populate({
        path: 'postedBy',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      });
    
    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: populatedJob
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Function to update all existing jobs with company logo from job hoster's profile
const updateAllJobsWithCompanyLogo = async (req, res) => {
  try {
    // Only allow this for admin or in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode'
      });
    }
    
    // Find all jobs
    const jobs = await Job.find({}).populate('postedBy', 'role profile');
    
    let updatedCount = 0;
    
    for (const job of jobs) {
      // Check if job has a job hoster/recruiter and if they have a company logo
      if (job.postedBy && (job.postedBy.role === 'jobHoster' || job.postedBy.role === 'recruiter') && 
          job.postedBy.profile && job.postedBy.profile.companyLogo) {
        
        // If job doesn't have a company logo, update it
        if (!job.company.logo) {
          job.company.logo = job.postedBy.profile.companyLogo;
          await job.save();
          updatedCount++;
        }
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} jobs with company logos`,
      updatedCount
    });
  } catch (error) {
    console.error('Update all jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Function to migrate existing jobs to have verificationStatus field
const migrateVerificationStatus = async (req, res) => {
  try {
    // Only allow this for admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin users can run this migration'
      });
    }
    
    // Find all jobs that don't have verificationStatus field
    const jobsWithoutVerificationStatus = await Job.find({ 
      verificationStatus: { $exists: false } 
    });
    
    // Update each job to have the default verificationStatus
    let updatedCount = 0;
    for (const job of jobsWithoutVerificationStatus) {
      job.verificationStatus = 'not verified';
      await job.save();
      updatedCount++;
    }
    
    // Also update jobs that might have null verificationStatus
    const jobsWithNullVerificationStatus = await Job.find({ 
      verificationStatus: null 
    });
    
    for (const job of jobsWithNullVerificationStatus) {
      job.verificationStatus = 'not verified';
      await job.save();
      updatedCount++;
    }
    
    res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} jobs with default verificationStatus`,
      updatedJobs: updatedCount
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete job (Job Hoster only - own jobs, Admin can delete any job)
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    
    // EliteTeam users cannot delete jobs
    if (req.user.role === 'eliteTeam') {
      return res.status(403).json({
        success: false,
        message: 'EliteTeam users do not have permission to delete jobs'
      });
    }
    
    let job;
    
    // If user is admin, allow deletion of any job
    if (req.user.role === 'admin') {
      job = await Job.findByIdAndDelete(id);
    } else {
      // Find job and check ownership (jobHoster or recruiter)
      job = await Job.findOneAndDelete({ _id: id, postedBy: req.user.userId });
    }
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you do not have permission to delete this job'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update application status (Job Hoster only - for own jobs)
const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params; // application ID
    const { status } = req.body; // new status
    
    // Validate status
    const validStatuses = ['pending', 'reviewed', 'interview', 'accepted', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: pending, reviewed, interview, accepted, rejected'
      });
    }
    
    // Find application
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    // Find the job to check ownership
    const job = await Job.findById(application.jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if user is admin, recruiter, or job owner
    // Convert both IDs to strings for comparison
    if (req.user.role !== 'admin' && req.user.role !== 'recruiter' && job.postedBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this application'
      });
    }
    
    // Update status
    application.status = status || application.status;
    await application.save();
    
    // Populate the response data
    const populatedApplication = await Application.findById(id)
      .populate('applicantId', 'name email profile')
      .populate('jobId');
    
    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      data: populatedApplication
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get application by ID (for debugging)
const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Fetching application with ID:', id);
    
    const application = await Application.findById(id);
    console.log('Application found:', application);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    // Also fetch job to check ownership
    const job = await Job.findById(application.jobId);
    console.log('Job found:', job);
    
    res.status(200).json({
      success: true,
      data: {
        application,
        job
      }
    });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Apply for job (Job Seeker only)
const applyForJob = async (req, res) => {
  try {
    const { id } = req.params;  // job ID
    let { resume, coverLetter } = req.body;
    
    // Check if job exists and is active
    const job = await Job.findOne({ _id: id, isActive: true });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or is no longer available'
      });
    }
    
    // Check if user has already applied
    const existingApplication = await Application.findOne({
      jobId: id,
      applicantId: req.user.userId
    });
    
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }
    
    // Get user profile to validate required fields
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate required profile fields
    if (!user.name || !user.email) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile with name and email before applying for jobs'
      });
    }
    
    // If no resume provided in request, check if user has resume in profile
    if (!resume) {
      if (user.profile && user.profile.resume) {
        resume = user.profile.resume;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Resume is required. Please upload a resume to your profile before applying'
        });
      }
    }
    
    // Create application
    const application = new Application({
      jobId: id,
      applicantId: req.user.userId,
      resume,
      coverLetter
    });
    
    await application.save();
    
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    console.error('Apply for job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job applications for a job (Job Hoster only - own jobs, Admins and Recruiters can view all)
const getJobApplications = async (req, res) => {
  try {
    const { id } = req.params;  // Changed from jobId to id to match route parameter
    
    // Check if job belongs to user or if user is a recruiter
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Allow admins and recruiters to view all jobs' applications
    if (req.user.role !== 'admin' && req.user.role !== 'recruiter' && job.postedBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view applications for this job'
      });
    }
    
    // Get applications for this job
    const applications = await Application.find({ jobId: id })  // Changed from jobId to id
      .populate({
        path: 'applicantId',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      });
    
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's job applications (Job Seeker only)
const getUserApplications = async (req, res) => {
  try {
    const applications = await Application.find({ applicantId: req.user.userId })
      .populate('jobId')
      .sort({ appliedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get jobs posted by user (Job Hoster only, Admins and Recruiters can see all)
const getUserJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Allow admins and recruiters to see all jobs, job hosters see only their own
    const filter = (req.user.role === 'admin' || req.user.role === 'recruiter') 
      ? {} 
      : { postedBy: req.user.userId };
    
    const jobs = await Job.find(filter)
      .populate({
        path: 'postedBy',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    const total = await Job.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        jobs,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalJobs: total
      }
    });
  } catch (error) {
    console.error('Get user jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job counts by category (Public)
const getJobCountsByCategory = async (req, res) => {
  try {
    // Aggregate jobs by category with counts
    const categoryCounts = await Job.aggregate([
      { $match: { isActive: true, verificationStatus: 'verified' } }, // Only count active and verified jobs
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1
        }
      },
      { $sort: { category: 1 } }
    ]);

    // Get all possible categories from the schema
    const allCategories = ["IT & Networking", "Sales & Marketing", "Accounting", "Data Science", "Digital Marketing", "Human Resource", "Customer Service", "Project Manager", "Other"];
    
    // Create a map with all predefined categories and their counts (0 if not found)
    const categoryMap = {};
    allCategories.forEach(category => {
      categoryMap[category] = 0;
    });
    
    // Update counts for all categories from aggregation results
    categoryCounts.forEach(item => {
      // Add the category to the map with its count
      categoryMap[item.category] = item.count;
    });
    
    // Convert to array format, ensuring all categories are included
    const result = Object.keys(categoryMap).map(category => ({
      category,
      count: categoryMap[category]
    }));

    res.status(200).json({
      success: true,
      data: result,
      totalJobs: result.reduce((sum, item) => sum + item.count, 0)
    });
  } catch (error) {
    console.error('Get job counts by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all filter options
const getAllFilterOptions = async (req, res) => {
  try {
    // Return all predefined filter options
    res.status(200).json({
      success: true,
      data: {
        categories: CATEGORY_OPTIONS,
        experienceLevels: EXPERIENCE_LEVEL_OPTIONS,
        jobTypes: JOB_TYPE_OPTIONS,
        workTypes: WORK_TYPE_OPTIONS,
        interviewTypes: INTERVIEW_TYPE_OPTIONS,
        noticePeriods: NOTICE_PERIOD_OPTIONS,
        shifts: SHIFT_OPTIONS
      }
    });
  } catch (error) {
    console.error('Get all filter options error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get specific applicant details for a job (Job Hoster only - own jobs, Admins and Recruiters can view all)
const getJobApplicationById = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    
    // Check if job belongs to user or if user is a recruiter
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Allow admins and recruiters to view all jobs' applications
    if (req.user.role !== 'admin' && req.user.role !== 'recruiter' && job.postedBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view applications for this job'
      });
    }
    
    // Get the specific application and populate applicant details
    const application = await Application.findById(applicationId)
      .populate({
        path: 'applicantId',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('Get job application by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job application statistics (Job Hoster, Recruiter, Admin, and EliteTeam)
const getJobApplicationStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all jobs posted by the user or all jobs for admins/recruiters
    const filter = (req.user.role === 'admin' || req.user.role === 'recruiter') 
      ? {} 
      : { postedBy: userId };
    
    const jobs = await Job.find(filter);
    
    if (jobs.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          overallStats: {
            weeklyStats: [],
            monthlyStats: [],
            totalApplications: 0
          },
          jobStats: []
        }
      });
    }
    
    // Calculate date ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get all applications for the user's jobs in the last month
    const jobIds = jobs.map(job => job._id);
    const monthlyApplications = await Application.find({
      jobId: { $in: jobIds },
      appliedAt: { $gte: oneMonthAgo }
    }).populate({
      path: 'jobId',
      populate: {
        path: 'postedBy',
        select: 'name email profile',
        populate: {
          path: 'profile'
        }
      }
    });
    
    // Get applications for the last week
    const weeklyApplications = monthlyApplications.filter(app => app.appliedAt >= oneWeekAgo);
    
    // Group weekly applications by day
    const weeklyStats = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      weeklyStats[dateString] = {
        count: 0,
        day: dayName
      };
    }
    
    weeklyApplications.forEach(app => {
      const date = app.appliedAt.toISOString().split('T')[0];
      if (weeklyStats[date] !== undefined) {
        weeklyStats[date].count++;
      }
    });
    
    // Format weekly stats
    const formattedWeeklyStats = Object.keys(weeklyStats).map(date => ({
      date,
      day: weeklyStats[date].day,
      count: weeklyStats[date].count
    }));
    
    // Group monthly applications by week
    const monthlyStats = [];
    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      
      const count = monthlyApplications.filter(app => {
        return app.appliedAt >= weekStart && app.appliedAt <= weekEnd;
      }).length;
      
      monthlyStats.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        count
      });
    }
    
    // Get job-specific statistics
    const jobStats = [];
    for (const job of jobs) {
      // Get applications for this specific job
      const jobApplications = monthlyApplications.filter(app => 
        app.jobId && app.jobId._id && app.jobId._id.toString() === job._id.toString()
      );
      
      // Get weekly applications for this job
      const jobWeeklyApplications = jobApplications.filter(app => app.appliedAt >= oneWeekAgo);
      
      // Group job weekly applications by day
      const jobWeeklyStats = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const dayName = dayNames[date.getDay()];
        jobWeeklyStats[dateString] = {
          count: 0,
          day: dayName
        };
      }
      
      jobWeeklyApplications.forEach(app => {
        const date = app.appliedAt.toISOString().split('T')[0];
        if (jobWeeklyStats[date] !== undefined) {
          jobWeeklyStats[date].count++;
        }
      });
      
      // Format job weekly stats
      const formattedJobWeeklyStats = Object.keys(jobWeeklyStats).map(date => ({
        date,
        day: jobWeeklyStats[date].day,
        count: jobWeeklyStats[date].count
      }));
      
      // Group job monthly applications by week
      const jobMonthlyStats = [];
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        
        const count = jobApplications.filter(app => {
          return app.appliedAt >= weekStart && app.appliedAt <= weekEnd;
        }).length;
        
        jobMonthlyStats.push({
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          count
        });
      }
      
      jobStats.push({
        jobId: job._id,
        jobTitle: job.title,
        weeklyStats: formattedJobWeeklyStats,
        monthlyStats: jobMonthlyStats,
        totalApplications: jobApplications.length
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        overallStats: {
          weeklyStats: formattedWeeklyStats,
          monthlyStats,
          totalApplications: monthlyApplications.length
        },
        jobStats
      }
    });
  } catch (error) {
    console.error('Get job application stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete user account (Job Seeker or Job Hoster)
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Get user before deletion to access their files
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete user's files from S3
    try {
      // Delete profile photo if exists
      if (user.profile && user.profile.photo) {
        await deleteFromS3(user.profile.photo);
      }
      
      // Delete resume if exists (job seekers)
      if (user.profile && user.profile.resume) {
        await deleteFromS3(user.profile.resume);
      }
      
      // Delete company logo if exists (job hosters)
      if (user.profile && user.profile.companyLogo) {
        await deleteFromS3(user.profile.companyLogo);
      }
    } catch (fileError) {
      console.error('Error deleting user files from S3:', fileError);
      // Continue with account deletion even if file deletion fails
    }
    
    // Delete user's applications (for job seekers)
    if (userRole === 'jobSeeker') {
      await Application.deleteMany({ applicantId: userId });
    }
    
    // Delete user's jobs and applications to those jobs (for job hosters and recruiters)
    if (userRole === 'jobHoster' || userRole === 'recruiter') {
      // Find all jobs posted by this hoster
      const jobs = await Job.find({ postedBy: userId });
      
      // Get job IDs
      const jobIds = jobs.map(job => job._id);
      
      // Delete all applications for these jobs
      if (jobIds.length > 0) {
        await Application.deleteMany({ jobId: { $in: jobIds } });
      }
      
      // Delete all jobs posted by this hoster
      await Job.deleteMany({ postedBy: userId });
    }
    
    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update job verification status (Admin and EliteTeam only)
const updateJobVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus } = req.body;

    // Validate verification status
    if (!['verified', 'not verified'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Verification status must be either "verified" or "not verified"'
      });
    }

    // Find the job and update verification status
    const job = await Job.findByIdAndUpdate(
      id,
      { verificationStatus },
      { new: true, runValidators: true }
    ).populate({
      path: 'postedBy',
      select: 'name email profile',
      populate: {
        path: 'profile'
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job verification status updated successfully',
      data: job
    });
  } catch (error) {
    console.error('Update job verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get jobs by verification status (Admin and EliteTeam only)
const getJobsByVerificationStatus = async (req, res) => {
  try {
    let { verificationStatus, page = 1, limit = 10 } = req.query;
    
    // Handle URL encoding issues for "not verified" status
    if (verificationStatus) {
      // If verificationStatus is an array (due to multiple values), take the first one
      if (Array.isArray(verificationStatus)) {
        verificationStatus = verificationStatus[0];
      }
      
      // Normalize the status by trimming and handling common variations
      verificationStatus = verificationStatus.trim();
      
      // Handle common URL encoding variations for "not verified"
      if (verificationStatus.toLowerCase() === "not verified" || 
          verificationStatus === "not_verified" || 
          verificationStatus === "not-verified" ||
          verificationStatus === "not%20verified" ||
          verificationStatus === "not+verified") {
        verificationStatus = "not verified";
      } else if (verificationStatus.toLowerCase() === "verified") {
        verificationStatus = "verified";
      }
    }
    
    // Validate verification status
    const validStatuses = ['verified', 'not verified'];
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Verification status must be either "verified" or "not verified"'
      });
    }
    
    // Build filter object
    const filter = { 
      isActive: true,
      verificationStatus: verificationStatus
    };
    
    // Get jobs with pagination
    const jobs = await Job.find(filter)
      .populate({
        path: 'postedBy',
        select: 'name email role profile',
        populate: {
          path: 'profile'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    // Get total count for pagination
    const total = await Job.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        jobs,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalJobs: total
      }
    });
  } catch (error) {
    console.error('Get jobs by verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job counts by verification status
const getJobCountsByVerificationStatus = async (req, res) => {
  try {
    // Count verified jobs
    const verifiedJobsCount = await Job.countDocuments({ 
      isActive: true, 
      verificationStatus: 'verified' 
    });
    
    // Count not verified jobs
    const notVerifiedJobsCount = await Job.countDocuments({ 
      isActive: true, 
      verificationStatus: 'not verified' 
    });
    
    // Also count jobs without verificationStatus field (should be 0 after migration)
    const jobsWithoutVerificationStatus = await Job.countDocuments({ 
      isActive: true, 
      verificationStatus: { $exists: false } 
    });
    
    // Also count jobs with null verificationStatus (should be 0 after migration)
    const jobsWithNullVerificationStatus = await Job.countDocuments({ 
      isActive: true, 
      verificationStatus: null 
    });
    
    res.status(200).json({
      success: true,
      data: {
        verified: verifiedJobsCount,
        notVerified: notVerifiedJobsCount,
        withoutVerificationStatus: jobsWithoutVerificationStatus,
        withNullVerificationStatus: jobsWithNullVerificationStatus,
        total: verifiedJobsCount + notVerifiedJobsCount + jobsWithoutVerificationStatus + jobsWithNullVerificationStatus
      }
    });
  } catch (error) {
    console.error('Get job counts by verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job counts by team member
const getJobCountsByTeamMember = async (req, res) => {
  try {
    // Find all eliteTeam users
    const teamMembers = await User.find({ role: 'eliteTeam' })
      .select('name email');
    
    // Get job counts for each team member
    const teamMemberStats = [];
    
    for (const member of teamMembers) {
      const jobCount = await Job.countDocuments({ 
        postedBy: member._id,
        isActive: true
      });
      
      teamMemberStats.push({
        memberId: member._id,
        name: member.name,
        email: member.email,
        jobCount: jobCount
      });
    }
    
    // Sort by job count descending
    teamMemberStats.sort((a, b) => b.jobCount - a.jobCount);
    
    res.status(200).json({
      success: true,
      data: teamMemberStats
    });
  } catch (error) {
    console.error('Get job counts by team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all companies with job counts (Accessible to all user roles)
const getAllCompanies = async (req, res) => {
  try {
    // Aggregate jobs by company name with counts
    const companyAggregation = await Job.aggregate([
      { $match: { isActive: true } }, // Only count active jobs
      {
        $group: {
          _id: "$company.name",
          count: { $sum: 1 },
          companyInfo: { $first: "$company" }
        }
      },
      {
        $project: {
          _id: 0,
          companyName: "$_id",
          count: 1,
          companyInfo: 1
        }
      },
      { $sort: { count: -1, companyName: 1 } } // Sort by count descending, then by name
    ]);

    // Filter out any null/empty company names
    const companies = companyAggregation.filter(company => company.companyName);
    
    res.status(200).json({
      success: true,
      data: companies,
      totalCompanies: companies.length
    });
  } catch (error) {
    console.error('Get all companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  applyForJob,
  getJobApplications,
  getUserApplications,
  getUserJobs,
  updateApplicationStatus,
  getApplicationById,
  deleteAccount,
  updateAllJobsWithCompanyLogo,
  getJobCountsByCategory,
  getJobApplicationById,
  getJobApplicationStats,
  updateJobVerificationStatus,
  getJobsByVerificationStatus,
  migrateVerificationStatus,
  getJobCountsByVerificationStatus,
  getJobCountsByTeamMember,
  getAllCompanies, // Add the new export
  getJobEnumOptions,
  getAllFilterOptions
};
