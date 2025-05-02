import React, { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Image,
} from "react-native"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import * as DocumentPicker from "expo-document-picker"
import * as StorageAccessFramework from "expo-file-system"

import { useAuth } from "@/context/AuthContext"
import {
  getPasswordsByUserId,
  addPassword,
} from "@/services/database"
import {
  getDecryptedMasterKey,
  saveDecryptedMasterKey,
} from "@/utils/secureStore"
import {
  decryptData,
  decryptWithPassword,
  encryptData,
} from "@/utils/encryption"
import { colors } from "@/utils/theme"

const ExportPasswordsScreen: React.FC = () => {
  const { localUser } = useAuth()
  const [masterKey, setMasterKey] = useState<string | null>(null)
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")

  const tryGetMasterKey = async (): Promise<string | null> => {
    if (!localUser) return null
    let key = localUser.decryptedMasterKey || (await getDecryptedMasterKey())
    if (!key) setPasswordPromptVisible(true)
    return key
  }

  const decryptAndSaveMasterKey = () => {
    if (!localUser) return
    const decrypted = decryptWithPassword(
      localUser.encryptedMasterKey,
      passwordInput
    )
    if (!decrypted) {
      Alert.alert("Erro", "Senha incorreta para descriptografar a chave mestra.")
      return
    }
    setMasterKey(decrypted)
    saveDecryptedMasterKey(decrypted)
    setPasswordPromptVisible(false)
    setPasswordInput("")
    Alert.alert("✅", "Chave mestra desbloqueada!")
  }

  const exportPasswords = async (): Promise<string | null> => {
    if (!localUser) return null
    const key = masterKey || localUser.decryptedMasterKey || (await getDecryptedMasterKey())
    if (!key) {
      await tryGetMasterKey()
      return null
    }

    const passwords = await getPasswordsByUserId(localUser.id)
    const payload = passwords.map(p => ({
      servico: p.serviceName,
      usuario: p.username,
      senha: p.encryptedPassword,
      categoria: p.category,
      anotacao: p.additionalInfo,
    }))
    const encryptedJson = encryptData(JSON.stringify(payload), key)
    const exportData = JSON.stringify({ versao: 1, data: encryptedJson }, null, 2)

    const tmpPath = FileSystem.cacheDirectory + "senhas_exportadas.json"
    await FileSystem.writeAsStringAsync(tmpPath, exportData, {
      encoding: FileSystem.EncodingType.UTF8,
    })

    return tmpPath
  }

  const handleSave = async () => {
    const uri = await exportPasswords()
    if (!uri) return
  
    try {
      const permissions = await StorageAccessFramework.StorageAccessFramework.requestDirectoryPermissionsAsync()
      if (!permissions.granted) {
        Alert.alert("Permissão negada", "Você precisa permitir o acesso à pasta.")
        return
      }
  
      const fileUri = await StorageAccessFramework.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        "senhas_exportadas",
        "application/json"
      )
  
      const content = await FileSystem.readAsStringAsync(uri)
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      })
  
      Alert.alert("Sucesso", "Arquivo exportado com sucesso!")
    } catch (err) {
      console.error("Erro ao salvar com SAF:", err)
      Alert.alert("Erro", "Falha ao exportar o arquivo.")
    }
  }

  const handleShare = async () => {
    const uri = await exportPasswords()
    if (uri) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Compartilhar Senhas",
      })
    }
  }

  const handleImport = async () => {
    if (!localUser) return
    const key = masterKey || localUser.decryptedMasterKey || (await getDecryptedMasterKey())
    if (!key) {
      await tryGetMasterKey()
      return
    }

    const result = await DocumentPicker.getDocumentAsync({ type: "application/json" })
    if (!result.assets || !result.assets[0]) return

    try {
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri)
      const json = JSON.parse(content)
      const decrypted = decryptData(json.data, key)
      const parsed = JSON.parse(decrypted)

      const current = await getPasswordsByUserId(localUser.id)
      const duplicates = parsed.filter(p =>
        current.some(c =>
          c.serviceName === p.servico &&
          c.username === p.usuario &&
          c.category === p.categoria
        )
      )

      const newEntries = parsed.filter(p => !duplicates.includes(p))

      Alert.alert(
        "Importar Senhas",
        `Detectadas ${parsed.length} senhas.\nRepetidas: ${duplicates.length}.\nDeseja importar todas ou apenas as novas?`,
        [
          {
            text: "Apenas novas",
            onPress: () => importPasswords(newEntries),
          },
          {
            text: "Todas",
            onPress: () => importPasswords(parsed),
          },
          { text: "Cancelar", style: "cancel" },
        ]
      )
    } catch (err) {
      Alert.alert("Erro", "Falha ao importar o arquivo.")
    }
  }

  const importPasswords = async (entries: any[]) => {
    if (!localUser) return
    for (const entry of entries) {
      await addPassword(
        localUser.id,
        entry.senha,
        entry.servico,
        entry.usuario,
        entry.categoria,
        entry.anotacao
      )
    }
    Alert.alert("Importado", `${entries.length} senhas foram importadas!`)
  }

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/export.png")}
        style={{ width: 120, height: 120, marginBottom: 20 }}
      />
      <Text style={styles.title}>Exportar/Importar Senhas</Text>

      <TouchableOpacity style={styles.button} onPress={handleShare}>
        <Text style={styles.buttonText}>📤 Compartilhar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>💾 Salvar como...</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonSecondary} onPress={handleImport}>
        <Text style={styles.buttonText}>📥 Importar</Text>
      </TouchableOpacity>

      <Modal visible={passwordPromptVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔐 Digite sua senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Senha da conta"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
            />
            <TouchableOpacity style={styles.button} onPress={decryptAndSaveMasterKey}>
              <Text style={styles.buttonText}>Desbloquear Chave Mestra</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSecondary, { marginTop: 10 }]}
              onPress={() => {
                setPasswordPromptVisible(false)
                setPasswordInput("")
              }}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.lightGray,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 30,
    color: colors.darkGray,
  },
  button: {
    backgroundColor: colors.yellow,
    padding: 14,
    borderRadius: 10,
    width: "90%",
    alignItems: "center",
    marginBottom: 15,
  },
  buttonSecondary: {
    backgroundColor: colors.darkGray,
    padding: 14,
    borderRadius: 10,
    width: "90%",
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "bold",
    color: colors.white,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "85%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.darkGray,
  },
  input: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
})

export default ExportPasswordsScreen
