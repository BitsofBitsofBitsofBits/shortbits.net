// Forwards legacy /admin.html links (including ?window= deep links) to /admin/.
window.location.replace(`/admin/${window.location.search}${window.location.hash}`);
