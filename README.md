# Keydozer - Aplicativo de Gerenciamento de Senhas

## 📌 Sobre o Projeto
**Keydozer** é um aplicativo de gerenciamento de senhas desenvolvido para a disciplina **Programação para Dispositivos Móveis I**. O objetivo do aplicativo é fornecer uma solução segura e eficiente para armazenar e organizar senhas, garantindo criptografia e funcionalidades avançadas como autenticação biométrica, geração automática de senhas e sincronização na nuvem.

---

## 📆 Planejamento das Sprints

O desenvolvimento do projeto foi dividido em **três sprints**, cobrindo os **18 requisitos** definidos:

### 🚀 **Sprint 1 - Entrega: 31/03/2025**

| Tarefa                                                                                     | Requisito | Status |
|--------------------------------------------------------------------------------------------|-----------|--------|
| Configurar o ambiente de desenvolvimento (React Native + Expo)                             | -         | ✅     |
| Criar o repositório no GitHub                                                              | -         | ✅     |
| Criar a estrutura inicial do projeto                                                       | -         | ✅     |
| Implementar a tela de login e autenticação biométrica                                      | 3         | ✅     |
| Criar o banco de dados local seguro para armazenar senhas                                  | 1         | ✅     |
| Implementar criptografia para as senhas                                                    | 2         | ✅     |
| Criar funcionalidade de geração de senhas fortes                                           | 4         | ✅     |
| Permitir cadastro e visualização de senhas com nome de usuário e URL                       | 5         | ✅     |
| Implementar funcionalidades de modificação e exclusão de senhas                            | 18        | ✅     |

---

### 🔐 **Sprint 2 - Entrega: 05/05/2025**

| Tarefa                                                                                     | Requisito | Status |
|--------------------------------------------------------------------------------------------|-----------|--------|
| Implementar categorias para organização de senhas                                          | 7         | ✅     |
| Criar funcionalidade de exportação segura de senhas                                        | 6         | ✅     |
| Gerar QR Codes para facilitar o acesso às senhas                                           | 8         | ✅     |
| Detectar senhas fracas e sugerir alterações                                                | 10        | ✅     |
| Permitir escaneamento de QR Codes para ler senha de outros usuários                        | 13        | ✅     |
| Armazenamento de notas seguras junto com as senhas                                         | 14        | ✅     |
| Gerar relatórios de segurança de senhas                                                    | 16        | ✅     |

---

### 📊 **Sprint 3 - Entrega: 02/06/2025**

| Tarefa                                                                                     | Requisito | Status |
|--------------------------------------------------------------------------------------------|-----------|--------|
| Sincronização de senhas entre dispositivos via nuvem                                       | 11        | 🔜     |
| Compartilhamento seguro de senhas entre usuários                                           | 12        | 🔜     |
| Implementar alertas de segurança ao detectar redes Wi-Fi públicas                          | 15        | 🔜     |
| Adicionar suporte para autenticação de dois fatores (2FA)                                  | 17        | 🔜     |
| Implementar a recuperação de senhas por perguntas de segurança ou e-mail                   | 9         | 🔜     |
| Melhorias gerais na interface e experiência do usuário (UX/UI)                             | -         | 🔜     |

---

## 📖 Como Rodar o Projeto

### **1. Pré-requisitos**
Antes de começar, certifique-se de ter instalado:
- [Node.js](https://nodejs.org/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Git](https://git-scm.com/)
- [Android Studio (para emulador)](https://developer.android.com/studio)

### **2. Clonar o Repositório**
Abra o terminal e execute:
```sh
git clone https://github.com/seu-usuario/keydozer.git
cd keydozer
```

### **3. Instalar Dependências**
Execute o seguinte comando para instalar as dependências:
```sh
npm install
```

### **4. Rodar o Projeto**

#### 🔵 **Para rodar no celular (Expo Go):**
```sh
npx expo start
```
- Escaneie o QR Code exibido no terminal com o aplicativo **Expo Go** (Android/iOS).

#### 🟢 **Para rodar no Emulador Android:**
1. Inicie o emulador manualmente pelo **Android Studio**.
2. No terminal, execute:
```sh
npx expo start --android
```

#### 🟣 **Para rodar no Emulador iOS (MacOS + Xcode necessário):**
```sh
npx expo start --ios
```

---

## 📌 Tecnologias Utilizadas
- **React Native** + **Expo**
- **SQLite** (armazenamento local)
- **Expo Secure Store / Encrypted Storage** (segurança)
- **Autenticação Biométrica (Fingerprint/FaceID)**
- **QRCode / Scanner (futuramente)**

---

> Última atualização: 29/03/2025
