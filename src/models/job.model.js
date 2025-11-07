import mongoose from 'mongoose';

// Define constants for enum values
const JOB_TYPE_OPTIONS = ['Full-time', 'Part-time'];
const INTERVIEW_TYPE_OPTIONS = ['Online', 'On-site', 'Walk-in'];
const WORK_TYPE_OPTIONS = ['Remote', 'On-site', 'Hybrid'];
const EXPERIENCE_LEVEL_OPTIONS = ['Fresher', '0-1 year of experience', '1-2 year of experience', '2-4 year of experience', '5+ year of experience'];
const NOTICE_PERIOD_OPTIONS = ['Immediate Joiner', 'Upto 1 week', 'Upto 1 month', 'Upto 2 month', 'Any'];
const CATEGORY_OPTIONS = ["IT & Networking", "Sales & Marketing", "Accounting", "Data Science", "Digital Marketing", "Human Resource", "Customer Service", "Project Manager", "Other"];
const SHIFT_OPTIONS = ['Day', 'Night'];
const VERIFICATION_STATUS_OPTIONS = ['verified', 'not verified'];

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  company: {
    name: {
      type: String,
      required: true
    },
    description: String,
    website: String,
    logo: String
  },
  location: {
    type: [String],
    required: true
  },
  jobType: { // Replaced employmentType
    type: String,
    default: 'Full-time',
    required: false
    // No enum constraint - allows both predefined and custom values
  },
  interviewType: { // New field
    type: String,
    required: true
    // No enum constraint - allows both predefined and custom values
  },
  workType: { // New field
    type: String,
    required: true
    // No enum constraint - allows both predefined and custom values
  },
  minEducation: { // New field
    type: String,
    required: false
  },
  salary: {
    min: String, // Changed from Number to String
    max: String, // Changed from Number to String
    currency: {
      type: String,
      default: 'INR'
    }
  },
  requirements: [String],
  responsibilities: [String],
  skills: [String],
  experienceLevel: {
    type: String,
    required: true
    // No enum constraint - allows both predefined and custom values
  },
  noticePeriod: { // New field
    type: String,
    required: true
    // No enum constraint - allows both predefined and custom values
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicationDeadline: Date,
  category: {
    type: String,
    required: true
    // No enum constraint - allows both predefined and custom values
  },
  // New fields
  numberOfOpenings: {
    type: Number,
    required: false
  },
  yearOfPassing: {
    type: Number,
    required: false
  },
  shift: {
    type: String,
    required: false
    // No enum constraint - allows both predefined and custom values
  },
  walkInDate: {
    type: Date,
    required: false
  },
  walkInTime: {
    type: String,
    required: false
  },
  // Verification status field
  verificationStatus: {
    type: String,
    default: 'not verified'
    // No enum constraint - allows both predefined and custom values
  }
}, { timestamps: true });

// Export constants for use in controllers
export { 
  JOB_TYPE_OPTIONS, 
  INTERVIEW_TYPE_OPTIONS, 
  WORK_TYPE_OPTIONS, 
  EXPERIENCE_LEVEL_OPTIONS, 
  NOTICE_PERIOD_OPTIONS, 
  CATEGORY_OPTIONS, 
  SHIFT_OPTIONS, 
  VERIFICATION_STATUS_OPTIONS 
};

export default mongoose.model('Job', jobSchema);