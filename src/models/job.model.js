import mongoose from 'mongoose';

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
    enum: ['Full-time', 'Part-time'],
    default: 'Full-time',
    required: false
  },
  interviewType: { // New field
    type: String,
    enum: ['Online', 'On-site', 'Walk-in'],
    required: true
  },
  workType: { // New field
    type: String,
    enum: ['Remote', 'On-site', 'Hybrid'],
    required: true
  },
  minEducation: { // New field
    type: String,
    required: false
  },
  salary: {
    min: Number,
    max: Number,
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
    enum: ['Fresher', '0-1 year of experience', '1-2 year of experience', '2-4 year of experience', '5+ year of experience'],
    required: true
  },
  noticePeriod: { // New field
    type: String,
    enum: ['Immediate Joiner', 'Upto 1 week', 'Upto 1 month', 'Upto 2 month', 'Any'],
    required: true
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
    enum: ["IT & Networking", "Sales & Marketing", "Accounting", "Data Science", "Digital Marketing", "Human Resource", "Customer Service", "Project Manager", "Other"],
    required: true
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
    enum: ['Day', 'Night'],
    required: false
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
    enum: ['verified', 'not verified'],
    default: 'not verified'
  }
}, { timestamps: true });

export default mongoose.model('Job', jobSchema);