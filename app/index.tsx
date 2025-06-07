import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { MaterialIcons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system"
import * as LocalAuthentication from "expo-local-authentication"

import {
  getAllUsers,
  initDB,
  deleteDatabase,
  getUserByEmail,
  addUser,
  addPassword,
  getPasswordsByUserId,
} from "../services/database"
import { colors } from "../utils/theme"
import ErrorModal from "../components/ErrorModal"
import User from "../models/User"
import { loginUser } from "../services/authService"
import { useAuth } from "../context/AuthContext"
import {
  decryptWithPassword,
  encryptData,
  hashPassword,
} from "@/utils/encryption"
import { auth, db } from "@/services/firebaseConfig"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"

const LoginScreen: React.FC = () => {
  const router = useRouter()
  const { setLocalUser } = useAuth()

  const DEV_EMAIL = "novaconta@gmail.com"
  const DEV_PASSWORD = "*K(Yg*A<;Fy*8.^6"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [suggestedUser, setSuggestedUser] = useState<User | null>(null)
  const [storedPassword, setStoredPassword] = useState<string | null>(null)

  const params = useLocalSearchParams()
  const isFirstLogin = params.firstLogin === "true"

  const showError = (message: string) => {
    setErrorMessage(message)
    setErrorModalVisible(true)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const dbPath = FileSystem.documentDirectory + "SQLite/keydozer.db"
        const fileInfo = await FileSystem.getInfoAsync(dbPath)
        if (!fileInfo.exists) await initDB()

        const lastEmail = await AsyncStorage.getItem("lastLoggedInEmail")
        if (lastEmail) {
          const user = await getUserByEmail(lastEmail)
          if (user && user.encryptedMasterKey) {
            setSuggestedUser(user)
            const savedPass = await AsyncStorage.getItem(`password:${lastEmail}`)
            setStoredPassword(savedPass)
            console.log("🔑 Senha armazenada:", !!savedPass)
          } else {
            console.log("⚠️ Usuário encontrado mas sem MasterKey.")
          }
        }
      } catch (error) {
        showError("Erro ao inicializar o app.")
        console.error("❌ Erro no init:", error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const handleLogin = async () => {
    if (isLoading) return

    try {
      console.log("🔐 Iniciando login com:", email)
      let localUser = await getUserByEmail(email)

      // Mantém login Firebase ativo
      await loginUser(email, password)
      const firebaseUser = auth.currentUser
      if (!firebaseUser) throw new Error("Usuário Firebase não disponível")

      if (!localUser) {
        console.log("🆕 Primeiro login. Buscando dados no Firestore...")
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
        if (!userDoc.exists()) {
          showError("Conta não encontrada. Crie uma conta antes de tentar logar.")
          return
        }

        const userData = userDoc.data()
        await addUser(
          userData.name || "Nova Conta",
          email,
          await hashPassword(password),
          userData.encryptedMasterKey,
          userData.passwordHint || null,
          firebaseUser.uid,
          userData.has_2fa === 1,
          userData.twofa_secret || null
        )
        localUser = await getUserByEmail(email)
        if (!localUser) {
          showError("Erro ao salvar o usuário localmente.")
          return
        }
        console.log("✅ Usuário salvo localmente.")
      } else {
        console.log("✅ Usuário local encontrado.")
      }

      const decryptedMasterKey = decryptWithPassword(
        localUser.encryptedMasterKey,
        password
      )
      if (!decryptedMasterKey) {
        showError("Falha ao descriptografar sua chave mestra. Verifique sua senha.")
        return
      }

      setLocalUser({ ...localUser, decryptedMasterKey })
      await AsyncStorage.setItem("lastLoggedInEmail", email)
      await AsyncStorage.setItem(`password:${email}`, password)

      if (isFirstLogin) {
        console.log("☁️ Sincronizando senhas da nuvem...")
        const passwordsCol = collection(db, "users", firebaseUser.uid, "passwords")
        const passwordsSnapshot = await getDocs(passwordsCol)

        await AsyncStorage.setItem("savePasswordsToCloud", "true")
        console.log("☁️ Salvamento na nuvem ativado por padrão.")

        for (const docSnap of passwordsSnapshot.docs) {
          const data = docSnap.data()
          const encryptedPassword = encryptData(data.password, decryptedMasterKey)
          const encryptedAdditionalInfo = encryptData(data.additionalInfo || "", decryptedMasterKey)

          await addPassword(
            localUser.id,
            encryptedPassword,
            data.serviceName,
            data.username,
            data.category,
            encryptedAdditionalInfo
          )
        }
        console.log("✅ Sincronização de senhas concluída.")
      }

      router.replace("/home")
    } catch (error: any) {
      console.error("❌ Erro no login:", error)
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        showError("E-mail ou senha incorretos.")
      } else {
        showError("Erro ao fazer login. Tente novamente mais tarde.")
      }
    }
  }

  const handleBiometricLogin = async () => {
    console.log("🔐 Iniciando login biométrico...")

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()

      if (!compatible || !enrolled) {
        showError("Seu dispositivo não suporta biometria.")
        return
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Autentique para continuar",
        fallbackLabel: "Usar senha",
      })

      if (!result.success) return
      console.log("✅ Biometria autenticada!")

      const lastEmail = await AsyncStorage.getItem("lastLoggedInEmail")
      if (!lastEmail) {
        showError("Nenhum usuário encontrado. Faça login manualmente.")
        return
      }

      const localUser = await getUserByEmail(lastEmail)
      if (!localUser) {
        showError("Usuário local não encontrado após autenticação.")
        return
      }

      const savedPass = await AsyncStorage.getItem(`password:${lastEmail}`)
      if (!savedPass) {
        showError("Senha não disponível. Faça login manualmente.")
        return
      }

      const decryptedMasterKey = decryptWithPassword(
        localUser.encryptedMasterKey,
        savedPass
      )
      if (!decryptedMasterKey) {
        showError("Erro ao descriptografar. Faça login manualmente.")
        return
      }

      // Não exige autenticação Firebase na biometria
      console.log("⚠️ Login biométrico realizado apenas localmente.")

      setLocalUser({ ...localUser, decryptedMasterKey })
      router.replace("/home")
    } catch (error) {
      console.error("❌ Erro no login biométrico:", error)
      showError("Erro ao logar com biometria.")
    }
  }

  const handleDeleteDB = async () => {
    try {
      await deleteDatabase()
    } catch (err) {
      console.error("❌ Erro ao excluir banco local:", err)
    }
  }

  const autofillTestAccount = () => {
    setEmail(DEV_EMAIL)
    setPassword(DEV_PASSWORD)
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/logo.png")} style={styles.logo} />

      {suggestedUser && suggestedUser.encryptedMasterKey && storedPassword ? (
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Text style={styles.title}>Bem-vindo de volta, {suggestedUser.name}</Text>
          <TouchableOpacity style={styles.button} onPress={handleBiometricLogin}>
            <Text style={styles.buttonText}>🔐 Logar com biometria</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSuggestedUser(null)}>
            <Text style={styles.link}>Não é {suggestedUser.name}? Logar com outra conta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Login</Text>
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <MaterialIcons
                name={showPassword ? "visibility-off" : "visibility"}
                size={24}
                color={colors.mediumGray}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.link}>Não tem uma conta? Criar conta</Text>
          </TouchableOpacity>

          {process.env.EXPO_PUBLIC_DEVELOPMENT_MODE === "True" && (
            <>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.green }]} onPress={autofillTestAccount}>
                <Text style={styles.buttonText}>[DEV] Preencher Conta de Teste</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.blue }]}
                onPress={async () => {
                  const allUsers = await getAllUsers()
                  console.log("🔍 ==== USUÁRIOS DO SQLITE ====\n", allUsers)
                }}
              >
                <Text style={styles.buttonText}>[DEV] Ver Banco Local</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#D32F2F" }]}
                onPress={handleDeleteDB}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  [DEV] Excluir Banco de Dados
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        type="error"
        onClose={() => setErrorModalVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.lightGray,
  },
  logo: {
    width: 140,
    height: 100,
    resizeMode: "contain",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    width: "90%",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  passwordContainer: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: colors.yellow,
    padding: 12,
    borderRadius: 8,
    width: "90%",
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
  },
  link: {
    color: colors.mediumGray,
    marginTop: 10,
    textAlign: "center",
  },
})

export default LoginScreen
