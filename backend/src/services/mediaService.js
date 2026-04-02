/**
 * mediaService.js — Cloudinary upload helper for ocean report media
 */

const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'ocean_reports',
      resource_type: 'auto'
    });
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Media upload failed');
  }
};

exports.uploadReportMedia = async (files) => {
  if (!files?.mainMedia?.length) throw new Error('mainMedia is required');

  const mainMediaUrl = await uploadToCloudinary(files.mainMedia[0]);

  const additionalMediaUrls = [];
  if (files.additionalMedia?.length) {
    const urls = await Promise.all(files.additionalMedia.map(uploadToCloudinary));
    additionalMediaUrls.push(...urls);
  }

  return { mainMediaUrl, additionalMediaUrls };
};
