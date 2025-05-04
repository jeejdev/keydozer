import React, { createContext, useContext, useState, ReactNode } from "react"
import type { User as FirebaseUser } from "firebase/auth"
import User from "../models/User"

interface AuthContextData {
  firebaseUser: FirebaseUser | null
  localUser: User | null
  setFirebaseUser: (user: FirebaseUser | null) => void
  setLocalUser: (user: User | null) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextData | undefined>(undefined)

export const AuthProvider = ({ children, initialUser = null }: { children: ReactNode, initialUser?: User | null }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [localUser, setLocalUser] = useState<User | null>(initialUser)

  const isAuthenticated = !!firebaseUser || !!localUser

  return (
    <AuthContext.Provider
      value={{ firebaseUser, localUser, setFirebaseUser, setLocalUser, isAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider")
  }
  return context
}
