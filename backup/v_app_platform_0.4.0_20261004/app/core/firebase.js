import { FIREBASE_CONFIG } from './config.js?v=20261004g';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, updateDoc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getFunctions, httpsCallable }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');   // 전자결재 서버 함수(edocAct)가 있는 지역
export { onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, updateDoc, setDoc, serverTimestamp, httpsCallable };
