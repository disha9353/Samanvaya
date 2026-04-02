function setLanguage(req, res, next) {
  let lang = 'en'; // Global default fallback

  // 1. Try to read from request headers
  // Frontend sends the current language dialect in the standard Accept-Language header or a custom X-Language header
  const customHeader = req.headers['x-language'];
  const acceptLanguage = req.headers['accept-language'];

  if (customHeader && ['en', 'hi', 'kn'].includes(customHeader)) {
    lang = customHeader;
  } else if (acceptLanguage) {
    // Basic parser for Accept-Language: "en-US,en;q=0.9" -> "en"
    const parsedLang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
    if (['en', 'hi', 'kn'].includes(parsedLang)) {
      lang = parsedLang;
    }
  }

  // 2. Try to read from user profile
  // If the user is authenticated and their user object is bound to `req` by an earlier middleware
  // their stored preference forcefully overrides the browser header in the backend context!
  if (req.user && req.user.preferredLanguage) {
    if (['en', 'hi', 'kn'].includes(req.user.preferredLanguage)) {
      lang = req.user.preferredLanguage;
    }
  }

  // Attach exactly the valid preferred string natively to the Express Request
  req.language = lang;
  
  next();
}

module.exports = setLanguage;
