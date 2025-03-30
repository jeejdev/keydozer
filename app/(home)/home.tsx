import React from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native"
import { useNavigation, DrawerActions } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "../../utils/theme"

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
