import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider,
} from "./firebaseConfig"

// Registrar usuário
export const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    console.log("✅ Usuário registrado:", userCredential.user.uid)
    return userCredential.user
  } catch (error) {
    console.error("Erro ao registrar usuário:", error.code || error.message || error)
    throw error
  }
}

// Login do usuário
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    console.log("✅ Login realizado:", userCredential.user.uid)
    // Garantia que auth.currentUser está atualizado
    if (!auth.currentUser) {
      auth.currentUser = userCredential.user
      console.log("⚠️ auth.currentUser forçado após login.")
    }
    return userCredential.user
  } catch (error) {
    console.error("Erro ao fazer login:", error.code || error.message || error)
    throw error
  }
}

// Logout do usuário
export const logoutUser = async () => {
  try {
    await signOut(auth)
    console.log("✅ Logout realizado.")
  } catch (error) {
    console.error("Erro ao sair:", error.code || error.message || error)
    throw error
  }
}

// Atualizar e-mail do usuário
export const updateUserEmail = async (newEmail) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error("Usuário não autenticado.")
    await updateEmail(user, newEmail)
    console.log("✅ E-mail atualizado para:", newEmail)
  } catch (error) {
    console.error("Erro ao atualizar e-mail:", error.code || error.message || error)
    throw error
  }
}

// Atualizar senha do usuário
export const updateUserPassword = async (newPassword) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error("Usuário não autenticado.")
    await updatePassword(user, newPassword)
    console.log("✅ Senha atualizada com sucesso.")
  } catch (error) {
    console.error("Erro ao atualizar senha:", error.code || error.message || error)
    throw error
  }
}

// Reautenticar usuário antes de alterações sensíveis
export const reauthenticateUser = async (currentPassword) => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error("Usuário não autenticado.")
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    console.log("✅ Usuário reautenticado com sucesso.")
    return true
  } catch (error) {
    console.error("Erro ao reautenticar:", error.code || error.message || error)
    throw error
  }
}

// Excluir conta do usuário
export const deleteUserAccount = async () => {
  try {
    const user = auth.currentUser
    if (!user) throw new Error("Usuário não autenticado.")
    await deleteUser(user)
    console.log("✅ Usuário excluído com sucesso.")
  } catch (error) {
    console.error("Erro ao excluir conta:", error.code || error.message || error)
    throw error
  }
}
