import User from '../models/auth.model.js';
import Application from '../models/application.model.js';
import Job from '../models/job.model.js';

// Get all job seekers (Recruiters only)
const getAllJobSeekers = async (req, res) => {
  try {
    // Find all job seekers
    const jobSeekers = await User.find({ role: 'jobSeeker' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: jobSeekers
    });
  } catch (error) {
    console.error('Get all job seekers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get specific job seeker details (Recruiters only)
const getJobSeekerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Find job seeker by ID
    const jobSeeker = await User.findById(id)
      .select('-password');

    if (!jobSeeker || jobSeeker.role !== 'jobSeeker') {
      return res.status(404).json({
        success: false,
        message: 'Job seeker not found'
      });
    }

    res.status(200).json({
      success: true,
      data: jobSeeker
    });
  } catch (error) {
    console.error('Get job seeker details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all applications (Recruiters only)
const getAllApplications = async (req, res) => {
  try {
    // Find all applications and populate related data
    const applications = await Application.find()
      .populate('applicantId', 'name email profile')
      .populate('jobId')
      .sort({ appliedAt: -1 });

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get applications by job seeker ID (Recruiters only)
const getApplicationsByJobSeeker = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if job seeker exists
    const jobSeeker = await User.findById(id);
    if (!jobSeeker || jobSeeker.role !== 'jobSeeker') {
      return res.status(404).json({
        success: false,
        message: 'Job seeker not found'
      });
    }

    // Find applications for this job seeker
    const applications = await Application.find({ applicantId: id })
      .populate('jobId')
      .sort({ appliedAt: -1 });

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get applications by job seeker error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all jobs (Recruiters can see all jobs)
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

// Get job by ID (Recruiters can see any job)
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

export {
  getAllJobSeekers,
  getJobSeekerDetails,
  getAllApplications,
  getApplicationsByJobSeeker,
  getAllJobs,
  getJobById
};