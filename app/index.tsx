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

import {
  getAllUsers,
  initDB,
  deleteDatabase,
  getPasswordsByUserId,
  getUserByEmail,
  addUser,
} from "../services/database"
import * as FileSystem from "expo-file-system"
import * as LocalAuthentication from "expo-local-authentication"
import { colors } from "../utils/theme"
import ErrorModal from "../components/ErrorModal"
import User from "../models/User"
import { loginUser } from "../services/authService"
import { useAuth } from "../context/AuthContext"
import { encryptWithPassword, generateRandomMasterKey, hashPassword } from "@/utils/encryption"
import { auth } from "@/services/firebaseConfig"

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

  const params = useLocalSearchParams();
  const isFirstLogin = params.firstLogin === "true";

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
          if (user) setSuggestedUser(user)
        }
      } catch (error) {
        showError("Erro ao inicializar o app.")
        console.error("Erro no init:", error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const handleLogin = async () => {
  if (isLoading) return;

  try {
    // 1. Autentica no Firebase
    await loginUser(email, password);

    // 2. Verifica se já existe no SQLite
    let localUser = await getUserByEmail(email);

    if (!localUser) {
      // 3. Usuário não existe localmente → cria
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("Usuário Firebase não disponível");

      const masterKey = await generateRandomMasterKey();
      const encryptedMasterKey = encryptWithPassword(masterKey, password);
      const hashedPassword = await hashPassword(password);

      await addUser(
        firebaseUser.displayName || "Nova Conta",
        email,
        hashedPassword,
        encryptedMasterKey,
        null // TODO: recuperar na 3a sprint a passwordHint
      );

      localUser = await getUserByEmail(email);
      console.log("🆕 Usuário criado localmente:", localUser);
    }

    setLocalUser(localUser);
    await AsyncStorage.setItem("lastLoggedInEmail", email);

    router.replace("/home");

  } catch (error: any) {
    console.error("Erro no login:", error)
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
};
  if (isFirstLogin && email && password) handleLogin()

  const handleBiometricLogin = async () => {
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

      if (result.success) {
        const lastEmail = await AsyncStorage.getItem("lastLoggedInEmail")
        if (lastEmail) {
          const localUser = await getUserByEmail(lastEmail)
          if (localUser) {
            setLocalUser(localUser)
            router.replace("/home")
            return
          }
        }
        showError("Usuário local não encontrado após autenticação.")
      }
    } catch (error) {
      console.error("Erro biometria:", error)
      showError("Erro ao logar com biometria.")
    }
  }

  const handleDeleteDB = async () => {
    try {
      await deleteDatabase()
    } catch (err) {
      console.error("Erro ao excluir banco local:", err)
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

      {suggestedUser ? (
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
                  console.log("🔍 ==== USUÁRIOS DO SQLITE ====\n")

                  for (const user of allUsers) {
                    console.log(`👤 Nome: ${user.name}`)
                    console.log(`📧 Email: ${user.email}`)
                    console.log(`🆔 ID: ${user.id}`)
                    console.log(`🔐 MasterKey Criptografada: ${user.encryptedMasterKey}`)
                    console.log(`💡 Dica de senha: ${user.passwordHint || "Nenhuma"}`)
                    console.log(`📅 Criado em: ${user.createdAt}`)
                    console.log("---------------------------")

                    const passwords = await getPasswordsByUserId(user.id)
                    if (passwords.length === 0) {
                      console.log("🔓 Nenhuma senha cadastrada.\n")
                      console.log("==============================================")
                    } else {
                      console.log(`🔐 Senhas cadastradas:`)
                      passwords.forEach((pw, index) => {
                        console.log(`\n  ${index + 1}) Serviço: ${pw.serviceName}`)
                        console.log(`     🆔 ID: ${pw.id}`)
                        console.log(`     👤 Username: ${pw.username}`)
                        console.log(`     🗂 Categoria: ${pw.category}`)
                        console.log(`     📝 Notas: ${pw.additionalInfo}`)
                        console.log(`     🔑 Senha: ${pw.encryptedPassword}`)
                      })
                      console.log("\n==============================\n")
                    }
                  }
                }}
              >
                <Text style={styles.buttonText}>[DEV] Ver Banco Local</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#D32F2F" }]}
                onPress={handleDeleteDB}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>[DEV] Excluir Banco de Dados</Text>
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
