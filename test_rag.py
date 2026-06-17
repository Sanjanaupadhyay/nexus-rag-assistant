import os
import sys
from vector_store import (
    RecursiveCharacterTextSplitter,
    SimpleVectorStore,
    parse_document,
    get_embeddings
)

def main():
    print("=== Testing RAG Document Processing Pipeline ===")
    
    # 1. Create a dummy txt document
    doc_path = "test_doc.txt"
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(
            "Nexus RAG Enterprise Knowledge Assistant v1.0 was released in June 2026.\n"
            "Features include custom pure-python vector database indexing, streaming Server-Sent Events,\n"
            "glassmorphic styling, and compatibility with Google Gemini and OpenAI models.\n"
            "It provides enterprise security and is developed by pair programming with an advanced AI assistant.\n"
            "Contact support at support@nexus.internal for any technical queries.\n"
        )
    print(f"Created sample document: {doc_path}")
    
    # 2. Parse
    print("Parsing document...")
    content = parse_document(doc_path)
    print(f"Parsed content length: {len(content)} characters")
    
    # 3. Chunk
    print("Chunking document...")
    splitter = RecursiveCharacterTextSplitter(chunk_size=150, chunk_overlap=30)
    chunks = splitter.split_text(content)
    print(f"Split into {len(chunks)} chunks:")
    for idx, c in enumerate(chunks):
        print(f"  Chunk {idx+1}: {repr(c)}")
        
    # 4. Embeddings using Gemini (since it is set in env)
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set. Cannot run embedding test.")
        sys.exit(1)
        
    print("Generating embeddings using Gemini API...")
    try:
        embeddings = get_embeddings(chunks, provider="gemini", api_key=api_key)
        print(f"Successfully generated {len(embeddings)} embeddings. Dimension of first embedding: {len(embeddings[0])}")
    except Exception as e:
        print(f"Embedding generation failed: {e}")
        sys.exit(1)
        
    # 5. Vector Store indexing & similarity search
    print("Indexing in SimpleVectorStore...")
    db = SimpleVectorStore()
    metadata = [{"filename": doc_path, "chunk_idx": i} for i in range(len(chunks))]
    db.add_chunks(chunks, embeddings, metadata)
    
    # Test Similarity Search
    query = "When was Nexus RAG released?"
    print(f"\nRunning similarity search for query: '{query}'")
    query_emb = get_embeddings([query], provider="gemini", api_key=api_key)[0]
    results = db.similarity_search(query_emb, top_k=2)
    
    print("Results:")
    for r in results:
        print(f"  Match Score: {r['score']:.4f} | Source: {r['metadata']['filename']} (Chunk {r['metadata']['chunk_idx']+1})")
        print(f"  Text: {repr(r['text'])}")
        
    # Clean up dummy doc
    os.remove(doc_path)
    print("\nTest completed successfully!")

if __name__ == "__main__":
    main()
