import mongoose from "mongoose";
import { Env } from "./env.config";

const redactMongoUri = (uri: string) =>
  uri.replace(/\/\/([^:/?#]+):([^@]+)@/, "//$1:****@");

const getMongoConnectionUris = () => {
  const primaryUri = Env.MONGO_URI.trim();
  const uris = [primaryUri];

  if (Env.DB_FALLBACK_ENABLED) {
    const fallbackUri = Env.MONGO_FALLBACK_URI.trim();
    if (fallbackUri && fallbackUri !== primaryUri) {
      uris.push(fallbackUri);
    }
  }

  return uris;
};

const connectWithUri = async (uri: string) => {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
  });
};

const connctDatabase = async () => {
  const candidates = getMongoConnectionUris();
  let lastError: unknown = null;

  for (const uri of candidates) {
    try {
      await connectWithUri(uri);
      console.log(`Connected to MongoDB database (${redactMongoUri(uri)})`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Failed MongoDB connection attempt (${redactMongoUri(uri)})`);
      await mongoose.disconnect().catch(() => undefined);
    }
  }

  console.error("Error connecting to MongoDB database:", lastError);
  process.exit(1);
};

export default connctDatabase;
