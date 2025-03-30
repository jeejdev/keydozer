import { ExpoRoot } from "expo-router"
import { AuthProvider } from "./context/AuthContext"

const App = () => {
  const ctx = require.context("./app")

  return (
    <AuthProvider>
      <ExpoRoot context={ctx} />
    </AuthProvider>
  )
}

export default App

