import * as SQLite from "expo-sqlite"
import User from "../models/User"
import PasswordEntry from "../models/Password"
import { Alert } from "react-native"
import * as FileSystem from "expo-file-system"

let db: SQLite.SQLiteDatabase

interface UserRow {
  id: number
  name: string
  email: string
  password: string
  encrypted_master_key: string
  password_hint: string | null
  created_at: string
  firebase_uid: string | null
  has_2fa: number
  twofa_secret: string | null
  security_questions: string | null
}

interface PasswordRow {
  id: number
  user_id: number
  encrypted_password: string
  service_name: string
  username: string | null
  category: string | null
  additional_info: string | null
  created_at: string
  updated_at: string
}

export const initDB = async (): Promise<void> => {
  db = await SQLite.openDatabaseAsync("keydozer.db")

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY NOT NULL, 
      name TEXT NOT NULL, 
      email TEXT NOT NULL UNIQUE, 
      password TEXT NOT NULL, 
      encrypted_master_key TEXT NOT NULL,
      password_hint TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      firebase_uid TEXT,
      has_2fa INTEGER DEFAULT 0,
      twofa_secret TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS passwords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      encrypted_password TEXT NOT NULL,
      service_name TEXT NOT NULL,
      username TEXT,
      category TEXT,
      additional_info TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  console.log("🧱 Banco de dados inicializado com tabelas: users e passwords!")
}

export const addUser = async (
  name: string,
  email: string,
  password: string,
  encryptedMasterKey: string,
  passwordHint: string | null = null,
  firebaseUid: string | null = null,
  has2FA: boolean = false,
  twofaSecret: string | null = null,
  securityQuestions: string | null = null
): Promise<number> => {
  console.log("📥 Chamando addUser com:", name, email)

  if (!db) await initDB()

  const exists = await checkUserExistsByEmail(email)
  if (exists) {
    console.warn("⚠️ Usuário já existe localmente")
    throw new Error("EMAIL_ALREADY_EXISTS")
  }

  try {
    const result = await db.runAsync(
      `INSERT INTO users 
      (name, email, password, encrypted_master_key, password_hint, firebase_uid, has_2fa, twofa_secret, security_questions) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name,
      email,
      password,
      encryptedMasterKey,
      passwordHint,
      firebaseUid,
      has2FA ? 1 : 0,
      twofaSecret,
      securityQuestions
    )

    console.log("✅ Usuário local salvo com ID:", result.lastInsertRowId)
    return result.lastInsertRowId
  } catch (error) {
    console.error("❌ Erro ao salvar no banco local:", error)
    throw error
  }
}


export const updateUser2FA = async (
  userId: number,
  has2FA: boolean,
  twofaSecret: string | null
): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync(
    `UPDATE users SET has_2fa = ?, twofa_secret = ? WHERE id = ?`,
    has2FA ? 1 : 0,
    twofaSecret,
    userId
  )
}

export const updateUserSecurityQuestions = async (
  userId: number,
  securityQuestions: string | null
): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync(
    `UPDATE users SET security_questions = ? WHERE id = ?`,
    securityQuestions,
    userId
  )
}

export const checkUserExistsByEmail = async (email: string): Promise<boolean> => {
  if (!db) await initDB()
  const user = await db.getFirstAsync("SELECT * FROM users WHERE email = ?", email)
  return !!user
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
  if (!db) await initDB()
  const user = await db.getFirstAsync("SELECT * FROM users WHERE email = ?", email)
  return user ? User.fromRow(user) : null
}

export const getFirstUser = async (): Promise<User | null> => {
  if (!db) await initDB()
  const user = await db.getFirstAsync("SELECT * FROM users")
  return user ? User.fromRow(user) : null
}

export const getLastUser = async (): Promise<User | null> => {
  if (!db) await initDB()
  const user = await db.getFirstAsync("SELECT * FROM users ORDER BY id DESC LIMIT 1")
  return user ? User.fromRow(user) : null
}

export const getAllUsers = async (): Promise<User[]> => {
  if (!db) await initDB()
  const users = await db.getAllAsync("SELECT * FROM users")
  return users.map(User.fromRow)
}

export const updateUserName = async (email: string, newName: string): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync("UPDATE users SET name = ? WHERE email = ?", newName, email)
}

export const updateUserEncryptedData = async (
  email: string,
  newHashedPassword: string,
  newEncryptedMasterKey: string
): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync(
    "UPDATE users SET password = ?, encrypted_master_key = ? WHERE email = ?",
    newHashedPassword,
    newEncryptedMasterKey,
    email
  )
}

export const deleteUser = async (id: number): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync("DELETE FROM users WHERE id = ?", id)
}

export const deleteUserByEmail = async (email: string): Promise<void> => {
  if (!db) await initDB()

  try {
    const user = await db.getFirstAsync("SELECT id FROM users WHERE email = ?", email)
    if (user) {
      await db.runAsync("DELETE FROM users WHERE email = ?", email)
      console.log("🧹 Usuário e senhas associados removidos do SQLite.")
    } else {
      console.warn("⚠️ Nenhum usuário encontrado com esse e-mail para exclusão.")
    }
  } catch (error) {
    console.error("❌ Erro ao deletar usuário local por e-mail:", error)
    throw error
  }
}

export const deleteDatabase = async (): Promise<void> => {
  try {
    await FileSystem.deleteAsync(FileSystem.documentDirectory + "SQLite/keydozer.db", {
      idempotent: true,
    })
    Alert.alert("Sucesso", "Banco de dados excluído! Reinicie o app.")
    console.log("✅ Banco de dados deletado com sucesso!")
  } catch (error) {
    Alert.alert("Erro", "Falha ao excluir o banco de dados.")
    console.error("❌ Erro ao deletar banco de dados:", error)
  }
}

// ===== PASSWORDS ===== //

export const addPassword = async (
  userId: number,
  encryptedPassword: string,
  serviceName: string,
  username: string,
  category: string,
  additionalInfo: string
): Promise<number> => {
  if (!db) await initDB()
  const result = await db.runAsync(
    `INSERT INTO passwords (user_id, encrypted_password, service_name, username, category, additional_info)
     VALUES (?, ?, ?, ?, ?, ?)`,
    userId,
    encryptedPassword,
    serviceName,
    username,
    category,
    additionalInfo
  )
  return result.lastInsertRowId
}

export const getPasswordsByUserId = async (userId: number): Promise<PasswordEntry[]> => {
  if (!db) await initDB()
  const rows = (await db.getAllAsync("SELECT * FROM passwords WHERE user_id = ?", userId)) as PasswordRow[]
  return rows.map(
    (row) =>
      new PasswordEntry(
        row.id,
        row.user_id,
        row.encrypted_password,
        row.service_name,
        row.username,
        row.category,
        row.additional_info,
        row.created_at,
        row.updated_at
      )
  )
}

export const updatePasswordById = async (
  id: number,
  encryptedPassword: string,
  serviceName: string,
  username: string,
  category: string,
  additionalInfo: string
): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync(
    `UPDATE passwords
     SET encrypted_password = ?, service_name = ?, username = ?, category = ?, additional_info = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    encryptedPassword,
    serviceName,
    username,
    category,
    additionalInfo,
    id
  )
}

export const deletePasswordById = async (passwordId: number): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync("DELETE FROM passwords WHERE id = ?", passwordId)
}
