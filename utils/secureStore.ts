import * as SecureStore from "expo-secure-store"

const MASTER_KEY_KEY = "decryptedMasterKey"

export const saveDecryptedMasterKey = async (value: string) => {
  await SecureStore.setItemAsync(MASTER_KEY_KEY, value)
}

export const getDecryptedMasterKey = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(MASTER_KEY_KEY)
}

export const clearDecryptedMasterKey = async () => {
  await SecureStore.deleteItemAsync(MASTER_KEY_KEY)
}
