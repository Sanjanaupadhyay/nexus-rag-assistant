import os
import time
import json
import shutil
import traceback
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from vector_store import (
    SimpleVectorStore,
    RecursiveCharacterTextSplitter,
    parse_document,
    get_embeddings
)

# Initialize FastAPI app
app = FastAPI(title="Nexus Enterprise RAG Assistant")

# CORS middleware for testing if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
DATA_DIR = os.path.join(os.getcwd(), "data")
DOCS_DIR = os.path.join(DATA_DIR, "documents")
DB_FILE = os.path.join(DATA_DIR, "vector_store.json")

os.makedirs(DOCS_DIR, exist_ok=True)

# Load global vector store
vector_store = SimpleVectorStore()
vector_store.load(DB_FILE)

# Analytics track
analytics = {
    "total_queries": 0,
    "total_search_time_ms": 0.0,
    "errors_count": 0
}


# Models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    settings: dict = {}


@app.get("/api/documents")
async def list_documents():
    """List all documents indexed, counting chunks per document."""
    doc_stats = {}
    for chunk in vector_store.chunks:
        meta = chunk.get("metadata", {})
        filename = meta.get("filename")
        if filename:
            if filename not in doc_stats:
                doc_stats[filename] = {
                    "filename": filename,
                    "chunks": 0,
                    "size_bytes": meta.get("size_bytes", 0),
                    "uploaded_at": meta.get("uploaded_at", "")
                }
            doc_stats[filename]["chunks"] += 1
            
    return list(doc_stats.values())


@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    provider: str = "gemini",
    api_key: str = ""
):
    """Upload a file, parse it, chunk it, generate embeddings, and add to index."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    file_path = os.path.join(DOCS_DIR, file.filename)
    
    # Check API key
    active_key = api_key or os.environ.get("GEMINI_API_KEY") if provider == "gemini" else os.environ.get("OPENAI_API_KEY")
    if not active_key:
        raise HTTPException(
            status_code=400, 
            detail=f"API Key for {provider} not configured. Please set it in Settings."
        )
        
    try:
        # Save file to local disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(file_path)
        
        # Parse document
        raw_text = parse_document(file_path)
        
        if not raw_text.strip():
            raise ValueError("Document appears to be empty or has no readable text.")
            
        # Split text into chunks
        splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        chunks = splitter.split_text(raw_text)
        
        # Generate embeddings
        embeddings = get_embeddings(chunks, provider=provider, api_key=active_key)
        
        # Build metadata list
        metadata_list = [{
            "filename": file.filename,
            "chunk_idx": idx,
            "size_bytes": file_size,
            "uploaded_at": time.strftime("%Y-%m-%d %H:%M:%S")
        } for idx in range(len(chunks))]
        
        # Remove old entries of same document if it exists (re-upload)
        vector_store.delete_document(file.filename)
        
        # Add to index
        vector_store.add_chunks(chunks, embeddings, metadata_list)
        
        # Save vector DB
        vector_store.save(DB_FILE)
        
        return {
            "success": True, 
            "filename": file.filename, 
            "chunks_count": len(chunks),
            "size_bytes": file_size
        }
        
    except Exception as e:
        analytics["errors_count"] += 1
        traceback.print_exc()
        # Clean up file on error if saved
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    """Delete a document from vector index and remove its physical file."""
    try:
        # Remove from vector index
        vector_store.delete_document(filename)
        vector_store.save(DB_FILE)
        
        # Remove physical file
        file_path = os.path.join(DOCS_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            
        return {"success": True, "detail": f"Document {filename} deleted successfully"}
    except Exception as e:
        analytics["errors_count"] += 1
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat endpoint using Server-Sent Events (SSE) to stream answer with source citations."""
    settings = request.settings
    provider = settings.get("provider", "gemini")
    model_name = settings.get("model", "gemini-1.5-flash")
    api_key_input = settings.get("apiKey", "")
    temperature = settings.get("temperature", 0.7)
    top_k = settings.get("top_k", 4)
    
    # Key checking
    api_key = api_key_input or (os.environ.get("GEMINI_API_KEY") if provider == "gemini" else os.environ.get("OPENAI_API_KEY"))
    if not api_key:
        raise HTTPException(status_code=400, detail=f"API Key for {provider} not configured.")
        
    # Search Vector Store if index has chunks
    citations = []
    context = ""
    
    if vector_store.chunks:
        start_time = time.time()
        try:
            # Get query embedding
            query_emb_list = get_embeddings([request.message], provider=provider, api_key=api_key)
            if query_emb_list:
                query_emb = query_emb_list[0]
                # Search similarity
                matches = vector_store.similarity_search(query_emb, top_k=top_k)
                
                # Format context and citation list
                for match in matches:
                    citations.append({
                        "filename": match["metadata"].get("filename", "Unknown"),
                        "text": match["text"],
                        "score": match["score"]
                    })
                
                # Combine matching chunks as context for prompt
                context = "\n\n---\n\n".join([f"Source: {c['filename']}\nContent: {c['text']}" for c in citations])
                
                # Update metrics
                search_latency_ms = (time.time() - start_time) * 1000
                analytics["total_queries"] += 1
                analytics["total_search_time_ms"] += search_latency_ms
        except Exception as e:
            traceback.print_exc()
            # Don't fail the chat entirely, proceed without context if search fails
            print(f"Vector search failed: {e}")

    # Build system instructions
    system_prompt = (
        "You are 'Nexus', an advanced enterprise RAG (Retrieval-Augmented Generation) assistant. "
        "Your task is to answer user queries using ONLY the provided document context below where possible. "
        "If the context is empty, or doesn't contain the answer, notify the user that no relevant indexed information was found in their documents, and answer the query using your general knowledge, but clearly state you are doing so. "
        "Always cite the files you retrieve information from. Format code, tables, and lists nicely using Markdown.\n\n"
        f"--- START DOCUMENT CONTEXT ---\n{context}\n--- END DOCUMENT CONTEXT ---"
    )

    # Stream generator
    def sse_generator():
        # First send the citations
        yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"
        
        try:
            if provider == "gemini":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                
                model = genai.GenerativeModel(
                    model_name=model_name,
                    generation_config={"temperature": temperature},
                    system_instruction=system_prompt
                )
                
                contents = []
                for msg in request.history:
                    role = "user" if msg.role == "user" else "model"
                    contents.append({"role": role, "parts": [msg.content]})
                
                contents.append({"role": "user", "parts": [request.message]})
                
                response_stream = model.generate_content(contents, stream=True)
                for chunk in response_stream:
                    if chunk.text:
                        yield f"data: {json.dumps({'type': 'text', 'text': chunk.text})}\n\n"
                        
            elif provider == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                
                messages = [{"role": "system", "content": system_prompt}]
                for msg in request.history:
                    # OpenAI system role can remain, others map user/assistant
                    role = "assistant" if msg.role == "model" else msg.role
                    messages.append({"role": role, "content": msg.content})
                
                messages.append({"role": "user", "content": request.message})
                
                response_stream = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=temperature,
                    stream=True
                )
                for chunk in response_stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Unsupported provider'})}\n\n"
                
        except Exception as e:
            traceback.print_exc()
            analytics["errors_count"] += 1
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


class SearchRequest(BaseModel):
    query: str
    settings: dict = {}


@app.post("/api/search")
async def search_vector_db(request: SearchRequest):
    """Search vector DB directly, returning raw matching chunks with scores."""
    settings = request.settings
    provider = settings.get("provider", "gemini")
    api_key_input = settings.get("apiKey", "")
    top_k = settings.get("top_k", 4)
    
    api_key = api_key_input or (os.environ.get("GEMINI_API_KEY") if provider == "gemini" else os.environ.get("OPENAI_API_KEY"))
    if not api_key:
        raise HTTPException(status_code=400, detail=f"API Key for {provider} not configured.")
        
    if not vector_store.chunks:
        return []
        
    try:
        query_emb_list = get_embeddings([request.query], provider=provider, api_key=api_key)
        if not query_emb_list:
            return []
        matches = vector_store.similarity_search(query_emb_list[0], top_k=top_k)
        return matches
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    """Retrieve database metrics and search analytics."""
    files = list(set([c["metadata"].get("filename") for c in vector_store.chunks if c.get("metadata", {}).get("filename")]))
    total_chunks = len(vector_store.chunks)
    
    # Calculate average search latency
    avg_latency = 0.0
    if analytics["total_queries"] > 0:
        avg_latency = analytics["total_search_time_ms"] / analytics["total_queries"]
        
    # Estimate total size from documents directory
    size_bytes = 0
    for f in files:
        file_path = os.path.join(DOCS_DIR, f)
        if os.path.exists(file_path):
            size_bytes += os.path.getsize(file_path)
            
    return {
        "files_count": len(files),
        "chunks_count": total_chunks,
        "total_queries": analytics["total_queries"],
        "avg_search_latency_ms": round(avg_latency, 2),
        "db_size_bytes": size_bytes,
        "errors_count": analytics["errors_count"]
    }

# Mount static files (served under /)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
