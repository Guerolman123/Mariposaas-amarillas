// ===== CONFIGURACIÓN FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, orderBy, query, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBbhhITYcVV0bfYStUiP6h6c5G5Uznypc",
  authDomain: "mariposas-amarillas-7c069.firebaseapp.com",
  projectId: "mariposas-amarillas-7c069",
  storageBucket: "mariposas-amarillas-7c069.firebasestorage.app",
  messagingSenderId: "1008376509762",
  appId: "1:1008376509762:web:bc4991b29106171649c4db"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

export { db, collection, addDoc, getDocs, orderBy, query, serverTimestamp };
