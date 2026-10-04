const TEST = {
  apiKey: "AIzaSyDwkKOrRU1LF_N7fiVNWc5CRp-abopSyrI",
  authDomain: "portal-test-6e0ff.firebaseapp.com",
  projectId: "portal-test-6e0ff",
  storageBucket: "portal-test-6e0ff.firebasestorage.app",
  messagingSenderId: "36946317914",
  appId: "1:36946317914:web:c6ad5f3a1b98130c99fe63"
};
const PROD = {
  apiKey: "AIzaSyCyQxBJ_ftfM0ImBXubmqD5gfzFR54iPmE",
  authDomain: "p4ph2-fab-506a7.firebaseapp.com",
  projectId: "p4ph2-fab-506a7",
  storageBucket: "p4ph2-fab-506a7.firebasestorage.app",
  messagingSenderId: "36946317914",
  appId: "1:36946317914:web:c6ad5f3a1b98130c99fe63"
};
export const IS_TEST = /\/portal-test(\/|$)/.test(location.pathname);
export const FIREBASE_CONFIG = IS_TEST ? TEST : PROD;
export const DOMAIN = '@jhsol.kr';
export const SDK = 'https://www.gstatic.com/firebasejs/10.12.0/';
export const LEGACY_PORTAL_URL = '../';
