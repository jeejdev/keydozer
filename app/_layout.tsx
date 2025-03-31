import React, { useEffect, useState } from "react"
import { Alert } from "react-native"
import { StatusBar } from "expo-status-bar"
import { useFonts } from "expo-font"
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native"
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList, DrawerContentComponentProps } from "@react-navigation/drawer"
import { Ionicons } from "@expo/vector-icons"
import "react-native-reanimated"

import { Stack, usePathname, useRouter } from "expo-router"
import { onAuthStateChanged, signOut } from "firebase/auth"
import type { User as FirebaseUser } from "firebase/auth"

import { auth } from "../services/firebaseConfig"
import { useColorScheme } from "@/hooks/useColorScheme"
import SplashScreen from "../components/SplashScreen"
import { colors } from "../utils/theme"
import HomeScreen from "./(home)/home"
import SettingsScreen from "./(config)/settings"
import { useAuth } from "../context/AuthContext"
import PasswordListScreen from "./(passwords)/all"
import PasswordManagerScreen from "./(passwords)/PasswordManagerScreen"
import { clearDecryptedMasterKey } from "@/utils/secureStore"

const Drawer = createDrawerNavigator()

const DrawerNavigator = () => {
  const router = useRouter()
  const { setFirebaseUser, setLocalUser } = useAuth()

  const CustomDrawerContent = (props: DrawerContentComponentProps) => {
    const handleLogout = () => {
      Alert.alert(
        "Sair da Conta",
        "Tem certeza que deseja sair?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sair",
            style: "destructive",
            onPress: async () => {
              try {
                await signOut(auth)
                await clearDecryptedMasterKey()
                setFirebaseUser(null)
                setLocalUser(null)
                router.replace("/")
              } catch (error) {
                console.error("Erro ao sair:", error)
              }
            },            
          },
        ],
        { cancelable: false }
      )
    }

    return (
      <DrawerContentScrollView {...props} style={{ backgroundColor: colors.mediumGray }}>
        <DrawerItemList {...props} />
        <DrawerItem
          label="Sair"
          icon={({ color }) => <Ionicons name="exit-outline" size={24} color={color} />}
          onPress={handleLogout}
          labelStyle={{ color: colors.white }}
        />
      </DrawerContentScrollView>
    )
  }

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.darkGray },
        headerTintColor: colors.white,
        drawerActiveBackgroundColor: colors.yellow,
        drawerActiveTintColor: colors.darkGray,
        drawerInactiveTintColor: colors.white,
        drawerStyle: { backgroundColor: colors.mediumGray },
      }}
    >
      <Drawer.Screen
        name="home"
        component={HomeScreen}
        options={{
          title: "Início",
          drawerIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Drawer.Screen
        name="minhas-senhas"
        component={PasswordManagerScreen}
        options={{
          title: "Minhas Senhas",
          drawerIcon: ({ color }) => <Ionicons name="lock-closed" size={24} color={color} />,
        }}
      />
      <Drawer.Screen
        name="gerar-senha"
        component={HomeScreen}
        options={{
          title: "Gerar Senha",
          drawerIcon: ({ color }) => <Ionicons name="key" size={24} color={color} />,
        }}
      />
      <Drawer.Screen
        name="exportar-senhas"
        component={HomeScreen}
        options={{
          title: "Exportar Senhas",
          drawerIcon: ({ color }) => <Ionicons name="cloud-download" size={24} color={color} />,
        }}
      />
      <Drawer.Screen
        name="settings"
        component={SettingsScreen}
        options={{
          title: "Configurações",
          drawerIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
        }}
      />
    </Drawer.Navigator>
  )
}

const RootLayout: React.FC = () => {
  const colorScheme = useColorScheme()
  const router = useRouter()
  const [fontsLoaded] = useFonts({
    Roboto: require("../assets/fonts/Roboto-Regular.ttf"),
  })

  const [isSplashVisible, setIsSplashVisible] = useState<boolean>(true)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const pathname = usePathname()

  const [authReady, setAuthReady] = useState(false)
  const { setFirebaseUser: setCtxFirebaseUser, isAuthenticated } = useAuth()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setIsSplashVisible(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (firebaseUser !== undefined) {
      setCtxFirebaseUser(firebaseUser)
      setAuthReady(true)
    }
  }, [firebaseUser])

  if (!fontsLoaded || !authReady || isSplashVisible) {
    return <SplashScreen />
  }

  const hideSidebarScreens = ["/", "/register"]
  const isSidebarVisible = isAuthenticated && !hideSidebarScreens.includes(pathname)

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {isSidebarVisible ? (
        <DrawerNavigator />
      ) : (
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}

export default RootLayout
