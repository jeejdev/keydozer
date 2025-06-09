import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
} from "react-native"
import { useNavigation, DrawerActions } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "../../utils/theme"
import { NetworkInfo } from "react-native-network-info"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Tipagem das props do componente FeatureItem
type FeatureItemProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title }) => (
  <View style={styles.featureItem}>
    <Ionicons name={icon} size={24} color={colors.yellow} />
    <Text style={styles.featureText}>{title}</Text>
  </View>
)

const HomeScreen: React.FC = () => {
  const navigation = useNavigation()

  const [currentSSID, setCurrentSSID] = useState<string | null>(null)

  useEffect(() => {
    const checkWifi = async () => {
      try {
        console.log("🔍 Iniciando verificação de rede Wi-Fi...")

        // Checar se usuário já marcou "Estou ciente"
        const skipAlert = await AsyncStorage.getItem("skipPublicWifiAlert")
        if (skipAlert === "true") {
          console.log("🚫 Usuário optou por não exibir mais o alerta de Wi-Fi público.")
          return
        }

        if (Platform.OS === "android") {
          console.log("📱 Plataforma Android detectada. Verificando permissões...")

          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: "Permissão de Localização",
              message:
                "Para detectar redes Wi-Fi públicas e proteger seu uso de senhas, o Keydozer precisa de acesso à localização.",
              buttonNeutral: "Perguntar depois",
              buttonNegative: "Negar",
              buttonPositive: "Permitir",
            }
          )

          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log("❌ Permissão de localização NEGADA. Não será possível verificar SSID.")
            return
          }

          console.log("✅ Permissão de localização CONCEDIDA.")
        }

        const ssid = await NetworkInfo.getSSID()
        console.log("📡 SSID atual recebido da API:", ssid)
        setCurrentSSID(ssid)

        const palavrasPerigosas = [
          "VISITANTE",
          "CLIENTE",
          "CAFÉ",
          "AEROPORTO",
          "FREE",
          "OPEN",
          "PUBLICO",
          "VIVO",
        ]

        if (!ssid) {
          console.log("⚠️ Nenhum SSID detectado (pode ser emulador, permissão faltando, ou rede oculta).")
          return
        }

        const ssidUpper = ssid.toUpperCase()
        console.log("🔍 SSID normalizado:", ssidUpper)

        const match = palavrasPerigosas.some((palavra) => {
          const found = ssidUpper.includes(palavra)
          console.log(`🔍 Verificando palavra "${palavra}" → ${found ? "MATCH" : "no match"}`)
          return found
        })

        if (match) {
          console.log("🚨 Palavra perigosa detectada! Exibindo alerta...")
          Alert.alert(
            "⚠️ Atenção: Rede Wi-Fi Pública Detectada",
            `Você está conectado à rede Wi-Fi "${ssid}". Este é um recurso do Keydozer para alertar sobre o uso de redes públicas. Evite realizar logins ou acessar informações sensíveis nesta rede.`,
            [
              { text: "Ok", style: "cancel" },
              {
                text: "Estou ciente (não mostrar mais)",
                onPress: async () => {
                  await AsyncStorage.setItem("skipPublicWifiAlert", "true")
                  console.log("✅ Usuário escolheu não mostrar mais o alerta de Wi-Fi público.")
                },
              },
            ]
          )
        } else {
          console.log("✅ Nenhuma palavra perigosa detectada na rede Wi-Fi atual.")
        }
      } catch (error) {
        console.error("❌ Erro ao verificar rede Wi-Fi:", error)
      }
    }

    checkWifi()
  }, [])

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/logo_2.png")}
        style={styles.logo}
      />

      <Text style={styles.title}>Bem-vindo ao Keydozer</Text>
      <Text style={styles.subtitle}>
        Gerencie suas senhas de forma segura e eficiente.
      </Text>

      <View style={styles.featuresContainer}>
        <FeatureItem icon="lock-closed" title="Armazene senhas criptografadas" />
        <FeatureItem icon="key" title="Gere senhas fortes automaticamente" />
        <FeatureItem icon="cloud" title="Sincronize com a nuvem" />
        <FeatureItem icon="share-social" title="Compartilhe senhas com segurança" />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <Ionicons name="menu" size={24} color={colors.darkGray} />
        <Text style={styles.buttonText}>Abrir Menu</Text>
      </TouchableOpacity>
    </View>
  )
}

export default HomeScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.darkGray,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mediumGray,
    textAlign: "center",
    marginBottom: 20,
  },
  featuresContainer: {
    width: "100%",
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 10,
    elevation: 5,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  featureText: {
    fontSize: 16,
    color: colors.darkGray,
    marginLeft: 10,
  },
  button: {
    flexDirection: "row",
    backgroundColor: colors.yellow,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "60%",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.darkGray,
    marginLeft: 8,
  },
  logo: {
    width: 140,
    height: 100,
    resizeMode: "contain",
    marginBottom: 20,
  },
})
