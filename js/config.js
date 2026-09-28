// Settings for whoever hosts this page.
window.Lofi = window.Lofi || {};
Lofi.config = {
  // Google OAuth Client ID (Web application) for Google Drive and Calendar.
  // With it set here, everyone who visits the site can just click Save to
  // Drive / Connect and sign in. No setup on their side. A Client ID isn't a
  // secret: Google only accepts it from the "Authorized JavaScript origins"
  // listed on the client in Google Cloud.
  //
  // This one belongs to https://lofi.toddtechtalks.com. If you host your own
  // copy, replace it with your own (see google-setup.html), or leave it empty
  // and set one per-browser in Settings → Google.
  googleClientId: '607196183766-rv89do8kgeerkt9rc9t8fhehles8gt8e.apps.googleusercontent.com',
};
