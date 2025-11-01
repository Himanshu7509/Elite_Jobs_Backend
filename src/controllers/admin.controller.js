import User from '../models/auth.model.js';
import Job from '../models/job.model.js';
import Application from '../models/application.model.js';
import { deleteFromS3 } from '../controllers/file.controller.js';

// Create a job directly (Admin only)
const createJobDirect = async (req, res) => {
  try {
    const {
      title,
      description,
      company, // Admin provides full company details
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
    if (!title || !description || !company || !location || !interviewType || !workType || !experienceLevel || !noticePeriod) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, company, location, interviewType, workType, experienceLevel, noticePeriod'
      });
    }

    // Additional validation for location array
    if (location && Array.isArray(location) && location.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one location is required'
      });
    }

    // Additional validation for walk-in interviews
    if (interviewType === 'Walk-in' && (!walkInDate || !walkInTime)) {
      return res.status(400).json({
        success: false,
        message: 'Walk-in date and time are required for walk-in interviews'
      });
    }

    // Validate company object
    if (!company.name) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Create new job with provided company details
    const job = new Job({
      title,
      description,
      company: {
        name: company.name,
        description: company.description || '',
        website: company.website || '',
        logo: company.logo || ''
      },
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
      postedBy: req.user.userId, // Admin user ID
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

// Get all applicants with their profile details and job applications (Admin only)
const getAllApplicants = async (req, res) => {
  try {
    // Find all users with their applications
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    // Get all applications with populated data
    const applications = await Application.find({})
      .populate('applicantId', 'name email role profile')
      .populate('jobId')
      .sort({ appliedAt: -1 });

    // Group applications by user
    const applicantsMap = {};
    
    // Initialize all users in the map
    users.forEach(user => {
      applicantsMap[user._id.toString()] = {
        user: user,
        applications: []
      };
    });

    // Add applications to respective users
    applications.forEach(application => {
      const userId = application.applicantId._id.toString();
      if (applicantsMap[userId]) {
        applicantsMap[userId].applications.push(application);
      }
    });

    // Convert map to array
    const applicants = Object.values(applicantsMap);

    res.status(200).json({
      success: true,
      data: applicants
    });
  } catch (error) {
    console.error('Get all applicants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete any user account and all associated data (Admin only)
const deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    
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
      
      // Delete company logo if exists (job hosters/recruiters)
      if (user.profile && user.profile.companyLogo) {
        await deleteFromS3(user.profile.companyLogo);
      }
    } catch (fileError) {
      console.error('Error deleting user files from S3:', fileError);
      // Continue with account deletion even if file deletion fails
    }
    
    // Delete user's applications (for job seekers)
    if (user.role === 'jobSeeker') {
      await Application.deleteMany({ applicantId: userId });
    }
    
    // Delete user's jobs and applications to those jobs (for job hosters/recruiters/eliteTeam)
    if (user.role === 'jobHoster' || user.role === 'recruiter' || user.role === 'eliteTeam') {
      // Find all jobs posted by this user
      const jobs = await Job.find({ postedBy: userId });
      
      // Get job IDs
      const jobIds = jobs.map(job => job._id);
      
      // Delete all applications for these jobs
      if (jobIds.length > 0) {
        await Application.deleteMany({ jobId: { $in: jobIds } });
      }
      
      // Delete all jobs posted by this user
      await Job.deleteMany({ postedBy: userId });
    }
    
    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({
      success: true,
      message: 'User account and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete user account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all jobs (Admin can see all jobs)
const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, location, employmentType, experienceLevel, postedByAdmin, postedBy } = req.query;
    
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
    
    // Filter by admin posted jobs if requested
    if (postedByAdmin === 'true') {
      filter.postedBy = req.user.userId;
    }
    
    // Filter by specific user ID if provided
    if (postedBy) {
      filter.postedBy = postedBy;
    }
    
    // Get jobs with pagination
    const jobs = await Job.find(filter)
      .populate('postedBy', 'name email role profile')
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

export {
  createJobDirect,
  getAllApplicants,
  deleteUserAccount,
  getAllJobs
};