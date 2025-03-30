import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  deleteUser,
  EmailAuthProvider
} from "./firebaseConfig";

// Registrar usuário
export const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Erro ao registrar usuário:", error.message);
    throw error;
  }
};

// Login do usuário
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Erro ao fazer login:", error.message);
    throw error;
  }
};

// Logout do usuário
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error.message);
    throw error;
  }
};

// Atualizar e-mail do usuário
export const updateUserEmail = async (user, newEmail) => {
  try {
    await updateEmail(user, newEmail);
    console.log("E-mail atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar e-mail:", error.message);
    throw error;
  }
};

// Atualizar senha do usuário
export const updateUserPassword = async (user, newPassword) => {
  try {
    await updatePassword(user, newPassword);
    console.log("Senha atualizada com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar senha:", error.message);
    throw error;
  }
};

// Reautenticar usuário antes de alterações sensíveis
export const reauthenticateUser = async (user, currentPassword) => {
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    console.log("Usuário reautenticado com sucesso.");
    return true;
  } catch (error) {
    console.error("Erro ao reautenticar:", error.message);
    throw error;
  }
};

// Excluir conta do usuário
export const deleteUserAccount = async (user) => {
  try {
    await deleteUser(user);
    console.log("Usuário excluído com sucesso.");
  } catch (error) {
    console.error("Erro ao excluir conta:", error.message);
    throw error;
  }
};
