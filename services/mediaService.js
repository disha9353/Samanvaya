const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary (Make sure to have these in your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a single local file to Cloudinary and clean it up locally
 * @param {Object} file - The file object (e.g., from Multer)
 * @returns {Promise<string>} The secure URL of the uploaded media
 */
const uploadToCloudinary = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'ocean_reports',
      resource_type: 'auto' // Handle both images and videos
    });
    
    // Remove the temporary local file after successful upload
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    // Attempt local cleanup on error too
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw new Error('Media upload failed');
  }
};

/**
 * Upload main media and additional media to Cloudinary
 * @param {Object} files - The request files object (e.g. req.files)
 * @returns {Promise<Object>} An object containing mainMediaUrl and additionalMediaUrls
 */
exports.uploadReportMedia = async (files) => {
  if (!files || !files.mainMedia || files.mainMedia.length === 0) {
    throw new Error('mainMedia is required');
  }

  // Upload mainMedia (required)
  const mainMediaUrl = await uploadToCloudinary(files.mainMedia[0]);

  // Upload additionalMedia (optional multiple)
  const additionalMediaUrls = [];
  if (files.additionalMedia && files.additionalMedia.length > 0) {
    const uploadPromises = files.additionalMedia.map(file => uploadToCloudinary(file));
    const uploadedUrls = await Promise.all(uploadPromises);
    additionalMediaUrls.push(...uploadedUrls);
  }

  // Return secure URLs
  return {
    mainMediaUrl,
    additionalMediaUrls
  };
};
