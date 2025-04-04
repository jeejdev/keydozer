import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  getAllUsers,
  getLastUser,
  initDB,
  deleteDatabase,
  getPasswordsByUserId,
} from "../services/database";
import * as FileSystem from "expo-file-system";
import * as LocalAuthentication from "expo-local-authentication";
import { colors } from "../utils/theme";
import ErrorModal from "../components/ErrorModal";
import User from "../models/User";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { getUserByEmail } from "../services/database";
import { decryptWithPassword } from "@/utils/encryption";
import {
  getDecryptedMasterKey,
  saveDecryptedMasterKey,
} from "@/utils/secureStore";

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setLocalUser } = useAuth();

  const firstLogin = params?.firstLogin === "true";
  const paramEmail = typeof params?.email === "string" ? params.email : undefined;
  const paramPassword = typeof params?.password === "string" ? params.password : undefined;

  const DEV_EMAIL = paramEmail || "novaconta@gmail.com";
  const DEV_PASSWORD = paramPassword || "*K(Yg*A<;Fy*8.^6";

  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [isLoading, setIsLoading] = useState(true);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [suggestedUser, setSuggestedUser] = useState<User | null>(null);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const dbPath = FileSystem.documentDirectory + "SQLite/keydozer.db";
        const fileInfo = await FileSystem.getInfoAsync(dbPath);

        if (!fileInfo.exists) {
          await initDB();
        }

        const localUser = await getLastUser();

        if (localUser) {
          const cachedKey = await getDecryptedMasterKey();

          if (cachedKey) {
            setSuggestedUser(localUser);
          } else {
            setSuggestedUser(null);
            if (!firstLogin) {
              setTimeout(() => {
                showError(
                  "🔐 Você saiu da sua conta ou limpou os dados do app.\n\nPor segurança, o acesso via biometria foi desativado. Faça login com e-mail e senha para restaurar o acesso e reativar a biometria."
                );
              }, 300);
            }
          }
        }
      } catch (error) {
        showError("Erro ao inicializar o app.");
        console.error("Erro no init:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const handleLogin = async () => {
    if (isLoading) return;

    try {
      await loginUser(email, password);

      const local = await getUserByEmail(email);
      if (local) {
        // 🔓 Descriptografa a masterKey com a senha do login
        const decrypted = decryptWithPassword(
          local.encryptedMasterKey,
          password
        );

        if (!decrypted) {
          console.error(
            "❌ Falha ao descriptografar a masterKey no login com senha"
          );
          showError(
            "Erro ao descriptografar a chave mestra. Verifique sua senha."
          );
          return;
        }

        local.decryptedMasterKey = decrypted;
        console.log(
          "🧠 localUser definido no contexto (com masterKey descriptografada):",
          local
        );

        await saveDecryptedMasterKey(decrypted);
        setLocalUser(local);
        router.replace("/home");
      } else {
        console.warn("⚠️ Usuário não encontrado no SQLite");
        showError("Usuário local não encontrado.");
      }
    } catch (error: any) {
      console.error("Erro no login:", error);
      if (error.code === "auth/invalid-email") {
        showError("E-mail inválido.");
      } else if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        showError("E-mail ou senha incorretos.");
      } else {
        showError("Erro ao fazer login. Tente novamente mais tarde.");
      }
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        showError("Seu dispositivo não suporta biometria.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Autentique para continuar",
        fallbackLabel: "Usar senha",
      });

      if (result.success && suggestedUser) {
        const cachedKey = await getDecryptedMasterKey();

        if (!cachedKey) {
          showError(
            "Você já saiu da sua conta ou limpou os dados. Por segurança, a chave mestra foi apagada.\n\nFaça login com sua senha para restaurar o acesso e reativar o login com biometria."
          );
          setSuggestedUser(null); // 👈 Mostra o login normal
          return;
        }

        suggestedUser.decryptedMasterKey = cachedKey;
        setLocalUser(suggestedUser);
        router.replace("/home");
      }
    } catch (error) {
      console.error("Erro biometria:", error);
      showError("Erro ao logar com biometria.");
    }
  };

  const handleDeleteDB = async () => {
    try {
      await deleteDatabase();
    } catch (err) {
      console.error("Erro ao excluir banco local:", err);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/logo.png")}
        style={styles.logo}
      />

      {suggestedUser ? (
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Text style={styles.title}>Bem-vindo de volta, {suggestedUser.name}!</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleBiometricLogin}
          >
            <Text style={styles.buttonText}>🔐 Logar com biometria</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSuggestedUser(null)}>
            <Text style={styles.link}>
              Não é {suggestedUser.name}? Logar com outra conta
            </Text>
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
          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.link}>Não tem uma conta? Criar conta</Text>
          </TouchableOpacity>

          {process.env.EXPO_PUBLIC_DEVELOPMENT_MODE === "True" && (
            <>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.blue }]}
                onPress={async () => {
                  const allUsers = await getAllUsers();
                  console.log("🔍 ==== USUÁRIOS DO SQLITE ====");

                  for (const user of allUsers) {
                    console.log(`👤 Nome: ${user.name}`);
                    console.log(`📧 Email: ${user.email}`);
                    console.log(`🆔 ID: ${user.id}`);
                    console.log(
                      `🔐 MasterKey Criptografada: ${user.encryptedMasterKey}`
                    );
                    console.log(
                      `💡 Dica de senha: ${user.passwordHint || "Nenhuma"}`
                    );
                    console.log(`📅 Criado em: ${user.createdAt}`);
                    console.log(`---------------------------`);

                    const passwords = await getPasswordsByUserId(user.id);

                    if (passwords.length === 0) {
                      console.log("🔓 Nenhuma senha cadastrada.\n");
                    } else {
                      console.log(`🔐 Senhas cadastradas:`);
                      passwords.forEach((pw, index) => {
                        console.log(
                          `\n  ${index + 1}) Serviço: ${pw.serviceName}`
                        );
                        console.log(`     🆔 ID: ${pw.id}`);
                        console.log(`     👤 Username: ${pw.username}`);
                        console.log(`     🌐 URL: ${pw.url}`);
                        console.log(`     🗂 Categoria: ${pw.category}`);
                        console.log(
                          `     📝 Notas (criptografadas): ${pw.notes}`
                        );
                        console.log(
                          `     🔑 Senha (criptografada): ${pw.encryptedPassword}`
                        );
                        console.log(`     📅 Criado em: ${pw.createdAt}`);
                        console.log(`     🕒 Atualizado em: ${pw.updatedAt}`);
                      });
                      console.log("\n==============================\n");
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
  );
};

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
});

export default LoginScreen;
