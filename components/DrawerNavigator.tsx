import React, { useEffect } from "react"
import { createDrawerNavigator } from "@react-navigation/drawer"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "../utils/theme"
import { useAuth } from "../context/AuthContext"
import { signOut } from "firebase/auth"
import { auth } from "../services/firebaseConfig"

const Drawer = createDrawerNavigator()

const EmptyScreen = () => <View style={{ flex: 1, backgroundColor: colors.lightGray }} />

const CustomDrawer = () => {
  const router = useRouter()
  const { setFirebaseUser, setLocalUser } = useAuth()

  useEffect(() => {
    router.replace("/(home)/home")
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    setFirebaseUser(null)
    setLocalUser(null)
    router.replace("/")
  }

  return (
    <DrawerContentScrollView style={{ backgroundColor: colors.mediumGray }}>
      <DrawerItem
        label="Início"
        icon={({ color }) => <Ionicons name="home" size={22} color={color} />}
        onPress={() => router.push("/(home)/home")}
        labelStyle={{ color: colors.white }}
      />
      <DrawerItem
        label="Minhas Senhas"
        icon={({ color }) => <Ionicons name="lock-closed" size={22} color={color} />}
        onPress={() => router.push("/(passwords)/all")}
        labelStyle={{ color: colors.white }}
      />
      <DrawerItem
        label="Sair"
        icon={({ color }) => <Ionicons name="exit-outline" size={22} color={color} />}
        onPress={handleLogout}
        labelStyle={{ color: colors.white }}
      />
    </DrawerContentScrollView>
  )
}

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={() => <CustomDrawer />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.darkGray,
        drawerInactiveTintColor: colors.white,
        drawerActiveBackgroundColor: colors.yellow,
        drawerStyle: { backgroundColor: colors.mediumGray },
      }}
    >
      <Drawer.Screen name="placeholder" component={EmptyScreen} />
    </Drawer.Navigator>
  )
}

export default DrawerNavigator
