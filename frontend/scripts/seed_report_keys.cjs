const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../src/locales');

// All newly discovered keys with English as base
const newKeys = {
  // ReportSubmissionPage
  "failed_to_capture_gps_please_e": "Failed to capture GPS. Please enable location services.",
  "geolocation_is_not_supported_b": "Geolocation is not supported by your browser.",
  "please_provide_an_image_video_": "Please provide an image/video, category, and GPS location.",
  "an_error_occurred_during_submi": "An error occurred during submission.",
  "transmitting_data": "Transmitting Data...",
  "broadcast_submission": "Broadcast Submission",
  // ReportsFeedPage
  "location_access_denied": "Location access denied. Unable to find nearby reports.",
  "failed_to_load_reports": "Failed to load reports.",
  "need_live_location_to_cast_veri": "Need live location to cast verified votes.",
  "error_occurred_while_voting": "Error occurred while voting.",
  "already_verified": "You have already verified this.",
  "too_far_to_verify": "You are too far from this hazardous zone to verify.",
  "confirmed": "✔ Confirmed",
  "out_of_range": "Out of Range",
  "confirm_issue": "Confirm Issue",
};

// Hindi translations
const hiKeys = {
  "failed_to_capture_gps_please_e": "GPS कैप्चर करने में विफल। कृपया लोकेशन सेवाएं सक्षम करें।",
  "geolocation_is_not_supported_b": "आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता।",
  "please_provide_an_image_video_": "कृपया छवि/वीडियो, श्रेणी और GPS स्थान प्रदान करें।",
  "an_error_occurred_during_submi": "सबमिट करने के दौरान एक त्रुटि हुई।",
  "transmitting_data": "डेटा भेजा जा रहा है...",
  "broadcast_submission": "रिपोर्ट सबमिट करें",
  "location_access_denied": "स्थान पहुँच अस्वीकृत। नज़दीकी रिपोर्ट नहीं मिल सकी।",
  "failed_to_load_reports": "रिपोर्ट लोड करने में विफल।",
  "need_live_location_to_cast_veri": "सत्यापित वोट देने के लिए लाइव लोकेशन जरूरी है।",
  "error_occurred_while_voting": "वोट करते समय त्रुटि आई।",
  "already_verified": "आपने इसे पहले ही सत्यापित किया है।",
  "too_far_to_verify": "आप इस खतरनाक क्षेत्र से बहुत दूर हैं।",
  "confirmed": "✔ पुष्टि हो गई",
  "out_of_range": "रेंज से बाहर",
  "confirm_issue": "मुद्दे की पुष्टि करें",
};

// Kannada translations
const knKeys = {
  "failed_to_capture_gps_please_e": "GPS ಕ್ಯಾಪ್ಚರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ. ಸ್ಥಳ ಸೇವೆಗಳನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.",
  "geolocation_is_not_supported_b": "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಜಿಯೋಲೊಕೇಶನ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ.",
  "please_provide_an_image_video_": "ದಯವಿಟ್ಟು ಚಿತ್ರ/ವೀಡಿಯೊ, ವರ್ಗ ಮತ್ತು GPS ಸ್ಥಳ ಒದಗಿಸಿ.",
  "an_error_occurred_during_submi": "ಸಲ್ಲಿಕೆಯ ಸಮಯದಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ.",
  "transmitting_data": "ಮಾಹಿತಿ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...",
  "broadcast_submission": "ವರದಿ ಸಲ್ಲಿಸಿ",
  "location_access_denied": "ಸ್ಥಳ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ. ಹತ್ತಿರದ ವರದಿಗಳು ಸಿಗಲಿಲ್ಲ.",
  "failed_to_load_reports": "ವರದಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ.",
  "need_live_location_to_cast_veri": "ಪರಿಶೀಲಿತ ಮತ ಹಾಕಲು ಲೈವ್ ಸ್ಥಳ ಅಗತ್ಯ.",
  "error_occurred_while_voting": "ಮತ ಹಾಕುವ ಸಮಯದಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ.",
  "already_verified": "ನೀವು ಈಗಾಗಲೇ ಇದನ್ನು ಪರಿಶೀಲಿಸಿದ್ದೀರಿ.",
  "too_far_to_verify": "ಈ ಅಪಾಯಕಾರಿ ವಲಯದಿಂದ ನೀವು ತುಂಬಾ ದೂರದಲ್ಲಿದ್ದೀರಿ.",
  "confirmed": "✔ ದೃಢಪಡಿಸಲಾಗಿದೆ",
  "out_of_range": "ವ್ಯಾಪ್ತಿಯ ಹೊರಗೆ",
  "confirm_issue": "ಸಮಸ್ಯೆ ದೃಢಪಡಿಸಿ",
};

function updateLocale(lang, updates) {
  const file = path.join(localesPath, `${lang}.json`);
  if (!fs.existsSync(file)) return;
  let data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.auto = data.auto || {};
  Object.assign(data.auto, updates);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`✅ Updated ${lang}.json (${Object.keys(updates).length} keys)`);
}

updateLocale('en', newKeys);
updateLocale('hi', hiKeys);
updateLocale('kn', knKeys);

// Also seed the same hi/kn into te, ta, ml as fallback to English (they'll be machine-translated later)
['te', 'ta', 'ml'].forEach(lang => updateLocale(lang, newKeys));
