import os
import json
import docx2txt
import numpy as np
from pypdf import PdfReader
import google.generativeai as genai
from openai import OpenAI

class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> list[str]:
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            if end < text_len:
                best_split = -1
                for sep in self.separators:
                    if not sep:
                        continue
                    idx = text.rfind(sep, start, end)
                    # Check if separator is in the second half of the chunk to avoid too small chunks
                    if idx != -1 and idx > start + (self.chunk_size // 2):
                        best_split = idx + len(sep)
                        break
                if best_split != -1:
                    end = best_split
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start = end - self.chunk_overlap if end < text_len else end
            if start >= end:
                start = end
        return chunks


def parse_document(file_path: str) -> str:
    _, ext = os.path.splitext(file_path.lower())
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif ext == ".pdf":
        with open(file_path, "rb") as f:
            reader = PdfReader(f)
            text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text.append(t)
            return "\n\n".join(text)
    elif ext == ".docx":
        return docx2txt.process(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")


def get_embeddings(texts: list[str], provider: str, api_key: str) -> list[list[float]]:
    if not texts:
        return []
    
    # Process in batches of 50 to avoid limits
    batch_size = 50
    embeddings = []
    
    if provider == "gemini":
        genai.configure(api_key=api_key)
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            result = genai.embed_content(
                model="models/gemini-embedding-001",
                content=batch,
                task_type="retrieval_document"
            )
            embeddings.extend(result['embedding'])
            
    elif provider == "openai":
        client = OpenAI(api_key=api_key)
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=batch
            )
            embeddings.extend([d.embedding for d in response.data])
    else:
        raise ValueError(f"Unknown provider: {provider}")
        
    return embeddings


class SimpleVectorStore:
    def __init__(self):
        # List of dicts: {"text": str, "embedding": list[float], "metadata": dict}
        self.chunks = []

    def add_chunks(self, chunks: list[str], embeddings: list[list[float]], metadata_list: list[dict]):
        for text, emb, meta in zip(chunks, embeddings, metadata_list):
            self.chunks.append({
                "text": text,
                "embedding": emb,
                "metadata": meta
            })

    def delete_document(self, filename: str):
        self.chunks = [c for c in self.chunks if c["metadata"].get("filename") != filename]

    def similarity_search(self, query_embedding: list[float], top_k: int = 4) -> list[dict]:
        if not self.chunks:
            return []
        
        # Calculate cosine similarity using numpy
        embeddings = np.array([c["embedding"] for c in self.chunks])
        query = np.array(query_embedding)
        
        dot_products = np.dot(embeddings, query)
        norms_embeddings = np.linalg.norm(embeddings, axis=1)
        norm_query = np.linalg.norm(query)
        
        norms_embeddings[norms_embeddings == 0] = 1.0
        if norm_query == 0:
            norm_query = 1.0
            
        similarities = dot_products / (norms_embeddings * norm_query)
        
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            results.append({
                "text": self.chunks[idx]["text"],
                "metadata": self.chunks[idx]["metadata"],
                "score": float(similarities[idx])
            })
        return results

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.chunks, f, ensure_ascii=False, indent=2)

    def load(self, filepath: str):
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                self.chunks = json.load(f)
        else:
            self.chunks = []
