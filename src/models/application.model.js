import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resume: String, // URL to uploaded resume
  coverLetter: String,
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'interview', 'accepted', 'rejected'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure a user can only apply to a job once
applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);