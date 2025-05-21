import { getRandomBytesAsync, digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto"
import CryptoJS from "react-native-crypto-js"

const getSaltedPassword = (password: string): string => {
  const salt = process.env.EXPO_PUBLIC_ENCRYPTION_KEY
  return password + salt
}

export const generateRandomMasterKey = async (): Promise<string> => {
  try {
    const bytes = await getRandomBytesAsync(32)
    const key = Array.from(bytes).map((b) => ("0" + b.toString(16)).slice(-2)).join("")
    return key
  } catch (error) {
    console.error("Erro ao gerar masterKey:", error)
    throw error
  }
}

export const encryptWithPassword = (data: string, password: string): string => {
  try {
    const salted = getSaltedPassword(password)
    return CryptoJS.AES.encrypt(data, salted).toString()
  } catch (error) {
    console.error("Erro ao criptografar:", error)
    return "[ENCRYPTION_FAILED]"
  }
}

export const encryptData = (data: string, masterKey: string): string => {
  try {
    return CryptoJS.AES.encrypt(data, masterKey).toString()
  } catch (error) {
    console.error("Erro ao criptografar dados:", error)
    return ""
  }
}

export const decryptWithPassword = (encryptedData: string, password: string): string => {
  try {
    if (!encryptedData) {
      console.warn("⚠️ Tentou descriptografar dado inexistente.")
      return "[DADO_INEXISTENTE]"
    }
    const salted = getSaltedPassword(password)
    console.log("🔑 Tentando descriptografar com senha...")
    console.log("🔐 Dado criptografado:", encryptedData)
    console.log("🧂 Senha com salt:", salted)
    const bytes = CryptoJS.AES.decrypt(encryptedData, salted)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    console.log("🔓 Dado descriptografado:", decrypted)
    if (!decrypted) throw new Error("Descriptografia falhou ou senha incorreta.")
    return decrypted
  } catch (error) {
    console.error("❌ Erro ao descriptografar com senha:", error)
    return "[DESCRIPTOGRAFIA_FALHOU]"
  }
}

export const decryptData = (encryptedData: string, masterKey: string): string => {
  try {
    if (!encryptedData) {
      console.warn("⚠️ Tentou descriptografar dado inexistente.")
      return "[DADO_INEXISTENTE]"
    }
    if (!masterKey) {
      console.warn("⚠️ masterKey ausente ao descriptografar dados.")
      return "[MASTER_KEY_AUSENTE]"
    }
    console.log("🔑 Tentando descriptografar com masterKey...")
    console.log("🔐 Dado criptografado:", encryptedData)
    console.log("🔑 masterKey:", masterKey)
    const bytes = CryptoJS.AES.decrypt(encryptedData, masterKey)
    const result = bytes.toString(CryptoJS.enc.Utf8)
    console.log("🔓 Dado descriptografado:", result)
    if (!result) throw new Error("Descriptografia falhou: dado vazio ou chave incorreta.")
    return result
  } catch (error) {
    console.error("❌ Erro ao descriptografar com masterKey:", error)
    return "[DESCRIPTOGRAFIA_FALHOU]"
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  try {
    return await digestStringAsync(CryptoDigestAlgorithm.SHA256, password)
  } catch (error) {
    console.error("Erro ao gerar hash da senha:", error)
    throw error
  }
}