import Job from '../models/job.model.js';
import Application from '../models/application.model.js';
import User from '../models/auth.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';

// Create a new job (Job Hoster only)
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
      applicationDeadline,
      category,
      // New fields
      numberOfOpenings,
      yearOfPassing,
      shift,
      walkInDate,
      walkInTime
    } = req.body;

    // Validate required fields
    if (!title || !description || !location || !interviewType || !workType || !experienceLevel || !noticePeriod) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, location, interviewType, workType, experienceLevel, noticePeriod'
      });
    }

    // Additional validation for walk-in interviews
    if (interviewType === 'Walk-in' && (!walkInDate || !walkInTime)) {
      return res.status(400).json({
        success: false,
        message: 'Walk-in date and time are required for walk-in interviews'
      });
    }

    // Get the job hoster's profile to populate company information
    const jobHoster = await User.findById(req.user.userId);
    
    if (!jobHoster || (jobHoster.role !== 'jobHoster' && jobHoster.role !== 'recruiter')) {
      return res.status(403).json({
        success: false,
        message: 'Only job hosters and recruiters can create jobs'
      });
    }

    // Prepare company information from job hoster's profile
    const companyInfo = {
      name: jobHoster.profile?.companyName || '',
      description: jobHoster.profile?.companyDescription || '',
      website: jobHoster.profile?.companyWebsite || '',
      logo: jobHoster.profile?.companyLogo || ''
    };

    // Create new job
    const job = new Job({
      title,
      description,
      company: companyInfo,
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
      applicationDeadline,
      category,
      postedBy: req.user.userId,
      // New fields
      numberOfOpenings,
      yearOfPassing,
      shift,
      walkInDate: interviewType === 'Walk-in' ? walkInDate : undefined,
      walkInTime: interviewType === 'Walk-in' ? walkInTime : undefined
    });

    await job.save();

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
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
    const { page = 1, limit = 10, search, location, employmentType, experienceLevel } = req.query;
    
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
      filter.location = { $regex: location, $options: 'i' };
    }
    
    if (employmentType) {
      filter.employmentType = employmentType;
    }
    
    if (experienceLevel) {
      filter.experienceLevel = experienceLevel;
    }
    
    // Get jobs with pagination
    const jobs = await Job.find(filter)
      .populate('postedBy', 'name email profile')
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
      .populate('postedBy', 'name email profile');
      
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

// Update job (Job Hoster only - own jobs)
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find job and check ownership
    const job = await Job.findOne({ _id: id, postedBy: req.user.userId });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you do not have permission to update this job'
      });
    }
    
    // Additional validation for walk-in interviews
    if (updateData.interviewType === 'Walk-in' && 
        (updateData.walkInDate || updateData.walkInTime) &&
        (!updateData.walkInDate || !updateData.walkInTime)) {
      return res.status(400).json({
        success: false,
        message: 'Both walk-in date and time are required for walk-in interviews'
      });
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
      if (updateData.walkInDate) job.walkInDate = updateData.walkInDate;
      if (updateData.walkInTime) job.walkInTime = updateData.walkInTime;
    } else {
      // Clear walk-in fields if interview type is changed from walk-in
      job.walkInDate = undefined;
      job.walkInTime = undefined;
    }
    
    // Update job with other fields
    Object.keys(updateData).forEach(key => {
      // Skip walk-in fields as they're handled separately
      if (key !== 'walkInDate' && key !== 'walkInTime') {
        job[key] = updateData[key];
      }
    });
    
    await job.save();
    
    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: job
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

// Delete job (Job Hoster only - own jobs)
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find job and check ownership
    const job = await Job.findOneAndDelete({ _id: id, postedBy: req.user.userId });
    
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
    
    // Check if job belongs to the authenticated hoster or if user is a recruiter
    // Convert both IDs to strings for comparison
    if (req.user.role !== 'recruiter' && job.postedBy.toString() !== req.user.userId.toString()) {
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

// Get job applications for a job (Job Hoster only - own jobs)
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
    
    // Allow recruiters to view all jobs' applications
    if (req.user.role !== 'recruiter' && job.postedBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view applications for this job'
      });
    }
    
    // Get applications for this job
    const applications = await Application.find({ jobId: id })  // Changed from jobId to id
      .populate('applicantId', 'name email profile');
    
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

// Get jobs posted by user (Job Hoster only)
const getUserJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Allow recruiters to see all jobs, job hosters see only their own
    const filter = req.user.role === 'recruiter' 
      ? {} 
      : { postedBy: req.user.userId };
    
    const jobs = await Job.find(filter)
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
      { $match: { isActive: true } }, // Only count active jobs
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
    
    // Create a map with all categories and their counts (0 if not found)
    const categoryMap = {};
    allCategories.forEach(category => {
      categoryMap[category] = 0;
    });
    
    // Update counts for categories that have jobs
    categoryCounts.forEach(item => {
      if (allCategories.includes(item.category)) {
        categoryMap[item.category] = item.count;
      }
    });
    
    // Convert to array format
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

// Get specific applicant details for a job (Job Hoster only - own jobs)
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
    
    // Allow recruiters to view all jobs' applications
    if (req.user.role !== 'recruiter' && job.postedBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view applications for this job'
      });
    }
    
    // Get the specific application and populate applicant details
    const application = await Application.findById(applicationId)
      .populate('applicantId', 'name email profile');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    // Verify that this application is for the specified job
    if (application.jobId.toString() !== jobId) {
      return res.status(404).json({
        success: false,
        message: 'Application not found for this job'
      });
    }
    
    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('Get job application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get job application statistics for job hoster dashboard
const getJobApplicationStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all jobs posted by the user or all jobs for recruiters
    const filter = req.user.role === 'recruiter' 
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
    }).populate('jobId', 'title');
    
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
    
    // Delete user's jobs and applications to those jobs (for job hosters)
    if (userRole === 'jobHoster') {
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
  getJobApplicationStats
};
