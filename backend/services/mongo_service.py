"""
MongoDB service for upserting threat radar data.
"""
import os
from typing import Dict, Any, Optional
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError
from datetime import datetime


class MongoService:
    """Service for MongoDB operations related to threat radar data."""
    
    def __init__(self, connection_string: Optional[str] = None, db_name: Optional[str] = None, collection_name: Optional[str] = None):
        """
        Initialize MongoDB service.
        
        Args:
            connection_string: MongoDB connection string (defaults to MONGO_CONNECTION_STRING env var)
            db_name: Database name (defaults to MONGO_DB_NAME env var)
            collection_name: Collection name (defaults to MONGO_COLLECTION_NAME env var)
        """
        self.connection_string = connection_string or os.getenv("MONGO_CONNECTION_STRING", "").strip()
        self.db_name = db_name or os.getenv("MONGO_DB_NAME", "").strip()
        self.collection_name = collection_name or os.getenv("MONGO_COLLECTION_NAME", "").strip()
        
        if not self.connection_string:
            raise ValueError("MongoDB connection string is required. Set MONGO_CONNECTION_STRING in environment.")
        if not self.db_name:
            raise ValueError("MongoDB database name is required. Set MONGO_DB_NAME in environment.")
        if not self.collection_name:
            raise ValueError("MongoDB collection name is required. Set MONGO_COLLECTION_NAME in environment.")
        
        self.client: Optional[MongoClient] = None
        self.db = None
        self.collection = None
    
    def connect(self) -> None:
        """Establish connection to MongoDB."""
        try:
            self.client = MongoClient(self.connection_string, serverSelectionTimeoutMS=5000)
            # Test connection
            self.client.admin.command('ping')
            
            self.db = self.client[self.db_name]
            self.collection = self.db[self.collection_name]
        except ConnectionFailure as e:
            raise ConnectionError(f"Failed to connect to MongoDB: {e}")
    
    def disconnect(self) -> None:
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            self.collection = None
    
    def upsert_radar(self, radar_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Upsert threat radar data into MongoDB.
        
        Uses customer_id and generated_at as the unique identifier.
        If a document with the same customer_id exists, it will be updated.
        Otherwise, a new document will be inserted.
        
        Args:
            radar_data: Dictionary containing the radar response data
            
        Returns:
            Dictionary with operation result containing:
            - success: bool
            - message: str
            - document_id: Optional[str]
        """
        if not self.client:
            self.connect()
        
        try:
            # Extract customer_id and generated_at for unique identification
            customer_id = radar_data.get("meta", {}).get("customer_id")
            generated_at = radar_data.get("meta", {}).get("generated_at")
            
            if not customer_id:
                raise ValueError("customer_id is required in radar_data.meta")
            
            # Create filter for upsert (match on customer_id)
            # Optionally, you could use customer_id + generated_at for versioning
            filter_query = {"meta.customer_id": customer_id}
            
            # Add metadata for tracking
            radar_data["_last_updated"] = datetime.utcnow()
            if generated_at:
                radar_data["_generated_at"] = generated_at
            
            # Perform upsert
            result = self.collection.update_one(
                filter_query,
                {"$set": radar_data},
                upsert=True
            )
            
            if result.upserted_id:
                return {
                    "success": True,
                    "message": f"Inserted new radar document for customer {customer_id}",
                    "document_id": str(result.upserted_id),
                    "operation": "insert"
                }
            else:
                return {
                    "success": True,
                    "message": f"Updated existing radar document for customer {customer_id}",
                    "document_id": str(result.upserted_id) if result.upserted_id else None,
                    "operation": "update",
                    "matched_count": result.matched_count,
                    "modified_count": result.modified_count
                }
                
        except PyMongoError as e:
            return {
                "success": False,
                "message": f"MongoDB error: {str(e)}",
                "document_id": None
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unexpected error: {str(e)}",
                "document_id": None
            }
    
    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()

