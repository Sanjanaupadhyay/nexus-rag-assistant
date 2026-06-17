# Nexus Enterprise RAG Assistant

An advanced, responsive, and high-performance Retrieval-Augmented Generation (RAG) assistant designed for enterprise knowledge search. It features a custom pure-Python vector database, document parser, Server-Sent Events (SSE) streaming answers, and a gorgeous modern glassmorphic UI.

---

## Features

- **Document Ingestion**: Upload `.txt`, `.pdf`, and `.docx` documents. The system automatically parses, chunks, and indexes them.
- **Custom Vector DB**: A lightweight, highly optimized pure-Python vector store utilizing NumPy for fast cosine similarity searches.
- **Smart Chunking**: Implements a recursive character text splitter with adjustable chunk sizes and overlaps.
- **Streaming Chat**: Conversational interface using Server-Sent Events (SSE) to stream responses chunk-by-chunk.
- **Source Citations**: Displays exact source snippets and document references with similarity scores for every answer.
- **Dual Providers**: Seamless support for both **Google Gemini** (default) and **OpenAI** APIs.
- **Glassmorphic UI**: A modern dashboard with smooth micro-animations, real-time analytics, and comprehensive database statistics.

---

## Technology Stack

- **Backend**: FastAPI, Uvicorn, Pydantic, Python-Multipart
- **Text Processing**: PyPDF, docx2txt, NumPy
- **LLM Integrations**: Google Generative AI (`google-generativeai`), OpenAI Python Client
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Custom Glassmorphism)

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd "RAG Project"
```

### 2. Set Up a Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1

# On Windows Command Prompt:
.\venv\Scripts\activate.bat

# On macOS / Linux:
source venv/bin/activate
```
> **Note for Windows PowerShell**: If you receive an execution policy restriction error, you can activate it by running:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` or run the app directly using the environment's python: `.\venv\Scripts\python.exe -m uvicorn app:app --reload`

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## Running the Application

### Start the FastAPI Server
To launch the backend server and frontend client:
```bash
python -m uvicorn app:app --reload
```

Open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## API Keys configuration

You can configure your API keys in two ways:
1. **Directly in the Web UI**: Click the gear/settings icon in the UI dashboard to input your Gemini or OpenAI API keys directly.
2. **Environment Variables**: Define them in your terminal environment before running the server:
   - **Windows PowerShell**:
     ```powershell
     $env:GEMINI_API_KEY="your-gemini-key"
     $env:OPENAI_API_KEY="your-openai-key"
     ```
   - **Linux/macOS**:
     ```bash
     export GEMINI_API_KEY="your-gemini-key"
     export OPENAI_API_KEY="your-openai-key"
     ```

---

## Codebase Structure

- `app.py`: Main FastAPI server setup hosting Chat, Document upload/deletion, and Analytics endpoints.
- `vector_store.py`: Document parsing (`docx`, `pdf`, `txt`), text chunker, embedding generation, and cosine similarity vector database.
- `test_rag.py`: A command-line script to test the end-to-end document parsing, indexing, and querying logic.
- `static/`: Contains UI files (`index.html`, `app.js`, `style.css`).
