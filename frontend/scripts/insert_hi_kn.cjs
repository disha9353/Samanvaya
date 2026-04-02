const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../src/locales');

const hiTranslations = {
  "introducing_samanvaya": "समन्वय प्रस्तुत है",
  "samanvaya": "समन्वय",
  "the_waves_of_change": "बदलाव की लहरें",
  "harmony_between_people_resourc": "लोगों, संसाधनों और प्रकृति के बीच सामंजस्य।",
  "explore_marketplace": "मार्केटप्लेस देखें",
  "join_a_campaign": "अभियान से जुड़ें",
  "get_started": "शुरू करें",
  "sign_in": "साइन इन करें",
  "creating_harmony": "सामंजस्य स्थापित करना",
  "by_connecting_individuals_with": "व्यक्तियों को टिकाऊ कार्यों से जोड़कर हम सुरक्षित भविष्य बनाते हैं।",
  "sustainable_barter": "टिकाऊ वस्तु विनिमय",
  "exchange_pre_loved_items_inste": "चीजों को फेंकने के बजाय उनका आदान-प्रदान करें।",
  "community_campaigns": "सामुदायिक अभियान",
  "join_eco_campaigns_beach_clean": "प्रकृति को बचाने के लिए इको-अभियानों में शामिल हों।",
  "impact_tracking": "प्रभाव ट्रैकिंग",
  "watch_your_personal_ecological": "अपना व्यक्तिगत पारिस्थितिक प्रभाव बढ़ते हुए देखें।",
  "impact_in_action": "प्रभाव क्रियान्वित",
  "observe_the_real_difference_ou": "हमारे समुदाय द्वारा लाए गए वास्तविक बदलाव को देखें।",
  "view_ocean_reports": "प्रदूषण रिपोर्ट देखें",

  "ocean_reports_feed": "प्रदूषण रिपोर्ट फ़ीड",
  "verified_ecological_hazards_wi": "आपके 50 किमी के दायरे में सत्यापित खतरे।",
  "submit_new_report": "नई रिपोर्ट दर्ज करें",
  "no_reports_found": "कोई रिपोर्ट नहीं मिली",
  "your_oceanic_sector_is_current": "आपका क्षेत्र वर्तमान में खतरों से मुक्त है!",
  "no_media_available": "कोई मीडिया उपलब्ध नहीं",
  "by": "द्वारा",
  "votes": "वोट",
  "alt_hazard": "खतरा",
  "ocean_report": "प्रदूषण रिपोर्ट",
  "flag_ecological_hazards_protec": "पारिस्थितिक खतरों को चिह्नित करें। हमारे भविष्य की रक्षा करें।",
  "evidence_image_video": "सबूत (छवि/वीडियो)",
  "tap_to_securely_upload_file": "फ़ाइल सुरक्षित रूप से अपलोड करने के लिए टैप करें",
  "live_coordinates": "लाइव निर्देशांक",
  "triangulating": "स्थान खोज रहा है...",
  "fetch_location": "स्थान प्राप्त करें",
  "lat": "अक्षांश",
  "lng": "देशांतर",
  "incident_category": "घटना की श्रेणी",
  "plastic_dumping_debris": "प्लास्टिक डंपिंग / मलबा",
  "toxic_leak_oil_spill": "विषाक्त रिसाव / तेल रिसाव",
  "deceased_marine_life": "मृत समुद्री जीवन",
  "illegal_fishing_activity": "अवैध मछली पकड़ना",
  "context": "संदर्भ",
  "placeholder_what_exactly_are_you_observing": "आप वास्तव में क्या देख रहे हैं? कृपया संक्षेप में बताएं।"
};

const knTranslations = {
  "introducing_samanvaya": "ಸಮನ್ವಯವನ್ನು ಪರಿಚಯಿಸುತ್ತಿದ್ದೇವೆ",
  "samanvaya": "ಸಮನ್ವಯ",
  "the_waves_of_change": "ಬದಲಾವಣೆಯ ಅಲೆಗಳು",
  "harmony_between_people_resourc": "ಜನರು, ಸಂಪನ್ಮೂಲಗಳು ಮತ್ತು ಪ್ರಕೃತಿಯ ನಡುವಿನ ಸಾಮರಸ್ಯ.",
  "explore_marketplace": "ಮಾರುಕಟ್ಟೆಯನ್ನು ಅನ್ವೇಷಿಸಿ",
  "join_a_campaign": "ಅಭಿಯಾನಕ್ಕೆ ಸೇರಿ",
  "get_started": "ಪ್ರಾರಂಭಿಸಿ",
  "sign_in": "ಸೈನ್ ಇನ್ ಮಾಡಿ",
  "creating_harmony": "ಸಾಮರಸ್ಯದ ರಚನೆ",
  "by_connecting_individuals_with": "ವ್ಯಕ್ತಿಗಳನ್ನು ಸುಸ್ಥಿರ ಕ್ರಿಯೆಗಳೊಂದಿಗೆ ಸಂಪರ್ಕಿಸುವ ಮೂಲಕ ಭವಿಷ್ಯ ರೂಪಿಸಿ.",
  "sustainable_barter": "ಸುಸ್ಥಿರ ವಿನಿಮಯ",
  "exchange_pre_loved_items_inste": "ಎಸೆಯುವ ಬದಲು ವಸ್ತುಗಳನ್ನು ವಿನಿಮಯ ಮಾಡಿಕೊಳ್ಳಿ.",
  "community_campaigns": "ಸಾಮುದಾಯಿಕ ಅಭಿಯಾನಗಳು",
  "join_eco_campaigns_beach_clean": "ಪ್ರಕೃತಿಯನ್ನು ರಕ್ಷಿಸಲು ಪರಿಸರ ವಲಯದ ಅಭಿಯಾನಗಳಿಗೆ ಸೇರಿ.",
  "impact_tracking": "ಪ್ರಭಾವದ ಟ್ರ್ಯಾಕಿಂಗ್",
  "watch_your_personal_ecological": "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಪರಿಸರ ಪ್ರಭಾವ ಬೆಳೆಯುತ್ತಿರುವುದನ್ನು ವೀಕ್ಷಿಸಿ.",
  "impact_in_action": "ಪ್ರಭಾವ ಕಾರ್ಯಗತ",
  "observe_the_real_difference_ou": "ನಮ್ಮ ಸಮುದಾಯ ತಂದಿರುವ ನೈಜ ವ್ಯತ್ಯಾಸವನ್ನು ಗಮನಿಸಿ.",
  "view_ocean_reports": "ಮಾಲಿನ್ಯ ವರದಿಗಳನ್ನು ವೀಕ್ಷಿಸಿ",

  "ocean_reports_feed": "ಮಾಲಿನ್ಯ ವರದಿಗಳ ಫೀಡ್",
  "verified_ecological_hazards_wi": "ನಿಮ್ಮ 50 ಕಿ.ಮೀ ವ್ಯಾಪ್ತಿಯಲ್ಲಿರುವ ದೃಢೀಕರಿಸಿದ ಅಪಾಯಗಳು.",
  "submit_new_report": "ಹೊಸ ವರದಿ ಸಲ್ಲಿಸಿ",
  "no_reports_found": "ಯಾವುದೇ ವರದಿಗಳಿಲ್ಲ",
  "your_oceanic_sector_is_current": "ನಿಮ್ಮ ವಲಯವು ಪ್ರಸ್ತುತ ಅಪಾಯಗಳಿಂದ ಮುಕ್ತವಾಗಿದೆ!",
  "no_media_available": "ಯಾವುದೇ ಮಾಧ್ಯಮ ಲಭ್ಯವಿಲ್ಲ",
  "by": "ರವರು",
  "votes": "ಮತಗಳು",
  "alt_hazard": "ಅಪಾಯ",
  "ocean_report": "ಮಾಲಿನ್ಯ ವರದಿ",
  "flag_ecological_hazards_protec": "ಪರಿಸರ ಅಪಾಯಗಳನ್ನು ಗುರುತಿಸಿ. ನಮ್ಮ ಭವಿಷ್ಯವನ್ನು ರಕ್ಷಿಸಿ.",
  "evidence_image_video": "ಸಾಕ್ಷ್ಯ (ಚಿತ್ರ/ವೀಡಿಯೊ)",
  "tap_to_securely_upload_file": "ಫೈಲ್ ಅನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
  "live_coordinates": "ಲೈವ್ ನಿರ್ದೇಶಾಂಕಗಳು",
  "triangulating": "ಸ್ಥಳ ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
  "fetch_location": "ಸ್ಥಳವನ್ನು ಪಡೆಯಿರಿ",
  "lat": "ಅಕ್ಷಾಂಶ",
  "lng": "ರೇಖಾಂಶ",
  "incident_category": "ಘಟನೆಯ ವರ್ಗ",
  "plastic_dumping_debris": "ಪ್ಲಾಸ್ಟಿಕ್ ಡಂಪಿಂಗ್ / ಅವಶೇಷಗಳು",
  "toxic_leak_oil_spill": "ವಿಷಕಾರಿ ಸೋರಿಕೆ / ತೈಲ ಸೋರಿಕೆ",
  "deceased_marine_life": "ಮೃತ ಸಮುದ್ರ ಜೀವಿಗಳು",
  "illegal_fishing_activity": "ಅಕ್ರಮ ಮೀನುಗಾರಿಕೆ",
  "context": "ಸಂದರ್ಭ",
  "placeholder_what_exactly_are_you_observing": "ನೀವು ನಿಖರವಾಗಿ ಏನು ನೋಡುತ್ತಿದ್ದೀರಿ? ದಯವಿಟ್ಟು ಸಂಕ್ಷಿಪ್ತವಾಗಿ ತಿಳಿಸಿ."
};

function updateLocale(lang, updates) {
  const file = path.join(localesPath, `${lang}.json`);
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data.auto) data.auto = {};
    Object.assign(data.auto, updates);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`Updated ${lang}.json`);
  }
}

updateLocale('hi', hiTranslations);
updateLocale('kn', knTranslations);
