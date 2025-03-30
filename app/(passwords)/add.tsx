import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { encryptData } from "../../utils/encryption"
import { useAuth } from "../../context/AuthContext"
import ErrorModal from "../../components/ErrorModal"
import { colors } from "../../utils/theme"
import { addPassword } from "../../services/database"

const AddPasswordScreen: React.FC = () => {
  const router = useRouter()
  const { localUser } = useAuth()

  const [serviceName, setServiceName] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [url, setUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [category, setCategory] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"error" | "success" | "info">("info")

  const showModal = (message: string, type: "error" | "success" | "info") => {
    setModalMessage(message)
    setModalType(type)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!serviceName || !password || !localUser) {
      showModal("Preencha todos os campos obrigatórios.", "error")
      return
    }

    setIsSaving(true)

    try {
      const decryptedMasterKey = localUser.decryptedMasterKey || ""
      const encryptedPassword = encryptData(password, decryptedMasterKey)
      const encryptedNotes = encryptData(notes || "", decryptedMasterKey)

      await addPassword(
        localUser.id,
        encryptedPassword,
        serviceName,
        username || "",
        url || "",
        category || "",
        encryptedNotes
      )      

      showModal("Senha salva com sucesso!", "success")
      setTimeout(() => {
        setModalVisible(false)
        router.back()
      }, 2000)
    } catch (error) {
      console.error("❌ Erro ao salvar senha:", error)
      showModal("Erro ao salvar. Tente novamente.", "error")
    }

    setIsSaving(false)
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nova Senha</Text>

      <TextInput
        style={styles.input}
        placeholder="🔒 Nome do serviço (ex: Facebook)"
        value={serviceName}
        onChangeText={setServiceName}
      />
      <TextInput
        style={styles.input}
        placeholder="🔑 Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="👤 Nome de usuário"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="🔗 URL do serviço"
        value={url}
        onChangeText={setUrl}
      />
      <TextInput
        style={styles.input}
        placeholder="🗂 Categoria (ex: Social, Banco...)"
        value={category}
        onChangeText={setCategory}
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="📝 Notas adicionais (opcional)"
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Salvar</Text>
        )}
      </TouchableOpacity>

      <ErrorModal
        visible={modalVisible}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    borderColor: colors.mediumGray,
    borderWidth: 1,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.yellow,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontWeight: "bold",
    color: colors.darkGray,
    fontSize: 16,
  },
})

export default AddPasswordScreen
