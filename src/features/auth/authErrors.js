const AUTH_ERROR_KEYS = {
  "auth/email-already-in-use": "auth.errors.emailAlreadyInUse",
  "auth/invalid-email": "auth.errors.invalidEmail",
  "auth/weak-password": "auth.errors.weakPassword",
  "auth/invalid-credential": "auth.errors.invalidCredential",
  "auth/user-not-found": "auth.errors.userNotFound",
  "auth/wrong-password": "auth.errors.wrongPassword",
  "auth/popup-closed-by-user": "auth.errors.popupClosed",
  "auth/popup-blocked": "auth.errors.popupBlocked",
  "auth/cancelled-popup-request": "auth.errors.popupCancelled",
  "auth/account-exists-with-different-credential": "auth.errors.accountExistsDifferentCredential",
  "auth/operation-not-allowed": "auth.errors.operationNotAllowed",
  "auth/unauthorized-domain": "auth.errors.unauthorizedDomain",
  "auth/network-request-failed": "auth.errors.networkRequestFailed"
};

export const getAuthErrorMessage = (error, t) =>
  t(AUTH_ERROR_KEYS[error?.code] || "auth.errors.default");
