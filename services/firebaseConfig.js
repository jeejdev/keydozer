import { initializeApp } from "firebase/app"
import {
  initializeAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider,
  getReactNativePersistence
} from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getFunctions, httpsCallable } from "firebase/functions"
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage"
import Constants from 'expo-constants';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: Constants.expoConfig.extra.firebaseApiKey,
  authDomain: Constants.expoConfig.extra.firebaseAuthDomain,
  projectId: Constants.expoConfig.extra.firebaseProjectId,
  storageBucket: Constants.expoConfig.extra.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig.extra.firebaseMessagingSenderId,
  appId: Constants.expoConfig.extra.firebaseAppId,
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Inicializar o Firebase Auth com persistência
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
})

const db = getFirestore(app)
const storage = getStorage(app)
const functions = getFunctions(app) // <-- adicionado aqui!

export {
  auth,
  db,
  storage,
  functions,
  httpsCallable,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider
}
