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
}

interface PasswordRow {
  id: number
  user_id: number
  encrypted_password: string
  service_name: string
  username: string | null
  url: string | null
  category: string | null
  notes: string | null
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS passwords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      encrypted_password TEXT NOT NULL,
      service_name TEXT NOT NULL,
      username TEXT,
      url TEXT,
      category TEXT,
      notes TEXT,
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
  passwordHint: string | null = null
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
      "INSERT INTO users (name, email, password, encrypted_master_key, password_hint) VALUES (?, ?, ?, ?, ?)",
      name,
      email,
      password,
      encryptedMasterKey,
      passwordHint
    )

    console.log("✅ Usuário local salvo com ID:", result.lastInsertRowId)
    return result.lastInsertRowId
  } catch (error) {
    console.error("❌ Erro ao salvar no banco local:", error)
    throw error
  }
}

export const checkUserExistsByEmail = async (email: string): Promise<boolean> => {
  if (!db) await initDB()
  const user = await db.getFirstAsync("SELECT * FROM users WHERE email = ?", email)
  return !!user
}

export const getFirstUser = async (): Promise<User | null> => {
  if (!db) await initDB()
  const user = (await db.getFirstAsync("SELECT * FROM users")) as UserRow | undefined
  return user
    ? new User(
        user.id,
        user.name,
        user.email,
        user.password,
        user.password_hint,
        user.encrypted_master_key,
        user.created_at
      )
    : null
}

export const getLastUser = async (): Promise<User | null> => {
  if (!db) await initDB()
  const user = (await db.getFirstAsync("SELECT * FROM users ORDER BY id DESC LIMIT 1")) as UserRow | undefined
  return user
    ? new User(
        user.id,
        user.name,
        user.email,
        user.password,
        user.password_hint,
        user.encrypted_master_key,
        user.created_at
      )
    : null
}

export const updateUserName = async (email: string, newName: string): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync("UPDATE users SET name = ? WHERE email = ?", newName, email)
}

export const getAllUsers = async (): Promise<User[]> => {
  if (!db) await initDB()
  const users = (await db.getAllAsync("SELECT * FROM users")) as UserRow[]
  return users.map(
    (user) =>
      new User(
        user.id,
        user.name,
        user.email,
        user.password,
        user.password_hint,
        user.encrypted_master_key,
        user.created_at
      )
  )
}

export const deleteUser = async (id: number): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync("DELETE FROM users WHERE id = ?", id)
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

export const getUserByEmail = async (email: string): Promise<User | null> => {
  if (!db) await initDB()
  const user = (await db.getFirstAsync("SELECT * FROM users WHERE email = ?", email)) as UserRow | undefined
  return user
    ? new User(
        user.id,
        user.name,
        user.email,
        user.password,
        user.password_hint,
        user.encrypted_master_key,
        user.created_at
      )
    : null
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

export const addPassword = async (
  userId: number,
  encryptedPassword: string,
  serviceName: string,
  username: string,
  url: string,
  category: string,
  notes: string
): Promise<number> => {
  if (!db) await initDB()
  const result = await db.runAsync(
    `INSERT INTO passwords (user_id, encrypted_password, service_name, username, url, category, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    userId,
    encryptedPassword,
    serviceName,
    username,
    url,
    category,
    notes
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
        row.url,
        row.category,
        row.notes,
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
  url: string,
  category: string,
  notes: string
): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync(
    `UPDATE passwords
     SET encrypted_password = ?, service_name = ?, username = ?, url = ?, category = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    encryptedPassword,
    serviceName,
    username,
    url,
    category,
    notes,
    id
  )
}

export const deletePasswordById = async (passwordId: number): Promise<void> => {
  if (!db) await initDB()
  await db.runAsync("DELETE FROM passwords WHERE id = ?", passwordId)
}
