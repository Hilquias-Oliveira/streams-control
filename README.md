# Streams Control 🎬

> Sistema inteligente para gestão de pagamentos de serviços de streaming compartilhados.

## 🚀 Sobre o Projeto

**Streams Control** é uma aplicação completa para administrar grupos de assinaturas (como Netflix, Spotify, YouTube Premium). Ele resolve o caos das planilhas e cobranças manuais, oferecendo um painel visual onde cada membro pode ver o que deve, enviar comprovantes e receber lembretes automáticos.

## ✨ Funcionalidades Principais

-   💸 **Painel de Pagamentos:** Status visual de cada fatura (Pendente, Aguardando Aprovação, Pago).
-   🛡️ **Controle de Acesso:**
    -   **Admin:** Acesso total ao sistema.
    -   **Supervisor:** Gerencia apenas os serviços que é responsável (ex: "Dono" do cartão da Netflix).
    -   **Usuário:** Vê apenas suas próprias dívidas.
-   🔔 **Notificações Automáticas:** Lembretes de vencimento e confirmação de pagamento.
-   💾 **Performance Otimizada:**
    -   Filtragem Server-Side (baixa apenas o necessário).
    -   Persistência Local (funciona offline/cache).
    -   Otimização de Imagens (Firebase Storage).
-   📊 **Logs de Auditoria:** Histórico completo de quem aprovou/rejeitou cada pagamento.
-   🎨 **Interface Moderna:** UI responsiva e amigável feita com TailwindCSS.

## 🛠️ Tecnologias Utilizadas

-   **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
-   **Estilização:** [TailwindCSS](https://tailwindcss.com/)
-   **Ícones:** [Lucide React](https://lucide.dev/)
-   **Backend (Serverless):** [Firebase](https://firebase.google.com/)
    -   🔥 **Firestore:** Banco de dados NoSQL em tempo real.
    -   🔐 **Authentication:** Gestão de usuários e login.
    -   ☁️ **Cloud Functions:** Lógica de backend para notificações e automações.
    -   📦 **Storage:** Armazenamento otimizado de logos e avatares.
    -   🌎 **Hosting:** Hospedagem rápida e segura.

## 📦 Como Rodar Localmente

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/streams-control.git
    cd streams-control
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Variáveis de Ambiente:**
    Crie um arquivo `.env` na raiz com suas chaves do Firebase:
    ```env
    VITE_FIREBASE_API_KEY=seu_api_key
    VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=seu_projeto
    VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.firebasestorage.app
    VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
    VITE_FIREBASE_APP_ID=seu_app_id
    ```

4.  **Inicie o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

## 🚀 Deploy

O projeto está configurado para deploy automático no Firebase Hosting:

```bash
# Deploy para Homologação (Canal Preview)
npx firebase-tools hosting:channel:deploy homologacao

# Deploy para Produção
npx firebase-tools deploy
```

---
Desenvolvido com 💙 para organizar a vida digital.
