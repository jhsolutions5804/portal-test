import { FIREBASE_CONFIG } from './config.js?v=20261008g';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc, setDoc, serverTimestamp, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { getFunctions, httpsCallable }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);   // 전자결재 첨부파일(edoc/{문서종류}/{문서번호}/…)
export const functions = getFunctions(app, 'asia-northeast3');   // 전자결재 서버 함수(edocAct)가 있는 지역
export { updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail };
export { onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc, setDoc, deleteDoc, serverTimestamp, httpsCallable };
export { storageRef, uploadBytesResumable, getDownloadURL, deleteObject };
