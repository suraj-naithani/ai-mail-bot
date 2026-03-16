# 📧 AI Mail Bot

AI Mail Bot is a production-ready AI assistant that connects securely with Gmail and allows users to chat with their email inbox. It uses Retrieval-Augmented Generation (RAG) to analyze emails, threads, and attachments to generate accurate responses, summaries, and replies.

Users can search email history, generate AI replies, draft follow-up emails, and ask questions about past conversations.

---

# 🚀 Features

## Gmail Integration
- Secure Google OAuth authentication
- No password storage
- Automatic syncing of:
  - Emails
  - Email threads
  - Attachments (PDF, DOCX, etc.)

## AI Email Assistant
- Chat with your inbox
- Generate email replies
- Draft follow-up emails
- Maintain full conversation history
- Ask questions about past emails

## Smart Email Retrieval (RAG)
- Emails are parsed and structured
- Content converted into embeddings
- Stored in Pinecone vector database
- Relevant emails retrieved before generating AI responses

## Knowledge Integration
The assistant can understand:
- Internal company documents
- Policies
- Manuals
- Uploaded PDFs and DOCX files

## Email Insights
Extract useful information such as:
- Decisions in email threads
- Action items
- Meeting confirmations
- Important summaries

---

# 🏗️ System Architecture

```
User
 │
 ▼
Next.js Frontend (Chat Interface)
 │
 ▼
Express API Server
 │
 ├── Gmail API (OAuth + Email Sync)
 ├── Email Parser (mailparser)
 ├── Attachment Parser (PDF, DOCX)
 │
 ▼
Embedding Pipeline
 │
 ▼
Pinecone Vector Database
 │
 ▼
OpenAI LLM
 │
 ▼
AI Response (with email context)
```

---

# 🧰 Tech Stack

## Frontend
- Next.js 16
- React 19
- Redux Toolkit
- TailwindCSS
- Lucide React Icons
- React Markdown

## Backend
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- OpenAI API
- Pinecone Vector Database

## Integrations
- Gmail API
- Google OAuth2
- IMAP
- Mailparser
- PDF Parser
- Mammoth (DOCX parsing)

---

# 📁 Project Structure

```
ai-mail-bot
│
├── client/                 # Next.js frontend
│   ├── components
│   ├── store
│   ├── pages / app
│   └── services
│
├── server/                 # Express backend
│   ├── src
│   │   ├── controllers
│   │   ├── routes
│   │   ├── services
│   │   ├── gmail
│   │   ├── rag
│   │   └── utils
│   │
│   ├── prisma
│   └── index.js
│
└── README.md
```

---

# 🔐 Authentication Flow

1. User logs in with **Google OAuth**
2. Access token is generated securely
3. Gmail API fetches:
   - Emails
   - Threads
   - Attachments
4. Tokens are stored securely using JWT

---

# 🧠 RAG Email Processing Pipeline

1. Fetch email from Gmail API  
2. Parse email content  
3. Extract attachments  
4. Convert documents to text  
5. Generate embeddings  
6. Store vectors in Pinecone  
7. Retrieve relevant emails during chat  
8. Send context to OpenAI  
9. Generate AI response  

---

# 💬 Example Queries

```
What did John say about the project deadline?

Summarize my last conversation with the marketing team.

Generate a reply to Sarah confirming the meeting.

Show emails where payment confirmation was discussed.

Draft a follow-up email for the proposal I sent last week.
```

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ai-mail-bot.git
cd ai-mail-bot
```

---

# 📦 Install Dependencies

## Frontend

```bash
cd client
npm install
```

## Backend

```bash
cd server
npm install
```

---

# 🗄️ Database Setup

Using **Prisma + PostgreSQL**

Generate Prisma client:

```bash
npm run db:generate
```

Push schema:

```bash
npm run db:push
```

Run migrations:

```bash
npm run db:migrate
```

---

# 🔑 Environment Variables

Create a `.env` file inside `server/` directory.

```
DATABASE_URL=

OPENAI_API_KEY=

PINECONE_API_KEY=
PINECONE_INDEX=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

JWT_SECRET=
```

---

# 🚀 Running the Application

## Start Backend

```bash
cd server
npm run dev
```

## Start Frontend

```bash
cd client
npm run dev
```

Frontend will run on:

```
http://localhost:3031
```

---

# 📥 Supported File Types

The AI assistant can process attachments such as:

- PDF
- DOCX
- TXT
- Email threads

---

# 📬 Example Workflow

1. User connects Gmail account
2. Emails are synced and indexed
3. User opens AI chat interface
4. User asks a question
5. Relevant emails retrieved from Pinecone
6. Context sent to OpenAI
7. AI generates accurate response

---

# 🔒 Security

- OAuth authentication
- No password storage
- Secure token-based authentication (JWT)
- Environment variables for secrets
- Secure API communication

---
