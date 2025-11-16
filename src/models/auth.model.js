import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Define constants for enum values
const GENDER_OPTIONS = ["male", "female", "other"];
const NOTICE_PERIOD_OPTIONS = ['Immediate Joiner', 'Upto 1 week', 'Upto 1 month', 'Upto 2 month', 'Any'];
const EXPERIENCE_OPTIONS = ['Fresher', '0-1 year of experience', '1-2 year of experience', '2-4 year of experience', '5+ year of experience', '10+ year of experience'];
const CATEGORY_OPTIONS = ["IT & Networking", "Sales & Marketing", "Accounting", "Data Science", "Digital Marketing", "Human Resource", "Customer Service", "Project Manager", "Other"];
const EDUCATION_OPTIONS = [
  "High School (10th)",
  "Higher Secondary (12th)",
  "Diploma",
  "Bachelor of Arts (BA)",
  "Bachelor of Science (BSc)",
  "Bachelor of Commerce (BCom)",
  "Bachelor of Technology (BTech)",
  "Bachelor of Engineering (BE)",
  "Bachelor of Computer Applications (BCA)",
  "Bachelor of Business Administration (BBA)",
  "Master of Arts (MA)",
  "Master of Science (MSc)",
  "Master of Commerce (MCom)",
  "Master of Technology (MTech)",
  "Master of Engineering (ME)",
  "Master of Computer Applications (MCA)",
  "Master of Business Administration (MBA)",
  "PhD (Doctorate)",
  "Other"
];

const jobSeekerProfileSchema = new mongoose.Schema({
  age: Number,
  address: String,
  phone: String, // New field for phone number
  githubUrl: String, // New field for GitHub URL
  linkedinUrl: String, // New field for LinkedIn URL
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
  skills: [String], // New field for job seeker skills
  photo: String, 
  resume: String, 
  gender: {
    type: String
   
  },
  noticePeriod: {
    type: String
   
  },
  preferredLocation: String,
  designation: String,
  expInWork: {
    type: String
   
  },
  salaryExpectation: String,
  preferredCategory: {
    type: String
   
  },
  highestEducation: {
    type: String
  }
}, { _id: false });

const jobHosterProfileSchema = new mongoose.Schema({
  companyName: String,
  companyDescription: String,
  companyWebsite: String,
  companyEmail: String, // New field
  numberOfEmployees: Number, // New field
  companyPhone: String, // New field
  companyLogo: String, // URL to S3 uploaded company logo
  companyDocument: [String], // Array of URLs to S3 uploaded company documents
  photo: String, // URL to S3 uploaded personal photo
  phone: String, // New field for phone number
  panCardNumber: String,
  gstNumber: String
}, { _id: false });

const recruiterProfileSchema = new mongoose.Schema({
  companyName: String,
  companyDescription: String,
  companyWebsite: String,
  companyEmail: String,
  numberOfEmployees: Number,
  companyPhone: String,
  companyLogo: String, // URL to S3 uploaded company logo
  companyDocument: [String], // Array of URLs to S3 uploaded company documents
  photo: String, // URL to S3 uploaded personal photo
  phone: String,
  panCardNumber: String,
  gstNumber: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['jobSeeker', 'jobHoster', 'recruiter', 'admin', 'eliteTeam'],
    required: true
  },
  profile: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Fields for forgot password functionality
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Fields for Google authentication
  google: {
    id: String,
    token: String
  }
}, { timestamps: true });

userSchema.index({ email: 1, role: 1 }, { unique: true });

userSchema.pre('save', async function(next) {
  // Skip password hashing for Google users
  if (this.google && this.google.id) return next();
  
  if (this.role === 'admin' || this.role === 'eliteTeam') return next();
  
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Google users don't have passwords
  if (this.google && this.google.id) return true;
  return bcrypt.compare(candidatePassword, this.password);
};

// Export constants for use in controllers
export { 
  GENDER_OPTIONS, 
  NOTICE_PERIOD_OPTIONS, 
  EXPERIENCE_OPTIONS, 
  CATEGORY_OPTIONS, 
  EDUCATION_OPTIONS 
};

export default mongoose.model('User', userSchema);