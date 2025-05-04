import React, { useEffect, useState } from "react"
import { View, Text, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useNavigation } from "@react-navigation/native"
import { addPassword, getPasswordsByUserId } from "../../services/database"
import { useAuth } from "../../context/AuthContext"
import { encryptData } from "../../utils/encryption"
import { colors } from "../../utils/theme"

const ScanQRCodeScreen = () => {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const { localUser } = useAuth()
  const navigation = useNavigation()

  useEffect(() => {
    if (!permission?.granted) requestPermission()
  }, [])

  const handleBarCodeScanned = async (event: any) => {
    if (scanned) return
    setScanned(true)
  
    try {
      const parsed = JSON.parse(event.data)
  
      if (!parsed.serviceName || !parsed.password) throw new Error("QR inválido")
  
      const current = await getPasswordsByUserId(localUser!.id)
      const duplicate = current.find(
        (c) =>
          c.serviceName === parsed.serviceName &&
          c.username === parsed.username &&
          c.category === parsed.category
      )
  
      const savePassword = async () => {
        const encryptedPassword = encryptData(parsed.password, localUser?.decryptedMasterKey || "")
        const encryptedAdditional = encryptData(parsed.additionalInfo || "", localUser?.decryptedMasterKey || "")
  
        await addPassword(
          localUser?.id!,
          encryptedPassword,
          parsed.serviceName,
          parsed.username || "",
          parsed.category || "",
          encryptedAdditional
        )
  
        Alert.alert("Sucesso", "Senha importada com sucesso!", [
          { text: "OK", onPress: () => navigation.goBack() },
        ])
      }
  
      if (duplicate) {
        Alert.alert(
          "Senha já existe",
          "Já existe uma senha com os mesmos dados.\nDeseja importar mesmo assim?",
          [
            { text: "Cancelar", style: "cancel", onPress: () => setScanned(false) },
            { text: "Importar", style: "default", onPress: savePassword },
          ]
        )
      } else {
        await savePassword()
      }
    } catch {
      Alert.alert("Erro", "QR Code inválido.")
      setScanned(false)
    }
  }
  

  if (!permission) return <ActivityIndicator style={{ flex: 1 }} />
  if (!permission.granted) return <Text style={styles.text}>Permissão da câmera negada.</Text>

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    flex: 1,
    textAlign: "center",
    justifyContent: "center",
    fontSize: 18,
    marginTop: 20,
    color: colors.darkGray,
  },
})

export default ScanQRCodeScreen
